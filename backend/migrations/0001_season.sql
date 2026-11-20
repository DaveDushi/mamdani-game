CREATE TABLE IF NOT EXISTS season_scores (
    season TEXT NOT NULL,
    player_id TEXT NOT NULL REFERENCES players(player_id),
    score INTEGER NOT NULL CHECK (score >= 0),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (season, player_id)
);
CREATE INDEX IF NOT EXISTS season_scores_by_distance
    ON season_scores (season, score DESC, created_at, player_id);

CREATE TABLE IF NOT EXISTS season_claims (
    season TEXT NOT NULL,
    player_id TEXT NOT NULL REFERENCES players(player_id),
    attempt_id TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score > 0),
    previous_record INTEGER,
    PRIMARY KEY (season, player_id, attempt_id)
);
