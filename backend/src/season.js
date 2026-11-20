import { OPENING_RECORD_METRES, SEASON } from './season-rules.js';

export { SEASON };
export const PREFIX = '/seasons/' + SEASON + '/';

const recordQuery = 'SELECT MAX(score) AS record FROM season_scores WHERE season = ?1 AND score > 0';
const improveScore = `ON CONFLICT(season, player_id) DO UPDATE SET score = excluded.score, created_at = excluded.created_at
    WHERE excluded.score > season_scores.score`;

function response(data, status, request, env) {
    const origin = request.headers.get('Origin');
    const headers = {
        'Access-Control-Allow-Origin': origin === 'https://www.mamdanirun.cc' ? origin : env.CORS || 'https://mamdanirun.cc',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store',
        'Vary': 'Origin'
    };
    return data === null ? new Response(null, { status, headers }) : Response.json(data, { status, headers });
}

function validId(id) {
    return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function ensurePlayer(db, id) {
    return db.prepare('INSERT INTO players (player_id) VALUES (?) ON CONFLICT(player_id) DO NOTHING').bind(id);
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

async function submit(db, playerId, score) {
    const [, , result] = await db.batch([
        ensurePlayer(db, playerId),
        db.prepare(`INSERT INTO season_scores (season, player_id, score, created_at) VALUES (?1, ?2, ?3, ?4)
            ${improveScore}`).bind(SEASON, playerId, score, Date.now()),
        standing(db, playerId)
    ]);
    return scoreResult(result.results[0]);
}

async function claim(db, playerId, attemptId, score) {
    // The comparison and insert share one D1 transaction. A winning attempt has one durable receipt.
    const [, , , decision, latest] = await db.batch([
        ensurePlayer(db, playerId),
        db.prepare(`INSERT INTO season_claims (season, player_id, attempt_id, score, previous_record)
            SELECT ?1, ?2, ?3, ?4, record FROM (${recordQuery}) WHERE ?4 > MAX(COALESCE(record, 0), ?5)
            ON CONFLICT(season, player_id, attempt_id) DO NOTHING`).bind(SEASON, playerId, attemptId, score, OPENING_RECORD_METRES),
        db.prepare(`INSERT INTO season_scores (season, player_id, score, created_at)
            SELECT season, player_id, score, ?4 FROM season_claims
            WHERE season = ?1 AND player_id = ?2 AND attempt_id = ?3
            ${improveScore}`).bind(SEASON, playerId, attemptId, Date.now()),
        db.prepare(`SELECT score, previous_record FROM season_claims
            WHERE season = ?1 AND player_id = ?2 AND attempt_id = ?3`).bind(SEASON, playerId, attemptId),
        db.prepare(recordQuery).bind(SEASON)
    ]);
    const receipt = decision.results[0];
    const record = latest.results[0].record;
    return { ok: true, qualified: !!receipt, previousRecord: receipt ? receipt.previous_record : record, record };
}

export async function seasonRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(PREFIX.length);
    const db = env.game_d1;
    const reply = (body, status = 200) => response(body, status, request, env);
    if (request.method === 'OPTIONS') return reply(null, 204);
    if (request.method === 'GET') {
        if (path === 'record') {
            const { record } = await db.prepare(recordQuery).bind(SEASON).first();
            return reply({ ok: true, record });
        }
        if (path === 'leaderboard') {
            const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50));
            const { results } = await db.prepare(`SELECT s.player_id, COALESCE(NULLIF(TRIM(p.name), ''), 'Anonymous') AS name,
                    CASE WHEN TRIM(p.name) != '' THEN p.social END AS social, s.score, s.created_at
                FROM season_scores s JOIN players p USING (player_id)
                WHERE s.season = ?1 AND s.score > 0
                ORDER BY s.score DESC, s.created_at, s.player_id LIMIT ?2`).bind(SEASON, limit).all();
            return reply({ entries: results });
        }
        if (path === 'score') {
            const id = url.searchParams.get('playerId');
            if (!validId(id)) return reply({ error: 'Invalid player ID' }, 400);
            return reply(scoreResult(await standing(db, id).first()));
        }
    }
    if (request.method === 'POST' && (path === 'score' || path === 'record/claim')) {
        const body = await request.json().catch(() => null);
        if (!validId(body?.playerId) || !Number.isSafeInteger(body.score) || body.score < 0) {
            return reply({ error: 'A player ID and a nonnegative integer distance are required' }, 400);
        }
        if (body.mode !== undefined && !['day', 'night'].includes(body.mode)) return reply({ error: 'Unknown run mode' }, 400);
        if (path === 'score') return reply(await submit(db, body.playerId, body.score));
        if (!validId(body.attemptId) || !body.mode || body.score < 1) {
            return reply({ error: 'An attempt ID, run mode and positive distance are required' }, 400);
        }
        return reply(await claim(db, body.playerId, body.attemptId, body.score));
    }
    return reply({ error: 'Not found' }, 404);
}
