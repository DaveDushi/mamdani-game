import { Capacitor, CapacitorHttp } from '@capacitor/core';

const live = 'https://api.mamdanirun.cc';
const localHosts = ['localhost', '127.0.0.1', '[::1]'];

export class ApiClient {
    constructor(baseUrl) {
        this.native = Capacitor.isNativePlatform();
        const preview = !this.native && (import.meta.env.DEV || localHosts.includes(location.hostname));
        this.baseUrl = baseUrl ?? (preview ? '/game-api' : live);
    }

    async request(path, data) {
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
                method, headers, body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal
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
        const result = await this.request('/leaderboard?limit=' + limit);
        const entries = Array.isArray(result) ? result : (result?.entries ?? result?.scores);
        return Array.isArray(entries) ? entries : null;
    }

    async healthCheck() {
        return await this.request('/health') ?? { ok: false };
    }
}
