import * as THREE from 'three';

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
        this.scene.add(new THREE.HemisphereLight(0xffefda, 0x8c9cac, 1.6));
        const key = new THREE.DirectionalLight(0xffe8cc, 2.5);
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
        this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.tick = this.tick.bind(this);
    }

    open() {
        this.active = true;
        this.time = 1.7;
        this.turn = Math.PI - 0.23;
        this.scene.add(this.player.mesh, this.player.shadow);
        this.resize();
        this.last = performance.now();
        if (!this.reduced) this.frame = requestAnimationFrame(this.tick);
    }
    resize() {
        const w = innerWidth,
            h = innerHeight,
            portrait = w / h < 0.8;
        const panel = document.querySelector('.wardrobe').getBoundingClientRect();
        const blocked = portrait ? Math.min(0.46, (panel.height + 32) / h) : 0;
        const z = 3.87 / (1 - blocked),
            x = portrait ? 0 : -0.65;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(x, 1.37, z);
        this.camera.lookAt(x, 1.02 - blocked * z * 0.285, 0);
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
        city.add(this.player.mesh, this.player.shadow);
    }
}
