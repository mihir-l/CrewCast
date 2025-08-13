use crate::{
    comm::endpoint::{create_secret, CommState},
    database::{
        node::{Node, NodeOperations},
        Db,
    },
};
use iroh::Endpoint;
use tauri::{async_runtime, Manager};
use tokio::sync::Mutex;
mod comm;
mod commands;
mod database;

pub(crate) struct AppState {
    pub db: Db,
    pub comm: CommState,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::send_message,
            commands::start_new_topic,
            commands::join_topic
        ])
        .setup(|app| {
            async_runtime::block_on(async {
                let password =
                    std::env::var("DATABASE_PASSWORD").unwrap_or_else(|_| "password".into());
                // let data_dir = app
                //     .path()
                //     .app_data_dir()
                //     .expect("failed to get app data dir");
                let data_dir = std::env::current_dir().unwrap();
                if !data_dir.exists() {
                    std::fs::create_dir_all(&data_dir).expect("failed to create data directory");
                }
                let db_path = data_dir.join("data.db");

                // create the database pool
                let pool = Db::init(&db_path.to_string_lossy().to_string(), password)
                    .await
                    .expect("failed to initialize database");
                let endpoint = init_node(&pool).await.expect("failed to initialize node");
                let app_state = AppState {
                    db: pool,
                    comm: CommState::init_from_endpoint(endpoint)
                        .await
                        .expect("failed to initialize comm state"),
                };

                app.manage(Mutex::new(app_state));
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

async fn init_node(db: &database::Db) -> Result<Endpoint, anyhow::Error> {
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
