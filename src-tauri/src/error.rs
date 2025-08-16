use serde::{ser::SerializeStruct, Serialize, Serializer};

#[derive(Debug, thiserror::Error)]

pub enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Database(#[from] sqlx::Error),

    #[error(transparent)]
    Migration(#[from] sqlx::migrate::MigrateError),

    #[error(transparent)]
    Generic(#[from] anyhow::Error),

    #[error("EncodeDecode error: {0}")]
    EncodeDecode(String),

    #[error("Endpoint error: {0}")]
    Endpoint(String),

    #[error("Gossip Subscription error: {0}")]
    GossipSubscription(String),

    #[error(transparent)]
    Serde(#[from] serde_json::Error),

    #[error(transparent)]
    Tauri(#[from] tauri::Error),
}

impl Error {
    fn code(&self) -> &str {
        match self {
            Error::Io(_) => "io",
            Error::Database(_) => "database",
            Error::Migration(_) => "database",
            Error::Generic(_) => "generic",
            Error::EncodeDecode(_) => "encode_decode",
            Error::Endpoint(_) => "endpoint",
            Error::GossipSubscription(_) => "gossip_subscription",
            Error::Serde(_) => "serde",
            Error::Tauri(_) => "tauri",
        }
    }

    fn message(&self) -> String {
        match self {
            Error::Io(err) => err.to_string(),
            Error::Database(err) => err.to_string(),
            Error::Migration(err) => err.to_string(),
            Error::Generic(err) => err.to_string(),
            Error::EncodeDecode(msg) => msg.clone(),
            Error::Endpoint(msg) => msg.clone(),
            Error::GossipSubscription(msg) => msg.clone(),
            Error::Serde(err) => err.to_string(),
            Error::Tauri(err) => err.to_string(),
        }
    }
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("Error", 2)?;
        state.serialize_field("code", &self.code())?;
        state.serialize_field("message", &self.message())?;
        state.end()
    }
}

pub type Result<T, E = Error> = anyhow::Result<T, E>;
