use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::paths;

const FILE_NAME: &str = ".codeflow-recovery.json";

#[derive(Serialize, Deserialize)]
struct RecoveryFile {
    username: String,
    password: String,
}

fn recovery_path() -> Result<PathBuf, String> {
    Ok(paths::app_data_dir()?.join(FILE_NAME))
}

fn b64_encode(input: &str) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut out = String::new();
    let mut i = 0;
    while i + 3 <= bytes.len() {
        let n = ((bytes[i] as u32) << 16) | ((bytes[i + 1] as u32) << 8) | (bytes[i + 2] as u32);
        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);
        out.push(TABLE[((n >> 6) & 63) as usize] as char);
        out.push(TABLE[(n & 63) as usize] as char);
        i += 3;
    }
    if i < bytes.len() {
        let rem = bytes.len() - i;
        let mut n = (bytes[i] as u32) << 16;
        if rem == 2 {
            n |= (bytes[i + 1] as u32) << 8;
        }
        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);
        if rem == 2 {
            out.push(TABLE[((n >> 6) & 63) as usize] as char);
            out.push('=');
        } else {
            out.push('=');
            out.push('=');
        }
    }
    out
}

fn b64_decode(input: &str) -> Result<String, String> {
    fn val(c: u8) -> Result<u32, String> {
        match c {
            b'A'..=b'Z' => Ok((c - b'A') as u32),
            b'a'..=b'z' => Ok((c - b'a') as u32 + 26),
            b'0'..=b'9' => Ok((c - b'0') as u32 + 52),
            b'+' => Ok(62),
            b'/' => Ok(63),
            _ => Err("Fichier de récupération illisible.".into()),
        }
    }
    let cleaned: Vec<u8> = input
        .bytes()
        .filter(|c| !c.is_ascii_whitespace() && *c != b'=')
        .collect();
    if cleaned.len() % 4 == 1 {
        return Err("Fichier de récupération illisible.".into());
    }
    let mut bytes = Vec::new();
    let mut i = 0;
    while i + 4 <= cleaned.len() {
        let n = (val(cleaned[i])? << 18)
            | (val(cleaned[i + 1])? << 12)
            | (val(cleaned[i + 2])? << 6)
            | val(cleaned[i + 3])?;
        bytes.push((n >> 16) as u8);
        bytes.push((n >> 8) as u8);
        bytes.push(n as u8);
        i += 4;
    }
    let rem = cleaned.len() - i;
    if rem == 2 {
        let n = (val(cleaned[i])? << 18) | (val(cleaned[i + 1])? << 12);
        bytes.push((n >> 16) as u8);
    } else if rem == 3 {
        let n = (val(cleaned[i])? << 18) | (val(cleaned[i + 1])? << 12) | (val(cleaned[i + 2])? << 6);
        bytes.push((n >> 16) as u8);
        bytes.push((n >> 8) as u8);
    }
    String::from_utf8(bytes).map_err(|_| "Fichier de récupération illisible.".into())
}

fn read_file() -> Result<Option<RecoveryFile>, String> {
    let path = recovery_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let file: RecoveryFile = serde_json::from_str(&raw).map_err(|_| {
        "Fichier de récupération illisible.".to_string()
    })?;
    Ok(Some(RecoveryFile {
        username: b64_decode(&file.username)?,
        password: b64_decode(&file.password)?,
    }))
}

#[cfg(windows)]
fn hide_file(path: &std::path::Path) {
    use std::os::windows::ffi::OsStrExt;
    #[link(name = "kernel32")]
    extern "system" {
        fn GetFileAttributesW(name: *const u16) -> u32;
        fn SetFileAttributesW(name: *const u16, attrs: u32) -> i32;
    }
    const INVALID: u32 = 0xFFFF_FFFF;
    const HIDDEN: u32 = 0x2;
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    unsafe {
        let current = GetFileAttributesW(wide.as_ptr());
        let attrs = if current == INVALID { HIDDEN } else { current | HIDDEN };
        SetFileAttributesW(wide.as_ptr(), attrs);
    }
}

#[cfg(not(windows))]
fn hide_file(_path: &std::path::Path) {}

fn write_file(username: &str, password: &str) -> Result<(), String> {
    let path = recovery_path()?;
    let payload = RecoveryFile {
        username: b64_encode(username.trim()),
        password: b64_encode(password),
    };
    let json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    hide_file(&path);
    Ok(())
}

#[tauri::command]
pub fn save_local_recovery(username: String, password: String) -> Result<(), String> {
    let username = username.trim().to_string();
    if username.is_empty() || password.is_empty() {
        return Err("Pseudo et mot de passe requis.".into());
    }
    write_file(&username, &password)
}

#[tauri::command]
pub fn update_recovery_username(previous: String, username: String) -> Result<(), String> {
    let Some(file) = read_file()? else {
        return Ok(());
    };
    if !file.username.eq_ignore_ascii_case(previous.trim()) {
        return Ok(());
    }
    write_file(username.trim(), &file.password)
}

#[tauri::command]
pub fn recover_local_password(username: String) -> Result<String, String> {
    let username = username.trim().to_string();
    if username.is_empty() {
        return Err("Indiquez votre pseudo.".into());
    }
    let Some(file) = read_file()? else {
        return Err("Aucun mot de passe enregistré sur cet ordinateur.".into());
    };
    if file.username.eq_ignore_ascii_case(&username) {
        Ok(file.password)
    } else {
        Err("Aucun mot de passe enregistré pour ce pseudo sur cet ordinateur.".into())
    }
}

pub fn clear_recovery_for_username(username: &str) -> Result<(), String> {
    let Some(file) = read_file()? else {
        return Ok(());
    };
    if !file.username.eq_ignore_ascii_case(username.trim()) {
        return Ok(());
    }
    let path = recovery_path()?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn recover_local_username() -> Result<String, String> {
    let Some(file) = read_file()? else {
        return Err("Aucun pseudo enregistré sur cet ordinateur.".into());
    };
    if file.username.trim().is_empty() {
        return Err("Aucun pseudo enregistré sur cet ordinateur.".into());
    }
    Ok(file.username)
}
