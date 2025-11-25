export class ScoreManager {
    constructor() {
        this.score = 0; // Distance
        this.foodStamps = 0; // Currency
        this.donations = 0; // Safe currency

        // Tax Config
        this.taxTimer = 0;
        this.taxInterval = 120; // 2 minutes
        this.taxRate = 0.5; // 50%
    }

    reset() {
        this.score = 0;
        this.foodStamps = 0;
        this.donations = 0;
        this.taxTimer = 0;
    }

    update(dt, speed, multiplier = 1) {
        // Score based on distance/speed
        this.score += speed * dt * multiplier;
        return false;
    }

    addFoodStamps(amount) {
        this.foodStamps += amount;
    }

    addDonation(amount) {
        this.donations += amount;
    }

    applyFinalTax() {
        const taxAmount = Math.floor(this.foodStamps * this.taxRate);
        this.foodStamps -= taxAmount;
        return taxAmount;
    }

    getDisplayScore() {
        return Math.floor(this.score);
    }
}
