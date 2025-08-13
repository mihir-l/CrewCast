use anyhow::Result;
use base64::prelude::*;
use futures_lite::StreamExt;
use iroh::{
    protocol::{Router, RouterBuilder},
    Endpoint, SecretKey,
};
use iroh_gossip::{
    api::{Event, GossipReceiver, GossipSender},
    net::Gossip,
    proto::TopicId,
};
use tauri::Emitter;

pub(crate) struct CommState {
    pub endpoint: Endpoint,
    pub gossip: Gossip,
    router: Router,
    pub topic_sender: Option<GossipSender>,
}

impl CommState {
    pub async fn init_from_endpoint(endpoint: Endpoint) -> Result<Self> {
        let gossip = new_gossip(endpoint.clone()).await?;
        let router = new_router(endpoint.clone(), gossip.clone())
            .await
            .expect("Failed to create router")
            .spawn();
        Ok(Self {
            endpoint,
            gossip,
            router,
            topic_sender: None,
        })
    }

    pub async fn close(&mut self) {
        self.gossip.shutdown().await.ok();
        self.endpoint.close().await;
        self.router.shutdown().await.ok();
    }
}

pub async fn create_endpoint(encoded_secret: String) -> Result<Endpoint> {
    let decoded = BASE64_STANDARD
        .decode(encoded_secret)
        .map_err(|e| anyhow::anyhow!("Invalid secret key: {}", e))?;
    let key_bytes: [u8; 32] = decoded
        .try_into()
        .map_err(|_| anyhow::anyhow!("Secret key must be 32 bytes long"))?;

    let secret_key = SecretKey::from_bytes(&key_bytes);

    let endpoint = Endpoint::builder()
        .secret_key(secret_key)
        .discovery_n0()
        .discovery_local_network()
        .bind()
        .await?;
    Ok(endpoint)
}

pub async fn new_gossip(endpoint: Endpoint) -> Result<Gossip> {
    let gossip = Gossip::builder().spawn(endpoint);
    Ok(gossip)
}

pub async fn new_router(endpoint: Endpoint, gossip: Gossip) -> Result<RouterBuilder> {
    let router = Router::builder(endpoint).accept(iroh_gossip::ALPN, gossip);
    Ok(router)
}

pub fn create_secret() -> String {
    let secret_key = SecretKey::generate(rand::rngs::OsRng);
    BASE64_STANDARD.encode(secret_key.to_bytes())
}

pub fn new_topic() -> TopicId {
    TopicId::from_bytes(rand::random())
}

pub async fn subscribe(mut receiver: GossipReceiver, app_handle: tauri::AppHandle) -> Result<()> {
    while let Some(event) = receiver.try_next().await? {
        if let Event::Received(message) = event {
            println!(
                "got message from {} \n Message: {}",
                message.delivered_from.fmt_short(),
                String::from_utf8(message.content.to_vec())?
            );
            app_handle.emit(
                "gossip-message",
                serde_json::json!({
                    "sender": message.delivered_from.fmt_short(),
                    "content": String::from_utf8(message.content.to_vec())?
                }),
            )?;
        }
    }
    Ok(())
}
