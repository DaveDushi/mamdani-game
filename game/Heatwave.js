export const HEATWAVE_SECONDS = 16;

// Only the street simulation advances this clock. Sprint heats and pause
// countdowns can use their own clocks without spending this bonus.
export class Heatwave {
    constructor(random = Math.random) {
        this.random = random;
        this.firstAt = 850 + Math.floor(random() * 251);
        this.cooldown = 0;
        this.remaining = 0;
        this.onFoot = true;
    }

    update(dt, distance, onFoot) {
        this.onFoot = onFoot;
        if (!onFoot || dt <= 0 || distance < this.firstAt) return;
        if (this.remaining > 0) {
            this.remaining = Math.max(0, this.remaining - dt);
            if (this.remaining === 0) {
                this.cooldown = 40 + Math.floor(this.random() * 21);
                return 'end';
            }
            return;
        }
        this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.cooldown === 0) {
            this.remaining = HEATWAVE_SECONDS;
            return 'start';
        }
    }

    get streakReward() {
        return this.active ? 2 : 1;
    }

    get active() {
        return this.onFoot && this.remaining > 0;
    }
}
