import { test } from 'node:test';
import assert from 'node:assert/strict';
import { familySchedule, raceDistance, RaceSchedule } from '../game/RaceSchedule.js';

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

test('checkpoints move out with the record and all heats reach 100 m at 3 km', () => {
    const opening = familySchedule(null);
    assert.deepEqual(familySchedule(200), opening);
    const halfway = familySchedule(1710);
    const full = familySchedule(3000);
    const later = familySchedule(9000);
    for (const [i, rival] of opening.entries()) {
        assert.equal(halfway[i].id, rival.id);
        assert.ok(rival.at < halfway[i].at && halfway[i].at < full[i].at && full[i].at < later[i].at);
        assert.equal(halfway[i].metres, Math.round((rival.metres + 100) / 2));
        assert.equal(full[i].metres, 100);
        assert.equal(later[i].metres, 100);
        assert.equal(full[i].countdown, 3);
    }
    assert.equal(later.at(-1).at, 9001);
    assert.equal(raceDistance(421), '421 m');
    assert.equal(raceDistance(3001), new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(3.001) + ' km');
});

test('a slow first read keeps Junior on the street until the true schedule is known', async () => {
    const initial = deferred();
    const schedule = new RaceSchedule({ getRecord: () => initial.promise });
    const read = schedule.update(0, 0, 0);
    schedule.update(100, 0, 5);
    assert.equal(schedule.canEnter(schedule.rivals[0], 100), false);
    initial.resolve({ score: 3000 });
    await read;
    assert.equal(schedule.rivals[0].at, 240);
    assert.equal(schedule.canEnter(schedule.rivals[0], 100), false);
    assert.equal(schedule.canEnter(schedule.rivals[0], 240), true);
});

test('a failed read allows practice and retries until the live record arrives', async () => {
    let reads = 0;
    const schedule = new RaceSchedule({ getRecord: async () => {
        if (++reads === 1) throw Error('Offline');
        return reads === 2 ? null : { score: 2000 };
    } });
    await schedule.update(0, 0, 0);
    assert.equal(schedule.canEnter(schedule.rivals[0], 34), true);
    assert.equal(schedule.canEnter(schedule.rivals[5], 5000), false);
    schedule.update(40, 1, 7);
    assert.equal(reads, 1);
    await schedule.update(80, 1, 8);
    await schedule.update(180, 2, 16);
    assert.equal(schedule.rivals[2].at, 660);
    assert.equal(schedule.canEnter(schedule.rivals[2], 180), false);
    assert.equal(reads, 3);
});

test('the final requires all five wins and strictly greater street metres even on an empty board', async () => {
    for (const record of [null, 100, 1100]) {
        const target = Math.max(420, record ?? 0);
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
        getRecord: async () => ({ score: 900 }),
        claim: async score => {
            claims.push(score);
            return { qualified: score > 901, previousRecord: 901, record: { score: Math.max(901, score) } };
        }
    });
    await schedule.update(0, 0, 0);
    await schedule.update(901, 5, 30);
    schedule.update(901, 5, 31);
    assert.equal(schedule.rivals[5].at, 902);
    assert.equal(schedule.canEnter(schedule.rivals[5], 901), false);
    assert.deepEqual(claims, [901]);
    await schedule.update(902, 5, 32);
    assert.equal(schedule.canEnter(schedule.rivals[5], 902), true);
    assert.deepEqual(claims, [901, 902]);
});

test('a delayed refresh cannot undo a live denial or delay an eligible claim', async () => {
    const refresh = deferred();
    let reads = 0;
    const schedule = new RaceSchedule({
        getRecord: async () => ++reads === 1 ? { score: null } : refresh.promise,
        claim: async () => ({ qualified: false, previousRecord: 1200, record: { score: 1200 } })
    });
    await schedule.update(0, 0, 0);
    const reading = schedule.update(300, 4, 16);
    await schedule.update(421, 5, 20);
    refresh.resolve({ score: 422 });
    await reading;
    assert.equal(schedule.rivals[5].at, 1201);
    assert.equal(schedule.canEnter(schedule.rivals[5], 1201), false);
});

test('a lost claim response retries once due and honors the durable receipt even if another runner passed it', async () => {
    const claims = [];
    const schedule = new RaceSchedule({
        getRecord: async () => ({ score: 420 }),
        claim: async score => {
            claims.push(score);
            if (claims.length === 1) return null;
            if (claims.length === 2) throw Error('Server unavailable');
            return { qualified: true, previousRecord: 420, record: { score: 1050 } };
        }
    });
    await schedule.update(0, 0, 0);
    await schedule.update(421, 5, 30);
    for (const [time, score] of [[37, 700], [38, 750], [45, 890], [46, 930]]) {
        assert.equal(schedule.canEnter(schedule.rivals[5], score), false);
        await schedule.update(score, 5, time);
    }
    assert.deepEqual(claims, [421, 750, 930]);
    assert.equal(schedule.canEnter(schedule.rivals[5], 930), true);
});

test('late record reads and claims from a stopped run cannot qualify or reschedule its replay', async () => {
    const oldRead = deferred(), oldClaim = deferred();
    const first = new RaceSchedule({ getRecord: () => oldRead.promise });
    const reading = first.update(0, 0, 0);
    const second = new RaceSchedule({ getRecord: async () => ({ score: null }), claim: () => oldClaim.promise });
    await second.update(0, 0, 0);
    const claiming = second.update(450, 5, 30);
    const replay = new RaceSchedule({ getRecord: async () => ({ score: 800 }) });
    await replay.update(0, 0, 0);
    oldRead.resolve({ score: 6000 });
    oldClaim.resolve({ qualified: true, previousRecord: null, record: { score: 450 } });
    await Promise.all([reading, claiming]);
    assert.equal(first.target, 6000);
    assert.equal(second.qualified, true);
    assert.equal(replay.rivals[5].at, 801);
    assert.equal(replay.canEnter(replay.rivals[5], 900), false);
});

test('every child return reserves two seconds of live street even after a late heat', async () => {
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
        schedule.update(score, wins, returned + 1.99);
        assert.equal(schedule.canEnter(rival, score), false);
        schedule.update(score, wins, returned + 2);
        assert.equal(schedule.canEnter(rival, score), true);
    }
});
