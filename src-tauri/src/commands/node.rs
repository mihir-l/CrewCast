use tauri::{Result, State};
use tokio::sync::Mutex;

use crate::{
    database::node::{Node, NodeOperations},
    AppState,
};

#[tauri::command]
pub async fn get_node_by_id(app_state: State<'_, Mutex<AppState>>, id: i64) -> Result<Node> {
    let state = app_state.lock().await;
    let db = &state.db;
    let node = db.get_node_by_id(id).await?;

    Ok(node)
}
