use anyhow::anyhow;
use std::str::FromStr;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::{
    comm::{subscribe, ticket::Ticket},
    database::topic::{Topic, TopicOperations},
    error::{Error, Result},
    AppState,
};

#[tauri::command]
pub async fn list_topics(app_state: State<'_, Mutex<AppState>>) -> Result<Vec<Topic>> {
    let state = app_state.lock().await;
    let topics = state.db.list_topics().await?;
    Ok(topics)
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
    let cancellation_token = CancellationToken::new();
    state.comm.topic_cancel_token = Some(cancellation_token.clone());
    let handle = tauri::async_runtime::spawn(async move {
        let app_handle_copy = app_handle.clone();
        if let Err(e) = subscribe(
            receiver,
            sender_copy,
            app_handle,
            current_node_id_copy,
            topic_id_copy,
            cancellation_token,
        )
        .await
        {
            app_handle_copy
                .emit("topic-subscription-error", e.to_string())
                .ok();
        }
    });

    state.comm.topic_subscriber = Some(handle);
    state.comm.topic_sender = Some(sender);
    *active_topic = Some(topic.clone());

    Ok(format!("{name}:{ticket}", name = topic.name))
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
    if active_topic.is_some() || state.comm.topic_sender.is_some() {
        return Err(anyhow!("Already joined a topic").into());
    }
    let endpoint = state.comm.endpoint.clone();
    let (name, ticket) = parse_ticket(&key)?;
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
        name,
        owner.to_string(),
        Some(members.to_vec()),
    );
    let topic = state.db.create_topic(topic).await?;
    setup_topic_subscription(
        &mut state,
        &mut active_topic,
        app_handle,
        topic.clone(),
        current_node_id,
    )
    .await
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
    if active_topic.is_some() || state.comm.topic_sender.is_some() {
        return Err(anyhow!("Already joined a topic").into());
    }
    let topic = state.db.get_topic_by_id(id).await?;
    let endpoint = state.comm.endpoint.clone();
    let node_id = endpoint.node_id().to_string();
    setup_topic_subscription(
        &mut state,
        &mut active_topic,
        app_handle,
        topic.clone(),
        node_id,
    )
    .await
}

#[tauri::command]
pub async fn get_topic_by_topic_id(
    app_state: State<'_, Mutex<AppState>>,
    topic_id: String,
) -> Result<Topic> {
    let state = app_state.lock().await;
    let topic = state.db.get_topic_by_topic_id(topic_id).await?;
    Ok(topic)
}

#[tauri::command]
pub async fn leave_topic(
    app_state: State<'_, Mutex<AppState>>,
    active_topic: State<'_, Mutex<Option<Topic>>>,
) -> Result<()> {
    let mut state = app_state.lock().await;

    let mut topic = active_topic.lock().await;

    if topic.is_some() {
        state.comm.topic_cancel_token.as_ref().unwrap().cancel();
        state.comm.topic_sender = None;
        let subscriber = state
            .comm
            .topic_subscriber
            .as_ref()
            .ok_or_else(|| Error::Generic(anyhow!("Subscriber not present")))?;
        subscriber.abort();
        state.comm.topic_subscriber = None;
        state.comm.topic_cancel_token = None;
        *topic = None;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_ticket_for_topic(
    app_state: State<'_, Mutex<AppState>>,
    topic_id: String,
) -> Result<String> {
    let state = app_state.lock().await;
    let topic = state.db.get_topic_by_topic_id(topic_id).await?;
    let ticket = Ticket::new(&topic.topic_id, topic.get_peers())?;
    Ok(format!("{name}:{ticket}", name = topic.name,))
}

async fn setup_topic_subscription(
    state: &mut AppState,
    active_topic: &mut Option<Topic>,
    app_handle: AppHandle,
    topic: Topic,
    node_id: String,
) -> Result<Topic> {
    let gossip = state.comm.gossip.clone();
    let ticket = Ticket::new(&topic.topic_id, topic.get_peers())?;
    let (sender, receiver) = gossip
        .subscribe(ticket.topic, ticket.nodes.clone())
        .await
        .map_err(|e| Error::GossipSubscription(format!("Failed to subscribe to gossip: {}", e)))?
        .split();
    let sender_copy = sender.clone();
    let topic_id_copy = topic.topic_id.clone();
    let cancellation_token = CancellationToken::new();
    state.comm.topic_cancel_token = Some(cancellation_token.clone());
    let handle = tauri::async_runtime::spawn(async move {
        let app_handle_copy = app_handle.clone();
        if let Err(e) = subscribe(
            receiver,
            sender_copy,
            app_handle,
            node_id,
            topic_id_copy,
            cancellation_token,
        )
        .await
        {
            app_handle_copy
                .emit("topic-subscription-error", e.to_string())
                .ok();
        }
    });
    state.comm.topic_subscriber = Some(handle);
    state.comm.topic_sender = Some(sender);
    *active_topic = Some(topic.clone());
    Ok(topic)
}

// Helper: Parse and validate ticket
fn parse_ticket(key: &str) -> Result<(String, Ticket)> {
    let parts = key.split(':').collect::<Vec<_>>();
    if parts.len() != 2 {
        return Err(crate::error::Error::Generic(anyhow!(
            "Invalid ticket format, expected 'name:ticket'"
        )));
    }
    let (name, ticket_key) = (parts[0].to_string(), parts[1]);
    let ticket = Ticket::from_str(ticket_key)?;
    Ok((name, ticket))
}
