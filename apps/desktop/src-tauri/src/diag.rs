use std::collections::VecDeque;
use std::sync::Mutex;

const MAX_LINES: usize = 40;

static LOG: Mutex<VecDeque<String>> = Mutex::new(VecDeque::new());

pub fn push(message: &str) {
    let Ok(mut guard) = LOG.lock() else {
        return;
    };
    if guard.len() >= MAX_LINES {
        guard.pop_front();
    }
    let text: String = message.chars().take(500).collect();
    let line = format!("{}  {text}", chrono::Utc::now().format("%H:%M:%S"));
    guard.push_back(line);
}

pub fn recent() -> Vec<String> {
    LOG.lock()
        .map(|guard| guard.iter().cloned().collect())
        .unwrap_or_default()
}

pub fn is_elevated() -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::{Command, Stdio};
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let status = Command::new("net")
            .args(["session"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        status.map(|value| value.success()).unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        false
    }
}
