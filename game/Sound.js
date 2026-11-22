// Effects are baked once into mono buffers with plain maths, so a play() is one source and one gain.
const RATE = 24000;
const TAU = Math.PI * 2;

// city-desk.m4a: 16 bars of swung 4/4 at 151 BPM, first downbeat at zero, beats two and four accented.
export const LOOP_SECONDS = 813775 / 32000;
export const LOOP_BARS = 16;
const BEAT = LOOP_SECONDS / (LOOP_BARS * 4);
const SWING = 2 / 3;
// Roots of the recording's own walking bass, one per bar.
const ROOTS = [38, 43, 36, 41, 38, 43, 36, 45, 41, 46, 40, 45, 38, 43, 36, 45];

const MUSIC_GAIN = 0.26;
const MAX_VOICES = 18;
const STAMP_WINDOW = 0.85;
// Pentatonic, so rising runs stay inside the loop's C major.
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19];

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const smooth = (low, high, value) => {
    const t = clamp((value - low) / (high - low));
    return t * t * (3 - 2 * t);
};
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

function randomizer(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Worked out every eight samples and drawn straight between, which keeps baking cheap on phones.
function envelope(dur, attack, decay) {
    const shape = t => {
        if (decay === 'swell') return Math.sin(Math.PI * clamp(t / dur)) ** 1.5;
        const tail = Math.exp(-decay * t / dur) * clamp((dur - t) / Math.min(0.02, dur * 0.2));
        return t < attack ? tail * t / attack : tail;
    };
    let from = 0, to = shape(0);
    return i => {
        const k = i & 7;
        if (k === 0) {
            from = to;
            to = shape((i + 8) / RATE);
        }
        return from + (to - from) * k / 8;
    };
}

// State variable filter; callers refresh the cutoff every 16 samples.
function makeFilter(type, q) {
    let low = 0, band = 0, a1 = 0, a2 = 0, a3 = 0;
    const k = 1 / q;
    return {
        tune(cutoff) {
            const g = Math.tan(Math.PI * clamp(cutoff, 20, RATE * 0.45) / RATE);
            a1 = 1 / (1 + g * (g + k));
            a2 = g * a1;
            a3 = g * a2;
        },
        run(x) {
            const v3 = x - low;
            const v1 = a1 * band + a2 * v3;
            const v2 = low + a2 * band + a3 * v3;
            band = 2 * v1 - band;
            low = 2 * v2 - low;
            return type === 'low' ? v2 : type === 'band' ? v1 * k : x - k * v1 - v2;
        }
    };
}

function noise(out, o) {
    const { at = 0, dur, from, to = from, type = 'band', q = 1, gain = 1, attack = 0.002, decay = 6, flutter = 0, flutterHz = 30, seed = 1 } = o;
    const rand = randomizer(seed), filter = makeFilter(type, q);
    const start = Math.round(at * RATE), count = Math.min(Math.round(dur * RATE), out.length - start);
    const shape = envelope(dur, attack, decay);
    let flutterFrom = 1, flutterTo = 1;
    const flutterSpan = Math.max(1, Math.round(RATE / flutterHz));
    // A narrow band keeps little of the raw noise, so level it back toward the tones around it.
    const middle = Math.sqrt(from * to), width = type === 'low' ? middle : type === 'band' ? middle / q : RATE / 2;
    const makeup = clamp(Math.sqrt(RATE / 2 / width), 1, 2.4);
    for (let i = 0; i < count; i++) {
        if (i % 16 === 0) filter.tune(from * (to / from) ** (i / count));
        let level = gain * makeup * shape(i);
        if (flutter) {
            const step = i % flutterSpan;
            if (step === 0) {
                flutterFrom = flutterTo;
                flutterTo = 1 - flutter * rand();
            }
            level *= flutterFrom + (flutterTo - flutterFrom) * step / flutterSpan;
        }
        out[start + i] += filter.run(rand() * 2 - 1) * level;
    }
}

function pitchAt(t, dur, from, to, bend, vibrato, vibratoHz) {
    const f = from === to ? from : from * (to / from) ** clamp(t / dur * bend);
    return vibrato ? f * (1 + vibrato * clamp(t / 0.15) * Math.sin(TAU * vibratoHz * t)) : f;
}

const SINE = [[1, 1, 1]];
const BELL = [[1, 1, 1], [2.76, 0.42, 1.7], [5.4, 0.2, 2.6], [8.93, 0.07, 4]];
const VIBES = [[1, 1, 1], [3.98, 0.24, 2.2], [9.2, 0.05, 5]];
const WOOD = [[1, 1, 1], [2.7, 0.35, 2], [4.9, 0.12, 3]];

function tone(out, o) {
    const { at = 0, dur, from, to = from, gain = 1, attack = 0.004, decay = 5, bend = 1, vibrato = 0, vibratoHz = 6, partials = SINE } = o;
    const start = Math.round(at * RATE), count = Math.min(Math.round(dur * RATE), out.length - start);
    for (const [ratio, amp, fade] of partials) {
        if (Math.max(from, to) * ratio > RATE * 0.46) continue;
        const shape = envelope(dur, attack, decay * fade), level = gain * amp;
        let phase = 0, step = 0;
        for (let i = 0; i < count; i++) {
            if (i % 8 === 0) step = TAU * ratio / RATE * pitchAt(i / RATE, dur, from, to, bend, vibrato, vibratoHz);
            phase += step;
            out[start + i] += Math.sin(phase) * level * shape(i);
        }
    }
}

// Band-limited saw through a moving low-pass: brass, horns and bass.
function reed(out, o) {
    const { at = 0, dur, from, to = from, gain = 1, attack = 0.014, decay = 3, open = 2600, close = 700, q = 0.9, vibrato = 0, vibratoHz = 5.5, wrap = false } = o;
    const filter = makeFilter('low', q), size = out.length;
    const start = Math.round(at * RATE), count = Math.round(dur * RATE);
    const shape = envelope(dur, attack, decay);
    let phase = 0, step = 0;
    for (let i = 0; i < count; i++) {
        if (i % 8 === 0) step = pitchAt(i / RATE, dur, from, to, 1, vibrato, vibratoHz) / RATE;
        phase += step;
        if (phase >= 1) phase -= 1;
        let saw = phase * 2 - 1;
        if (phase < step) {
            const x = phase / step;
            saw -= x + x - x * x - 1;
        } else if (phase > 1 - step) {
            const x = (phase - 1) / step;
            saw -= x * x + x + x + 1;
        }
        const level = shape(i);
        if (i % 16 === 0) filter.tune(close + (open - close) * level);
        let index = start + i;
        if (index >= size) {
            if (!wrap) return;
            index -= size;
        }
        out[index] += filter.run(saw) * level * gain;
    }
}

function pluck(out, { at = 0, from, dur, gain = 1, seed = 1, damp = 0.994 }) {
    const rand = randomizer(seed), period = Math.max(2, Math.round(RATE / from));
    const line = new Float32Array(period).map(() => rand() * 2 - 1);
    const start = Math.round(at * RATE), count = Math.min(Math.round(dur * RATE), out.length - start);
    for (let i = 0; i < count; i++) {
        const j = i % period, value = line[j];
        line[j] = (value + line[(j + 1) % period]) * 0.5 * damp;
        out[start + i] += value * gain * clamp((dur - i / RATE) / 0.02);
    }
}

function thud(out, { at = 0, from = 150, to = 48, dur = 0.16, gain = 1, grit = 0.5, seed = 7 }) {
    tone(out, { at, dur, from, to, gain, attack: 0.002, decay: 5, bend: 2 });
    // The upper knock carries on phone speakers, which lose the sine underneath.
    tone(out, { at, dur: dur * 0.55, from: from * 2.6, to: to * 2.4, gain: gain * 0.7, attack: 0.001, decay: 5 });
    noise(out, { at, dur: dur * 0.6, from: 2200, to: 450, type: 'low', gain: gain * grit, decay: 6, seed });
}

function debris(out, { at, span, count, low = 900, high = 5200, gain = 0.4, seed = 3, ring = 0.05 }) {
    const rand = randomizer(seed);
    for (let i = 0; i < count; i++) {
        const when = at + span * rand() ** 1.3, f = low * (high / low) ** rand();
        const level = gain * (0.35 + 0.65 * rand()) * (1 - 0.6 * (when - at) / span);
        tone(out, { at: when, dur: ring * (0.6 + rand()), from: f, gain: level * 0.5, attack: 0.001, decay: 6, partials: WOOD });
        noise(out, { at: when, dur: ring * 0.7, from: f, q: 2, gain: level, decay: 7, seed: seed + i * 13 });
    }
}

function brass(out, notes, o) {
    for (const [at, dur, midi, gain = 1] of notes) {
        reed(out, { at, dur, from: hz(midi), gain: gain * 0.5, decay: 1.8, ...o });
        reed(out, { at, dur, from: hz(midi) * 1.005, gain: gain * 0.35, decay: 1.8, ...o });
    }
}

function crowdBed(out, { at, dur, gain, seed }) {
    for (let i = 0; i < 4; i++) {
        noise(out, { at, dur, from: [420, 780, 1350, 2500][i], q: 1.6, gain: gain * [0.8, 1, 0.8, 0.4][i], attack: 0.12, decay: 2.6, flutter: 0.6, flutterHz: 7 + i * 3, seed: seed + i });
    }
}

// Each recipe is [seconds, draw]. A cue listed in VARIANTS is drawn once per take.
const recipes = {
    step: [0.1, (out, n) => {
        thud(out, { from: 230 - n * 8, to: 120, dur: 0.06, grit: 0.8, seed: 20 + n });
        noise(out, { at: 0.012, dur: 0.05, from: 2100 + n * 170, q: 0.8, gain: 0.22, decay: 6, seed: 40 + n });
    }],
    stride: [0.1, (out, n) => {
        thud(out, { from: 270 - n * 14, to: 140, dur: 0.055, grit: 0.9, seed: 60 + n });
        noise(out, { dur: 0.03, from: 2900, q: 0.9, gain: 0.5, decay: 6, seed: 70 + n });
    }],
    land: [0.26, out => {
        thud(out, { from: 200, to: 75, dur: 0.18, grit: 1 });
        noise(out, { at: 0.02, dur: 0.2, from: 1800, to: 700, q: 0.7, gain: 0.25, decay: 6, flutter: 0.5, flutterHz: 60, seed: 9 });
    }],
    whoosh: [0.2, out => {
        noise(out, { dur: 0.19, from: 700, to: 2300, q: 1.1, decay: 'swell', flutter: 0.45, flutterHz: 55, seed: 11 });
        noise(out, { at: 0.03, dur: 0.15, from: 3800, to: 2400, q: 1, gain: 0.28, decay: 'swell', flutter: 0.7, flutterHz: 80, seed: 12 });
    }],
    jump: [0.3, out => {
        thud(out, { from: 190, to: 95, dur: 0.06, gain: 0.5, grit: 0.6 });
        noise(out, { dur: 0.27, from: 500, to: 2600, q: 1.2, gain: 0.9, decay: 'swell', flutter: 0.25, flutterHz: 45, seed: 14 });
        tone(out, { at: 0.01, dur: 0.19, from: 240, to: 520, gain: 0.5, attack: 0.01, decay: 3.5, partials: [[1, 1, 1], [2, 0.3, 1.5]] });
    }],
    slide: [0.46, out => {
        noise(out, { dur: 0.44, from: 2600, to: 1100, q: 0.9, attack: 0.02, decay: 3, flutter: 0.75, flutterHz: 120, seed: 16 });
        noise(out, { dur: 0.36, from: 420, to: 240, q: 1, gain: 0.7, attack: 0.02, decay: 3.5, flutter: 0.4, flutterHz: 50, seed: 17 });
    }],
    hit: [0.5, out => {
        thud(out, { from: 190, to: 60, dur: 0.2, gain: 0.8, grit: 1.3 });
        noise(out, { dur: 0.1, from: 2400, to: 800, q: 0.7, gain: 0.8, decay: 6, seed: 19 });
        debris(out, { at: 0.05, span: 0.3, count: 7, gain: 0.3, seed: 21 });
    }],
    crash: [0.95, out => {
        thud(out, { from: 185, to: 55, dur: 0.24, gain: 0.75, grit: 1.4, seed: 23 });
        noise(out, { dur: 0.16, from: 3200, to: 600, q: 0.6, decay: 5, seed: 24 });
        for (const f of [322, 541, 877, 1330]) tone(out, { at: 0.01, dur: 0.4, from: f, gain: 0.16, attack: 0.001, decay: 6 });
        debris(out, { at: 0.07, span: 0.62, count: 18, gain: 0.42, seed: 25 });
        noise(out, { at: 0.12, dur: 0.6, from: 900, to: 400, q: 0.7, gain: 0.22, decay: 4, flutter: 0.8, flutterHz: 35, seed: 26 });
    }],
    smash: [1.15, out => {
        thud(out, { from: 165, to: 45, dur: 0.36, gain: 0.85, grit: 1.4, seed: 27 });
        noise(out, { dur: 0.3, from: 4200, to: 380, q: 0.6, gain: 1.1, decay: 4.5, flutter: 0.5, flutterHz: 70, seed: 28 });
        for (const f of [187, 263, 418, 701, 1123]) tone(out, { dur: 0.6, from: f, to: f * 0.96, gain: 0.17, attack: 0.001, decay: 5, vibrato: 0.01, vibratoHz: 23 });
        debris(out, { at: 0.08, span: 0.85, count: 22, low: 1800, high: 8200, gain: 0.32, ring: 0.08, seed: 29 });
    }],
    stamp: [0.4, out => {
        thud(out, { from: 240, to: 130, dur: 0.045, gain: 0.5, grit: 0.9, seed: 31 });
        tone(out, { at: 0.004, dur: 0.1, from: hz(79), gain: 0.5, attack: 0.002, partials: BELL });
        tone(out, { at: 0.05, dur: 0.33, from: hz(84), gain: 0.85, attack: 0.002, decay: 6, partials: BELL });
    }],
    stunt: [0.34, out => {
        noise(out, { dur: 0.12, from: 1500, to: 4200, q: 1.2, gain: 0.3, decay: 'swell', seed: 33 });
        tone(out, { dur: 0.16, from: hz(76), gain: 0.6, partials: VIBES });
        tone(out, { at: 0.07, dur: 0.26, from: hz(81), gain: 0.8, partials: VIBES });
    }],
    multiplier: [0.62, out => {
        [72, 76, 79, 84].forEach((note, i) => tone(out, { at: i * 0.055, dur: 0.4, from: hz(note), gain: 0.55 + i * 0.12, decay: 5.5, partials: VIBES }));
        reed(out, { at: 0.16, dur: 0.34, from: hz(60), gain: 0.35, decay: 3.5, open: 3400 });
        noise(out, { at: 0.12, dur: 0.4, from: 6200, to: 8800, gain: 0.16, decay: 5, seed: 35 });
    }],
    multiplierLost: [0.55, out => {
        [67, 63, 58].forEach((note, i) => reed(out, { at: i * 0.11, dur: 0.22 + i * 0.05, from: hz(note), to: hz(note - 1), gain: 0.6, open: 1500, close: 400 }));
        noise(out, { at: 0.05, dur: 0.46, from: 1700, to: 260, q: 1.2, gain: 0.3, decay: 3, seed: 36 });
    }],
    power: [0.75, out => {
        tone(out, { dur: 0.45, from: 220, to: 880, gain: 0.4, attack: 0.03, decay: 2.5, vibrato: 0.02, vibratoHz: 18, partials: [[1, 1, 1], [2, 0.5, 1.2], [3, 0.2, 1.5]] });
        [72, 79, 84].forEach((note, i) => tone(out, { at: 0.18 + i * 0.07, dur: 0.42, from: hz(note), gain: 0.5, partials: BELL }));
    }],
    kafiyeh: [0.95, out => {
        [[0, 62], [0.1, 63], [0.2, 66], [0.3, 67], [0.4, 74]].forEach(([at, note], i) => {
            pluck(out, { at, from: hz(note), dur: i === 4 ? 0.54 : 0.3, gain: 0.6, seed: 80 + i });
            pluck(out, { at: at + 0.004, from: hz(note - 12), dur: 0.3, gain: 0.35, seed: 90 + i });
        });
        noise(out, { dur: 0.3, from: 900, to: 2600, gain: 0.35, decay: 'swell', flutter: 0.5, flutterHz: 40, seed: 38 });
        thud(out, { from: 180, to: 80, dur: 0.14, gain: 0.5, grit: 0.4 });
    }],
    rainbow: [1.1, out => {
        [72, 76, 79, 83, 86, 91].forEach((note, i) => tone(out, { at: i * 0.07, dur: 0.6, from: hz(note), gain: 0.5, partials: BELL }));
        [60, 64, 67].forEach(note => tone(out, { at: 0.1, dur: 0.95, from: hz(note), gain: 0.2, attack: 0.12, decay: 3, vibrato: 0.006, partials: [[1, 1, 1], [2, 0.4, 1.3]] }));
        noise(out, { at: 0.2, dur: 0.8, from: 5200, to: 9200, q: 1.4, gain: 0.15, decay: 3.5, flutter: 0.8, flutterHz: 24, seed: 39 });
    }],
    covidMask: [0.85, out => {
        noise(out, { dur: 0.3, from: 900, to: 2400, q: 1.2, gain: 0.8, decay: 'swell', seed: 41 });
        noise(out, { at: 0.36, dur: 0.46, from: 1700, to: 500, q: 1.2, gain: 0.7, decay: 'swell', seed: 42 });
        [[0.06, 79], [0.2, 79], [0.34, 86]].forEach(([at, note]) => tone(out, { at, dur: 0.2, from: hz(note), gain: 0.42, decay: 4, partials: [[1, 1, 1], [2, 0.25, 2]] }));
    }],
    fastFreeBus: [0.95, out => {
        for (const at of [0, 0.2]) for (const note of [58, 62]) reed(out, { at, dur: at ? 0.36 : 0.15, from: hz(note), gain: 0.5, decay: 1, close: 1400 });
        noise(out, { at: 0.5, dur: 0.42, from: 5200, to: 2600, q: 0.8, gain: 0.5, attack: 0.02, decay: 4.5, seed: 43 });
    }],
    count: [0.16, out => {
        tone(out, { dur: 0.14, from: hz(67), gain: 0.9, attack: 0.002, partials: WOOD });
        noise(out, { dur: 0.02, from: 2600, gain: 0.35, decay: 5, seed: 44 });
    }],
    go: [0.5, out => {
        for (const note of [79, 84]) tone(out, { dur: 0.46, from: hz(note), gain: 0.6, decay: 4.5, partials: VIBES });
        reed(out, { dur: 0.32, from: hz(60), gain: 0.5, open: 3200 });
        noise(out, { dur: 0.05, from: 3000, q: 0.8, gain: 0.3, decay: 5, seed: 45 });
    }],
    start: [0.75, out => {
        brass(out, [[0, 0.12, 62], [0.1, 0.12, 67], [0.2, 0.5, 72], [0.2, 0.5, 76, 0.7]], { open: 3200 });
        noise(out, { at: 0.2, dur: 0.5, from: 7000, type: 'high', q: 0.8, gain: 0.2, seed: 46 });
    }],
    edition: [0.8, out => {
        // A press roll, then the bell.
        for (let i = 0; i < 5; i++) noise(out, { at: i * 0.055, dur: 0.04, from: 2300 + (i % 2) * 700, q: 2, gain: 0.55, decay: 5, seed: 47 + i });
        [67, 70, 74].forEach((note, i) => tone(out, { at: 0.08 + i * 0.1, dur: 0.5, from: hz(note), gain: 0.6, partials: VIBES }));
    }],
    chase: [0.95, out => {
        brass(out, [[0, 0.16, 50], [0, 0.16, 56, 0.8], [0.16, 0.16, 50], [0.16, 0.16, 56, 0.8], [0.32, 0.5, 53], [0.32, 0.5, 59, 0.9], [0.32, 0.5, 47]], { open: 2300, close: 500 });
        reed(out, { at: 0.3, dur: 0.55, from: 420, to: 1150, gain: 0.3, attack: 0.05, decay: 1.2, close: 900 });
        thud(out, { at: 0.32, from: 120, to: 42, dur: 0.3, gain: 0.8 });
    }],
    escape: [0.75, out => {
        [62, 65, 69, 74].forEach((note, i) => tone(out, { at: i * 0.085, dur: 0.42, from: hz(note), gain: 0.6, decay: 4.5, partials: VIBES }));
        noise(out, { at: 0.1, dur: 0.6, from: 2600, to: 600, q: 0.9, gain: 0.3, attack: 0.08, decay: 4, seed: 53 });
    }],
    haram: [1, out => {
        [[0, 68], [0.15, 63], [0.3, 56]].forEach(([at, note], i) => {
            reed(out, { at, dur: i === 2 ? 0.62 : 0.2, from: hz(note), to: hz(i === 2 ? note - 5 : note - 1), gain: 0.6, decay: 2, open: 1700, close: 450, vibrato: 0.045, vibratoHz: 7 });
            tone(out, { at, dur: 0.22, from: hz(note + 12) * 1.02, gain: 0.25, partials: WOOD });
        });
    }],
    carriageBell: [1.1, out => {
        [0, 0.15, 0.36, 0.51, 0.72, 0.87].forEach((at, i) => {
            tone(out, { at, dur: 0.075, from: i % 2 ? 690 : 880, to: i % 2 ? 560 : 720, gain: 0.6, attack: 0.001, partials: WOOD });
            noise(out, { at, dur: 0.05, from: i % 2 ? 1250 : 1700, q: 2.2, gain: 0.5, seed: 55 + i });
        });
        for (const at of [0.02, 0.3]) tone(out, { at, dur: 0.75, from: hz(84), gain: 0.5, attack: 0.002, decay: 6, partials: BELL });
    }],
    stretch: [0.95, out => {
        for (let i = 0; i < 6; i++) thud(out, { at: i * 0.05, from: 130, to: 72, dur: 0.12, gain: 0.25 + i * 0.07, grit: 0.4, seed: 62 + i });
        brass(out, [[0.32, 0.14, 57], [0.32, 0.14, 64, 0.8], [0.48, 0.45, 62], [0.48, 0.45, 69, 0.8], [0.48, 0.45, 53]], { open: 3000 });
        noise(out, { at: 0.46, dur: 0.45, from: 6000, type: 'high', q: 0.7, gain: 0.25, seed: 69 });
    }],
    victory: [1.35, out => {
        brass(out, [[0, 0.13, 67], [0.12, 0.13, 71], [0.24, 0.13, 74], [0.36, 0.85, 79], [0.36, 0.85, 72, 0.7], [0.36, 0.85, 64, 0.7]], { open: 3600, close: 900, vibrato: 0.004 });
        thud(out, { at: 0.36, from: 130, to: 50, dur: 0.3, gain: 0.5 });
        noise(out, { at: 0.36, dur: 0.85, from: 6500, type: 'high', q: 0.7, gain: 0.22, decay: 5, seed: 71 });
    }],
    newBest: [2.1, out => {
        brass(out, [[0, 0.1, 67], [0.11, 0.1, 67], [0.22, 0.1, 67], [0.33, 0.28, 72], [0.62, 0.14, 71], [0.77, 0.14, 74], [0.92, 1.05, 79], [0.92, 1.05, 76, 0.7], [0.92, 1.05, 72, 0.6], [0.92, 1.05, 48, 0.7]], { open: 3800, close: 900, vibrato: 0.004 });
        [84, 88, 91, 96].forEach((note, i) => tone(out, { at: 0.95 + i * 0.09, dur: 0.75, from: hz(note), gain: 0.22, partials: BELL }));
        for (const at of [0.33, 0.92]) thud(out, { at, from: 130, to: 48, dur: 0.32, gain: 0.6 });
        noise(out, { at: 0.92, dur: 1.1, from: 6200, type: 'high', q: 0.7, gain: 0.24, decay: 5, seed: 72 });
    }],
    end: [1.4, out => {
        thud(out, { from: 150, to: 50, dur: 0.3, gain: 0.8, grit: 1.1 });
        brass(out, [[0, 0.22, 62], [0.2, 0.22, 59], [0.4, 0.22, 56]], { open: 2200, close: 500 });
        reed(out, { at: 0.6, dur: 0.75, from: hz(55), to: hz(52), gain: 0.65, decay: 1.8, open: 2000, close: 350, vibrato: 0.03, vibratoHz: 5 });
        tone(out, { at: 0.6, dur: 0.75, from: hz(31), gain: 0.5, decay: 4, partials: [[1, 1, 1], [2, 0.7, 1], [3, 0.4, 1.3]] });
    }],
    rhythmPerfect: [0.15, out => {
        tone(out, { dur: 0.14, from: hz(84), gain: 0.7, attack: 0.001, decay: 6, partials: BELL });
        tone(out, { dur: 0.09, from: hz(72), gain: 0.5, attack: 0.001, decay: 6, partials: WOOD });
        noise(out, { dur: 0.02, from: 4200, gain: 0.4, decay: 5, seed: 73 });
    }],
    rhythmGood: [0.12, out => {
        tone(out, { dur: 0.11, from: hz(72), gain: 0.8, attack: 0.001, decay: 6, partials: WOOD });
        noise(out, { dur: 0.02, from: 2600, gain: 0.3, decay: 5, seed: 74 });
    }],
    rhythmMiss: [0.15, out => {
        tone(out, { dur: 0.13, from: 210, to: 150, gain: 0.7, attack: 0.002, decay: 4.5, partials: [[1, 1, 1], [1.41, 0.8, 1], [2.3, 0.6, 1.3], [3.7, 0.3, 1.6]] });
        noise(out, { dur: 0.06, from: 600, gain: 0.5, decay: 5, seed: 75 });
    }],
    crowd: [2.2, out => {
        crowdBed(out, { at: 0, dur: 2.15, gain: 0.7, seed: 100 });
        const rand = randomizer(104);
        for (let i = 0; i < 7; i++) {
            const at = rand() * 0.6, f = 260 + rand() * 300;
            reed(out, { at, dur: 0.6 + rand() * 0.6, from: f, to: f * (1.25 + rand() * 0.5), gain: 0.16, attack: 0.1, decay: 1.6, open: 1500, vibrato: 0.02, vibratoHz: 5 + rand() * 3 });
        }
        for (let i = 0; i < 40; i++) noise(out, { at: 0.1 + rand() * 1.7, dur: 0.035, from: 1100 + rand() * 1100, q: 1.6, gain: 0.55 * rand(), seed: 110 + i });
    }],
    gasp: [0.8, out => {
        noise(out, { dur: 0.42, from: 700, to: 2100, q: 1.3, decay: 'swell', flutter: 0.3, flutterHz: 28, seed: 160 });
        const rand = randomizer(165);
        for (let i = 0; i < 6; i++) {
            const f = 190 + rand() * 260;
            reed(out, { at: 0.2 + rand() * 0.08, dur: 0.5, from: f * 1.15, to: f * 0.85, gain: 0.16, attack: 0.06, decay: 2.2, open: 1200, close: 500, vibrato: 0.01 });
        }
        crowdBed(out, { at: 0.18, dur: 0.6, gain: 0.3, seed: 166 });
    }]
};
const VARIANTS = { step: 4, stride: 2 };
const NAMES = Object.keys(recipes);
export const CUES = [...NAMES, 'starterPistol'];

// gain: level of a full-scale buffer. jitter: pitch spread. gap: shortest retrigger. voices: copies at once.
// rank: lower ranks are stolen first when the mix is full. duck: [music level, seconds held].
const mix = {
    step: { gain: 0.12, jitter: 0.06, gap: 0.07, voices: 2, rank: 0 },
    stride: { gain: 0.16, jitter: 0.05, gap: 0.04, voices: 2, rank: 0 },
    whoosh: { gain: 0.17, jitter: 0.06, gap: 0.06, voices: 2, rank: 1 },
    jump: { gain: 0.24, jitter: 0.03, voices: 2, rank: 1 },
    slide: { gain: 0.2, jitter: 0.04, voices: 2, rank: 1 },
    land: { gain: 0.3, jitter: 0.05, voices: 2, rank: 1 },
    stamp: { gain: 0.2, jitter: 0.004, gap: 0.03, voices: 5, rank: 1 },
    stunt: { gain: 0.2, jitter: 0.004, voices: 2, rank: 2 },
    rhythmPerfect: { gain: 0.24, jitter: 0.004, gap: 0.04, voices: 3, rank: 2 },
    rhythmGood: { gain: 0.2, jitter: 0.006, gap: 0.04, voices: 3, rank: 2 },
    rhythmMiss: { gain: 0.26, jitter: 0.02, gap: 0.04, voices: 2, rank: 2 },
    multiplier: { gain: 0.26, jitter: 0.003 },
    multiplierLost: { gain: 0.24 },
    hit: { gain: 0.5, jitter: 0.06, duck: [0.6, 0.12] },
    crash: { gain: 0.62, jitter: 0.05, gap: 0.1, rank: 3, duck: [0.35, 0.35] },
    smash: { gain: 0.62, jitter: 0.07, gap: 0.08, voices: 3, rank: 3, duck: [0.45, 0.25] },
    power: { gain: 0.2, duck: [0.65, 0.3] },
    kafiyeh: { gain: 0.34, duck: [0.65, 0.4] },
    rainbow: { gain: 0.3, duck: [0.65, 0.5] },
    covidMask: { gain: 0.3, duck: [0.65, 0.4] },
    fastFreeBus: { gain: 0.34, duck: [0.65, 0.4] },
    count: { gain: 0.28 },
    go: { gain: 0.34 },
    start: { gain: 0.34 },
    edition: { gain: 0.24 },
    chase: { gain: 0.42, rank: 3, duck: [0.45, 0.6] },
    escape: { gain: 0.28 },
    haram: { gain: 0.34, duck: [0.5, 0.6] },
    carriageBell: { gain: 0.24, gap: 0.4, rank: 1 },
    stretch: { gain: 0.4, gap: 0.5, rank: 3, duck: [0.5, 0.6] },
    victory: { gain: 0.46, gap: 0.5, rank: 3, duck: [0.3, 1.1] },
    newBest: { gain: 0.5, gap: 0.5, rank: 3, duck: [0.25, 1.8] },
    end: { gain: 0.5, gap: 0.2, rank: 3, duck: [0.2, 1.2] },
    crowd: { gain: 0.3, jitter: 0.06, gap: 0.3, voices: 2, duck: [0.7, 1] },
    gasp: { gain: 0.3, jitter: 0.06, gap: 0.3, voices: 2 }
};

// Trims slow drift, scales to full scale and rounds off both ends.
function finish(out) {
    let last = 0, held = 0, peak = 0;
    for (let i = 0; i < out.length; i++) {
        const x = out[i];
        held = 0.993 * (held + x - last);
        last = x;
        out[i] = held * clamp(i / (RATE * 0.001)) * clamp((out.length - 1 - i) / (RATE * 0.012));
        peak = Math.max(peak, Math.abs(out[i]));
    }
    for (let i = 0; i < out.length; i++) out[i] /= peak;
    return out;
}

export function renderCue(name, variant = 0) {
    const [seconds, draw] = recipes[name];
    const out = new Float32Array(Math.ceil(seconds * RATE));
    draw(out, variant);
    return finish(out);
}

function blend(out, shot, beat, gain) {
    const start = Math.round(beat * BEAT * RATE);
    for (let i = 0; i < shot.length; i++) out[(start + i) % out.length] += shot[i] * gain;
}

// Loop layers wrap their tails, so they repeat without a seam. Each yields per bar to keep slices short.
const layers = {
    *drums() {
        const out = new Float32Array(Math.round(BEAT * 16 * RATE));
        const kick = new Float32Array(RATE * 0.2), snare = new Float32Array(RATE * 0.16), hat = new Float32Array(RATE * 0.06);
        thud(kick, { from: 165, to: 46, dur: 0.19, grit: 0.5, seed: 200 });
        noise(snare, { dur: 0.14, from: 2400, q: 0.6, gain: 0.9, decay: 5, seed: 201 });
        tone(snare, { dur: 0.08, from: 220, to: 170, gain: 0.6 });
        noise(hat, { dur: 0.05, from: 7500, type: 'high', q: 0.8, decay: 5, seed: 202 });
        for (let beat = 0; beat < 16; beat++) {
            const last = beat % 4 === 3;
            blend(out, kick, beat, beat % 4 ? 0.6 : 0.8);
            if (beat % 2) blend(out, snare, beat, 0.6);
            blend(out, hat, beat, 0.3);
            blend(out, hat, beat + SWING, 0.42);
            if (last) blend(out, kick, beat + SWING, 0.55);
            if (beat === 15) for (let i = 0; i < 3; i++) blend(out, snare, beat + i / 3, 0.35 + i * 0.12);
            if (last) yield;
        }
        return out;
    },
    *bass() {
        const out = new Float32Array(Math.round(LOOP_SECONDS * RATE));
        for (let bar = 0; bar < LOOP_BARS; bar++) {
            for (let beat = 0; beat < 4; beat++) {
                const at = (bar * 4 + beat) * BEAT, root = ROOTS[bar];
                reed(out, { at, dur: BEAT * 0.62, from: hz(root), gain: 0.75, attack: 0.006, decay: 2.4, open: 1500, close: 320, wrap: true });
                reed(out, { at: at + BEAT * SWING, dur: BEAT * 0.34, from: hz(root + (beat % 2 ? 12 : 0)), gain: 0.55, attack: 0.006, decay: 2.4, open: 1800, close: 320, wrap: true });
            }
            yield;
        }
        return out;
    },
    *race() {
        const out = new Float32Array(Math.round(BEAT * 8 * RATE));
        const clap = new Float32Array(RATE * 0.16), tom = new Float32Array(RATE * 0.22);
        for (let i = 0; i < 3; i++) noise(clap, { at: i * 0.011, dur: 0.09, from: 1500, q: 1.1, gain: 0.5 + i * 0.2, seed: 210 + i });
        tone(tom, { dur: 0.2, from: 190, to: 125, gain: 0.7, decay: 4, partials: [[1, 1, 1], [1.6, 0.6, 1.6], [2.4, 0.3, 2]] });
        for (let beat = 0; beat < 8; beat++) {
            if (beat % 2) blend(out, clap, beat, 1);
            blend(out, tom, beat, beat % 4 ? 0.45 : 0.8);
            blend(out, tom, beat + 1 / 3, beat % 4 === 2 ? 0.4 : 0.12);
            blend(out, tom, beat + SWING, 0.35);
        }
        return out;
    },
    *heart() {
        const out = new Float32Array(Math.round(BEAT * 2 * RATE)), lub = new Float32Array(RATE * 0.2);
        tone(lub, { dur: 0.19, from: 92, to: 50, attack: 0.006, decay: 4.5, bend: 2, partials: [[1, 1, 1], [2, 0.7, 1.2], [3, 0.5, 1.4], [4, 0.3, 1.6]] });
        blend(out, lub, 0, 1);
        blend(out, lub, SWING, 0.65);
        return out;
    }
};
export const LAYER_BARS = { drums: 4, bass: LOOP_BARS, race: 2, heart: 0.5 };
export const LAYERS = Object.keys(layers);

export function* layerSteps(name) {
    const out = yield* layers[name]();
    let peak = 0;
    for (const x of out) peak = Math.max(peak, Math.abs(x));
    for (let i = 0; i < out.length; i++) out[i] /= peak;
    return out;
}

// Some WebKit builds keep the AAC encoder's lead-in, which the loop must skip to stay on the beat.
function leadIn(buffer) {
    const spare = buffer.duration - LOOP_SECONDS;
    if (!(spare > 0.004)) return 0;
    const samples = buffer.getChannelData(0), limit = Math.min(samples.length, Math.ceil(0.12 * buffer.sampleRate));
    let first = 0;
    while (first < limit && Math.abs(samples[first]) < 0.004) first++;
    return Math.min(spare, first / buffer.sampleRate);
}

function storedSetting() {
    try {
        return localStorage.getItem('mamdani_sound');
    } catch {
        return null;
    }
}

export class Sound {
    constructor() {
        this.enabled = storedSetting() !== 'off';
        this.intensity = 0;
        this.mood = 'street';
        this.bank = new Map();
        this.layerBank = new Map();
        this.voices = [];
        this.lastPlayed = {};
        this.stampRun = 0;
        this.foot = 0;
        this.duckUntil = 0;
        this.duckDepth = 1;
        this.warming = 0;
        this.warm = this.warm.bind(this);
        this.ended = event => {
            const i = this.voices.findIndex(voice => voice.source === event.target);
            if (i >= 0) this.drop(i);
        };
    }

    unlock() {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Context || !this.enabled) return;
        try {
            this.ctx ??= new Context();
            this.build();
            // iOS reports "interrupted" after a call or Siri; it resumes the same way as "suspended".
            if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume()?.catch(() => {});
            this.queueWarm();
        } catch {}
    }

    toggle() {
        this.enabled = !this.enabled;
        try {
            localStorage.setItem('mamdani_sound', this.enabled ? 'on' : 'off');
        } catch {}
        if (this.enabled) {
            this.unlock();
            this.applyDrive(0);
            this.play('stamp');
            if (this.running) this.music(true);
        } else {
            this.stopTrack();
            this.silence();
        }
    }

    build() {
        if (this.master) return;
        const { ctx } = this;
        const gain = (to, value) => {
            const node = ctx.createGain();
            node.gain.value = value;
            node.connect(to);
            return node;
        };
        const lowpass = to => {
            const node = ctx.createBiquadFilter();
            node.type = 'lowpass';
            node.Q.value = 0.4;
            node.connect(to);
            return node;
        };
        const clip = ctx.createWaveShaper();
        clip.curve = Float32Array.from({ length: 1025 }, (_, i) => {
            const x = i / 512 - 1, size = Math.abs(x);
            return size < 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((size - 0.8) / 0.2));
        });
        clip.connect(ctx.destination);
        const limit = ctx.createDynamicsCompressor();
        limit.threshold.value = -9;
        limit.knee.value = 6;
        limit.ratio.value = 14;
        limit.attack.value = 0.002;
        limit.release.value = 0.16;
        limit.connect(clip);
        this.effects = gain(limit, 1);
        this.musicDuck = gain(limit, 1);
        this.baseGain = gain(this.musicDuck, MUSIC_GAIN);
        this.baseFilter = lowpass(this.baseGain);
        this.layerGain = {};
        for (const name of LAYERS) this.layerGain[name] = gain(this.musicDuck, 0);
        this.layerFilter = lowpass(this.layerGain.drums);
        this.master = limit;
        this.applyDrive(0);
    }

    setIntensity(value) {
        const next = Math.round(clamp(Number.isFinite(value) ? value : 0) * 32) / 32;
        if (next === this.intensity) return;
        this.intensity = next;
        if (this.enabled) this.applyDrive(0.3);
    }

    setMood(mood) {
        const next = mood === 'race' ? 'race' : 'street';
        if (next === this.mood) return;
        this.mood = next;
        if (this.enabled) this.applyDrive(0.35);
    }

    applyDrive(glide) {
        if (!this.master) return;
        const race = this.mood === 'race', drive = Math.max(this.intensity, race ? 0.5 : 0);
        this.aim(this.baseGain.gain, MUSIC_GAIN * (race ? 0.95 : 1 + 0.12 * drive), glide);
        this.aim(this.baseFilter.frequency, 7000 + 7000 * drive, glide);
        this.aim(this.layerFilter.frequency, 700 * 16 ** drive, glide);
        this.aim(this.layerGain.drums.gain, 0.15 * smooth(0.08, 0.6, drive), glide);
        this.aim(this.layerGain.bass.gain, 0.14 * smooth(0.3, 0.8, drive), glide);
        this.aim(this.layerGain.race.gain, race ? 0.2 : 0, glide);
        this.aim(this.layerGain.heart.gain, race ? 0 : 0.26 * smooth(0.78, 1, this.intensity), glide);
    }

    aim(param, value, glide, at = this.ctx.currentTime) {
        param.cancelScheduledValues(at);
        if (glide) param.setTargetAtTime(value, at, glide);
        else param.setValueAtTime(value, at);
    }

    music(running, restart = false) {
        this.running = running;
        if (!running || restart) this.stopTrack();
        if (restart) {
            this.offset = 0;
            this.intensity = 0;
            this.mood = 'street';
            this.stampRun = 0;
            if (this.enabled) this.applyDrive(0.02);
        }
        if (!running || !this.enabled || !this.ctx) return;
        this.recording ??= this.load();
        this.recording.then((buffer) => {
            if (!buffer) this.recording = null;
            if (!buffer || !this.running || !this.enabled || this.track) return;
            this.startTrack(buffer);
        }).catch(() => {});
    }

    async load() {
        try {
            const r = await fetch(import.meta.env.BASE_URL + 'audio/city-desk.m4a');
            // WKWebView can return status zero for a bundled capacitor:// resource.
            if (!r.ok && !(r.status === 0 && location.protocol === 'capacitor:')) {
                throw Error('Music unavailable');
            }
            return await this.ctx.decodeAudioData(await r.arrayBuffer());
        } catch {
            return null;
        }
    }

    startTrack(buffer) {
        this.build();
        const lead = leadIn(buffer);
        this.loopLength = Math.min(LOOP_SECONDS, buffer.duration - lead);
        this.offset = (this.offset || 0) % this.loopLength;
        this.startedAt = this.ctx.currentTime + 0.02;
        this.track = {};
        this.track.base = this.loop(buffer, this.baseFilter, lead, this.loopLength, this.offset, this.startedAt);
        this.startLayers();
    }

    startLayers() {
        if (!this.track) return;
        // A late layer takes its phase from the song position; every layer's length divides the loop.
        const when = Math.max(this.startedAt, this.ctx.currentTime + 0.02);
        const position = this.offset + when - this.startedAt;
        for (const [name, buffer] of this.layerBank) {
            if (this.track[name]) continue;
            const length = this.loopLength * LAYER_BARS[name] / LOOP_BARS;
            this.track[name] = this.loop(buffer, name === 'drums' ? this.layerFilter : this.layerGain[name], 0, length, position % length, when);
        }
    }

    loop(buffer, to, lead, length, position, when) {
        const source = this.ctx.createBufferSource(), fade = this.ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = lead;
        source.loopEnd = lead + length;
        fade.gain.setValueAtTime(0, when);
        fade.gain.linearRampToValueAtTime(1, when + 0.012);
        source.connect(fade).connect(to);
        source.start(when, lead + position);
        return { source, fade };
    }

    stopTrack() {
        if (!this.track) return;
        const now = this.ctx.currentTime;
        this.offset += Math.max(0, now - this.startedAt);
        for (const { source, fade } of Object.values(this.track)) this.fadeOut(source, fade, now);
        this.track = null;
    }

    fadeOut(source, volume, now) {
        volume.gain.cancelScheduledValues(now);
        volume.gain.setTargetAtTime(0, now, 0.007);
        source.onended = () => {
            source.disconnect();
            volume.disconnect();
        };
        source.stop(now + 0.05);
    }

    // Bakes one job per slice in the background so the first use of a cue never costs a frame.
    queueWarm() {
        if (this.warming || (this.bank.size === NAMES.length && this.layerBank.size === LAYERS.length)) return;
        this.warming = setTimeout(this.warm, 40);
    }

    warm() {
        this.warming = 0;
        if (!this.enabled || !this.ctx) return;
        try {
            const cue = NAMES.find(name => !this.bank.has(name));
            if (cue) this.takes(cue);
            else this.warmLayer();
        } catch {
            this.baking = null;
            return;
        }
        this.queueWarm();
    }

    warmLayer() {
        if (!this.baking) {
            const name = LAYERS.find(layer => !this.layerBank.has(layer));
            this.baking = { name, steps: layerSteps(name) };
        }
        const { name, steps } = this.baking, { done, value } = steps.next();
        if (!done) return;
        this.baking = null;
        this.layerBank.set(name, this.toBuffer(value));
        this.startLayers();
    }

    toBuffer(samples) {
        const buffer = this.ctx.createBuffer(1, samples.length, RATE);
        buffer.getChannelData(0).set(samples);
        return buffer;
    }

    takes(cue) {
        let list = this.bank.get(cue);
        if (!list) {
            list = Array.from({ length: VARIANTS[cue] ?? 1 }, (_, variant) => this.toBuffer(renderCue(cue, variant)));
            this.bank.set(cue, list);
        }
        return list;
    }

    play(cue, value) {
        if (!this.enabled || !this.ctx || this.ctx.state !== 'running' || !this.master) return;
        if (cue === 'crowd' && value === 'gasp') cue = 'gasp';
        try {
            if (cue === 'starterPistol') this.starterPistol();
            else if (Object.hasOwn(mix, cue)) this.fire(cue, value);
        } catch {
            // Sound must never stop a run.
        }
    }

    fire(cue, value) {
        const { gain, jitter = 0.01, gap = 0.05, voices: most = 2, rank = 2, duck } = mix[cue];
        const now = this.ctx.currentTime;
        const since = now - (this.lastPlayed[cue] ?? -Infinity);
        if (since < gap) return;
        const list = this.takes(cue);
        if (!this.room(cue, most, rank, now)) return;
        this.lastPlayed[cue] = now;
        const number = Number.isFinite(value) ? value : 0;
        let level = gain, pitch = 0, take = 0;
        if (cue === 'stamp') {
            this.stampRun = since < STAMP_WINDOW ? Math.min(this.stampRun + 1, LADDER.length - 1) : 0;
            pitch = LADDER[this.stampRun];
        } else if (cue === 'multiplier') pitch = LADDER[clamp(Math.round(number) - 1, 0, 5)];
        else if (cue === 'stunt' || cue === 'rhythmPerfect') pitch = LADDER[clamp(Math.round(number), 0, 5)];
        if (list.length > 1) {
            take = this.foot++ % list.length;
            // Left and right feet differ.
            if (take % 2) pitch -= 0.9;
            level *= 0.85 + Math.random() * 0.3;
        }
        if (cue === 'step' && Number.isFinite(value)) level *= clamp(value, 0, 1.5);

        const source = this.ctx.createBufferSource(), volume = this.ctx.createGain();
        const rate = 2 ** (pitch / 12) * (1 + (Math.random() * 2 - 1) * jitter);
        source.buffer = list[take];
        source.playbackRate.value = rate;
        volume.gain.value = level;
        source.connect(volume).connect(this.effects);
        source.onended = this.ended;
        this.voices.push({ source, volume, cue, rank, until: now + list[take].duration / rate });
        source.start();
        if (duck) this.duck(duck[0], duck[1], now);
    }

    room(cue, most, rank, now) {
        let same = 0, oldest = -1, weakest = -1;
        for (let i = this.voices.length - 1; i >= 0; i--) {
            // Backstop for engines that lose onended across an interruption.
            if (this.voices[i].until + 0.5 < now) this.drop(i);
        }
        for (let i = 0; i < this.voices.length; i++) {
            const voice = this.voices[i];
            if (voice.cue === cue) {
                same++;
                if (oldest < 0) oldest = i;
            }
            if (voice.rank <= rank && (weakest < 0 || voice.rank < this.voices[weakest].rank)) weakest = i;
        }
        if (same >= most) this.cut(oldest, now);
        else if (this.voices.length >= MAX_VOICES) {
            if (weakest < 0) return false;
            this.cut(weakest, now);
        }
        return true;
    }

    drop(i) {
        const [{ source, volume }] = this.voices.splice(i, 1);
        source.onended = null;
        source.disconnect();
        volume.disconnect();
    }

    cut(i, now) {
        const [{ source, volume }] = this.voices.splice(i, 1);
        this.fadeOut(source, volume, now);
    }

    silence() {
        if (!this.ctx) return;
        for (let i = this.voices.length - 1; i >= 0; i--) this.cut(i, this.ctx.currentTime);
    }

    duck(depth, hold, now) {
        if (now < this.duckUntil && depth > this.duckDepth) return;
        this.duckDepth = depth;
        this.duckUntil = now + hold;
        this.aim(this.musicDuck.gain, depth, 0.03, now);
        this.musicDuck.gain.setTargetAtTime(1, now + hold, 0.3);
    }

    starterPistol() {
        const { ctx } = this;
        const start = ctx.currentTime;
        if (!this.pistolNoise) {
            this.pistolNoise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .28), ctx.sampleRate);
            const samples = this.pistolNoise.getChannelData(0);
            for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        source.buffer = this.pistolNoise;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(8500, start);
        filter.frequency.exponentialRampToValueAtTime(450, start + .12);

        const volume = ctx.createGain();
        volume.gain.setValueAtTime(.001, start);
        volume.gain.linearRampToValueAtTime(.6, start + .003);
        volume.gain.exponentialRampToValueAtTime(.035, start + .055);
        volume.gain.exponentialRampToValueAtTime(.001, start + .26);

        source.connect(filter).connect(volume).connect(this.effects);
        source.start(start);
        source.onended = () => {
            source.disconnect();
            filter.disconnect();
            volume.disconnect();
        };
        this.duck(0.5, 0.15, start);
    }
}
