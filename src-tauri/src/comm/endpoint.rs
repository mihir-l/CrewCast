use futures_lite::StreamExt;
use iroh::{protocol::Router, Endpoint, SecretKey};
use iroh_blobs::{store::mem::MemStore, BlobsProtocol};
use iroh_gossip::{
    api::{Event, GossipReceiver, GossipSender},
    net::Gossip,
    proto::TopicId,
};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, State};
use tokio::sync::Mutex;

use crate::{
    database::{
        node::{Node, NodeOperations},
        topic::{Topic, TopicOperations},
        user::{User, UserOperations},
    },
    error::{Error, Result},
    AppState,
};

pub(crate) struct CommState {
    pub endpoint: Endpoint,
    pub gossip: Gossip,
    router: Router,
    pub blobs: BlobsProtocol,
    pub topic_sender: Option<GossipSender>,
}

impl CommState {
    pub async fn init_from_endpoint(endpoint: Endpoint) -> Result<Self> {
        let gossip = new_gossip(endpoint.clone()).await?;

        let store = MemStore::new();
        let blobs = BlobsProtocol::new(&store, endpoint.clone(), None);
        let router = Router::builder(endpoint.clone())
            .accept(iroh_gossip::ALPN, gossip.clone())
            .accept(iroh_blobs::ALPN, blobs.clone())
            .spawn();

        Ok(Self {
            endpoint,
            gossip,
            router,
            topic_sender: None,
            blobs,
        })
    }

    pub async fn close(&mut self) {
        self.gossip.shutdown().await.ok();
        self.endpoint.close().await;
        self.router.shutdown().await.ok();
    }
}

pub async fn create_endpoint(encoded_secret: String) -> Result<Endpoint> {
    let mut key_bytes = [0u8; 32];

    data_encoding::BASE32_NOPAD
        .decode_mut(encoded_secret.as_bytes(), &mut key_bytes)
        .map_err(|_| Error::EncodeDecode("Error Decoding Secret".to_string()))?;

    let secret_key = SecretKey::from_bytes(&key_bytes);

    let endpoint = Endpoint::builder()
        .secret_key(secret_key)
        .discovery_n0()
        .discovery_local_network()
        .bind()
        .await
        .map_err(|e| Error::Endpoint(format!("Failed to bind endpoint: {}", e)))?;
    Ok(endpoint)
}

pub async fn new_gossip(endpoint: Endpoint) -> Result<Gossip> {
    let gossip = Gossip::builder().spawn(endpoint);
    Ok(gossip)
}

pub fn create_secret() -> String {
    let secret_key = SecretKey::generate(rand::rngs::OsRng);
    data_encoding::BASE32_NOPAD.encode(&secret_key.to_bytes())
}

pub fn new_topic() -> TopicId {
    TopicId::from_bytes(rand::random())
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MessageType {
    // This type will be sent by each node in the topic as a heartbeat
    // Will be used to let other nodes know they are still active in the topic
    CheckIn(CheckInMessage),

    // This type will be sent by any node that want to share a message by its user
    Chat(ChatMessage),

    File(FileMessage),
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct UserInfo {
    pub email: String,
    pub first_name: String,
    pub last_name: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct CheckInMessage {
    pub topic_id: String,
    pub sender: String,
    pub ts: i64,
    pub meta: UserInfo,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ChatMessage {
    pub content: String,
    pub sender: String,
    pub ts: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct FileMessage {
    pub file_name: String,
    pub sender: String,
    pub ts: i64,
    pub blob_ticket: String,
}

pub async fn subscribe(
    mut receiver: GossipReceiver,
    sender: GossipSender,
    app_handle: tauri::AppHandle,
    node_id: String,
    topic_id: String,
) -> Result<()> {
    receiver
        .joined()
        .await
        .map_err(|e| Error::GossipSubscription(format!("Failed to join gossip: {}", e)))?;

    let user_info = {
        let state = app_handle.state::<Mutex<UserInfo>>();
        let user_info = state.lock().await.clone();
        user_info
    };
    let check_in_fut = tokio::spawn(async move {
        let user_info = user_info.clone();
        loop {
            let check_in_message = MessageType::CheckIn(CheckInMessage {
                topic_id: topic_id.clone(),
                sender: node_id.clone(),
                ts: chrono::Utc::now().timestamp(),
                meta: user_info.clone(),
            });
            if let Some(message) = serde_json::to_vec(&check_in_message).ok() {
                sender.broadcast(message.into()).await.ok();
            }
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
        }
    });

    while let Some(event) = receiver.try_next().await.ok() {
        if let Some(Event::Received(message)) = event {
            let message_type = serde_json::from_slice::<MessageType>(&message.content)?;
            let to_be_emitted = match message_type {
                MessageType::CheckIn(data) => {
                    let state = app_handle.state::<Mutex<AppState>>();
                    let new_member = data.sender;
                    let _ =
                        update_topic(state, data.topic_id, new_member.clone(), data.meta.clone())
                            .await?;

                    serde_json::json!({
                        "type": "check_in",
                        "sender": new_member,
                        "meta": data.meta
                    })
                    .to_string()
                }
                MessageType::Chat(content) => {
                    // Handle chat message
                    serde_json::json!({
                        "type": "chat",
                        "sender": content.sender,
                        "content": content.content,
                    })
                    .to_string()
                }
                MessageType::File(file) => {
                    // Handle file message
                    serde_json::json!({
                        "type": "file",
                        "sender": file.sender,
                        "fileName": file.file_name,
                        "blobTicket": file.blob_ticket,
                    })
                    .to_string()
                }
            };
            app_handle.emit("gossip-message", to_be_emitted)?;
        }
    }
    check_in_fut.abort(); // Stop the check-in task when the receiver is done
    Ok(())
}

async fn update_topic(
    state: State<'_, Mutex<AppState>>,
    topic_id: String,
    member: String,
    user_info: UserInfo,
) -> Result<Topic> {
    let db = &state.lock().await.db;
    let topic = db.get_topic_by_topic_id(topic_id).await?;

    let node = match db.get_node_by_node_id(member.clone()).await {
        Ok(node) => node,
        Err(_) => {
            let node = Node::new(member.clone(), None);

            db.create_node(node).await?
        }
    };
    if !db.get_user_by_node_id(node.id).await.is_ok() {
        let user = User::new(
            user_info.email,
            user_info.first_name,
            user_info.last_name,
            Some(node.id),
        );
        let _ = db.create_user(user).await?;
    }

    // Ensure that the new member is not already present in the database
    if topic.get_peers().contains(&member) {
        return Ok(topic);
    }

    // Push new members to the existing members vec
    let updated_members = if let Some(mut existing_members) = topic.members {
        existing_members.push(member.clone());
        existing_members
    } else {
        // If this member is not present in the topic, try to add it to the nodes table as well

        vec![member.clone()]
    };

    let topic = db.update_topic(topic.id, updated_members).await?;
    Ok(topic)
}
