import { BoxGeometry, Color, InstancedMesh, MeshBasicMaterial, Object3D } from 'three';
import { dollyDepth, dollyWidth } from './StreetEncounterArt.js';
import { skillGateBounds } from './SkillGates.js';

export const busSeconds = 10;
const maxFare = 3, nose = -3.75, tail = 1.79, halfWidth = 1.06;
// Half-width, forward depth and impact color of unoccupied vehicles and worksite equipment.
const solids = {
    taxi: [.83,1.66,0xf3b52b], halal: [1.2,.8,0xb7bdaf], scaffold: [1.21,.8,0x6f967c],
    deliveryDolly: [dollyWidth,dollyDepth,0xd3a16c], signalBoom: [1.42,.4,0xf3ae49],
    fallenPlacard: [1.22,.45,0xd9bd8d], policeTape: [1.4,.35,0xe9c155]
};
for (const [key, dimensions] of Object.entries(skillGateBounds)) {
    solids[key] = [dimensions[0], dimensions[2], key === 'gateBlock' ? 0x48846c : 0xf09d4c];
}

// Intersect the bus and the obstacle during the same portion of a simulation tick.
function sweptContact(obj, width, depth, fromX, toX) {
    const p = obj.mesh.position;
    const dz = p.z - obj.previousZ;
    if (p.z < nose - depth || obj.previousZ > tail + depth) return false;
    const begin = dz ? Math.max(0,(nose-depth-obj.previousZ)/dz) : 0;
    const end = dz ? Math.min(1,(tail+depth-obj.previousZ)/dz) : 1;
    const obstacleX = obj.moving ? (obj.previousX ?? p.x) : p.x;
    const start = fromX - obstacleX;
    const dx = toX - p.x - start;
    const a = start + dx*begin, b = start + dx*end;
    return Math.min(a,b) < width + halfWidth && Math.max(a,b) > -width - halfWidth;
}

function clearBarrier(traffic, index) {
    const obj = traffic.obstacles[index];
    if (!obj.march) {
        traffic.remove(index);
        return;
    }
    // Keep the sidewalk march when the road tape breaks or the rider disembarks.
    obj.busBroken = true;
    for (const part of obj.mesh.children) part.visible = part === obj.march;
}

export class BusRide {
    constructor(scene, model) {
        this.model = model;
        scene.add(model);
        this.active = false;
        this.cameraBlend = 0;
        // One pooled draw for the broken panels. All pieces start at the actual contact point.
        this.fragments = new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),12);
        this.fragments.frustumCulled = false;
        this.fragments.count = 0;
        this.fragmentPose = new Object3D();
        this.fragmentColor = new Color();
        this.pieces = Array.from({length:12}, () => ({life:0}));
        this.fragments.setColorAt(0,this.fragmentColor);
        scene.add(this.fragments);
        this.model.visible = this.fragments.visible = false;
    }
    board(player) {
        if (this.active) return;
        this.active = this.model.visible = true;
        player.fastFreeBusTimer = busSeconds;
        this.earned = 0;
        this.lastX = this.model.position.x = player.mesh.position.x;
        player.mesh.position.y = player.ySpeed = player.slideTimer = player.buffer = 0;
        player.isGrounded = true;
        player.iceTimer = 0;
        player.mesh.visible = player.shadow.visible = false;
    }
    reset(player) {
        if (this.active) player.mesh.visible = player.shadow.visible = true;
        player.fastFreeBusTimer = 0;
        this.active = this.model.visible = this.fragments.visible = false;
        this.cameraBlend = this.fragments.count = 0;
        for (const part of this.pieces) part.life = 0;
    }
    burst(x,z,hex) {
        this.fragmentColor.setHex(hex);
        for (let j=0; j<4; j++) {
            const part = this.pieces.find(p => p.life <= 0);
            if (!part) break;
            const side = j % 2 ? 1 : -1;
            Object.assign(part,{x:x+side*.35,y:.75+j*.16,z,dx:side*(3.1+j*.32),
                dy:2.2+j*.39,dz:2+j*.54,angle:side*(.3+j),life:.58,
                color:this.fragmentColor.getHex(),w:.34+j*.035});
        }
    }
    updateFragments(dt) {
        let count = 0;
        const body = this.fragmentPose;
        for (const p of this.pieces) {
            if (p.life <= 0) continue;
            p.life -= dt;
            p.dy -= 11*dt;
            p.x += p.dx*dt; p.y += p.dy*dt; p.z += p.dz*dt;
            body.position.set(p.x,Math.max(.035,p.y),p.z);
            body.rotation.set(p.angle,p.life*6,p.angle+p.life*5);
            const scale = Math.min(1,Math.max(0,p.life)*8);
            body.scale.set(p.w*scale,.12*scale,.14*scale);
            body.updateMatrix();
            this.fragments.setMatrixAt(count,body.matrix);
            this.fragments.setColorAt(count++,this.fragmentColor.setHex(p.color));
        }
        this.fragments.count = count;
        this.fragments.visible = count > 0;
        if (count) this.fragments.instanceMatrix.needsUpdate = this.fragments.instanceColor.needsUpdate = true;
    }
    drive(dt, traffic, player, speed, reduced) {
        if (this.fragments.visible) this.updateFragments(dt);
        const x = player.mesh.position.x;
        this.model.position.x = x;
        this.model.rotation.y = reduced ? 0 : -.07 * player.bank;
        let fare = 0;
        for (let i=traffic.obstacles.length-1; i>=0; i--) {
            const obj = traffic.obstacles[i], p = obj.mesh.position;
            if (obj.type === 'protestor' || obj.type === 'horseCarriage') {
                // People and carriages give the driver the right of way at the curb.
                if (obj.busYieldX == null && p.z > -speed*1.25 && p.z < tail && Math.abs(p.x-x)<2.8) {
                    obj.busYieldX = p.x < 0 || (p.x === 0 && x >= 0) ? -5.6 : 5.6;
                    obj.busYieldStart = p.x;
                }
                if (obj.busYieldX != null) {
                    p.x += (obj.busYieldX-p.x)*(1-Math.exp(-5.5*dt));
                    if (obj.stencil) obj.stencil.position.x = obj.busYieldStart-p.x;
                }
                continue;
            }
            const solid = solids[obj.type];
            if (!solid || obj.busBroken || !sweptContact(obj,solid[0],solid[1],this.lastX,x)) continue;
            if (!reduced) {
                const contactX = Math.max(x-halfWidth,Math.min(x+halfWidth,p.x));
                this.burst(contactX,Math.max(nose,Math.min(tail,p.z)),solid[2]);
                this.fragments.visible = true;
            }
            if (this.earned < maxFare && !obj.gate?.busPaid) {
                this.earned++;
                fare++;
                if (obj.gate) obj.gate.busPaid = true;
            }
            clearBarrier(traffic,i);
        }
        this.lastX = x;
        return fare;
    }
    leave(traffic,player,speed) {
        const x = player.mesh.position.x, target = (player.currentLane-1)*3;
        // Clear only the disembarking lane and the short path to its center.
        // A street just outside this window stays playable and worth its ordinary reward.
        const left = Math.min(x,target)-.35, right = Math.max(x,target)+.35;
        for (let i=traffic.obstacles.length-1; i>=0; i--) {
            const obj = traffic.obstacles[i], p = obj.mesh.position;
            if (obj.busBroken || obj.type === 'coin' || obj.type === 'cue' || p.z > 2 || p.z < -speed*.78-2) continue;
            const width = solids[obj.type]?.[0] ?? .65;
            const endX = obj.type === 'deliveryDolly' ? obj.startX+obj.crossing : p.x;
            if (Math.min(p.x,endX)-width < right && Math.max(p.x,endX)+width > left) clearBarrier(traffic,i);
        }
        const blend = this.cameraBlend;
        this.reset(player);
        this.cameraBlend = blend;
    }
}
