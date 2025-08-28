use tauri::State;
use tokio::sync::Mutex;

use crate::{
    database::topic::{Topic, TopicOperations},
    error::Result,
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
