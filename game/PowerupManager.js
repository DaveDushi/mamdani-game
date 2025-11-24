import * as BABYLON from '@babylonjs/core';
import { TextureGenerator } from './TextureGenerator.js';

export class PowerupManager {
    constructor(scene) {
        this.scene = scene;
        this.powerups = [];
        this.texGen = new TextureGenerator();

        // Materials
        this.kafiyehMat = new BABYLON.StandardMaterial("kafiyehMat", scene);
        this.kafiyehMat.diffuseColor = new BABYLON.Color3(0, 0, 0); // Black/White pattern ideally

        this.rainbowMat = new BABYLON.StandardMaterial("rainbowMat", scene);
        this.rainbowMat.diffuseColor = new BABYLON.Color3(1, 0, 1); // Rainbow-ish

        this.covidMaskMat = new BABYLON.StandardMaterial("covidMaskMat", scene);
        this.covidMaskMat.diffuseColor = new BABYLON.Color3(0.4, 0.8, 1); // Light Blue
    }

    reset() {
        this.powerups.forEach(p => p.mesh.dispose());
        this.powerups = [];
    }

    spawnPowerup(lane, zPos) {
        const typeRoll = Math.random();
        let mesh, type;

        if (typeRoll < 0.33) {
            type = 'kafiyeh';
            // ConeGeometry(diameterTop, diameterBottom, height, tessellation)
            mesh = BABYLON.MeshBuilder.CreateCylinder("kafiyeh", { diameterTop: 0, diameterBottom: 1, height: 0.2, tessellation: 3 }, this.scene);
            mesh.material = this.kafiyehMat;
            mesh.rotation.x = -Math.PI / 4;
        } else if (typeRoll < 0.66) {
            type = 'rainbow';
            mesh = BABYLON.MeshBuilder.CreateTorus("rainbow", { diameter: 0.8, thickness: 0.2, tessellation: 16 }, this.scene);
            mesh.material = this.rainbowMat;
            mesh.rotation.z = 0; // Standing up
        } else {
            type = 'covidMask';
            mesh = BABYLON.MeshBuilder.CreateBox("covidMask", { width: 0.6, height: 0.4, depth: 0.1 }, this.scene);
            mesh.material = this.covidMaskMat;
            mesh.rotation.x = -Math.PI / 6;
        }

        mesh.position.set(lane, 1, zPos);
        this.scene.addMesh(mesh); // Explicit add not strictly needed if created with scene, but safe

        this.powerups.push({ mesh, type });
    }

    update(dt, speed, player) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.mesh.position.z += speed * dt;
            p.mesh.rotation.y += 3 * dt;

            // Remove if passed
            if (p.mesh.position.z > 10) {
                p.mesh.dispose();
                this.powerups.splice(i, 1);
            }
        }
    }

    checkCollisions(player) {
        const playerPos = player.mesh.position;

        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            const pPos = p.mesh.position;

            if (Math.abs(pPos.z - playerPos.z) < 1.0 && Math.abs(pPos.x - playerPos.x) < 1.0) {
                p.mesh.dispose();
                this.powerups.splice(i, 1);
                return p.type;
            }
        }
        return null;
    }
}
