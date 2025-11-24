import * as BABYLON from '@babylonjs/core';
import { TextureGenerator } from './TextureGenerator.js';

export class ObstacleManager {
    constructor(scene, player, powerupManager, shadowGenerator) {
        this.scene = scene;
        this.player = player;
        this.powerupManager = powerupManager;
        this.shadowGenerator = shadowGenerator;
        this.obstacles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1.5; // Seconds between spawns
        this.texGen = new TextureGenerator(scene);

        // Materials Cache
        this.materials = {};
        this.initMaterials();

        this.signMaterials = {}; // Cache for sign materials
    }

    initMaterials() {
        // Bus Material
        const busMat = new BABYLON.StandardMaterial("busMat", this.scene);
        busMat.diffuseTexture = this.texGen.getTexture('bus');
        this.materials.bus = busMat;

        // Barrier Material
        const barrierMat = new BABYLON.StandardMaterial("barrierMat", this.scene);
        barrierMat.diffuseTexture = this.texGen.getTexture('barrier');
        this.materials.barrier = barrierMat;

        // Scaffold Material
        const scaffoldMat = new BABYLON.StandardMaterial("scaffoldMat", this.scene);
        scaffoldMat.diffuseTexture = this.texGen.getTexture('scaffold');
        this.materials.scaffold = scaffoldMat;

        // Coin Material
        const coinMat = new BABYLON.StandardMaterial("coinMat", this.scene);
        coinMat.diffuseTexture = this.texGen.getTexture('coin');
        coinMat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.2);
        this.materials.coin = coinMat;

        // Pothole Material
        const potholeMat = new BABYLON.StandardMaterial("potholeMat", this.scene);
        potholeMat.diffuseTexture = this.texGen.getTexture('pothole');
        potholeMat.useAlphaFromDiffuseTexture = true;
        potholeMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
        this.materials.pothole = potholeMat;

        // Alcohol Material
        const alcoholMat = new BABYLON.StandardMaterial("alcoholMat", this.scene);
        alcoholMat.diffuseTexture = this.texGen.getTexture('alcohol');
        this.materials.alcohol = alcoholMat;
    }

    reset() {
        // Clear existing
        this.obstacles.forEach(obj => obj.mesh.dispose());
        this.obstacles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1.5;
        // Keep material caches
    }

    update(dt, speed, distance) {
        // Spawning
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnObstacle(distance);
            this.spawnTimer = this.spawnInterval / (speed / 10); // Spawn faster as speed increases
        }

        // Movement & Cleanup
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obj = this.obstacles[i];
            obj.mesh.position.z += speed * dt;

            // Rotate coins
            if (obj.type === 'coin') {
                obj.mesh.rotation.y += 2 * dt;
            }

            // Remove if passed player
            if (obj.mesh.position.z > 10) {
                obj.mesh.dispose();
                this.obstacles.splice(i, 1);
            }
        }
    }

    getProtestText(distance) {
        if (distance < 1000) {
            const texts = ["No more taxes", "Free Market", "Trump is King"];
            return texts[Math.floor(Math.random() * texts.length)];
        } else if (distance < 2000) {
            const texts = ["Tax the rich", "Free Healthcare", "Free Palestine"];
            return texts[Math.floor(Math.random() * texts.length)];
        } else {
            const texts = ["Intifada Revolution", "Free Supermarkets", "Dictator Mamdani", "Comrads Unite"];
            return texts[Math.floor(Math.random() * texts.length)];
        }
    }

    spawnObstacle(distance = 0) {
        const lanes = [-3, 0, 3];
        const lane = lanes[Math.floor(Math.random() * lanes.length)];
        const typeRoll = Math.random();
        const zStart = -100;

        // 10% chance to spawn powerup
        if (Math.random() < 0.1 && this.powerupManager) {
            this.powerupManager.spawnPowerup(lane, zStart);
            return;
        }

        let mesh, type;

        if (typeRoll < 0.25) {
            // Protestor (Tall, must dodge)
            type = 'protestor';
            const protestorGroup = new BABYLON.TransformNode("protestor", this.scene);

            // Body
            const body = BABYLON.MeshBuilder.CreateBox("body", { width: 0.6, height: 1.6, depth: 0.4 }, this.scene);
            const bodyMat = new BABYLON.StandardMaterial("bodyMat", this.scene);
            bodyMat.diffuseColor = new BABYLON.Color3(0.33, 0.33, 0.33);
            body.material = bodyMat;
            body.position.y = 0.8;
            body.parent = protestorGroup;
            this.shadowGenerator.addShadowCaster(body);

            // Head
            const head = BABYLON.MeshBuilder.CreateBox("head", { width: 0.4, height: 0.4, depth: 0.4 }, this.scene);
            const headMat = new BABYLON.StandardMaterial("headMat", this.scene);
            headMat.diffuseColor = new BABYLON.Color3(1, 0.8, 0.67);
            head.material = headMat;
            head.position.y = 1.8;
            head.parent = protestorGroup;
            this.shadowGenerator.addShadowCaster(head);

            // Sign Stick
            const stick = BABYLON.MeshBuilder.CreateBox("stick", { width: 0.1, height: 1.5, depth: 0.1 }, this.scene);
            const stickMat = new BABYLON.StandardMaterial("stickMat", this.scene);
            stickMat.diffuseColor = new BABYLON.Color3(0.55, 0.27, 0.07);
            stick.material = stickMat;
            stick.position.set(0.4, 1.5, 0.2);
            stick.rotation.x = -0.2;
            stick.parent = protestorGroup;
            this.shadowGenerator.addShadowCaster(stick);

            // Sign Board
            const text = this.getProtestText(distance);
            let signMat = this.signMaterials[text];
            if (!signMat) {
                signMat = new BABYLON.StandardMaterial("signMat_" + text, this.scene);
                signMat.diffuseTexture = this.texGen.getSignTexture(text);
                this.signMaterials[text] = signMat;
            }

            const board = BABYLON.MeshBuilder.CreateBox("board", { width: 1.6, height: 1.0, depth: 0.1 }, this.scene);
            board.material = signMat;
            board.position.set(0.4, 2.3, 0.3);
            board.rotation.x = -0.2;
            board.parent = protestorGroup;
            this.shadowGenerator.addShadowCaster(board);

            protestorGroup.scaling.setAll(1.5);
            mesh = protestorGroup;

        } else if (typeRoll < 0.45) {
            // Taxi (Short, Jumpable)
            type = 'taxi';
            const taxiGroup = new BABYLON.TransformNode("taxi", this.scene);

            // Main Body
            const body = BABYLON.MeshBuilder.CreateBox("body", { width: 1.8, height: 0.7, depth: 3.5 }, this.scene);
            body.material = this.materials.bus; // Reusing bus texture or create taxi texture if needed, but code used 'taxi' texture
            // Let's ensure we have a taxi material if it was used in Three.js
            // The Three.js code used texGen.getTexture('taxi')
            let taxiMat = this.materials.taxi;
            if (!taxiMat) {
                taxiMat = new BABYLON.StandardMaterial("taxiMat", this.scene);
                taxiMat.diffuseTexture = this.texGen.getTexture('taxi');
                this.materials.taxi = taxiMat;
            }
            body.material = taxiMat;
            body.position.y = 0.35;
            body.parent = taxiGroup;
            this.shadowGenerator.addShadowCaster(body);

            // Cab Roof
            const cab = BABYLON.MeshBuilder.CreateBox("cab", { width: 1.6, height: 0.4, depth: 1.5 }, this.scene);
            const cabMat = new BABYLON.StandardMaterial("cabMat", this.scene);
            cabMat.diffuseColor = new BABYLON.Color3(1, 0.84, 0); // Gold/Yellow
            cab.material = cabMat;
            cab.position.y = 0.9;
            cab.parent = taxiGroup;
            this.shadowGenerator.addShadowCaster(cab);

            // Taxi Sign
            const sign = BABYLON.MeshBuilder.CreateBox("sign", { width: 0.6, height: 0.2, depth: 0.3 }, this.scene);
            const signMat = new BABYLON.StandardMaterial("signMat", this.scene);
            signMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
            signMat.emissiveColor = new BABYLON.Color3(0.66, 0.66, 0.66);
            sign.material = signMat;
            sign.position.y = 1.2;
            sign.parent = taxiGroup;

            // Wheels
            const wheelMat = new BABYLON.StandardMaterial("wheelMat", this.scene);
            wheelMat.diffuseColor = new BABYLON.Color3(0.07, 0.07, 0.07);

            const createWheel = (x, z) => {
                const w = BABYLON.MeshBuilder.CreateCylinder("wheel", { diameter: 0.6, height: 0.2, tessellation: 16 }, this.scene);
                w.rotation.z = Math.PI / 2;
                w.material = wheelMat;
                w.position.set(x, 0.3, z);
                w.parent = taxiGroup;
                this.shadowGenerator.addShadowCaster(w);
            };
            createWheel(-0.9, 1.2);
            createWheel(0.9, 1.2);
            createWheel(-0.9, -1.2);
            createWheel(0.9, -1.2);

            mesh = taxiGroup;

        } else if (typeRoll < 0.60) {
            // Halal Cart (Slide under)
            type = 'halal';
            const cartGroup = new BABYLON.TransformNode("halal", this.scene);

            // Main Box
            const box = BABYLON.MeshBuilder.CreateBox("box", { width: 2, height: 1.2, depth: 1.2 }, this.scene);
            const boxMat = new BABYLON.StandardMaterial("boxMat", this.scene);
            boxMat.diffuseColor = new BABYLON.Color3(0.75, 0.75, 0.75);
            boxMat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
            box.material = boxMat;
            box.position.y = 1.4;
            box.parent = cartGroup;
            this.shadowGenerator.addShadowCaster(box);

            // Wheels
            const wheelMat = new BABYLON.StandardMaterial("wheelMat", this.scene);
            wheelMat.diffuseColor = new BABYLON.Color3(0.07, 0.07, 0.07);
            const createWheel = (x, z) => {
                const w = BABYLON.MeshBuilder.CreateCylinder("wheel", { diameter: 0.6, height: 0.2, tessellation: 16 }, this.scene);
                w.rotation.z = Math.PI / 2;
                w.material = wheelMat;
                w.position.set(x, 0.3, z);
                w.parent = cartGroup;
                this.shadowGenerator.addShadowCaster(w);
            };
            createWheel(-0.8, 0.4);
            createWheel(0.8, 0.4);
            createWheel(-0.8, -0.4);
            createWheel(0.8, -0.4);

            // Legs
            const legMat = new BABYLON.StandardMaterial("legMat", this.scene);
            legMat.diffuseColor = new BABYLON.Color3(0.33, 0.33, 0.33);
            const createLeg = (x, z) => {
                const l = BABYLON.MeshBuilder.CreateBox("leg", { width: 0.1, height: 0.8, depth: 0.1 }, this.scene);
                l.material = legMat;
                l.position.set(x, 0.8, z);
                l.parent = cartGroup;
            };
            createLeg(-0.8, 0.4);
            createLeg(0.8, 0.4);
            createLeg(-0.8, -0.4);
            createLeg(0.8, -0.4);

            // Umbrella
            const pole = BABYLON.MeshBuilder.CreateCylinder("pole", { diameter: 0.05, height: 1.5 }, this.scene);
            const poleMat = new BABYLON.StandardMaterial("poleMat", this.scene);
            poleMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
            pole.material = poleMat;
            pole.position.set(0.5, 2.2, 0);
            pole.parent = cartGroup;

            const umbrella = BABYLON.MeshBuilder.CreateCylinder("umbrella", { diameterTop: 0, diameterBottom: 1.3, height: 0.5, tessellation: 8 }, this.scene);
            const umbrellaMat = new BABYLON.StandardMaterial("umbrellaMat", this.scene);
            umbrellaMat.diffuseColor = new BABYLON.Color3(1, 0, 0);
            umbrella.material = umbrellaMat;
            umbrella.position.set(0.5, 2.9, 0);
            umbrella.parent = cartGroup;

            mesh = cartGroup;

        } else if (typeRoll < 0.75) {
            // Scaffold (Duckable)
            type = 'scaffold';
            const scaffoldGroup = new BABYLON.TransformNode("scaffold", this.scene);

            const top = BABYLON.MeshBuilder.CreateBox("top", { width: 3, height: 0.2, depth: 2 }, this.scene);
            top.material = this.materials.scaffold;
            top.position.y = 2.0;
            top.parent = scaffoldGroup;
            this.shadowGenerator.addShadowCaster(top);

            const legMat = this.materials.scaffold;
            const createLeg = (x, z) => {
                const l = BABYLON.MeshBuilder.CreateBox("leg", { width: 0.2, height: 2, depth: 0.2 }, this.scene);
                l.material = legMat;
                l.position.set(x, 1, z);
                l.parent = scaffoldGroup;
                this.shadowGenerator.addShadowCaster(l);
            };
            createLeg(-1.4, 0.9);
            createLeg(1.4, 0.9);
            createLeg(-1.4, -0.9);
            createLeg(1.4, -0.9);

            mesh = scaffoldGroup;

        } else if (typeRoll < 0.85) {
            // Alcohol (Bad)
            type = 'alcohol';
            const bottleGroup = new BABYLON.TransformNode("alcohol", this.scene);

            const body = BABYLON.MeshBuilder.CreateCylinder("body", { diameter: 0.6, height: 0.8, tessellation: 16 }, this.scene);
            const glassMat = new BABYLON.StandardMaterial("glassMat", this.scene);
            glassMat.diffuseColor = new BABYLON.Color3(0.13, 0.55, 0.13);
            glassMat.alpha = 0.9;
            body.material = glassMat;
            body.position.y = 0.4;
            body.parent = bottleGroup;
            this.shadowGenerator.addShadowCaster(body);

            const neck = BABYLON.MeshBuilder.CreateCylinder("neck", { diameter: 0.2, height: 0.4, tessellation: 16 }, this.scene);
            neck.material = glassMat;
            neck.position.y = 1.0;
            neck.parent = bottleGroup;

            const cap = BABYLON.MeshBuilder.CreateCylinder("cap", { diameter: 0.24, height: 0.1, tessellation: 16 }, this.scene);
            const capMat = new BABYLON.StandardMaterial("capMat", this.scene);
            capMat.diffuseColor = new BABYLON.Color3(1, 0.84, 0);
            cap.material = capMat;
            cap.position.y = 1.25;
            cap.parent = bottleGroup;

            const label = BABYLON.MeshBuilder.CreateCylinder("label", { diameter: 0.62, height: 0.3, tessellation: 16 }, this.scene);
            const labelMat = new BABYLON.StandardMaterial("labelMat", this.scene);
            labelMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
            label.material = labelMat;
            label.position.y = 0.4;
            label.parent = bottleGroup;

            mesh = bottleGroup;

        } else {
            // Coin Group
            type = 'coin';
            const coinCount = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < coinCount; i++) {
                const coinMesh = BABYLON.MeshBuilder.CreateCylinder("coin", { diameter: 1, height: 0.1, tessellation: 16 }, this.scene);
                coinMesh.rotation.x = Math.PI / 2;
                coinMesh.material = this.materials.coin;
                coinMesh.position.y = 1;
                coinMesh.position.x = lane;
                coinMesh.position.z = zStart - (i * 2.5);
                this.shadowGenerator.addShadowCaster(coinMesh);

                this.obstacles.push({ mesh: coinMesh, type: 'coin' });
            }
            return;
        }

        mesh.position.x = lane;
        mesh.position.z = zStart;
        this.obstacles.push({ mesh, type });
    }

    checkCollisions(player) {
        // Simple AABB collision
        // Player is roughly 1x1x1 centered at position
        const playerMin = player.mesh.position.subtract(new BABYLON.Vector3(0.5, 0, 0.5));
        const playerMax = player.mesh.position.add(new BABYLON.Vector3(0.5, 2, 0.5));

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obj = this.obstacles[i];

            // Get object bounds
            // For simple meshes we can estimate, or use boundingInfo if available
            // Since we use TransformNodes for groups, we need to be careful.
            // Let's use a simplified distance/box check based on type

            let hit = false;
            const pos = obj.mesh.position;

            // Broad phase: check Z distance
            if (Math.abs(pos.z - player.mesh.position.z) < 1.5) {
                // Check X lane
                if (Math.abs(pos.x - player.mesh.position.x) < 1.0) {
                    // Check Y (for ducking/jumping)
                    // Player Y is 0 (ground) usually
                    // Obstacles like Scaffold are high up

                    if (obj.type === 'scaffold') {
                        // Hit if player is NOT sliding (sliding height < 1.0)
                        // But player logic handles sliding state. 
                        // Here we just report collision, main.js decides if it's a hit based on state?
                        // Actually main.js logic: if (subtype === 'scaffold' && isSliding) { // Safe }
                        // So we should report the collision if bounds intersect.
                        // Scaffold legs are at x +/- 1.4, player is at x=0.
                        // Player hits top bar if standing? Top bar is at y=2.0. Player height is 2.
                        // So yes, head hits.
                        hit = true;
                    } else if (obj.type === 'halal') {
                        // Halal cart box is at y=1.4 to 2.6.
                        // Player hits if standing.
                        hit = true;
                    } else {
                        // Normal obstacles
                        hit = true;
                    }
                }
            }

            if (hit) {
                if (obj.type === 'coin') {
                    obj.mesh.dispose();
                    this.obstacles.splice(i, 1);
                    return { type: 'coin' };
                } else {
                    return { type: 'obstacle', subtype: obj.type, index: i, mesh: obj.mesh };
                }
            }
        }
        return null;
    }
}
