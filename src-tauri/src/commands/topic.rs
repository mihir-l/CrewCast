use anyhow::anyhow;
use tauri::State;
use tokio::sync::Mutex;

use crate::{
    comm::ticket::Ticket,
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

    if let Some(_) = *topic {
        state.comm.topic_sender = None;
        let subscriber = state
            .comm
            .topic_subscriber
            .as_ref()
            .ok_or_else(|| Error::Generic(anyhow!("Subscriber not present")))?;
        subscriber.abort();
        state.comm.topic_subscriber = None;
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
    Ok(format!(
        "{name}:{ticket}",
        name = topic.name,
        ticket = ticket.to_string()
    ))
}
