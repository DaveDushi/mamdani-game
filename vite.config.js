import { defineConfig } from 'vite';

const gameApi = {
    '/game-api': {
        target: 'https://api.mamdanirun.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/game-api/, '')
    }
};

export default defineConfig({
    base: '',
    server: { proxy: gameApi },
    preview: { proxy: gameApi },
    build: {
        rollupOptions: {
            input: ['index.html', 'transfer-save.html'],
            output: {
                manualChunks(id) {
                    if (id.includes('/three/build/three.module.js')) return 'three';
                }
            }
        }
    }
});
