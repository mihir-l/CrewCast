use crate::error::Result;

use super::Db;
use serde::{Deserialize, Serialize};
use sqlx::{prelude::Type, FromRow, Row};
use std::collections::HashMap;

pub struct TsFilter {
	pub timestamp: i64,
	pub direction: TsDirection,
}

pub enum TsDirection {
	Newer,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
#[sqlx(type_name = "TEXT")]
pub enum FileStatus {
	Shared,
	Downloaded,
}

impl From<String> for FileStatus {
	fn from(value: String) -> Self {
		match value.as_str() {
			"Shared" => Self::Shared,
			"Downloaded" => Self::Downloaded,
			_ => panic!("Invalid file status"),
		}
	}
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct File {
	pub id: i64,
	pub node_id: String,
	pub topic_id: String,
	pub hash: String,
	pub name: String,
	pub absolute_path: Option<String>,
	pub format: String,
	pub size: i64,
	pub status: FileStatus,
	pub shared_at: i64,
}

impl File {
	#[allow(clippy::too_many_arguments)]
	pub(crate) fn new(
		node_id: String,
		topic_id: String,
		hash: String,
		name: String,
		absolute_path: Option<String>,
		size: i64,
		format: String,
		status: FileStatus,
		shared_at: i64,
	) -> Self {
		Self {
			id: 0, // This will be set by the database
			node_id,
			topic_id,
			hash,
			name,
			absolute_path,
			size,
			format,
			status,
			shared_at,
		}
	}
}

pub trait FileOperations {
	async fn create_file(&self, file: File) -> Result<File>;
	async fn list_files(
		&self,
		topic_id: String,
		node_id: Option<String>,
		ts_filter: Option<TsFilter>,
	) -> Result<Vec<File>>;
	async fn update_file(&self, id: i64, status: FileStatus) -> Result<File>;
	async fn get_file_by_hash(&self, hash: String) -> Result<File>;
	async fn get_latest_file_timestamps_by_members(
		&self,
		topic_id: &str,
		members: &[String],
	) -> Result<HashMap<String, i64>>;
}

impl FileOperations for Db {
	async fn create_file(&self, file: File) -> Result<File> {
		let file = sqlx::query_as!(
			File,
			r#"
                INSERT INTO files (node_id, topic_id, hash, name, absolute_path, size, format, status, shared_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id, node_id, topic_id, hash, name, absolute_path, size, format, status, shared_at
                "#,
			file.node_id,
			file.topic_id,
			file.hash,
			file.name,
			file.absolute_path,
			file.size,
			file.format,
			file.status,
			file.shared_at
		)
		.fetch_one(&self.0)
		.await?;
		Ok(file)
	}

	async fn list_files(
		&self,
		topic_id: String,
		node_id: Option<String>,
		ts_filter: Option<TsFilter>,
	) -> Result<Vec<File>> {
		let mut query = String::from(
        "SELECT id, node_id, topic_id, hash, name, absolute_path, size, format, status, shared_at FROM files WHERE topic_id = ?"
    );
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

		let mut q = sqlx::query_as::<_, File>(&query).bind(&topic_id);
		if let Some(ref node_id) = node_id {
			q = q.bind(node_id);
		}
		if let Some(ts_filter) = ts_filter {
			q = q.bind(ts_filter.timestamp);
		}
		let files = q.fetch_all(&self.0).await?;
		Ok(files)
	}

	async fn update_file(&self, id: i64, status: FileStatus) -> Result<File> {
		let file = sqlx::query_as!(
			File,
			r#"
                UPDATE files
                SET status = $1
                WHERE id = $2
                RETURNING id, node_id, topic_id, hash, name, absolute_path, size, format, status, shared_at
                "#,
			status,
			id
		)
		.fetch_one(&self.0)
		.await?;
		Ok(file)
	}

	async fn get_file_by_hash(&self, hash: String) -> Result<File> {
		let file = sqlx::query_as!(
			File,
			r#"
                SELECT id, node_id, topic_id, hash, name, absolute_path, size, format, status, shared_at
                FROM files
                WHERE hash = $1
                "#,
			hash
		)
		.fetch_one(&self.0)
		.await?;
		Ok(file)
	}

	async fn get_latest_file_timestamps_by_members(
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
                FROM files 
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
