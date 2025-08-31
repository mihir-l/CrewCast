use iroh::{protocol::Router, Endpoint};
use iroh_blobs::{store::mem::MemStore, BlobsProtocol};
use iroh_gossip::{api::GossipSender, net::Gossip};
use tauri::async_runtime::JoinHandle;
use tokio_util::sync::CancellationToken;

use crate::{comm::endpoint::new_gossip, error::Result};

pub(crate) struct CommState {
    pub endpoint: Endpoint,
    pub gossip: Gossip,
    router: Router,
    pub blobs: BlobsProtocol,
    pub topic_sender: Option<GossipSender>,
    pub topic_subscriber: Option<JoinHandle<()>>,
    pub topic_cancel_token: Option<CancellationToken>,
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
            topic_subscriber: None,
            topic_cancel_token: None,
        })
    }

    pub async fn close(&mut self) {
        self.gossip.shutdown().await.ok();
        self.endpoint.close().await;
        self.router.shutdown().await.ok();
    }
}
