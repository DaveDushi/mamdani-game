import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

// Seconds of rendered track time. The finale holds the raised hands for one beat before the city cut.
export const FINISH_HOLD = .65;
export const CITY_REVEAL = 1.35;
const LIFT_SECONDS = .40;

// The record can be claimed inside a tunnel. Cut to a visible city block while the runner's
// actual position stays frozen at the Overtime restart point.
export function frameOpenBlock(camera, blocks) {
    let nearestZ = -Infinity;
    for (const { group } of blocks) {
        const z = group.position.z;
        if (group.visible && z <= 0 && z > nearestZ) nearestZ = z;
    }
    if (nearestZ === -Infinity) return;
    camera.position.set(0, 4.8, nearestZ - 2);
    camera.lookAt(0, 3.0, nearestZ - 35);
}

function aimJoint(parent, localBind, axis, x, y, z) {
    const rotation = parent.clone().multiply(localBind);
    const from = axis.clone().applyQuaternion(rotation);
    return rotation.premultiply(new Quaternion().setFromUnitVectors(from, new Vector3(x, y, z).normalize()));
}

export class WinnerPose {
    constructor(figure) {
        const { skeleton } = figure.getObjectByProperty('isSkinnedMesh', true);
        const rest = bone => {
            const bind = skeleton.boneInverses[skeleton.bones.indexOf(bone)].clone().invert();
            return new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(bind));
        };
        this.joints = [];
        this.shoulders = [];
        this.toChest = new Quaternion();
        for (const side of ['Left', 'Right']) {
            const sign = side === 'Left' ? 1 : -1;
            const joint = name => figure.getObjectByName('mixamorig' + side + name);
            let elbowParent = rest(joint('Shoulder').parent), raisedParent = elbowParent;
            // Lift the collar, lead with the elbows, then extend the forearms and wrists.
            // Carry each joint's bind twist through the chain, including the shorter female rig.
            for (const [name, child, elbow, high] of [
                ['Shoulder', 'Arm', [.99, .05, .09], [.98, .19, .03]],
                ['Arm', 'ForeArm', [.91, .16, .30], [.61, .79, -.04]],
                ['ForeArm', 'Hand', [.15, .82, .55], [.27, .94, .20]],
                ['Hand', 'HandMiddle1', [.12, .84, .51], [.19, .97, .13]]
            ]) {
                const bone = joint(name);
                const localBind = rest(bone.parent).invert().multiply(rest(bone));
                const axis = joint(child).position.clone().normalize();
                const middle = aimJoint(elbowParent, localBind, axis, sign * elbow[0], elbow[1], elbow[2]);
                const top = aimJoint(raisedParent, localBind, axis, sign * high[0], high[1], high[2]);
                const target = {
                    bone, start: new Quaternion(),
                    bent: elbowParent.clone().invert().multiply(middle),
                    raised: raisedParent.clone().invert().multiply(top)
                };
                this.joints.push(target);
                if (name === 'Shoulder') this.shoulders.push({ target, middle, top });
                elbowParent = middle;
                raisedParent = top;
            }
        }
        this.active = false;
        this.held = false;
    }

    lift(seconds, reducedMotion) {
        if (this.held) return;
        if (!this.active) {
            // The finishing stride twists the chest. Keep both fists above the crown in either lane.
            this.shoulders[0].target.bone.parent.getWorldQuaternion(this.toChest).invert();
            for (const { target, middle, top } of this.shoulders) {
                target.bent.multiplyQuaternions(this.toChest, middle);
                target.raised.multiplyQuaternions(this.toChest, top);
            }
        }
        const bend = MathUtils.smoothstep(seconds, 0, .24);
        const extend = reducedMotion ? 1 : MathUtils.smoothstep(seconds, .11, LIFT_SECONDS);
        for (const { bone, start, bent, raised } of this.joints) {
            if (!this.active) start.copy(bone.quaternion);
            bone.quaternion.slerpQuaternions(start, bent, bend).slerp(raised, extend);
        }
        this.active = true;
        this.held = extend === 1;
    }

    reset() {
        if (!this.active) return;
        // The mixer caches its last sample and may skip writing an identical stride on a replay.
        for (const { bone, start } of this.joints) bone.quaternion.copy(start);
        this.active = false;
        this.held = false;
    }
}
