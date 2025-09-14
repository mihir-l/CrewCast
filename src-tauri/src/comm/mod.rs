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
		model::{CheckIn, MessageType, SyncBatchUpdate, SyncInfo, UserInfo},
	},
	database::{
		chat::{Chat, ChatOperations},
		common::{TsDirection, TsFilter},
		file::{File, FileOperations, FileStatus},
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
const MAX_CHATS_PER_BATCH: usize = 100; // Chats are smaller, so we can send more per batch

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
				},
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
					if let Some(&sync_info) = msg.data.sync.get(&my_node_id) {
						let files = db
							.list_files(
								topic_id.clone(),
								Some(my_node_id.clone()),
								Some(TsFilter {
									timestamp: sync_info.latest_file_ts,
									direction: TsDirection::Newer,
								}),
							)
							.await?;

						let chats = db
							.list_chats(
								topic_id.clone(),
								Some(my_node_id.clone()),
								Some(TsFilter {
									timestamp: sync_info.latest_chat_ts,
									direction: TsDirection::Newer,
								}),
							)
							.await?;

						let mut batch_files: Vec<model::File> = Vec::with_capacity(files.len());
						// Send files as a batch if there are any
						if !files.is_empty() {
							let my_node_addr = my_endpoint.node_addr().get().unwrap();

							// Convert database files to model files
							batch_files = files
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

									model::File::new(file.name.clone(), ticket.to_string(), file.size, file.shared_at)
								})
								.collect();
						}

						let mut batch_chats: Vec<model::ChatMessage> = Vec::with_capacity(chats.len());
						if !chats.is_empty() {
							batch_chats = chats
								.iter()
								.rev() // Send newest first
								.map(|chat| {
									model::ChatMessage::new(
										chat.message.clone(),
										chat.topic_id.clone(),
										chat.hash.clone(),
										chat.shared_at,
									)
								})
								.collect();
						}

						// Send files in chunks if too many
						if !batch_files.is_empty() || !batch_chats.is_empty() {
							// Calculate how many sync batches we need to send
							let max_files_per_batch = MAX_FILES_PER_BATCH;
							let max_chats_per_batch = MAX_CHATS_PER_BATCH;

							let file_chunks = if batch_files.is_empty() {
								vec![Vec::new()]
							} else {
								batch_files
									.chunks(max_files_per_batch)
									.map(|chunk| chunk.to_vec())
									.collect::<Vec<_>>()
							};

							let chat_chunks = if batch_chats.is_empty() {
								vec![Vec::new()]
							} else {
								batch_chats
									.chunks(max_chats_per_batch)
									.map(|chunk| chunk.to_vec())
									.collect::<Vec<_>>()
							};

							// Determine how many batches we need (max of file chunks and chat chunks)
							let num_batches = file_chunks.len().max(chat_chunks.len());

							for i in 0..num_batches {
								let files_for_batch = file_chunks.get(i).cloned().unwrap_or_default();
								let chats_for_batch = chat_chunks.get(i).cloned().unwrap_or_default();

								// Only send batch if there's something to send
								if !files_for_batch.is_empty() || !chats_for_batch.is_empty() {
									let metadata = model::Metadata::new(me.clone(), my_node_id.clone(), None);
									let batch_message = model::Message::new(
										SyncBatchUpdate::new(files_for_batch, chats_for_batch, target_node.clone()),
										metadata,
									);
									let message = MessageType::SyncBatchUpdate(batch_message);

									// Send batch message
									if let Ok(serialized) = serde_json::to_vec(&message) {
										topic_sender.broadcast(serialized.into()).await.ok();
									}
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
				},
				MessageType::Chat(msg) => {
					let state = app_handle.state::<Mutex<AppState>>();
					let db = &state.lock().await.db;
					// write to DB
					match db
						.create_chat(Chat::new(
							msg.metadata.sender.clone(),
							msg.data.topic_id.clone(),
							Some(msg.data.hash.clone()),
							msg.data.content.clone(),
							msg.data.shared_at,
						))
						.await
					{
						Ok(created_chat) => Some(
							serde_json::json!({
								"type": "chat",
								"sender": msg.metadata.sender,
								"content": msg.data.content,
								"chat": created_chat
							})
							.to_string(),
						),
						Err(e) => {
							eprintln!("Failed to create chat: {}", e);
							None
						},
					}
				},
				MessageType::File(msg) => {
					let file = msg.data;
					let metadata = msg.metadata;

					// Parse blob ticket
					let ticket = match file.blob_ticket.parse::<BlobTicket>() {
						Ok(ticket) => ticket,
						Err(e) => {
							eprintln!("Failed to parse blob ticket: {}", e);
							continue;
						},
					};

					// Check if file already exists
					if db.get_file_by_hash(ticket.hash().to_string()).await.is_err() {
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
				},
				MessageType::SyncBatchUpdate(msg) => {
					let batch = msg.data;
					let metadata = msg.metadata;
					let mut created_files = Vec::new();
					let mut created_chats = Vec::new();

					// Only process batch if it was intended for us or everyone
					if batch.sync_request_node == my_node_id || batch.sync_request_node.is_empty() {
						// Process files in the batch
						for file in batch.files {
							// Parse blob ticket
							let ticket = match file.blob_ticket.parse::<BlobTicket>() {
								Ok(ticket) => ticket,
								Err(e) => {
									eprintln!("Failed to parse blob ticket in batch: {}", e);
									continue;
								},
							};

							// Check if file already exists
							if db.get_file_by_hash(ticket.hash().to_string()).await.is_err() {
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

						// Process chats in the batch
						for chat in batch.chats {
							match db
								.create_chat(Chat::new(
									metadata.sender.clone(),
									chat.topic_id.clone(),
									Some(chat.hash.clone()),
									chat.content.clone(),
									chat.shared_at,
								))
								.await
							{
								Ok(new_chat) => created_chats.push(new_chat),
								Err(e) => eprintln!("Failed to create chat from batch: {}", e),
							}
						}

						// Emit appropriate events based on what was created
						if !created_files.is_empty() && !created_chats.is_empty() {
							Some(
								serde_json::json!({
									"type": "sync_batch_update",
									"files": created_files,
									"chats": created_chats,
									"sender": metadata.sender
								})
								.to_string(),
							)
						} else if !created_files.is_empty() {
							Some(
								serde_json::json!({
									"type": "file_batch",
									"files": created_files,
									"sender": metadata.sender
								})
								.to_string(),
							)
						} else if !created_chats.is_empty() {
							Some(
								serde_json::json!({
									"type": "chat_batch",
									"chats": created_chats,
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
				},
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
	let mut check_in = model::Message::new(CheckIn::new(topic_id.clone(), HashMap::new()), metadata);

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
		let should_refresh_members =
			cached_members.is_empty() || (current_time - last_member_refresh) > MEMBER_CACHE_REFRESH_INTERVAL;

		if should_refresh_members {
			let topic = db.get_topic_by_topic_id(topic_id.clone()).await?;
			let new_members = topic.get_peers();

			// Check if membership changed
			let members_changed =
				new_members.len() != cached_members.len() || !new_members.iter().all(|m| cached_members.contains(m));

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
			let file_timestamps = db
				.get_latest_file_timestamps_by_members(&topic_id, &other_members)
				.await?;

			let chat_timestamps = db
				.get_latest_chat_timestamps_by_members(&topic_id, &other_members)
				.await?;

			// Populate sync_map with results
			for (member, file_timestamp) in file_timestamps {
				let chat_timestamp = chat_timestamps.get(&member).cloned().unwrap_or(0);
				sync_map.insert(
					member,
					SyncInfo {
						latest_file_ts: file_timestamp,
						latest_chat_ts: chat_timestamp,
					},
				);
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
