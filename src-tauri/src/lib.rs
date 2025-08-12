use std::str::FromStr;

use tauri::Manager;

mod comm;
mod commands;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, commands::send_message])
        .setup(move |app| {
            let (tx, rx) = tokio::sync::mpsc::channel(1);
            let args = std::env::args().collect::<Vec<_>>();
            let ticket = args
                .get(1)
                .cloned()
                .map(|tt| comm::ticket::Ticket::from_str(&tt).expect("Invalid ticket format"));

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                comm::endpoint::start(rx, ticket, app_handle)
                    .await
                    .expect("Failed to start endpoint");
            });
            app.manage(tx);
            Ok(())
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
