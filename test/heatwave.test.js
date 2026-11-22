import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, DirectionalLight, FogExp2, HemisphereLight, Scene } from 'three';
import { Heatwave, HEATWAVE_SECONDS } from '../game/Heatwave.js';
import { StreetLight } from '../game/StreetLight.js';
import { courseSpeed } from '../game/Course.js';

test('heatwaves start beyond onboarding and hold the full streak window through a ride or sprint', () => {
    const round = new Heatwave(() => 0);
    assert.equal(round.update(500, 849, true), undefined);
    assert.equal(round.streakReward, 1);
    assert.equal(round.update(35, 950, false), undefined);
    assert.equal(round.update(0, 950, true), undefined);
    assert.equal(round.update(1 / 60, 950, true), 'start');
    assert.equal(round.streakReward, 5);
    assert.equal(round.styleBoost, 2);
    round.update(5, 1100, true);
    round.update(100, 5400, false);
    assert.equal(round.remaining, HEATWAVE_SECONDS - 5);
    assert.equal(round.streakReward, 1);
    assert.equal(round.styleBoost, 1);
    round.update(0, 5400, true);
    assert.equal(round.streakReward, 5);
    assert.equal(round.update(11, 5700, true), 'end');
    assert.equal(round.streakReward, 1);
    round.update(100, 6000, false);
    assert.equal(round.update(39, 9000, true), undefined);
    assert.equal(round.update(1, 9100, true), 'start');
    assert.equal(new Heatwave().streakReward, 1);
});

test('rounds and bounded breaks recur beyond 40 km at Overtime speed in either shift', () => {
    for (const mode of ['day', 'night']) {
        let random = 0;
        const round = new Heatwave(() => (random = (random + 0.37) % 1));
        let time = 0, metres = 0, start = 0, end = 0;
        const breaks = new Set();
        while (metres < 41000) {
            time += .25;
            metres += courseSpeed(metres, mode) * (metres > 10000 ? 1.1 : 1) * .25;
            const event = round.update(.25, metres, true);
            if (event === 'start') {
                if (end) {
                    const gap = time - end;
                    assert.ok(gap >= 40 && gap <= 60);
                    breaks.add(gap);
                } else assert.ok(metres >= 850 && metres < 1120);
                start = time;
            } else if (event === 'end') {
                assert.equal(time - start, HEATWAVE_SECONDS);
                end = time;
            }
        }
        assert.ok(breaks.size >= 6);
    }
});

test('warm street light restores the district and preserves the takeover and visibility in both shifts', () => {
    const scene = new Scene();
    scene.background = new Color();
    scene.fog = new FogExp2();
    const light = new StreetLight(scene, new HemisphereLight(), new DirectionalLight(), new DirectionalLight());
    light.lamps = {};
    for (const mode of ['day', 'night']) {
        for (const takeover of [0, 1]) {
            light.setShift(mode);
            light.setTakeover(takeover);
            light.update(40000);
            const before = light.sun.color.clone(), fog = scene.fog.color.clone(), density = scene.fog.density;
            light.setHeatwave(true, 40000);
            assert.ok(light.sun.color.b / light.sun.color.r < before.b / before.r);
            assert.equal(scene.fog.density, density);
            assert.equal(light.takeover.value, takeover);
            assert.notEqual(scene.fog.color.getHex(), fog.getHex());
            light.setHeatwave(false, 40000);
            assert.deepEqual(light.sun.color, before);
            assert.deepEqual(scene.fog.color, fog);
            light.setHeatwave(true, 40000);
            light.setShift(mode);
            light.update(0);
            assert.equal(light.heatwave.value, 0);
        }
    }
});
