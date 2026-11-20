import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.limit = 80;
        this.count = 0;
        this.mesh = new THREE.InstancedMesh(
            new THREE.BoxGeometry(0.075, 0.044, 0.026),
            new THREE.MeshBasicMaterial(),
            this.limit
        );
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.setColorAt(0, new THREE.Color(0xffffff));
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        this.bits = Array.from({ length: this.limit }, () => ({
            body: new THREE.Object3D(),
            v: new THREE.Vector3(),
            life: 0,
            color: new THREE.Color()
        }));
    }
    reset() {
        this.count = this.mesh.count = 0;
    }
    spawnParticles(position, count, color, speed = 1) {
        for (let n = 0; n < count && this.count < this.limit; n++) {
            const bit = this.bits[this.count++];
            bit.body.position.copy(position);
            bit.color.set(color);
            bit.v
                .set((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 3)
                .multiplyScalar(speed);
            bit.body.rotation.set(Math.random() * 3, 0, Math.random() * 3);
            bit.life = 0.32 + Math.random() * 0.24;
        }
    }
    update(dt) {
        for (let i = this.count - 1; i >= 0; i--) {
            const bit = this.bits[i];
            bit.life -= dt;
            if (bit.life <= 0) {
                this.count--;
                this.bits[i] = this.bits[this.count];
                this.bits[this.count] = bit;
                continue;
            }
            bit.v.y -= 10 * dt;
            bit.body.position.addScaledVector(bit.v, dt);
            bit.body.rotation.z += dt * 4;
            bit.body.scale.setScalar(Math.min(1, bit.life * 6));
            bit.body.updateMatrix();
        }
        this.mesh.count = this.count;
        for (let i = 0; i < this.count; i++) {
            this.mesh.setMatrixAt(i, this.bits[i].body.matrix);
            this.mesh.setColorAt(i, this.bits[i].color);
        }
        if (this.count) {
            this.mesh.instanceMatrix.needsUpdate = true;
            this.mesh.instanceColor.needsUpdate = true;
        }
    }
}
