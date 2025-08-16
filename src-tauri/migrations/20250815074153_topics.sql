-- Add migration script here
CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    topic_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    owner TEXT NOT NULL,
    members TEXT
);