import { AnimationClip, Euler, MathUtils, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';

const TAU = Math.PI * 2;
const identity = new Quaternion();
const origin = new Vector3();
const clipsBySource = new WeakMap();

// Forward reach, sole clearance and toe roll through one stride. The stance foot
// sweeps back under the pelvis before the heel lifts and the knee folds.
const footfall = [
    [.29, 0, -.20], [.105, 0, -.025], [-.10, 0, .12], [-.29, 0, .53],
    [-.38, .073, .96], [-.36, .20, 1.15], [-.23, .30, 1.01], [.015, .33, .63],
    [.23, .27, .22], [.38, .18, -.14], [.42, .10, -.29], [.395, .032, -.29]
];

function footAt(phase) {
    const n = footfall.length, index = phase * n, i = Math.floor(index), t = index - i;
    const a = footfall[(i + n - 1) % n], b = footfall[i % n], c = footfall[(i + 1) % n], d = footfall[(i + 2) % n];
    return b.map((v, k) => v + .5 * t * (c[k] - a[k] + t *
        (2 * a[k] - 5 * v + 4 * c[k] - d[k] + t * (3 * (v - c[k]) + d[k] - a[k]))));
}

// Each row has the pelvis height, lead and trailing [reach, clearance, pitch],
// lead and trailing upper-arm/forearm angles, and the chest pitch.
const leap = [
    [0, .82, [.19, .01, -.11], [-.17, 0, .50], [-.45, .90], [.18, 1.6], .18],
    [.14, .91, [.34, .24, -.12], [-.28, .01, .88], [-.76, .63], [.60, 2.20], .18],
    [.37, .92, [.43, .49, -.12], [-.21, .17, .85], [-.82, .52], [.70, 2.44], .15],
    [.58, .91, [.44, .32, -.24], [-.16, .16, .75], [-.60, .64], [.43, 2.10], .12],
    [.77, .87, [.30, .025, -.18], [-.10, .17, .62], [-.40, .85], [.24, 1.78], .13],
    [.87, .785, [.13, 0, .02], [-.16, .065, .57], [-.17, 1.04], [.16, 1.66], .29],
    [1, .88, [-.12, 0, .18], [.12, .23, .20], [.15, 1.68], [-.35, 1.03], .15]
];
const slide = [
    [0, .65, [.36, 0, -.17], [-.13, .015, .70], [.32, 1.77], [-.47, .44], .32],
    [.16, .36, [.59, 0, -.22], [-.22, .015, .96], [.55, 1.95], [-.69, -.01], .28],
    [.66, .33, [.62, 0, -.23], [-.22, .012, .93], [.47, 1.76], [-.66, .06], .21],
    [.85, .37, [.55, 0, -.14], [-.20, .012, .85], [.38, 1.84], [-.53, .31], .28],
    [1, .55, [.38, 0, -.08], [-.16, .015, .65], [.19, 1.55], [-.42, .63], .34]
];

const rotation = (x, y, z) => new Quaternion().setFromEuler(new Euler(x, y, z, 'YXZ'));
const vec = (x, y, z) => new Vector3(x, y, z);

class Joint {
    constructor(bone, rest, parent) {
        this.name = bone.name;
        this.offset = bone.position.clone();
        this.rest = rest;
        this.parent = parent;
        this.localBind = (parent?.rest || identity).clone().invert().multiply(rest);
        this.world = new Quaternion();
        this.point = new Vector3();
        this.values = [];
    }

    place() {
        this.point.copy(this.offset).applyQuaternion(this.parent?.world || identity).add(this.parent?.point || origin);
    }

    orient(q) {
        this.world.copy(q);
        const local = (this.parent?.world || identity).clone().invert().multiply(q);
        this.values.push(local.x, local.y, local.z, local.w);
    }

    bend(x, y, z) {
        this.orient(rotation(x, y, z).multiply(this.rest));
    }

    aim(child, direction) {
        const base = this.parent.world.clone().multiply(this.localBind);
        const axis = child.offset.clone().normalize().applyQuaternion(base);
        this.orient(new Quaternion().setFromUnitVectors(axis, direction.normalize()).multiply(base));
    }
}

// Bake the major joints into regular Three tracks once per skeleton. Fingers
// retain the source capture. Rendering uses the existing mixer for all outfits.
function bake(figure, source, mode, lead, scale) {
    const skin = figure.getObjectByProperty('isSkinnedMesh', true).skeleton;
    const restMatrix = new Matrix4(), joints = new Map();
    const joint = name => {
        if (joints.has(name)) return joints.get(name);
        const bone = figure.getObjectByName('mixamorig' + name);
        const parent = bone.parent.isBone ? joint(bone.parent.name.slice(9)) : null;
        restMatrix.copy(skin.boneInverses[skin.bones.indexOf(bone)]).invert();
        const rest = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(restMatrix));
        const j = new Joint(bone, rest, parent);
        joints.set(name, j);
        return j;
    };
    const hips = joint('Hips'), spine = joint('Spine'), waist = joint('Spine1'), chest = joint('Spine2');
    const neck = joint('Neck'), head = joint('Head');
    const limbs = [1, -1].map(sign => {
        const side = sign > 0 ? 'Left' : 'Right';
        const get = name => joint(side + name);
        return { sign, thigh: get('UpLeg'), shin: get('Leg'), ankle: get('Foot'), toe: get('ToeBase'),
            shoulder: get('Shoulder'), arm: get('Arm'), forearm: get('ForeArm'), hand: get('Hand'),
            finger: figure.getObjectByName('mixamorig' + side + 'HandMiddle1').position };
    });
    const times = [], positions = [];
    const frames = mode === 'run' ? Array.from({ length: 33 }, (_, n) => [n / 32]) : mode === 'jump' ? leap : slide;
    for (const [t, height, front, back, frontArm, backArm, pitch] of frames) {
        const running = mode === 'run', low = mode === 'slide';
        const beat = Math.cos((t + .06) * TAU);
        const yaw = running ? -.134 * beat : lead * (low ? -.22 : -.11);
        const roll = running ? -.033 * Math.cos((t - .075) * TAU) : lead * (low ? -.105 : -.032);
        const torso = running ? .135 - .027 * Math.cos((t - .09) * TAU * 2) : pitch;
        const x = running ? .028 * Math.cos((t - .075) * TAU) : lead * (low ? -.067 : -.02);
        hips.point.set(x, running ? .885 - .040 * Math.cos((t - .075) * TAU * 2) : height, low ? -.041 : 0).multiplyScalar(scale);
        positions.push(hips.point.x, hips.point.y, hips.point.z);
        times.push(t * source.duration);
        hips.bend(.025, yaw, roll);
        spine.place(); spine.bend(.028, yaw, roll);
        waist.place(); waist.bend(torso * .70, -.50 * yaw, -.27 * roll);
        chest.place(); chest.bend(torso, -yaw, -.61 * roll);
        neck.place(); neck.bend(torso * .63, -.74 * yaw, -.54 * roll);
        head.place(); head.bend(torso * .13, -.10 * yaw, -.17 * roll);

        for (const { sign, thigh, shin, ankle, toe, shoulder, arm, forearm, hand, finger } of limbs) {
            const p = (t + (sign < 0 ? .5 : 0)) % 1;
            const [z, lift, footPitch] = running ? footAt(p) : sign === lead ? front : back;
            // The boots extend beyond the toe joint. Roll around the outsole,
            // keeping either its front edge or heel on the track.
            const ankleHeight = .100 * Math.cos(footPitch) + Math.max(.205 * Math.sin(footPitch), -.09 * Math.sin(footPitch));
            const width = low ? (sign === lead ? .19 : .23) : .095 + (mode === 'jump' ? lift * .16 : 0);
            const foot = vec(sign * width, Math.max(0, lift) + ankleHeight + .010, z).multiplyScalar(scale);
            thigh.place();
            const aim = foot.clone().sub(thigh.point), a = shin.offset.length(), b = ankle.offset.length();
            const length = MathUtils.clamp(aim.length(), Math.abs(a - b) + .0001, a + b - .0001);
            aim.normalize();
            const along = (a * a - b * b + length * length) / (2 * length);
            const pole = vec(sign * (low ? .34 : .085), 0, 1);
            pole.addScaledVector(aim, -pole.dot(aim)).normalize();
            thigh.aim(shin, aim.clone().multiplyScalar(along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along))));
            shin.place(); shin.aim(ankle, foot.clone().sub(shin.point));
            ankle.place(); ankle.bend(footPitch, sign * (low ? .17 : .045), 0);
            toe.place(); toe.orient(ankle.world.clone().multiply(toe.localBind));

            shoulder.place();
            shoulder.bend(torso * .63, -.9 * yaw, -.55 * roll);
            const swing = -Math.cos((p + .06) * TAU);
            const upper = running ? -.14 + .70 * swing : (sign === lead ? frontArm : backArm)[0];
            const lower = running ? upper + 1.45 + .20 * swing : (sign === lead ? frontArm : backArm)[1];
            arm.place(); arm.aim(forearm, vec(sign * (low ? .32 : .14), -Math.cos(upper), Math.sin(upper)));
            forearm.place(); forearm.aim(hand, vec(-sign * .12, -Math.cos(lower), Math.sin(lower)));
            hand.place(); hand.aim({ offset: finger }, vec(-sign * .12, -Math.cos(lower - .10), Math.sin(lower - .10)));
        }
    }
    const tracks = [new VectorKeyframeTrack(hips.name + '.position', times, positions)];
    for (const j of joints.values()) tracks.push(new QuaternionKeyframeTrack(j.name + '.quaternion', times, j.values));
    const replaced = new Set(tracks.map(track => track.name));
    return new AnimationClip(mode + lead, source.duration, tracks.concat(source.tracks.filter(track => !replaced.has(track.name))));
}

export function movementClip(figure, source, mode = 'run', lead = 1) {
    let byRig = clipsBySource.get(source);
    if (!byRig) clipsBySource.set(source, byRig = new Map());
    // Each head, shoe and jacket has its own mesh-space inverse binds. Joint
    // spacing stays in character space, including on the shorter rival rigs.
    const leg = figure.getObjectByName('mixamorigLeftLeg').position.length();
    const shin = figure.getObjectByName('mixamorigLeftFoot').position.length();
    const key = mode + lead + ':' + leg.toFixed(4) + ':' + shin.toFixed(4);
    if (!byRig.has(key)) byRig.set(key, bake(figure, source, mode, lead, (leg + shin) / .802));
    return byRig.get(key);
}

// These small accents follow the actual lateral acceleration and street pace.
// Restore the mixer sample first: Three can skip a write on identical frames.
export class StreetBalance {
    constructor(figure, skin) {
        const joint = (name, x, y, z) => {
            const bone = figure.getObjectByName('mixamorig' + name);
            const axis = vec(x, y, z).transformDirection(skin.boneInverses[skin.bones.indexOf(bone)]);
            return { bone, axis, base: new Quaternion(), applied: false };
        };
        this.chest = joint('Spine2', 0, 1, 0);
        this.neck = joint('Neck', 0, 0, 1);
        this.leftHip = joint('LeftUpLeg', 0, 0, 1);
        this.rightHip = joint('RightUpLeg', 0, 0, 1);
        this.waist = joint('Spine1', 1, 0, 0);
        this.leftArm = joint('LeftArm', 1, 0, 0);
        this.rightArm = joint('RightArm', 1, 0, 0);
        this.joints = [this.chest, this.neck, this.leftHip, this.rightHip, this.waist, this.leftArm, this.rightArm];
        this.turn = new Quaternion();
    }

    restore() {
        for (const j of this.joints) {
            if (j.applied) j.bone.quaternion.copy(j.base);
            j.applied = false;
        }
    }

    tilt(joint, angle) {
        if (Math.abs(angle) < .001) return;
        joint.applied = true;
        joint.base.copy(joint.bone.quaternion);
        joint.bone.quaternion.multiply(this.turn.setFromAxisAngle(joint.axis, angle));
    }

    apply(bank, effort, phase, ground) {
        this.tilt(this.chest, .26 * bank);
        this.tilt(this.neck, -.15 * bank);
        this.tilt(this.leftHip, .19 * Math.max(0, bank) * ground);
        this.tilt(this.rightHip, .19 * Math.min(0, bank) * ground);
        const drive = effort * ground;
        const arm = .18 * drive * Math.cos(phase + .06 * TAU);
        this.tilt(this.waist, drive * .11);
        this.tilt(this.leftArm, arm);
        this.tilt(this.rightArm, -arm);
    }
}
