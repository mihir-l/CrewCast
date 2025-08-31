use super::Db;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: i64,
    pub email: String,
    pub first_name: String,
    pub last_name: Option<String>,
    pub node_id: Option<i64>,
}

impl User {
    pub(crate) fn new(
        email: String,
        first_name: String,
        last_name: Option<String>,
        node_id: Option<i64>,
    ) -> Self {
        Self {
            id: 0,
            email,
            first_name,
            last_name,
            node_id,
        }
    }
}

pub trait UserOperations {
    async fn create_user(&self, user: User) -> Result<User>;
    async fn get_user_by_id(&self, id: i64) -> Result<User>;
    async fn get_user_by_node_id(&self, node_id: i64) -> Result<User>;
}

impl UserOperations for Db {
    async fn create_user(&self, user: User) -> Result<User> {
        let user = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (node_id, email, first_name, last_name)
            VALUES ($1, $2, $3, $4)
            RETURNING id, node_id, email, first_name, last_name
            "#,
            user.node_id,
            user.email,
            user.first_name,
            user.last_name
        )
        .fetch_one(&self.0)
        .await?;
        Ok(user)
    }

    async fn get_user_by_id(&self, id: i64) -> Result<User> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT id, node_id, email, first_name, last_name
            FROM users
            WHERE id = $1
            "#,
            id
        )
        .fetch_one(&self.0)
        .await?;
        Ok(user)
    }

    async fn get_user_by_node_id(&self, node_id: i64) -> Result<User> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT id, node_id, email, first_name, last_name
            FROM users
            WHERE node_id = $1
            "#,
            node_id
        )
        .fetch_one(&self.0)
        .await?;
        Ok(user)
    }
}
