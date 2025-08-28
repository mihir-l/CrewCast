use std::{fs, os::windows::fs::MetadataExt, path::PathBuf, str::FromStr};

use anyhow::anyhow;
use futures_lite::StreamExt;
use iroh::{NodeId, Watcher};
use iroh_blobs::{api::downloader::DownloadProgessItem, ticket::BlobTicket};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

use crate::{
    comm::{
        endpoint::{subscribe, ChatMessage, FileMessage, MessageType},
        ticket::Ticket,
    },
    database::{
        file::{File, FileOperations, FileStatus},
        topic::{Topic, TopicOperations},
    },
    error::{Error, Result},
    AppState,
};

pub(crate) mod file;
pub(crate) mod node;
pub(crate) mod topic;
pub(crate) mod user;

#[tauri::command]
pub async fn send_message(app_state: State<'_, Mutex<AppState>>, message: String) -> Result<()> {
    let state = app_state.lock().await;
    let topic_sender = state.comm.topic_sender.clone();
    let message = serde_json::to_vec(&MessageType::Chat(ChatMessage {
        content: message,
        sender: state.comm.endpoint.node_id().to_string(),
        ts: chrono::Utc::now().timestamp(),
    }))?;
    if let Some(sender) = topic_sender {
        sender
            .broadcast(message.into())
            .await
            .map_err(|e| Error::GossipSubscription(format!("Failed to send message: {}", e)))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn start_new_topic(
    app_state: State<'_, Mutex<AppState>>,
    active_topic: State<'_, Mutex<Option<Topic>>>,
    app_handle: AppHandle,
    name: String,
) -> Result<String> {
    let mut state = app_state.lock().await;

    let mut active_topic = active_topic.lock().await;
    if active_topic.is_some() {
        return Err(anyhow!("Already joined a topic").into());
    }

    let gossip = state.comm.gossip.clone();
    let endpoint = state.comm.endpoint.clone();
    let current_node_id = endpoint.node_id().to_string();
    let topic = Topic::new_topic(name, current_node_id.clone(), None);
    let topic = state.db.create_topic(topic).await?;

    let ticket = Ticket::new(&topic.topic_id, topic.get_peers())?;

    let (sender, receiver) = gossip
        .subscribe(ticket.topic, ticket.nodes.clone())
        .await
        .map_err(|e| Error::GossipSubscription(format!("Failed to subscribe to gossip: {}", e)))?
        .split();

    let sender_copy = sender.clone();
    let current_node_id_copy = current_node_id.clone();
    let topic_id_copy = topic.topic_id.clone();
    let handle = tauri::async_runtime::spawn(async move {
        subscribe(
            receiver,
            sender_copy,
            app_handle,
            current_node_id_copy,
            topic_id_copy,
        )
        .await
        .unwrap();
    });

    state.comm.topic_subscriber = Some(handle);
    state.comm.topic_sender = Some(sender);
    *active_topic = Some(topic.clone());

    Ok(format!(
        "{name}:{ticket}",
        name = topic.name,
        ticket = ticket.to_string()
    ))
}

#[tauri::command]
pub async fn join_topic_with_ticket(
    app_state: State<'_, Mutex<AppState>>,
    active_topic: State<'_, Mutex<Option<Topic>>>,
    app_handle: AppHandle,
    key: String,
) -> Result<Topic> {
    let mut state = app_state.lock().await;

    let mut active_topic = active_topic.lock().await;
    if active_topic.is_some() {
        return Err(anyhow!("Already joined a topic").into());
    }

    if state.comm.topic_sender.is_some() {
        return Err(anyhow!("Already joined a topic").into());
    }
    let endpoint = state.comm.endpoint.clone();
    let gossip = state.comm.gossip.clone();

    let parts = key.split(':').collect::<Vec<_>>();
    if parts.len() != 2 {
        return Err(Error::Generic(anyhow!(
            "Invalid ticket format, expected 'name:ticket'"
        )));
    }
    let (name, ticket_key) = (parts[0], parts[1]);

    let ticket = Ticket::from_str(&ticket_key)?;

    // Create the topic in the db
    let nodes_str = ticket.nodes_to_string();
    let (owner, members) = nodes_str.split_first().ok_or_else(|| {
        Error::Generic(anyhow!(
            "Ticket must contain at least one node as owner and possibly more members"
        ))
    })?;

    let current_node_id = endpoint.node_id().to_string();
    let mut members = members.to_vec();
    members.push(current_node_id.clone());

    let topic = Topic::new_topic_with_id(
        ticket.topic.to_string(),
        name.to_string(),
        owner.to_string(),
        Some(members.to_vec()),
    );

    let topic = state.db.create_topic(topic).await?;

    let peer_ids = ticket.nodes.clone();
    let (sender, receiver) = gossip
        .subscribe(ticket.topic, peer_ids)
        .await
        .map_err(|e| Error::GossipSubscription(format!("Failed to subscribe to gossip: {}", e)))?
        .split();
    let sender_copy = sender.clone();
    let current_node_id_copy = current_node_id.clone();
    let topic_id_copy = topic.topic_id.clone();
    let handle = tauri::async_runtime::spawn(async move {
        subscribe(
            receiver,
            sender_copy,
            app_handle,
            current_node_id_copy,
            topic_id_copy,
        )
        .await
        .unwrap();
    });

    state.comm.topic_subscriber = Some(handle);

    state.comm.topic_sender = Some(sender);
    *active_topic = Some(topic.clone());

    Ok(topic)
}

#[tauri::command]
pub async fn join_topic_with_id(
    app_state: State<'_, Mutex<AppState>>,
    active_topic: State<'_, Mutex<Option<Topic>>>,
    app_handle: AppHandle,
    id: i64,
) -> Result<Topic> {
    let mut state = app_state.lock().await;

    let mut active_topic = active_topic.lock().await;
    if active_topic.is_some() {
        return Err(anyhow!("Already joined a topic").into());
    }

    if state.comm.topic_sender.is_some() {
        return Err(anyhow!("Already joined a topic").into());
    }

    let topic = state.db.get_topic_by_id(id).await?;
    let endpoint = state.comm.endpoint.clone();
    let gossip = state.comm.gossip.clone();

    let ticket = Ticket::new(&topic.topic_id, topic.get_peers())?;

    let (sender, receiver) = gossip
        .subscribe(ticket.topic, ticket.nodes.clone())
        .await
        .map_err(|e| Error::GossipSubscription(format!("Failed to subscribe to gossip: {}", e)))?
        .split();

    let sender_copy = sender.clone();
    let current_node_id = endpoint.node_id().to_string();
    let topic_id_copy = topic.topic_id.clone();
    let handle = tauri::async_runtime::spawn(async move {
        subscribe(
            receiver,
            sender_copy,
            app_handle,
            current_node_id,
            topic_id_copy,
        )
        .await
        .unwrap();
    });

    state.comm.topic_subscriber = Some(handle);

    state.comm.topic_sender = Some(sender);
    *active_topic = Some(topic.clone());

    Ok(topic)
}

#[tauri::command]
pub async fn share_file(
    app_state: State<'_, Mutex<AppState>>,
    active_topic: State<'_, Mutex<Option<Topic>>>,
    file_path: String,
) -> Result<()> {
    let state = app_state.lock().await;
    let active_topic = active_topic.lock().await;
    if active_topic.is_none() {
        return Err(anyhow!("Join a topic to share a file").into());
    }
    let db = &state.db;
    let topic_sender = state.comm.topic_sender.clone();
    let endpoint = state.comm.endpoint.clone();
    let node_id = endpoint.node_id().to_string();

    let blobs = state.comm.blobs.clone();

    // Add file to blob store
    let file_path = PathBuf::from(file_path);
    let file_name = file_path
        .file_name()
        .ok_or_else(|| Error::Generic(anyhow!("Invalid file path")))?
        .to_string_lossy()
        .to_string();

    let file_tag = blobs.store().add_path(file_path.clone()).await.unwrap();

    let file_size = fs::metadata(file_path)?.file_size() as i64;

    let node_addr = endpoint.node_addr().get().unwrap();
    let ticket = BlobTicket::new(node_addr, file_tag.hash, file_tag.format);

    let ts = chrono::Utc::now().timestamp();
    let message = MessageType::File(FileMessage {
        file_name: file_name.clone(),
        sender: node_id.clone(),
        ts,
        blob_ticket: ticket.to_string(),
        size: file_size,
    });

    db.create_file(File::new(
        node_id,
        active_topic.as_ref().unwrap().topic_id.clone(),
        ticket.hash().to_string(),
        file_name,
        file_size,
        file_tag.format.to_string(),
        FileStatus::Shared,
        ts,
    ))
    .await?;

    if topic_sender.is_none() {
        return Err(Error::Generic(anyhow!("Not joined to a topic")));
    }
    topic_sender
        .unwrap()
        .broadcast(serde_json::to_vec(&message)?.into())
        .await
        .map_err(|e| Error::GossipSubscription(format!("Failed to send message: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn download_file(
    app_handle: AppHandle,
    app_state: State<'_, Mutex<AppState>>,
    file: File,
) -> Result<()> {
    let state = app_state.lock().await;
    let blobs = state.comm.blobs.clone();
    let endpoint = state.comm.endpoint.clone();

    let downloader = blobs.store().downloader(&endpoint);

    let file_owner_node_id = NodeId::from_str(&file.node_id)
        .map_err(|e| Error::EncodeDecode(format!("Failed to parse nodeId: {}", e)))?;
    let file_hash = iroh_blobs::Hash::from_str(&file.hash)
        .map_err(|e| Error::EncodeDecode(format!("Failed to parse file hash: {}", e)))?;
    let progress = downloader.download(file_hash, Some(file_owner_node_id));
    let mut stream = progress
        .stream()
        .await
        .map_err(|e| Error::Generic(anyhow!("Failed to create download stream: {}", e)))?;
    let file_name = file.name.clone();
    while let Some(pg) = stream.next().await {
        let app_handle = app_handle.clone();
        let file_name = file_name.clone();
        match pg {
            DownloadProgessItem::Progress(pg_per) => {
                app_handle.emit(
                    "download-progress",
                    serde_json::json!({
                        "percentage": pg_per,
                        "fileName": file_name
                    })
                    .to_string(),
                )?;
            }
            _ => (),
        }
    }

    let save_path = std::env::current_dir()?.join(file_name);
    blobs
        .store()
        .blobs()
        .export(file_hash, save_path)
        .await
        .map_err(|e| Error::Generic(anyhow!("Failed to export blob: {}", e)))?;

    let _ = &state
        .db
        .update_file(file.id, FileStatus::Downloaded)
        .await?;

    Ok(())
}
