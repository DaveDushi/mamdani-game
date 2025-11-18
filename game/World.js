import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.speed = 10; // Base speed
        this.distance = 0;
        this.texGen = new TextureGenerator();

        // Ground
        const groundGeo = new THREE.PlaneGeometry(100, 1000);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        this.ground = new THREE.Mesh(groundGeo, groundMat);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.z = -450;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Road Markings
        this.markings = [];
        const markGeo = new THREE.PlaneGeometry(0.5, 5);
        const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        for (let i = 0; i < 20; i++) {
            const mark1 = new THREE.Mesh(markGeo, markMat);
            mark1.rotation.x = -Math.PI / 2;
            mark1.position.set(-1.5, 0.01, -i * 10);
            this.scene.add(mark1);
            this.markings.push(mark1);

            const mark2 = new THREE.Mesh(markGeo, markMat);
            mark2.rotation.x = -Math.PI / 2;
            mark2.position.set(1.5, 0.01, -i * 10);
            this.scene.add(mark2);
            this.markings.push(mark2);
        }

        // City Buildings
        this.buildings = [];
        this.buildingGeo = new THREE.BoxGeometry(5, 20, 5);
        // We will create unique materials for variety in spawnBuildingPair

        for (let i = 0; i < 20; i++) {
            this.spawnBuildingPair(-i * 20);
        }
    }

    spawnBuildingPair(z) {
        const texture = this.texGen.getTexture('building');
        const mat = new THREE.MeshStandardMaterial({ map: texture });

        // Left
        const b1 = new THREE.Mesh(this.buildingGeo, mat);
        const scale1 = 0.5 + Math.random() * 1.5;
        b1.scale.y = scale1;
        b1.position.set(-10, 10 * scale1, z); // Anchor to ground
        this.scene.add(b1);
        this.buildings.push(b1);

        // Right
        const b2 = new THREE.Mesh(this.buildingGeo, mat);
        const scale2 = 0.5 + Math.random() * 1.5;
        b2.scale.y = scale2;
        b2.position.set(10, 10 * scale2, z); // Anchor to ground
        this.scene.add(b2);
        this.buildings.push(b2);
    }

    reset() {
        this.speed = 10;
        this.distance = 0;
    }

    update(dt) {
        this.speed += dt * 0.1; // Accelerate
        this.distance += this.speed * dt;

        const moveDist = this.speed * dt;

        // Move Markings
        this.markings.forEach(m => {
            m.position.z += moveDist;
            if (m.position.z > 10) {
                m.position.z -= 200;
            }
        });

        // Move Buildings
        this.buildings.forEach(b => {
            b.position.z += moveDist;
            if (b.position.z > 10) {
                b.position.z -= 400;
                const newScale = 0.5 + Math.random() * 1.5;
                b.scale.y = newScale;
                b.position.y = 10 * newScale; // Recalculate Y
            }
        });
    }
}
