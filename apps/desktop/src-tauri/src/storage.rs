use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Mutex;
use tauri::State;

use crate::auth::{self, require_user_id};
use crate::paths;

pub struct DbState(pub Mutex<Connection>);

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressSnapshot {
    pub completed_lessons: Vec<String>,
    pub completed_exercises: Vec<String>,
    pub last_lesson_id: Option<String>,
    pub last_language: Option<String>,
    pub daily_goal: i32,
    pub daily_count: i32,
    pub daily_date: String,
    pub history: Vec<HistoryEntry>,
    pub setup_done: bool,
    pub theme: String,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub qa: BTreeMap<String, QaLanguageProgress>,
    #[serde(default)]
    pub tutorial_seen: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct QaLanguageProgress {
    #[serde(default)]
    pub correct_ids: Vec<String>,
    #[serde(default)]
    pub failed_ids: Vec<String>,
    #[serde(default)]
    pub attempts: u32,
    #[serde(default)]
    pub correct_attempts: u32,
    #[serde(default)]
    pub time_spent_ms: u64,
    #[serde(default)]
    pub completion_ms: Option<u64>,
    #[serde(default)]
    pub pool_size: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavedProgram {
    pub id: String,
    pub name: String,
    pub language: String,
    pub file_name: String,
    pub code: String,
    pub updated_at: String,
}

fn today() -> String {
    Utc::now().format("%Y-%m-%d").to_string()
}

fn table_has_column(conn: &Connection, table: &str, column: &str) -> bool {
    let mut stmt = match conn.prepare(&format!("PRAGMA table_info({table})")) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let rows = stmt.query_map([], |row| row.get::<_, String>(1));
    match rows {
        Ok(iter) => iter.flatten().any(|name| name == column),
        Err(_) => false,
    }
}

fn reset_progress_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        DROP TABLE IF EXISTS completed_lessons;
        DROP TABLE IF EXISTS completed_exercises;
        DROP TABLE IF EXISTS history;
        DROP TABLE IF EXISTS programs;
        DROP TABLE IF EXISTS user_meta;
        CREATE TABLE user_meta (
            user_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY (user_id, key)
        );
        CREATE TABLE completed_lessons (
            user_id TEXT NOT NULL,
            lesson_id TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            PRIMARY KEY (user_id, lesson_id)
        );
        CREATE TABLE completed_exercises (
            user_id TEXT NOT NULL,
            exercise_id TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            PRIMARY KEY (user_id, exercise_id)
        );
        CREATE TABLE history (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            label TEXT NOT NULL,
            at TEXT NOT NULL
        );
        CREATE TABLE programs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            language TEXT NOT NULL,
            file_name TEXT NOT NULL,
            code TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        ",
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn init_db() -> Result<Connection, String> {
    let path = paths::db_path()?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    auth::ensure_auth_tables(&conn)?;

    let lessons_ok = table_has_column(&conn, "completed_lessons", "user_id");
    if !lessons_ok {
        reset_progress_tables(&conn)?;
    } else {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS user_meta (
                user_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                PRIMARY KEY (user_id, key)
            );
            CREATE TABLE IF NOT EXISTS completed_lessons (
                user_id TEXT NOT NULL,
                lesson_id TEXT NOT NULL,
                completed_at TEXT NOT NULL,
                PRIMARY KEY (user_id, lesson_id)
            );
            CREATE TABLE IF NOT EXISTS completed_exercises (
                user_id TEXT NOT NULL,
                exercise_id TEXT NOT NULL,
                completed_at TEXT NOT NULL,
                PRIMARY KEY (user_id, exercise_id)
            );
            CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                label TEXT NOT NULL,
                at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS programs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                language TEXT NOT NULL,
                file_name TEXT NOT NULL,
                code TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            ",
        )
        .map_err(|e| e.to_string())?;
    }

    migrate_legacy_if_needed(&conn)?;
    crate::auth::seed_environments_onboarding(&conn)?;

    Ok(conn)
}

fn migrate_legacy_if_needed(conn: &Connection) -> Result<(), String> {
    let has_old_meta: bool = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'")
        .and_then(|mut s| s.exists([]))
        .unwrap_or(false);
    if !has_old_meta {
        return Ok(());
    }

    let user_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))
        .unwrap_or(0);
    if user_count > 0 {
        return Ok(());
    }

    // Créer un compte local pour conserver l'ancienne progression
    let id = uuid::Uuid::new_v4().to_string();
    let salt = uuid::Uuid::new_v4().to_string();
    let hash = {
        use sha2::Digest;
        let mut hasher = sha2::Sha256::new();
        hasher.update(salt.as_bytes());
        hasher.update(b"|");
        hasher.update(b"codeflow");
        hasher
            .finalize()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    };
    conn.execute(
        "INSERT INTO users(id, username, password_hash, salt, avatar_data, created_at)
         VALUES(?1, 'local', ?2, ?3, NULL, ?4)",
        params![id, hash, salt, Utc::now().to_rfc3339()],
    )
    .ok();

    // Copier meta -> user_meta
    if let Ok(mut stmt) = conn.prepare("SELECT key, value FROM meta") {
        if let Ok(rows) = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }) {
            for row in rows.flatten() {
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO user_meta(user_id, key, value) VALUES(?1, ?2, ?3)",
                    params![id, row.0, row.1],
                );
            }
        }
    }

    Ok(())
}

fn set_meta_default(conn: &Connection, user_id: &str, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO user_meta(user_id, key, value) VALUES(?1, ?2, ?3)",
        params![user_id, key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn init_user_meta(conn: &Connection, user_id: &str) -> Result<(), String> {
    set_meta_default(conn, user_id, "setup_done", "false")?;
    set_meta_default(conn, user_id, "theme", "dark")?;
    set_meta_default(conn, user_id, "daily_goal", "3")?;
    set_meta_default(conn, user_id, "daily_count", "0")?;
    set_meta_default(conn, user_id, "daily_date", &today())?;
    Ok(())
}

fn get_meta(conn: &Connection, user_id: &str, key: &str, default: &str) -> String {
    conn.query_row(
        "SELECT value FROM user_meta WHERE user_id = ?1 AND key = ?2",
        params![user_id, key],
        |row| row.get(0),
    )
    .unwrap_or_else(|_| default.to_string())
}

fn set_meta(conn: &Connection, user_id: &str, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO user_meta(user_id, key, value) VALUES(?1, ?2, ?3)
         ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value",
        params![user_id, key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn list_ids(conn: &Connection, user_id: &str, table: &str) -> Result<Vec<String>, String> {
    let col = match table {
        "completed_lessons" => "lesson_id",
        "completed_exercises" => "exercise_id",
        _ => return Err("Table invalide".into()),
    };
    let sql = format!("SELECT {col} FROM {table} WHERE user_id = ?1");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![user_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

fn progress_for(conn: &Connection, user_id: &str) -> Result<ProgressSnapshot, String> {
    let daily_date = get_meta(conn, user_id, "daily_date", &today());
    let mut daily_count: i32 = get_meta(conn, user_id, "daily_count", "0")
        .parse()
        .unwrap_or(0);
    if daily_date != today() {
        daily_count = 0;
    }

    let mut stmt = conn
        .prepare(
            "SELECT id, kind, label, at FROM history WHERE user_id = ?1 ORDER BY at DESC LIMIT 50",
        )
        .map_err(|e| e.to_string())?;
    let history = stmt
        .query_map(params![user_id], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                kind: row.get(1)?,
                label: row.get(2)?,
                at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let updated_at = {
        let v = get_meta(conn, user_id, "updated_at", "");
        if v.is_empty() {
            None
        } else {
            Some(v)
        }
    };

    Ok(ProgressSnapshot {
        completed_lessons: list_ids(conn, user_id, "completed_lessons")?,
        completed_exercises: list_ids(conn, user_id, "completed_exercises")?,
        last_lesson_id: {
            let v = get_meta(conn, user_id, "last_lesson_id", "");
            if v.is_empty() {
                None
            } else {
                Some(v)
            }
        },
        last_language: {
            let v = get_meta(conn, user_id, "last_language", "");
            if v.is_empty() {
                None
            } else {
                Some(v)
            }
        },
        daily_goal: get_meta(conn, user_id, "daily_goal", "3")
            .parse()
            .unwrap_or(3),
        daily_count,
        daily_date: today(),
        history,
        setup_done: get_meta(conn, user_id, "setup_done", "false") == "true",
        theme: get_meta(conn, user_id, "theme", "dark"),
        updated_at,
        qa: read_qa(conn, user_id),
        tutorial_seen: read_tutorial(conn, user_id),
    })
}

fn read_tutorial(conn: &Connection, user_id: &str) -> Vec<String> {
    let raw = get_meta(conn, user_id, "tutorial_seen", "[]");
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_tutorial(conn: &Connection, user_id: &str, ids: &[String]) -> Result<(), String> {
    let raw = serde_json::to_string(ids).map_err(|e| e.to_string())?;
    set_meta(conn, user_id, "tutorial_seen", &raw)
}

fn read_qa(conn: &Connection, user_id: &str) -> BTreeMap<String, QaLanguageProgress> {
    let raw = get_meta(conn, user_id, "qa_progress", "{}");
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_qa(
    conn: &Connection,
    user_id: &str,
    qa: &BTreeMap<String, QaLanguageProgress>,
) -> Result<(), String> {
    let raw = serde_json::to_string(qa).map_err(|e| e.to_string())?;
    set_meta(conn, user_id, "qa_progress", &raw)
}

fn touch_progress(conn: &Connection, user_id: &str) -> Result<String, String> {
    let now = Utc::now().to_rfc3339();
    set_meta(conn, user_id, "updated_at", &now)?;
    Ok(now)
}

#[tauri::command]
pub fn get_progress(state: State<'_, DbState>) -> Result<ProgressSnapshot, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    progress_for(&conn, &user_id)
}

#[tauri::command]
pub fn complete_lesson(
    state: State<'_, DbState>,
    lesson_id: String,
    language: String,
    label: String,
) -> Result<ProgressSnapshot, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO completed_lessons(user_id, lesson_id, completed_at) VALUES(?1, ?2, ?3)",
        params![user_id, lesson_id, now],
    )
    .map_err(|e| e.to_string())?;
    set_meta(&conn, &user_id, "last_lesson_id", &lesson_id)?;
    set_meta(&conn, &user_id, "last_language", &language)?;
    bump_daily(&conn, &user_id)?;
    insert_history(&conn, &user_id, "lesson", &label)?;
    touch_progress(&conn, &user_id)?;
    progress_for(&conn, &user_id)
}

#[tauri::command]
pub fn complete_exercise(
    state: State<'_, DbState>,
    exercise_id: String,
    language: String,
    label: String,
) -> Result<ProgressSnapshot, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO completed_exercises(user_id, exercise_id, completed_at) VALUES(?1, ?2, ?3)",
        params![user_id, exercise_id, now],
    )
    .map_err(|e| e.to_string())?;
    set_meta(&conn, &user_id, "last_language", &language)?;
    bump_daily(&conn, &user_id)?;
    insert_history(&conn, &user_id, "exercise", &label)?;
    touch_progress(&conn, &user_id)?;
    progress_for(&conn, &user_id)
}

#[tauri::command]
pub fn set_last_lesson(
    state: State<'_, DbState>,
    lesson_id: String,
    language: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    set_meta(&conn, &user_id, "last_lesson_id", &lesson_id)?;
    set_meta(&conn, &user_id, "last_language", &language)?;
    touch_progress(&conn, &user_id)?;
    Ok(())
}

#[tauri::command]
pub fn set_daily_goal(state: State<'_, DbState>, goal: i32) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    set_meta(&conn, &user_id, "daily_goal", &goal.max(1).to_string())?;
    touch_progress(&conn, &user_id)?;
    Ok(())
}

#[tauri::command]
pub fn set_theme(state: State<'_, DbState>, theme: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    set_meta(&conn, &user_id, "theme", &theme)?;
    touch_progress(&conn, &user_id)?;
    Ok(())
}

#[tauri::command]
pub fn set_setup_done(state: State<'_, DbState>, done: bool) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    set_meta(
        &conn,
        &user_id,
        "setup_done",
        if done { "true" } else { "false" },
    )?;
    touch_progress(&conn, &user_id)?;
    Ok(())
}

#[tauri::command]
pub fn replace_progress(
    state: State<'_, DbState>,
    snapshot: ProgressSnapshot,
) -> Result<ProgressSnapshot, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    let now = snapshot
        .updated_at
        .clone()
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    conn.execute(
        "DELETE FROM completed_lessons WHERE user_id = ?1",
        params![user_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM completed_exercises WHERE user_id = ?1",
        params![user_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM history WHERE user_id = ?1", params![user_id])
        .map_err(|e| e.to_string())?;

    for lesson_id in &snapshot.completed_lessons {
        conn.execute(
            "INSERT OR IGNORE INTO completed_lessons(user_id, lesson_id, completed_at) VALUES(?1, ?2, ?3)",
            params![user_id, lesson_id, now],
        )
        .map_err(|e| e.to_string())?;
    }
    for exercise_id in &snapshot.completed_exercises {
        conn.execute(
            "INSERT OR IGNORE INTO completed_exercises(user_id, exercise_id, completed_at) VALUES(?1, ?2, ?3)",
            params![user_id, exercise_id, now],
        )
        .map_err(|e| e.to_string())?;
    }
    for entry in snapshot.history.iter().take(50) {
        conn.execute(
            "INSERT OR REPLACE INTO history(id, user_id, kind, label, at) VALUES(?1, ?2, ?3, ?4, ?5)",
            params![entry.id, user_id, entry.kind, entry.label, entry.at],
        )
        .map_err(|e| e.to_string())?;
    }

    set_meta(
        &conn,
        &user_id,
        "last_lesson_id",
        snapshot.last_lesson_id.as_deref().unwrap_or(""),
    )?;
    set_meta(
        &conn,
        &user_id,
        "last_language",
        snapshot.last_language.as_deref().unwrap_or(""),
    )?;
    set_meta(
        &conn,
        &user_id,
        "daily_goal",
        &snapshot.daily_goal.max(1).to_string(),
    )?;
    set_meta(
        &conn,
        &user_id,
        "daily_count",
        &snapshot.daily_count.max(0).to_string(),
    )?;
    let daily_date = if snapshot.daily_date.is_empty() {
        today()
    } else {
        snapshot.daily_date.clone()
    };
    set_meta(&conn, &user_id, "daily_date", &daily_date)?;
    set_meta(
        &conn,
        &user_id,
        "setup_done",
        if snapshot.setup_done { "true" } else { "false" },
    )?;
    let theme = match snapshot.theme.as_str() {
        "light" => "light",
        "prune" => "prune",
        "salad" => "salad",
        _ => "dark",
    };
    set_meta(&conn, &user_id, "theme", theme)?;
    set_meta(&conn, &user_id, "updated_at", &now)?;
    write_qa(&conn, &user_id, &snapshot.qa)?;
    write_tutorial(&conn, &user_id, &snapshot.tutorial_seen)?;
    progress_for(&conn, &user_id)
}

#[tauri::command]
pub fn mark_tutorial_seen(
    state: State<'_, DbState>,
    lesson_id: String,
) -> Result<ProgressSnapshot, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    let lesson_id = lesson_id.trim().to_string();
    if lesson_id.is_empty() {
        return Err("Leçon introuvable.".into());
    }
    let mut ids = read_tutorial(&conn, &user_id);
    if !ids.iter().any(|id| id == &lesson_id) {
        ids.push(lesson_id);
        write_tutorial(&conn, &user_id, &ids)?;
        touch_progress(&conn, &user_id)?;
    }
    progress_for(&conn, &user_id)
}

pub fn clear_learning_progress(
    conn: &Connection,
    user_id: &str,
) -> Result<ProgressSnapshot, String> {
    conn.execute(
        "DELETE FROM completed_lessons WHERE user_id = ?1",
        params![user_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM completed_exercises WHERE user_id = ?1",
        params![user_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM history WHERE user_id = ?1", params![user_id])
        .map_err(|e| e.to_string())?;
    set_meta(conn, user_id, "last_lesson_id", "")?;
    set_meta(conn, user_id, "last_language", "")?;
    set_meta(conn, user_id, "daily_count", "0")?;
    set_meta(conn, user_id, "daily_date", &today())?;
    set_meta(conn, user_id, "qa_progress", "{}")?;
    set_meta(conn, user_id, "tutorial_seen", "[]")?;
    touch_progress(conn, user_id)?;
    progress_for(conn, user_id)
}

#[tauri::command]
pub fn save_qa_progress(
    state: State<'_, DbState>,
    qa: BTreeMap<String, QaLanguageProgress>,
) -> Result<ProgressSnapshot, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    write_qa(&conn, &user_id, &qa)?;
    touch_progress(&conn, &user_id)?;
    progress_for(&conn, &user_id)
}

fn bump_daily(conn: &Connection, user_id: &str) -> Result<(), String> {
    let stored_date = get_meta(conn, user_id, "daily_date", "");
    let today = today();
    let count: i32 = if stored_date == today {
        get_meta(conn, user_id, "daily_count", "0")
            .parse()
            .unwrap_or(0)
            + 1
    } else {
        1
    };
    set_meta(conn, user_id, "daily_date", &today)?;
    set_meta(conn, user_id, "daily_count", &count.to_string())?;
    Ok(())
}

fn insert_history(
    conn: &Connection,
    user_id: &str,
    kind: &str,
    label: &str,
) -> Result<(), String> {
    let id = uuid::Uuid::new_v4().to_string();
    let at = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO history(id, user_id, kind, label, at) VALUES(?1, ?2, ?3, ?4, ?5)",
        params![id, user_id, kind, label, at],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_programs(state: State<'_, DbState>) -> Result<Vec<SavedProgram>, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, language, file_name, code, updated_at FROM programs
             WHERE user_id = ?1 ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![user_id], |row| {
            Ok(SavedProgram {
                id: row.get(0)?,
                name: row.get(1)?,
                language: row.get(2)?,
                file_name: row.get(3)?,
                code: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn save_program(
    state: State<'_, DbState>,
    id: Option<String>,
    name: String,
    language: String,
    file_name: String,
    code: String,
) -> Result<SavedProgram, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    let id = id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let updated_at = Utc::now().to_rfc3339();

    let lang_dir = paths::projects_dir()?.join(&user_id).join(&language);
    std::fs::create_dir_all(&lang_dir).map_err(|e| e.to_string())?;
    std::fs::write(lang_dir.join(&file_name), &code).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO programs(id, user_id, name, language, file_name, code, updated_at)
         VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name,
           language=excluded.language,
           file_name=excluded.file_name,
           code=excluded.code,
           updated_at=excluded.updated_at",
        params![id, user_id, name, language, file_name, code, updated_at],
    )
    .map_err(|e| e.to_string())?;

    Ok(SavedProgram {
        id,
        name,
        language,
        file_name,
        code,
        updated_at,
    })
}

#[tauri::command]
pub fn delete_program(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let user_id = require_user_id(&conn)?;
    conn.execute(
        "DELETE FROM programs WHERE id = ?1 AND user_id = ?2",
        params![id, user_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn write_user_file(path: String, code: String) -> Result<String, String> {
    let path = std::path::PathBuf::from(&path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, code.as_bytes()).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}
