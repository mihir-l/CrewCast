use tauri::State;

#[tauri::command]
pub async fn send_message(
    tx: State<'_, tokio::sync::mpsc::Sender<String>>,
    message: String,
) -> Result<(), String> {
    tx.send(message)
        .await
        .map_err(|e| format!("Failed to send message: {}", e))?;
    Ok(())
}
