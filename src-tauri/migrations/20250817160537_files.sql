-- Add migration script here
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    node_id TEXT NOT NULL, -- Owner of the file the node_id
    topic_id TEXT NOT NULL, -- Topic in which the file is shared
    hash TEXT NOT NULL,
    name TEXT NOT NULL,
    format TEXT NOT NULL,
    size INTEGER NOT NULL,
    status TEXT NOT NULL, -- Status of the file (e.g., "SHARED", "DOWNLOADED")
    shared_at INTEGER NOT NULL
);