mod auth;
mod cloud;
mod deps;
mod dev;
mod diag;
mod discord_presence;
mod exec;
mod paths;
mod recovery;
mod social;
mod storage;
mod updates;

use std::sync::atomic::{AtomicBool, Ordering};

use storage::DbState;
use tauri::{Emitter, Manager, PhysicalSize};

/// Windows gare une fenêtre minimisée vers (-32000, -32000) et envoie un resize 0×0.
const ICONIC_COORD: i32 = -16_000;
static RESTORING: AtomicBool = AtomicBool::new(false);

fn window_is_iconic(window: &tauri::WebviewWindow) -> bool {
    if window.is_minimized().unwrap_or(false) {
        return true;
    }
    if !window.is_visible().unwrap_or(true) {
        return true;
    }
    if let Ok(size) = window.outer_size() {
        if size.width < 32 || size.height < 32 {
            return true;
        }
    }
    if let Ok(pos) = window.outer_position() {
        if pos.x <= ICONIC_COORD || pos.y <= ICONIC_COORD {
            return true;
        }
    }
    false
}

fn disable_webview_context_menu(window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    {
        let _ = window.with_webview(|webview| unsafe {
            if let Ok(core) = webview.controller().CoreWebView2() {
                if let Ok(settings) = core.Settings() {
                    let _ = settings.SetAreDefaultContextMenusEnabled(false);
                }
            }
        });
    }
    #[cfg(not(windows))]
    {
        let _ = window;
    }
}

fn clamp_window_to_work_area(window: &tauri::WebviewWindow) {
    // Ne pas retoucher la taille pendant une minimisation : set_size / set_max_size
    // sur la position iconique casse le rectangle de restauration (fenêtre hors écran).
    if window.is_minimized().unwrap_or(false) {
        return;
    }
    if let Ok(pos) = window.outer_position() {
        if pos.x <= ICONIC_COORD || pos.y <= ICONIC_COORD {
            return;
        }
    }
    if let Ok(size) = window.outer_size() {
        if size.width < 32 || size.height < 32 {
            return;
        }
    }
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let area = monitor.work_area();
    let width = area.size.width.max(960);
    let height = area.size.height.max(640);
    let _ = window.set_max_size(Some(PhysicalSize::new(width, height)));
    if let Ok(size) = window.outer_size() {
        let next_w = size.width.min(width);
        let next_h = size.height.min(height);
        if next_w < size.width || next_h < size.height {
            let _ = window.set_size(PhysicalSize::new(next_w, next_h));
        }
    }
}

fn reveal_webview(window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    {
        let _ = window.with_webview(|webview| unsafe {
            let _ = webview.controller().SetIsVisible(true);
        });
    }
    #[cfg(not(windows))]
    {
        let _ = window;
    }
}

/// Ramène la fenêtre au premier plan après Alt+Tab.
/// Une appli élevée (requireAdministrator) ne reçoit pas toujours le restore du shell :
/// on force ShowWindow nous-mêmes, et on recentre si Windows l'a laissée hors écran.
fn restore_after_switch(window: &tauri::WebviewWindow) {
    let iconic = window_is_iconic(window);
    if !iconic {
        // Revenir au premier plan peut laisser le WebView2 invisible sans masquer la HWND.
        reveal_webview(window);
        return;
    }
    if RESTORING.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = window.show();
    if window.is_minimized().unwrap_or(false) {
        let _ = window.unminimize();
    }
    let still_offscreen = window
        .outer_position()
        .map(|pos| pos.x <= ICONIC_COORD || pos.y <= ICONIC_COORD)
        .unwrap_or(false);
    let tiny = window
        .outer_size()
        .map(|size| size.width < 200 || size.height < 200)
        .unwrap_or(false);
    if iconic && (still_offscreen || tiny) {
        let _ = window.set_size(PhysicalSize::new(1280u32, 840u32));
        let _ = window.center();
    }
    reveal_webview(window);
    #[cfg(windows)]
    force_foreground(window, iconic);
    #[cfg(not(windows))]
    {
        let _ = window.set_focus();
    }
    RESTORING.store(false, Ordering::SeqCst);
}

#[cfg(windows)]
fn force_foreground(window: &tauri::WebviewWindow, was_iconic: bool) {
    use windows::Win32::UI::WindowsAndMessaging::{
        SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,
    };
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            if was_iconic {
                let _ = ShowWindow(hwnd, SW_RESTORE);
            }
            let _ = ShowWindow(hwnd, SW_SHOW);
            if was_iconic {
                let _ = SetForegroundWindow(hwnd);
            }
        }
    }
    let _ = window.set_focus();
}

#[cfg(windows)]
fn allow_shell_activation(window: &tauri::WebviewWindow) {
    use windows::Win32::UI::WindowsAndMessaging::{
        ChangeWindowMessageFilterEx, MSGFLT_ALLOW, WM_ACTIVATE, WM_ACTIVATEAPP, WM_NCACTIVATE,
        WM_SHOWWINDOW, WM_SYSCOMMAND, WM_WINDOWPOSCHANGING,
    };
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    // Le shell (intégrité moyenne) doit pouvoir réactiver une fenêtre élevée.
    unsafe {
        for message in [
            WM_ACTIVATE,
            WM_ACTIVATEAPP,
            WM_NCACTIVATE,
            WM_SHOWWINDOW,
            WM_SYSCOMMAND,
            WM_WINDOWPOSCHANGING,
        ] {
            let _ = ChangeWindowMessageFilterEx(hwnd, message, MSGFLT_ALLOW, None);
        }
    }
}

fn schedule_restore(window: &tauri::WebviewWindow) {
    let pending = window.clone();
    let _ = window.run_on_main_thread(move || restore_after_switch(&pending));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = storage::init_db().expect("Impossible d'initialiser la base CodeFlow");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DbState(std::sync::Mutex::new(conn)))
        .setup(|app| {
            discord_presence::start();
            for (_, window) in app.webview_windows() {
                clamp_window_to_work_area(&window);
                disable_webview_context_menu(&window);
                #[cfg(windows)]
                allow_shell_activation(&window);
                let watch = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        // Perdre le focus ne doit jamais masquer la fenêtre.
                        tauri::WindowEvent::Focused(false) => {}
                        tauri::WindowEvent::Focused(true) => schedule_restore(&watch),
                        tauri::WindowEvent::Moved(_)
                        | tauri::WindowEvent::ScaleFactorChanged { .. } => {
                            clamp_window_to_work_area(&watch);
                        }
                        tauri::WindowEvent::Resized(size) => {
                            // 0×0 = minimisée. Émettre cette taille fige le WebView hors écran.
                            if size.width == 0 || size.height == 0 {
                                return;
                            }
                            if window_is_iconic(&watch) {
                                schedule_restore(&watch);
                            }
                            let scale = watch.scale_factor().unwrap_or(1.0);
                            let _ = watch.emit(
                                "cf-resized",
                                serde_json::json!({
                                    "width": size.width,
                                    "height": size.height,
                                    "scale": scale,
                                }),
                            );
                        }
                        _ => {}
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            exec::execute_code,
            exec::trace_code,
            deps::detect_runtimes,
            deps::install_runtime,
            deps::uninstall_runtime,
            deps::verify_runtime,
            auth::get_session,
            auth::get_api_token,
            auth::get_refresh_token,
            auth::clear_cloud_tokens,
            auth::set_cloud_session,
            auth::logout_user,
            auth::delete_account,
            auth::list_users,
            cloud::cloud_register,
            cloud::cloud_login,
            cloud::cloud_refresh_session,
            cloud::cloud_me,
            cloud::cloud_get_progress,
            cloud::cloud_put_progress,
            cloud::cloud_update_profile,
            cloud::cloud_update_password,
            cloud::cloud_leaderboard,
            cloud::cloud_sync_projects,
            cloud::cloud_latest_update,
            social::cloud_social_snapshot,
            social::cloud_social_request,
            social::cloud_social_respond,
            social::cloud_social_send,
            social::cloud_social_read,
            social::cloud_social_delete_message,
            social::cloud_social_delete_thread,
            social::cloud_social_react,
            social::cloud_social_typing,
            social::cloud_social_block,
            social::cloud_social_unblock,
            social::cloud_get_progression,
            social::cloud_put_progression,
            social::cloud_public_profile,
            social::cloud_achievement_rates,
            social::flash_taskbar,
            storage::get_progress,
            storage::complete_lesson,
            storage::complete_exercise,
            storage::set_last_lesson,
            storage::set_daily_goal,
            storage::set_theme,
            storage::set_setup_done,
            storage::replace_progress,
            storage::save_qa_progress,
            storage::list_programs,
            storage::save_program,
            storage::delete_program,
            storage::write_user_file,
            updates::download_and_run_update,
            updates::open_update_url,
            auth::environments_onboarding_done,
            auth::mark_environments_onboarding_done,
            recovery::save_local_recovery,
            recovery::update_recovery_username,
            recovery::recover_local_password,
            recovery::recover_local_username,
            storage::mark_tutorial_seen,
            dev::dev_list_accounts,
            dev::dev_delete_account,
            dev::dev_reset_session,
            dev::dev_diagnostics,
            discord_presence::discord_set_presence,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                discord_presence::shutdown();
            }
        });
}
