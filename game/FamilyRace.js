import { raceTricks, WARNING } from './RaceTricks.js';

export const RACE_TOP_SPEED = 13.2;
export const RACE_POINTS = 500;
const BOOST_PER_LEVEL = 11;
const COAST_DECAY = 1.65;
const TAP_IMPULSE = 2.65;
const GOLD = 1.5;
// Long strides carry further, so alternating pads asks for a little less speed.
const STRIDE = 1.15;
const TRIP_KEEPS = .4;
// A tripped runner needs this long to find both feet again.
const TRIP_SECONDS = 1.1;
// Fingers need this long to stop, or to find the pad that moved.
const REACTION = .3;
const PAD_GRACE = .25;
// Two fingers landing together are one step.
const SAME_STEP = .03;
// A runner this close to the tape leans and keeps the speed already earned.
const LEAN_METRES = 3.5;
const PHOTO_SECONDS = .2;
const FALSE_START_SECONDS = .55;

export const RIVALS = Object.freeze([
    { id: 'junior', name: 'Donald Trump Jr.', metres: 64, finish: 8.7, start: -0.06, surge: 0.015, prize: 5,
        line: 'He knows one speed and calls it a strategy.',
        rule: 'Tap as fast as you can. That is the whole race.' },
    { id: 'ivanka', name: 'Ivanka Trump', metres: 72, finish: 7.8, start: 0.03, surge: 0.035, prize: 8,
        line: 'She rebrands every few seconds.',
        rule: 'When the pad turns gold, taps count half again. Save your fastest fingers for it.' },
    { id: 'eric', name: 'Eric Trump', metres: 80, finish: 12.1, start: -0.035, surge: -0.025, prize: 12,
        line: 'The track has been served with an injunction.',
        rule: 'Tap fast, but when the pad turns red, hands off. A tap on red trips you.' },
    { id: 'tiffany', name: 'Tiffany Trump', metres: 88, finish: 9.5, start: 0.06, surge: -0.035, prize: 16,
        line: 'Nobody saved her a seat, so yours keeps moving.',
        rule: 'Tap fast on the lit pad. It keeps jumping left, middle and right.' },
    { id: 'barron', name: 'Barron Trump', metres: 98, finish: 9.3, start: -0.055, surge: 0.016, prize: 20,
        line: 'Six foot nine, and most of it is stride.',
        rule: 'Tap left, right, left, right. The same foot twice goes nowhere.' },
    { id: 'donald', name: 'Donald Trump', metres: 100, finish: 11, prize: 50,
        line: 'He has never lost a race he started early.',
        rule: 'Red lights, then left and right, then a gold kick. He jumps the gun, stalls and surges.',
        falseStart: .03,
        pace: [[0, .7], [.07, 1.1], [.30, 1.1], [.35, .03], [.45, .03], [.53, 1.2], [.80, 1.2], [1, 1.45]] }
].map((rival, index) => Object.freeze({ ...rival, index })));

export function takeoverPercent(wins) {
    return Math.round(100 * wins / RIVALS.length);
}

export function raceSpeedBonus(level) {
    return BOOST_PER_LEVEL * level;
}

function paceArea(pace, until) {
    let area = 0;
    for (let i = 1; i < pace.length; i++) {
        const [from, a] = pace[i - 1], [to, b] = pace[i];
        if (until <= from) break;
        const width = Math.min(until, to) - from;
        area += width * (a + (b - a) * width / (to - from) / 2);
    }
    return area;
}

function rivalProgress(rival, elapsed) {
    const time = elapsed / rival.finish;
    if (time >= 1) return 1;
    if (rival.pace) {
        const early = rival.falseStart;
        if (elapsed <= 0) {
            const jump = Math.max(0, 1 + elapsed / FALSE_START_SECONDS);
            return early * jump * jump;
        }
        return early + (1 - early) * paceArea(rival.pace, time) / paceArea(rival.pace, 1);
    }
    if (elapsed <= 0) return 0;
    return time + rival.start * Math.sin(Math.PI * time) + rival.surge * Math.sin(2 * Math.PI * time);
}

export class FamilyRace {
    constructor(rival, speedLevel = 0, waitForReady = false, { seed = 1 } = {}) {
        this.rival = rival;
        this.speedLevel = speedLevel;
        this.phase = waitForReady ? 'ready' : 'intro';
        this.readyTime = rival.countdown;
        this.elapsed = 0;
        this.speed = 0;
        this.distance = 0;
        this.rivalProgress = 0;
        this.windows = raceTricks(rival, seed);
        this.lastTap = -1;
        this.lastFoot = this.footing = 0;
        this.taps = this.faults = 0;
        this.fault = '';
        this.recent = [];
        this.bestRate = 0;
    }

    get countdown() {
        return Math.ceil(this.readyTime);
    }

    get playerProgress() {
        return this.distance / this.rival.metres;
    }

    windowAt(time) {
        return this.windows.find(({ from, to }) => time >= from && time < to);
    }

    // What the pad is asking for now: tap, warn, stop, gold, feet or side.
    get mode() {
        if (this.phase !== 'racing') return 'tap';
        const now = this.windowAt(this.elapsed);
        if (now) return now.kind;
        return this.windowAt(this.elapsed + WARNING)?.kind === 'stop' ? 'warn' : 'tap';
    }

    // The pad to hit: -1 left, 0 middle, 1 right. Feet ask for the one not used last.
    get pad() {
        const now = this.windowAt(this.elapsed);
        if (now?.kind === 'side') return now.side;
        return now?.kind === 'feet' ? -this.lastFoot || -1 : 0;
    }

    get nextPad() {
        const next = this.windowAt(this.elapsed + .4);
        return next?.kind === 'side' && next !== this.windowAt(this.elapsed) ? next.side : null;
    }

    // Taps landed in the last second.
    get rate() {
        return this.recent.length;
    }

    get leaning() {
        return this.phase === 'racing' && this.rival.metres - this.distance < LEAN_METRES;
    }

    get gap() {
        return this.distance - this.rivalProgress * this.rival.metres;
    }

    get closeFinish() {
        return this.leaning && this.speed > 5 && Math.abs(this.gap) < 2.2;
    }

    get margin() {
        if (this.phase === 'won') return this.rival.finish - this.elapsed;
        return (this.rival.metres - this.distance) / Math.max(1, this.speed);
    }

    get photoFinish() {
        return (this.phase === 'won' || this.phase === 'lost') && this.margin < PHOTO_SECONDS;
    }

    get rivalStanding() {
        const { pace } = this.rival;
        if (this.phase !== 'racing' || !pace) return false;
        const time = this.elapsed / this.rival.finish;
        return time > pace[3][0] - .01 && time < pace[4][0];
    }

    get cue() {
        const { pace } = this.rival;
        if (this.phase !== 'racing' || !pace) return '';
        const time = this.elapsed / this.rival.finish;
        if (this.elapsed < 1.5) return 'False start. Nobody calls it back';
        if (time > pace[2][0] && time < pace[4][0]) return 'He stops to demand a recount';
        if (time > pace[4][0] && time < pace[4][0] + .12) return 'Recount over. Here he comes';
        return '';
    }

    ready() {
        if (this.phase !== 'ready') return false;
        this.phase = 'intro';
        return true;
    }

    miss(fault) {
        this.faults++;
        this.fault = fault;
        return fault;
    }

    // `side` is the pad that was hit, or null for a control that cannot aim, such as a switch.
    tap(side = null) {
        // A close finish plays slowly, when taps would be worth more than they should.
        if (this.phase !== 'racing' || this.closeFinish) return false;
        const at = this.elapsed;
        if (this.lastTap >= 0 && at - this.lastTap < SAME_STEP && side === this.lastSide) return false;
        this.lastTap = at;
        this.lastSide = side;
        const now = this.windowAt(at);
        let stride = 1;
        if (now?.kind === 'stop') {
            if (at - now.from < REACTION) return false;
            if (at >= this.footing) this.speed *= TRIP_KEEPS;
            this.footing = at + TRIP_SECONDS;
            return this.miss('stop');
        }
        if (at < this.footing) return false;
        if (now?.kind === 'side' && side !== null && side !== now.side) {
            const moved = at - now.from < PAD_GRACE && this.windowAt(now.from - .01)?.side === side;
            if (!moved) return this.miss('side');
        }
        if (now?.kind === 'feet') {
            if (side !== null && (side === 0 || side === this.lastFoot)) return this.miss('foot');
            this.lastFoot = side ?? (-this.lastFoot || -1);
            stride = STRIDE;
        } else if (now?.kind === 'gold') stride = GOLD;
        this.taps++;
        this.recent.push(at);
        this.bestRate = Math.max(this.bestRate, this.rate);
        const impulse = TAP_IMPULSE * stride * (1 + raceSpeedBonus(this.speedLevel) / 100);
        this.speed = Math.min(this.speed + impulse, RACE_TOP_SPEED);
        return 'step';
    }

    update(dt) {
        if (this.phase === 'intro') {
            const waited = Math.min(dt, this.readyTime);
            this.readyTime -= waited;
            this.rivalProgress = rivalProgress(this.rival, -this.readyTime);
            if (this.readyTime > 0) return;
            this.phase = 'racing';
            dt -= waited;
        }
        while (this.phase === 'racing' && dt > 0) dt -= this.advance(dt);
        while (this.recent.length && this.recent[0] < this.elapsed - 1) this.recent.shift();
        this.rivalProgress = rivalProgress(this.rival, this.elapsed);
    }

    // Runs until `dt`, the rival's finish, the start of the lean or the tape, whichever comes first.
    advance(dt) {
        const rivalTime = this.rival.finish - this.elapsed;
        const interval = Math.min(dt, rivalTime);
        const { leaning } = this;
        const goal = this.rival.metres - (leaning ? 0 : LEAN_METRES) - this.distance;
        const reach = leaning ? this.speed * interval : this.speed * -Math.expm1(-COAST_DECAY * interval) / COAST_DECAY;
        const arrives = reach >= goal;
        const time = !arrives ? interval : leaning ? goal / this.speed : -Math.log1p(-goal * COAST_DECAY / this.speed) / COAST_DECAY;
        this.elapsed += time;
        if (!leaning) this.speed *= Math.exp(-COAST_DECAY * time);
        this.distance += arrives ? goal : reach;
        if (arrives && leaning) {
            this.distance = this.rival.metres;
            this.phase = time < rivalTime ? 'won' : 'lost';
        } else if (arrives) {
            this.distance = this.rival.metres - LEAN_METRES + 1e-9;
        } else if (time === rivalTime) this.phase = 'lost';
        return Math.max(time, 1e-9);
    }
}
