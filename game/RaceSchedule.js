import { RIVALS } from './FamilyRace.js';

export const CAMPAIGN_FLOOR_METRES = 9000;
export const PRESSURE_CAP_METRES = 30000;

const openingCheckpoints = [650, 1670, 2975, 4650, 6650];
const SPRINT_METRES = 100;
const LAUNCH_SECONDS = .65;
const RETRY_SECONDS = 8;
const REFRESH_SECONDS = 15;
const STREET_RETURN_SECONDS = 18;
const distanceFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

export function familySchedule(score) {
    const target = Math.max(CAMPAIGN_FLOOR_METRES, score ?? 0);
    const scaling = target / CAMPAIGN_FLOOR_METRES;
    const growth = Math.min(1, (target - CAMPAIGN_FLOOR_METRES) / (PRESSURE_CAP_METRES - CAMPAIGN_FLOOR_METRES));
    const pressure = 1 + .012 * growth;
    return RIVALS.map((rival, index) => {
        const final = index === RIVALS.length - 1;
        const metres = Math.round(rival.metres + (SPRINT_METRES - rival.metres) * growth);
        return {
            ...rival,
            at: final ? target + 1 : Math.round(openingCheckpoints[index] * scaling),
            metres,
            countdown: metres < SPRINT_METRES ? 2 : 3,
            finish: LAUNCH_SECONDS + (rival.finish - LAUNCH_SECONDS) * metres / rival.metres / pressure,
            surge: rival.surge * (1 + .2 * growth)
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
        this.target = CAMPAIGN_FLOOR_METRES;
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
        const target = Math.max(CAMPAIGN_FLOOR_METRES, score ?? 0);
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
