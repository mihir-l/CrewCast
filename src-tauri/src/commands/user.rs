use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use tauri::State;

use crate::{
	comm::model::UserInfo,
	database::{
		node::NodeOperations,
		user::{User, UserOperations},
	},
	error::Result,
	AppState,
};

#[tauri::command]
pub async fn get_user_by_node_id(app_state: State<'_, Mutex<AppState>>, node_id: String) -> Result<User> {
	let state = app_state.lock().await;
	let db = &state.db;
	let node = db.get_node_by_node_id(node_id).await?;
	let user = db.get_user_by_node_id(node.id).await?;

	Ok(user)
}

#[tauri::command]
pub async fn get_user_by_id(app_state: State<'_, Mutex<AppState>>, userid: i64) -> Result<User> {
	let state = app_state.lock().await;
	let db = &state.db;
	let user = db.get_user_by_id(userid).await?;

	Ok(user)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserRequest {
	email: String,
	first_name: String,
	last_name: Option<String>,
	node_id: String,
}

#[tauri::command]
pub async fn create_user(
	app_state: State<'_, Mutex<AppState>>,
	user_info: State<'_, Mutex<UserInfo>>,
	user: CreateUserRequest,
) -> Result<User> {
	let state = app_state.lock().await;
	let db = &state.db;
	let node = db.get_node_by_node_id(user.node_id).await?;
	let user = db
		.create_user(User::new(user.email, user.first_name, user.last_name, Some(node.id)))
		.await?;

	if node.id == 1 {
		*user_info.lock().await = UserInfo {
			id: user.id,
			email: user.email.clone(),
			first_name: user.first_name.clone(),
			last_name: user.last_name.clone(),
		};
	}

	Ok(user)
}
