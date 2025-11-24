import * as BABYLON from '@babylonjs/core';
import { TextureGenerator } from './TextureGenerator.js';

export class World {
    constructor(scene, shadowGenerator) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.speed = 30; // Base speed
        this.distance = 0;
        this.texGen = new TextureGenerator();

        // Billboard Textures
        const baseUrl = import.meta.env.BASE_URL;
        this.billboardTextures = {
            capitalist: [
                new BABYLON.Texture(`${baseUrl}assets/billboard_cap_1.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_cap_2.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_cap_3.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_cap_4.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_cap_5.png`, scene)
            ],
            neutral: [
                new BABYLON.Texture(`${baseUrl}assets/billboard_neu_1.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_neu_2.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_neu_3.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_neu_4.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_neu_5.png`, scene)
            ],
            communist: [
                new BABYLON.Texture(`${baseUrl}assets/billboard_com_1.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_com_2.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_com_3.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_com_4.png`, scene),
                new BABYLON.Texture(`${baseUrl}assets/billboard_com_5.png`, scene)
            ]
        };

        // Building Texture
        this.buildingTexture = this.texGen.getTexture('building');

        // Ground
        const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        groundMat.specularColor = new BABYLON.Color3(0, 0, 0); // No shine

        this.ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 1000 }, scene);
        this.ground.position.z = 450; // Babylon Z increases forward usually, but let's stick to logic: camera at 0, looking at -Z?
        // Wait, Three.js camera was at 0, 5, 6 looking at 0, 0, -5. So -Z is forward.
        // Babylon camera setup in main.js: pos 0, 5, 6 looking at 0, 0, -5. So -Z is forward.
        // So ground should extend from roughly 0 to -1000.
        this.ground.position.z = -450;
        this.ground.material = groundMat;
        this.ground.receiveShadows = true;

        // Road Markings
        this.markings = [];
        const markMat = new BABYLON.StandardMaterial("markMat", scene);
        markMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        markMat.emissiveColor = new BABYLON.Color3(1, 1, 1);

        for (let i = 0; i < 20; i++) {
            const mark1 = BABYLON.MeshBuilder.CreatePlane(`mark1_${i}`, { width: 0.5, height: 5 }, scene);
            mark1.rotation.x = Math.PI / 2; // Flat on ground
            mark1.position.set(-1.5, 0.01, -i * 10);
            mark1.material = markMat;
            this.markings.push(mark1);

            const mark2 = BABYLON.MeshBuilder.CreatePlane(`mark2_${i}`, { width: 0.5, height: 5 }, scene);
            mark2.rotation.x = Math.PI / 2;
            mark2.position.set(1.5, 0.01, -i * 10);
            mark2.material = markMat;
            this.markings.push(mark2);
        }

        // City Buildings
        this.buildings = [];
        // We will create unique materials for variety in spawnBuildingPair

        for (let i = 0; i < 20; i++) {
            this.spawnBuildingPair(-i * 20);
        }
    }

    getBillboardTexture() {
        if (this.distance < 1000) {
            return this.billboardTextures.capitalist[Math.floor(Math.random() * this.billboardTextures.capitalist.length)];
        } else if (this.distance < 2000) {
            return this.billboardTextures.neutral[Math.floor(Math.random() * this.billboardTextures.neutral.length)];
        } else {
            return this.billboardTextures.communist[Math.floor(Math.random() * this.billboardTextures.communist.length)];
        }
    }

    attachBillboard(building) {
        const texture = this.getBillboardTexture();
        const mat = new BABYLON.StandardMaterial("billboardMat", this.scene);
        mat.diffuseTexture = texture;
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1);

        // Billboard Geometry (Box for thickness)
        // 4 wide, 6 tall, 0.2 deep
        const billboard = BABYLON.MeshBuilder.CreateBox("billboard", { width: 4, height: 6, depth: 0.2 }, this.scene);

        // Position on the FRONT face of the building (South side, facing player)
        // Building is 7x20x5. Z extent is +/- 2.5.
        // We want it at z = 2.6 (slightly in front)
        // Lower it a bit: y = -2 relative to building center

        billboard.parent = building;
        billboard.position.set(0, -2, 2.6);

        // Correct rotation if needed, but Box UVs usually map face 0 to front.
        // Let's ensure texture is on the correct face.
        // Babylon Box faces: 0: front (Z-), 1: back (Z+), ... wait.
        // Actually, let's just rotate it so the front face (Z-) points to camera (Z+).
        billboard.rotation.y = Math.PI;
    }

    spawnBuildingPair(z) {
        // Texture generation might need update if it returns Three texture
        // Assuming texGen returns a data URL or canvas, we can use it.
        // If it returns THREE.CanvasTexture, we need to adapt.
        // Let's assume for now we need to fix TextureGenerator later or it just works if it returns canvas.
        // Checking TextureGenerator... it likely returns THREE.CanvasTexture.
        // I'll use a simple color for now to avoid breaking, or fix TextureGenerator later.

        const mat = new BABYLON.StandardMaterial("buildingMat", this.scene);
        mat.diffuseTexture = this.buildingTexture;

        // Random Building Color
        const colors = [
            new BABYLON.Color3(0.6, 0.3, 0.1), // Brown
            new BABYLON.Color3(0.7, 0.4, 0.3), // Brick
            new BABYLON.Color3(0.5, 0.5, 0.5), // Grey
            new BABYLON.Color3(0.4, 0.4, 0.45), // Blue-ish Grey
            new BABYLON.Color3(0.7, 0.7, 0.6)  // Beige
        ];
        mat.diffuseColor = colors[Math.floor(Math.random() * colors.length)];

        mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1); // Slight shine

        // Adjust UVs to tile properly
        // Building is 7x20x5. Texture is 128x256 (1:2 ratio).
        // Let's map it so it looks like a tall building.
        mat.diffuseTexture.uScale = 1;
        mat.diffuseTexture.vScale = 1;

        // Left Building
        const scale1 = 0.5 + Math.random() * 1.5;
        const b1 = BABYLON.MeshBuilder.CreateBox("b1", { width: 7, height: 20, depth: 5 }, this.scene);
        b1.scaling.y = scale1;
        b1.position.set(-10, 10 * scale1, z);
        b1.material = mat;
        this.buildings.push(b1);

        // Shadows
        if (this.shadowGenerator) {
            this.shadowGenerator.getShadowMap().renderList.push(b1);
            b1.receiveShadows = true;
        }

        // Chance to add billboard
        if (Math.random() < 0.4) {
            this.attachBillboard(b1);
        }

        // Right Building
        const scale2 = 0.5 + Math.random() * 1.5;
        const b2 = BABYLON.MeshBuilder.CreateBox("b2", { width: 7, height: 20, depth: 5 }, this.scene);
        b2.scaling.y = scale2;
        b2.position.set(10, 10 * scale2, z);
        b2.material = mat;
        this.buildings.push(b2);

        if (this.shadowGenerator) {
            this.shadowGenerator.getShadowMap().renderList.push(b2);
            b2.receiveShadows = true;
        }

        // Chance to add billboard
        if (Math.random() < 0.4) {
            this.attachBillboard(b2);
        }
    }

    reset() {
        this.speed = 12;
        this.distance = 0;
    }

    update(dt) {
        this.speed += dt * 0.35; // Accelerate
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
                b.scaling.y = newScale;
                b.position.y = 10 * newScale; // Recalculate Y

                // Remove old billboards
                // Babylon children handling
                const children = b.getChildren();
                for (let i = children.length - 1; i >= 0; i--) {
                    children[i].dispose();
                }

                // Chance to add new billboard
                if (Math.random() < 0.4) {
                    this.attachBillboard(b);
                }
            }
        });
    }
}
