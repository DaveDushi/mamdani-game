export const AUDIT_LOT = 100;
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
    }

    get auditedGross() {
        return auditedGross(this.grossStamps);
    }

    get foodStamps() {
        return this.grossStamps - this.auditedGross * TAX_TENTHS / 10;
    }

    update(dt, speed) {
        this.score += speed * dt;
        return false;
    }

    addFoodStamps(amount) {
        this.grossStamps += amount;
    }

    addDonation(amount) {
        this.donations += amount;
    }

    getDisplayScore() {
        return Math.floor(this.score);
    }
}
