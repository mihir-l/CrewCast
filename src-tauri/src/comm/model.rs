use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MessageType {
    // This type will be sent by each node in the topic as a heartbeat
    // Will be used to let other nodes know they are still active in the topic
    CheckIn(Message<CheckIn>),

    // This type will be sent by any node that want to share a message by its user
    Chat(Message<Chat>),

    // This type will be sent by any node that wants to share a file
    File(Message<File>),
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Metadata {
    pub user: UserInfo,
    pub ts: i64,
    pub sender: String,
}

impl Metadata {
    pub fn new(user: UserInfo, sender: String, ts: Option<i64>) -> Self {
        let ts = match ts {
            Some(ts) => ts,
            None => chrono::Utc::now().timestamp(),
        };
        Self { user, sender, ts }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Message<T> {
    pub data: T,
    pub metadata: Metadata,
}

impl<T> Message<T> {
    pub fn new(data: T, metadata: Metadata) -> Self {
        Self { data, metadata }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct UserInfo {
    #[serde(skip)]
    pub id: i64,
    pub email: String,
    pub first_name: String,
    pub last_name: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct CheckIn {
    pub topic_id: String,
}

impl CheckIn {
    pub fn new(topic_id: String) -> Self {
        Self { topic_id }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Chat {
    pub content: String,
}

impl Chat {
    pub fn new(content: String) -> Self {
        Self { content }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct File {
    pub file_name: String,
    pub blob_ticket: String,
    pub size: i64,
}

impl File {
    pub fn new(file_name: String, blob_ticket: String, size: i64) -> Self {
        Self {
            file_name,
            blob_ticket,
            size,
        }
    }
}
