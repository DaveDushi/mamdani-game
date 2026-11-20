import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { SEASON } from '../backend/src/season-rules.js';

const live = 'https://api.mamdanirun.com';
const localHosts = ['localhost', '127.0.0.1', '[::1]'];
const seasonPath = '/seasons/' + SEASON;
const fresh = { cache: 'no-store' };

function standings(result) {
    const entries = Array.isArray(result) ? result : (result?.entries ?? result?.scores);
    return Array.isArray(entries) ? entries : null;
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
                return result.status >= 200 && result.status < 300 ? result.data : null;
            }
            const controller = new AbortController();
            timeout = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(url, {
                method, headers, body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal, cache
            });
            return response.ok ? await response.json() : null;
        } catch {
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    async register(playerId, name, social, isPwa = false) {
        return await this.request('/register', { playerId, name, social, isPwa }) ?? { ok: false };
    }

    async submitScore(playerId, score) {
        return await this.request('/score', { playerId, score }) ?? { ok: false };
    }

    async sendFeedback(playerId, message) {
        return await this.request('/feedback', { playerId, message }) ?? { ok: false };
    }

    async getLeaderboard(limit = 50) {
        return standings(await this.request('/leaderboard?limit=' + limit));
    }

    async getSeasonLeaderboard(limit = 50) {
        return standings(await this.request(this.seasonPath + '/leaderboard?limit=' + limit, undefined, fresh));
    }

    async getSeasonRecord() {
        const result = await this.request(seasonPath + '/record', undefined, fresh);
        return result?.ok === true ? seasonRecord(result.record) : null;
    }

    async claimSeasonRecord({ playerId, attemptId, score, mode }) {
        const player = this.native ? { key: playerId } : { playerId };
        const result = await this.request(this.seasonPath + '/record/claim', { ...player, attemptId, score, mode });
        if (result?.ok !== true || typeof result.qualified !== 'boolean') return null;
        const record = seasonRecord(result.record);
        const previous = seasonRecord(result.previousRecord);
        return record && previous ? { qualified: result.qualified, record, previousRecord: previous.score } : null;
    }

    async submitSeasonScore({ playerId, score, mode }) {
        const player = this.native ? { key: playerId } : { playerId };
        return await this.request(this.seasonPath + '/score', { ...player, score, mode }) ?? { ok: false };
    }

    async deleteSeasonData(key) {
        return await this.request(this.seasonPath + '/delete', { key }) ?? { ok: false };
    }

    async healthCheck() {
        return await this.request('/health') ?? { ok: false };
    }
}
