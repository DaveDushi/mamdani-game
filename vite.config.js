import { defineConfig } from 'vite';

const gameApi = {
    '/game-api': {
        target: 'https://api.mamdanirun.cc',
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
            output: {
                manualChunks(id) {
                    if (id.includes('/three/build/three.module.js')) return 'three';
                }
            }
        }
    }
});
