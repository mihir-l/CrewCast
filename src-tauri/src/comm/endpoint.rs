use anyhow::Result;
use base64::prelude::*;
use futures_lite::StreamExt;
use iroh::{
    endpoint,
    protocol::{Router, RouterBuilder},
    Endpoint, PublicKey, SecretKey, Watcher,
};
use iroh_gossip::{
    api::{Event, GossipReceiver, GossipSender},
    net::Gossip,
    proto::{topic, TopicId},
};
use tauri::Emitter;

use crate::comm::ticket::Ticket;

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

pub async fn get_or_create_topic(
    endpoint: Endpoint,
    ticket: Option<Ticket>,
) -> Result<(TopicId, Vec<PublicKey>)> {
    match ticket {
        Some(ticket) => {
            // Use the provided ticket to get the topic ID and peer IDs
            println!("Using provided ticket: {}", ticket);
            Ok((ticket.topic, ticket.nodes.iter().map(|nid| *nid).collect()))
        }
        None => {
            let topic_id = TopicId::from_bytes(rand::random());
            let peer_ids: Vec<PublicKey> = vec![];

            let ticket = Ticket {
                topic: topic_id,
                nodes: vec![endpoint.node_id()],
            };

            println!("Ticket: {}", ticket);
            Ok((topic_id, peer_ids))
        }
    }
}

pub async fn start(
    rx: tokio::sync::mpsc::Receiver<String>,
    ticket: Option<Ticket>,
    app_handle: tauri::AppHandle,
) -> Result<()> {
    let encoded_secret = create_secret();
    let endpoint = create_endpoint(encoded_secret).await?;

    let gossip = new_gossip(endpoint.clone()).await?;
    let router = new_router(endpoint.clone(), gossip.clone()).await?.spawn();

    let (topic_id, peer_ids) = get_or_create_topic(endpoint.clone(), ticket).await?;

    let (sender, receiver) = gossip.subscribe(topic_id, peer_ids).await?.split();

    let handle = tokio::spawn(subscribe(receiver, app_handle));

    let sender_handle = tokio::spawn(sender_fut(sender, rx));

    handle.await??;
    sender_handle.await??;
    router.shutdown().await?;
    Ok(())
}

async fn subscribe(mut receiver: GossipReceiver, app_handle: tauri::AppHandle) -> Result<()> {
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
                    "sender": message.delivered_from,
                    "content": String::from_utf8(message.content.to_vec())?
                }),
            )?;
        }
    }
    Ok(())
}

async fn sender_fut(
    sender: GossipSender,
    mut rx: tokio::sync::mpsc::Receiver<String>,
) -> Result<()> {
    while let Some(message) = rx.recv().await {
        sender.broadcast(message.into()).await?;
    }
    Ok(())
}
