import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];

        // reuse geometry/material for performance
        this.geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    }

    reset() {
        this.particles.forEach(p => this.scene.remove(p.mesh));
        this.particles = [];
    }

    spawnParticles(position, count, color, speed = 1) {
        const mat = this.mat.clone();
        mat.color.setHex(color);

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.geo, mat);
            mesh.position.copy(position);

            // Random spread
            mesh.position.x += (Math.random() - 0.5) * 0.5;
            mesh.position.y += (Math.random() - 0.5) * 0.5;
            mesh.position.z += (Math.random() - 0.5) * 0.5;

            // Random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2 * speed,
                (Math.random() * 2 + 1) * speed, // Upward bias
                (Math.random() - 0.5) * 2 * speed
            );

            this.scene.add(mesh);
            this.particles.push({ mesh, velocity, life: 1.0 });
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
                continue;
            }

            // Physics
            p.velocity.y -= 9.8 * dt; // Gravity
            p.mesh.position.addScaledVector(p.velocity, dt);
            p.mesh.rotation.x += dt;
            p.mesh.rotation.y += dt;
            p.mesh.scale.setScalar(p.life); // Shrink over time
        }
    }
}
