use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const SUPABASE_URL: &str = "https://xzxvuwvjaxrlgxywogiu.supabase.co";
/// Clé Supabase injectée à la compilation via `CODEFLOW_SUPABASE_SECRET`
/// (environnement de build, ou `SUPABASE_SECRET_KEY` dans `apps/server/.env`).
/// Elle ne figure pas dans le dépôt. Un build release sans clé ne compile pas.
const SUPABASE_SECRET: &str = env!("CODEFLOW_SUPABASE_SECRET");

#[cfg(not(debug_assertions))]
const _: () = {
    if SUPABASE_SECRET.is_empty() {
        panic!("CODEFLOW_SUPABASE_SECRET must be set for release builds");
    }
};
const GITHUB_REPO: &str = "Lysacae/CodeFlow";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudUser {
    pub id: String,
    pub username: String,
    pub avatar_data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    pub user: CloudUser,
    pub token: String,
    #[serde(default)]
    pub refresh_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestUpdate {
    pub version: Option<String>,
    pub notes: String,
    pub download_url: Option<String>,
    pub filename: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub id: String,
    pub username: String,
    pub avatar_data: Option<String>,
    pub lessons: u32,
    pub exercises: u32,
    #[serde(default)]
    pub qa_mastered: u32,
    #[serde(default)]
    pub qa_time_ms: u64,
    #[serde(default)]
    pub qa_complete: bool,
    #[serde(default)]
    pub xp: u32,
    #[serde(default)]
    pub level: u32,
    #[serde(default)]
    pub rank_id: String,
}

const SESSION_EXPIRED: &str =
    "Votre session a expiré. Reconnectez-vous pour synchroniser vos projets.";

fn is_expired_token(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("expired")
        || lower.contains("invalid jwt")
        || lower.contains("invalid claims")
        || lower.contains("session expir")
}

fn friendly_auth_error(err: String) -> String {
    if is_expired_token(&err) {
        SESSION_EXPIRED.to_string()
    } else {
        err
    }
}

fn email_from_username(username: &str) -> String {
    let safe: String = username
        .trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    format!("{safe}@accounts.codeflow.app")
}

pub(crate) fn supabase_request(
    method: &str,
    path: &str,
    body: Option<Value>,
    token: Option<&str>,
) -> Result<(u16, Value), String> {
    if SUPABASE_SECRET.is_empty() {
        return Err(
            "Clé API absente de cette version. Recompilez avec CODEFLOW_SUPABASE_SECRET.".into(),
        );
    }

    let url = format!("{SUPABASE_URL}{path}");
    let auth = token.unwrap_or(SUPABASE_SECRET);

    let mut req = match method {
        "GET" => ureq::get(&url),
        "POST" => ureq::post(&url),
        "PUT" => ureq::put(&url),
        "DELETE" => ureq::delete(&url),
        other => return Err(format!("Méthode HTTP non supportée : {other}")),
    };

    req = req
        .set("apikey", SUPABASE_SECRET)
        .set("Authorization", &format!("Bearer {auth}"))
        .set("User-Agent", "codeflow-desktop/1.1")
        .set("Content-Type", "application/json");

    let response = if let Some(body) = body {
        req.send_json(body)
    } else {
        req.call()
    };

    match response {
        Ok(res) => {
            let status = res.status();
            let text = res.into_string().unwrap_or_default();
            let data = if text.trim().is_empty() {
                Value::Null
            } else {
                serde_json::from_str(&text).unwrap_or(json!({ "raw": text }))
            };
            Ok((status, data))
        }
        Err(ureq::Error::Status(code, res)) => {
            let text = res.into_string().unwrap_or_default();
            let data: Value = serde_json::from_str(&text).unwrap_or(json!({ "message": text }));
            let msg = data
                .get("msg")
                .or_else(|| data.get("error_description"))
                .or_else(|| data.get("error"))
                .or_else(|| data.get("message"))
                .and_then(|v| v.as_str())
                .unwrap_or("Erreur cloud");
            Err(format!("{msg} ({code})"))
        }
        Err(e) => Err(format!(
            "Cloud CodeFlow injoignable. Vérifiez votre connexion Internet. ({e})"
        )),
    }
}

pub(crate) fn public_user(data: &Value) -> Result<CloudUser, String> {
    let id = data
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Réponse utilisateur invalide.".to_string())?
        .to_string();
    let meta = data.get("user_metadata").cloned().unwrap_or(json!({}));
    let username = meta
        .get("username")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            data.get("email")
                .and_then(|v| v.as_str())
                .map(|e| e.split('@').next().unwrap_or("user").to_string())
        })
        .unwrap_or_else(|| "user".into());
    let avatar_data = meta
        .get("avatarData")
        .or_else(|| meta.get("avatar_data"))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    Ok(CloudUser {
        id,
        username,
        avatar_data,
    })
}

#[tauri::command]
pub fn cloud_register(
    username: String,
    password: String,
    avatar_data: Option<String>,
) -> Result<AuthResponse, String> {
    let name = username.trim().to_string();
    if name.len() < 3 || name.len() > 24 {
        return Err("Le pseudo doit contenir entre 3 et 24 caractères.".into());
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("Pseudo : lettres, chiffres, _ ou - uniquement.".into());
    }
    if password.len() < 4 {
        return Err("Le mot de passe doit contenir au moins 4 caractères.".into());
    }

    let email = email_from_username(&name);
    let create_body = json!({
        "email": email,
        "password": password,
        "email_confirm": true,
        "user_metadata": {
            "username": name,
            "avatarData": avatar_data.filter(|s| !s.is_empty()),
        },
        "app_metadata": { "progress": null }
    });

    match supabase_request("POST", "/auth/v1/admin/users", Some(create_body), None) {
        Ok((status, _)) if (200..300).contains(&status) => cloud_login(name, password),
        Ok((_, data)) => {
            let msg = data
                .get("msg")
                .or_else(|| data.get("message"))
                .and_then(|v| v.as_str())
                .unwrap_or("Création du compte impossible.");
            if msg.to_lowercase().contains("already")
                || msg.to_lowercase().contains("exists")
                || msg.to_lowercase().contains("registered")
            {
                Err("Ce pseudo est déjà utilisé.".into())
            } else {
                Err(msg.into())
            }
        }
        Err(e) if e.contains("(422)") || e.to_lowercase().contains("already") => {
            Err("Ce pseudo est déjà utilisé.".into())
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub fn cloud_login(username: String, password: String) -> Result<AuthResponse, String> {
    let email = email_from_username(&username);
    let (status, data) = supabase_request(
        "POST",
        "/auth/v1/token?grant_type=password",
        Some(json!({ "email": email, "password": password })),
        None,
    )?;
    if !(200..300).contains(&status) {
        return Err("Pseudo ou mot de passe incorrect.".into());
    }
    let token = data
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Jeton manquant.".to_string())?
        .to_string();
    let refresh_token = data
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let user = if let Some(u) = data.get("user") {
        public_user(u)?
    } else {
        let (_, me) = supabase_request("GET", "/auth/v1/user", None, Some(&token))?;
        public_user(&me)?
    };
    Ok(AuthResponse {
        user,
        token,
        refresh_token,
    })
}

#[tauri::command]
pub fn cloud_refresh_session(refresh_token: String) -> Result<AuthResponse, String> {
    let refresh_token = refresh_token.trim().to_string();
    if refresh_token.is_empty() {
        return Err(SESSION_EXPIRED.into());
    }
    let data = match supabase_request(
        "POST",
        "/auth/v1/token?grant_type=refresh_token",
        Some(json!({ "refresh_token": refresh_token })),
        None,
    ) {
        Ok((status, data)) if (200..300).contains(&status) => data,
        Ok(_) => return Err(SESSION_EXPIRED.into()),
        Err(e) => return Err(friendly_auth_error(e)),
    };
    let token = data
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| SESSION_EXPIRED.to_string())?
        .to_string();
    let new_refresh = data
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or(refresh_token.as_str())
        .to_string();
    let user = if let Some(u) = data.get("user") {
        public_user(u)?
    } else {
        let (_, me) = supabase_request("GET", "/auth/v1/user", None, Some(&token))
            .map_err(friendly_auth_error)?;
        public_user(&me)?
    };
    Ok(AuthResponse {
        user,
        token,
        refresh_token: new_refresh,
    })
}

#[tauri::command]
pub fn cloud_me(token: String) -> Result<CloudUser, String> {
    match supabase_request("GET", "/auth/v1/user", None, Some(&token)) {
        Ok((status, data)) if (200..300).contains(&status) => public_user(&data),
        Ok(_) => Err(SESSION_EXPIRED.into()),
        Err(e) => Err(friendly_auth_error(e)),
    }
}

fn empty_progress() -> Value {
    json!({
        "completedLessons": [],
        "completedExercises": [],
        "lastLessonId": null,
        "lastLanguage": null,
        "dailyGoal": 3,
        "dailyCount": 0,
        "dailyDate": chrono::Utc::now().format("%Y-%m-%d").to_string(),
        "history": [],
        "setupDone": false,
        "theme": "dark",
        "updatedAt": "1970-01-01T00:00:00.000Z"
    })
}

fn read_progress(user: &Value) -> Value {
    user.pointer("/app_metadata/progress")
        .cloned()
        .filter(|v| v.is_object())
        .unwrap_or_else(empty_progress)
}

#[tauri::command]
pub fn cloud_get_progress(token: String) -> Result<Value, String> {
    let me = cloud_me(token)?;
    let (_, full) = supabase_request(
        "GET",
        &format!("/auth/v1/admin/users/{}", me.id),
        None,
        None,
    )?;
    Ok(read_progress(&full))
}

#[tauri::command]
pub fn cloud_put_progress(token: String, progress: Value) -> Result<Value, String> {
    let me = cloud_me(token)?;
    let (_, full) = supabase_request(
        "GET",
        &format!("/auth/v1/admin/users/{}", me.id),
        None,
        None,
    )?;
    let current = read_progress(&full);
    let incoming_at = progress
        .get("updatedAt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let current_at = current
        .get("updatedAt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if !current_at.is_empty() && !incoming_at.is_empty() && current_at > incoming_at {
        let mut rejected = current;
        if let Some(obj) = rejected.as_object_mut() {
            obj.insert("rejected".into(), json!(true));
        }
        return Ok(rejected);
    }

    let mut app_metadata = full
        .get("app_metadata")
        .cloned()
        .unwrap_or_else(|| json!({}));
    if let Some(obj) = app_metadata.as_object_mut() {
        obj.insert("progress".into(), progress.clone());
    }

    let (_, _) = supabase_request(
        "PUT",
        &format!("/auth/v1/admin/users/{}", me.id),
        Some(json!({ "app_metadata": app_metadata })),
        None,
    )?;
    Ok(progress)
}

#[tauri::command]
pub fn cloud_update_profile(
    token: String,
    username: String,
    avatar_data: Option<String>,
) -> Result<CloudUser, String> {
    let name = username.trim().to_string();
    if name.len() < 3 || name.len() > 24 {
        return Err("Le pseudo doit contenir entre 3 et 24 caractères.".into());
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("Pseudo : lettres, chiffres, _ ou - uniquement.".into());
    }

    let me = cloud_me(token)?;
    let email = email_from_username(&name);
    let avatar = avatar_data
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_default();

    let body = json!({
        "email": email,
        "email_confirm": true,
        "user_metadata": {
            "username": name,
            "avatarData": avatar,
        }
    });

    match supabase_request(
        "PUT",
        &format!("/auth/v1/admin/users/{}", me.id),
        Some(body),
        None,
    ) {
        Ok((status, data)) if (200..300).contains(&status) => public_user(&data),
        Ok((_, data)) => {
            let msg = data
                .get("msg")
                .or_else(|| data.get("message"))
                .and_then(|v| v.as_str())
                .unwrap_or("Impossible de mettre à jour le profil.");
            if msg.to_lowercase().contains("already") || msg.to_lowercase().contains("exists") {
                Err("Ce pseudo est déjà utilisé.".into())
            } else {
                Err(msg.into())
            }
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub fn cloud_update_password(
    token: String,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    if current_password.is_empty() {
        return Err("Indiquez votre mot de passe actuel.".into());
    }
    if new_password.len() < 4 {
        return Err("Le nouveau mot de passe doit contenir au moins 4 caractères.".into());
    }
    if current_password == new_password {
        return Err("Le nouveau mot de passe doit être différent de l'ancien.".into());
    }
    let me = cloud_me(token)?;
    if cloud_login(me.username.clone(), current_password).is_err() {
        return Err("Le mot de passe actuel est incorrect.".into());
    }
    match supabase_request(
        "PUT",
        &format!("/auth/v1/admin/users/{}", me.id),
        Some(json!({ "password": new_password })),
        None,
    ) {
        Ok((status, _)) if (200..300).contains(&status) => Ok(()),
        Ok((_, data)) => Err(data
            .get("msg")
            .or_else(|| data.get("message"))
            .and_then(|v| v.as_str())
            .unwrap_or("Impossible de changer le mot de passe.")
            .into()),
        Err(e) => Err(e),
    }
}

fn friendly_delete_error(err: String) -> String {
    if is_expired_token(&err) {
        return "Votre session a expiré. Reconnectez-vous pour supprimer le compte.".into();
    }
    "Impossible de supprimer le compte. Vérifiez votre connexion et réessayez.".into()
}

/// Vérifie le mot de passe puis supprime définitivement l'utilisateur Auth.
pub fn delete_cloud_user(
    token: &str,
    password: &str,
    expected_id: &str,
) -> Result<CloudUser, String> {
    if password.is_empty() {
        return Err("Indiquez votre mot de passe pour confirmer la suppression.".into());
    }
    let me = match cloud_me(token.to_string()) {
        Ok(user) => user,
        Err(e) => return Err(friendly_delete_error(e)),
    };
    if me.id != expected_id {
        return Err(
            "La session ne correspond pas au compte connecté. Reconnectez-vous.".into(),
        );
    }
    match cloud_login(me.username.clone(), password.to_string()) {
        Ok(_) => {}
        Err(e) if e.contains("incorrect") => return Err("Mot de passe incorrect.".into()),
        Err(_) => {
            return Err(
                "Impossible de vérifier le mot de passe. Vérifiez votre connexion et réessayez."
                    .into(),
            );
        }
    }

    let path = format!("/auth/v1/admin/users/{}?should_soft_delete=false", me.id);
    match supabase_request("DELETE", &path, None, None) {
        Ok((status, _)) if (200..300).contains(&status) => Ok(me),
        Ok((_, data)) => {
            let msg = data
                .get("msg")
                .or_else(|| data.get("message"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if msg.to_lowercase().contains("not found") {
                Ok(me)
            } else {
                Err(friendly_delete_error(msg.into()))
            }
        }
        Err(e) if e.contains("(404)") || e.to_lowercase().contains("not found") => Ok(me),
        Err(e) => Err(friendly_delete_error(e)),
    }
}

pub fn list_cloud_accounts() -> Result<Vec<CloudUser>, String> {
    let mut accounts = Vec::new();
    let per_page = 200u32;
    let mut page = 1u32;
    loop {
        let path = format!("/auth/v1/admin/users?page={page}&per_page={per_page}");
        let (status, data) = supabase_request("GET", &path, None, None)?;
        if !(200..300).contains(&status) {
            return Err("Impossible de charger les comptes.".into());
        }
        let users = data
            .get("users")
            .and_then(|value| value.as_array())
            .cloned()
            .or_else(|| data.as_array().cloned())
            .unwrap_or_default();
        if users.is_empty() {
            break;
        }
        let batch_len = users.len();
        for user in users {
            if let Ok(public) = public_user(&user) {
                accounts.push(public);
            }
        }
        if (batch_len as u32) < per_page {
            break;
        }
        page += 1;
        if page > 50 {
            break;
        }
    }
    accounts.sort_by(|a, b| a.username.to_lowercase().cmp(&b.username.to_lowercase()));
    Ok(accounts)
}

pub(crate) fn fetch_raw_user(user_id: &str) -> Result<Value, String> {
    let (status, data) = supabase_request(
        "GET",
        &format!("/auth/v1/admin/users/{user_id}"),
        None,
        None,
    )?;
    if !(200..300).contains(&status) {
        return Err("Compte introuvable.".into());
    }
    Ok(data)
}

pub(crate) fn list_raw_users() -> Result<Vec<Value>, String> {
    let mut all = Vec::new();
    let per_page = 200u32;
    let mut page = 1u32;
    loop {
        let path = format!("/auth/v1/admin/users?page={page}&per_page={per_page}");
        let (status, data) = supabase_request("GET", &path, None, None)?;
        if !(200..300).contains(&status) {
            return Err("Impossible de charger les comptes.".into());
        }
        let users = data
            .get("users")
            .and_then(|value| value.as_array())
            .cloned()
            .or_else(|| data.as_array().cloned())
            .unwrap_or_default();
        if users.is_empty() {
            break;
        }
        let batch_len = users.len();
        all.extend(users);
        if (batch_len as u32) < per_page {
            break;
        }
        page += 1;
        if page > 50 {
            break;
        }
    }
    Ok(all)
}

/// Remplace `app_metadata` en conservant les clés non touchées (progress, projects, social…).
pub(crate) fn patch_app_metadata(
    user_id: &str,
    mutate: impl FnOnce(&mut serde_json::Map<String, Value>) -> Result<(), String>,
) -> Result<(), String> {
    let full = fetch_raw_user(user_id)?;
    let mut app_metadata = full
        .get("app_metadata")
        .cloned()
        .unwrap_or_else(|| json!({}));
    {
        let obj = app_metadata
            .as_object_mut()
            .ok_or_else(|| "Métadonnées illisibles.".to_string())?;
        mutate(obj)?;
    }
    let (status, data) = supabase_request(
        "PUT",
        &format!("/auth/v1/admin/users/{user_id}"),
        Some(json!({ "app_metadata": app_metadata })),
        None,
    )?;
    if !(200..300).contains(&status) {
        let msg = data
            .get("msg")
            .or_else(|| data.get("message"))
            .and_then(|v| v.as_str())
            .unwrap_or("Enregistrement cloud impossible.");
        return Err(msg.into());
    }
    Ok(())
}

pub fn fetch_cloud_user(user_id: &str) -> Result<CloudUser, String> {
    let (status, data) = supabase_request(
        "GET",
        &format!("/auth/v1/admin/users/{user_id}"),
        None,
        None,
    )?;
    if !(200..300).contains(&status) {
        return Err("Compte introuvable.".into());
    }
    public_user(&data)
}

pub fn admin_delete_cloud_user(user_id: &str) -> Result<(), String> {
    let path = format!("/auth/v1/admin/users/{user_id}?should_soft_delete=false");
    match supabase_request("DELETE", &path, None, None) {
        Ok((status, _)) if (200..300).contains(&status) => Ok(()),
        Ok((_, data)) => {
            let msg = data
                .get("msg")
                .or_else(|| data.get("message"))
                .and_then(|value| value.as_str())
                .unwrap_or("");
            if msg.to_lowercase().contains("not found") {
                Ok(())
            } else {
                Err(if msg.is_empty() {
                    "Impossible de supprimer ce compte.".into()
                } else {
                    msg.into()
                })
            }
        }
        Err(error) if error.contains("(404)") || error.to_lowercase().contains("not found") => Ok(()),
        Err(error) => Err(error),
    }
}

fn progression_brief(user: &Value) -> (u32, u32, String) {
    let prog = user.pointer("/app_metadata/progression");
    let xp = prog
        .and_then(|value| value.get("xp"))
        .and_then(|value| value.as_u64())
        .unwrap_or(0) as u32;
    let level = prog
        .and_then(|value| value.get("level"))
        .and_then(|value| value.as_u64())
        .unwrap_or(1) as u32;
    let rank_id = prog
        .and_then(|value| value.get("rankId"))
        .and_then(|value| value.as_str())
        .unwrap_or("bronze")
        .to_string();
    (xp, level.max(1), rank_id)
}

fn progress_counts(progress: &Value) -> (u32, u32) {
    let lessons = count_progress_list(progress, "completedLessons", "completed_lessons");
    let exercises = count_progress_list(progress, "completedExercises", "completed_exercises");
    (lessons, exercises)
}

fn qa_stats(progress: &Value) -> (u32, u64, bool) {
    let Some(entries) = progress.get("qa").and_then(|v| v.as_object()) else {
        return (0, 0, false);
    };
    let mut mastered = 0u32;
    let mut spent = 0u64;
    let mut completion = 0u64;
    let mut complete_langs = 0u32;
    for value in entries.values() {
        let correct = value
            .get("correctIds")
            .or_else(|| value.get("correct_ids"))
            .and_then(|v| v.as_array())
            .map(|items| items.len() as u32)
            .unwrap_or(0);
        let pool = value
            .get("poolSize")
            .or_else(|| value.get("pool_size"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32;
        let time_spent = value
            .get("timeSpentMs")
            .or_else(|| value.get("time_spent_ms"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let done = value
            .get("completionMs")
            .or_else(|| value.get("completion_ms"))
            .and_then(|v| v.as_u64());
        mastered += correct;
        spent += time_spent;
        if pool > 0 && correct >= pool {
            complete_langs += 1;
            completion += done.unwrap_or(time_spent);
        }
    }
    let all_done = complete_langs >= 4;
    (
        mastered,
        if all_done { completion } else { spent },
        all_done,
    )
}

fn count_progress_list(progress: &Value, camel: &str, snake: &str) -> u32 {
    progress
        .get(camel)
        .or_else(|| progress.get(snake))
        .and_then(|v| v.as_array())
        .map(|items| items.len() as u32)
        .unwrap_or(0)
}

#[tauri::command]
pub fn cloud_leaderboard(token: String) -> Result<Vec<LeaderboardEntry>, String> {
    if token.trim().is_empty() {
        return Err("Non authentifié.".into());
    }
    // Le jeton confirme une session, mais un access token expiré ne doit pas
    // masquer le classement : la liste est lue avec la clé d'administration.
    let _ = cloud_me(token);

    let mut entries: Vec<LeaderboardEntry> = Vec::new();
    let per_page = 200u32;
    let mut page = 1u32;

    loop {
        let path = format!("/auth/v1/admin/users?page={page}&per_page={per_page}");
        let (status, data) = supabase_request("GET", &path, None, None)?;
        if !(200..300).contains(&status) {
            return Err("Impossible de charger le classement.".into());
        }

        let users = data
            .get("users")
            .and_then(|v| v.as_array())
            .cloned()
            .or_else(|| data.as_array().cloned())
            .unwrap_or_default();

        if users.is_empty() {
            break;
        }

        let batch_len = users.len();
        for user in users {
            let Ok(public) = public_user(&user) else {
                continue;
            };
            let progress = read_progress(&user);
            let (lessons, exercises) = progress_counts(&progress);
            let (qa_mastered, qa_time_ms, qa_complete) = qa_stats(&progress);
            let (xp, level, rank_id) = progression_brief(&user);
            entries.push(LeaderboardEntry {
                id: public.id,
                username: public.username,
                avatar_data: public.avatar_data,
                lessons,
                exercises,
                qa_mastered,
                qa_time_ms,
                qa_complete,
                xp,
                level,
                rank_id,
            });
        }

        if (batch_len as u32) < per_page {
            break;
        }
        page += 1;
        if page > 50 {
            break;
        }
    }

    entries.sort_by(|a, b| {
        let score_b = b.lessons.saturating_add(b.exercises);
        let score_a = a.lessons.saturating_add(a.exercises);
        score_b
            .cmp(&score_a)
            .then_with(|| b.lessons.cmp(&a.lessons))
            .then_with(|| a.username.to_lowercase().cmp(&b.username.to_lowercase()))
    });

    Ok(entries)
}

const MAX_PROJECT_CHARS: usize = 80_000;
const MAX_PROJECTS: usize = 40;
const MAX_PROJECTS_TOTAL: usize = 500_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudProject {
    pub id: String,
    pub name: String,
    pub language: String,
    pub file_name: String,
    pub code: String,
    pub updated_at: String,
}

fn read_projects(user: &Value) -> Vec<CloudProject> {
    let Some(items) = user
        .pointer("/app_metadata/projects")
        .and_then(|v| v.as_array())
    else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| serde_json::from_value(item.clone()).ok())
        .collect()
}

fn validate_project(project: &CloudProject) -> Result<(), String> {
    if project.id.trim().is_empty() {
        return Err("Projet sans identifiant.".into());
    }
    if project.file_name.trim().is_empty() || project.name.trim().is_empty() {
        return Err("Nom de fichier manquant.".into());
    }
    if project.code.len() > MAX_PROJECT_CHARS {
        return Err(format!(
            "« {} » est trop volumineux pour la synchronisation cloud.",
            project.file_name
        ));
    }
    Ok(())
}

fn merge_projects(remote: Vec<CloudProject>, incoming: Vec<CloudProject>) -> Result<Vec<CloudProject>, String> {
    let mut merged: Vec<CloudProject> = Vec::new();
    for project in remote {
        if validate_project(&project).is_err() {
            continue;
        }
        if let Some(existing) = merged.iter_mut().find(|item| item.id == project.id) {
            if project.updated_at > existing.updated_at {
                *existing = project;
            }
        } else {
            merged.push(project);
        }
    }
    for project in incoming {
        validate_project(&project)?;
        if let Some(existing) = merged.iter_mut().find(|item| item.id == project.id) {
            if project.updated_at >= existing.updated_at {
                *existing = project;
            }
        } else {
            merged.push(project);
        }
    }
    merged.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    if merged.len() > MAX_PROJECTS {
        merged.truncate(MAX_PROJECTS);
    }
    let total: usize = merged.iter().map(|project| project.code.len()).sum();
    if total > MAX_PROJECTS_TOTAL {
        return Err(
            "L'ensemble des projets est trop volumineux pour la synchronisation cloud.".into(),
        );
    }
    Ok(merged)
}

fn write_projects(user_id: &str, full: &Value, projects: &[CloudProject]) -> Result<(), String> {
    let mut app_metadata = full
        .get("app_metadata")
        .cloned()
        .unwrap_or_else(|| json!({}));
    if let Some(obj) = app_metadata.as_object_mut() {
        obj.insert(
            "projects".into(),
            serde_json::to_value(projects).map_err(|e| e.to_string())?,
        );
    }
    let (status, data) = supabase_request(
        "PUT",
        &format!("/auth/v1/admin/users/{user_id}"),
        Some(json!({ "app_metadata": app_metadata })),
        None,
    )?;
    if !(200..300).contains(&status) {
        let msg = data
            .get("msg")
            .or_else(|| data.get("message"))
            .and_then(|v| v.as_str())
            .unwrap_or("Impossible d'enregistrer les projets cloud.");
        return Err(msg.into());
    }
    Ok(())
}

/// Fusionne les projets locaux avec ceux du profil cloud (le plus récent gagne).
#[tauri::command]
pub fn cloud_sync_projects(
    token: String,
    projects: Vec<CloudProject>,
) -> Result<Vec<CloudProject>, String> {
    if token.trim().is_empty() {
        return Err("Non authentifié.".into());
    }
    let me = cloud_me(token)?;
    let (status, full) = supabase_request(
        "GET",
        &format!("/auth/v1/admin/users/{}", me.id),
        None,
        None,
    )?;
    if !(200..300).contains(&status) {
        return Err("Impossible de lire les projets cloud.".into());
    }
    let remote = read_projects(&full);
    let merged = merge_projects(remote, projects)?;
    write_projects(&me.id, &full, &merged)?;
    Ok(merged)
}

struct ListedRelease {
    version: (u32, u32, u32),
    label: String,
    body: String,
    download_url: Option<String>,
    filename: Option<String>,
    created_at: Option<String>,
}

fn empty_update() -> LatestUpdate {
    LatestUpdate {
        version: None,
        notes: String::new(),
        download_url: None,
        filename: None,
        created_at: None,
    }
}

fn parse_semver(raw: &str) -> Option<(u32, u32, u32)> {
    let trimmed = raw.trim();
    let trimmed = trimmed
        .strip_prefix('v')
        .or_else(|| trimmed.strip_prefix('V'))
        .unwrap_or(trimmed);
    let mut parts = trimmed.split('.');
    let major: u32 = parts.next()?.parse().ok()?;
    let minor: u32 = parts.next()?.parse().ok()?;
    let patch: u32 = parts.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}

fn strip_leading_version_heading(body: &str, version: &str) -> String {
    let mut lines: Vec<&str> = body.lines().collect();
    while lines.first().is_some_and(|line| line.trim().is_empty()) {
        lines.remove(0);
    }
    if let Some(first) = lines.first().copied() {
        let plain = first
            .trim()
            .trim_start_matches('#')
            .trim()
            .trim_matches('*')
            .trim();
        let lower = plain.to_lowercase();
        let is_version_title = lower.starts_with("version") || lower.starts_with("codeflow");
        let mentions_version = lower.contains(version) || lower.contains(&format!("v{version}"));
        if is_version_title && mentions_version {
            lines.remove(0);
            while lines.first().is_some_and(|line| line.trim().is_empty()) {
                lines.remove(0);
            }
        }
    }
    lines.join("\n").trim().to_string()
}

/// Notes des versions strictement plus récentes, de la plus ancienne à la plus récente.
fn aggregate_newer_notes(current: (u32, u32, u32), releases: &[ListedRelease]) -> String {
    let mut newer: Vec<&ListedRelease> = releases
        .iter()
        .filter(|rel| rel.version > current)
        .collect();
    newer.sort_by(|a, b| a.version.cmp(&b.version));
    newer
        .into_iter()
        .filter_map(|rel| {
            let body = strip_leading_version_heading(&rel.body, &rel.label);
            if body.is_empty() {
                return None;
            }
            Some(format!("Version {}\n\n{body}", rel.label))
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn pick_setup_asset(release: &Value) -> (Option<String>, Option<String>) {
    let assets = release
        .get("assets")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let asset = assets
        .iter()
        .find(|a| {
            a.get("name").and_then(|n| n.as_str()).is_some_and(|n| {
                let lower = n.to_lowercase();
                lower.contains("setup") && lower.ends_with(".exe")
            })
        })
        .or_else(|| {
            assets.iter().find(|a| {
                a.get("name")
                    .and_then(|n| n.as_str())
                    .is_some_and(|n| n.to_lowercase().ends_with(".exe"))
            })
        })
        .or_else(|| assets.first());
    let download_url = asset
        .and_then(|a| a.get("browser_download_url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let filename = asset
        .and_then(|a| a.get("name"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    (download_url, filename)
}

fn parse_listed_release(data: &Value) -> Option<ListedRelease> {
    if data.get("draft").and_then(|v| v.as_bool()).unwrap_or(false) {
        return None;
    }
    if data
        .get("prerelease")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return None;
    }
    let tag = data.get("tag_name").and_then(|v| v.as_str())?;
    let version = parse_semver(tag)?;
    let label = format!("{}.{}.{}", version.0, version.1, version.2);
    let body = data
        .get("body")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let created_at = data
        .get("published_at")
        .or_else(|| data.get("created_at"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let (download_url, filename) = pick_setup_asset(data);
    Some(ListedRelease {
        version,
        label,
        body,
        download_url,
        filename,
        created_at,
    })
}

fn fetch_github_releases() -> Result<Vec<Value>, String> {
    let url = format!("https://api.github.com/repos/{GITHUB_REPO}/releases?per_page=100");
    let response = ureq::get(&url)
        .set("Accept", "application/vnd.github+json")
        .set("User-Agent", "codeflow-desktop/1.1")
        .call()
        .map_err(|e| format!("Impossible de vérifier les mises à jour ({e})"))?;

    if response.status() == 404 {
        return Ok(Vec::new());
    }
    if !(200..300).contains(&response.status()) {
        return Err(format!(
            "GitHub Releases indisponible ({})",
            response.status()
        ));
    }

    let data: Value = response
        .into_json()
        .map_err(|e| format!("Réponse GitHub invalide : {e}"))?;
    data.as_array()
        .cloned()
        .ok_or_else(|| "Réponse GitHub invalide.".into())
}

#[tauri::command]
pub fn cloud_latest_update(current_version: Option<String>) -> Result<LatestUpdate, String> {
    let current = current_version
        .as_deref()
        .and_then(parse_semver)
        .or_else(|| parse_semver(env!("CARGO_PKG_VERSION")))
        .unwrap_or((0, 0, 0));

    let raw = fetch_github_releases()?;
    let releases: Vec<ListedRelease> = raw.iter().filter_map(parse_listed_release).collect();
    let Some(latest) = releases.iter().max_by(|a, b| a.version.cmp(&b.version)) else {
        return Ok(empty_update());
    };
    if latest.download_url.is_none() {
        return Ok(empty_update());
    }

    Ok(LatestUpdate {
        version: Some(latest.label.clone()),
        notes: aggregate_newer_notes(current, &releases),
        download_url: latest.download_url.clone(),
        filename: latest.filename.clone(),
        created_at: latest.created_at.clone(),
    })
}

#[cfg(test)]
mod update_notes_tests {
    use super::*;

    fn rel(version: &str, body: &str) -> ListedRelease {
        let parsed = parse_semver(version).expect("semver");
        ListedRelease {
            version: parsed,
            label: version.to_string(),
            body: body.to_string(),
            download_url: None,
            filename: None,
            created_at: None,
        }
    }

    #[test]
    fn aggregates_skipped_versions_oldest_first() {
        let releases = vec![
            rel(
                "1.0.6",
                "## CodeFlow 1.0.6\n\n- Installation automatique des mises à jour\n- Sync des projets entre PC",
            ),
            rel(
                "1.0.5",
                "- Environnements : désinstallation et détection améliorée\n- Classement des utilisateurs",
            ),
            rel("1.0.4", "- Installation silencieuse des langages"),
        ];
        let notes = aggregate_newer_notes((1, 0, 4), &releases);
        assert_eq!(
            notes,
            "Version 1.0.5\n\n- Environnements : désinstallation et détection améliorée\n- Classement des utilisateurs\n\nVersion 1.0.6\n\n- Installation automatique des mises à jour\n- Sync des projets entre PC"
        );
    }

    #[test]
    fn skips_current_and_older_versions() {
        let releases = vec![
            rel("1.0.6", "- Sync des projets entre PC"),
            rel("1.0.5", "- Classement des utilisateurs"),
        ];
        let notes = aggregate_newer_notes((1, 0, 6), &releases);
        assert_eq!(notes, "");
    }
}
