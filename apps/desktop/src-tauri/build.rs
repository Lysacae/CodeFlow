fn main() {
    inject_supabase_secret();

    let windows = tauri_build::WindowsAttributes::new()
        .app_manifest(include_str!("windows/app.manifest"));
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("failed to run tauri build script");
}

/// Embeds `CODEFLOW_SUPABASE_SECRET` for `cloud.rs`.
/// The value comes from the build environment, or from `SUPABASE_SECRET_KEY`
/// in `apps/server/.env` (gitignored). Release builds fail when it is missing.
fn inject_supabase_secret() {
    println!("cargo:rerun-if-env-changed=CODEFLOW_SUPABASE_SECRET");
    let manifest = std::path::PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".into()),
    );
    let env_path = manifest.join("../../server/.env");
    if env_path.exists() {
        println!("cargo:rerun-if-changed={}", env_path.display());
    }

    let secret = load_supabase_secret(&env_path);
    let release = std::env::var("PROFILE").ok().as_deref() == Some("release");
    if release && secret.is_empty() {
        panic!(
            "CODEFLOW_SUPABASE_SECRET is required for release builds. \
             Export CODEFLOW_SUPABASE_SECRET or set SUPABASE_SECRET_KEY in apps/server/.env. \
             Do not commit the key."
        );
    }
    if secret.is_empty() {
        println!(
            "cargo:warning=CODEFLOW_SUPABASE_SECRET is empty; cloud calls will fail until the key is provided at build time."
        );
    }
    println!("cargo:rustc-env=CODEFLOW_SUPABASE_SECRET={secret}");
}

fn load_supabase_secret(env_path: &std::path::Path) -> String {
    if let Some(value) = usable_secret(std::env::var("CODEFLOW_SUPABASE_SECRET").ok()) {
        return value;
    }
    let Ok(text) = std::fs::read_to_string(env_path) else {
        return String::new();
    };

    let mut from_file = String::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        match key.trim() {
            "CODEFLOW_SUPABASE_SECRET" => {
                if let Some(value) = usable_secret(Some(value.to_string())) {
                    return value;
                }
            }
            "SUPABASE_SECRET_KEY" if from_file.is_empty() => {
                if let Some(value) = usable_secret(Some(value.to_string())) {
                    from_file = value;
                }
            }
            _ => {}
        }
    }
    from_file
}

fn usable_secret(value: Option<String>) -> Option<String> {
    let value = value?.trim().to_string();
    let value = strip_quotes(&value).trim().to_string();
    if value.is_empty() || value == "sb_secret_xxx" {
        None
    } else {
        Some(value)
    }
}

fn strip_quotes(value: &str) -> &str {
    let bytes = value.as_bytes();
    if bytes.len() >= 2 {
        let first = bytes[0];
        let last = bytes[bytes.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return &value[1..value.len() - 1];
        }
    }
    value
}
