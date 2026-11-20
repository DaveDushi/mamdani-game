import * as THREE from 'three';
import { RunnerModel } from './RunnerModel.js';
import { Batch } from './Geometry.js';

let contactMap;
export function groundShadow(scene, w, d) {
    if (!contactMap) {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d'),
            gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(29,26,36,.55)');
        gradient.addColorStop(0.5, 'rgba(32,29,38,.32)');
        gradient.addColorStop(1, 'rgba(32,29,38,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        contactMap = new THREE.CanvasTexture(c);
    }
    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshBasicMaterial({ map: contactMap, transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.018;
    scene.add(shadow);
    return shadow;
}

export class Player {
    constructor(scene, asset) {
        this.rig = new RunnerModel(asset);
        this.mesh = this.rig.root;
        this.mesh.scale.setScalar(1.1);
        scene.add(this.mesh);
        this.shadow = groundShadow(scene, 1.36, 2.0);
        this.scarf = this.rig.scarf;
        this.sash = this.rig.flag;
        this.mask = this.rig.mask;
        const aura = new Batch();
        const arc = new THREE.TorusGeometry(0.54, 0.027, 4, 12, Math.PI / 3 - 0.035);
        [0xf36264, 0xf39443, 0xf3dd5c, 0x66b37b, 0x5899d7, 0xa57dce].forEach((color, i) => {
            aura.shape(arc, color, 0, 0, 0, 1, 1, 1, 0, 0, (i * Math.PI) / 3);
        });
        arc.dispose();
        this.flagAura = aura.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
        this.flagAura.rotation.x = -Math.PI / 2;
        this.flagAura.position.y = 0.06;
        this.mesh.add(this.flagAura);
        const stars = new Batch();
        const star = new THREE.Shape();
        for (let i = 0; i < 10; i++) {
            const theta = (i * Math.PI) / 5 + Math.PI / 2,
                r = i % 2 ? 0.047 : 0.105;
            const x = Math.cos(theta) * r,
                y = Math.sin(theta) * r;
            if (i) star.lineTo(x, y);
            else star.moveTo(x, y);
        }
        star.closePath();
        const cut = new THREE.ShapeGeometry(star);
        for (let i = 0; i < 4; i++) {
            const theta = (i * Math.PI) / 2;
            stars.shape(
                cut,
                0xffc754,
                Math.sin(theta) * 0.35,
                (i % 2) * 0.065,
                Math.cos(theta) * 0.26,
                1,
                1,
                1,
                0,
                theta
            );
        }
        cut.dispose();
        this.bottleStars = stars.mesh(
            new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
        );
        this.mesh.add(this.bottleStars);
        this.reset();
    }

    reset() {
        this.currentLane = 1;
        this.mesh.position.set(0, 0, 0);
        this.mesh.rotation.set(0, 0, 0);
        this.ySpeed = 0;
        this.isGrounded = true;
        this.slideTimer = 0;
        this.slideBlend = 0;
        this.phase = 0;
        this.buffer = 0;
        this.confusionTimer = 0;
        this.hitTime = 0;
        this.kafiyehTimer = this.rainbowTimer = this.covidMaskTimer = 0;
        this.updateWearables();
        this.flagAura.visible = this.bottleStars.visible = false;
        this.rig.material.emissive.setHex(0);
        this.rig.pose(0, 0, 0, 0, true);
        this.shadow.position.set(-0.07, 0.018, 0.11);
        this.shadow.scale.setScalar(1);
        this.shadow.material.opacity = 1;
        this.events = [];
    }

    setSkin(data) {
        this.rig.setOutfit(data.id);
    }

    activatePowerup(type) {
        if (type === 'kafiyeh') this.kafiyehTimer = 5;
        if (type === 'rainbow') {
            this.rainbowTimer = 7;
            this.confusionTimer = 0;
        }
        if (type === 'covidMask') this.covidMaskTimer = 3;
        this.updateWearables();
    }

    updateWearables() {
        this.hasKafiyeh = this.kafiyehTimer > 0;
        this.hasRainbow = this.rainbowTimer > 0;
        this.hasCovidMask = this.covidMaskTimer > 0;
        this.rig.wear(this.hasKafiyeh, this.hasRainbow, this.hasCovidMask);
        this.flagAura.visible = this.hasRainbow;
    }

    get invincible() {
        return this.rainbowTimer > 0 || this.kafiyehTimer > 0;
    }

    activateConfusion() {
        this.confusionTimer = 5;
        this.events.push('confusion');
    }
    flashRed() {
        this.hitTime = 0.24;
    }

    update(dt, input, speed) {
        this.kafiyehTimer = Math.max(0, this.kafiyehTimer - dt);
        this.rainbowTimer = Math.max(0, this.rainbowTimer - dt);
        this.covidMaskTimer = Math.max(0, this.covidMaskTimer - dt);
        this.updateWearables();
        this.confusionTimer = Math.max(0, this.confusionTimer - dt);
        this.bottleStars.visible = this.confusionTimer > 0;
        if (this.flagAura.visible) this.flagAura.rotation.z += dt * 2;
        if (this.bottleStars.visible) {
            this.bottleStars.rotation.y += dt * 4.9;
            this.bottleStars.position.y = 2.17 - this.slideBlend * 0.61;
        }
        this.hitTime = Math.max(0, this.hitTime - dt);
        this.rig.material.emissive.setRGB(this.hitTime * 1.5, this.hitTime * 0.1, 0);
        const reverse = this.confusionTimer > 0;
        const side = Number(input.isJustPressed('right')) - Number(input.isJustPressed('left'));
        this.currentLane = THREE.MathUtils.clamp(this.currentLane + side * (reverse ? -1 : 1), 0, 2);
        const dx = (this.currentLane - 1) * 3 - this.mesh.position.x;
        this.mesh.position.x += dx * (1 - Math.exp(-16 * dt));
        const jump = input.isJustPressed(reverse ? 'down' : 'up'),
            slide = input.isJustPressed(reverse ? 'up' : 'down');
        this.buffer = jump ? 0.13 : Math.max(0, this.buffer - dt);
        this.slideTimer = Math.max(0, this.slideTimer - dt);
        if (slide) {
            this.slideTimer = 0.8;
            this.buffer = 0;
            if (!this.isGrounded) this.ySpeed = -8;
            this.events.push('slide');
        }
        if (this.isGrounded && this.buffer > 0) {
            this.ySpeed = 8.9;
            this.buffer = 0;
            this.isGrounded = false;
            this.slideTimer = 0;
            this.events.push('jump');
        }
        if (!this.isGrounded) {
            this.mesh.position.y += this.ySpeed * dt - 12 * dt * dt;
            this.ySpeed -= 24 * dt;
            if (this.mesh.position.y <= 0) {
                this.mesh.position.y = 0;
                this.ySpeed = 0;
                this.isGrounded = true;
                this.events.push('land');
            }
        }
        this.slideBlend += ((this.slideTimer > 0 ? 1 : 0) - this.slideBlend) * (1 - Math.exp(-25 * dt));
        this.phase += dt * (9.9 + speed * 0.095);
        this.rig.pose(this.phase, this.slideBlend, Math.min(1, this.mesh.position.y * 2), dx * 0.45);
        this.mesh.rotation.y = dx * -0.066;
        this.shadow.position.x = this.mesh.position.x - 0.16;
        this.shadow.position.z = 0.23;
        this.shadow.scale.setScalar(1 + this.mesh.position.y * 0.16);
        this.shadow.material.opacity = 1 - this.mesh.position.y * 0.24;
    }
}
