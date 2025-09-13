use std::str::FromStr;

use sqlx::{migrate::Migrator, sqlite::SqliteConnectOptions, Pool, Sqlite};

use crate::error::Result;

pub(crate) mod file;
pub(crate) mod node;
pub(crate) mod topic;
pub(crate) mod user;
static MIGRATOR: Migrator = sqlx::migrate!();

#[derive(Debug, Clone)]
pub struct Db(Pool<Sqlite>);

impl Db {
	pub async fn init(db_path: &str, passphrase: String) -> Result<Self> {
		let opts = SqliteConnectOptions::from_str(db_path)?
			.pragma("key", passphrase)
			.journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
			.create_if_missing(true);
		let pool = Pool::<Sqlite>::connect_with(opts).await?;
		MIGRATOR.run(&pool).await?;
		Ok(Self(pool))
	}

	pub async fn close(&self) -> Result<()> {
		self.0.close().await;
		Ok(())
	}
}
