use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::Duration;

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub async fn download_and_run_update(app: AppHandle, url: String) -> Result<(), String> {
    let installed = is_installed_copy();
    let (path, run_setup) = download_update_file(&url, installed).await?;

    if run_setup {
        schedule_nsis_upgrade(&path)?;
    } else {
        let current = std::env::current_exe().map_err(|e| e.to_string())?;
        schedule_portable_replace(&path, &current)?;
    }

    let app_for_exit = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(700));
        app_for_exit.exit(0);
    });

    Ok(())
}

async fn download_update_file(url: &str, installed: bool) -> Result<(PathBuf, bool), String> {
    if installed || !looks_like_setup(url) {
        let path = save_download(url).await?;
        return Ok((path, looks_like_setup(url) || installed));
    }

    let portable_url = portable_asset_url(url);
    match save_download(&portable_url).await {
        Ok(path) => Ok((path, false)),
        Err(_) => {
            let path = save_download(url).await?;
            Ok((path, true))
        }
    }
}

async fn save_download(url: &str) -> Result<PathBuf, String> {
    let url_owned = url.to_string();
    let bytes = tauri::async_runtime::spawn_blocking(move || download_bytes(&url_owned))
        .await
        .map_err(|e| e.to_string())??;

    let mut path = std::env::temp_dir();
    path.push(safe_file_name(url));
    let mut file = fs::File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

fn download_bytes(url: &str) -> Result<Vec<u8>, String> {
    let response = ureq::get(url)
        .call()
        .map_err(|e| format!("Téléchargement impossible : {e}"))?;
    let mut reader = response.into_reader();
    let mut bytes = Vec::new();
    std::io::copy(&mut reader, &mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() < 1024 {
        return Err("Fichier de mise à jour vide ou incomplet.".into());
    }
    Ok(bytes)
}

fn looks_like_setup(url: &str) -> bool {
    let name = url.split('?').next().unwrap_or(url).to_ascii_lowercase();
    name.contains("setup") && name.ends_with(".exe")
}

fn portable_asset_url(setup_url: &str) -> String {
    match setup_url.rsplit_once('/') {
        Some((base, _)) => format!("{base}/CodeFlow.exe"),
        None => setup_url.to_string(),
    }
}

fn safe_file_name(url: &str) -> String {
    let name = url
        .split('/')
        .next_back()
        .unwrap_or("CodeFlow-update.exe")
        .split('?')
        .next()
        .unwrap_or("CodeFlow-update.exe");
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if cleaned.to_ascii_lowercase().ends_with(".exe") {
        cleaned
    } else {
        "CodeFlow-update.exe".into()
    }
}

fn ps_quote(value: &str) -> String {
    value.replace('\'', "''")
}

fn schedule_nsis_upgrade(installer: &Path) -> Result<(), String> {
    let installer = ps_quote(&installer.display().to_string());
    let pid = std::process::id();
    let script = format!(
        r#"$targetPid = {pid}
while (Get-Process -Id $targetPid -ErrorAction SilentlyContinue) {{
  Start-Sleep -Milliseconds 300
}}
Start-Sleep -Seconds 1
Start-Process -FilePath '{installer}' -ArgumentList '/S','/UPDATE','/R' -Wait
"#
    );
    spawn_powershell(&script)
}

fn schedule_portable_replace(downloaded: &Path, current_exe: &Path) -> Result<(), String> {
    let source = ps_quote(&downloaded.display().to_string());
    let dest = ps_quote(&current_exe.display().to_string());
    let pid = std::process::id();
    let script = format!(
        r#"$targetPid = {pid}
while (Get-Process -Id $targetPid -ErrorAction SilentlyContinue) {{
  Start-Sleep -Milliseconds 300
}}
Start-Sleep -Seconds 1
Copy-Item -LiteralPath '{source}' -Destination '{dest}' -Force
Start-Process -FilePath '{dest}'
"#
    );
    spawn_powershell(&script)
}

fn spawn_powershell(script: &str) -> Result<(), String> {
    let mut script_path = std::env::temp_dir();
    script_path.push(format!("codeflow-update-{}.ps1", std::process::id()));
    fs::write(&script_path, script).map_err(|e| e.to_string())?;

    let mut cmd = Command::new("cmd.exe");
    cmd.args([
        "/C",
        "start",
        "",
        "/MIN",
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-File",
    ]);
    cmd.arg(&script_path);
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.spawn()
        .map_err(|e| format!("Impossible de lancer l'installateur : {e}"))?;
    Ok(())
}

fn is_installed_copy() -> bool {
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    let Some(dir) = exe.parent() else {
        return false;
    };
    let Some(install) = registry_install_dir() else {
        return false;
    };
    norm_dir(dir) == norm_dir(&install)
}

fn norm_dir(path: &Path) -> String {
    path.display()
        .to_string()
        .replace('/', "\\")
        .trim()
        .trim_matches('"')
        .trim_end_matches(['\\', '/'])
        .to_ascii_lowercase()
}

fn registry_install_dir() -> Option<PathBuf> {
    let mut cmd = Command::new("reg");
    cmd.args([
        "query",
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\CodeFlow",
        "/v",
        "InstallLocation",
    ]);
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let line = text.lines().find(|line| line.contains("InstallLocation"))?;
    let value = line.split("REG_SZ").nth(1)?.trim().trim_matches('"').trim();
    if value.is_empty() {
        None
    } else {
        Some(PathBuf::from(value))
    }
}

#[tauri::command]
pub fn open_update_url(app: AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}
