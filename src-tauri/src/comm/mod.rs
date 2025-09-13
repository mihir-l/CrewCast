use std::{collections::HashMap, str::FromStr};

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
        model::{CheckIn, FileBatch, MessageType, UserInfo},
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

const MAX_FILES_PER_BATCH: usize = 50; // Limit batch size to avoid huge messages

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

    let user_info = app_handle.state::<Mutex<UserInfo>>().lock().await.clone();

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
    // Extract all needed state at the start to minimize locking
    let (me, my_endpoint, my_node_id, db, topic_sender) = {
        let user_info_state = app_handle.state::<Mutex<UserInfo>>();
        let me = user_info_state.lock().await.clone();

        let state = app_handle.state::<Mutex<AppState>>();
        let state_guard = state.lock().await;
        let my_endpoint = state_guard.comm.endpoint.clone();
        let my_node_id = my_endpoint.node_id().to_string();
        let db = state_guard.db.clone();
        let topic_sender = state_guard.comm.topic_sender.clone().unwrap();

        (me, my_endpoint, my_node_id, db, topic_sender)
    };

    while let Ok(event) = receiver.try_next().await {
        if let Some(Event::Received(message)) = event {
            // Improved error handling - don't crash on deserialization errors
            let message_type = match serde_json::from_slice::<MessageType>(&message.content) {
                Ok(msg_type) => msg_type,
                Err(e) => {
                    eprintln!("Failed to deserialize gossip message: {}", e);
                    continue;
                }
            };

            let to_be_emitted = match message_type {
                MessageType::CheckIn(msg) => {
                    let target_node = &msg.metadata.sender;

                    // Update topic with new member
                    update_topic(
                        &db,
                        msg.data.topic_id.clone(),
                        target_node.clone(),
                        msg.metadata.user.clone(),
                    )
                    .await?;

                    // Check if we need to send files to the target node
                    if let Some(&latest) = msg.data.sync.get(&my_node_id) {
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

                        // Send files as a batch if there are any
                        if !files.is_empty() {
                            let my_node_addr = my_endpoint.node_addr().get().unwrap();

                            // Convert database files to model files
                            let batch_files: Vec<model::File> = files
                                .iter()
                                .rev() // Send newest first
                                .map(|file| {
                                    let hash = iroh_blobs::Hash::from_str(&file.hash).unwrap();
                                    let hash_and_format = iroh_blobs::HashAndFormat::from(hash);
                                    let ticket = BlobTicket::new(
                                        my_node_addr.clone(),
                                        hash_and_format.hash,
                                        hash_and_format.format,
                                    );

                                    model::File::new(
                                        file.name.clone(),
                                        ticket.to_string(),
                                        file.size,
                                        file.shared_at,
                                    )
                                })
                                .collect();

                            // Send files in chunks if too many
                            for chunk in batch_files.chunks(MAX_FILES_PER_BATCH) {
                                let metadata =
                                    model::Metadata::new(me.clone(), my_node_id.clone(), None);
                                let batch_message = model::Message::new(
                                    FileBatch::new(chunk.to_vec(), target_node.clone()),
                                    metadata,
                                );
                                let message = MessageType::FileBatch(batch_message);

                                // Send batch message
                                if let Ok(serialized) = serde_json::to_vec(&message) {
                                    topic_sender.broadcast(serialized.into()).await.ok();
                                }
                            }
                        }
                    }

                    Some(
                        serde_json::json!({
                            "type": "check_in",
                            "sender": target_node,
                            "meta": msg.metadata.user
                        })
                        .to_string(),
                    )
                }
                MessageType::Chat(msg) => Some(
                    serde_json::json!({
                        "type": "chat",
                        "sender": msg.metadata.sender,
                        "content": msg.data.content,
                    })
                    .to_string(),
                ),
                MessageType::File(msg) => {
                    let file = msg.data;
                    let metadata = msg.metadata;

                    // Parse blob ticket
                    let ticket = match file.blob_ticket.parse::<BlobTicket>() {
                        Ok(ticket) => ticket,
                        Err(e) => {
                            eprintln!("Failed to parse blob ticket: {}", e);
                            continue;
                        }
                    };

                    // Check if file already exists
                    if db
                        .get_file_by_hash(ticket.hash().to_string())
                        .await
                        .is_err()
                    {
                        let new_file = db
                            .create_file(File::new(
                                metadata.sender.clone(),
                                topic_id.clone(),
                                ticket.hash().to_string(),
                                file.file_name.clone(),
                                None,
                                file.size,
                                ticket.format().to_string(),
                                FileStatus::Shared,
                                file.shared_at,
                            ))
                            .await?;

                        Some(
                            serde_json::json!({
                                "type": "file",
                                "file": new_file,
                            })
                            .to_string(),
                        )
                    } else {
                        None
                    }
                }
                MessageType::FileBatch(msg) => {
                    let batch = msg.data;
                    let metadata = msg.metadata;
                    let mut created_files = Vec::new();

                    // Only process batch if it was intended for us or everyone
                    if batch.sync_request_node == my_node_id || batch.sync_request_node.is_empty() {
                        for file in batch.files {
                            // Parse blob ticket
                            let ticket = match file.blob_ticket.parse::<BlobTicket>() {
                                Ok(ticket) => ticket,
                                Err(e) => {
                                    eprintln!("Failed to parse blob ticket in batch: {}", e);
                                    continue;
                                }
                            };

                            // Check if file already exists
                            if db
                                .get_file_by_hash(ticket.hash().to_string())
                                .await
                                .is_err()
                            {
                                match db
                                    .create_file(File::new(
                                        metadata.sender.clone(),
                                        topic_id.clone(),
                                        ticket.hash().to_string(),
                                        file.file_name.clone(),
                                        None,
                                        file.size,
                                        ticket.format().to_string(),
                                        FileStatus::Shared,
                                        file.shared_at,
                                    ))
                                    .await
                                {
                                    Ok(new_file) => created_files.push(new_file),
                                    Err(e) => eprintln!("Failed to create file from batch: {}", e),
                                }
                            }
                        }

                        if !created_files.is_empty() {
                            Some(
                                serde_json::json!({
                                    "type": "file_batch",
                                    "files": created_files,
                                    "sender": metadata.sender
                                })
                                .to_string(),
                            )
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                }
            };

            if let Some(to_be_emitted) = to_be_emitted {
                if let Err(e) = app_handle.emit("gossip-message", to_be_emitted) {
                    eprintln!("Failed to emit gossip message: {}", e);
                }
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
    let metadata = model::Metadata::new(user_info, my_node_id.clone(), None);
    let mut check_in =
        model::Message::new(CheckIn::new(topic_id.clone(), HashMap::new()), metadata);

    // Caching variables to reduce DB calls
    let mut cached_members: Vec<String> = Vec::new();
    let mut last_member_refresh = 0i64;
    let mut sync_map = HashMap::new();

    // Cache refresh interval (60 seconds)
    const MEMBER_CACHE_REFRESH_INTERVAL: i64 = 60;

    loop {
        let current_time = chrono::Utc::now().timestamp();
        check_in.metadata.ts = current_time;

        // Refresh member cache if it's empty or stale
        let should_refresh_members = cached_members.is_empty()
            || (current_time - last_member_refresh) > MEMBER_CACHE_REFRESH_INTERVAL;

        if should_refresh_members {
            let topic = db.get_topic_by_topic_id(topic_id.clone()).await?;
            let new_members = topic.get_peers();

            // Check if membership changed
            let members_changed = new_members.len() != cached_members.len()
                || !new_members.iter().all(|m| cached_members.contains(m));

            if members_changed {
                cached_members = new_members;
                // Pre-allocate HashMap with correct capacity
                sync_map = HashMap::with_capacity(cached_members.len());
            }

            last_member_refresh = current_time;
        }

        // Clear the sync map for fresh data
        sync_map.clear();

        // Filter out our own node_id from members
        let other_members: Vec<String> = cached_members
            .iter()
            .filter(|&member| member != &check_in.metadata.sender)
            .cloned()
            .collect();

        if !other_members.is_empty() {
            // Single batched DB call to get all timestamps
            let timestamps = db
                .get_latest_file_timestamps_by_members(&topic_id, &other_members)
                .await?;

            // Populate sync_map with results
            for (member, timestamp) in timestamps {
                sync_map.insert(member, timestamp);
            }
        }

        // Update the check_in data
        check_in.data.sync = sync_map.clone();

        // Send the check-in message
        let check_in_msg = MessageType::CheckIn(check_in.clone());
        if let Ok(message) = serde_json::to_vec(&check_in_msg) {
            sender.broadcast(message.into()).await.ok();
        }

        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
    }
}
