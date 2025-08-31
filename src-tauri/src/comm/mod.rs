use anyhow::anyhow;
use futures_lite::StreamExt;
use iroh_blobs::ticket::BlobTicket;
use iroh_gossip::api::{Event, GossipReceiver, GossipSender};
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::{
    comm::{
        endpoint::update_topic,
        model::{CheckIn, MessageType, UserInfo},
    },
    database::file::{File, FileOperations, FileStatus},
    error::{Error, Result},
    AppState,
};

pub mod endpoint;
pub mod model;
pub mod state;
pub mod ticket;

pub async fn subscribe(
    mut receiver: GossipReceiver,
    sender: GossipSender,
    app_handle: tauri::AppHandle,
    node_id: String,
    topic_id: String,
    cancel_token: CancellationToken,
) -> Result<()> {
    let topic_id_copy = topic_id.clone();
    receiver
        .joined()
        .await
        .map_err(|e| Error::GossipSubscription(format!("Failed to join gossip: {}", e)))?;

    let user_info = {
        let state = app_handle.state::<Mutex<UserInfo>>();
        let user_info = state.lock().await.clone();
        user_info
    };
    let mut check_in_task = Some(tauri::async_runtime::spawn(check_in_task(
        user_info,
        node_id,
        topic_id.clone(),
        sender.clone(),
    )));

    let mut subscription_handler_task = Some(tauri::async_runtime::spawn(subscription_handler(
        receiver,
        app_handle,
        topic_id_copy,
    )));

    tokio::select! {
        // Abort both task if cancel_token is cancelled
        _ = cancel_token.cancelled() => {
            if let Some(task) = check_in_task.take() {
                task.abort();
                let _ = task.await;
            }
            if let Some(task) = subscription_handler_task.take() {
                task.abort();
                let _ = task.await;
            }
            Ok(())
        }
        res = async {
            if let Some(task) = subscription_handler_task.take() {
                task.await?
            } else {
                Ok(())
            }
        } => {
            if let Some(task) = check_in_task.take() {
                task.abort();
                let _ = task.await;
            }
            res
        }
        res = async {
            if let Some(task) = check_in_task.take() {
                task.await?
            } else {
                Ok(())
            }
        } => {
            if let Some(task) = subscription_handler_task.take() {
                task.abort();
                let _ = task.await;
            }
            res
        }
    }
}

async fn subscription_handler(
    mut receiver: GossipReceiver,
    app_handle: tauri::AppHandle,
    topic_id: String,
) -> Result<()> {
    while let Some(event) = receiver.try_next().await.ok() {
        if let Some(Event::Received(message)) = event {
            let message_type = serde_json::from_slice::<MessageType>(&message.content)?;
            let to_be_emitted = match message_type {
                MessageType::CheckIn(msg) => {
                    let state = app_handle.state::<Mutex<AppState>>();
                    let new_member = msg.metadata.sender;
                    let _ = update_topic(
                        state,
                        msg.data.topic_id,
                        new_member.clone(),
                        msg.metadata.user.clone(),
                    )
                    .await?;

                    serde_json::json!({
                        "type": "check_in",
                        "sender": new_member,
                        "meta": msg.metadata.user
                    })
                    .to_string()
                }
                MessageType::Chat(msg) => {
                    // Handle chat message
                    serde_json::json!({
                        "type": "chat",
                        "sender": msg.metadata.sender,
                        "content": msg.data.content,
                    })
                    .to_string()
                }
                MessageType::File(msg) => {
                    let file = msg.data;
                    let metadata = msg.metadata;

                    let state = app_handle.state::<Mutex<AppState>>();
                    let db = &state.lock().await.db;
                    let ticket = file
                        .blob_ticket
                        .clone()
                        .parse::<BlobTicket>()
                        .map_err(|e| {
                            Error::Generic(anyhow!("Failed to parse blob ticket: {}", e))
                        })?;
                    let file = db
                        .create_file(File::new(
                            metadata.sender.clone(),
                            topic_id.clone(),
                            ticket.hash().to_string(),
                            file.file_name.clone(),
                            None,
                            file.size.clone(),
                            ticket.format().to_string(),
                            FileStatus::Shared,
                            metadata.ts,
                        ))
                        .await?;
                    // Handle file message
                    serde_json::json!({
                        "type": "file",
                        "file": file,
                    })
                    .to_string()
                }
            };
            app_handle.emit("gossip-message", to_be_emitted)?;
        }
    }
    Ok(())
}

async fn check_in_task(
    user_info: UserInfo,
    node_id: String,
    topic_id: String,
    sender: GossipSender,
) -> Result<()> {
    let metadata = model::Metadata::new(user_info, node_id, None);
    let mut check_in = model::Message::new(CheckIn::new(topic_id), metadata);
    loop {
        check_in.metadata.ts = chrono::Utc::now().timestamp();
        let check_in = MessageType::CheckIn(check_in.clone());
        if let Some(message) = serde_json::to_vec(&check_in).ok() {
            sender.broadcast(message.into()).await.ok();
        }
        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
    }
}
