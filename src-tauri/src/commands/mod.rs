use std::str::FromStr;

use anyhow::anyhow;
use tauri::{AppHandle, Result, State};
use tokio::sync::Mutex;

use crate::{
    comm::{
        endpoint::{new_topic, subscribe},
        ticket::Ticket,
    },
    AppState,
};

#[tauri::command]
pub async fn send_message(app_state: State<'_, Mutex<AppState>>, message: String) -> Result<()> {
    let state = app_state.lock().await;
    let topic_sender = state.comm.topic_sender.clone();
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
) -> Result<String> {
    let mut state = app_state.lock().await;
    let endpoint = state.comm.endpoint.clone();
    let gossip = state.comm.gossip.clone();

    let topic_id = new_topic();
    let ticket = Ticket {
        topic: topic_id,
        nodes: vec![endpoint.node_id()],
    };
    let peer_ids = vec![endpoint.node_id()];
    let (sender, receiver) = gossip.subscribe(topic_id, peer_ids).await.unwrap().split();

    tauri::async_runtime::spawn(async move {
        subscribe(receiver, app_handle).await.unwrap();
    });
    state.comm.topic_sender = Some(sender);

    Ok(ticket.to_string())
}

#[tauri::command]
pub async fn join_topic(
    app_state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
    ticket_key: String,
) -> Result<String> {
    let mut state = app_state.lock().await;

    if state.comm.topic_sender.is_some() {
        return Err(anyhow!("Already joined a topic").into());
    }

    let gossip = state.comm.gossip.clone();

    let ticket =
        Ticket::from_str(&ticket_key).map_err(|e| anyhow!("Failed to parse ticket: {}", e))?;

    let peer_ids = ticket.nodes.clone();
    let (sender, receiver) = gossip
        .subscribe(ticket.topic, peer_ids)
        .await
        .unwrap()
        .split();

    tauri::async_runtime::spawn(async move {
        subscribe(receiver, app_handle).await.unwrap();
    });
    state.comm.topic_sender = Some(sender);

    Ok(ticket.to_string())
}
