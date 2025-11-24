export class ApiClient {
    constructor(baseUrl = 'https://api.mamdanirun.cc') {
        this.baseUrl = baseUrl;
    }

    async register(playerId, name, social) {
        try {
            const response = await fetch(`${this.baseUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId, name, social })
            });
            return await response.json();
        } catch (error) {
            console.error('API Error (register):', error);
            return { ok: false };
        }
    }

    async submitScore(playerId, score) {
        try {
            const response = await fetch(`${this.baseUrl}/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId, score })
            });
            return await response.json();
        } catch (error) {
            console.error('API Error (submitScore):', error);
            return { ok: false };
        }
    }

    async sendFeedback(playerId, message) {
        try {
            const response = await fetch(`${this.baseUrl}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId, message })
            });
            return await response.json();
        } catch (error) {
            console.error('API Error (sendFeedback):', error);
            return { ok: false };
        }
    }

    async getLeaderboard(limit = 50) {
        try {
            const response = await fetch(`${this.baseUrl}/leaderboard?limit=${limit}`);
            return await response.json();
        } catch (error) {
            console.error('API Error (getLeaderboard):', error);
            return [];
        }
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return await response.json();
        } catch (error) {
            console.error('API Error (healthCheck):', error);
            return { ok: false };
        }
    }
}
