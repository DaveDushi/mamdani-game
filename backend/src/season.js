import {
    FINAL_FLOOR_POINTS, HEAD_START_POINTS, MAX_POINTS, POINTS_PER_SECOND, SEASON, TICKET_MS
} from './season-rules.js';

export { SEASON };
export const PREFIX = '/seasons/' + SEASON + '/';
const PLAYER_TICKETS = 20;

const recordQuery = 'SELECT MAX(score) AS record FROM season_scores WHERE season = ?1 AND score > 0';
const improveScore = `ON CONFLICT(season, player_id) DO UPDATE SET score = excluded.score, created_at = excluded.created_at
    WHERE excluded.score > season_scores.score`;

const earned = (score, now) => `started_at > ${now} - ${TICKET_MS}
    AND ${score} <= ${HEAD_START_POINTS} + (${now} - started_at) * ${POINTS_PER_SECOND} / 1000`;

function earnedBy(run, score, now) {
    return score <= HEAD_START_POINTS + (now - run.started_at) * POINTS_PER_SECOND / 1000;
}

function expired(run, now) {
    return now - run.started_at >= TICKET_MS;
}

function refuse(status, error) {
    return { status, body: { ok: false, error } };
}

function cleanText(value, length) {
    const text = typeof value === 'string' ? value.trim() : null;
    return text === null || text.length > length || /[\p{Cc}\p{Cf}]/u.test(text) ? null : text;
}

function response(data, status) {
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store'
    };
    return data === null ? new Response(null, { status, headers }) : Response.json(data, { status, headers });
}

async function playerId(key, platform) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) return null;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    return platform + '_' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// deleted_ios_players holds the digests of deleted web players too.
function ensurePlayer(db, id) {
    return db.prepare(`INSERT INTO players (player_id)
        SELECT ?1 WHERE NOT EXISTS (SELECT 1 FROM deleted_ios_players WHERE player_id = ?1)
        ON CONFLICT(player_id) DO NOTHING`).bind(id);
}

function ensureTicketHolder(db, id, ticket) {
    return db.prepare(`INSERT INTO players (player_id)
        SELECT player_id FROM run_tickets WHERE ticket = ?1 AND player_id = ?2 AND season = ?3
        ON CONFLICT(player_id) DO NOTHING`).bind(ticket, id, SEASON);
}

function findTicket(db, id, ticket) {
    return db.prepare(`SELECT mode, started_at, final_score FROM run_tickets
        WHERE ticket = ?1 AND player_id = ?2 AND season = ?3`).bind(ticket, id, SEASON);
}

function standing(db, id) {
    return db.prepare(`
        SELECT s.score AS bestScore,
            1 + (SELECT COUNT(*) FROM season_scores ahead
                 WHERE ahead.season = s.season AND
                    (ahead.score > s.score OR (ahead.score = s.score AND
                       (ahead.created_at, ahead.player_id) < (s.created_at, s.player_id)))) AS rank
        FROM season_scores s WHERE s.season = ?1 AND s.player_id = ?2 AND s.score > 0`).bind(SEASON, id);
}

function scoreResult(row) {
    if (!row) return { ok: true, bestScore: 0, rank: null, onLeaderboard: false };
    return { ok: true, bestScore: row.bestScore, rank: row.rank, onLeaderboard: row.rank <= 50 };
}

async function startRun(db, id, mode) {
    const now = Date.now();
    // Expired tickets linger for a while so that a late retry still gets its original answer.
    const [, , issued] = await db.batch([
        db.prepare('DELETE FROM run_tickets WHERE started_at < ?1').bind(now - 2 * TICKET_MS),
        db.prepare(`DELETE FROM run_tickets WHERE ticket IN (SELECT ticket FROM run_tickets
            WHERE player_id = ?1 ORDER BY started_at DESC, rowid DESC LIMIT -1 OFFSET ?2)`).bind(id, PLAYER_TICKETS - 1),
        db.prepare(`INSERT INTO run_tickets (ticket, season, player_id, mode, started_at)
            SELECT ?1, ?2, ?3, ?4, ?5 WHERE NOT EXISTS (SELECT 1 FROM deleted_ios_players WHERE player_id = ?3)
            RETURNING ticket`).bind(crypto.randomUUID(), SEASON, id, mode, now)
    ]);
    const row = issued.results[0];
    return row ? { status: 200, body: { ok: true, ticket: row.ticket } } : refuse(410, 'Profile deleted');
}

async function submit(db, id, { ticket, score, mode }) {
    const now = Date.now();
    const [, , , found, result] = await db.batch([
        ensureTicketHolder(db, id, ticket),
        db.prepare(`UPDATE run_tickets SET final_score = ?3
            WHERE ticket = ?1 AND player_id = ?2 AND season = ?4 AND mode = ?5 AND final_score IS NULL
                AND ${earned('?3', '?6')}`).bind(ticket, id, score, SEASON, mode, now),
        db.prepare(`INSERT INTO season_scores (season, player_id, score, created_at)
            SELECT season, player_id, final_score, ?6 FROM run_tickets
            WHERE ticket = ?1 AND player_id = ?2 AND season = ?4 AND mode = ?5 AND final_score = ?3
                AND started_at > ?6 - ${TICKET_MS}
            ${improveScore}`).bind(ticket, id, score, SEASON, mode, now),
        findTicket(db, id, ticket),
        standing(db, id)
    ]);
    const run = found.results[0];
    if (!run || run.mode !== mode) return refuse(403, 'Unknown run ticket');
    if (run.final_score === null) {
        return expired(run, now) ? refuse(410, 'Run ticket expired') : refuse(422, 'Score too high for the length of the run');
    }
    if (run.final_score !== score) return refuse(409, 'This run already has a final score');
    return { status: 200, body: scoreResult(result.results[0]) };
}

async function claim(db, id, { ticket, score, mode }) {
    const now = Date.now();
    // The comparison and insert share one D1 transaction. A winning run has one durable receipt.
    const [, , , decision, latest, found] = await db.batch([
        ensureTicketHolder(db, id, ticket),
        db.prepare(`INSERT INTO season_claims (season, player_id, attempt_id, score, previous_record)
            SELECT season, player_id, ticket, ?1, record FROM run_tickets,
                (SELECT MAX(score) AS record FROM season_scores WHERE season = ?2 AND score > 0)
            WHERE ticket = ?3 AND player_id = ?4 AND season = ?2 AND mode = ?5 AND final_score IS NULL
                AND ${earned('?1', '?6')} AND ?1 > MAX(COALESCE(record, 0), ?7)
            ON CONFLICT(season, player_id, attempt_id) DO NOTHING`)
            .bind(score, SEASON, ticket, id, mode, now, FINAL_FLOOR_POINTS),
        db.prepare(`INSERT INTO season_scores (season, player_id, score, created_at)
            SELECT season, player_id, score, ?4 FROM season_claims
            WHERE season = ?1 AND player_id = ?2 AND attempt_id = ?3
            ${improveScore}`).bind(SEASON, id, ticket, now),
        db.prepare(`SELECT previous_record FROM season_claims
            WHERE season = ?1 AND player_id = ?2 AND attempt_id = ?3`).bind(SEASON, id, ticket),
        db.prepare(recordQuery).bind(SEASON),
        findTicket(db, id, ticket)
    ]);
    const receipt = decision.results[0];
    const run = found.results[0];
    const record = latest.results[0].record;
    if (!receipt) {
        if (!run || run.mode !== mode) return refuse(403, 'Unknown run ticket');
        if (run.final_score !== null) return refuse(409, 'This run already has a final score');
        if (expired(run, now)) return refuse(410, 'Run ticket expired');
        if (!earnedBy(run, score, now)) return refuse(422, 'Score too high for the length of the run');
    }
    return {
        status: 200,
        body: { ok: true, qualified: !!receipt, previousRecord: receipt ? receipt.previous_record : record, record }
    };
}

async function deletePlayer(db, id) {
    // Keep the one-way digest so that a late score upload cannot restore deleted data.
    await db.batch([
        db.prepare('INSERT OR IGNORE INTO deleted_ios_players (player_id) VALUES (?1)').bind(id),
        ...['run_tickets', 'season_claims', 'season_scores', 'feedback', 'players']
            .map(table => db.prepare(`DELETE FROM ${table} WHERE player_id = ?1`).bind(id))
    ]);
    return { status: 200, body: { ok: true } };
}

async function saveProfile(db, id, body, ios) {
    const name = cleanText(body.name, 15);
    if (name === null) return refuse(400, 'Invalid leaderboard name');
    const social = ios ? '' : cleanText(body.social ?? '', 20);
    if (social === null) return refuse(400, 'Invalid social handle');
    const [, updated] = await db.batch([
        ensurePlayer(db, id),
        db.prepare('UPDATE players SET name = ?2, social = ?3, is_pwa = ?4 WHERE player_id = ?1 RETURNING 1')
            .bind(id, name || null, social || null, body.isPwa === true ? 1 : 0)
    ]);
    return updated.results.length ? { status: 200, body: { ok: true } } : refuse(410, 'Profile deleted');
}

async function sendFeedback(db, id, text) {
    const message = typeof text === 'string' ? text.trim() : '';
    if (!message || message.length > 4000) return refuse(400, 'A message of up to 4000 characters is required');
    const [, saved] = await db.batch([
        ensurePlayer(db, id),
        db.prepare(`INSERT INTO feedback (player_id, message, created_at)
            SELECT player_id, ?2, ?3 FROM players WHERE player_id = ?1 RETURNING 1`).bind(id, message, Date.now())
    ]);
    return saved.results.length ? { status: 200, body: { ok: true } } : refuse(410, 'Profile deleted');
}

async function leaderboard(db, requested, owner) {
    const limit = Math.min(50, Math.max(1, Number.parseInt(requested ?? '50', 10) || 50));
    const { results } = await db.prepare(`SELECT s.player_id, NULLIF(TRIM(p.name), '') AS name,
            CASE WHEN TRIM(p.name) != '' THEN p.social END AS social, s.score, s.created_at
        FROM season_scores s JOIN players p USING (player_id)
        WHERE s.season = ?1 AND s.score > 0
        ORDER BY s.score DESC, s.created_at, s.player_id LIMIT ?2`).bind(SEASON, limit).all();
    // Stored IDs stay on the server. A caller with a key learns only which row is its own.
    return results.map(({ player_id, name, social, score, created_at }) => ({
        ...(player_id.startsWith('ios_') ? { name: name ?? 'iPhone runner' } : { name: name ?? 'Anonymous', social }),
        score,
        created_at,
        ...(player_id === owner && { you: true })
    }));
}

const posts = new Set(['run', 'score', 'record/claim', 'leaderboard', 'profile', 'feedback', 'delete']);

async function post(db, path, id, body, ios) {
    if (path === 'leaderboard') return { status: 200, body: { entries: await leaderboard(db, body.limit, id) } };
    if (path === 'profile') return saveProfile(db, id, body, ios);
    if (path === 'feedback') return sendFeedback(db, id, body.message);
    if (path === 'delete') return deletePlayer(db, id);
    if (!['day', 'night'].includes(body.mode)) return refuse(400, 'Unknown run mode');
    if (path === 'run') return startRun(db, id, body.mode);
    if (typeof body.ticket !== 'string' || !/^[a-f0-9-]{36}$/.test(body.ticket)) {
        return refuse(403, 'A run ticket is required. Update the game to post scores.');
    }
    if (!Number.isSafeInteger(body.score) || body.score < 0) return refuse(400, 'A nonnegative integer score is required');
    if (body.score > MAX_POINTS) return refuse(422, 'Score out of range');
    if (path === 'score') return submit(db, id, body);
    return body.score > 0 ? claim(db, id, body) : refuse(400, 'A positive score is required');
}

export async function seasonRequest(request, env) {
    const url = new URL(request.url);
    const route = url.pathname.slice(PREFIX.length);
    const ios = route.startsWith('ios/');
    const path = ios ? route.slice(4) : route;
    const db = env.game_d1;
    const reply = (body, status = 200) => response(body, status);
    if (request.method === 'OPTIONS') return reply(null, 204);
    if (request.method === 'GET') {
        if (path === 'record') {
            const { record } = await db.prepare(recordQuery).bind(SEASON).first();
            return reply({ ok: true, record });
        }
        if (path === 'leaderboard') {
            const entries = await leaderboard(db, url.searchParams.get('limit'));
            return reply({ entries: ios ? entries.map(({ score }) => ({ score })) : entries });
        }
    }
    if (request.method === 'POST' && posts.has(path) && !(ios && path === 'feedback')) {
        const body = await request.json().catch(() => null);
        const id = await playerId(body?.key, ios ? 'ios' : 'web');
        if (!id) return reply({ ok: false, error: 'A private player key is required. Update the game to play online.' }, 400);
        const result = await post(db, path, id, body, ios);
        return reply(result.body, result.status);
    }
    return reply({ error: 'Not found' }, 404);
}
