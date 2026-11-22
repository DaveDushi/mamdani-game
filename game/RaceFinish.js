import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

// Seconds of rendered track time. The finale holds the raised hands for one beat before the city cut.
export const FINISH_HOLD = .65;
export const CITY_REVEAL = 1.35;
export const DANCE_HOLD = 3.15;
export const RACE_RUNOUT = .42;
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

function bindRotation(skeleton, bone) {
    const bind = skeleton.boneInverses[skeleton.bones.indexOf(bone)].clone().invert();
    return new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(bind));
}

const hingeAxis = new Vector3(0, 0, 1);
const heelAxis = new Vector3(1, 0, 0);

function modelPose(bone, figure, rotation, position) {
    rotation.copy(bone.quaternion);
    position.copy(bone.position);
    for (let parent = bone.parent; parent !== figure; parent = parent.parent) {
        position.applyQuaternion(parent.quaternion).add(parent.position);
        rotation.premultiply(parent.quaternion);
    }
}

class DanceLimb {
    constructor(figure, upper, lower, end, sign) {
        this.figure = figure;
        this.upper = upper;
        this.lower = lower;
        this.end = end;
        this.sign = sign;
        this.joints = [upper, lower, end].map(bone => ({ bone, start: new Quaternion() }));
        this.anchor = new Vector3();
        this.facing = new Quaternion();
        this.toe = end.children.find(bone => bone.name.endsWith('ToeBase'));
        this.liftedFacing = new Quaternion();
        this.origin = new Vector3();
        this.reach = new Vector3();
        this.bend = new Vector3();
        this.axisX = new Vector3();
        this.axisY = new Vector3();
        this.axisZ = new Vector3();
        this.basis = new Matrix4();
        this.rotation = new Quaternion();
        this.target = new Vector3();
        this.pole = new Vector3();
        this.a = lower.position.length();
        this.b = end.position.length();
    }

    start() {
        for (const { bone, start } of this.joints) start.copy(bone.quaternion);
        modelPose(this.end, this.figure, this.facing, this.anchor);
    }

    locate() {
        modelPose(this.upper.parent, this.figure, this.rotation, this.origin);
        this.origin.add(this.axisZ.copy(this.upper.position).applyQuaternion(this.rotation));
    }

    solve(target, pole) {
        const { a, b, reach, bend, axisX, axisY, axisZ } = this;
        reach.copy(target).sub(this.origin);
        const distance = MathUtils.clamp(reach.length(), Math.abs(a - b) + .0001, a + b - .0001);
        reach.normalize();
        bend.copy(pole).addScaledVector(reach, -pole.dot(reach)).normalize();
        const cosine = (a * a + distance * distance - b * b) / (2 * a * distance);
        const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
        axisX.copy(reach).multiplyScalar(cosine).addScaledVector(bend, sine);
        axisY.copy(bend).multiplyScalar(cosine).addScaledVector(reach, -sine);
        this.upper.quaternion.setFromRotationMatrix(this.basis.makeBasis(axisX, axisY, axisZ.crossVectors(axisX, axisY)))
            .premultiply(this.rotation.invert());
        this.lower.quaternion.setFromAxisAngle(hingeAxis, Math.acos(MathUtils.clamp(
            (a * a + b * b - distance * distance) / (2 * a * b), -1, 1
        )) - Math.PI);
    }

    holdFoot(heel) {
        this.locate();
        this.liftedFacing.setFromAxisAngle(heelAxis, .23 * heel).multiply(this.facing);
        // Roll about the toe joint so the heel can lift without dragging the shoe.
        this.target.copy(this.toe.position).applyQuaternion(this.facing).add(this.anchor)
            .sub(this.axisX.copy(this.toe.position).applyQuaternion(this.liftedFacing));
        this.solve(this.target, this.pole.set(this.sign * .15, 0, 1));
        modelPose(this.lower, this.figure, this.rotation, this.origin);
        this.end.quaternion.copy(this.liftedFacing).premultiply(this.rotation.invert());
    }

    pump(height, thrust, reachOut, blend, hand) {
        this.locate();
        // The low, chest, and high points describe a curved path in front of the body.
        const h = height, l = 1 - h;
        this.target.set(
            this.sign * (.16 * l * l - .96 * h * l + .01 * h * h + .22 * reachOut),
            -.57 * l * l - .69 * h * l + .29 * h * h,
            .44 * l * l + 1.64 * h * l + .49 * h * h + .11 * thrust - .12 * reachOut
        ).multiplyScalar(this.a + this.b).add(this.origin);
        this.pole.set(this.sign * (.08 + .42 * h * h * h), -.38 - .49 * h, -.83 + 1.08 * h);
        this.solve(this.target, this.pole);
        this.end.quaternion.copy(hand);
        for (const { bone, start } of this.joints) bone.quaternion.slerp(start, 1 - blend);
    }

    reset() {
        for (const { bone, start } of this.joints) bone.quaternion.copy(start);
    }
}

export class VictoryDance {
    constructor(figure) {
        this.figure = figure;
        this.rotation = new Quaternion();
        this.fingers = [];
        const { skeleton } = figure.getObjectByProperty('isSkinnedMesh', true);
        const rest = bone => bindRotation(skeleton, bone);
        this.hips = figure.getObjectByName('mixamorigHips');
        this.hipsStart = new Vector3();
        this.spine = figure.getObjectByName('mixamorigSpine1');
        this.spineStart = new Quaternion();
        const spineAxes = rest(this.spine).invert();
        this.swayAxis = new Vector3(0, 0, 1).applyQuaternion(spineAxes);
        this.turnAxis = new Vector3(0, 1, 0).applyQuaternion(spineAxes);
        this.head = figure.getObjectByName('mixamorigHead');
        this.headStart = new Quaternion();
        const headAxes = rest(this.head).invert();
        this.nodAxis = new Vector3(1, 0, 0).applyQuaternion(headAxes);
        this.lookAxis = new Vector3(0, 1, 0).applyQuaternion(headAxes);
        this.levelAxis = new Vector3(0, 0, 1).applyQuaternion(headAxes);
        this.feet = [];
        const curlAxis = new Vector3(0, 0, 1);
        this.arms = ['Left', 'Right'].map((side, index) => {
            const sign = index === 0 ? 1 : -1;
            const joint = name => figure.getObjectByName('mixamorig' + side + name);
            this.feet.push(new DanceLimb(figure, joint('UpLeg'), joint('Leg'), joint('Foot'), sign));
            for (const finger of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) {
                for (const segment of [1, 2, 3]) {
                    const bone = joint('Hand' + finger + segment);
                    const bind = rest(bone.parent).invert().multiply(rest(bone));
                    const curl = finger === 'Thumb' ? .38 : segment === 2 ? 1.29 : 1.06;
                    bind.multiply(new Quaternion().setFromAxisAngle(curlAxis, curl));
                    this.fingers.push({ bone, closed: bind, start: new Quaternion() });
                }
            }
            const hand = joint('Hand');
            return {
                limb: new DanceLimb(figure, joint('Arm'), joint('ForeArm'), hand, sign),
                wrist: rest(hand.parent).invert().multiply(rest(hand))
            };
        });
    }

    play(seconds, reducedMotion) {
        if (!this.active) {
            this.active = true;
            this.hipsStart.copy(this.hips.position);
            this.spineStart.copy(this.spine.quaternion);
            this.headStart.copy(this.head.quaternion);
            for (const foot of this.feet) foot.start();
            for (const { limb } of this.arms) limb.start();
            for (const { bone, start } of this.fingers) start.copy(bone.quaternion);
        }
        const time = reducedMotion ? 1.22 : seconds;
        const pulse = time * 2 * Math.PI / 1.03;
        // The weight transfer leads the hands. The second beat is a little shorter than the first.
        const phase = pulse + .18 * Math.sin(pulse) - .10 * Math.sin(.56 * pulse);
        const leftBeat = -Math.sin(phase + .14);
        const rightBeat = Math.sin(phase - .19);
        const lift = MathUtils.smoothstep(time, .93, 1.09) - MathUtils.smoothstep(time, 1.36, 1.54) +
            MathUtils.smoothstep(time, 1.98, 2.14) - MathUtils.smoothstep(time, 2.40, 2.60);
        const blend = reducedMotion ? 1 : MathUtils.smoothstep(seconds, 0, .18);
        const shift = .90 * Math.sin(phase + .46) * blend;
        const dip = (.48 + .38 * Math.cos(2 * phase + .8) + .08 * Math.sin(phase - .32)) * blend;
        const turn = Math.sin(phase - .38) * blend;
        this.hips.position.copy(this.hipsStart);
        this.hips.position.x += .125 * shift;
        this.hips.position.y -= .075 * dip;
        for (const foot of this.feet) {
            const unload = MathUtils.smoothstep(-foot.sign * shift, .03, .84);
            foot.holdFoot(unload * (.59 + .41 * Math.cos(2 * phase - .16)));
        }
        this.spine.quaternion.copy(this.spineStart)
            .multiply(this.rotation.setFromAxisAngle(this.swayAxis, -.23 * shift))
            .multiply(this.rotation.setFromAxisAngle(this.turnAxis, .26 * turn));
        // Let the eyes stay up while the shoulders roll underneath.
        const nod = (.026 + .048 * Math.cos(2 * phase - .45) - .037 * lift) * blend;
        this.head.quaternion.copy(this.headStart)
            .multiply(this.rotation.setFromAxisAngle(this.levelAxis, .12 * shift))
            .multiply(this.rotation.setFromAxisAngle(this.lookAxis, -.16 * turn - .07 * lift * blend))
            .multiply(this.rotation.setFromAxisAngle(this.nodAxis, nod));
        const { limb: left, wrist: leftWrist } = this.arms[0];
        const { limb: right, wrist: rightWrist } = this.arms[1];
        left.pump(MathUtils.lerp(.49 + .11 * leftBeat, .17 + .035 * leftBeat, lift),
            .55 * leftBeat, lift, blend, leftWrist);
        right.pump(MathUtils.lerp(.52 + .09 * rightBeat, .96 + .025 * rightBeat, lift),
            .49 * rightBeat, 0, blend, rightWrist);
        for (const { bone, start, closed } of this.fingers) bone.quaternion.slerpQuaternions(start, closed, blend);
    }

    reset() {
        if (!this.active) return;
        this.hips.position.copy(this.hipsStart);
        this.spine.quaternion.copy(this.spineStart);
        this.head.quaternion.copy(this.headStart);
        for (const foot of this.feet) foot.reset();
        for (const { limb } of this.arms) limb.reset();
        for (const { bone, start } of this.fingers) bone.quaternion.copy(start);
        this.active = false;
    }
}

export class WinnerPose {
    constructor(figure) {
        const { skeleton } = figure.getObjectByProperty('isSkinnedMesh', true);
        const rest = bone => bindRotation(skeleton, bone);
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
