use serde::{Deserialize, Serialize};
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use which::which;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub winget_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress {
    pub runtime_id: String,
    pub percent: u32,
    pub stage: String,
    pub message: String,
}

pub fn find_executable(candidates: &[&str]) -> Option<PathBuf> {
    for name in candidates {
        if let Ok(path) = which(name) {
            if !is_windows_apps_stub(&path) {
                return Some(path);
            }
        }
    }
    None
}

fn is_windows_apps_stub(path: &Path) -> bool {
    path.to_string_lossy()
        .to_lowercase()
        .contains("\\windowsapps\\")
}

fn apply_no_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

/// Recharge le PATH Windows (Machine + User) après install/uninstall winget.
fn refresh_process_path() {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("powershell");
        cmd.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
        apply_no_window(&mut cmd);
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    std::env::set_var("PATH", path);
                }
            }
        }
    }
}

fn probe_version(program: &Path, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(program);
    cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    apply_no_window(&mut cmd);
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let line = text.lines().next()?.trim();
    if line.is_empty() {
        None
    } else {
        Some(line.to_string())
    }
}

pub fn resolve_python_path() -> Option<PathBuf> {
    if let Ok(py) = which("py") {
        if !is_windows_apps_stub(&py) {
            let mut cmd = Command::new(&py);
            cmd.args(["-3", "-c", "import sys; print(sys.executable)"]);
            apply_no_window(&mut cmd);
            if let Ok(output) = cmd.output() {
                if output.status.success() {
                    let exe = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    let path = PathBuf::from(&exe);
                    if path.exists() && !is_windows_apps_stub(&path) {
                        return Some(path);
                    }
                }
            }
        }
    }

    for name in ["python", "python3"] {
        if let Ok(path) = which(name) {
            if is_windows_apps_stub(&path) {
                continue;
            }
            if probe_version(&path, &["-c", "import sys; print(sys.version.split()[0])"]).is_some() {
                return Some(path);
            }
        }
    }

    None
}

#[tauri::command]
pub async fn detect_runtimes() -> Result<Vec<RuntimeStatus>, String> {
    tauri::async_runtime::spawn_blocking(|| detect_runtimes_sync())
        .await
        .map_err(|e| e.to_string())?
}

pub(crate) fn detect_runtimes_sync() -> Result<Vec<RuntimeStatus>, String> {
    refresh_process_path();
    let mut statuses = Vec::new();

    let python = resolve_python_path();
    let python_version = python
        .as_ref()
        .and_then(|p| probe_version(p, &["-c", "import sys; print(sys.version.split()[0])"]));
    statuses.push(RuntimeStatus {
        id: "python".into(),
        name: "Python".into(),
        installed: python.is_some(),
        version: python_version,
        path: python.map(|p| p.display().to_string()),
        winget_id: "Python.Python.3.12".into(),
    });

    let dotnet = find_executable(&["dotnet"]);
    let dotnet_version = dotnet
        .as_ref()
        .and_then(|p| probe_version(p, &["--version"]));
    statuses.push(RuntimeStatus {
        id: "dotnet".into(),
        name: ".NET SDK".into(),
        installed: dotnet.is_some(),
        version: dotnet_version,
        path: dotnet.map(|p| p.display().to_string()),
        winget_id: "Microsoft.DotNet.SDK.8".into(),
    });

    let cpp = find_executable(&["g++", "clang++"]);
    let cpp_version = cpp.as_ref().and_then(|p| probe_version(p, &["--version"]));
    statuses.push(RuntimeStatus {
        id: "cpp".into(),
        name: "Compilateur C++".into(),
        installed: cpp.is_some(),
        version: cpp_version,
        path: cpp.map(|p| p.display().to_string()),
        winget_id: "MartinStorsjo.LLVM-MinGW.UCRT".into(),
    });

    let javac = find_executable(&["javac"]);
    let java = find_executable(&["java"]);
    let jdk_ok = javac.is_some() && java.is_some();
    let java_version = if jdk_ok {
        javac
            .as_ref()
            .and_then(|p| probe_version(p, &["-version"]))
            .or_else(|| java.as_ref().and_then(|p| probe_version(p, &["-version"])))
    } else {
        None
    };
    statuses.push(RuntimeStatus {
        id: "java".into(),
        name: "JDK (Java)".into(),
        installed: jdk_ok,
        version: java_version,
        path: javac.map(|p| p.display().to_string()),
        winget_id: "EclipseAdoptium.Temurin.17.JDK".into(),
    });

    Ok(statuses)
}

fn resolve_winget_program() -> PathBuf {
    #[cfg(windows)]
    {
        let root = PathBuf::from(r"C:\Program Files\WindowsApps");
        if let Ok(entries) = std::fs::read_dir(&root) {
            let mut found = Vec::new();
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_lowercase();
                if name.starts_with("microsoft.desktopappinstaller_") {
                    let exe = entry.path().join("winget.exe");
                    if exe.is_file() {
                        found.push(exe);
                    }
                }
            }
            found.sort();
            if let Some(path) = found.pop() {
                return path;
            }
        }
    }
    if let Some(path) = find_executable(&["winget"]) {
        return path;
    }
    if let Ok(path) = which("winget") {
        return path;
    }
    PathBuf::from("winget")
}

pub(crate) fn winget_location() -> String {
    resolve_winget_program().display().to_string()
}

fn winget_available() -> bool {
    let program = resolve_winget_program();
    if program.as_os_str() == "winget" {
        return which("winget").is_ok();
    }
    program.is_file() || which("winget").is_ok()
}

fn emit_progress(app: &AppHandle, progress: InstallProgress) {
    let _ = app.emit("runtime-install-progress", progress);
}

fn parse_percent(line: &str) -> Option<u32> {
    if let Some(idx) = line.find('%') {
        let before = &line[..idx];
        let digits: String = before
            .chars()
            .rev()
            .take_while(|c| c.is_ascii_digit())
            .collect::<String>()
            .chars()
            .rev()
            .collect();
        if let Ok(n) = digits.parse::<u32>() {
            if n <= 100 {
                return Some(n);
            }
        }
    }
    None
}

fn infer_stage(line: &str) -> Option<&'static str> {
    let lower = line.to_lowercase();
    if lower.contains("download") || lower.contains("télécharg") || lower.contains("telecharg") {
        Some("download")
    } else if lower.contains("install") || lower.contains("extraction") || lower.contains("extract")
    {
        Some("install")
    } else if lower.contains("vérif") || lower.contains("verif") || lower.contains("hash") {
        Some("verify")
    } else if lower.contains("trouvé") || lower.contains("found") {
        Some("resolve")
    } else {
        None
    }
}

fn map_stage_percent(stage: &str, raw: Option<u32>, floor: u32) -> u32 {
    let mapped = match (stage, raw) {
        ("download", Some(p)) => 15 + (p * 40 / 100),
        ("verify", Some(p)) => 55 + (p * 15 / 100),
        ("install", Some(p)) => 70 + (p * 25 / 100),
        ("resolve", _) => 8,
        ("download", None) => 25,
        ("verify", None) => 60,
        ("install", None) => 80,
        ("done", _) => 100,
        (_, Some(p)) => p,
        _ => floor,
    };
    mapped.max(floor).min(99)
}

fn handle_output_chunk(
    app: &AppHandle,
    runtime_id: &str,
    chunk: &str,
    log: &Mutex<String>,
    last_percent: &Mutex<u32>,
    stage: &Mutex<String>,
) {
    for part in chunk.split(['\r', '\n']) {
        let cleaned = part.trim();
        if cleaned.is_empty() {
            continue;
        }
        if let Ok(mut buf) = log.lock() {
            buf.push_str(cleaned);
            buf.push('\n');
        }
        if let Some(s) = infer_stage(cleaned) {
            if let Ok(mut st) = stage.lock() {
                *st = s.to_string();
            }
        }
        let current_stage = stage
            .lock()
            .map(|s| s.clone())
            .unwrap_or_else(|_| "install".into());
        let floor = *last_percent.lock().unwrap_or_else(|e| e.into_inner());
        let mut pct = map_stage_percent(&current_stage, parse_percent(cleaned), floor);
        if let Ok(mut last) = last_percent.lock() {
            if pct < *last {
                pct = *last;
            } else {
                *last = pct;
            }
        }
        emit_progress(
            app,
            InstallProgress {
                runtime_id: runtime_id.to_string(),
                percent: pct,
                stage: current_stage,
                message: cleaned.chars().take(160).collect(),
            },
        );
    }
}

#[tauri::command]
pub async fn install_runtime(app: AppHandle, runtime_id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || install_runtime_sync(app, runtime_id))
        .await
        .map_err(|e| e.to_string())?
}

fn run_winget_with_progress(
    app: &AppHandle,
    runtime_id: &str,
    runtime_name: &str,
    args: &[&str],
    start_message: &str,
) -> Result<(bool, String), String> {
    emit_progress(
        app,
        InstallProgress {
            runtime_id: runtime_id.to_string(),
            percent: 3,
            stage: "resolve".into(),
            message: start_message.to_string(),
        },
    );

    let program = resolve_winget_program();
    let mut cmd = Command::new(&program);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_no_window(&mut cmd);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Échec du lancement de winget : {e}"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let log = Arc::new(Mutex::new(String::new()));
    let last_percent = Arc::new(Mutex::new(3u32));
    let stage = Arc::new(Mutex::new("resolve".to_string()));

    fn spawn_reader<R: Read + Send + 'static>(
        stream: R,
        app: AppHandle,
        runtime_id: String,
        log: Arc<Mutex<String>>,
        last_percent: Arc<Mutex<u32>>,
        stage: Arc<Mutex<String>>,
    ) -> thread::JoinHandle<()> {
        thread::spawn(move || {
            let mut reader = BufReader::new(stream);
            let mut buf = Vec::new();
            loop {
                let mut byte = [0u8; 1];
                match reader.read(&mut byte) {
                    Ok(0) => break,
                    Ok(_) => {
                        if byte[0] == b'\n' || byte[0] == b'\r' {
                            if !buf.is_empty() {
                                let chunk = String::from_utf8_lossy(&buf).to_string();
                                handle_output_chunk(
                                    &app,
                                    &runtime_id,
                                    &chunk,
                                    &log,
                                    &last_percent,
                                    &stage,
                                );
                                buf.clear();
                            }
                        } else {
                            buf.push(byte[0]);
                            if byte[0] == b'%' {
                                let chunk = String::from_utf8_lossy(&buf).to_string();
                                handle_output_chunk(
                                    &app,
                                    &runtime_id,
                                    &chunk,
                                    &log,
                                    &last_percent,
                                    &stage,
                                );
                            }
                        }
                    }
                    Err(_) => break,
                }
            }
            if !buf.is_empty() {
                let chunk = String::from_utf8_lossy(&buf).to_string();
                handle_output_chunk(&app, &runtime_id, &chunk, &log, &last_percent, &stage);
            }
        })
    }

    let mut readers = Vec::new();
    if let Some(out) = stdout {
        readers.push(spawn_reader(
            out,
            app.clone(),
            runtime_id.to_string(),
            Arc::clone(&log),
            Arc::clone(&last_percent),
            Arc::clone(&stage),
        ));
    }
    if let Some(err) = stderr {
        readers.push(spawn_reader(
            err,
            app.clone(),
            runtime_id.to_string(),
            Arc::clone(&log),
            Arc::clone(&last_percent),
            Arc::clone(&stage),
        ));
    }

    let app_hb = app.clone();
    let rid_hb = runtime_id.to_string();
    let name_hb = runtime_name.to_string();
    let last_hb = Arc::clone(&last_percent);
    let stop_hb = Arc::new(Mutex::new(false));
    let stop_hb2 = Arc::clone(&stop_hb);
    let hb = thread::spawn(move || {
        while !*stop_hb2.lock().unwrap_or_else(|e| e.into_inner()) {
            thread::sleep(std::time::Duration::from_millis(900));
            let mut last = last_hb.lock().unwrap_or_else(|e| e.into_inner());
            if *last > 0 && *last < 95 {
                *last = (*last + 1).min(95);
                emit_progress(
                    &app_hb,
                    InstallProgress {
                        runtime_id: rid_hb.clone(),
                        percent: *last,
                        stage: "install".into(),
                        message: format!("{name_hb}…"),
                    },
                );
            }
        }
    });

    let status = child
        .wait()
        .map_err(|e| format!("winget s'est arrêté de façon inattendue : {e}"))?;
    *stop_hb.lock().unwrap_or_else(|e| e.into_inner()) = true;
    let _ = hb.join();
    for t in readers {
        let _ = t.join();
    }

    let combined = log.lock().map(|s| s.clone()).unwrap_or_default();
    Ok((status.success(), combined))
}

fn install_runtime_sync(app: AppHandle, runtime_id: String) -> Result<String, String> {
    if !winget_available() {
        return Err(
            "winget n'est pas disponible sur cette machine. Installez les runtimes manuellement (voir la documentation)."
                .to_string(),
        );
    }

    let statuses = detect_runtimes_sync()?;
    let runtime = statuses
        .into_iter()
        .find(|r| r.id == runtime_id)
        .ok_or_else(|| format!("Runtime inconnu : {runtime_id}"))?;

    if runtime.installed {
        emit_progress(
            &app,
            InstallProgress {
                runtime_id: runtime.id.clone(),
                percent: 100,
                stage: "done".into(),
                message: format!("{} est déjà installé.", runtime.name),
            },
        );
        return Ok(format!("{} est déjà installé.", runtime.name));
    }

    let args = [
        "install",
        "--id",
        runtime.winget_id.as_str(),
        "-e",
        "--source",
        "winget",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--disable-interactivity",
        "--silent",
    ];
    let (ok, combined) = run_winget_with_progress(
        &app,
        &runtime.id,
        &runtime.name,
        &args,
        &format!("Préparation de l'installation de {}…", runtime.name),
    )?;

    refresh_process_path();

    if ok {
        emit_progress(
            &app,
            InstallProgress {
                runtime_id: runtime.id.clone(),
                percent: 100,
                stage: "done".into(),
                message: format!("{} installé.", runtime.name),
            },
        );
        Ok(format!("{} a été installé.", runtime.name))
    } else if combined.to_lowercase().contains("msstore")
        || combined.contains("région géographique")
        || combined.contains("geographic region")
    {
        Err(format!(
            "Installation de {} bloquée par la source Microsoft Store.\n\
Ouvrez PowerShell et exécutez :\n\
  winget install --id {} -e --source winget --accept-package-agreements --accept-source-agreements\n\n\
{}",
            runtime.name,
            runtime.winget_id,
            combined.trim()
        ))
    } else {
        Err(format!(
            "Installation de {} échouée.\n{}",
            runtime.name,
            combined.trim()
        ))
    }
}

fn uninstall_runtime_sync(app: AppHandle, runtime_id: String) -> Result<String, String> {
    if !winget_available() {
        return Err("winget n'est pas disponible sur cette machine.".into());
    }

    let statuses = detect_runtimes_sync()?;
    let runtime = statuses
        .into_iter()
        .find(|r| r.id == runtime_id)
        .ok_or_else(|| format!("Runtime inconnu : {runtime_id}"))?;

    if !runtime.installed {
        return Ok(format!("{} n'est pas installé.", runtime.name));
    }

    let base = [
        "uninstall",
        "--id",
        runtime.winget_id.as_str(),
        "-e",
        "--silent",
        "--disable-interactivity",
        "--accept-source-agreements",
    ];
    let mut machine = base.to_vec();
    machine.extend(["--scope", "machine"]);
    let mut user_scope = base.to_vec();
    user_scope.extend(["--scope", "user"]);
    let attempts: Vec<Vec<&str>> = if crate::diag::is_elevated() {
        vec![machine, user_scope, base.to_vec()]
    } else {
        vec![base.to_vec(), user_scope, machine]
    };

    let mut last = String::new();
    for (index, args) in attempts.iter().enumerate() {
        let (ok, combined) = run_winget_with_progress(
            &app,
            &runtime.id,
            &runtime.name,
            args,
            &format!("Désinstallation de {}…", runtime.name),
        )?;
        if ok {
            refresh_process_path();
            emit_progress(
                &app,
                InstallProgress {
                    runtime_id: runtime.id.clone(),
                    percent: 100,
                    stage: "done".into(),
                    message: format!("{} désinstallé.", runtime.name),
                },
            );
            return Ok(format!("{} a été désinstallé.", runtime.name));
        }
        last = combined;
        let retry = index + 1 < attempts.len() && winget_scope_mismatch(&last);
        if !retry {
            break;
        }
    }

    refresh_process_path();
    let message = format!(
        "Désinstallation de {} échouée.\n{}",
        runtime.name,
        last.trim()
    );
    crate::diag::push(&message);
    Err(message)
}

fn winget_scope_mismatch(text: &str) -> bool {
    let lower = text.to_lowercase();
    lower.contains("no installed package")
        || lower.contains("aucun package")
        || lower.contains("no package found")
        || lower.contains("administrateur")
        || lower.contains("administrator")
        || lower.contains("accès refusé")
        || lower.contains("access is denied")
        || lower.contains("elevation")
}

#[tauri::command]
pub async fn uninstall_runtime(app: AppHandle, runtime_id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || uninstall_runtime_sync(app, runtime_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn verify_runtime(runtime_id: String) -> Result<RuntimeStatus, String> {
    let id = runtime_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        detect_runtimes_sync()?
            .into_iter()
            .find(|r| r.id == id)
            .ok_or_else(|| format!("Runtime inconnu : {runtime_id}"))
    })
    .await
    .map_err(|e| e.to_string())?
}
