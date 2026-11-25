use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

use crate::deps;
use crate::paths;

const DEFAULT_TIMEOUT_SECS: u64 = 10;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteRequest {
    pub language: String,
    pub code: String,
    pub file_name: Option<String>,
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub timed_out: bool,
    pub compile_output: Option<String>,
}

fn clean_dir(dir: &Path) -> Result<(), String> {
    if dir.exists() {
        fs::remove_dir_all(dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    Ok(())
}

fn write_file(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = fs::File::create(path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn run_command(
    program: &str,
    args: &[&str],
    cwd: &Path,
    timeout: Duration,
) -> Result<(bool, String, String, Option<i32>, bool), String> {
    use std::io::Read;

    let mut cmd = Command::new(program);
    cmd.args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1")
        .env("PYTHONUNBUFFERED", "1");

    // Empêche l'ouverture d'une fenêtre console Windows (cmd qui clignote).
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Impossible de démarrer « {program} » : {e}"))?;

    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();

    match child.wait_timeout(timeout).map_err(|e| e.to_string())? {
        Some(status) => {
            let mut stdout = String::new();
            let mut stderr = String::new();
            if let Some(ref mut out) = stdout_pipe {
                out.read_to_string(&mut stdout).ok();
            }
            if let Some(ref mut err) = stderr_pipe {
                err.read_to_string(&mut stderr).ok();
            }
            Ok((status.success(), stdout, stderr, status.code(), false))
        }
        None => {
            let _ = child.kill();
            let _ = child.wait();
            Ok((
                false,
                String::new(),
                "Délai d'exécution dépassé. Le programme a été arrêté.".to_string(),
                None,
                true,
            ))
        }
    }
}

fn resolve_python() -> Result<PathBuf, String> {
    deps::resolve_python_path().ok_or_else(|| {
        "Python n'est pas disponible (ou seul l'alias Microsoft Store est détecté). Installez Python depuis python.org ou via Environnements, puis redémarrez CodeFlow.".to_string()
    })
}

fn resolve_dotnet() -> Result<PathBuf, String> {
    deps::find_executable(&["dotnet"]).ok_or_else(|| {
        ".NET SDK n'est pas disponible. Ouvrez Paramètres → Environnements pour l'installer."
            .to_string()
    })
}

fn resolve_cpp() -> Result<PathBuf, String> {
    deps::find_executable(&["g++", "clang++"]).ok_or_else(|| {
        "Aucun compilateur C++ (g++ / clang++) n'est disponible. Ouvrez Paramètres → Environnements."
            .to_string()
    })
}

fn resolve_javac() -> Result<PathBuf, String> {
    deps::find_executable(&["javac"]).ok_or_else(|| {
        "Le JDK (javac) n'est pas disponible. Ouvrez Paramètres → Environnements pour l'installer."
            .to_string()
    })
}

fn resolve_java() -> Result<PathBuf, String> {
    deps::find_executable(&["java"]).ok_or_else(|| {
        "Java n'est pas disponible. Ouvrez Paramètres → Environnements pour l'installer."
            .to_string()
    })
}

fn execute_python(dir: &Path, code: &str, timeout: Duration) -> Result<ExecuteResult, String> {
    let python = resolve_python()?;
    let file = dir.join("main.py");
    write_file(&file, code)?;
    let python_bin = python.to_str().unwrap_or("python");
    let (ok, stdout, stderr, code_exit, timed_out) =
        run_command(python_bin, &["-u", "main.py"], dir, timeout)?;

    let mut stderr = stderr;
    if !ok && stderr.trim().is_empty() && stdout.trim().is_empty() {
        stderr = format!(
            "Exécution Python sans sortie (code {}).\nInterpréteur : {}\nVérifiez qu'un vrai Python est installé (pas l'alias Microsoft Store).",
            code_exit
                .map(|c| c.to_string())
                .unwrap_or_else(|| "?".into()),
            python.display()
        );
    }

    Ok(ExecuteResult {
        success: ok && !timed_out,
        stdout,
        stderr,
        exit_code: code_exit,
        timed_out,
        compile_output: None,
    })
}

fn execute_csharp(dir: &Path, code: &str, timeout: Duration) -> Result<ExecuteResult, String> {
    let dotnet = resolve_dotnet()?;
    let dotnet_bin = dotnet.to_str().unwrap_or("dotnet");

    let (ok_new, _, err_new, _, _) = run_command(
        dotnet_bin,
        &["new", "console", "-n", "App", "-o", ".", "--force"],
        dir,
        Duration::from_secs(60),
    )?;
    if !ok_new {
        return Ok(ExecuteResult {
            success: false,
            stdout: String::new(),
            stderr: format!("Échec de la création du projet .NET : {err_new}"),
            exit_code: None,
            timed_out: false,
            compile_output: Some(err_new),
        });
    }

    write_file(&dir.join("Program.cs"), code)?;

    let (ok_run, stdout, stderr, exit_code, timed_out) =
        run_command(dotnet_bin, &["run", "--nologo", "-v", "q"], dir, timeout)?;

    Ok(ExecuteResult {
        success: ok_run && !timed_out,
        stdout,
        stderr: stderr.clone(),
        exit_code,
        timed_out,
        compile_output: if ok_run { None } else { Some(stderr) },
    })
}

fn execute_cpp(dir: &Path, code: &str, timeout: Duration) -> Result<ExecuteResult, String> {
    let compiler = resolve_cpp()?;
    let source = dir.join("main.cpp");
    write_file(&source, code)?;
    let out = dir.join("out.exe");
    let compiler_bin = compiler.to_str().unwrap_or("g++");

    let (ok_compile, _, err_compile, _, timed_compile) = run_command(
        compiler_bin,
        &[
            "-O0",
            "-std=c++14",
            "main.cpp",
            "-o",
            out.file_name().and_then(|s| s.to_str()).unwrap_or("out.exe"),
        ],
        dir,
        Duration::from_secs(30),
    )?;

    if timed_compile || !ok_compile {
        return Ok(ExecuteResult {
            success: false,
            stdout: String::new(),
            stderr: err_compile.clone(),
            exit_code: None,
            timed_out: timed_compile,
            compile_output: Some(err_compile),
        });
    }

    let (ok, stdout, stderr, exit_code, timed_out) =
        run_command(out.to_str().unwrap_or("out.exe"), &[], dir, timeout)?;

    Ok(ExecuteResult {
        success: ok && !timed_out,
        stdout,
        stderr,
        exit_code,
        timed_out,
        compile_output: None,
    })
}

fn extract_java_public_class(code: &str) -> Option<String> {
    let marker = "public class ";
    let idx = code.find(marker)?;
    let rest = &code[idx + marker.len()..];
    let name: String = rest
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
        .collect();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

fn execute_java(
    dir: &Path,
    code: &str,
    file_name: Option<&str>,
    timeout: Duration,
) -> Result<ExecuteResult, String> {
    let javac = resolve_javac()?;
    let java = resolve_java()?;
    let class_name = extract_java_public_class(code).unwrap_or_else(|| "Main".to_string());
    let source_name = file_name
        .map(|f| f.to_string())
        .unwrap_or_else(|| format!("{class_name}.java"));
    let source = dir.join(&source_name);
    write_file(&source, code)?;

    let javac_bin = javac.to_str().unwrap_or("javac");
    let (ok_compile, _, err_compile, _, timed_compile) = run_command(
        javac_bin,
        &[&source_name],
        dir,
        Duration::from_secs(30),
    )?;

    if timed_compile || !ok_compile {
        return Ok(ExecuteResult {
            success: false,
            stdout: String::new(),
            stderr: err_compile.clone(),
            exit_code: None,
            timed_out: timed_compile,
            compile_output: Some(err_compile),
        });
    }

    let java_bin = java.to_str().unwrap_or("java");
    let (ok, stdout, stderr, exit_code, timed_out) =
        run_command(java_bin, &[&class_name], dir, timeout)?;

    Ok(ExecuteResult {
        success: ok && !timed_out,
        stdout,
        stderr,
        exit_code,
        timed_out,
        compile_output: None,
    })
}

#[tauri::command]
pub async fn execute_code(request: ExecuteRequest) -> Result<ExecuteResult, String> {
    match tauri::async_runtime::spawn_blocking(move || execute_code_sync(request)).await {
        Ok(Ok(result)) => Ok(result),
        Ok(Err(error)) => {
            crate::diag::push(&error);
            Err(error)
        }
        Err(error) => {
            let message = error.to_string();
            crate::diag::push(&message);
            Err(message)
        }
    }
}

fn execute_code_sync(request: ExecuteRequest) -> Result<ExecuteResult, String> {
    let run_id = uuid::Uuid::new_v4().to_string();
    let dir = paths::sandbox_dir()?.join(&run_id);
    clean_dir(&dir)?;

    let timeout = Duration::from_secs(request.timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS));
    let language = request.language.to_lowercase();

    let result = match language.as_str() {
        "python" => execute_python(&dir, &request.code, timeout),
        "csharp" | "c#" => execute_csharp(&dir, &request.code, timeout),
        "cpp" | "c++" => execute_cpp(&dir, &request.code, timeout),
        "java" => execute_java(
            &dir,
            &request.code,
            request.file_name.as_deref(),
            timeout,
        ),
        _ => Err(format!("Langage non pris en charge : {}", request.language)),
    };

    let _ = fs::remove_dir_all(&dir);
    result
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceVar {
    pub name: String,
    pub type_name: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceEvent {
    pub line: u32,
    pub event: String,
    pub function: String,
    pub locals: Vec<TraceVar>,
    pub returned: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
    pub limited: bool,
    pub limitation: Option<String>,
    pub events: Vec<TraceEvent>,
}

#[derive(Debug, Deserialize)]
struct PyVar {
    name: String,
    #[serde(rename = "type")]
    type_name: String,
    value: String,
}

#[derive(Debug, Deserialize)]
struct PyEvent {
    line: u32,
    event: String,
    function: String,
    locals: Vec<PyVar>,
    returned: Option<String>,
}

const PY_TRACER: &str = r#"import json, sys
src = open("main.py", encoding="utf-8").read()
events = []

def snap(frame):
    out = []
    for k, v in list(frame.f_locals.items())[:24]:
        if str(k).startswith("__"):
            continue
        try:
            out.append({"name": str(k), "type": type(v).__name__, "value": repr(v)[:160]})
        except Exception:
            out.append({"name": str(k), "type": "?", "value": "?"})
    return out

def tracer(frame, event, arg):
    filename = frame.f_code.co_filename.replace("\\", "/")
    if filename.endswith("main.py") and event in ("line", "call", "return") and len(events) < 500:
        events.append({
            "line": frame.f_lineno,
            "event": event,
            "function": frame.f_code.co_name,
            "locals": [] if event == "call" else snap(frame),
            "returned": None if event != "return" else repr(arg)[:160],
        })
    return tracer

sys.settrace(tracer)
namespace = {"__name__": "__main__"}
try:
    exec(compile(src, "main.py", "exec"), namespace, namespace)
except SystemExit:
    pass
except Exception as exc:
    sys.stderr.write("%s: %s\n" % (type(exc).__name__, exc))
finally:
    sys.settrace(None)
    with open("trace.json", "w", encoding="utf-8") as handle:
        json.dump(events, handle, ensure_ascii=False)
"#;

fn trace_python(dir: &Path, code: &str, timeout: Duration) -> Result<TraceResult, String> {
    let python = resolve_python()?;
    write_file(&dir.join("main.py"), code)?;
    write_file(&dir.join("cf_trace.py"), PY_TRACER)?;
    let python_bin = python.to_str().unwrap_or("python");
    let (ok, stdout, stderr, _, timed_out) =
        run_command(python_bin, &["-u", "cf_trace.py"], dir, timeout)?;
    let raw = fs::read_to_string(dir.join("trace.json")).unwrap_or_else(|_| "[]".into());
    let parsed: Vec<PyEvent> = serde_json::from_str(&raw).unwrap_or_default();
    let events = parsed
        .into_iter()
        .filter(|event| event.line > 0)
        .map(|event| TraceEvent {
            line: event.line,
            event: event.event,
            function: event.function,
            locals: event
                .locals
                .into_iter()
                .map(|var| TraceVar {
                    name: var.name,
                    type_name: var.type_name,
                    value: var.value,
                })
                .collect(),
            returned: event.returned,
        })
        .collect();
    Ok(TraceResult {
        success: ok && !timed_out,
        stdout,
        stderr,
        timed_out,
        limited: false,
        limitation: None,
        events,
    })
}

fn should_trace_line(trimmed: &str) -> bool {
    if trimmed.is_empty()
        || trimmed.starts_with("//")
        || trimmed.starts_with('#')
        || trimmed.starts_with("/*")
        || trimmed.starts_with('*')
        || trimmed == "{"
        || trimmed == "}"
        || trimmed == "};"
    {
        return false;
    }
    let skip = trimmed.starts_with("if ")
        || trimmed.starts_with("if(")
        || trimmed.starts_with("for ")
        || trimmed.starts_with("for(")
        || trimmed.starts_with("while ")
        || trimmed.starts_with("while(")
        || trimmed.starts_with("switch")
        || trimmed.starts_with("else")
        || trimmed.starts_with("do ")
        || trimmed.starts_with("do{")
        || trimmed.starts_with("case ")
        || trimmed.starts_with("default")
        || trimmed.starts_with("using ")
        || trimmed.starts_with("import ")
        || trimmed.starts_with("package ")
        || trimmed.starts_with("namespace ")
        || trimmed.starts_with("class ")
        || trimmed.starts_with("public ")
        || trimmed.starts_with("private ")
        || trimmed.starts_with("protected ")
        || trimmed.starts_with("#include")
        || trimmed.starts_with("template");
    if skip {
        return false;
    }
    trimmed.contains(';')
}

fn instrument_calls(code: &str, call_name: &str) -> String {
    let mut out = String::new();
    for (index, line) in code.lines().enumerate() {
        let trimmed = line.trim();
        if should_trace_line(trimmed) {
            let indent_len = line.find(|c: char| !c.is_whitespace()).unwrap_or(0);
            let indent = &line[..indent_len];
            out.push_str(indent);
            out.push_str(call_name);
            out.push('(');
            out.push_str(&(index as u32 + 1).to_string());
            out.push_str(");\n");
        }
        out.push_str(line);
        out.push('\n');
    }
    out
}

fn instrument_compiled(language: &str, code: &str) -> Result<String, String> {
    match language {
        "csharp" | "c#" => {
            if code.contains("namespace ") || code.contains("class ") {
                return Err(
                    "Le pas à pas de C# couvre les programmes en instructions de premier niveau. Un fichier déjà rangé dans une classe n'est pas instrumenté ici.".to_string(),
                );
            }
            let body = instrument_calls(code, "CfTrace");
            Ok(format!(
                "void CfTrace(int line) {{ System.Console.Error.WriteLine(\"CFSTEP \" + line); }}\n{body}"
            ))
        }
        "cpp" | "c++" => {
            let body = instrument_calls(code, "cfTrace");
            Ok(format!(
                "#include <stdio.h>\nstatic void cfTrace(int line) {{ fprintf(stderr, \"CFSTEP %d\\n\", line); }}\n{body}"
            ))
        }
        "java" => {
            if !code.contains("class ") {
                return Err(
                    "Le pas à pas Java demande une classe avec une méthode main. Ce programme ne peut pas être instrumenté.".to_string(),
                );
            }
            let body = instrument_calls(code, "cfTrace");
            let needle = body.rfind('}').ok_or_else(|| {
                "Le pas à pas Java n'a pas trouvé la fin de la classe.".to_string()
            })?;
            let method = "static void cfTrace(int line) { System.err.println(\"CFSTEP \" + line); }\n";
            let mut owned = body;
            owned.insert_str(needle, method);
            Ok(owned)
        }
        _ => Err(format!("Pas à pas non disponible pour {language}.")),
    }
}

fn split_steps(stderr: &str) -> (String, Vec<TraceEvent>) {
    let mut clean = String::new();
    let mut events = Vec::new();
    for line in stderr.lines() {
        if let Some(rest) = line.trim().strip_prefix("CFSTEP ") {
            if let Ok(number) = rest.trim().parse::<u32>() {
                events.push(TraceEvent {
                    line: number,
                    event: "line".into(),
                    function: String::new(),
                    locals: Vec::new(),
                    returned: None,
                });
                continue;
            }
        }
        clean.push_str(line);
        clean.push('\n');
    }
    (clean, events)
}

fn limitation_result(message: String) -> TraceResult {
    TraceResult {
        success: false,
        stdout: String::new(),
        stderr: message.clone(),
        timed_out: false,
        limited: true,
        limitation: Some(message),
        events: Vec::new(),
    }
}

fn trace_compiled(
    language: &str,
    dir: &Path,
    code: &str,
    file_name: Option<&str>,
    timeout: Duration,
) -> Result<TraceResult, String> {
    let instrumented = match instrument_compiled(language, code) {
        Ok(value) => value,
        Err(message) => return Ok(limitation_result(message)),
    };
    let ran = match language {
        "csharp" | "c#" => execute_csharp(dir, &instrumented, timeout)?,
        "cpp" | "c++" => execute_cpp(dir, &instrumented, timeout)?,
        "java" => execute_java(dir, &instrumented, file_name, timeout)?,
        _ => return Ok(limitation_result(format!("Pas à pas non disponible pour {language}."))),
    };
    if ran.compile_output.is_some() && !ran.success && ran.stdout.trim().is_empty() {
        return Ok(TraceResult {
            success: false,
            stdout: ran.stdout,
            stderr: ran.stderr.clone(),
            timed_out: ran.timed_out,
            limited: true,
            limitation: Some(
                "L'instrumentation du pas à pas n'a pas compilé. Les variables des langages compilés ne sont pas exposées, et ce programme ne peut pas être suivi ligne à ligne sans changer son sens. Exécutez-le normalement. Python reste le traceur complet.".to_string(),
            ),
            events: Vec::new(),
        });
    }
    let (stderr, events) = split_steps(&ran.stderr);
    let limited = events.is_empty();
    Ok(TraceResult {
        success: ran.success,
        stdout: ran.stdout,
        stderr,
        timed_out: ran.timed_out,
        limited,
        limitation: if limited {
            Some(
                "Aucune ligne n'a pu être suivie. Le pas à pas détaillé des variables est réservé à Python. Ici, seules des instructions simples (finissant par un point-virgule) sont enregistrées.".to_string(),
            )
        } else {
            Some(
                "Pas à pas partiel : les lignes exécutées sont réelles, mais les variables ne sont pas lues. Python affiche aussi les valeurs.".to_string(),
            )
        },
        events,
    })
}

#[tauri::command]
pub async fn trace_code(request: ExecuteRequest) -> Result<TraceResult, String> {
    match tauri::async_runtime::spawn_blocking(move || trace_code_sync(request)).await {
        Ok(Ok(result)) => Ok(result),
        Ok(Err(error)) => {
            crate::diag::push(&error);
            Err(error)
        }
        Err(error) => {
            let message = error.to_string();
            crate::diag::push(&message);
            Err(message)
        }
    }
}

fn trace_code_sync(request: ExecuteRequest) -> Result<TraceResult, String> {
    let run_id = uuid::Uuid::new_v4().to_string();
    let dir = paths::sandbox_dir()?.join(format!("trace-{run_id}"));
    clean_dir(&dir)?;
    let timeout = Duration::from_secs(request.timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS).clamp(5, 20));
    let language = request.language.to_lowercase();
    let result = match language.as_str() {
        "python" => trace_python(&dir, &request.code, timeout),
        "csharp" | "c#" | "cpp" | "c++" | "java" => trace_compiled(
            language.as_str(),
            &dir,
            &request.code,
            request.file_name.as_deref(),
            timeout,
        ),
        _ => Ok(limitation_result(format!(
            "Pas à pas non disponible pour {}.",
            request.language
        ))),
    };
    let _ = fs::remove_dir_all(&dir);
    result
}
