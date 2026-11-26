//! Amis, messagerie et progression dans `app_metadata` Supabase.
//!
//! Limites (le blob est partagé avec `progress` et `projects`) :
//! - 30 messages conservés par conversation (les plus récents) ;
//! - 280 caractères par message ;
//! - 40 conversations par compte ;
//! - une réaction (emoji court) par utilisateur et par message.
//! Chaque fil est copié sur les deux comptes. Au-delà, les plus anciens sont tronqués.

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager};

use crate::cloud::{self, CloudUser};

const MAX_MESSAGES: usize = 30;
const MAX_TEXT_CHARS: usize = 280;
const MAX_THREADS: usize = 40;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SocialDoc {
    #[serde(default)]
    friends: Vec<String>,
    #[serde(default)]
    outgoing: Vec<SocialRequest>,
    #[serde(default)]
    incoming: Vec<SocialRequest>,
    #[serde(default)]
    threads: HashMap<String, Vec<SocialMessage>>,
    /// Comptes que cet utilisateur a bloqués.
    #[serde(default)]
    blocked: Vec<String>,
    /// Pair -> horodatage du dernier signal « en train d'écrire ».
    #[serde(default)]
    incoming_typing: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SocialRequest {
    id: String,
    user_id: String,
    username: String,
    at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SocialMessage {
    id: String,
    from: String,
    text: String,
    at: String,
    #[serde(default)]
    read_at: Option<String>,
    #[serde(default)]
    reactions: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PersonCard {
    id: String,
    username: String,
    avatar_data: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RequestView {
    id: String,
    user_id: String,
    username: String,
    avatar_data: Option<String>,
    at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ThreadView {
    peer_id: String,
    username: String,
    avatar_data: Option<String>,
    messages: Vec<SocialMessage>,
    unread: u32,
    peer_typing: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialSnapshot {
    friends: Vec<PersonCard>,
    incoming: Vec<RequestView>,
    outgoing: Vec<RequestView>,
    threads: Vec<ThreadView>,
    blocked: Vec<PersonCard>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicProfile {
    id: String,
    username: String,
    avatar_data: Option<String>,
    lessons: u32,
    exercises: u32,
    qa_mastered: u32,
    qa_complete: bool,
    xp: u32,
    level: u32,
    rank_id: String,
    achievements: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementRate {
    id: String,
    percent: u32,
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn has_id(list: &[String], id: &str) -> bool {
    list.iter().any(|item| item == id)
}

fn typing_recent(iso: &str, max_ms: i64) -> bool {
    let Ok(at) = chrono::DateTime::parse_from_rfc3339(iso) else {
        return false;
    };
    let age = chrono::Utc::now().signed_duration_since(at.with_timezone(&chrono::Utc));
    let ms = age.num_milliseconds();
    ms >= 0 && ms < max_ms
}

fn either_blocked(mine: &SocialDoc, me_id: &str, other: &SocialDoc, other_id: &str) -> bool {
    has_id(&mine.blocked, other_id) || has_id(&other.blocked, me_id)
}

fn read_social(meta: &Map<String, Value>) -> SocialDoc {
    meta.get("social")
        .cloned()
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default()
}

fn write_social(meta: &mut Map<String, Value>, doc: &SocialDoc) -> Result<(), String> {
    meta.insert(
        "social".into(),
        serde_json::to_value(doc).map_err(|err| err.to_string())?,
    );
    Ok(())
}

fn trim_threads(doc: &mut SocialDoc) {
    for messages in doc.threads.values_mut() {
        if messages.len() > MAX_MESSAGES {
            let drop_n = messages.len() - MAX_MESSAGES;
            messages.drain(0..drop_n);
        }
    }
    if doc.threads.len() > MAX_THREADS {
        let mut keys: Vec<(String, String)> = doc
            .threads
            .iter()
            .map(|(key, messages)| {
                let last = messages.last().map(|item| item.at.clone()).unwrap_or_default();
                (key.clone(), last)
            })
            .collect();
        keys.sort_by(|a, b| a.1.cmp(&b.1));
        let extra = doc.threads.len() - MAX_THREADS;
        for (key, _) in keys.into_iter().take(extra) {
            doc.threads.remove(&key);
        }
    }
}

fn load_social(user_id: &str) -> Result<SocialDoc, String> {
    let full = cloud::fetch_raw_user(user_id)?;
    Ok(full
        .get("app_metadata")
        .and_then(|value| value.as_object())
        .map(read_social)
        .unwrap_or_default())
}

fn update_social(
    user_id: &str,
    mutate: impl FnOnce(&mut SocialDoc) -> Result<(), String>,
) -> Result<(), String> {
    cloud::patch_app_metadata(user_id, |meta| {
        let mut doc = read_social(meta);
        mutate(&mut doc)?;
        trim_threads(&mut doc);
        write_social(meta, &doc)
    })
}

fn person_from(directory: &HashMap<String, CloudUser>, id: &str, fallback: &str) -> PersonCard {
    if let Some(user) = directory.get(id) {
        PersonCard {
            id: id.to_string(),
            username: user.username.clone(),
            avatar_data: user.avatar_data.clone(),
        }
    } else {
        PersonCard {
            id: id.to_string(),
            username: if fallback.is_empty() {
                "Compte supprimé".into()
            } else {
                fallback.to_string()
            },
            avatar_data: None,
        }
    }
}

fn directory() -> Result<HashMap<String, CloudUser>, String> {
    let users = cloud::list_cloud_accounts()?;
    Ok(users.into_iter().map(|user| (user.id.clone(), user)).collect())
}

fn snapshot_for(me: &CloudUser) -> Result<SocialSnapshot, String> {
    let doc = load_social(&me.id)?;
    let directory = directory().unwrap_or_default();
    let mut friends = Vec::new();
    for id in &doc.friends {
        if has_id(&doc.blocked, id) {
            continue;
        }
        friends.push(person_from(&directory, id, ""));
    }
    friends.sort_by(|a, b| a.username.to_lowercase().cmp(&b.username.to_lowercase()));

    let mut incoming = Vec::new();
    for request in &doc.incoming {
        if has_id(&doc.blocked, &request.user_id) {
            continue;
        }
        let card = person_from(&directory, &request.user_id, &request.username);
        incoming.push(RequestView {
            id: request.id.clone(),
            user_id: request.user_id.clone(),
            username: card.username,
            avatar_data: card.avatar_data,
            at: request.at.clone(),
        });
    }
    let mut outgoing = Vec::new();
    for request in &doc.outgoing {
        if has_id(&doc.blocked, &request.user_id) {
            continue;
        }
        let card = person_from(&directory, &request.user_id, &request.username);
        outgoing.push(RequestView {
            id: request.id.clone(),
            user_id: request.user_id.clone(),
            username: card.username,
            avatar_data: card.avatar_data,
            at: request.at.clone(),
        });
    }

    let mut threads = Vec::new();
    for friend in &friends {
        let messages = doc
            .threads
            .get(&friend.id)
            .cloned()
            .unwrap_or_default();
        let unread = messages
            .iter()
            .filter(|message| message.from != me.id && message.read_at.is_none())
            .count() as u32;
        let peer_typing = doc
            .incoming_typing
            .get(&friend.id)
            .is_some_and(|at| typing_recent(at, 8_000));
        threads.push(ThreadView {
            peer_id: friend.id.clone(),
            username: friend.username.clone(),
            avatar_data: friend.avatar_data.clone(),
            messages,
            unread,
            peer_typing,
        });
    }
    threads.sort_by(|a, b| {
        let at = |thread: &ThreadView| {
            thread
                .messages
                .last()
                .map(|message| message.at.clone())
                .unwrap_or_default()
        };
        at(b).cmp(&at(a)).then_with(|| a.username.to_lowercase().cmp(&b.username.to_lowercase()))
    });

    let mut blocked = Vec::new();
    for id in &doc.blocked {
        blocked.push(person_from(&directory, id, ""));
    }
    blocked.sort_by(|a, b| a.username.to_lowercase().cmp(&b.username.to_lowercase()));

    Ok(SocialSnapshot {
        friends,
        incoming,
        outgoing,
        threads,
        blocked,
    })
}

fn require_me(token: String) -> Result<CloudUser, String> {
    if token.trim().is_empty() {
        return Err("Non authentifié.".into());
    }
    cloud::cloud_me(token)
}

#[tauri::command]
pub fn cloud_social_snapshot(token: String) -> Result<SocialSnapshot, String> {
    let me = require_me(token)?;
    snapshot_for(&me)
}

#[tauri::command]
pub fn cloud_social_request(token: String, username: String) -> Result<SocialSnapshot, String> {
    let me = require_me(token)?;
    let wanted = username.trim();
    if wanted.is_empty() {
        return Err("Indiquez un pseudo.".into());
    }
    let accounts = cloud::list_cloud_accounts()?;
    let target = accounts
        .into_iter()
        .find(|user| user.username == wanted)
        .ok_or_else(|| "Pseudo inexistant.".to_string())?;
    if target.id == me.id {
        return Err("Vous ne pouvez pas vous ajouter vous-même.".into());
    }

    let mine = load_social(&me.id)?;
    if mine.friends.iter().any(|id| id == &target.id) {
        return Err("Déjà dans vos amis.".into());
    }
    if mine.outgoing.iter().any(|request| request.user_id == target.id) {
        return Err("Demande déjà envoyée.".into());
    }
    if mine.incoming.iter().any(|request| request.user_id == target.id) {
        return Err("Cette personne vous a déjà envoyé une demande.".into());
    }
    let target_doc = load_social(&target.id).unwrap_or_default();
    if either_blocked(&mine, &me.id, &target_doc, &target.id) {
        return Err("Demande impossible.".into());
    }

    let request_id = uuid::Uuid::new_v4().to_string();
    let at = now_iso();
    let outgoing = SocialRequest {
        id: request_id.clone(),
        user_id: target.id.clone(),
        username: target.username.clone(),
        at: at.clone(),
    };
    let incoming = SocialRequest {
        id: request_id.clone(),
        user_id: me.id.clone(),
        username: me.username.clone(),
        at,
    };

    update_social(&me.id, |doc| {
        doc.outgoing.push(outgoing);
        Ok(())
    })?;
    if let Err(error) = update_social(&target.id, |doc| {
        doc.incoming.push(incoming);
        Ok(())
    }) {
        let id = request_id;
        let _ = update_social(&me.id, |doc| {
            doc.outgoing.retain(|request| request.id != id);
            Ok(())
        });
        return Err(error);
    }
    snapshot_for(&me)
}

#[tauri::command]
pub fn cloud_social_respond(
    token: String,
    request_id: String,
    accept: bool,
) -> Result<SocialSnapshot, String> {
    let me = require_me(token)?;
    let request_id = request_id.trim().to_string();
    let mine = load_social(&me.id)?;
    let request = mine
        .incoming
        .iter()
        .find(|item| item.id == request_id)
        .cloned()
        .ok_or_else(|| "Demande introuvable.".to_string())?;
    let other_id = request.user_id.clone();
    if accept {
        let other = load_social(&other_id).unwrap_or_default();
        if either_blocked(&mine, &me.id, &other, &other_id) {
            return Err("Action impossible.".into());
        }
    }

    update_social(&me.id, |doc| {
        doc.incoming.retain(|item| item.id != request_id);
        doc.outgoing.retain(|item| item.id != request_id);
        if accept && !doc.friends.iter().any(|id| id == &other_id) {
            doc.friends.push(other_id.clone());
        }
        Ok(())
    })?;
    let _ = update_social(&other_id, |doc| {
        doc.outgoing.retain(|item| item.id != request_id);
        doc.incoming.retain(|item| item.id != request_id);
        if accept && !doc.friends.iter().any(|id| id == &me.id) {
            doc.friends.push(me.id.clone());
        }
        Ok(())
    });
    snapshot_for(&me)
}

#[tauri::command]
pub fn cloud_social_send(
    token: String,
    peer_id: String,
    text: String,
) -> Result<SocialSnapshot, String> {
    let me = require_me(token)?;
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("Message vide.".into());
    }
    if text.chars().count() > MAX_TEXT_CHARS {
        return Err("Message trop long (280 caractères).".into());
    }
    let mine = load_social(&me.id)?;
    if !mine.friends.iter().any(|id| id == &peer_id) {
        return Err("Vous ne pouvez écrire qu'à un ami.".into());
    }
    if has_id(&mine.blocked, &peer_id) {
        return Err("Vous ne pouvez pas écrire à cet utilisateur.".into());
    }
    let peer_doc = load_social(&peer_id).unwrap_or_default();
    if has_id(&peer_doc.blocked, &me.id) {
        return Err("Vous ne pouvez pas écrire à cet utilisateur.".into());
    }
    let _peer = cloud::fetch_cloud_user(&peer_id)?;
    let message = SocialMessage {
        id: uuid::Uuid::new_v4().to_string(),
        from: me.id.clone(),
        text,
        at: now_iso(),
        read_at: None,
        reactions: HashMap::new(),
    };
    let stored = message.clone();
    update_social(&me.id, |doc| {
        doc.threads.entry(peer_id.clone()).or_default().push(message);
        Ok(())
    })?;
    if let Err(error) = update_social(&peer_id, |doc| {
        doc.threads.entry(me.id.clone()).or_default().push(stored.clone());
        Ok(())
    }) {
        let id = stored.id.clone();
        let _ = update_social(&me.id, |doc| {
            if let Some(list) = doc.threads.get_mut(&peer_id) {
                list.retain(|item| item.id != id);
            }
            Ok(())
        });
        return Err(error);
    }
    snapshot_for(&me)
}

#[tauri::command]
pub fn cloud_social_read(token: String, peer_id: String) -> Result<SocialSnapshot, String> {
    let me = require_me(token)?;
    let at = now_iso();
    let mut ids = Vec::new();
    update_social(&me.id, |doc| {
        if let Some(list) = doc.threads.get_mut(&peer_id) {
            for message in list.iter_mut() {
                if message.from != me.id && message.read_at.is_none() {
                    message.read_at = Some(at.clone());
                    ids.push(message.id.clone());
                }
            }
        }
        Ok(())
    })?;
    if !ids.is_empty() {
        let _ = update_social(&peer_id, |doc| {
            if let Some(list) = doc.threads.get_mut(&me.id) {
                for message in list.iter_mut() {
                    if ids.iter().any(|id| id == &message.id) {
                        message.read_at = Some(at.clone());
                    }
                }
            }
            Ok(())
        });
    }
    snapshot_for(&me)
}

#[tauri::command]
pub fn cloud_social_delete_message(
    token: String,
    peer_id: String,
    message_id: String,
) -> Result<SocialSnapshot, String> {
    let me = require_me(token)?;
    let mine = load_social(&me.id)?;
    let message = mine
        .threads
        .get(&peer_id)
        .and_then(|list| list.iter().find(|item| item.id == message_id))
        .cloned()
        .ok_or_else(|| "Message introuvable.".to_string())?;
    let authored = message.from == me.id;
    update_social(&me.id, |doc| {
        if let Some(list) = doc.threads.get_mut(&peer_id) {
            list.retain(|item| item.id != message_id);
        }
        Ok(())
    })?;
    if authored {
        let _ = update_social(&peer_id, |doc| {
            if let Some(list) = doc.threads.get_mut(&me.id) {
                list.retain(|item| item.id != message_id);
            }
            Ok(())
        });
    }
    snapshot_for(&me)
}

#[tauri::command]
pub fn cloud_social_react(
    token: String,
    peer_id: String,
    message_id: String,
    emoji: String,
) -> Result<SocialSnapshot, String> {
    let me = require_me(token)?;
    let emoji = emoji.trim().to_string();
    if emoji.chars().count() > 8 || emoji.chars().any(|ch| ch.is_control()) {
        return Err("Réaction invalide.".into());
    }
    let apply = |doc: &mut SocialDoc, owner: &str| {
        let Some(list) = doc.threads.get_mut(owner) else {
            return;
        };
        let Some(message) = list.iter_mut().find(|item| item.id == message_id) else {
            return;
        };
        if emoji.is_empty() || message.reactions.get(&me.id).is_some_and(|current| current == &emoji)
        {
            message.reactions.remove(&me.id);
        } else {
            message.reactions.insert(me.id.clone(), emoji.clone());
        }
    };
    update_social(&me.id, |doc| {
        apply(doc, &peer_id);
        Ok(())
    })?;
    let _ = update_social(&peer_id, |doc| {
        apply(doc, &me.id);
        Ok(())
    });
    snapshot_for(&me)
}

#[tauri::command]
pub fn cloud_social_delete_thread(token: String, peer_id: String) -> Result<SocialSnapshot, String> {
    let me = require_me(token)?;
    let peer_id = peer_id.trim().to_string();
    if peer_id.is_empty() {
        return Err("Discussion introuvable.".into());
    }
    update_social(&me.id, |doc| {
        doc.threads.remove(&peer_id);
        doc.incoming_typing.remove(&peer_id);
        Ok(())
    })?;
    snapshot_for(&me)
}

#[tauri::command]
pub fn cloud_social_typing(token: String, peer_id: String, active: bool) -> Result<(), String> {
    let me = require_me(token)?;
    let peer_id = peer_id.trim().to_string();
    if peer_id.is_empty() || peer_id == me.id {
        return Ok(());
    }
    let mine = load_social(&me.id).unwrap_or_default();
    if !mine.friends.iter().any(|id| id == &peer_id) || has_id(&mine.blocked, &peer_id) {
        return Ok(());
    }
    let _ = update_social(&peer_id, |doc| {
        if has_id(&doc.blocked, &me.id) {
            return Ok(());
        }
        if active {
            doc.incoming_typing.insert(me.id.clone(), now_iso());
        } else {
            doc.incoming_typing.remove(&me.id);
        }
        doc.incoming_typing
            .retain(|_, at| typing_recent(at, 30_000));
        Ok(())
    });
    Ok(())
}

#[tauri::command]
pub fn cloud_social_block(token: String, user_id: String) -> Result<SocialSnapshot, String> {
    let me = require_me(token)?;
    let user_id = user_id.trim().to_string();
    if user_id.is_empty() || user_id == me.id {
        return Err("Action impossible.".into());
    }
    let _user = cloud::fetch_cloud_user(&user_id)?;
    update_social(&me.id, |doc| {
        if !has_id(&doc.blocked, &user_id) {
            doc.blocked.push(user_id.clone());
        }
        doc.friends.retain(|id| id != &user_id);
        doc.incoming.retain(|item| item.user_id != user_id);
        doc.outgoing.retain(|item| item.user_id != user_id);
        doc.threads.remove(&user_id);
        doc.incoming_typing.remove(&user_id);
        Ok(())
    })?;
    let _ = update_social(&user_id, |doc| {
        doc.friends.retain(|id| id != &me.id);
        doc.incoming.retain(|item| item.user_id != me.id);
        doc.outgoing.retain(|item| item.user_id != me.id);
        doc.threads.remove(&me.id);
        doc.incoming_typing.remove(&me.id);
        Ok(())
    });
    snapshot_for(&me)
}

#[tauri::command]
pub fn cloud_social_remove_friend(token: String, user_id: String) -> Result<SocialSnapshot, String> {
    let me = require_me(token)?;
    let user_id = user_id.trim().to_string();
    if user_id.is_empty() || user_id == me.id {
        return Err("Action impossible.".into());
    }
    update_social(&me.id, |doc| {
        doc.friends.retain(|id| id != &user_id);
        doc.incoming.retain(|item| item.user_id != user_id);
        doc.outgoing.retain(|item| item.user_id != user_id);
        Ok(())
    })?;
    let _ = update_social(&user_id, |doc| {
        doc.friends.retain(|id| id != &me.id);
        doc.incoming.retain(|item| item.user_id != me.id);
        doc.outgoing.retain(|item| item.user_id != me.id);
        Ok(())
    });
    snapshot_for(&me)
}

#[tauri::command]
pub fn cloud_social_unblock(token: String, user_id: String) -> Result<SocialSnapshot, String> {
    let me = require_me(token)?;
    let user_id = user_id.trim().to_string();
    update_social(&me.id, |doc| {
        doc.blocked.retain(|id| id != &user_id);
        Ok(())
    })?;
    snapshot_for(&me)
}

fn union_strings(current: Option<&Value>, incoming: Option<&Value>) -> Value {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for source in [current, incoming].into_iter().flatten() {
        if let Some(items) = source.as_array() {
            for item in items {
                if let Some(text) = item.as_str() {
                    if seen.insert(text.to_string()) {
                        out.push(text.to_string());
                    }
                }
            }
        }
    }
    json!(out)
}

fn max_number_map(current: Option<&Value>, incoming: Option<&Value>) -> Value {
    let mut map = Map::new();
    for source in [current, incoming].into_iter().flatten() {
        if let Some(obj) = source.as_object() {
            for (key, value) in obj {
                let next = value.as_u64().or_else(|| value.as_i64().map(|n| n.max(0) as u64));
                let Some(next) = next else { continue };
                let prev = map.get(key).and_then(|item| item.as_u64()).unwrap_or(0);
                map.insert(key.clone(), json!(prev.max(next)));
            }
        }
    }
    Value::Object(map)
}

fn merge_stats(current: Option<&Value>, incoming: Option<&Value>) -> Value {
    let empty = Map::new();
    let left = current.and_then(|value| value.as_object()).unwrap_or(&empty);
    let right = incoming.and_then(|value| value.as_object()).unwrap_or(&empty);
    let mut keys = HashSet::new();
    keys.extend(left.keys().cloned());
    keys.extend(right.keys().cloned());
    let mut out = Map::new();
    for key in keys {
        let a = left.get(&key);
        let b = right.get(&key);
        let merged = if key == "themes" || key == "activeDays" {
            union_strings(a, b)
        } else if a.and_then(|v| v.as_bool()).is_some() || b.and_then(|v| v.as_bool()).is_some() {
            json!(a.and_then(|v| v.as_bool()).unwrap_or(false) || b.and_then(|v| v.as_bool()).unwrap_or(false))
        } else if a.and_then(|v| v.as_u64()).is_some() || b.and_then(|v| v.as_u64()).is_some() || a.and_then(|v| v.as_i64()).is_some()
        {
            let na = a.and_then(|v| v.as_i64()).unwrap_or(0);
            let nb = b.and_then(|v| v.as_i64()).unwrap_or(0);
            json!(na.max(nb))
        } else {
            b.cloned().or_else(|| a.cloned()).unwrap_or(Value::Null)
        };
        out.insert(key, merged);
    }
    Value::Object(out)
}

fn learning_attempts(card: &Value) -> i64 {
    card.get("successes").and_then(|v| v.as_i64()).unwrap_or(0)
        + card.get("failures").and_then(|v| v.as_i64()).unwrap_or(0)
}

fn merge_learning(current: Option<&Value>, incoming: Option<&Value>) -> Value {
    let empty_obj = Map::new();
    let left = current.and_then(|v| v.as_object());
    let right = incoming.and_then(|v| v.as_object());
    let left_notions = left
        .and_then(|v| v.get("notions"))
        .and_then(|v| v.as_object())
        .unwrap_or(&empty_obj);
    let right_notions = right
        .and_then(|v| v.get("notions"))
        .and_then(|v| v.as_object())
        .unwrap_or(&empty_obj);
    let mut notion_keys = HashSet::new();
    notion_keys.extend(left_notions.keys().cloned());
    notion_keys.extend(right_notions.keys().cloned());
    let mut notions = Map::new();
    for key in notion_keys {
        let a = left_notions.get(&key);
        let b = right_notions.get(&key);
        let chosen = match (a, b) {
            (Some(a), Some(b)) => {
                let aa = learning_attempts(a);
                let bb = learning_attempts(b);
                if aa != bb {
                    if aa > bb { a } else { b }
                } else {
                    let at = a.get("lastReviewAt").and_then(|v| v.as_str()).unwrap_or("");
                    let bt = b.get("lastReviewAt").and_then(|v| v.as_str()).unwrap_or("");
                    if bt > at { b } else { a }
                }
            }
            (Some(a), None) => a,
            (None, Some(b)) => b,
            (None, None) => continue,
        };
        notions.insert(key, chosen.clone());
    }

    let mut journal_map: HashMap<String, Value> = HashMap::new();
    for source in [right.and_then(|v| v.get("journal")), left.and_then(|v| v.get("journal"))]
        .into_iter()
        .flatten()
    {
        let Some(items) = source.as_array() else { continue };
        for item in items {
            let Some(id) = item.get("id").and_then(|v| v.as_str()) else { continue };
            if let Some(prev) = journal_map.get(id) {
                let mut merged = item.clone();
                if let Some(obj) = merged.as_object_mut() {
                    let understood = prev.get("understood").and_then(|v| v.as_bool()).unwrap_or(false)
                        || item.get("understood").and_then(|v| v.as_bool()).unwrap_or(false);
                    let later = prev.get("reviewLater").and_then(|v| v.as_bool()).unwrap_or(false)
                        || item.get("reviewLater").and_then(|v| v.as_bool()).unwrap_or(false);
                    obj.insert("understood".into(), json!(understood));
                    obj.insert("reviewLater".into(), json!(later));
                }
                journal_map.insert(id.to_string(), merged);
            } else {
                journal_map.insert(id.to_string(), item.clone());
            }
        }
    }
    let mut journal: Vec<Value> = journal_map.into_values().collect();
    journal.sort_by(|a, b| {
        let at = a.get("at").and_then(|v| v.as_str()).unwrap_or("");
        let bt = b.get("at").and_then(|v| v.as_str()).unwrap_or("");
        bt.cmp(at)
    });
    journal.truncate(60);
    json!({ "notions": notions, "journal": journal })
}

fn reset_stamp(value: &Value) -> &str {
    value
        .get("resetAt")
        .and_then(|item| item.as_str())
        .filter(|stamp| !stamp.is_empty())
        .unwrap_or("")
}

fn merge_progression(current: &Value, incoming: &Value) -> Value {
    if !incoming.is_object() {
        return current.clone();
    }
    if !current.is_object() {
        return incoming.clone();
    }
    let current_reset = reset_stamp(current);
    let incoming_reset = reset_stamp(incoming);
    if current_reset != incoming_reset {
        let (winner, other) = if incoming_reset > current_reset {
            (incoming, current)
        } else {
            (current, incoming)
        };
        let mut out = winner.clone();
        if let Some(obj) = out.as_object_mut() {
            obj.insert(
                "learning".into(),
                merge_learning(winner.get("learning"), other.get("learning")),
            );
            let tutorial = winner
                .get("tutorialDone")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
                || other
                    .get("tutorialDone")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
            obj.insert("tutorialDone".into(), json!(tutorial));
        }
        return out;
    }
    let mut out = incoming.clone();
    let obj = out.as_object_mut().expect("object");
    obj.insert(
        "claimedLessons".into(),
        union_strings(current.get("claimedLessons"), incoming.get("claimedLessons")),
    );
    obj.insert(
        "achievements".into(),
        union_strings(current.get("achievements"), incoming.get("achievements")),
    );
    obj.insert(
        "qaGrants".into(),
        max_number_map(current.get("qaGrants"), incoming.get("qaGrants")),
    );
    obj.insert(
        "qaSeenAttempts".into(),
        max_number_map(current.get("qaSeenAttempts"), incoming.get("qaSeenAttempts")),
    );
    let tutorial = current
        .get("tutorialDone")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
        || incoming
            .get("tutorialDone")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
    obj.insert("tutorialDone".into(), json!(tutorial));
    obj.insert(
        "stats".into(),
        merge_stats(current.get("stats"), incoming.get("stats")),
    );
    let xp_current = current.get("xp").and_then(|v| v.as_u64()).unwrap_or(0);
    let xp_incoming = incoming.get("xp").and_then(|v| v.as_u64()).unwrap_or(0);
    if xp_current > xp_incoming {
        if let Some(level) = current.get("level") {
            obj.insert("level".into(), level.clone());
        }
        if let Some(rank) = current.get("rankId") {
            obj.insert("rankId".into(), rank.clone());
        }
        if let Some(name) = current.get("rankName") {
            obj.insert("rankName".into(), name.clone());
        }
    }
    obj.insert(
        "learning".into(),
        merge_learning(current.get("learning"), incoming.get("learning")),
    );
    obj.insert("xp".into(), json!(xp_current.max(xp_incoming)));
    let at_current = current.get("updatedAt").and_then(|v| v.as_str()).unwrap_or("");
    let at_incoming = incoming.get("updatedAt").and_then(|v| v.as_str()).unwrap_or("");
    obj.insert(
        "updatedAt".into(),
        json!(if at_current > at_incoming { at_current } else { at_incoming }),
    );
    if obj.get("creditFloor").is_none() {
        if let Some(floor) = current.get("creditFloor") {
            obj.insert("creditFloor".into(), floor.clone());
        }
    }
    if obj.get("resetAt").is_none() {
        if let Some(stamp) = current.get("resetAt") {
            obj.insert("resetAt".into(), stamp.clone());
        }
    }
    out
}

#[tauri::command]
pub fn cloud_get_progression(token: String) -> Result<Value, String> {
    let me = require_me(token)?;
    let full = cloud::fetch_raw_user(&me.id)?;
    Ok(full
        .pointer("/app_metadata/progression")
        .cloned()
        .filter(|value| value.is_object())
        .unwrap_or_else(|| json!({})))
}

#[tauri::command]
pub fn cloud_put_progression(token: String, progression: Value) -> Result<Value, String> {
    let me = require_me(token)?;
    let mut saved = json!({});
    cloud::patch_app_metadata(&me.id, |meta| {
        let current = meta.get("progression").cloned().unwrap_or_else(|| json!({}));
        let merged = merge_progression(&current, &progression);
        saved = merged.clone();
        meta.insert("progression".into(), merged);
        Ok(())
    })?;
    Ok(saved)
}

#[tauri::command]
pub fn cloud_public_profile(token: String, user_id: String) -> Result<PublicProfile, String> {
    let _me = require_me(token)?;
    let full = cloud::fetch_raw_user(user_id.trim())?;
    let user = cloud::public_user(&full)?;
    let progress = full
        .pointer("/app_metadata/progress")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let lessons = progress
        .get("completedLessons")
        .and_then(|v| v.as_array())
        .map(|items| items.len() as u32)
        .unwrap_or(0);
    let exercises = progress
        .get("completedExercises")
        .and_then(|v| v.as_array())
        .map(|items| items.len() as u32)
        .unwrap_or(0);
    let mut qa_mastered = 0u32;
    let mut qa_complete_langs = 0u32;
    if let Some(entries) = progress.get("qa").and_then(|v| v.as_object()) {
        for value in entries.values() {
            let correct = value
                .get("correctIds")
                .and_then(|v| v.as_array())
                .map(|items| items.len() as u32)
                .unwrap_or(0);
            let pool = value.get("poolSize").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            qa_mastered += correct;
            if pool > 0 && correct >= pool {
                qa_complete_langs += 1;
            }
        }
    }
    let prog = full.pointer("/app_metadata/progression");
    let xp = prog
        .and_then(|v| v.get("xp"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let level = prog
        .and_then(|v| v.get("level"))
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as u32;
    let rank_id = prog
        .and_then(|v| v.get("rankId"))
        .and_then(|v| v.as_str())
        .unwrap_or("bronze")
        .to_string();
    let achievements = prog
        .and_then(|v| v.get("achievements"))
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    Ok(PublicProfile {
        id: user.id,
        username: user.username,
        avatar_data: user.avatar_data,
        lessons,
        exercises,
        qa_mastered,
        qa_complete: qa_complete_langs >= 4,
        xp,
        level: level.max(1),
        rank_id,
        achievements,
    })
}

struct RateCache {
    at: Instant,
    rates: Vec<AchievementRate>,
}

static RATE_CACHE: Mutex<Option<RateCache>> = Mutex::new(None);

#[tauri::command]
pub fn cloud_achievement_rates(token: String) -> Result<Vec<AchievementRate>, String> {
    let _me = require_me(token)?;
    {
        let guard = RATE_CACHE.lock().unwrap_or_else(|err| err.into_inner());
        if let Some(cache) = guard.as_ref() {
            if cache.at.elapsed() < Duration::from_secs(120) {
                return Ok(cache.rates.clone());
            }
        }
    }
    let users = cloud::list_raw_users()?;
    let total = users.len();
    let mut counts: HashMap<String, u32> = HashMap::new();
    for user in &users {
        let Some(items) = user.pointer("/app_metadata/progression/achievements").and_then(|v| v.as_array()) else {
            continue;
        };
        let mut seen = HashSet::new();
        for item in items {
            if let Some(id) = item.as_str() {
                if seen.insert(id.to_string()) {
                    *counts.entry(id.to_string()).or_insert(0) += 1;
                }
            }
        }
    }
    let mut rates = Vec::new();
    if total > 0 {
        for (id, count) in counts {
            rates.push(AchievementRate {
                id,
                percent: ((count as u64 * 100) / total as u64) as u32,
            });
        }
    }
    rates.sort_by(|a, b| a.id.cmp(&b.id));
    if let Ok(mut guard) = RATE_CACHE.lock() {
        *guard = Some(RateCache {
            at: Instant::now(),
            rates: rates.clone(),
        });
    }
    Ok(rates)
}

#[tauri::command]
pub fn flash_taskbar(app: AppHandle) {
    let window = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().into_iter().next().map(|(_, window)| window));
    if let Some(window) = window {
        let _ = window.request_user_attention(Some(tauri::UserAttentionType::Informational));
    }
}
