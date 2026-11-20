import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { seasonRequest, PREFIX } from '../src/season.js';
import { OPENING_RECORD_METRES } from '../src/season-rules.js';
import { RaceSchedule } from '../../game/RaceSchedule.js';

function fixture() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`CREATE TABLE players (player_id TEXT PRIMARY KEY, name TEXT, social TEXT);
        CREATE TABLE scores (player_id TEXT PRIMARY KEY, score INTEGER);
        INSERT INTO players VALUES ('older', 'Old Ace', NULL), ('friend','Friend','arcade');
        INSERT INTO scores VALUES ('older',17454);`);
    sqlite.exec(readFileSync(new URL('../migrations/0001_season.sql', import.meta.url), 'utf8'));
    const db = {
        prepare(sql) {
            const stmt = sqlite.prepare(sql);
            return { bind(...params) {
                return { first: () => stmt.get(...params), all: () => ({ results: stmt.all(...params) }) };
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
    const call = async (path, body) => {
        const request = new Request('https://test.example' + PREFIX + path, body === undefined ? {} : {
            method: 'POST', body: JSON.stringify(body)
        });
        const response = await seasonRequest(request, { game_d1: db });
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        return { status: response.status, ...await response.json() };
    };
    return { sqlite, call, claim: (playerId, attemptId, score, mode = 'day') =>
        call('record/claim', { playerId, attemptId, score, mode }) };
}

test('a fresh edition reads an empty board and preserves names, legacy scores and the opening floor', async () => {
    const { call, claim, sqlite } = fixture();
    assert.equal((await call('record')).record, null);
    assert.deepEqual((await call('leaderboard')).entries, []);
    assert.equal((await claim('older', 'try', OPENING_RECORD_METRES)).qualified, false);
    await call('score', { playerId: 'older', score: 83, mode: 'night' });
    assert.equal((await call('record')).record, 83);
    assert.equal((await claim('older', 'try', OPENING_RECORD_METRES)).qualified, false);
    const win = await claim('older', 'try', OPENING_RECORD_METRES + 1, 'night');
    assert.equal(win.qualified, true);
    assert.equal(win.previousRecord, 83);
    assert.equal(win.record, OPENING_RECORD_METRES + 1);
    const [entry] = (await call('leaderboard')).entries;
    assert.equal(entry.name, 'Old Ace');
    assert.equal(entry.score, OPENING_RECORD_METRES + 1);
    assert.equal(sqlite.prepare('SELECT score FROM scores').get().score, 17454);
});

test('simultaneous ties produce one winner, a loser can advance and a winning retry stays qualified', async () => {
    const { call, claim } = fixture();
    const claims = await Promise.all([claim('anonymousA','race-a',900), claim('anonymousB','race-b',900,'night')]);
    assert.equal(claims.filter(r => r.qualified).length, 1);
    assert.equal(claims[0].previousRecord, null);
    assert.equal(claims[1].previousRecord, 900);
    assert.equal((await claim('anonymousB','race-b',901,'night')).qualified, true);
    const replay = await claim('anonymousA','race-a',1000);
    assert.equal(replay.qualified, true);
    assert.equal(replay.previousRecord, null);
    assert.equal(replay.record, 901);
    await call('score', { playerId: 'friend', score: 991, mode: 'night' });
    assert.equal((await claim('anonymousA','second-run',991)).qualified, false);
    assert.equal((await claim('anonymousA','second-run',992)).previousRecord, 991);
});

test('completed PBs retain the best distance and publicly registered names from either mode', async () => {
    const { call, sqlite } = fixture();
    await call('score', { playerId: 'friend', score: 2900, mode: 'night' });
    await call('score', { playerId: 'older', score: 900, mode: 'day' });
    assert.equal((await call('score', { playerId: 'older', score: 14 })).bestScore, 900);
    const anon = await call('score', { playerId: 'new-id', score: 9999 });
    assert.equal(anon.onLeaderboard, true);
    assert.deepEqual((await call('leaderboard')).entries.map(e => e.name), ['Anonymous','Friend','Old Ace']);
    sqlite.prepare('UPDATE players SET name = ? WHERE player_id = ?').run('New Ace','new-id');
    assert.deepEqual((await call('leaderboard?limit=2')).entries.map(e => e.name), ['New Ace','Friend']);
    assert.equal((await call('score?playerId=older')).rank, 3);
    assert.equal((await call('score', { playerId: 'older', score: -1 })).status, 400);
    assert.equal((await call('record/claim', { playerId: 'older', attemptId: 'x', score: 10000, mode: 'other' })).status, 400);
});

test('2.3.1 and 2.3.2 runners share records while each version keeps its own final approach', async () => {
    const { call, claim } = fixture();
    assert.equal((await claim('older', 'short-course', 421)).qualified, true);
    const distances = [];
    const schedule = new RaceSchedule({
        getRecord: async () => ({ score: (await call('record')).record }),
        claim: async score => {
            distances.push(score);
            const response = await claim('newer', 'long-course', score, 'night');
            return { ...response, record: { score: response.record } };
        }
    });
    await schedule.update(0, 0, 0);
    const openingFinish = schedule.rivals.at(-1).at;
    assert.ok(openingFinish > 421);
    await schedule.update(422, 5, 1);
    await schedule.update(openingFinish - 1, 5, 2);
    await schedule.update(openingFinish, 4, 3);
    assert.deepEqual(distances, []);

    const newRecord = openingFinish + 100;
    await call('score', { playerId: 'older', score: newRecord, mode: 'day' });
    await schedule.update(openingFinish, 5, 4);
    for (let frame = 0; frame < 60; frame++) await schedule.update(newRecord, 5, 5 + frame / 60);
    assert.deepEqual(distances, [openingFinish]);
    assert.equal(schedule.canEnter(schedule.rivals.at(-1), newRecord), false);
    await schedule.update(newRecord + 1, 5, 6);
    assert.deepEqual(distances, [openingFinish, newRecord + 1]);
    assert.equal(schedule.canEnter(schedule.rivals.at(-1), newRecord + 1), true);
    assert.equal((await claim('newer', 'long-course', newRecord + 1, 'night')).previousRecord, newRecord);
    assert.equal((await call('leaderboard')).entries[0].score, newRecord + 1);
});
