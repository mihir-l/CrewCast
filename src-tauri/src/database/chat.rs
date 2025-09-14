use crate::{
	database::common::{TsDirection, TsFilter},
	error::Result,
};

use super::Db;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Chat {
	pub id: i64,
	pub node_id: String,
	pub topic_id: String,
	pub hash: String,
	pub message: String,
	pub shared_at: i64,
}

impl Chat {
	pub(crate) fn new(
		node_id: String,
		topic_id: String,
		hash: Option<String>,
		message: String,
		shared_at: i64,
	) -> Self {
		let chat = Self {
			id: 0, // This will be set by the database
			node_id,
			topic_id,
			hash: String::new(), // Placeholder for hash, will be set below
			message,
			shared_at,
		};
		let hash = match hash {
			Some(hash) => hash,
			None => chat.generate_hash(),
		};
		Chat { hash, ..chat }
	}

	fn generate_hash(&self) -> String {
		use std::collections::hash_map::DefaultHasher;
		use std::hash::{Hash, Hasher};

		let mut hasher = DefaultHasher::new();
		self.node_id.hash(&mut hasher);
		self.topic_id.hash(&mut hasher);
		self.message.hash(&mut hasher);
		self.shared_at.hash(&mut hasher);
		format!("{:x}", hasher.finish())
	}
}

pub trait ChatOperations {
	async fn create_chat(&self, chat: Chat) -> Result<Chat>;
	async fn list_chats(
		&self,
		topic_id: String,
		node_id: Option<String>,
		ts_filter: Option<TsFilter>,
	) -> Result<Vec<Chat>>;
	async fn get_latest_chat_timestamps_by_members(
		&self,
		topic_id: &str,
		members: &[String],
	) -> Result<HashMap<String, i64>>;
}

impl ChatOperations for Db {
	async fn create_chat(&self, chat: Chat) -> Result<Chat> {
		let chat = sqlx::query_as!(
			Chat,
			r#"
                INSERT INTO chats (node_id, topic_id, hash, message, shared_at)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, node_id, topic_id, hash, message, shared_at
                "#,
			chat.node_id,
			chat.topic_id,
			chat.hash,
			chat.message,
			chat.shared_at
		)
		.fetch_one(&self.0)
		.await?;
		Ok(chat)
	}

	async fn list_chats(
		&self,
		topic_id: String,
		node_id: Option<String>,
		ts_filter: Option<TsFilter>,
	) -> Result<Vec<Chat>> {
		let mut query =
			String::from("SELECT id, node_id, topic_id, hash, message, shared_at FROM chats WHERE topic_id = ?");
		if node_id.is_some() {
			query.push_str(" AND node_id = ?");
		}
		if let Some(ts_filter) = ts_filter.as_ref() {
			query.push_str(" AND shared_at ");
			query.push_str(match ts_filter.direction {
				TsDirection::Newer => ">",
			});
			query.push_str(" ?");
		}
		query.push_str(" ORDER BY shared_at DESC");

		let mut q = sqlx::query_as::<_, Chat>(&query).bind(&topic_id);
		if let Some(ref node_id) = node_id {
			q = q.bind(node_id);
		}
		if let Some(ts_filter) = ts_filter {
			q = q.bind(ts_filter.timestamp);
		}
		let chats = q.fetch_all(&self.0).await?;
		Ok(chats)
	}

	async fn get_latest_chat_timestamps_by_members(
		&self,
		topic_id: &str,
		members: &[String],
	) -> Result<HashMap<String, i64>> {
		let mut result = HashMap::new();

		if members.is_empty() {
			return Ok(result);
		}

		// Create placeholders for SQL IN clause
		let placeholders = members.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
		let query = format!(
			r#"
                SELECT node_id, MAX(shared_at) as latest_timestamp
                FROM chats
                WHERE topic_id = ? AND node_id IN ({})
                GROUP BY node_id
                "#,
			placeholders
		);

		let mut query_builder = sqlx::query(&query).bind(topic_id);
		for member in members {
			query_builder = query_builder.bind(member);
		}

		let rows = query_builder.fetch_all(&self.0).await?;

		for row in rows {
			let node_id: String = row.get("node_id");
			let timestamp: Option<i64> = row.get("latest_timestamp");
			result.insert(node_id, timestamp.unwrap_or(0));
		}

		// Fill in 0 for members with no files
		for member in members {
			result.entry(member.clone()).or_insert(0);
		}

		Ok(result)
	}
}
