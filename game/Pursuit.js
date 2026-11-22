export const GAP_START = 24;
export const GAP_MAX = 40;
export const CATCH_GAP = 18;
export const HIT_COST = 18;
const SETTLE_GAP = 20;
const RECOVERY = 1.6;
const DRIFT = 0.4;
// The longer the lead, the harder he runs. Skilled play settles near thirty metres.
const DRIFT_PER_METRE = 0.13;
const IDLE_SECONDS = 8;
const IDLE_CLOSE = 0.8;
const IDLE_FLOOR = 10;
const CLEAN_MOVE = 1.5;
const STAMP = 0.3;
const HOT_SECONDS = 4;
// A free first-run stumble still brings him into view.
const SAFE_FLOOR = 10;
const LEAD_GAP = 32;
const LEAD_LOST = 27;

// The runner's lead over Trump in metres. Dawdling lets him close in. Only a hit can catch the runner.
export class Pursuit {
    constructor() {
        this.reset();
    }

    reset() {
        this.gap = GAP_START;
        this.idle = 0;
        this.hotTime = 0;
        this.fromHit = false;
        this.zone = 'mid';
    }

    get isChasing() {
        return this.gap <= CATCH_GAP;
    }

    // A fresh hit, as opposed to a gap that shrank through slow play.
    get hot() {
        return this.hotTime > 0;
    }

    get intensity() {
        return Math.max(0, Math.min(1, 1 - this.gap / 26));
    }

    cleanMove() {
        this.gain(CLEAN_MOVE);
    }

    stamp() {
        this.gain(STAMP);
    }

    gain(metres) {
        this.gap = Math.min(GAP_MAX, this.gap + metres);
        this.idle = 0;
    }

    hit(safe = false) {
        const floor = safe ? Math.min(this.gap, SAFE_FLOOR) : 0;
        this.gap = Math.max(floor, this.gap - HIT_COST);
        this.idle = 0;
        this.hotTime = HOT_SECONDS;
        this.fromHit = this.isChasing;
        this.zone = this.isChasing ? 'near' : 'mid';
    }

    // On the bus or the bike he cannot close in, and a runner who was hit still gets clear.
    ride(dt) {
        this.hotTime = Math.max(0, this.hotTime - dt);
        if (this.gap < SETTLE_GAP) this.gap = Math.min(SETTLE_GAP, this.gap + RECOVERY * dt);
    }

    // A sheltered runner cannot earn clean moves, so a power-up never costs ground.
    update(dt, sheltered = false) {
        this.hotTime = Math.max(0, this.hotTime - dt);
        if (!sheltered) this.idle += dt;
        const dawdling = this.idle >= IDLE_SECONDS;
        if (dawdling && this.gap > IDLE_FLOOR) this.gap = Math.max(IDLE_FLOOR, this.gap - IDLE_CLOSE * dt);
        else if (this.gap < SETTLE_GAP) this.gap = Math.min(dawdling ? IDLE_FLOOR : SETTLE_GAP, this.gap + RECOVERY * dt);
        else if (!sheltered) this.gap = Math.max(SETTLE_GAP, this.gap - (DRIFT + DRIFT_PER_METRE * (this.gap - SETTLE_GAP)) * dt);

        if (this.isChasing) {
            if (this.zone === 'near') return;
            this.zone = 'near';
            this.fromHit = false;
            return 'closing';
        }
        if (this.zone === 'near') {
            if (this.gap < CATCH_GAP + .5) return;
            this.zone = 'mid';
            return this.fromHit ? 'escaped' : undefined;
        }
        if (this.zone === 'mid' && this.gap >= LEAD_GAP) {
            this.zone = 'lead';
            return 'lead';
        }
        if (this.zone === 'lead' && this.gap < LEAD_LOST) this.zone = 'mid';
    }
}
