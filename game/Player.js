import * as THREE from 'three';
import { RunnerModel } from './RunnerModel.js';
import { StumbleReaction } from './StumbleReaction.js';
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
        this.stumble = new StumbleReaction(this.rig);
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
        this.stumble.reset();
        this.currentLane = 1;
        this.mesh.position.set(0, 0, 0);
        this.mesh.rotation.set(0, 0, 0);
        this.ySpeed = 0;
        this.isGrounded = true;
        this.slideTimer = 0;
        this.slideBlend = 0;
        this.phase = 0;
        this.bank = this.bankVelocity = this.jumpWeight = this.pushOff = this.effort = 0;
        this.jumpLeg = this.slideLeg = this.jumpSample = this.slideSample = 0;
        this.slideAge = this.slidePose = this.releaseWeight = 0;
        this.slideExit = 1;
        this.landAge = 1;
        this.buffer = 0;
        this.confusionTimer = 0;
        this.iceTimer = 0;
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

    update(dt, input, speed, parkRide, reduced = false) {
        this.stumble.restore();
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
        if (this.iceTimer <= 0) {
            this.currentLane = THREE.MathUtils.clamp(this.currentLane + side * (reverse ? -1 : 1), 0, 2);
        }
        this.iceTimer = Math.max(0, this.iceTimer - dt);
        const targetX = parkRide?.active ? parkRide.laneX(this.currentLane) : (this.currentLane - 1) * 3;
        const dx = targetX - this.mesh.position.x;
        this.mesh.position.x += dx * (1 - Math.exp(-16 * dt));
        const jump = input.isJustPressed(reverse ? 'down' : 'up'),
            slide = input.isJustPressed(reverse ? 'up' : 'down');
        this.buffer = jump ? 0.13 : Math.max(0, this.buffer - dt);
        const wasGrounded = this.isGrounded;
        const wasSliding = this.slideTimer > 0;
        this.slideTimer = Math.max(0, this.slideTimer - dt);
        if (slide) {
            if (!wasSliding && this.slidePose < .15) {
                this.slideLeg = Math.cos(this.phase) >= 0 ? 0 : 1;
                this.slideAge = this.slideSample = 0;
            }
            this.slideTimer = 0.8;
            this.buffer = 0;
            if (!this.isGrounded) this.ySpeed = -8;
            this.events.push('slide');
        }
        if (this.isGrounded && this.buffer > 0) {
            this.jumpLeg = this.slidePose > .4 ? this.slideLeg : Math.cos(this.phase) >= 0 ? 0 : 1;
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
        // The street accelerates far beyond human running speed. Open the cadence
        // gradually and cap it at just over two full strides per second.
        this.effort = 1 - Math.exp(-speed / 34);
        const stride = 1.48 + .64 * this.effort;
        const transfer = this.slideTimer > 0 ? 1 : 1 - .9 * this.slidePose;
        this.phase += dt * 2 * Math.PI * stride * transfer;
        if (!this.isGrounded) {
            this.jumpSample = .77 * THREE.MathUtils.clamp((8.9 - this.ySpeed) / 17.8, 0, 1);
            this.jumpWeight += (1 - this.jumpWeight) * (1 - Math.exp(-31 * dt));
            this.pushOff = -Math.min(.12, this.mesh.position.y) * (1 - THREE.MathUtils.smoothstep(this.jumpSample, 0, .12));
        } else {
            if (!wasGrounded) {
                this.landAge = 0;
                this.phase = this.jumpLeg * Math.PI;
            }
            this.landAge = Math.min(1, this.landAge + dt);
            this.jumpSample = .77 + .23 * Math.min(1, this.landAge / .19);
            this.jumpWeight = 1 - THREE.MathUtils.smoothstep(this.landAge, .045, .19);
            this.pushOff = 0;
        }
        if (this.slideTimer > 0) {
            this.slideAge += dt;
            // Repeated duck input extends the slide without replaying the drop.
            const sample = Math.max(Math.min(.6, this.slideAge / .8), 1 - this.slideTimer / .8);
            this.slideSample += THREE.MathUtils.clamp(sample - this.slideSample, -2 * dt, 2 * dt);
            this.slidePose += (1 - this.slidePose) * (1 - Math.exp(-25 * dt));
            this.releaseWeight = this.slidePose;
            this.slideExit = 0;
        } else {
            // The leading heel starts the first running step. Ease the pelvis
            // and trailing foot back into stride after the collision window.
            if (wasSliding && this.isGrounded) this.phase = this.slideLeg * Math.PI;
            this.slideExit = Math.min(.24, this.slideExit + dt);
            this.slidePose = this.releaseWeight * (1 - THREE.MathUtils.smoothstep(this.slideExit, 0, .24));
        }
        const lateral = THREE.MathUtils.clamp(dx / 2.4, -1, 1);
        this.bankVelocity += ((lateral - this.bank) * 205 - this.bankVelocity * 17) * dt;
        this.bank += this.bankVelocity * dt;
        if (parkRide?.active) parkRide.pose(this, reduced);
        else this.rig.pose(this.phase, this.slidePose, this.jumpWeight, this.bank, false, this);
        this.mesh.rotation.y = (parkRide?.active ? parkRide.heading : 0) - .47 * this.bank;
        this.shadow.position.x = this.mesh.position.x - 0.16;
        this.shadow.position.y = parkRide?.active ? .057 : .018;
        this.shadow.position.z = 0.23;
        this.shadow.scale.setScalar(1 + this.mesh.position.y * 0.16);
        if (parkRide?.active) this.shadow.scale.y *= 1.32;
        this.shadow.material.opacity = 1 - this.mesh.position.y * 0.24;
        this.stumble.update(dt);
    }
}
