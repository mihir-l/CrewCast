use std::{fs, path::PathBuf, str::FromStr};

use anyhow::anyhow;
use futures_lite::StreamExt;
use iroh::{NodeId, Watcher};
use iroh_blobs::{api::downloader::DownloadProgessItem, ticket::BlobTicket};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

use crate::{
	comm::model::{self, MessageType, UserInfo},
	database::{
		file::{File, FileOperations, FileStatus},
		topic::Topic,
	},
	error::{Error, Result},
	AppState,
};

#[tauri::command]
pub async fn list_files(app_state: State<'_, Mutex<AppState>>, topic_id: String) -> Result<Vec<File>> {
	let state = app_state.lock().await;
	state.db.list_files(topic_id, None, None).await
}

#[tauri::command]
pub async fn share_file(
	app_state: State<'_, Mutex<AppState>>,
	active_topic: State<'_, Mutex<Option<Topic>>>,
	user_info: State<'_, Mutex<UserInfo>>,
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

	let file_size = fs::metadata(&file_path)?.len() as i64;

	let node_addr = endpoint.node_addr().get().unwrap();
	let ticket = BlobTicket::new(node_addr, file_tag.hash, file_tag.format);

	let ts = chrono::Utc::now().timestamp();
	let metadata = model::Metadata::new(user_info.lock().await.clone(), node_id.clone(), Some(ts));
	let message = model::Message::new(
		model::File::new(file_name.clone(), ticket.to_string(), file_size, ts),
		metadata,
	);
	let message = MessageType::File(message);

	db.create_file(File::new(
		node_id,
		active_topic.as_ref().unwrap().topic_id.clone(),
		ticket.hash().to_string(),
		file_name,
		Some(file_path.to_string_lossy().to_string()),
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
pub async fn download_file(app_handle: AppHandle, app_state: State<'_, Mutex<AppState>>, file: File) -> Result<()> {
	let state = app_state.lock().await;
	let blobs = state.comm.blobs.clone();
	let endpoint = state.comm.endpoint.clone();

	let downloader = blobs.store().downloader(&endpoint);

	let file_owner_node_id =
		NodeId::from_str(&file.node_id).map_err(|e| Error::EncodeDecode(format!("Failed to parse nodeId: {}", e)))?;
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
				// pg_per is bytes downloaded so far
				let percent = if file.size > 0 {
					(pg_per as f64 / file.size as f64) * 100.0
				} else {
					0.0
				};
				app_handle.emit(
					"download-progress",
					serde_json::json!({
						"percentage": percent,
						"fileName": file_name,
						"downloaded": pg_per,
						"total": file.size
					})
					.to_string(),
				)?;
			},
			DownloadProgessItem::Error(err) => {
				app_handle.emit(
					"download-progress",
					serde_json::json!({
						"error": format!("Download error: {:?}", err),
						"fileName": file_name
					})
					.to_string(),
				)?;
			},
			DownloadProgessItem::DownloadError => {
				app_handle.emit(
					"download-progress",
					serde_json::json!({
						"error": "Download error occurred",
						"fileName": file_name
					})
					.to_string(),
				)?;
			},
			DownloadProgessItem::PartComplete { .. } => {
				// Optionally emit part complete event
				app_handle.emit(
					"download-progress",
					serde_json::json!({
						"partComplete": true,
						"fileName": file_name
					})
					.to_string(),
				)?;
			},
			DownloadProgessItem::ProviderFailed { .. } => {
				app_handle.emit(
					"download-progress",
					serde_json::json!({
						"providerFailed": true,
						"fileName": file_name
					})
					.to_string(),
				)?;
			},
			_ => (),
		}
	}

	// Emit final 100% event when done
	app_handle.emit(
		"download-progress",
		serde_json::json!({
			"percentage": 100.0,
			"fileName": file.name,
			"downloaded": file.size,
			"total": file.size,
			"complete": true
		})
		.to_string(),
	)?;

	let save_path = std::env::current_dir()?.join(file_name);
	blobs
		.store()
		.blobs()
		.export(file_hash, save_path)
		.await
		.map_err(|e| Error::Generic(anyhow!("Failed to export blob: {}", e)))?;

	let _ = &state.db.update_file(file.id, FileStatus::Downloaded).await?;

	Ok(())
}
