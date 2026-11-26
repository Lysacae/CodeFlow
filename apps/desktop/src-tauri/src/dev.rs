use serde::Serialize;
use serde_json::{json, Value};
use tauri::State;

use crate::auth;
use crate::cloud;
use crate::deps::{self, RuntimeStatus};
use crate::diag;
use crate::paths;
use crate::storage::{self, DbState, ProgressSnapshot};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub version: String,
    pub elevated: bool,
    pub winget_path: String,
    pub db_path: String,
    pub app_data: String,
    pub projects_dir: String,
    pub sandbox_dir: String,
    pub runtimes: Vec<RuntimeStatus>,
    pub recent_errors: Vec<String>,
}

fn ensure_dev(state: &State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    auth::require_devtesting(&conn)?;
    Ok(())
}

#[tauri::command]
pub fn dev_list_accounts(state: State<'_, DbState>) -> Result<Vec<cloud::CloudUser>, String> {
    ensure_dev(&state)?;
    cloud::list_cloud_accounts()
}

#[tauri::command]
pub fn dev_delete_account(state: State<'_, DbState>, user_id: String) -> Result<(), String> {
    let user_id = user_id.trim().to_string();
    if user_id.is_empty() {
        return Err("Compte introuvable.".into());
    }

    let (self_id, username) = {
        let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
        let me = auth::require_devtesting(&conn)?;
        if me.id == user_id {
            return Err("Le compte connecté ne se supprime pas depuis cette liste.".into());
        }
        (me.id, me.username)
    };
    let _ = (self_id, username);

    let cloud_user = cloud::fetch_cloud_user(&user_id).ok();
    cloud::admin_delete_cloud_user(&user_id)?;

    if let Some(user) = cloud_user.as_ref() {
        let _ = crate::recovery::clear_recovery_for_username(&user.username);
    }

    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    auth::purge_local_user_if_present(&conn, &user_id)?;
    Ok(())
}

fn json_strings(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|text| text.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

fn json_strings_any(value: Option<&Value>, keys: &[&str]) -> Vec<String> {
    let Some(value) = value else {
        return Vec::new();
    };
    for key in keys {
        let found = json_strings(value.get(*key));
        if !found.is_empty() {
            return found;
        }
    }
    Vec::new()
}

fn xp_to_reach(level: u32) -> u64 {
    if level <= 1 {
        return 0;
    }
    let steps = f64::from(level - 1);
    let value = 200.0 * (1.08_f64.powf(steps) - 1.0) / 0.08;
    value.round().max(0.0) as u64
}

fn level_for_xp(xp: u64) -> u32 {
    let mut level = 1u32;
    while level < 200 && xp_to_reach(level + 1) <= xp {
        level += 1;
    }
    level
}

fn rank_for_level(level: u32) -> (&'static str, &'static str) {
    const RANKS: &[(u32, &str, &str)] = &[
        (1, "bronze", "Bronze"),
        (4, "fer", "Fer"),
        (7, "argent", "Argent"),
        (10, "or", "Or"),
        (13, "platine", "Platine"),
        (16, "diamant", "Diamant"),
        (19, "emeraude", "Émeraude"),
        (22, "jade", "Jade"),
        (24, "perle", "Perle"),
        (26, "amethyste", "Améthyste"),
        (28, "titane", "Titane"),
        (52, "tungstene", "Tungstène"),
    ];
    let mut current = RANKS[0];
    for rank in RANKS {
        if level >= rank.0 {
            current = *rank;
        }
    }
    (current.1, current.2)
}

fn empty_stats() -> Value {
    json!({
        "themes": [],
        "focus": false,
        "tutorial": false,
        "runsOk": 0,
        "runsFail": 0,
        "recovered": false,
        "assist": false,
        "messagesSent": 0,
        "emojiSent": false,
        "reactions": 0,
        "requestsSent": 0,
        "accepts": 0,
        "refuses": 0,
        "deletedUnread": false,
        "reads": 0,
        "friendPeak": 0,
        "leaderboard": false,
        "visitedProfile": false,
        "goalMet": false,
        "goalAmbitious": false,
        "activeDays": []
    })
}

fn apply_rank(obj: &mut serde_json::Map<String, Value>, xp: u64) {
    let level = level_for_xp(xp);
    let (rank_id, rank_name) = rank_for_level(level);
    obj.insert("xp".into(), json!(xp));
    obj.insert("level".into(), json!(level));
    obj.insert("rankId".into(), json!(rank_id));
    obj.insert("rankName".into(), json!(rank_name));
}

/// Efface XP, rang et succès d'un compte (cloud), sans toucher aux leçons affichées.
/// `achievement_ids` est le catalogue entier : tout succès déjà mérité reste gelé.
#[tauri::command]
pub fn dev_reset_rank(
    state: State<'_, DbState>,
    user_id: String,
    achievement_ids: Vec<String>,
) -> Result<Value, String> {
    ensure_dev(&state)?;
    let user_id = user_id.trim().to_string();
    if user_id.is_empty() {
        return Err("Compte introuvable.".into());
    }
    let mut saved = json!({});
    cloud::patch_app_metadata(&user_id, |meta| {
        let progress = meta.get("progress").cloned().unwrap_or_else(|| json!({}));
        let progression = meta.get("progression").cloned().unwrap_or_else(|| json!({}));
        let lessons = json_strings_any(Some(&progress), &["completedLessons", "completed_lessons"]);
        let exercises = json_strings_any(Some(&progress), &["completedExercises", "completed_exercises"]);
        let mut qa_keys = Vec::new();
        if let Some(entries) = progress.get("qa").and_then(|value| value.as_object()) {
            for (language, value) in entries {
                let ids = json_strings_any(Some(value), &["correctIds", "correct_ids"]);
                for id in ids {
                    qa_keys.push(format!("{language}:{id}"));
                }
            }
        }
        let mut frozen = achievement_ids;
        for id in json_strings(progression.get("achievements")) {
            if !frozen.iter().any(|item| item == &id) {
                frozen.push(id);
            }
        }
        let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let mut next = progression.as_object().cloned().unwrap_or_default();
        apply_rank(&mut next, 0);
        next.insert("achievements".into(), json!([]));
        next.insert("claimedLessons".into(), json!([]));
        next.insert("qaGrants".into(), json!({}));
        next.insert("qaSeenAttempts".into(), json!({}));
        next.insert("stats".into(), empty_stats());
        next.insert("resetAt".into(), json!(now.clone()));
        next.insert("updatedAt".into(), json!(now));
        next.insert(
            "creditFloor".into(),
            json!({
                "lessons": lessons,
                "exercises": exercises,
                "qaKeys": qa_keys,
                "achievementIds": frozen,
            }),
        );
        saved = Value::Object(next.clone());
        meta.insert("progression".into(), Value::Object(next));
        Ok(())
    })?;
    Ok(saved)
}

#[tauri::command]
pub fn dev_get_progression(state: State<'_, DbState>, user_id: String) -> Result<Value, String> {
    ensure_dev(&state)?;
    let user_id = user_id.trim().to_string();
    if user_id.is_empty() {
        return Err("Compte introuvable.".into());
    }
    let full = cloud::fetch_raw_user(&user_id)?;
    Ok(full
        .pointer("/app_metadata/progression")
        .cloned()
        .filter(|value| value.is_object())
        .unwrap_or_else(|| json!({})))
}

/// Ajoute des succès déjà débloqués et retire leur gel, puis recalcule le rang.
#[tauri::command]
pub fn dev_unlock_achievements(
    state: State<'_, DbState>,
    user_id: String,
    ids: Vec<String>,
    xp_by_id: std::collections::HashMap<String, u64>,
) -> Result<Value, String> {
    ensure_dev(&state)?;
    let user_id = user_id.trim().to_string();
    if user_id.is_empty() {
        return Err("Compte introuvable.".into());
    }
    if ids.is_empty() {
        return Err("Aucun succès à débloquer.".into());
    }
    let mut saved = json!({});
    cloud::patch_app_metadata(&user_id, |meta| {
        let progression = meta.get("progression").cloned().unwrap_or_else(|| json!({}));
        let mut next = progression.as_object().cloned().unwrap_or_default();
        let mut owned = json_strings(next.get("achievements"));
        let mut bonus = 0u64;
        for id in ids {
            let id = id.trim().to_string();
            if id.is_empty() || owned.iter().any(|item| item == &id) {
                continue;
            }
            bonus += xp_by_id.get(&id).copied().unwrap_or(0);
            owned.push(id);
        }
        let floor = next.get("creditFloor").cloned().unwrap_or_else(|| json!({}));
        let mut floor_obj = floor.as_object().cloned().unwrap_or_default();
        let kept: Vec<String> = json_strings(floor_obj.get("achievementIds"))
            .into_iter()
            .filter(|id| !owned.iter().any(|item| item == id))
            .collect();
        floor_obj.insert("achievementIds".into(), json!(kept));
        let xp = next.get("xp").and_then(|value| value.as_u64()).unwrap_or(0).saturating_add(bonus);
        let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        apply_rank(&mut next, xp);
        next.insert("achievements".into(), json!(owned));
        next.insert("creditFloor".into(), Value::Object(floor_obj));
        next.insert("updatedAt".into(), json!(now));
        saved = Value::Object(next.clone());
        meta.insert("progression".into(), Value::Object(next));
        Ok(())
    })?;
    Ok(saved)
}

#[tauri::command]
pub fn maintenance_bypass() -> bool {
    if std::env::var("CODEFLOW_BYPASS_MAINTENANCE")
        .ok()
        .as_deref()
        == Some("1")
    {
        return true;
    }
    if let Ok(dir) = paths::app_data_dir() {
        if dir.join("maintenance.bypass").is_file() {
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn dev_reset_session(state: State<'_, DbState>) -> Result<ProgressSnapshot, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let me = auth::require_devtesting(&conn)?;
    storage::clear_learning_progress(&conn, &me.id)
}

#[tauri::command]
pub fn dev_diagnostics(state: State<'_, DbState>) -> Result<Diagnostics, String> {
    ensure_dev(&state)?;
    let runtimes = deps::detect_runtimes_sync().unwrap_or_default();
    Ok(Diagnostics {
        version: env!("CARGO_PKG_VERSION").to_string(),
        elevated: diag::is_elevated(),
        winget_path: deps::winget_location(),
        db_path: paths::db_path()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|err| err),
        app_data: paths::app_data_dir()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|err| err),
        projects_dir: paths::projects_dir()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|err| err),
        sandbox_dir: paths::sandbox_dir()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|err| err),
        runtimes,
        recent_errors: diag::recent(),
    })
}
