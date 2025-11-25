import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

export class PowerupManager {
    constructor(scene) {
        this.scene = scene;
        this.powerups = [];
        this.texGen = new TextureGenerator();

        // Geometries
        // Kafiyeh: Bandana Triangle (Flattened Cone)
        this.kafiyehGeo = new THREE.ConeGeometry(0.5, 0.1, 3); // Triangle prism
        this.kafiyehGeo.rotateX(Math.PI / 2); // Lay flat
        this.kafiyehGeo.rotateY(Math.PI / 6); // Point forward

        // Rainbow: Flag (Box)
        this.rainbowGeo = new THREE.BoxGeometry(1.0, 0.7, 0.1);

        // Covid Mask: Surgical Mask (Curved Plane or Box)
        this.covidMaskGeo = new THREE.BoxGeometry(0.6, 0.4, 0.1);

        // Materials
        this.kafiyehMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('kafiyeh') });
        this.rainbowMat = new THREE.MeshStandardMaterial({
            map: this.texGen.getTexture('rainbow_flag'),
            emissive: 0x222222,
            emissiveMap: this.texGen.getTexture('rainbow_flag')
        });
        this.covidMaskMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('covidMask') });
    }

    reset() {
        this.powerups.forEach(p => this.scene.remove(p.mesh));
        this.powerups = [];
    }

    spawnPowerup(lane, zPos) {
        const typeRoll = Math.random();
        let mesh, type;

        if (typeRoll >= 0.70) {
            type = 'rainbow';
            mesh = new THREE.Mesh(this.rainbowGeo, this.rainbowMat);
            mesh.rotation.x = -Math.PI / 6; // Tilt slightly back to be visible
        } else if (typeRoll >= 0.50) {
            type = 'kafiyeh';
            mesh = new THREE.Mesh(this.kafiyehGeo, this.kafiyehMat);
            mesh.rotation.x = -Math.PI / 4; // Tilt slightly up
        } else if (typeRoll >= 0.30) {
            type = 'covidMask';
            mesh = new THREE.Mesh(this.covidMaskGeo, this.covidMaskMat);
            mesh.rotation.x = -Math.PI / 6; // Tilt to face camera
        } else {
            return
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
