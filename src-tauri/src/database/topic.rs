use crate::comm::endpoint::new_topic;

use super::Db;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Topic {
    pub id: i64,
    pub topic_id: String,
    pub name: String,
    pub owner: String,                // References a node_id from the nodes table
    pub members: Option<Vec<String>>, // JSON array of node_ids
}

impl Topic {
    pub(crate) fn new_topic(name: String, owner: String, members: Option<Vec<String>>) -> Self {
        Self {
            id: 0, // This will be set by the database
            topic_id: new_topic().to_string(),
            name,
            owner,
            members,
        }
    }

    // This is an entry in the current node's db of an existing topic that the node has joined
    pub(crate) fn new_topic_with_id(
        topic_id: String,
        name: String,
        owner: String,
        members: Option<Vec<String>>,
    ) -> Self {
        Self {
            id: 0, // Set by db
            topic_id,
            name,
            owner,
            members,
        }
    }

    pub(crate) fn get_peers(&self) -> Vec<String> {
        let mut peers = vec![self.owner.clone()];
        if let Some(members) = &self.members {
            peers.extend(members.clone());
        }
        peers
    }
}

pub trait TopicOperations {
    async fn create_topic(&self, topic: Topic) -> Result<Topic>;
    async fn get_topic_by_id(&self, id: i64) -> Result<Topic>;
    async fn get_topic_by_topic_id(&self, topic_id: String) -> Result<Topic>;
    async fn list_topics(&self) -> Result<Vec<Topic>>;
    async fn update_topic(&self, id: i64, members: Vec<String>) -> Result<Topic>;
}

impl TopicOperations for Db {
    async fn create_topic(&self, topic: Topic) -> Result<Topic> {
        let members = topic.members.map(|members| members.join(","));
        let record = sqlx::query!(
            r#"
                INSERT INTO topics (topic_id, owner, members, name)
                VALUES ($1, $2, $3, $4)
                RETURNING id, topic_id, owner, members, name
                "#,
            topic.topic_id,
            topic.owner,
            members,
            topic.name,
        )
        .fetch_one(&self.0)
        .await?;
        let topic = Topic {
            id: record.id,
            topic_id: record.topic_id,
            name: record.name,
            owner: record.owner,
            members: record
                .members
                .map(|members| members.split(',').map(String::from).collect()),
        };
        Ok(topic)
    }

    async fn get_topic_by_id(&self, id: i64) -> Result<Topic> {
        let record = sqlx::query!(
            r#"
                SELECT id, topic_id, owner, members, name
                FROM topics
                WHERE id = $1
                "#,
            id
        )
        .fetch_one(&self.0)
        .await?;
        let topic = Topic {
            id: record.id,
            topic_id: record.topic_id,
            name: record.name,
            owner: record.owner,
            members: record
                .members
                .map(|members| members.split(',').map(String::from).collect()),
        };
        Ok(topic)
    }

    async fn get_topic_by_topic_id(&self, topic_id: String) -> Result<Topic> {
        let record = sqlx::query!(
            r#"
                SELECT id, topic_id, owner, members, name
                FROM topics
                WHERE topic_id = $1
                "#,
            topic_id
        )
        .fetch_one(&self.0)
        .await?;

        let topic = Topic {
            id: record.id,
            topic_id: record.topic_id,
            name: record.name,
            owner: record.owner,
            members: record
                .members
                .map(|members| members.split(',').map(String::from).collect()),
        };
        Ok(topic)
    }

    async fn list_topics(&self) -> Result<Vec<Topic>> {
        let records = sqlx::query!(
            r#"
                SELECT id, topic_id, owner, members, name
                FROM topics
                "#
        )
        .fetch_all(&self.0)
        .await?;
        let topics = records
            .into_iter()
            .map(|record| Topic {
                id: record.id,
                topic_id: record.topic_id,
                name: record.name,
                owner: record.owner,
                members: record
                    .members
                    .map(|members| members.split(',').map(String::from).collect()),
            })
            .collect();
        Ok(topics)
    }

    async fn update_topic(&self, id: i64, members: Vec<String>) -> Result<Topic> {
        let members = members.join(",");
        let record = sqlx::query!(
            r#"
                UPDATE topics
                SET members = $1
                WHERE id = $2
                RETURNING id, topic_id, owner, members, name
                "#,
            members,
            id
        )
        .fetch_one(&self.0)
        .await?;

        let topic = Topic {
            id: record.id,
            topic_id: record.topic_id,
            owner: record.owner,
            members: record
                .members
                .map(|members| members.split(',').map(String::from).collect()),
            name: record.name,
        };
        Ok(topic)
    }
}
