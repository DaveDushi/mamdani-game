import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { SEASON } from '../backend/src/season-rules.js';

const live = 'https://api.mamdanirun.com';
const localHosts = ['localhost', '127.0.0.1', '[::1]'];
const seasonPath = '/seasons/' + SEASON;
const fresh = { cache: 'no-store' };
const TICKET_RETRIES_MS = [2000, 4000, 8000, 8000, 8000, 8000];

function standings(result) {
    const entries = Array.isArray(result) ? result : (result?.entries ?? result?.scores);
    return Array.isArray(entries) ? entries : null;
}

// A refused request cannot succeed on retry. Null means the service could not be reached.
function refusal(status) {
    return status >= 400 && status < 500 && status !== 408 && status !== 429 ? { ok: false, rejected: true } : null;
}

function seasonRecord(score) {
    return score === null || (Number.isSafeInteger(score) && score >= 0) ? { score } : null;
}

export class ApiClient {
    constructor(baseUrl) {
        this.native = Capacitor.isNativePlatform();
        this.seasonPath = this.native ? seasonPath + '/ios' : seasonPath;
        const preview = !this.native && (import.meta.env?.DEV || localHosts.includes(globalThis.location?.hostname));
        this.baseUrl = baseUrl ?? (preview ? '/game-api' : live);
    }

    async request(path, data, { cache } = {}) {
        const method = data === undefined ? 'GET' : 'POST';
        const headers = data === undefined ? {} : { 'Content-Type': 'application/json' };
        const url = this.baseUrl + path;
        let timeout;
        try {
            if (this.native) {
                const result = await CapacitorHttp.request({
                    url, method, headers, data, responseType: 'json', connectTimeout: 7000, readTimeout: 8000
                });
                return result.status >= 200 && result.status < 300 ? result.data : refusal(result.status);
            }
            const controller = new AbortController();
            timeout = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(url, {
                method, headers, body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal, cache
            });
            return response.ok ? await response.json() : refusal(response.status);
        } catch {
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    // Later than this a ticket could no longer cover the points already earned.
    async startRun({ key, mode, wanted = () => true }) {
        const path = this.seasonPath + '/run';
        let result = await this.request(path, { key, mode });
        for (const delay of TICKET_RETRIES_MS) {
            if (result) break;
            await new Promise(done => setTimeout(done, delay));
            if (!wanted()) return null;
            result = await this.request(path, { key, mode });
        }
        return result?.ok === true && typeof result.ticket === 'string' ? { ticket: result.ticket } : null;
    }

    async register(key, name, social, isPwa = false) {
        const profile = this.native ? { key, name } : { key, name, social, isPwa };
        return await this.request(this.seasonPath + '/profile', profile) ?? { ok: false };
    }

    async sendFeedback(key, message) {
        return await this.request(this.seasonPath + '/feedback', { key, message }) ?? { ok: false };
    }

    // With a key, the player's own entry carries `you`.
    async getSeasonLeaderboard(limit = 50, key = null) {
        return standings(key
            ? await this.request(this.seasonPath + '/leaderboard', { key, limit })
            : await this.request(seasonPath + '/leaderboard?limit=' + limit, undefined, fresh));
    }

    async getSeasonRecord() {
        const result = await this.request(seasonPath + '/record', undefined, fresh);
        return result?.ok === true ? seasonRecord(result.record) : null;
    }

    async claimSeasonRecord({ key, ticket, score, mode }) {
        const result = await this.request(this.seasonPath + '/record/claim', { key, ticket, score, mode });
        if (result?.ok !== true || typeof result.qualified !== 'boolean') return null;
        const record = seasonRecord(result.record);
        const previous = seasonRecord(result.previousRecord);
        return record && previous ? { qualified: result.qualified, record, previousRecord: previous.score } : null;
    }

    async submitSeasonScore({ key, ticket, score, mode }) {
        return await this.request(this.seasonPath + '/score', { key, ticket, score, mode }) ?? { ok: false };
    }

    async deleteSeasonData(key) {
        return await this.request(this.seasonPath + '/delete', { key }) ?? { ok: false };
    }

    async healthCheck() {
        return await this.request('/health') ?? { ok: false };
    }
}
