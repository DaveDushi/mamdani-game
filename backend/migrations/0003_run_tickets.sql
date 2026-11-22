CREATE TABLE IF NOT EXISTS run_tickets (
    ticket TEXT PRIMARY KEY,
    season TEXT NOT NULL,
    player_id TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('day', 'night')),
    started_at INTEGER NOT NULL,
    final_score INTEGER CHECK (final_score >= 0)
);
CREATE INDEX IF NOT EXISTS run_tickets_by_player ON run_tickets (player_id, started_at);
CREATE INDEX IF NOT EXISTS run_tickets_by_start ON run_tickets (started_at);
