export const RACE_TOP_SPEED = 13.2;
const COAST_DECAY = 1.65;
const TAP_IMPULSE = 2.65;
const BOOST_PER_LEVEL = 11;

export const RIVALS = Object.freeze([
    { id: 'junior', name: 'Donald Trump Jr.', metres: 64, finish: 9.02, start: -0.06, surge: 0.015 },
    { id: 'ivanka', name: 'Ivanka Trump', metres: 72, finish: 9.08, start: 0.03, surge: 0.035 },
    { id: 'eric', name: 'Eric Trump', metres: 80, finish: 9.02, start: -0.035, surge: -0.025 },
    { id: 'tiffany', name: 'Tiffany Trump', metres: 88, finish: 8.95, start: 0.06, surge: -0.035 },
    { id: 'barron', name: 'Barron Trump', metres: 98, finish: 9.05, start: -0.055, surge: 0.016 },
    { id: 'donald', name: 'Donald Trump', metres: 100, finish: 9.14, start: 0.055, surge: 0.045 }
].map((rival, index) => Object.freeze({ ...rival, index })));

export function takeoverPercent(wins) {
    return Math.round(100 * wins / RIVALS.length);
}

function rivalProgress(rival, elapsed) {
    const time = elapsed / rival.finish;
    if (time >= 1) return 1;
    return time + rival.start * Math.sin(Math.PI * time) + rival.surge * Math.sin(2 * Math.PI * time);
}

export function raceSpeedBonus(level) {
    return BOOST_PER_LEVEL * level;
}

export class FamilyRace {
    constructor(rival, speedLevel = 0, waitForReady = false) {
        this.rival = rival;
        this.speedLevel = speedLevel;
        this.phase = waitForReady ? 'ready' : 'intro';
        this.readyTime = rival.countdown;
        this.elapsed = 0;
        this.speed = 0;
        this.distance = 0;
        this.rivalProgress = 0;
    }

    get countdown() {
        return Math.ceil(this.readyTime);
    }

    get playerProgress() {
        return this.distance / this.rival.metres;
    }

    ready() {
        if (this.phase !== 'ready') return false;
        this.phase = 'intro';
        return true;
    }

    tap() {
        if (this.phase !== 'racing') return false;
        const impulse = TAP_IMPULSE * (1 + raceSpeedBonus(this.speedLevel) / 100);
        this.speed = Math.min(this.speed + impulse, RACE_TOP_SPEED);
        return true;
    }

    update(dt) {
        if (this.phase === 'intro') {
            const waited = Math.min(dt, this.readyTime);
            this.readyTime -= waited;
            if (this.readyTime > 0) return;
            this.phase = 'racing';
            dt -= waited;
        }
        if (this.phase !== 'racing' || dt <= 0) return;

        const rivalTime = this.rival.finish - this.elapsed;
        const interval = Math.min(dt, rivalTime);
        const remaining = this.rival.metres - this.distance;
        const coast = this.speed * -Math.expm1(-COAST_DECAY * interval) / COAST_DECAY;

        if (coast >= remaining) {
            const finishTime = -Math.log1p(-remaining * COAST_DECAY / this.speed) / COAST_DECAY;
            this.elapsed += finishTime;
            this.speed *= Math.exp(-COAST_DECAY * finishTime);
            this.distance = this.rival.metres;
            this.phase = finishTime < rivalTime ? 'won' : 'lost';
        } else {
            this.elapsed += interval;
            this.speed *= Math.exp(-COAST_DECAY * interval);
            this.distance += coast;
            if (interval === rivalTime) this.phase = 'lost';
        }
        this.rivalProgress = rivalProgress(this.rival, this.elapsed);
    }
}
