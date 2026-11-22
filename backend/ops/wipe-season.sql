-- Destructive and never applied automatically. Follow "Wiping the season board" in backend/README.md.
-- Names, historical scores and feedback are untouched. Runs in progress lose their tickets,
-- so a wiped score cannot be posted again.
DELETE FROM run_tickets WHERE season = '2.3.1';
DELETE FROM season_claims WHERE season = '2.3.1';
DELETE FROM season_scores WHERE season = '2.3.1';
