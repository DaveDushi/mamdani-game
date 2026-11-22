export const AUDIT_LOT = 100;
export const MAX_MULTIPLIER = 5;
export const CHAIN_MOVES = 3;
export const CHAIN_SECONDS = 5;
export const CLEAN_MOVE_POINTS = 10;
export const STAMP_POINTS = 5;
export const FAMILY_WIN_POINTS = 500;
export const FAMILY_WIN_STAMPS = Object.freeze([5, 8, 12, 16, 20, 50]);
const TAX_TENTHS = 9;

function auditedGross(gross) {
    return gross - gross % AUDIT_LOT;
}

export function stampReceipt(gross) {
    // This is the whole-run receipt, including tax already taken at each hundred.
    return { gross, tax: gross * TAX_TENTHS / 10, keptTenths: gross };
}

export class ScoreManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.score = 0;
        this.grossStamps = 0;
        this.donations = 0;
        this.stylePoints = 0;
        this.styleBoost = 1;
        this.multiplier = this.bestMultiplier = 1;
        this.chain = 0;
        this.sinceMove = 0;
    }

    get metres() {
        return Math.floor(this.score);
    }

    // The share of the chain window still left.
    get chainTime() {
        return this.multiplier > 1 || this.chain ? 1 - this.sinceMove / CHAIN_SECONDS : 0;
    }

    get auditedGross() {
        return auditedGross(this.grossStamps);
    }

    get foodStamps() {
        return this.grossStamps - this.auditedGross * TAX_TENTHS / 10;
    }

    // Returns true when the multiplier slips a level.
    update(dt, speed, clockRunning = true) {
        this.score += speed * dt;
        if (!clockRunning || (this.multiplier === 1 && !this.chain)) return false;
        this.sinceMove += dt;
        if (this.sinceMove < CHAIN_SECONDS) return false;
        this.sinceMove = this.chain = 0;
        if (this.multiplier === 1) return false;
        this.multiplier--;
        return true;
    }

    // Returns true on every third chained move, which is paid at the raised rate.
    cleanMove() {
        this.sinceMove = 0;
        const complete = ++this.chain === CHAIN_MOVES;
        if (complete) {
            this.chain = 0;
            this.multiplier = Math.min(MAX_MULTIPLIER, this.multiplier + 1);
            this.bestMultiplier = Math.max(this.bestMultiplier, this.multiplier);
        }
        this.addStyle(CLEAN_MOVE_POINTS);
        return complete;
    }

    // Returns true when a multiplier above x1 was lost.
    hit() {
        const lost = this.multiplier > 1;
        this.multiplier = 1;
        this.chain = this.sinceMove = 0;
        return lost;
    }

    addStyle(base) {
        const points = base * this.multiplier * this.styleBoost;
        this.stylePoints += points;
        return points;
    }

    addBonus(points) {
        this.stylePoints += points;
    }

    addFoodStamps(amount) {
        this.grossStamps += amount;
    }

    addDonation(amount) {
        this.donations += amount;
    }

    getDisplayScore() {
        return this.metres + this.stylePoints;
    }
}
