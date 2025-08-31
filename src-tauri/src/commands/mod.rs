use tauri::State;
use tokio::sync::Mutex;

use crate::{
    comm::model::{self, Chat, MessageType, UserInfo},
    error::{Error, Result},
    AppState,
};

pub(crate) mod file;
pub(crate) mod node;
pub(crate) mod topic;
pub(crate) mod user;

#[tauri::command]
pub async fn send_message(
    app_state: State<'_, Mutex<AppState>>,
    user_info: State<'_, Mutex<UserInfo>>,
    message: String,
) -> Result<()> {
    let state = app_state.lock().await;
    let topic_sender = state.comm.topic_sender.clone();
    let metadata = model::Metadata::new(
        user_info.lock().await.clone(),
        state.comm.endpoint.node_id().to_string(),
        None,
    );
    let message = MessageType::Chat(model::Message::new(Chat::new(message), metadata));
    let message = serde_json::to_vec(&message)?;
    if let Some(sender) = topic_sender {
        sender
            .broadcast(message.into())
            .await
            .map_err(|e| Error::GossipSubscription(format!("Failed to send message: {}", e)))?;
    }
    Ok(())
}
