import * as THREE from 'three';
import { Player } from './Player.js';

export function createRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    return renderer;
}

export function sizeRenderer(renderer, quality = 1) {
    const w = innerWidth, h = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.4, Math.sqrt(1850000 / (w * h))) * quality;
    if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
    if (renderer.domElement.width !== Math.floor(w * ratio) || renderer.domElement.height !== Math.floor(h * ratio)) {
        renderer.setSize(w, h, false);
    }
}

export function createFittingRoom(canvas, mayor) {
    return new Wardrobe(createRenderer(canvas), new Player(new THREE.Group(), mayor));
}

export class Wardrobe {
    constructor(renderer, player) {
        this.renderer = renderer;
        this.player = player;
        this.scene = new THREE.Scene();
        const c = document.createElement('canvas');
        c.width = 384;
        c.height = 256;
        const ctx = c.getContext('2d'),
            wash = ctx.createRadialGradient(230, 106, 7, 203, 108, 251);
        wash.addColorStop(0, '#839393');
        wash.addColorStop(0.57, '#455c65');
        wash.addColorStop(1, '#192c38');
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, c.width, c.height);
        this.scene.background = new THREE.CanvasTexture(c);
        this.scene.background.colorSpace = THREE.SRGBColorSpace;
        this.camera = new THREE.PerspectiveCamera(33, 1, 0.1, 30);
        this.scene.add(new THREE.HemisphereLight(0xfff7ea, 0x96a3ad, 1.6));
        const key = new THREE.DirectionalLight(0xffefdc, 2.5);
        key.position.set(-2, 4, 3.3);
        key.castShadow = true;
        Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 });
        key.shadow.mapSize.set(512, 512);
        key.shadow.normalBias = 0.007;
        this.scene.add(key);
        const rim = new THREE.DirectionalLight(0xc3e3f6, 2.2);
        rim.position.set(1.5, 2, -2);
        this.scene.add(rim);
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(24, 24),
            new THREE.ShadowMaterial({ opacity: 0.23 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.turn = 0;
        this.time = 0;
        this.frame = 0;
        this.active = false;
        this.preview = document.getElementById('outfit-preview');
        this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.tick = this.tick.bind(this);
        this.resize = this.resize.bind(this);
        this.previewObserver = new ResizeObserver(this.resize);
    }

    open() {
        if (this.active) return;
        this.active = true;
        window.addEventListener('resize', this.resize);
        this.previewObserver.observe(this.preview);
        this.time = 1.7;
        this.turn = Math.PI + 0.21;
        this.scene.add(this.player.mesh, this.player.shadow);
        this.resize();
        this.last = performance.now();
        if (!this.reduced) this.frame = requestAnimationFrame(this.tick);
    }
    resize() {
        if (!this.active) return;
        sizeRenderer(this.renderer);
        const w = innerWidth;
        const h = innerHeight;
        const portrait = matchMedia('(max-aspect-ratio: 4/5)').matches;
        const { left, top, width, height } = this.preview.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        let x = 0;
        if (portrait) {
            const inset = Math.min(8, height / 8);
            // Fit the character inside the preview while drawing the backdrop across the canvas.
            this.camera.setViewOffset(width, height - 2 * inset, -left, -(top + inset), w, h);
        } else {
            this.camera.aspect = w / h;
            this.camera.clearViewOffset();
            // Stand the character in the middle of the free street beside the panel.
            x = (1 - 2 * (left + width / 2) / w) * this.camera.aspect * 3.87 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
        }
        this.camera.position.set(x, 1.37, 3.87);
        this.camera.lookAt(x, 1.02, 0);
        this.render();
    }
    rotate(amount) {
        this.turn += amount;
        this.render();
    }
    render() {
        if (!this.active) return;
        this.player.mesh.rotation.y = this.turn;
        this.player.rig.pose(this.time, 0, 0, 0, true);
        this.renderer.render(this.scene, this.camera);
    }
    tick(now) {
        if (!this.active) return;
        if (now - this.last >= 33) {
            this.time += Math.min(0.1, (now - this.last) / 1000);
            this.last = now;
            this.render();
        }
        this.frame = requestAnimationFrame(this.tick);
    }
    close(city) {
        if (!this.active) return;
        this.active = false;
        cancelAnimationFrame(this.frame);
        window.removeEventListener('resize', this.resize);
        this.previewObserver.disconnect();
        this.scene.remove(this.player.mesh, this.player.shadow);
        city?.add(this.player.mesh, this.player.shadow);
    }
}
