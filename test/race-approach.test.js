import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseSpeed } from '../game/Course.js';
import { approachCopy } from '../game/RaceApproach.js';
import { RaceSchedule } from '../game/RaceSchedule.js';

test('the child and record approach cues arrive with eight to ten seconds of playable street', t => {
    for (const mode of ['day', 'night']) {
        const schedule = new RaceSchedule();
        for (const [rival, target] of [[0, 9000], [5, 48600]]) {
            schedule.setTarget(target);
            const next = schedule.rivals[rival];
            let distance = Math.max(0, next.at - 1200);
            let seconds = 0;
            let warned;
            while (distance < next.at) {
                const speed = courseSpeed(distance, mode);
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

test('the heading and distance forecast a changing mark without promising exact entry', () => {
    const schedule = new RaceSchedule();
    const next = schedule.rivals[0];
    const read = (metres, chasing = false, trackReady = true) =>
        approachCopy(schedule, next, metres, 40, chasing, trackReady);
    assert.deepEqual(read(0), {
        tone: 'quiet', label: 'Next race', name: 'Donald Trump Jr.', detail: 'At 650 m'
    });
    assert.deepEqual(read(335), {
        tone: 'approach', label: 'Race ahead', name: 'Donald Trump Jr.', detail: '315 m to go'
    });
    assert.equal(read(475).detail, '175 m to go');
    assert.equal(read(651, true).detail, 'Clear the chase');
    assert.equal(read(651, false, false).detail, 'Preparing the track');
    schedule.returnedToStreet(0);
    assert.equal(read(651).detail, 'After the street stretch');
    schedule.elapsed = 18;
    assert.equal(read(651).detail, 'Next clear stretch');
});

test('Donald remains conditional during the record claim and can move farther out after a denial', async () => {
    let finishClaim;
    const schedule = new RaceSchedule({
        getRecord: async () => ({ score: 10000 }),
        claim: () => new Promise(resolve => { finishClaim = resolve; })
    });
    const read = (metres) => approachCopy(schedule, schedule.rivals[5], metres, 70, false, true);
    assert.equal(read(9900).name, 'Checking season record');
    await schedule.update(0, 0, 1);
    assert.equal(read(9900).label, 'Record challenge');
    assert.equal(read(9900).detail, '101 m minimum');
    const claim = schedule.update(10001, 5, 2);
    assert.equal(read(10001).detail, 'Checking your record');
    assert.equal(schedule.canEnter(schedule.rivals[5], 10001), false);
    finishClaim({ qualified: false, previousRecord: 14000, record: {score: 14000} });
    await claim;
    assert.equal(read(10002).tone, 'quiet');
    assert.equal(read(10002).detail, 'Beat 14 km to race');
    const secondClaim = schedule.update(14001, 5, 3);
    finishClaim({ qualified: true, previousRecord: 14000, record: {score: 14001}});
    await secondClaim;
    assert.equal(read(14001).label, 'Race ahead');
    assert.equal(schedule.canEnter(schedule.rivals[5], 14001), true);
});
