import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObstacleManager } from '../game/ObstacleManager.js';
import { familySchedule, raceDistance, RaceSchedule, RECORD_FLOOR } from '../game/RaceSchedule.js';
import { FINAL_FLOOR_POINTS } from '../backend/src/season-rules.js';

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

test('the record moves only Donald and the game waits for the same floor as the server', () => {
    assert.equal(RECORD_FLOOR, FINAL_FLOOR_POINTS);
    const opening = familySchedule(null);
    assert.deepEqual(familySchedule(RECORD_FLOOR), opening);
    assert.deepEqual(opening.map(rival => rival.at), [650, 1670, 2975, 4650, 6650, RECORD_FLOOR + 1]);
    const later = familySchedule(60000);
    assert.deepEqual(later.slice(0, 5), opening.slice(0, 5));
    assert.equal(later[5].at, 60001);
    assert.equal(raceDistance(421), '421 m');
    assert.equal(raceDistance(3001), new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(3.001) + ' km');
});

test('a slow first read never holds back the children', async () => {
    const initial = deferred();
    const schedule = new RaceSchedule({ getRecord: () => initial.promise });
    const read = schedule.update(0, 0, 0);
    schedule.update(700, 0, 24);
    assert.equal(schedule.canEnter(schedule.rivals[0], 700), true);
    initial.resolve({ score: 18000 });
    await read;
    assert.equal(schedule.target, 18000);
    assert.equal(schedule.rivals[0].at, 650);
});

test('a failed read retries until the live record arrives', async () => {
    let reads = 0;
    const schedule = new RaceSchedule({ getRecord: async () => {
        if (++reads === 1) throw Error('Offline');
        return reads === 2 ? null : { score: 18000 };
    } });
    await schedule.update(0, 0, 0);
    assert.equal(schedule.canEnter(schedule.rivals[5], 20000), false);
    schedule.update(700, 1, 7);
    assert.equal(reads, 1);
    await schedule.update(800, 1, 8);
    await schedule.update(1700, 2, 16);
    assert.equal(schedule.target, 18000);
    assert.equal(reads, 3);
});

test('a run without a ticket keeps racing the children and never reaches the final', async () => {
    let claims = 0;
    const schedule = new RaceSchedule({ getRecord: async () => ({ score: null }), claim: async () => { claims++; return null; } });
    await schedule.update(0, 0, 0);
    assert.equal(schedule.canEnter(schedule.rivals[4], 6650), true);
    for (let second = 0; second < 30; second++) await schedule.update(RECORD_FLOOR + 1 + second, 5, 100 + second);
    assert.equal(claims, 4);
    assert.equal(schedule.canEnter(schedule.rivals[5], 20000), false);
});

test('the final requires all five wins and strictly more points even on an empty board', async () => {
    for (const record of [null, 100, RECORD_FLOOR + 500]) {
        const target = Math.max(RECORD_FLOOR, record ?? 0);
        const claims = [];
        const getRecord = async () => ({ score: record });
        const wait = deferred();
        const schedule = new RaceSchedule({ getRecord, claim: score => { claims.push(score); return wait.promise; } });
        await schedule.update(0, 0, 0);
        for (let wins = 0; wins < 5; wins++) schedule.update(target + 50, wins, 1);
        schedule.update(target, 5, 2);
        assert.deepEqual(claims, []);
        const claim = schedule.update(target + 1, 5, 3);
        schedule.update(target + 20, 5, 4);
        assert.deepEqual(claims, [target + 1]);
        assert.equal(schedule.canEnter(schedule.rivals[5], target + 20), false);
        wait.resolve({ qualified: true, previousRecord: record, record: { score: target + 1 } });
        await claim;
        assert.equal(schedule.canEnter(schedule.rivals[5], target + 20), true);
        schedule.update(target + 30, 6, 100);
        assert.deepEqual(claims, [target + 1]);
    }
});

test('a record set during the approach denies a tie and reschedules Donald', async () => {
    const claims = [];
    const schedule = new RaceSchedule({
        getRecord: async () => ({ score: 13500 }),
        claim: async score => {
            claims.push(score);
            return { qualified: score > 13501, previousRecord: 13501, record: { score: Math.max(13501, score) } };
        }
    });
    await schedule.update(0, 0, 0);
    await schedule.update(13501, 5, 30);
    schedule.update(13501, 5, 31);
    assert.equal(schedule.rivals[5].at, 13502);
    assert.equal(schedule.canEnter(schedule.rivals[5], 13501), false);
    assert.deepEqual(claims, [13501]);
    await schedule.update(13502, 5, 32);
    assert.equal(schedule.canEnter(schedule.rivals[5], 13502), true);
    assert.deepEqual(claims, [13501, 13502]);
});

test('a delayed refresh cannot undo a live denial or delay an eligible claim', async () => {
    const refresh = deferred();
    let reads = 0;
    const schedule = new RaceSchedule({
        getRecord: async () => ++reads === 1 ? { score: null } : refresh.promise,
        claim: async () => ({ qualified: false, previousRecord: 15000, record: { score: 15000 } })
    });
    await schedule.update(0, 0, 0);
    const reading = schedule.update(6000, 4, 16);
    await schedule.update(12001, 5, 20);
    refresh.resolve({ score: 12002 });
    await reading;
    assert.equal(schedule.target, 15000);
    assert.equal(schedule.rivals[5].at, 15001);
    assert.equal(schedule.canEnter(schedule.rivals[5], 15001), false);
});

test('a lost claim response retries once due and honors the durable receipt even if another runner passed it', async () => {
    const claims = [];
    const schedule = new RaceSchedule({
        getRecord: async () => ({ score: 420 }),
        claim: async score => {
            claims.push(score);
            if (claims.length === 1) return null;
            if (claims.length === 2) throw Error('Server unavailable');
            return { qualified: true, previousRecord: 12000, record: { score: 13500 } };
        }
    });
    await schedule.update(0, 0, 0);
    await schedule.update(12001, 5, 30);
    for (const [time, score] of [[37, 12100], [38, 12150], [45, 12390], [46, 12430]]) {
        assert.equal(schedule.canEnter(schedule.rivals[5], score), false);
        await schedule.update(score, 5, time);
    }
    assert.deepEqual(claims, [12001, 12150, 12430]);
    assert.equal(schedule.canEnter(schedule.rivals[5], 12430), true);
});

test('late record reads and claims from a stopped run cannot qualify or reschedule its replay', async () => {
    const oldRead = deferred(), oldClaim = deferred();
    const first = new RaceSchedule({ getRecord: () => oldRead.promise });
    const reading = first.update(0, 0, 0);
    const second = new RaceSchedule({ getRecord: async () => ({ score: null }), claim: () => oldClaim.promise });
    await second.update(0, 0, 0);
    const claiming = second.update(12050, 5, 30);
    const replay = new RaceSchedule({ getRecord: async () => ({ score: 12800 }) });
    await replay.update(0, 0, 0);
    oldRead.resolve({ score: 16000 });
    oldClaim.resolve({ qualified: true, previousRecord: null, record: { score: 12050 } });
    await Promise.all([reading, claiming]);
    assert.equal(first.target, 16000);
    assert.equal(second.qualified, true);
    assert.equal(replay.rivals[5].at, 12801);
    assert.equal(replay.canEnter(replay.rivals[5], 12900), false);
});

test('every child return reserves eighteen seconds of live street even after a late heat', async () => {
    const schedule = new RaceSchedule({
        getRecord: async () => ({ score: null }),
        claim: async score => ({ qualified: true, previousRecord: null, record: { score } })
    });
    await schedule.update(0, 0, 0);
    for (let wins = 1; wins <= 5; wins++) {
        const rival = schedule.rivals[wins];
        const score = rival.at + 100;
        const returned = 15 * wins;
        schedule.returnedToStreet(returned);
        await schedule.update(score, wins, returned);
        if (wins === 5) assert.equal(schedule.qualified, true);
        schedule.update(score, wins, returned + 17.99);
        assert.equal(schedule.canEnter(rival, score), false);
        schedule.update(score, wins, returned + 18);
        assert.equal(schedule.canEnter(rival, score), true);
    }
});

test('the final chute leaves stamps and the next row’s lane cues intact', () => {
    const obstacle = (type, z) => ({ type, mesh: { position: { z } }, cueLead: 0 });
    const nearRail = obstacle('railGate', -24);
    const nearStamp = obstacle('coin', -24);
    const farRail = obstacle('railGate', -64);
    const traffic = Object.assign(Object.create(ObstacleManager.prototype), {
        obstacles: [nearRail, nearStamp, farRail],
        add(_key, _x, z) {
            const cue = obstacle('cue', z);
            this.obstacles.push(cue);
            return cue;
        },
        remove(index) { this.obstacles.splice(index, 1); }
    });
    const railRow = { gate: 'rail', cueStep: 8 };
    traffic.markLane(0, -24, railRow);
    traffic.markLane(0, -64, railRow);
    const farCues = traffic.obstacles.slice(-2);
    traffic.clearFinishChute(60);
    assert.deepEqual(traffic.obstacles, [nearStamp, farRail, ...farCues]);
});
