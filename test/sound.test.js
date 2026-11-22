import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { CUES, LAYERS, LAYER_BARS, LOOP_SECONDS, Sound, layerSteps, renderCue } from '../game/Sound.js';

class Param {
    value = 0;
    check(value, at) {
        assert.ok(Number.isFinite(value) && Number.isFinite(at), 'finite automation');
        this.value = value;
        return this;
    }
    setValueAtTime(value, at) { return this.check(value, at); }
    linearRampToValueAtTime(value, at) { return this.check(value, at); }
    exponentialRampToValueAtTime(value, at) {
        assert.ok(value > 0);
        return this.check(value, at);
    }
    setTargetAtTime(value, at, glide) {
        assert.ok(glide > 0);
        return this.check(value, at);
    }
    cancelScheduledValues(at) { assert.ok(Number.isFinite(at)); }
}

class Node {
    constructor(ctx) { this.ctx = ctx; }
    connect(to) {
        this.ctx.live.add(this);
        return to;
    }
    disconnect() { this.ctx.live.delete(this); }
}

class FakeContext {
    state = 'running';
    currentTime = 0;
    sampleRate = 48000;
    live = new Set();
    sources = [];
    destination = new Node(this);
    made = 0;
    node(...params) {
        this.made++;
        const node = new Node(this);
        for (const name of params) node[name] = new Param();
        return node;
    }
    createGain() { return this.node('gain'); }
    createBiquadFilter() { return this.node('frequency', 'Q'); }
    createWaveShaper() { return this.node(); }
    createDynamicsCompressor() { return this.node('threshold', 'knee', 'ratio', 'attack', 'release'); }
    createBuffer(channels, length, rate) {
        const data = new Float32Array(length);
        return { length, sampleRate: rate, duration: length / rate, getChannelData: () => data };
    }
    createBufferSource() {
        const ctx = this, source = this.node('playbackRate');
        source.playbackRate.value = 1;
        source.start = (when = 0, offset = 0) => {
            assert.ok(when >= 0 && offset >= 0);
            source.startedAt = Math.max(when, ctx.currentTime);
            source.offset = offset;
            source.ends = source.loop ? Infinity : source.startedAt + source.buffer.duration / source.playbackRate.value;
            ctx.sources.push(source);
        };
        source.stop = (when = 0) => {
            assert.ok(source.startedAt !== undefined, 'stop follows start');
            source.ends = Math.min(source.ends, Math.max(when, ctx.currentTime));
        };
        return source;
    }
    resume() {
        this.resumed = (this.resumed ?? 0) + 1;
        this.state = 'running';
        return Promise.resolve();
    }
    advance(seconds) {
        this.currentTime += seconds;
        const done = this.sources.filter(source => source.ends <= this.currentTime);
        this.sources = this.sources.filter(source => source.ends > this.currentTime);
        for (const source of done) source.onended?.({ target: source });
    }
}

const flush = () => new Promise(resolve => setImmediate(resolve));
let last;

function makeSound(seconds) {
    globalThis.AudioContext = FakeContext;
    const sound = last = new Sound();
    sound.enabled = true;
    sound.unlock();
    clearTimeout(sound.warming);
    sound.warming = 0;
    sound.queueWarm = () => {};
    const { ctx } = sound;
    if (seconds) sound.recording = Promise.resolve(ctx.createBuffer(2, Math.round(seconds * 48000), 48000));
    return { sound, ctx };
}

afterEach(() => {
    clearTimeout(last?.warming);
    last = null;
    delete globalThis.AudioContext;
});

test('every cue bakes to a clean, unclipped buffer', () => {
    for (const cue of CUES) {
        if (cue === 'starterPistol') continue;
        const samples = renderCue(cue);
        let peak = 0;
        for (const x of samples) {
            assert.ok(Number.isFinite(x), cue);
            peak = Math.max(peak, Math.abs(x));
        }
        assert.ok(Math.abs(peak - 1) < 1e-4, cue + ' is levelled');
        assert.ok(Math.abs(samples[0]) < 0.01 && Math.abs(samples.at(-1)) < 0.01, cue + ' ends quietly');
    }
    for (const cue of ['rhythmPerfect', 'rhythmGood', 'rhythmMiss', 'step', 'stride']) {
        assert.ok(renderCue(cue).length / 24000 <= 0.16, cue + ' clears the next beat at six a second');
    }
    assert.notDeepEqual(renderCue('step', 0), renderCue('step', 1));
});

test('the loop layers divide the recording evenly and repeat without a seam', () => {
    for (const name of LAYERS) {
        const steps = layerSteps(name);
        let result;
        do result = steps.next();
        while (!result.done);
        const samples = result.value;
        assert.ok(Math.abs(samples.length / 24000 - LOOP_SECONDS * LAYER_BARS[name] / 16) < 1e-4, name);
        assert.ok(samples.every(Number.isFinite), name);
        assert.ok(Math.abs(samples[0] - samples.at(-1)) < 0.2, name);
    }
});

test('sound is silent and harmless without Web Audio', () => {
    const sound = new Sound();
    sound.unlock();
    for (const cue of [...CUES, 'nonsense', undefined]) sound.play(cue);
    sound.setIntensity(0.7);
    sound.setMood('race');
    sound.music(true, true);
    sound.music(false);
    sound.toggle();
    sound.toggle();
    assert.equal(sound.ctx, undefined);
});

test('every cue the game asks for exists', () => {
    const { sound, ctx } = makeSound();
    const files = readdirSync(new URL('../game/', import.meta.url)).filter(file => file.endsWith('.js')).map(file => '../game/' + file);
    const text = [...files, '../main.js'].map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
    const asked = [...text.matchAll(/sound\??\.play(?:\?\.)?\('(\w+)'/g)].map(match => match[1]);
    const contract = 'carriageBell victory count go chase escape stunt haram edition stamp jump slide hit kafiyeh covidMask rainbow start end stride starterPistol land whoosh crash smash power multiplier multiplierLost step rhythmPerfect rhythmGood rhythmMiss crowd stretch newBest'.split(' ');
    assert.ok(asked.length > 10);
    for (const cue of new Set([...asked, ...contract])) {
        ctx.advance(5);
        const before = ctx.sources.length;
        sound.play(cue);
        assert.ok(ctx.sources.length > before, cue + ' makes a sound');
    }
    ctx.advance(5);
    const before = ctx.made;
    for (const cue of ['nonsense', 'toString', '__proto__', '', null, undefined]) sound.play(cue);
    assert.equal(ctx.made, before);
});

test('quick stamps climb and a pause resets the run', () => {
    const { sound, ctx } = makeSound();
    const rates = [];
    for (let i = 0; i < 14; i++) {
        sound.play('stamp');
        rates.push(ctx.sources.at(-1).playbackRate.value);
        ctx.advance(0.15);
    }
    for (let i = 1; i < 9; i++) assert.ok(rates[i] > rates[i - 1]);
    assert.ok(Math.max(...rates) < 3.2);
    ctx.advance(2);
    sound.play('stamp');
    assert.ok(ctx.sources.at(-1).playbackRate.value < 1.02);
    const heard = level => {
        ctx.advance(1);
        sound.play('multiplier', level);
        return ctx.sources.at(-1).playbackRate.value;
    };
    assert.ok(heard(2) < heard(3) && heard(3) < heard(5));
    assert.ok(heard(undefined) < 1.02 && heard(NaN) < 1.02 && Number.isFinite(heard(400)));
});

test('polyphony is capped and important cues outrank footsteps', () => {
    const { sound, ctx } = makeSound();
    for (let i = 0; i < 60; i++) {
        for (const cue of CUES) if (cue !== 'starterPistol') sound.play(cue);
        ctx.advance(0.01);
        assert.ok(sound.voices.length <= 18);
    }
    assert.ok(sound.voices.some(voice => voice.cue === 'newBest'));
    assert.ok(!sound.voices.some(voice => voice.cue === 'step'));
});

test('a long session leaves no nodes behind', async () => {
    const { sound, ctx } = makeSound(LOOP_SECONDS);
    const resting = ctx.live.size;
    for (const name of LAYERS) sound.layerBank.set(name, ctx.createBuffer(1, 24000, 24000));
    let seed = 1;
    const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    for (let run = 0; run < 6; run++) {
        sound.music(false, true);
        sound.music(true);
        await flush();
        for (let i = 0; i < 4000; i++) {
            sound.setIntensity(rand());
            sound.play('step', rand());
            if (rand() < 0.2) sound.play(CUES[Math.floor(rand() * CUES.length)], Math.floor(rand() * 6));
            if (rand() < 0.002) sound.setMood(rand() < 0.5 ? 'race' : 'street');
            if (rand() < 0.002) {
                sound.music(false);
                ctx.advance(rand());
                sound.unlock();
                sound.music(true);
                await flush();
            }
            if (rand() < 0.001) {
                sound.toggle();
                sound.toggle();
                await flush();
            }
            ctx.advance(0.05);
            assert.ok(ctx.live.size < resting + 70);
        }
        sound.music(false, true);
    }
    ctx.advance(10);
    assert.equal(sound.voices.length, 0);
    assert.equal(ctx.sources.length, 0);
    assert.equal(ctx.live.size, resting);
});

test('voices recover when an interruption swallows their ended events', () => {
    const { sound, ctx } = makeSound();
    for (let i = 0; i < 4; i++) {
        sound.play('crowd');
        for (const source of ctx.sources) source.onended = null;
        ctx.advance(0.5);
    }
    ctx.advance(10);
    sound.play('stamp');
    assert.deepEqual(sound.voices.map(voice => voice.cue), ['stamp']);
});

test('pausing keeps the song position and a restart rewinds it', async () => {
    const { sound, ctx } = makeSound(LOOP_SECONDS);
    sound.music(true);
    await flush();
    assert.equal(sound.track.base.source.offset, 0);
    assert.ok(Math.abs(sound.track.base.source.loopEnd - LOOP_SECONDS) < 1e-4);
    ctx.advance(4.02);
    sound.music(true);
    await flush();
    assert.equal(ctx.sources.length, 1, 'a second call does not double the track');
    sound.music(false);
    assert.equal(sound.track, null);
    ctx.advance(60);
    sound.music(true);
    await flush();
    assert.ok(Math.abs(sound.track.base.source.offset - 4) < 1e-6);
    ctx.advance(LOOP_SECONDS + 1);
    sound.music(false);
    sound.music(true);
    await flush();
    assert.ok(sound.track.base.source.offset < LOOP_SECONDS);
    sound.setIntensity(1);
    sound.setMood('race');
    sound.music(false, true);
    assert.equal(sound.intensity, 0);
    assert.equal(sound.mood, 'street');
    sound.music(true);
    await flush();
    assert.equal(sound.track.base.source.offset, 0);
    sound.music(false);
    sound.music(true);
    sound.music(false);
    await flush();
    assert.equal(sound.track, null, 'a stop before decoding wins');
});

test('late layers join on the beat and an untrimmed recording is skipped into', async () => {
    const { sound, ctx } = makeSound(LOOP_SECONDS + 0.064);
    (await sound.recording).getChannelData(0).fill(0.5, 0.032 * 48000);
    sound.music(true);
    await flush();
    const { base } = sound.track;
    assert.ok(Math.abs(base.source.loopStart - 0.032) < 1e-3);
    assert.ok(Math.abs(base.source.loopEnd - base.source.loopStart - LOOP_SECONDS) < 1e-6);
    ctx.advance(9);
    sound.layerBank.set('drums', ctx.createBuffer(1, 24000, 24000));
    sound.startLayers();
    const { drums } = sound.track, bar = LOOP_SECONDS / 16;
    const songAt = drums.source.startedAt - base.source.startedAt;
    assert.ok(Math.abs(songAt % (bar * 4) - drums.source.offset) < 1e-6);
    ctx.advance(1);
    sound.startLayers();
    assert.equal(sound.track.drums, drums);
});

test('the chase opens the mix in stages and ignores bad values', () => {
    const { sound } = makeSound();
    const level = name => sound.layerGain[name].gain.value;
    assert.deepEqual(LAYERS.map(level), [0, 0, 0, 0]);
    sound.setIntensity(0.25);
    assert.ok(level('drums') > 0 && level('bass') === 0 && level('heart') === 0);
    sound.setIntensity(0.7);
    assert.ok(level('bass') > 0 && level('heart') === 0);
    sound.setIntensity(1);
    assert.ok(level('heart') > 0);
    for (const bad of [NaN, undefined, Infinity, -4]) {
        sound.setIntensity(bad);
        assert.equal(sound.intensity, 0);
    }
    sound.setIntensity(9);
    assert.equal(sound.intensity, 1);
    sound.setMood('race');
    assert.ok(level('race') > 0);
    sound.setMood('nonsense');
    assert.equal(sound.mood, 'street');
});

test('big moments duck the music and a small one cannot cut them short', () => {
    const { sound, ctx } = makeSound();
    sound.play('newBest');
    assert.equal(sound.duckDepth, 0.25);
    ctx.advance(0.3);
    sound.play('hit');
    assert.equal(sound.duckDepth, 0.25);
    ctx.advance(3);
    sound.play('hit');
    assert.equal(sound.duckDepth, 0.6);
});

test('switching sound off stops everything and builds nothing', async () => {
    const { sound, ctx } = makeSound(LOOP_SECONDS);
    sound.music(true);
    await flush();
    sound.play('crowd');
    sound.toggle();
    ctx.advance(0.1);
    assert.equal(ctx.sources.length, 0);
    const made = ctx.made;
    for (const cue of CUES) sound.play(cue);
    sound.setIntensity(1);
    sound.setIntensity(0.5);
    sound.music(false);
    sound.music(true);
    sound.warm();
    sound.unlock();
    await flush();
    assert.equal(ctx.made, made);
    sound.toggle();
    await flush();
    assert.ok(sound.track);
    assert.ok(sound.layerGain.drums.gain.value > 0, 'the stored intensity comes back');
});

test('an interrupted or suspended context resumes on the next unlock', () => {
    const { sound, ctx } = makeSound();
    for (const state of ['suspended', 'interrupted']) {
        ctx.state = state;
        const made = ctx.made;
        sound.play('stamp');
        assert.equal(ctx.made, made);
        sound.unlock();
        assert.equal(ctx.state, 'running');
    }
    const before = ctx.resumed;
    sound.unlock();
    assert.equal(ctx.resumed, before);
});

test('the background warm-up bakes every cue and layer, then stops', () => {
    const { sound } = makeSound();
    for (let i = 0; i < 200; i++) sound.warm();
    assert.equal(sound.bank.size, CUES.length - 1);
    assert.equal(sound.layerBank.size, LAYERS.length);
    delete sound.queueWarm;
    sound.queueWarm();
    assert.equal(sound.warming, 0);
});

test('a recording that fails to load leaves effects working and can be retried', async () => {
    const { sound, ctx } = makeSound();
    sound.music(true);
    await flush();
    await flush();
    assert.equal(sound.recording, null);
    assert.equal(sound.track ?? null, null);
    sound.play('stamp');
    assert.equal(ctx.sources.length, 1);
});
