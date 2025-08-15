use std::str::FromStr;

use anyhow::anyhow;
use tauri::{AppHandle, Result, State};
use tokio::sync::Mutex;

use crate::{
    comm::{
        endpoint::{subscribe, ChatMessage, MessageType},
        ticket::Ticket,
    },
    database::topic::{Topic, TopicOperations},
    AppState,
};

pub(crate) mod node;
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
            .map_err(|e| anyhow!("Failed to send message: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn start_new_topic(
    app_state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
    name: String,
) -> Result<String> {
    let mut state = app_state.lock().await;

    let gossip = state.comm.gossip.clone();
    let endpoint = state.comm.endpoint.clone();
    let current_node_id = endpoint.node_id().to_string();
    let topic = Topic::new_topic(name, current_node_id.clone(), None);
    let topic = state.db.create_topic(topic).await?;

    let ticket = Ticket::new(&topic.topic_id, topic.get_peers())?;

    let (sender, receiver) = gossip
        .subscribe(ticket.topic, ticket.nodes.clone())
        .await
        .unwrap()
        .split();

    let sender_copy = sender.clone();
    let current_node_id_copy = current_node_id.clone();
    let topic_id_copy = topic.topic_id.clone();
    tauri::async_runtime::spawn(async move {
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
    state.comm.topic_sender = Some(sender);

    Ok(format!(
        "{name}:{ticket}",
        name = topic.name,
        ticket = ticket.to_string()
    ))
}

#[tauri::command]
pub async fn join_topic_with_ticket(
    app_state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
    key: String,
) -> Result<Topic> {
    let mut state = app_state.lock().await;

    if state.comm.topic_sender.is_some() {
        return Err(anyhow!("Already joined a topic").into());
    }
    let endpoint = state.comm.endpoint.clone();
    let gossip = state.comm.gossip.clone();

    let parts = key.split(':').collect::<Vec<_>>();
    if parts.len() != 2 {
        return Err(anyhow!("Invalid ticket format, expected 'name:ticket'").into());
    }
    let (name, ticket_key) = (parts[0], parts[1]);

    let ticket =
        Ticket::from_str(&ticket_key).map_err(|e| anyhow!("Failed to parse ticket: {}", e))?;

    // Create the topic in the db
    let nodes_str = ticket.nodes_to_string();
    let (owner, members) = nodes_str.split_first().ok_or_else(|| {
        anyhow!("Ticket must contain at least one node as owner and possibly more members")
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
        .unwrap()
        .split();
    let sender_copy = sender.clone();
    let current_node_id_copy = current_node_id.clone();
    let topic_id_copy = topic.topic_id.clone();
    tauri::async_runtime::spawn(async move {
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

    state.comm.topic_sender = Some(sender);

    Ok(topic)
}

#[tauri::command]
pub async fn join_topic_with_id(
    app_state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
    id: i64,
) -> Result<Topic> {
    let mut state = app_state.lock().await;

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
        .unwrap()
        .split();

    let sender_copy = sender.clone();
    let current_node_id = endpoint.node_id().to_string();
    let topic_id_copy = topic.topic_id.clone();
    tauri::async_runtime::spawn(async move {
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
    state.comm.topic_sender = Some(sender);

    Ok(topic)
}
