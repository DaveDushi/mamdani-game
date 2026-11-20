import { RIVALS } from './FamilyRace.js';
import { OPENING_RECORD_METRES } from '../backend/src/season-rules.js';

// Keep the final approach longest as the season record moves farther out.
const checkpointShares = [0.08, 0.19, 0.33, 0.51, 0.73];
const openingHeats = [32, 36, 40, 44, 48];
const RETRY_SECONDS = 8;
const REFRESH_SECONDS = 15;
const STREET_RETURN_SECONDS = 2;
const distanceFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

export function familySchedule(score) {
    const target = Math.max(OPENING_RECORD_METRES, score ?? 0);
    const growth = Math.min(1, (target - OPENING_RECORD_METRES) / (3000 - OPENING_RECORD_METRES));
    return RIVALS.map((rival, index) => {
        const final = index === RIVALS.length - 1;
        const metres = final ? 100 : Math.round(openingHeats[index] + (100 - openingHeats[index]) * growth);
        return {
            ...rival,
            at: final ? target + 1 : Math.round(target * checkpointShares[index]),
            metres,
            countdown: metres < 100 ? 2 : 3,
            // Keep the standing start allowance even in the shortest heat.
            finish: 0.65 + (rival.finish - 0.65) * metres / 100
        };
    });
}

export function raceDistance(metres) {
    return metres < 1000 ? distanceFormat.format(metres) + ' m' : distanceFormat.format(metres / 1000) + ' km';
}

export class RaceSchedule {
    constructor(provider) {
        this.provider = provider;
        this.rivals = familySchedule(null);
        this.target = OPENING_RECORD_METRES;
        this.qualified = false;
        this.initialRecordPending = !!provider;
        this.reading = false;
        this.claiming = false;
        this.retryClaim = false;
        this.refreshAt = 0;
        this.retryAt = 0;
        this.elapsed = 0;
        this.nextHeatAt = 0;
    }

    update(score, wins, elapsed) {
        this.elapsed = elapsed;
        if (!this.provider || this.qualified || this.claiming) return;
        if (wins === RIVALS.length - 1 && (score > this.target || this.retryClaim)) {
            if (elapsed >= this.retryAt) return this.claim(score);
            return;
        }
        if (!this.reading && elapsed >= this.refreshAt) return this.refresh();
    }

    returnedToStreet(elapsed) {
        this.nextHeatAt = elapsed + STREET_RETURN_SECONDS;
    }

    canEnter(rival, score) {
        return !this.initialRecordPending && this.elapsed >= this.nextHeatAt && score >= rival.at &&
            (rival.index < RIVALS.length - 1 || this.qualified);
    }

    setTarget(score) {
        const target = Math.max(OPENING_RECORD_METRES, score ?? 0);
        if (target === this.target) return;
        this.target = target;
        this.rivals = familySchedule(target);
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
                this.setTarget(reply.previousRecord);
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
