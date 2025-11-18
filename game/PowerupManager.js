import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

export class PowerupManager {
    constructor(scene) {
        this.scene = scene;
        this.powerups = [];
        this.texGen = new TextureGenerator();

        // Geometries
        this.scarfGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        this.rainbowGeo = new THREE.TorusGeometry(0.3, 0.1, 8, 16);
        this.maskGeo = new THREE.SphereGeometry(0.3, 16, 16);

        // Materials
        this.scarfMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('scarf') });
        this.rainbowMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('rainbow') });
        this.maskMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('mask') });
    }

    reset() {
        this.powerups.forEach(p => this.scene.remove(p.mesh));
        this.powerups = [];
    }

    spawnPowerup(lane, zPos) {
        const typeRoll = Math.random();
        let mesh, type;

        if (typeRoll < 0.33) {
            type = 'scarf';
            mesh = new THREE.Mesh(this.scarfGeo, this.scarfMat);
        } else if (typeRoll < 0.66) {
            type = 'rainbow';
            mesh = new THREE.Mesh(this.rainbowGeo, this.rainbowMat);
        } else {
            type = 'mask';
            mesh = new THREE.Mesh(this.maskGeo, this.maskMat);
        }

        mesh.position.set(lane, 1, zPos);
        mesh.castShadow = true;
        this.scene.add(mesh);

        this.powerups.push({ mesh, type });
    }

    update(dt, speed, player) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.mesh.position.z += speed * dt;
            p.mesh.rotation.y += 3 * dt;

            // Remove if passed
            if (p.mesh.position.z > 10) {
                this.scene.remove(p.mesh);
                this.powerups.splice(i, 1);
            }
        }
    }

    checkCollisions(player) {
        const playerBox = new THREE.Box3().setFromObject(player.mesh);

        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            const pBox = new THREE.Box3().setFromObject(p.mesh);

            if (playerBox.intersectsBox(pBox)) {
                this.scene.remove(p.mesh);
                this.powerups.splice(i, 1);
                return p.type;
            }
        }
        return null;
    }
}
