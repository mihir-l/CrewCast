use iroh::{Endpoint, SecretKey};
use iroh_gossip::{net::Gossip, proto::TopicId};

use crate::{
    comm::model::UserInfo,
    database::{
        node::{Node, NodeOperations},
        topic::{Topic, TopicOperations},
        user::{User, UserOperations},
        Db,
    },
    error::{Error, Result},
};

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

pub async fn update_topic(
    db: &Db,
    topic_id: String,
    member: String,
    user_info: UserInfo,
) -> Result<Topic> {
    let topic = db.get_topic_by_topic_id(topic_id).await?;

    let node = match db.get_node_by_node_id(member.clone()).await {
        Ok(node) => node,
        Err(_) => {
            let node = Node::new(member.clone(), None);

            db.create_node(node).await?
        }
    };
    if db.get_user_by_node_id(node.id).await.is_err() {
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
