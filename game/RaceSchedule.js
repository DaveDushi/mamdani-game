import { RIVALS } from './FamilyRace.js';

// Donald waits past this many points, or past the live record once it is higher.
export const RECORD_FLOOR = 12000;

const checkpoints = [650, 1670, 2975, 4650, 6650];
const RETRY_SECONDS = 8;
const REFRESH_SECONDS = 15;
const STREET_RETURN_SECONDS = 18;
// The check-in boards stand on the street from here, so the forecast stops moving.
const SETTLED_METRES = 220;
const OVERSHOOT_METRES = 40;
const distanceFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

export function familySchedule(score) {
    const target = Math.max(RECORD_FLOOR, score ?? 0);
    return RIVALS.map((rival, index) => {
        const record = index === RIVALS.length - 1;
        return {
            ...rival,
            // Donald's metres are a forecast. His points target decides when he races.
            at: record ? target + 1 : checkpoints[index],
            record,
            target: record ? target : null,
            countdown: 3
        };
    });
}

export function raceDistance(metres) {
    return metres < 1000 ? distanceFormat.format(metres) + ' m' : distanceFormat.format(metres / 1000) + ' km';
}

export function racePoints(points) {
    return Math.round(points).toLocaleString();
}

export class RaceSchedule {
    constructor(provider) {
        this.provider = provider;
        this.rivals = familySchedule(null);
        this.target = RECORD_FLOOR;
        this.qualified = false;
        this.initialRecordPending = !!provider;
        this.reading = false;
        this.claiming = false;
        this.retryClaim = false;
        this.refreshAt = 0;
        this.retryAt = 0;
        this.elapsed = 0;
        this.nextHeatAt = 0;
        this.score = 0;
        this.metres = 0;
    }

    get final() {
        return this.rivals[RIVALS.length - 1];
    }

    get pointsLeft() {
        return Math.max(0, this.target + 1 - this.score);
    }

    // `score` is points and `metres` is street distance.
    update(score, wins, elapsed, metres = score) {
        this.elapsed = elapsed;
        this.score = score;
        this.metres = metres;
        this.forecast();
        if (!this.provider || this.qualified || this.claiming) return;
        if (wins === RIVALS.length - 1 && (score > this.target || this.retryClaim)) {
            if (elapsed >= this.retryAt) return this.claim(score);
            return;
        }
        if (!this.reading && elapsed >= this.refreshAt) return this.refresh();
    }

    forecast() {
        const { final, metres, score } = this;
        if (this.qualified) return;
        // Style points make a metre worth more than one point. Use this run's own rate.
        const rate = metres > 400 ? Math.max(1, score / metres) : 1;
        const at = Math.round(metres + this.pointsLeft / rate);
        const ahead = final.at - metres;
        const settled = ahead > -OVERSHOOT_METRES && ahead < SETTLED_METRES && at - metres < 2 * SETTLED_METRES;
        if (!settled) final.at = at;
    }

    returnedToStreet(elapsed) {
        this.nextHeatAt = elapsed + STREET_RETURN_SECONDS;
    }

    canEnter(rival, metres) {
        if (this.elapsed < this.nextHeatAt) return false;
        return rival.record ? this.qualified : metres >= rival.at;
    }

    setTarget(score) {
        const target = Math.max(RECORD_FLOOR, score ?? 0);
        if (target === this.target) return;
        this.target = this.final.target = target;
        this.final.at = Infinity;
        this.forecast();
    }

    async refresh() {
        this.reading = true;
        try {
            const record = await this.provider.getRecord();
            if (!this.qualified && record?.score > this.target) this.setTarget(record.score);
            this.refreshAt = this.elapsed + (record ? REFRESH_SECONDS : RETRY_SECONDS);
        } catch {
            this.refreshAt = this.elapsed + RETRY_SECONDS;
        } finally {
            this.reading = false;
            this.initialRecordPending = false;
        }
    }

    async claim(score) {
        this.claiming = true;
        try {
            const reply = await this.provider.claim(score);
            this.retryClaim = !reply;
            if (reply?.qualified) {
                this.qualified = true;
                // Another run may already have beaten this attempt's confirmed record.
                this.target = this.final.target = Math.max(RECORD_FLOOR, reply.previousRecord ?? 0);
                this.final.at = Math.round(this.metres);
            } else if (reply?.record.score > this.target) {
                this.setTarget(reply.record.score);
            }
        } catch {
            this.retryClaim = true;
        } finally {
            this.claiming = false;
            this.retryAt = this.elapsed + (this.retryClaim ? RETRY_SECONDS : 0);
            this.refreshAt = this.elapsed + REFRESH_SECONDS;
        }
    }
}
