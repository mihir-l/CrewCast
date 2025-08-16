-- Add migration script here
CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    node_id TEXT NOT NULL UNIQUE,
    secret_key TEXT
);