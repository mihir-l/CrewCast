use std::{collections::HashMap, str::FromStr};

use anyhow::anyhow;
use futures_lite::StreamExt;
use iroh::Watcher;
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
    database::{
        file::{File, FileOperations, FileStatus, TsDirection, TsFilter},
        topic::TopicOperations,
        Db,
    },
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

    let state = app_handle.state::<Mutex<AppState>>();
    let db = state.lock().await.db.clone();
    _ = state;

    let mut check_in_task = Some(tauri::async_runtime::spawn(check_in_task(
        user_info,
        node_id,
        topic_id.clone(),
        sender.clone(),
        db,
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
    let user_info_state = app_handle.state::<Mutex<UserInfo>>();
    let me = user_info_state.lock().await.clone();
    let state = app_handle.state::<Mutex<AppState>>();
    let my_endpoint = state.lock().await.comm.endpoint.clone();
    let my_node_id = my_endpoint.node_id().to_string();
    let db = state.lock().await.db.clone();
    let topic_sender = state.lock().await.comm.topic_sender.clone().unwrap();
    _ = user_info_state;
    _ = state;
    while let Some(event) = receiver.try_next().await.ok() {
        if let Some(Event::Received(message)) = event {
            let message_type = serde_json::from_slice::<MessageType>(&message.content)?;
            let to_be_emitted = match message_type {
                MessageType::CheckIn(msg) => {
                    let my_node_addr = my_endpoint.node_addr().get().unwrap();
                    let new_member = msg.metadata.sender;
                    let _ = update_topic(
                        &db,
                        msg.data.topic_id,
                        new_member.clone(),
                        msg.metadata.user.clone(),
                    )
                    .await?;
                    let my_latest_from_check_in = msg.data.sync.get(&my_node_id).cloned();
                    if let Some(latest) = my_latest_from_check_in {
                        let files = db
                            .list_files(
                                topic_id.clone(),
                                Some(my_node_id.clone()),
                                Some(TsFilter {
                                    timestamp: latest,
                                    direction: TsDirection::Newer,
                                }),
                            )
                            .await?;
                        if !files.is_empty() {
                            for file in files.iter().rev() {
                                let hash = iroh_blobs::Hash::from_str(&file.hash).unwrap();
                                let hash_and_format = iroh_blobs::HashAndFormat::from(hash);
                                let ticket = BlobTicket::new(
                                    my_node_addr.clone(),
                                    hash_and_format.hash,
                                    hash_and_format.format,
                                );

                                let metadata =
                                    model::Metadata::new(me.clone(), my_node_id.clone(), None);
                                let message = model::Message::new(
                                    model::File::new(
                                        file.name.clone(),
                                        ticket.to_string(),
                                        file.size,
                                        file.shared_at,
                                    ),
                                    metadata,
                                );
                                let message = MessageType::File(message);
                                topic_sender
                                    .broadcast(serde_json::to_vec(&message)?.into())
                                    .await
                                    .ok();
                            }
                        }
                    }

                    Some(
                        serde_json::json!({
                            "type": "check_in",
                            "sender": new_member,
                            "meta": msg.metadata.user
                        })
                        .to_string(),
                    )
                }
                MessageType::Chat(msg) => {
                    // Handle chat message
                    Some(
                        serde_json::json!({
                            "type": "chat",
                            "sender": msg.metadata.sender,
                            "content": msg.data.content,
                        })
                        .to_string(),
                    )
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
                    let mut ret = None;
                    if db
                        .get_file_by_hash(ticket.hash().to_string())
                        .await
                        .is_err()
                    {
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
                                file.shared_at,
                            ))
                            .await?;
                        ret = Some(
                            serde_json::json!({
                                "type": "file",
                                "file": file,
                            })
                            .to_string(),
                        );
                    }
                    ret
                }
            };
            if let Some(to_be_emitted) = to_be_emitted {
                app_handle.emit("gossip-message", to_be_emitted)?;
            }
        }
    }
    Ok(())
}

async fn check_in_task(
    user_info: UserInfo,
    my_node_id: String,
    topic_id: String,
    sender: GossipSender,
    db: Db,
) -> Result<()> {
    let metadata = model::Metadata::new(user_info, my_node_id, None);
    let mut check_in =
        model::Message::new(CheckIn::new(topic_id.clone(), HashMap::new()), metadata);

    loop {
        check_in.metadata.ts = chrono::Utc::now().timestamp();
        let topic = db.get_topic_by_topic_id(topic_id.clone()).await?;
        let members = topic.get_peers();
        for member in &members {
            if member != &check_in.metadata.sender {
                let latest_from_member = db
                    .list_files(topic_id.clone(), Some(member.clone()), None)
                    .await?
                    .first()
                    .cloned()
                    .map(|f| f.shared_at)
                    .unwrap_or(0);
                check_in
                    .data
                    .sync
                    .insert(member.clone(), latest_from_member);
            }
        }

        let check_in = MessageType::CheckIn(check_in.clone());
        if let Some(message) = serde_json::to_vec(&check_in).ok() {
            sender.broadcast(message.into()).await.ok();
        }
        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
    }
}
