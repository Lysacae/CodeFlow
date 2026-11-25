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

/// Efface XP, rang et succès d'un compte (cloud), sans toucher aux leçons affichées.
#[tauri::command]
pub fn dev_reset_rank(state: State<'_, DbState>, user_id: String) -> Result<(), String> {
    ensure_dev(&state)?;
    let user_id = user_id.trim().to_string();
    if user_id.is_empty() {
        return Err("Compte introuvable.".into());
    }
    cloud::patch_app_metadata(&user_id, |meta| {
        let progress = meta.get("progress").cloned().unwrap_or_else(|| json!({}));
        let progression = meta.get("progression").cloned().unwrap_or_else(|| json!({}));
        let lessons = json_strings(progress.get("completedLessons"));
        let exercises = json_strings(progress.get("completedExercises"));
        let mut qa_keys = Vec::new();
        if let Some(entries) = progress.get("qa").and_then(|value| value.as_object()) {
            for (language, value) in entries {
                for id in json_strings(value.get("correctIds")) {
                    qa_keys.push(format!("{language}:{id}"));
                }
            }
        }
        let achievements = json_strings(progression.get("achievements"));
        let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let mut next = progression.as_object().cloned().unwrap_or_default();
        next.insert("xp".into(), json!(0));
        next.insert("level".into(), json!(1));
        next.insert("rankId".into(), json!("bronze"));
        next.insert("rankName".into(), json!("Bronze"));
        next.insert("achievements".into(), json!([]));
        next.insert("claimedLessons".into(), json!([]));
        next.insert("qaGrants".into(), json!({}));
        next.insert("resetAt".into(), json!(now));
        next.insert("updatedAt".into(), json!(now));
        next.insert(
            "creditFloor".into(),
            json!({
                "lessons": lessons,
                "exercises": exercises,
                "qaKeys": qa_keys,
                "achievementIds": achievements,
            }),
        );
        meta.insert("progression".into(), Value::Object(next));
        Ok(())
    })
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
