use tauri::State;
use tokio::sync::Mutex;

use crate::{
    database::file::{File, FileOperations},
    error::Result,
    AppState,
};

#[tauri::command]
pub async fn list_files(
    app_state: State<'_, Mutex<AppState>>,
    topic_id: String,
) -> Result<Vec<File>> {
    let state = app_state.lock().await;
    state.db.list_files(topic_id, None).await
}
