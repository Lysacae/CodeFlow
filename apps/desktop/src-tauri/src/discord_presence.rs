//! Présence Discord pendant que la fenêtre CodeFlow est ouverte.
//!
//! L'identifiant vient de `CODEFLOW_DISCORD_APP_ID` à la compilation, sinon de
//! `DISCORD_APPLICATION_ID`. Sans identifiant (application créée sur
//! https://discord.com/developers/applications), la présence reste inactive.
//! La grande image Rich Presence utilise la clé d'asset `codeflow`.

use std::sync::mpsc::{self, Sender};
use std::sync::OnceLock;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use discord_rich_presence::activity::{ActivityType, Assets};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

/// À remplacer par l'Application ID du portail Discord (application « CodeFlow »).
const DISCORD_APPLICATION_ID: &str = "";

const LARGE_IMAGE_KEY: &str = "codeflow";

enum Msg {
    Update { details: String, state: String },
    Shutdown,
}

static TX: OnceLock<Sender<Msg>> = OnceLock::new();

fn application_id() -> &'static str {
    match option_env!("CODEFLOW_DISCORD_APP_ID") {
        Some(id) if !id.is_empty() => id,
        _ => DISCORD_APPLICATION_ID,
    }
}

fn configured() -> bool {
    let id = application_id();
    let len = id.len();
    (17..=20).contains(&len) && id.bytes().all(|byte| byte.is_ascii_digit())
}

pub fn start() {
    if !configured() {
        eprintln!(
            "Discord RPC inactif : définissez DISCORD_APPLICATION_ID ou CODEFLOW_DISCORD_APP_ID."
        );
        return;
    }
    let (tx, rx) = mpsc::channel();
    if TX.set(tx).is_err() {
        return;
    }
    thread::Builder::new()
        .name("discord-rpc".into())
        .spawn(move || worker(rx))
        .ok();
}

pub fn set_status(details: String, state: String) {
    let Some(tx) = TX.get() else {
        return;
    };
    let _ = tx.send(Msg::Update { details, state });
}

pub fn shutdown() {
    let Some(tx) = TX.get() else {
        return;
    };
    let _ = tx.send(Msg::Shutdown);
}

#[tauri::command]
pub fn discord_set_presence(details: String, state: String) {
    set_status(details, state);
}

fn worker(rx: mpsc::Receiver<Msg>) {
    let mut client: Option<DiscordIpcClient> = None;
    let mut details = "Apprend à coder".to_string();
    let mut state = "CodeFlow".to_string();
    let mut use_image = true;
    let started = unix_secs();

    loop {
        if client.is_none() {
            client = connect();
            if let Some(current) = client.as_mut() {
                if push(current, &details, &state, started, use_image).is_err() {
                    if use_image && push(current, &details, &state, started, false).is_ok() {
                        use_image = false;
                    } else {
                        let _ = current.close();
                        client = None;
                    }
                }
            }
        }

        match rx.recv_timeout(Duration::from_secs(15)) {
            Ok(Msg::Update {
                details: next_details,
                state: next_state,
            }) => {
                details = fallback(next_details, "Apprend à coder");
                state = fallback(next_state, "CodeFlow");
                if let Some(current) = client.as_mut() {
                    if push(current, &details, &state, started, use_image).is_err() {
                        let _ = current.close();
                        client = None;
                    }
                }
            }
            Ok(Msg::Shutdown) => {
                if let Some(current) = client.as_mut() {
                    let _ = current.clear_activity();
                    let _ = current.recv();
                    let _ = current.close();
                }
                break;
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if let Some(current) = client.as_mut() {
                    if push(current, &details, &state, started, use_image).is_err() {
                        let _ = current.close();
                        client = None;
                    }
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn connect() -> Option<DiscordIpcClient> {
    let mut client = DiscordIpcClient::new(application_id());
    match client.connect() {
        Ok(()) => Some(client),
        Err(_) => None,
    }
}

fn push(
    client: &mut DiscordIpcClient,
    details: &str,
    state: &str,
    started: i64,
    with_image: bool,
) -> Result<(), ()> {
    let mut payload = activity::Activity::new()
        .name("CodeFlow")
        .activity_type(ActivityType::Playing)
        .details(details)
        .state(state)
        .timestamps(activity::Timestamps::new().start(started));
    if with_image {
        payload = payload.assets(
            Assets::new()
                .large_image(LARGE_IMAGE_KEY)
                .large_text("CodeFlow"),
        );
    }
    client.set_activity(payload).map_err(|_| ())?;
    let (_opcode, response) = client.recv().map_err(|_| ())?;
    let rejected = response.get("evt").and_then(|value| value.as_str()) == Some("ERROR");
    if rejected { Err(()) } else { Ok(()) }
}

fn fallback(value: String, default: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        default.to_string()
    } else {
        trimmed.to_string()
    }
}

fn unix_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs() as i64)
        .unwrap_or(0)
}
