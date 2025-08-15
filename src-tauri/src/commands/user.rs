use tokio::sync::Mutex;

use tauri::{Result, State};

use crate::{
    database::{
        node::NodeOperations,
        user::{User, UserOperations},
    },
    AppState,
};

#[tauri::command]
pub async fn get_user_by_node_id(
    app_state: State<'_, Mutex<AppState>>,
    node_id: String,
) -> Result<User> {
    let state = app_state.lock().await;
    let db = &state.db;
    let node = db.get_node_by_node_id(node_id).await?;
    let user = db.get_user_by_node_id(node.id).await?;

    Ok(user)
}
