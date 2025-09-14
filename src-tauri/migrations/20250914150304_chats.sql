-- Add migration script here
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    node_id TEXT NOT NULL, -- Sender of the chat message
    topic_id TEXT NOT NULL, -- Topic in which the chat message is sent
    hash TEXT NOT NULL, -- Hash to denote a unique message
    message TEXT NOT NULL,
    shared_at INTEGER NOT NULL
);