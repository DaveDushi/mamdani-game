import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseSpeed } from '../game/Course.js';
import { approachCopy } from '../game/RaceApproach.js';
import { RaceSchedule, racePoints } from '../game/RaceSchedule.js';

test('the child and record approach cues arrive with eight to ten seconds of playable street', t => {
    for (const mode of ['day', 'night']) {
        for (const [rival, target] of [[0, null], [4, null], [5, 48600]]) {
            const schedule = new RaceSchedule();
            schedule.setTarget(target);
            const next = schedule.rivals[rival];
            let distance = Math.max(0, next.at - 1200);
            let seconds = 0;
            let warned;
            while (distance < next.at) {
                const speed = courseSpeed(distance, mode);
                schedule.update(Math.floor(distance), rival, seconds);
                const copy = approachCopy(schedule, next, Math.floor(distance), speed, false, true);
                if (copy.tone === 'approach' && warned === undefined) warned = seconds;
                distance += speed / 60;
                seconds += 1 / 60;
            }
            const lead = seconds - warned;
            assert.ok(lead >= 8 && lead <= 10, `${mode} ${next.name}: ${lead}`);
            t.diagnostic(`${mode} ${next.name}: ${lead.toFixed(2)} s to the mark`);
        }
    }
});

test('the heading and distance forecast a mark without promising exact entry', () => {
    const schedule = new RaceSchedule();
    const next = schedule.rivals[0];
    const read = (metres, chasing = false, trackReady = true) =>
        approachCopy(schedule, next, metres, 40, chasing, trackReady);
    assert.deepEqual(read(0), {
        tone: 'quiet', label: 'Next race', name: 'Donald Trump Jr.', detail: 'At 1 km'
    });
    assert.deepEqual(read(685), {
        tone: 'approach', label: 'Race ahead', name: 'Donald Trump Jr.', detail: '315 m to go'
    });
    assert.equal(read(825).detail, '175 m to go');
    assert.equal(read(1001, true).detail, 'Clear the chase');
    assert.equal(read(1001, false, false).detail, 'Preparing the track');
    schedule.returnedToStreet(0);
    assert.equal(read(1001).detail, 'After the street stretch');
    schedule.elapsed = 40;
    assert.equal(read(1001).detail, 'Next clear stretch');
});

test('the children keep their marks while the record is still loading, and only Donald waits for it', () => {
    const schedule = new RaceSchedule({ getRecord: () => new Promise(() => {}) });
    schedule.update(100, 0, 1);
    for (const rival of schedule.rivals.slice(0, 5)) {
        assert.equal(approachCopy(schedule, rival, 0, 40, false, true).name, rival.name);
    }
    assert.equal(approachCopy(schedule, schedule.final, 0, 40, false, true).name, 'Checking season record');
});

test('Donald is described in points, through the claim and a target that moves', async () => {
    let finishClaim;
    const schedule = new RaceSchedule({
        getRecord: async () => ({ score: 14250 }),
        claim: () => new Promise(resolve => { finishClaim = resolve; })
    });
    const read = (metres) => approachCopy(schedule, schedule.final, metres, 70, false, true);
    await schedule.update(0, 0, 0);
    schedule.update(6000, 5, 1, 5000);
    assert.deepEqual(read(5000), {
        tone: 'quiet', label: 'Record challenge', name: 'Donald Trump', detail: `Beat ${racePoints(14250)} to race`
    });
    schedule.update(14000, 5, 2, 11000);
    assert.equal(read(11000).tone, 'approach');
    assert.equal(read(11000).detail, '251 points to go');
    const claim = schedule.update(14251, 5, 3, 11200);
    assert.equal(read(11200).detail, 'Checking your record');
    assert.equal(schedule.canEnter(schedule.final, 11200), false);
    finishClaim({ qualified: false, previousRecord: 18000, record: { score: 18000 } });
    await claim;
    schedule.update(14252, 5, 4, 11201);
    assert.equal(read(11201).tone, 'quiet');
    assert.equal(read(11201).detail, `Beat ${racePoints(18000)} to race`);
    const second = schedule.update(18001, 5, 5, 14000);
    finishClaim({ qualified: true, previousRecord: 18000, record: { score: 18001 } });
    await second;
    assert.equal(read(14000).label, 'Race ahead');
    assert.equal(schedule.canEnter(schedule.final, 14000), true);
});

test('the metres forecast for Donald uses this run\'s points rate, then stands still for the boards', () => {
    const schedule = new RaceSchedule();
    const { final } = schedule;
    schedule.update(6000, 5, 1, 4000);
    assert.equal(final.at, 8001);
    schedule.update(9000, 5, 2, 6000);
    assert.equal(final.at, 8001);
    schedule.update(11600, 5, 3, 7700);
    const settled = final.at;
    assert.ok(Math.abs(settled - 7966) <= 1);
    schedule.update(11750, 5, 3.1, 7830);
    schedule.update(11990, 5, 3.2, 7900);
    assert.equal(final.at, settled);
    // A style drought can outlast the boards. They come back further on.
    schedule.update(11991, 5, 5, 8100);
    assert.ok(final.at > 8100);
    schedule.setTarget(20000);
    assert.ok(final.at > 13000);
    assert.equal(final.target, 20000);
    assert.deepEqual(schedule.rivals.slice(0, 5).map(rival => rival.at), [1000, 3500, 7500, 12500, 18500]);
});
