import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

export class ObstacleManager {
    constructor(scene, player, powerupManager) {
        this.scene = scene;
        this.player = player;
        this.powerupManager = powerupManager;
        this.obstacles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 2.0; // Seconds between spawns
        this.texGen = new TextureGenerator();

        // Geometries
        this.busGeo = new THREE.BoxGeometry(2, 3, 6);
        this.barrierGeo = new THREE.BoxGeometry(2, 1, 1);
        this.scaffoldGeo = new THREE.BoxGeometry(2.5, 0.5, 2); // Overhead
        this.coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
        this.coinGeo.rotateX(Math.PI / 2);

        // Materials
        this.busMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('bus') });
        this.barrierMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('barrier') });
        this.scaffoldMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('scaffold') });
        this.coinMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('coin'), metalness: 0.8, roughness: 0.2 });
    }

    reset() {
        // Clear existing
        this.obstacles.forEach(obj => this.scene.remove(obj.mesh));
        this.obstacles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 2.0;
    }

    update(dt, speed) {
        // Spawning
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnObstacle();
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
                this.scene.remove(obj.mesh);
                this.obstacles.splice(i, 1);
            }
        }
    }

    spawnObstacle() {
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

        if (typeRoll < 0.15) {
            // Bus (Tall, must dodge)
            type = 'bus';
            const busGroup = new THREE.Group();

            // Main Body
            const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 6), new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('bus') }));
            body.position.y = 1.5;
            busGroup.add(body);

            // Roof
            const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 5.8), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
            roof.position.y = 2.8;
            busGroup.add(roof);

            // Wheels
            const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
            wheelGeo.rotateZ(Math.PI / 2);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

            const w1 = new THREE.Mesh(wheelGeo, wheelMat); w1.position.set(-1.1, 0.4, 2); busGroup.add(w1);
            const w2 = new THREE.Mesh(wheelGeo, wheelMat); w2.position.set(1.1, 0.4, 2); busGroup.add(w2);
            const w3 = new THREE.Mesh(wheelGeo, wheelMat); w3.position.set(-1.1, 0.4, -2); busGroup.add(w3);
            const w4 = new THREE.Mesh(wheelGeo, wheelMat); w4.position.set(1.1, 0.4, -2); busGroup.add(w4);

            // Bumpers
            const bumperGeo = new THREE.BoxGeometry(2.2, 0.3, 0.2);
            const bumperMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const frontBumper = new THREE.Mesh(bumperGeo, bumperMat); frontBumper.position.set(0, 0.5, 3); busGroup.add(frontBumper);
            const backBumper = new THREE.Mesh(bumperGeo, bumperMat); backBumper.position.set(0, 0.5, -3); busGroup.add(backBumper);

            // Lights
            const lightGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
            const headLightMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00 });
            const tailLightMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000 });

            const hl1 = new THREE.Mesh(lightGeo, headLightMat); hl1.position.set(-0.7, 0.8, 3.05); busGroup.add(hl1);
            const hl2 = new THREE.Mesh(lightGeo, headLightMat); hl2.position.set(0.7, 0.8, 3.05); busGroup.add(hl2);

            const tl1 = new THREE.Mesh(lightGeo, tailLightMat); tl1.position.set(-0.7, 0.8, -3.05); busGroup.add(tl1);
            const tl2 = new THREE.Mesh(lightGeo, tailLightMat); tl2.position.set(0.7, 0.8, -3.05); busGroup.add(tl2);

            mesh = busGroup;
        } else if (typeRoll < 0.35) {
            // Taxi (Short, Jumpable)
            type = 'taxi';
            const taxiGroup = new THREE.Group();

            // Main Body (Lowered)
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 3.5), new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('taxi') }));
            body.position.y = 0.35;
            taxiGroup.add(body);

            // Cab Roof (Lowered)
            const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.5), new THREE.MeshStandardMaterial({ color: 0xffd700 })); // Gold/Yellow
            cab.position.y = 0.9;
            taxiGroup.add(cab);

            // Taxi Sign (Lowered)
            const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaaaaaa }));
            sign.position.y = 1.2;
            taxiGroup.add(sign);

            // Wheels
            const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
            wheelGeo.rotateZ(Math.PI / 2);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
            const w1 = new THREE.Mesh(wheelGeo, wheelMat); w1.position.set(-0.9, 0.3, 1.2); taxiGroup.add(w1);
            const w2 = new THREE.Mesh(wheelGeo, wheelMat); w2.position.set(0.9, 0.3, 1.2); taxiGroup.add(w2);
            const w3 = new THREE.Mesh(wheelGeo, wheelMat); w3.position.set(-0.9, 0.3, -1.2); taxiGroup.add(w3);
            const w4 = new THREE.Mesh(wheelGeo, wheelMat); w4.position.set(0.9, 0.3, -1.2); taxiGroup.add(w4);

            // Bumpers
            const bumperGeo = new THREE.BoxGeometry(1.8, 0.2, 0.1);
            const bumperMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
            const fb = new THREE.Mesh(bumperGeo, bumperMat); fb.position.set(0, 0.2, 1.8); taxiGroup.add(fb);
            const bb = new THREE.Mesh(bumperGeo, bumperMat); bb.position.set(0, 0.2, -1.8); taxiGroup.add(bb);

            // Lights
            const lightGeo = new THREE.BoxGeometry(0.2, 0.1, 0.05);
            const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc });
            const tlMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000 });

            const h1 = new THREE.Mesh(lightGeo, hlMat); h1.position.set(-0.6, 0.4, 1.82); taxiGroup.add(h1);
            const h2 = new THREE.Mesh(lightGeo, hlMat); h2.position.set(0.6, 0.4, 1.82); taxiGroup.add(h2);

            const t1 = new THREE.Mesh(lightGeo, tlMat); t1.position.set(-0.6, 0.4, -1.82); taxiGroup.add(t1);
            const t2 = new THREE.Mesh(lightGeo, tlMat); t2.position.set(0.6, 0.4, -1.82); taxiGroup.add(t2);

            mesh = taxiGroup;
        } else if (typeRoll < 0.5) {
            // Halal Cart (Slide to heal)
            type = 'halal';
            const cartGeo = new THREE.Group();
            const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1), new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('halal') }));
            base.position.y = 0.75;
            cartGeo.add(base);
            const umbrella = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
            umbrella.position.y = 1.8;
            cartGeo.add(umbrella);
            mesh = cartGeo;
        } else if (typeRoll < 0.8) {
            // Scaffold (Duckable)
            type = 'scaffold';
            const scaffoldGroup = new THREE.Group();
            // Top bar
            const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 2), this.scaffoldMat);
            top.position.y = 2.0; // Height to slide under (Player slide height < 1)
            scaffoldGroup.add(top);
            // Legs
            const legGeo = new THREE.BoxGeometry(0.2, 2, 0.2);
            const l1 = new THREE.Mesh(legGeo, this.scaffoldMat); l1.position.set(-1.4, 1, 0.9); scaffoldGroup.add(l1);
            const l2 = new THREE.Mesh(legGeo, this.scaffoldMat); l2.position.set(1.4, 1, 0.9); scaffoldGroup.add(l2);
            const l3 = new THREE.Mesh(legGeo, this.scaffoldMat); l3.position.set(-1.4, 1, -0.9); scaffoldGroup.add(l3);
            const l4 = new THREE.Mesh(legGeo, this.scaffoldMat); l4.position.set(1.4, 1, -0.9); scaffoldGroup.add(l4);

            mesh = scaffoldGroup;
        } else {
            // Coin
            type = 'coin';
            mesh = new THREE.Mesh(this.coinGeo, this.coinMat);
            mesh.position.y = 1;
        }

        mesh.position.x = lane;
        mesh.position.z = zStart;
        mesh.castShadow = true;
        this.scene.add(mesh);

        this.obstacles.push({ mesh, type });
    }

    checkCollisions(player) {
        const playerBox = new THREE.Box3().setFromObject(player.mesh);
        playerBox.expandByScalar(-0.2); // Forgiving hitbox

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obj = this.obstacles[i];
            const objBox = new THREE.Box3().setFromObject(obj.mesh);

            if (playerBox.intersectsBox(objBox)) {
                if (obj.type === 'coin') {
                    this.scene.remove(obj.mesh);
                    this.obstacles.splice(i, 1);
                    return { type: 'coin' };
                } else {
                    // Return specific obstacle type for handling in main.js
                    // Don't remove immediately if it's a solid hit, let main handle it
                    // But for Halal/Scaffold we might want to remove or pass
                    return { type: 'obstacle', subtype: obj.type, index: i, mesh: obj.mesh };
                }
            }
        }
        return null;
    }
}
