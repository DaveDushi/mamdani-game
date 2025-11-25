import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

export class ObstacleManager {
    constructor(scene, player, powerupManager) {
        this.scene = scene;
        this.player = player;
        this.powerupManager = powerupManager;
        this.obstacles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1.5; // Seconds between spawns
        this.texGen = new TextureGenerator();

        // Geometries
        this.busGeo = new THREE.BoxGeometry(2, 3, 6);
        this.barrierGeo = new THREE.BoxGeometry(2, 1, 1);
        this.scaffoldGeo = new THREE.BoxGeometry(2.5, 0.5, 2); // Overhead
        this.coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
        this.coinGeo.rotateX(Math.PI / 2);
        this.potholeGeo = new THREE.CylinderGeometry(1, 1, 0.05, 16);
        this.alcoholGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);

        // Materials
        this.busMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('bus') });
        this.barrierMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('barrier') });
        this.scaffoldMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('scaffold') });
        this.coinMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('coin'), metalness: 0.8, roughness: 0.2 });
        this.potholeMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('pothole'), transparent: true, opacity: 0.9 });
        this.alcoholMat = new THREE.MeshStandardMaterial({ map: this.texGen.getTexture('alcohol') });

        this.signMaterials = {}; // Cache for sign materials
    }

    reset() {
        // Clear existing
        this.obstacles.forEach(obj => this.scene.remove(obj.mesh));
        this.obstacles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1.5;
        this.signMaterials = {}; // Optional: clear cache on reset if we want to free memory, but keeping it is fine too.
    }

    clear() {
        this.obstacles.forEach(obj => {
            if (obj.type !== 'coin') {
                this.scene.remove(obj.mesh);
            }
        });
        this.obstacles = this.obstacles.filter(obj => obj.type === 'coin');
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
                this.scene.remove(obj.mesh);
                this.obstacles.splice(i, 1);
            }
        }
    }

    getProtestText(distance) {
        if (distance < 1000) {
            const texts = ["No more taxes", "Free Market", "Trump is King"];
            return texts[Math.floor(Math.random() * texts.length)];
        } else if (distance < 2000) {
            const texts = ["Tax the rich", "Free Healthcare", "Abolish ICE"];
            return texts[Math.floor(Math.random() * texts.length)];
        } else {
            const texts = ["Intifada Revolution", "Dictator Mamdani", "Comrads Unite", "MAO is the best"];
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
            const protestorGroup = new THREE.Group();

            // Body
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x555555 }));
            body.position.y = 0.8;
            protestorGroup.add(body);

            // Head
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xffccaa }));
            head.position.y = 1.8;
            protestorGroup.add(head);

            // Sign Stick
            const stick = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
            stick.position.set(0.4, 1.5, 0.2);
            stick.rotation.x = -0.2;
            protestorGroup.add(stick);

            // Sign Board
            const text = this.getProtestText(distance);
            let signMat = this.signMaterials[text];
            if (!signMat) {
                signMat = new THREE.MeshStandardMaterial({ map: this.texGen.getSignTexture(text) });
                this.signMaterials[text] = signMat;
            }

            // Made sign bigger (1.6x1.0) and group scaled up
            const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.1), signMat);
            board.position.set(0.4, 2.3, 0.3); // Adjusted position for larger board
            board.rotation.x = -0.2;
            protestorGroup.add(board);

            protestorGroup.scale.set(1.5, 1.5, 1.5); // Scale up the whole protestor
            mesh = protestorGroup;

        } else if (typeRoll < 0.45) {
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
        } else if (typeRoll < 0.60) {
            // Halal Cart (Slide under)
            type = 'halal';
            const cartGeo = new THREE.Group();

            // Main Box (Silver/Metal)
            const boxGeo = new THREE.BoxGeometry(2, 1.2, 1.2);
            const boxMat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.8, roughness: 0.2 });
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.y = 1.4; // Raised high enough to slide under (Player slide height ~0.7)
            cartGeo.add(box);

            // Wheels (to hold it up)
            const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
            wheelGeo.rotateZ(Math.PI / 2);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

            const w1 = new THREE.Mesh(wheelGeo, wheelMat); w1.position.set(-0.8, 0.3, 0.4); cartGeo.add(w1);
            const w2 = new THREE.Mesh(wheelGeo, wheelMat); w2.position.set(0.8, 0.3, 0.4); cartGeo.add(w2);
            const w3 = new THREE.Mesh(wheelGeo, wheelMat); w3.position.set(-0.8, 0.3, -0.4); cartGeo.add(w3);
            const w4 = new THREE.Mesh(wheelGeo, wheelMat); w4.position.set(0.8, 0.3, -0.4); cartGeo.add(w4);

            // Legs/Supports connecting wheels to box
            const legGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const l1 = new THREE.Mesh(legGeo, legMat); l1.position.set(-0.8, 0.8, 0.4); cartGeo.add(l1);
            const l2 = new THREE.Mesh(legGeo, legMat); l2.position.set(0.8, 0.8, 0.4); cartGeo.add(l2);
            const l3 = new THREE.Mesh(legGeo, legMat); l3.position.set(-0.8, 0.8, -0.4); cartGeo.add(l3);
            const l4 = new THREE.Mesh(legGeo, legMat); l4.position.set(0.8, 0.8, -0.4); cartGeo.add(l4);

            // Umbrella (Colorful)
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5), new THREE.MeshStandardMaterial({ color: 0xffffff }));
            pole.position.set(0.5, 2.2, 0);
            cartGeo.add(pole);

            const umbrellaGeo = new THREE.ConeGeometry(1.3, 0.5, 8);
            const umbrellaMat = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red umbrella
            const umbrella = new THREE.Mesh(umbrellaGeo, umbrellaMat);
            umbrella.position.set(0.5, 2.9, 0);
            cartGeo.add(umbrella);

            // Details (Grill/Food)
            const grill = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1), new THREE.MeshStandardMaterial({ color: 0x111111 }));
            grill.position.set(0, 2.01, 0);
            cartGeo.add(grill);

            mesh = cartGeo;
        } else if (typeRoll < 0.75) {
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
        } else if (typeRoll < 0.85) {
            // Alcohol (Bad, inverts controls)
            type = 'alcohol';
            const bottleGroup = new THREE.Group();

            // Bottle Body (Green Glass)
            const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 16);
            const glassMat = new THREE.MeshStandardMaterial({
                color: 0x228B22, // Forest Green
                transparent: true,
                opacity: 0.9,
                roughness: 0.1,
                metalness: 0.3
            });
            const body = new THREE.Mesh(bodyGeo, glassMat);
            body.position.y = 0.4;
            bottleGroup.add(body);

            // Bottle Neck
            const neckGeo = new THREE.CylinderGeometry(0.1, 0.3, 0.4, 16);
            const neck = new THREE.Mesh(neckGeo, glassMat);
            neck.position.y = 1.0;
            bottleGroup.add(neck);

            // Cap (Gold)
            const capGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16);
            const capMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2 });
            const cap = new THREE.Mesh(capGeo, capMat);
            cap.position.y = 1.25;
            bottleGroup.add(cap);

            // Label (White paper)
            const labelGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.4, 16, 1, true, 0, Math.PI); // Half cylinder for front label
            const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const label = new THREE.Mesh(labelGeo, labelMat);
            label.position.set(0, 0.4, 0.01); // Slightly forward
            label.rotation.y = -Math.PI / 2; // Face forward? No, default cylinder faces Z? 
            // Cylinder default: Y up. 
            // We want label on +Z face (facing camera).
            // Cylinder geometry is around Y axis.
            // We want the half-cylinder to wrap around the front.
            // Let's just use a full cylinder slightly larger for simplicity, or stick to simple band.
            // Simple band:
            const bandGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.3, 16);
            const band = new THREE.Mesh(bandGeo, labelMat);
            band.position.y = 0.4;
            bottleGroup.add(band);

            mesh = bottleGroup;
        } else {
            // Coin Group (High chance)
            type = 'coin';
            // Spawn a group of coins
            const coinCount = 3 + Math.floor(Math.random() * 3); // 3 to 5 coins
            for (let i = 0; i < coinCount; i++) {
                const coinMesh = new THREE.Mesh(this.coinGeo, this.coinMat);
                coinMesh.position.y = 1;
                coinMesh.position.x = lane;
                coinMesh.position.z = zStart - (i * 2.5); // Spaced out
                coinMesh.castShadow = true;
                this.scene.add(coinMesh);
                this.obstacles.push({ mesh: coinMesh, type: 'coin' });
            }
            return; // Already added to obstacles, so return
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
