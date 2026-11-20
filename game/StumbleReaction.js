import { BufferAttribute, MathUtils, Quaternion, Vector3 } from 'three';

const up = new Vector3(0, 1, 0);
const forward = new Vector3(0, 0, 1);
const duration = 1.40;
const ease = MathUtils.smoothstep;

// The street player's final pose layer. The face, including the tongue, is already skinned.
export class StumbleReaction {
    constructor(rig) {
        this.rig = rig;
        const face = rig.figure.getObjectByName('Body');
        const skeleton = face.skeleton;
        const joint = name => rig.figure.getObjectByName(name);
        const bindLocal = (bone, direction) =>
            direction.clone().transformDirection(skeleton.boneInverses[skeleton.bones.indexOf(bone)]);
        this.head = joint('mixamorigHead');
        this.faceAxis = bindLocal(this.head, forward);
        this.turn = [
            [joint('mixamorigSpine1'), .13], [joint('mixamorigSpine2'), .17],
            [joint('mixamorigNeck'), .30], [this.head, .40]
        ];
        this.jaw = joint('Bip01_MJaw');
        this.tongue = joint('Bip01_MTongue');
        // The atlas paints the inside of the mouth in shadow. Bring the protruding
        // tongue up to daylight without changing the lips, mustache or outfit.
        const weights = face.geometry.attributes.skinIndex;
        const colors = new Uint8Array(weights.count * 3).fill(1);
        const tongueIndex = skeleton.bones.indexOf(this.tongue);
        for (let i = 0; i < weights.count; i++) {
            if (weights.getX(i) === tongueIndex) colors.set([5, 3, 4], i * 3);
        }
        face.geometry.setAttribute('color', new BufferAttribute(colors, 3));
        face.material.vertexColors = true;
        face.material.needsUpdate = true;
        this.jawAxis = bindLocal(this.jaw, new Vector3(1, 0, 0));
        this.tongueAxis = bindLocal(this.tongue, new Vector3(1, 0, 0));
        this.extensionAxis = bindLocal(this.tongue.parent, forward);
        this.tonguePosition = new Vector3();
        this.tongueScale = new Vector3();
        this.samples = [...this.turn.map(([bone]) => bone), this.jaw, this.tongue]
            .map(bone => [bone, new Quaternion()]);
        this.rotation = new Quaternion();
        this.axis = new Vector3();
        this.reset();
    }

    restore(copy) {
        if (!this.applied) return;
        for (const [bone, sample] of this.samples) {
            const joint = copy ? copy.getObjectByName(bone.name) : bone;
            joint.quaternion.copy(sample);
        }
        const tongue = copy ? copy.getObjectByName(this.tongue.name) : this.tongue;
        tongue.position.copy(this.tonguePosition);
        tongue.scale.copy(this.tongueScale);
        if (!copy) this.applied = false;
    }

    reset() {
        this.restore();
        this.shoulder = 0;
        this.time = duration;
        this.framing = 0;
    }

    start(shoulder, reducedMotion) {
        // Commit to the pursuer's shoulder at impact. A lane change must never flip the neck.
        this.shoulder = shoulder;
        this.reduced = reducedMotion;
        this.time = 0;
    }

    update(dt) {
        if (this.time >= duration) return;
        const t = this.time = Math.min(duration, this.time + dt);
        if (t === duration) this.shoulder = 0;
        this.framing = this.reduced ? 0 : ease(t, 0, .50) * (1 - ease(t, .83, duration));
        const glance = ease(t, .04, .48) * (1 - ease(t, .87, 1.33));
        if (!glance) return;
        for (const [bone, sample] of this.samples) sample.copy(bone.quaternion);
        this.tonguePosition.copy(this.tongue.position);
        this.tongueScale.copy(this.tongue.scale);
        this.applied = true;

        this.head.getWorldQuaternion(this.rotation);
        this.axis.copy(this.faceAxis).applyQuaternion(this.rotation);
        const facing = Math.atan2(this.axis.x, -this.axis.z);
        const target = this.shoulder * (this.reduced ? 1.85 : 2.12);
        const yaw = -glance * MathUtils.clamp(target - facing, -2.18, 2.18);
        for (const [bone, share] of this.turn) {
            bone.getWorldQuaternion(this.rotation);
            this.axis.copy(up).applyQuaternion(this.rotation.invert());
            bone.rotateOnAxis(this.axis, yaw * share);
        }
        // The native tongue retracts behind the lips before the runner turns forward.
        if (this.rig.mask.visible) return;
        const mouth = ease(t, .31, .51) * (1 - ease(t, .83, 1.03));
        const out = ease(t, .39, .59) * (1 - ease(t, .78, .96));
        this.jaw.rotateOnAxis(this.jawAxis, .13 * mouth);
        this.tongue.position.addScaledVector(this.extensionAxis, .035 * out);
        this.tongue.rotateOnAxis(this.tongueAxis, .22 * out);
        this.tongue.scale.x *= 1 + 2.7 * out;
        this.tongue.scale.y *= 1 + 1.8 * out;
        this.tongue.scale.z *= 1 + .64 * out;
    }
}
