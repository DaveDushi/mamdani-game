export class ScoreManager {
    constructor() {
        this.score = 0; // Distance
        this.stamps = 0; // Currency
        this.donations = 0; // Safe currency

        // Tax Config
        this.taxTimer = 0;
        this.taxInterval = 120; // 2 minutes
        this.taxRate = 0.5; // 50%
    }

    reset() {
        this.score = 0;
        this.stamps = 0;
        this.donations = 0;
        this.taxTimer = 0;
    }

    update(dt, speed) {
        // Score based on distance/speed
        this.score += speed * dt;
        return false;
    }

    addStamps(amount) {
        this.stamps += amount;
    }

    addDonation(amount) {
        this.donations += amount;
    }

    applyFinalTax() {
        const taxAmount = Math.floor(this.stamps * this.taxRate);
        this.stamps -= taxAmount;
        return taxAmount;
    }

    getDisplayScore() {
        return Math.floor(this.score);
    }
}
