use serde::Serialize;
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
