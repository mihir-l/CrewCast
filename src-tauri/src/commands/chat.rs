use anyhow::anyhow;
use tauri::State;
use tokio::sync::Mutex;

use crate::{
	comm::model::{self, ChatMessage, MessageType, UserInfo},
	database::{
		chat::{Chat, ChatOperations},
		topic::Topic,
	},
	error::{Error, Result},
	AppState,
};

#[tauri::command]
pub async fn send_message(
	app_state: State<'_, Mutex<AppState>>,
	user_info: State<'_, Mutex<UserInfo>>,
	active_topic: State<'_, Mutex<Option<Topic>>>,
	message: String,
) -> Result<()> {
	let state = app_state.lock().await;
	let topic = active_topic.lock().await;

	if topic.is_none() {
		return Err(Error::Generic(anyhow!("Join a topic to send a message")));
	}

	let topic_sender = state.comm.topic_sender.clone();
	let metadata = model::Metadata::new(
		user_info.lock().await.clone(),
		state.comm.endpoint.node_id().to_string(),
		None,
	);

	let topic_id = topic.as_ref().unwrap().topic_id.clone();
	let chat = state
		.db
		.create_chat(Chat::new(
			state.comm.endpoint.node_id().to_string(),
			topic_id.clone(),
			None,
			message.clone(),
			metadata.ts,
		))
		.await?;

	let message = MessageType::Chat(model::Message::new(
		ChatMessage::new(message, topic_id, chat.hash, chat.shared_at),
		metadata,
	));
	let message = serde_json::to_vec(&message)?;
	if let Some(sender) = topic_sender {
		sender
			.broadcast(message.into())
			.await
			.map_err(|e| Error::GossipSubscription(format!("Failed to send message: {}", e)))?;
	}
	Ok(())
}

#[tauri::command]
pub async fn list_messages(app_state: State<'_, Mutex<AppState>>, topic_id: String) -> Result<Vec<Chat>> {
	let state = app_state.lock().await;
	let chats = state.db.list_chats(topic_id, None, None).await?;
	Ok(chats)
}
