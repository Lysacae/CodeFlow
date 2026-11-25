use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::paths;
use crate::storage::DbState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPublic {
    pub id: String,
    pub username: String,
    pub avatar_data: Option<String>,
}

pub fn ensure_auth_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            avatar_data TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn active_user_id(conn: &Connection) -> Option<String> {
    conn.query_row(
        "SELECT value FROM app_meta WHERE key = 'active_user_id'",
        [],
        |row| row.get(0),
    )
    .ok()
}

pub fn require_user_id(conn: &Connection) -> Result<String, String> {
    active_user_id(conn).ok_or_else(|| "Aucun utilisateur connecté.".to_string())
}

pub fn require_devtesting(conn: &Connection) -> Result<UserPublic, String> {
    let id = require_user_id(conn)?;
    let user = user_public(conn, &id)?;
    if !user.username.eq_ignore_ascii_case("DevTesting") {
        return Err("Accès refusé.".into());
    }
    Ok(user)
}

fn set_active_user(conn: &Connection, user_id: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO app_meta(key, value) VALUES('active_user_id', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![user_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn clear_active_user(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM app_meta WHERE key = 'active_user_id'", [])
        .map_err(|e| e.to_string())?;
    let _ = conn.execute("DELETE FROM app_meta WHERE key = 'api_token'", []);
    let _ = conn.execute("DELETE FROM app_meta WHERE key = 'refresh_token'", []);
    Ok(())
}

fn set_meta_key(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO app_meta(key, value) VALUES(?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn user_public(conn: &Connection, id: &str) -> Result<UserPublic, String> {
    conn.query_row(
        "SELECT id, username, avatar_data FROM users WHERE id = ?1",
        params![id],
        |row| {
            Ok(UserPublic {
                id: row.get(0)?,
                username: row.get(1)?,
                avatar_data: row.get(2)?,
            })
        },
    )
    .map_err(|_| "Utilisateur introuvable.".to_string())
}

#[tauri::command]
pub fn get_api_token(state: State<'_, DbState>) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let token = conn
        .query_row(
            "SELECT value FROM app_meta WHERE key = 'api_token'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .filter(|value| !value.trim().is_empty());
    Ok(token)
}

#[tauri::command]
pub fn get_refresh_token(state: State<'_, DbState>) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let token = conn
        .query_row(
            "SELECT value FROM app_meta WHERE key = 'refresh_token'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .filter(|value| !value.trim().is_empty());
    Ok(token)
}

#[tauri::command]
pub fn clear_cloud_tokens(state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    conn.execute("DELETE FROM app_meta WHERE key = 'api_token'", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM app_meta WHERE key = 'refresh_token'", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_session(state: State<'_, DbState>) -> Result<Option<UserPublic>, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    match active_user_id(&conn) {
        Some(id) => Ok(Some(user_public(&conn, &id)?)),
        None => Ok(None),
    }
}

/// Enregistre la session cloud (compte serveur) en cache local pour la progression.
#[tauri::command]
pub fn set_cloud_session(
    state: State<'_, DbState>,
    id: String,
    username: String,
    avatar_data: Option<String>,
    token: String,
    refresh_token: Option<String>,
) -> Result<UserPublic, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let created_at = chrono::Utc::now().to_rfc3339();
    let avatar = avatar_data.filter(|s| !s.is_empty());

    // Évite les collisions de pseudo locales héritées d'anciens comptes.
    let _ = conn.execute(
        "DELETE FROM users WHERE username = ?1 COLLATE NOCASE AND id != ?2",
        params![username, id],
    );

    conn.execute(
        "INSERT INTO users(id, username, password_hash, salt, avatar_data, created_at)
         VALUES(?1, ?2, 'cloud', 'cloud', ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
           username = excluded.username,
           avatar_data = excluded.avatar_data",
        params![id, username, avatar, created_at],
    )
    .map_err(|e| e.to_string())?;

    crate::storage::init_user_meta(&conn, &id)?;
    set_active_user(&conn, &id)?;
    set_meta_key(&conn, "api_token", &token)?;
    if let Some(refresh) = refresh_token.filter(|value| !value.trim().is_empty()) {
        set_meta_key(&conn, "refresh_token", refresh.trim())?;
    }
    let _ = paths::projects_dir().and_then(|p| {
        std::fs::create_dir_all(p.join(&id)).map_err(|e| e.to_string())
    });

    user_public(&conn, &id)
}

#[tauri::command]
pub fn logout_user(state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    clear_active_user(&conn)
}

fn purge_user_rows(conn: &Connection, user_id: &str) -> Result<(), String> {
    for sql in [
        "DELETE FROM completed_lessons WHERE user_id = ?1",
        "DELETE FROM completed_exercises WHERE user_id = ?1",
        "DELETE FROM history WHERE user_id = ?1",
        "DELETE FROM programs WHERE user_id = ?1",
        "DELETE FROM user_meta WHERE user_id = ?1",
        "DELETE FROM users WHERE id = ?1",
    ] {
        conn.execute(sql, params![user_id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn purge_local_user_if_present(conn: &Connection, user_id: &str) -> Result<(), String> {
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE id = ?1",
            params![user_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if exists == 0 {
        return Ok(());
    }
    purge_user_rows(conn, user_id)?;
    remove_user_projects(user_id);
    Ok(())
}

fn remove_user_projects(user_id: &str) {
    let Ok(root) = paths::projects_dir() else {
        return;
    };
    let dir = root.join(user_id);
    if dir.is_dir() {
        let _ = std::fs::remove_dir_all(dir);
    }
}

/// Supprime le compte cloud, la session, la progression locale et le fichier de récupération.
#[tauri::command]
pub fn delete_account(
    state: State<'_, DbState>,
    token: String,
    password: String,
) -> Result<(), String> {
    let (local_id, local_username) = {
        let conn = state
            .0
            .lock()
            .map_err(|_| "Base verrouillée".to_string())?;
        let id = require_user_id(&conn)?;
        let user = user_public(&conn, &id)?;
        (user.id, user.username)
    };

    let deleted = crate::cloud::delete_cloud_user(&token, &password, &local_id)?;

    let cleanup_failed = match state.0.lock() {
        Ok(conn) => {
            let purged = purge_user_rows(&conn, &deleted.id);
            let cleared = clear_active_user(&conn);
            purged.is_err() || cleared.is_err()
        }
        Err(_) => true,
    };

    let _ = crate::recovery::clear_recovery_for_username(&deleted.username);
    if !local_username.eq_ignore_ascii_case(&deleted.username) {
        let _ = crate::recovery::clear_recovery_for_username(&local_username);
    }
    remove_user_projects(&deleted.id);
    if local_id != deleted.id {
        remove_user_projects(&local_id);
    }

    if cleanup_failed {
        return Err(
            "Compte supprimé, mais le nettoyage local a échoué. Redémarrez CodeFlow.".into(),
        );
    }
    Ok(())
}

const ONBOARDING_KEY: &str = "environments_onboarding_done";

/// Première installation seulement. Une base déjà utilisée (mise à jour, comptes
/// existants) est marquée tout de suite pour ne jamais rouvrir l'écran.
pub fn seed_environments_onboarding(conn: &Connection) -> Result<(), String> {
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM app_meta WHERE key = ?1",
            params![ONBOARDING_KEY],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if exists {
        return Ok(());
    }
    let users: i64 = conn
        .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
        .unwrap_or(0);
    if users > 0 {
        set_meta_key(conn, ONBOARDING_KEY, "true")?;
    }
    Ok(())
}

#[tauri::command]
pub fn environments_onboarding_done(state: State<'_, DbState>) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM app_meta WHERE key = ?1",
            params![ONBOARDING_KEY],
            |row| row.get(0),
        )
        .ok();
    Ok(value.as_deref() == Some("true"))
}

#[tauri::command]
pub fn mark_environments_onboarding_done(state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    set_meta_key(&conn, ONBOARDING_KEY, "true")
}

#[tauri::command]
pub fn list_users(state: State<'_, DbState>) -> Result<Vec<UserPublic>, String> {
    let conn = state.0.lock().map_err(|_| "Base verrouillée".to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, username, avatar_data FROM users ORDER BY username COLLATE NOCASE")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(UserPublic {
                id: row.get(0)?,
                username: row.get(1)?,
                avatar_data: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}
