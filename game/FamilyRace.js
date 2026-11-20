export const RACE_METRES = 100;
export const RACE_TOP_SPEED = 16;
const START_COUNTDOWN = 3;
const COAST_DECAY = 1.65;
const TAP_IMPULSE = 3.65;
const BOOST_PER_LEVEL = 11;

export const RIVALS = Object.freeze([
    { id: 'junior', name: 'Donald Trump Jr.', at: 1000, finish: 11.35, start: -0.06, surge: 0.015 },
    { id: 'ivanka', name: 'Ivanka Trump', at: 2750, finish: 10.85, start: 0.03, surge: 0.035 },
    { id: 'eric', name: 'Eric Trump', at: 5000, finish: 10.45, start: -0.035, surge: -0.025 },
    { id: 'tiffany', name: 'Tiffany Trump', at: 7500, finish: 10.05, start: 0.06, surge: -0.035 },
    { id: 'barron', name: 'Barron Trump', at: 10500, finish: 9.65, start: -0.055, surge: -0.035 },
    { id: 'donald', name: 'Donald Trump', at: 14000, finish: 9.25, start: 0.07, surge: 0.025 }
].map((rival, index) => Object.freeze({ ...rival, index })));

function rivalProgress(rival, elapsed) {
    const time = elapsed / rival.finish;
    if (time >= 1) return 1;
    return time + rival.start * Math.sin(Math.PI * time) + rival.surge * Math.sin(2 * Math.PI * time);
}

export function raceSpeedBonus(level) {
    return BOOST_PER_LEVEL * level;
}

export class FamilyRace {
    constructor(index, speedLevel = 0) {
        this.rival = RIVALS[index];
        this.speedLevel = speedLevel;
        this.phase = 'intro';
        this.readyTime = START_COUNTDOWN;
        this.elapsed = 0;
        this.speed = 0;
        this.distance = 0;
        this.rivalProgress = 0;
    }

    get countdown() {
        return Math.ceil(this.readyTime);
    }

    get playerProgress() {
        return this.distance / RACE_METRES;
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
        const remaining = RACE_METRES - this.distance;
        const coast = this.speed * -Math.expm1(-COAST_DECAY * interval) / COAST_DECAY;

        if (coast >= remaining) {
            const finishTime = -Math.log1p(-remaining * COAST_DECAY / this.speed) / COAST_DECAY;
            this.elapsed += finishTime;
            this.speed *= Math.exp(-COAST_DECAY * finishTime);
            this.distance = RACE_METRES;
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
