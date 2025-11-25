import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.speed = 30; // Base speed
        this.distance = 0;
        this.texGen = new TextureGenerator();

        // Billboard Textures
        const loader = new THREE.TextureLoader();
        const baseUrl = import.meta.env.BASE_URL;
        this.billboardTextures = {
            capitalist: [
                loader.load(`${baseUrl}billboard_cap_1.png`),
                loader.load(`${baseUrl}billboard_cap_2.png`),
                loader.load(`${baseUrl}billboard_cap_3.png`),
                loader.load(`${baseUrl}billboard_cap_4.png`),
                loader.load(`${baseUrl}billboard_cap_5.png`)
            ],
            neutral: [
                loader.load(`${baseUrl}billboard_neu_1.png`),
                loader.load(`${baseUrl}billboard_neu_2.png`),
                loader.load(`${baseUrl}billboard_neu_3.png`),
                loader.load(`${baseUrl}billboard_neu_4.png`),
                loader.load(`${baseUrl}billboard_neu_5.png`)
            ],
            communist: [
                loader.load(`${baseUrl}billboard_com_1.png`),
                loader.load(`${baseUrl}billboard_com_2.png`),
                loader.load(`${baseUrl}billboard_com_3.png`),
                loader.load(`${baseUrl}billboard_com_4.png`),
                loader.load(`${baseUrl}billboard_com_5.png`)
            ]
        };

        this.billboards = []; // Not used for standalone anymore, but maybe track for updates? No, attached to buildings.

        // Billboard Geometry (Vertical Plane)
        this.billboardGeo = new THREE.PlaneGeometry(4, 6); // Taller for Times Square feel

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
        this.buildingGeo = new THREE.BoxGeometry(7, 20, 5); // Wider (7)
        // We will create unique materials for variety in spawnBuildingPair

        for (let i = 0; i < 20; i++) {
            this.spawnBuildingPair(-i * 20);
        }
    }

    getBillboardTexture() {
        if (this.distance < 1000) {
            return this.billboardTextures.capitalist[Math.floor(Math.random() * this.billboardTextures.capitalist.length)];
        } else if (this.distance < 2000) {
            // Mix of capitalist and neutral, or just neutral
            return this.billboardTextures.neutral[Math.floor(Math.random() * this.billboardTextures.neutral.length)];
        } else {
            return this.billboardTextures.communist[Math.floor(Math.random() * this.billboardTextures.communist.length)];
        }
    }

    attachBillboard(building) {
        const texture = this.getBillboardTexture();
        // Emissive material for "screen" look
        const mat = new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff });
        const billboard = new THREE.Mesh(this.billboardGeo, mat);

        // Position on the FRONT face of the building (South side, facing player)
        // Building is 7x20x5. Z extent is +/- 2.5.
        // We want it at z = 2.55 (slightly in front)
        // Lower it a bit: y = -2
        billboard.position.set(0, -2, 2.55);

        // PlaneGeometry faces +Z by default, which is what we want (facing the camera at +Z)
        billboard.rotation.set(0, 0, 0);

        building.add(billboard);
    }

    spawnBuildingPair(z) {
        const texture = this.texGen.getTexture('building');
        const mat = new THREE.MeshStandardMaterial({ map: texture });

        // Left Building
        const b1 = new THREE.Mesh(this.buildingGeo, mat);
        const scale1 = 0.5 + Math.random() * 1.5;
        b1.scale.y = scale1;
        b1.position.set(-10, 10 * scale1, z);
        this.scene.add(b1);
        this.buildings.push(b1);

        // Chance to add billboard
        if (Math.random() < 0.4) {
            this.attachBillboard(b1);
        }

        // Right Building
        const b2 = new THREE.Mesh(this.buildingGeo, mat);
        const scale2 = 0.5 + Math.random() * 1.5;
        b2.scale.y = scale2;
        b2.position.set(10, 10 * scale2, z);
        this.scene.add(b2);
        this.buildings.push(b2);

        // Chance to add billboard
        if (Math.random() < 0.4) {
            this.attachBillboard(b2);
        }
    }

    reset() {
        this.speed = 13;
        this.distance = 0;
    }

    update(dt) {
        this.speed += dt * 0.40; // Accelerate
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

                // Remove old billboards
                for (let i = b.children.length - 1; i >= 0; i--) {
                    b.remove(b.children[i]);
                }

                // Chance to add new billboard
                if (Math.random() < 0.4) {
                    this.attachBillboard(b);
                }
            }
        });

        // No standalone billboards to update anymore
    }
}
