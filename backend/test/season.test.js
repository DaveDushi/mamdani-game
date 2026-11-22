import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { seasonRequest, PREFIX } from '../src/season.js';
import {
    FINAL_FLOOR_POINTS, HEAD_START_POINTS, MAX_POINTS, POINTS_PER_SECOND, TICKET_MS
} from '../src/season-rules.js';
import { RaceSchedule } from '../../game/RaceSchedule.js';

const legacyModule = new URL('../src/legacy.js', import.meta.url);
const key = letter => letter.repeat(64);
const digest = (value, platform = 'web') => platform + '_' + createHash('sha256').update(value).digest('hex');

function database() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`CREATE TABLE players (player_id TEXT PRIMARY KEY, name TEXT, social TEXT, is_pwa BOOLEAN DEFAULT FALSE);
        CREATE TABLE scores (player_id TEXT PRIMARY KEY REFERENCES players(player_id), score INTEGER NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE feedback (id INTEGER PRIMARY KEY, player_id TEXT, message TEXT, created_at INTEGER);
        INSERT INTO players (player_id, name) VALUES ('older', 'Old Ace');
        INSERT INTO scores VALUES ('older', 17454, 1);`);
    for (const file of ['0001_season', '0002_deleted_ios_players', '0003_run_tickets']) {
        sqlite.exec(readFileSync(new URL('../migrations/' + file + '.sql', import.meta.url), 'utf8'));
    }
    const db = {
        prepare(sql) {
            const stmt = sqlite.prepare(sql);
            return { bind(...params) {
                return {
                    first: () => stmt.get(...params), all: () => ({ results: stmt.all(...params) }), run: () => stmt.run(...params)
                };
            } };
        },
        batch(statements) {
            sqlite.exec('BEGIN');
            try {
                const results = statements.map(stmt => stmt.all());
                sqlite.exec('COMMIT');
                return results;
            } catch (error) {
                sqlite.exec('ROLLBACK');
                throw error;
            }
        }
    };
    return { sqlite, db };
}

function fixture(t) {
    const { sqlite, db } = database();
    const clock = { now: 1_800_000_000_000 };
    t.mock.method(Date, 'now', () => clock.now);
    const call = async (path, body) => {
        const request = new Request('https://test.example' + PREFIX + path, body === undefined ? {} : {
            method: 'POST', body: JSON.stringify(body)
        });
        const response = await seasonRequest(request, { game_d1: db });
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        return { status: response.status, ...await response.json() };
    };
    const platform = { web: '', ios: 'ios/' };
    const start = async (owner, mode = 'day', on = 'web') =>
        (await call(platform[on] + 'run', { key: owner, mode })).ticket;
    // Issues a ticket, then lets enough server time pass to earn the score.
    const earn = async (owner, score, mode = 'day', on = 'web') => {
        const ticket = await start(owner, mode, on);
        clock.now += Math.ceil(Math.max(0, score - HEAD_START_POINTS) / POINTS_PER_SECOND) * 1000;
        return ticket;
    };
    const post = async (owner, score, mode = 'day', on = 'web') => {
        const ticket = await earn(owner, score, mode, on);
        return call(platform[on] + 'score', { key: owner, ticket, score, mode });
    };
    const claim = (owner, ticket, score, mode = 'day') => call('record/claim', { key: owner, ticket, score, mode });
    return { sqlite, clock, call, start, earn, post, claim };
}

test('no season reply discloses a stored ID or accepts anything it published', async t => {
    const { call, start, post, sqlite } = fixture(t);
    const web = key('a'), ios = key('b');
    await post(web, 300);
    await post(ios, 200, 'night', 'ios');
    await call('profile', { key: web, name: 'Friend', social: 'arcade' });
    const ids = sqlite.prepare('SELECT player_id FROM season_scores').all().map(row => row.player_id);
    assert.deepEqual(ids.sort(), [digest(ios, 'ios'), digest(web)].sort());
    const stored = JSON.stringify(sqlite.prepare('SELECT * FROM players').all()) +
        JSON.stringify(sqlite.prepare('SELECT * FROM run_tickets').all());
    assert.ok(!stored.includes(web) && !stored.includes(ios));

    const replies = [
        await call('leaderboard'), await call('ios/leaderboard'), await call('record'),
        await call('leaderboard', { key: web }), await call('ios/leaderboard', { key: ios }),
        await call('run', { key: web, mode: 'day' }), await post(web, 310),
        await call('record/claim', { key: web, ticket: await start(web), score: 20, mode: 'day' }),
        await call('profile', { key: web, name: 'Friend', social: 'arcade' })
    ];
    for (const reply of replies) {
        const text = JSON.stringify(reply);
        assert.doesNotMatch(text, /player_id|[a-f0-9]{64}/);
        for (const id of ids) assert.ok(!text.includes(id.slice(4, 16)));
    }
    for (const path of ['run', 'score', 'record/claim', 'profile', 'feedback', 'delete', 'leaderboard']) {
        for (const credential of [...ids, 'older', 'Friend', '', null, 7, { key: web }]) {
            const body = { key: credential, playerId: credential, score: 50, mode: 'day', name: 'Thief', message: 'x', attemptId: 'x' };
            assert.equal((await call(path, body)).status, 400, path);
        }
    }
    // A digest is well formed as a key, but it belongs to a different, empty player.
    assert.ok(!(await call('leaderboard', { key: digest(web).slice(4) })).entries.some(entry => entry.you));
    assert.equal((await call('score?playerId=' + digest(web))).status, 404);
    assert.equal((await call('leaderboard')).entries[0].name, 'Friend');
});

test('a key marks only its own row and platforms never share a player', async t => {
    const { call, post } = fixture(t);
    await post(key('a'), 300);
    await post(key('b'), 200);
    await post(key('a'), 100, 'day', 'ios');
    await call('profile', { key: key('a'), name: 'Friend', social: 'arcade' });
    const own = (await call('leaderboard', { key: key('a') })).entries;
    assert.deepEqual(own.map(entry => [entry.name, entry.you]), [['Friend', true], ['Anonymous', undefined], ['iPhone runner', undefined]]);
    assert.equal(own[0].social, 'arcade');
    assert.deepEqual((await call('ios/leaderboard', { key: key('a') })).entries.map(entry => !!entry.you), [false, false, true]);
    assert.ok((await call('leaderboard')).entries.every(entry => !('you' in entry)));
    assert.equal((await call('leaderboard', { key: key('a'), limit: 1 })).entries.length, 1);
});

test('forged scores and claims are refused without a ticket or beyond the server clock', async t => {
    const { call, start, claim, clock, sqlite } = fixture(t);
    const owner = key('a');
    assert.equal((await call('score', { key: owner, score: 9000, mode: 'day' })).status, 403);
    assert.equal((await call('score', { key: owner, ticket: crypto.randomUUID(), score: 10, mode: 'day' })).status, 403);
    assert.equal((await call('score', { playerId: 'older', score: 29184, mode: 'day' })).status, 400);
    const ticket = await start(owner);
    const submit = score => call('score', { key: owner, ticket, score, mode: 'day' });
    for (const score of [-1, 1.5, '50', null, 1e300, undefined]) assert.equal((await submit(score)).status, 400);
    assert.equal((await submit(HEAD_START_POINTS + 1)).status, 422);
    assert.equal((await submit(MAX_POINTS + 1)).status, 422);
    assert.equal((await claim(owner, ticket, FINAL_FLOOR_POINTS + 1)).status, 422);
    assert.equal((await call('score', { key: owner, ticket, score: 10, mode: 'night' })).status, 403);
    assert.equal((await call('score', { key: owner, ticket, score: 10 })).status, 400);
    assert.equal((await call('run', { key: owner, mode: 'other' })).status, 400);
    assert.equal((await call('record')).record, null);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM season_claims').get().n, 0);

    clock.now += 10000;
    assert.equal((await submit(HEAD_START_POINTS + 10 * POINTS_PER_SECOND + 1)).status, 422);
    assert.equal((await submit(HEAD_START_POINTS + 10 * POINTS_PER_SECOND)).bestScore, HEAD_START_POINTS + 10 * POINTS_PER_SECOND);
    const waited = await start(owner);
    clock.now += TICKET_MS - 1;
    assert.equal((await call('score', { key: owner, ticket: waited, score: MAX_POINTS + 1, mode: 'day' })).status, 422);
});

test('a ticket belongs to one player, expires and takes one final score', async t => {
    const { call, start, claim, clock } = fixture(t);
    const ticket = await start(key('a'));
    const submit = (owner, score, use = ticket, path = 'score') => call(path, { key: owner, ticket: use, score, mode: 'day' });
    assert.equal((await submit(key('b'), 100)).status, 403);
    assert.equal((await submit(key('a'), 100, ticket, 'ios/score')).status, 403);
    assert.equal((await claim(key('b'), ticket, 100)).status, 403);
    assert.equal((await submit(key('a'), 100)).bestScore, 100);
    assert.equal((await submit(key('a'), 200)).status, 409);
    assert.equal((await submit(key('a'), 50)).status, 409);
    clock.now += 60000;
    assert.equal((await claim(key('a'), ticket, FINAL_FLOOR_POINTS + 1)).status, 409);
    assert.deepEqual((await call('leaderboard')).entries.map(entry => entry.score), [100]);

    const late = await start(key('a'));
    clock.now += TICKET_MS;
    assert.equal((await submit(key('a'), 300, late)).status, 410);
    assert.equal((await claim(key('a'), late, FINAL_FLOOR_POINTS + 1)).status, 410);
    assert.deepEqual((await call('leaderboard')).entries.map(entry => entry.score), [100]);
});

test('retries are idempotent through expiry and never improve or move a standing', async t => {
    const { call, earn, start, claim, clock, sqlite } = fixture(t);
    const owner = key('a');
    const ticket = await earn(owner, 15000);
    const won = await claim(owner, ticket, 14000);
    assert.deepEqual([won.qualified, won.previousRecord, won.record], [true, null, 14000]);
    assert.equal((await call('record')).record, 14000);
    const final = { key: owner, ticket, score: 15000, mode: 'day' };
    const first = await call('score', final);
    assert.deepEqual([first.bestScore, first.rank, first.onLeaderboard], [15000, 1, true]);
    const { created_at } = sqlite.prepare('SELECT created_at FROM season_scores').get();
    clock.now += TICKET_MS;
    assert.deepEqual(await call('score', final), first);
    assert.deepEqual(await claim(owner, ticket, 14000), { ...won, record: 15000 });
    assert.equal(sqlite.prepare('SELECT created_at FROM season_scores').get().created_at, created_at);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM season_claims').get().n, 1);

    clock.now += 2 * TICKET_MS;
    await start(key('b'));
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM run_tickets').get().n, 1);
    assert.equal((await call('score', final)).status, 403);
    assert.equal((await call('record')).record, 15000);
});

test('each player keeps a bounded set of tickets and the newest always works', async t => {
    const { call, start, sqlite } = fixture(t);
    const other = await start(key('b'));
    const tickets = [];
    for (let i = 0; i < 25; i++) tickets.push(await start(key('a')));
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM run_tickets').get().n, 21);
    const submit = (owner, ticket) => call('score', { key: owner, ticket, score: 100, mode: 'day' });
    assert.equal((await submit(key('a'), tickets[0])).status, 403);
    assert.equal((await submit(key('a'), tickets.at(-1))).ok, true);
    assert.equal((await submit(key('b'), other)).ok, true);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM players WHERE player_id LIKE 'web_%'").get().n, 2);
});

test('deletion removes scores, claims, tickets and feedback for its key only, and late uploads stay out', async t => {
    for (const on of ['ios', 'web']) {
        const { call, earn, post, sqlite } = fixture(t);
        const path = on === 'ios' ? 'ios/' : '';
        const owner = key('a'), score = FINAL_FLOOR_POINTS + 1;
        await post(key('b'), 200, 'night', on);
        const ticket = await earn(owner, score, 'day', on);
        const late = { key: owner, ticket, score, mode: 'day' };
        assert.equal((await call(path + 'record/claim', late)).qualified, true);
        if (on === 'web') assert.equal((await call('feedback', { key: owner, message: 'Private' })).ok, true);
        assert.deepEqual((await call('ios/leaderboard')).entries, [{ score }, { score: 200 }]);

        assert.equal((await call(path + 'delete', { key: digest(owner, on) })).status, 400);
        for (let i = 0; i < 2; i++) assert.deepEqual(await call(path + 'delete', { key: owner }), { status: 200, ok: true });
        for (const table of ['players', 'run_tickets', 'season_claims', 'season_scores', 'feedback']) {
            assert.equal(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE player_id = ?`).get(digest(owner, on)).n, 0, table);
        }
        assert.equal((await call(path + 'score', late)).status, 403);
        assert.equal((await call(path + 'record/claim', late)).status, 403);
        assert.equal((await call(path + 'run', { key: owner, mode: 'day' })).status, 410);
        assert.equal((await call(path + 'profile', { key: owner, name: 'Late save' })).status, 410);
        if (on === 'web') assert.equal((await call('feedback', { key: owner, message: 'Late' })).status, 410);
        assert.deepEqual((await call('ios/leaderboard')).entries, [{ score: 200 }]);
        assert.equal((await call('record')).record, 200);
    }
});

test('the season ignores historical scores and holds the opening floor', async t => {
    const { call, earn, post, claim, sqlite } = fixture(t);
    assert.equal((await call('record')).record, null);
    assert.deepEqual((await call('leaderboard')).entries, []);
    const ticket = await earn(key('a'), FINAL_FLOOR_POINTS + 1, 'night');
    assert.equal((await claim(key('a'), ticket, FINAL_FLOOR_POINTS, 'night')).qualified, false);
    await post(key('a'), 83, 'night');
    const win = await claim(key('a'), ticket, FINAL_FLOOR_POINTS + 1, 'night');
    assert.deepEqual([win.qualified, win.previousRecord, win.record], [true, 83, FINAL_FLOOR_POINTS + 1]);
    assert.equal(sqlite.prepare('SELECT score FROM scores').get().score, 17454);
});

test('players can name an existing score, rename it and clear the name on either platform', async t => {
    const { call, post } = fixture(t);
    for (const [path, unnamed, on] of [['', 'Anonymous', 'web'], ['ios/', 'iPhone runner', 'ios']]) {
        const owner = key('c');
        await post(owner, 200, 'day', on);
        const entry = async () => (await call(path + 'leaderboard', { key: owner })).entries.find(row => row.you);
        for (const name of ['x'.repeat(16), 'a\u0000b', 'a‮b', 7]) {
            assert.equal((await call(path + 'profile', { key: owner, name })).status, 400);
        }
        assert.equal((await call(path + 'profile', { key: owner, name: '  Night Owl  ', social: '@owl' })).ok, true);
        assert.equal((await entry()).name, 'Night Owl');
        assert.equal((await entry()).social, on === 'web' ? '@owl' : undefined);
        assert.equal((await call(path + 'profile', { key: owner, name: 'Day Owl' })).ok, true);
        assert.equal((await entry()).name, 'Day Owl');
        assert.equal((await call(path + 'profile', { key: owner, name: '' })).ok, true);
        assert.equal((await entry()).name, unnamed);
    }
    assert.equal((await call('profile', { key: key('c'), name: 'Owl', social: 'x'.repeat(21) })).status, 400);
});

test('web feedback needs a key and stays off the iPhone routes', async t => {
    const { call, sqlite } = fixture(t);
    assert.equal((await call('feedback', { key: key('a'), message: '  Faster bus  ' })).ok, true);
    assert.deepEqual({ ...sqlite.prepare('SELECT player_id, message FROM feedback').get() },
        { player_id: digest(key('a')), message: 'Faster bus' });
    for (const message of ['', '   ', 'x'.repeat(4001), { a: 1 }]) {
        assert.equal((await call('feedback', { key: key('a'), message })).status, 400);
    }
    assert.equal((await call('ios/feedback', { key: key('a'), message: 'Hello' })).status, 404);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM feedback').get().n, 1);
});

test('simultaneous ties produce one winner, a loser can advance and a winning retry stays qualified', async t => {
    const { earn, claim, post } = fixture(t);
    const [a, b] = [await earn(key('a'), 15000), await earn(key('b'), 15000, 'night')];
    const claims = await Promise.all([claim(key('a'), a, 13000), claim(key('b'), b, 13000, 'night')]);
    assert.equal(claims.filter(result => result.qualified).length, 1);
    assert.equal(claims[0].previousRecord, null);
    assert.equal(claims[1].previousRecord, 13000);
    assert.equal((await claim(key('b'), b, 13001, 'night')).qualified, true);
    const replay = await claim(key('a'), a, 13500);
    assert.deepEqual([replay.qualified, replay.previousRecord, replay.record], [true, null, 13001]);
    await post(key('c'), 13991, 'night');
    const second = await earn(key('a'), 15000);
    assert.equal((await claim(key('a'), second, 13991)).qualified, false);
    assert.equal((await claim(key('a'), second, 13992)).previousRecord, 13991);
});

test('completed runs retain the best score from either mode', async t => {
    const { call, post } = fixture(t);
    await post(key('a'), 2900, 'night');
    await post(key('b'), 900);
    const worse = await post(key('b'), 14);
    assert.deepEqual([worse.bestScore, worse.rank], [900, 2]);
    assert.equal((await post(key('c'), 9999)).onLeaderboard, true);
    assert.deepEqual((await call('leaderboard?limit=2')).entries.map(entry => entry.score), [9999, 2900]);
    assert.deepEqual((await call('ios/leaderboard')).entries, [{ score: 9999 }, { score: 2900 }, { score: 900 }]);
});

test('the race schedule qualifies through a ticketed claim', async t => {
    const { call, earn, claim, post } = fixture(t);
    const record = 60000;
    await post(key('b'), record);
    const ticket = await earn(key('a'), record + 1, 'night');
    const claims = [];
    const schedule = new RaceSchedule({
        getRecord: async () => ({ score: (await call('record')).record }),
        claim: async score => {
            claims.push(score);
            const response = await claim(key('a'), ticket, score, 'night');
            return { ...response, record: { score: response.record } };
        }
    });
    await schedule.update(0, 0, 0);
    for (let frame = 0; frame < 60; frame++) await schedule.update(record, 5, 1 + frame / 60);
    assert.deepEqual(claims, []);
    await schedule.update(record + 1, 5, 6);
    assert.deepEqual(claims, [record + 1]);
    assert.equal(schedule.qualified, true);
    assert.equal((await call('record')).record, record + 1);
});

test('the wipe empties the season and keeps names, historical scores and feedback', async t => {
    const { call, post, earn, claim, sqlite } = fixture(t);
    await post(key('a'), 300);
    await claim(key('b'), await earn(key('b'), 13000), 13000);
    await call('feedback', { key: key('a'), message: 'Kept' });
    const count = table => sqlite.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n;
    const kept = ['players', 'scores', 'feedback'].map(count);
    sqlite.exec(readFileSync(new URL('../ops/wipe-season.sql', import.meta.url), 'utf8'));
    assert.deepEqual([count('season_scores'), count('season_claims')], [0, 0]);
    assert.deepEqual(['players', 'scores', 'feedback'].map(count), kept);
    assert.equal((await post(key('a'), 100)).rank, 1);
});

test('the Worker closes the old write routes and strips IDs from the historical board',
    { skip: !existsSync(legacyModule) && 'the private legacy module is not restored' }, async t => {
        const { sqlite, db } = database();
        const { default: worker } = await import('../src/index.js');
        t.mock.method(Date, 'now', () => 1_800_000_000_000);
        const call = (method, path, body) => worker.fetch(new Request('https://api.mamdanirun.com' + path, {
            method, body: body && JSON.stringify(body)
        }), { game_d1: db, CORS: 'https://mamdanirun.com' }, {});
        const before = JSON.stringify(sqlite.prepare('SELECT * FROM players').all());
        const body = { playerId: 'older', name: 'Thief', social: '', score: 99999, message: 'Forged' };
        for (const path of ['/register', '/score', '/feedback']) {
            const response = await call('POST', path, body);
            assert.equal(response.status, 410);
            assert.equal((await response.json()).ok, false);
            assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://mamdanirun.com');
        }
        for (const [method, path] of [['POST', '/register/'], ['PUT', '/score'], ['POST', '/leaderboard'], ['GET', '/feedback']]) {
            assert.ok((await call(method, path, method === 'GET' ? undefined : body)).status >= 400);
        }
        assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM players').all()), before);
        assert.equal(sqlite.prepare('SELECT score FROM scores').get().score, 17454);
        assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM feedback').get().n, 0);

        const board = await (await call('GET', '/leaderboard?limit=10')).json();
        assert.deepEqual(board.entries, [{ name: 'Old Ace', social: null, score: 17454, created_at: 1 }]);
        assert.deepEqual(await (await call('GET', '/health')).json(), { ok: true });
        assert.equal((await call('OPTIONS', PREFIX + 'run')).status, 204);
        assert.equal((await call('GET', '/privacy')).status, 200);
        assert.equal(typeof worker.scheduled, 'function');
    });
