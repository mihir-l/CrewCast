use crate::{
    comm::{endpoint::create_secret, model::UserInfo, state::CommState},
    database::{
        node::{Node, NodeOperations},
        topic::Topic,
        user::UserOperations,
        Db,
    },
    error::Result,
};
use iroh::Endpoint;
use tauri::{async_runtime, Manager};
use tokio::sync::Mutex;
mod comm;
mod commands;
mod database;
mod error;

pub(crate) struct AppState {
    pub db: Db,
    pub comm: CommState,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::send_message,
            commands::user::get_user_by_node_id,
            commands::user::get_user_by_id,
            commands::user::create_user,
            commands::node::get_node_by_id,
            commands::topic::start_new_topic,
            commands::topic::join_topic_with_ticket,
            commands::topic::join_topic_with_id,
            commands::topic::list_topics,
            commands::topic::get_topic_by_topic_id,
            commands::topic::leave_topic,
            commands::topic::get_ticket_for_topic,
            commands::file::share_file,
            commands::file::download_file,
            commands::file::list_files
        ])
        .setup(|app| {
            async_runtime::block_on(async {
                let password =
                    std::env::var("DATABASE_PASSWORD").unwrap_or_else(|_| "password".into());
                let data_dir = app
                    .path()
                    .app_data_dir()
                    .expect("failed to get app data dir");
                if !data_dir.exists() {
                    std::fs::create_dir_all(&data_dir).expect("failed to create data directory");
                }
                let db_path = data_dir.join("data.db");

                // create the database pool
                let pool = Db::init(&db_path.to_string_lossy().to_string(), password)
                    .await
                    .expect("failed to initialize database");

                let endpoint = init_node(&pool).await.expect("failed to initialize node");
                let comm = CommState::init_from_endpoint(endpoint, data_dir)
                    .await
                    .expect("failed to initialize comm state");
                let app_state = AppState { db: pool, comm };

                match &app_state.db.get_user_by_id(1).await {
                    Ok(user) => {
                        app.manage(Mutex::new(UserInfo {
                            id: user.id,
                            email: user.email.clone(),
                            first_name: user.first_name.clone(),
                            last_name: user.last_name.clone(),
                        }));
                    }
                    Err(_) => {
                        app.manage(Mutex::new(UserInfo::default()));
                    }
                }
                app.manage(Mutex::new(app_state));
                let active_topic: Option<Topic> = None;
                app.manage(Mutex::new(active_topic));
            });

            Ok(())
        });

    let rt = builder
        .build(tauri::generate_context!())
        .expect("failed to build Tauri app");

    rt.run(move |app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            tauri::async_runtime::block_on(async {
                let app_state = app_handle.state::<Mutex<AppState>>();
                let mut app_state = app_state.lock().await;
                app_state.comm.close().await;
                app_state
                    .db
                    .close()
                    .await
                    .expect("failed to close database");
            });
        }
    });
}

async fn init_node(db: &database::Db) -> Result<Endpoint> {
    // Try to get node with id 1
    let endpoint = match db.get_node_by_id(1).await {
        Ok(node) => comm::endpoint::create_endpoint(node.secret_key.unwrap())
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create endpoint: {}", e))?,
        Err(_) => {
            let secret_key = create_secret();
            let endpoint = comm::endpoint::create_endpoint(secret_key.clone())
                .await
                .map_err(|e| anyhow::anyhow!("Failed to create endpoint: {}", e))?;
            let node = Node {
                id: 1,
                node_id: endpoint.node_id().to_string(),
                secret_key: Some(secret_key),
            };
            db.create_node(node).await?;
            endpoint
        }
    };
    Ok(endpoint)
}
