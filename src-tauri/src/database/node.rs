use super::Db;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Node {
	pub id: i64,
	pub node_id: String,
	pub(crate) secret_key: Option<String>,
}

impl Node {
	pub(crate) fn new(node_id: String, secret_key: Option<String>) -> Self {
		Self {
			id: 0, // This will be set by the database
			node_id,
			secret_key,
		}
	}
}

pub trait NodeOperations {
	async fn create_node(&self, node: Node) -> Result<Node>;
	async fn get_node_by_id(&self, id: i64) -> Result<Node>;
	async fn get_node_by_node_id(&self, node_id: String) -> Result<Node>;
}

impl NodeOperations for Db {
	async fn create_node(&self, node: Node) -> Result<Node> {
		let node = sqlx::query_as!(
			Node,
			r#"
            INSERT INTO nodes (node_id, secret_key)
            VALUES ($1, $2)
            RETURNING id, node_id, secret_key
            "#,
			node.node_id,
			node.secret_key
		)
		.fetch_one(&self.0)
		.await?;
		Ok(node)
	}

	async fn get_node_by_id(&self, id: i64) -> Result<Node> {
		let node = sqlx::query_as!(
			Node,
			r#"
                SELECT id, node_id, secret_key
                FROM nodes
            WHERE id = $1
            "#,
			id
		)
		.fetch_one(&self.0)
		.await?;
		Ok(node)
	}

	async fn get_node_by_node_id(&self, node_id: String) -> Result<Node> {
		let node = sqlx::query_as!(
			Node,
			r#"
                SELECT id, node_id, secret_key
                FROM nodes
                WHERE node_id = $1
            "#,
			node_id
		)
		.fetch_one(&self.0)
		.await?;

		Ok(node)
	}
}
