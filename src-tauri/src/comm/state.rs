use std::path::PathBuf;

use iroh::{protocol::Router, Endpoint};
use iroh_blobs::{store::fs::FsStore, BlobsProtocol};
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
    pub store: FsStore,
}

impl CommState {
    pub async fn init_from_endpoint(endpoint: Endpoint, store_path: PathBuf) -> Result<Self> {
        let gossip = new_gossip(endpoint.clone()).await?;

        let store = FsStore::load(store_path).await?;
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
            store,
        })
    }

    pub async fn close(&mut self) {
        self.store.dump().await.ok();
        self.gossip.shutdown().await.ok();
        self.endpoint.close().await;
        self.router.shutdown().await.ok();
        self.blobs.shutdown().await.ok();
    }
}
