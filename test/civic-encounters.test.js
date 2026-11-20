import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Group, Scene } from 'three';
import { ObstacleManager } from '../game/ObstacleManager.js';
import { Player } from '../game/Player.js';
import { civicModels } from '../game/CivicEncounters.js';
import { createCivicSchedule } from '../game/CivicSchedule.js';
import { courseSpeed, streetCourse } from '../game/Course.js';

const models = civicModels();
function street(reducedMotion = false) {
    return Object.assign(Object.create(ObstacleManager.prototype), {
        scene: new Scene(), obstacles: [], models, reducedMotion,
        pool: Object.fromEntries(Object.keys(models).map(key => [key, []])), nextRow: { distance: Infinity }
    });
}

function runner(x = 0) {
    const mesh = new Group();
    mesh.position.x = x;
    return { mesh, slideTimer: 0, invincible: false };
}

test('a candidate consumes the course RNG only when it fills a free slot', () => {
    let draws = 0;
    const select = createCivicSchedule(() => { draws++; return .5; });
    for (let m=0; m<2700; m++) assert.equal(select(m), null);
    assert.equal(draws, 0);
    assert.equal(select(2700), 'horse-carriage');
    assert.equal(select(2700), null);
    assert.equal(select(4150), 'protest-line');
    assert.equal(select(4150), null);
    assert.equal(draws, 2);
});

test('carriage moves down the signed lane, rings once and resets both wheel axles in the pool', () => {
    for (const x of [-3,0,3]) for (const reduced of [false,true]) {
        const s=street(reduced), p=runner(x===0?3:0);
        const spawn = () => s.add('horseCarriage',x,-155,'route',1,{approachSpeed:93.5});
        const c=spawn();
        const start=c.carriage.position.z, spin=c.frontWheels.rotation.x, rear=c.backWheels.rotation.x;
        assert.equal(c.stencil.position.z,93.5*.69);
        assert.equal(c.stencil.visible,true);
        c.mesh.updateMatrixWorld(true);
        const hull=new Box3().setFromObject(c.carriage,true);
        assert.ok(hull.min.x>=x-1.35 && hull.max.x<=x+1.35,JSON.stringify(hull));
        let rings=0;
        for(let i=0;i<180;i++) {
            s.update(1/90,93.5,(i+1)*93.5/90);
            rings+=Number(s.carriageBell);
            assert.equal(s.checkCollisions(p),null);
            assert.equal(s.lastStunt,null);
        }
        assert.equal(rings,1);
        assert.ok(c.carriage.position.z>start+4);
        assert.equal(c.frontWheels.rotation.x===spin,reduced);
        assert.equal(c.backWheels.rotation.x===rear,reduced);
        assert.equal(spawn(),c);
        assert.equal(c.frontWheels.rotation.x,spin);
        assert.equal(c.backWheels.rotation.x,rear);
        assert.equal(c.bellRang,false);
    }
});

test('standing, jumping and ducking produce the advertised contact across phone frame rates', () => {
    for (const hz of [20,30,60,120]) for (const speed of [37,90.2,93.5]) {
        for (const [key,x,y,duck,hit,move] of [
            ['horseCarriage',0,0,false,true],['horseCarriage',0,1.59,false,true],
            ['horseCarriage',3,0,false,false],['policeTape',0,0,false,true],
            ['policeTape',0,0,true,false,'slide'],['policeTape',1.33,0,true,true],
            ['fallenPlacard',0,0,true,true],['fallenPlacard',0,1.38,false,false,'jump']
        ]) {
            const s=street(), p=runner(x), awards=[], hits=[];
            p.mesh.position.y=y;
            p.slideTimer=duck?.40:0;
            s.add(key,0,-.37*speed,'route',1,{approachSpeed:speed});
            for(let tick=1; tick/hz<.64; tick++) {
                s.update(1/hz,speed,speed*tick/hz);
                const outcome=s.checkCollisions(p);
                if(outcome) hits.push(outcome);
                if(s.lastStunt) awards.push(s.lastStunt);
            }
            assert.deepEqual(hits,hit?[key]:[],[key,x,y,hz,speed].join(' '));
            assert.deepEqual(awards,move?[move]:[]);
        }
    }
});

function seeded(seed) {
    return () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}

test('both shifts reserve complete protest pairs and introduce and vary the civic encounters', () => {
    for (const mode of ['day','night']) for (const overtime of [false,true]) {
        const mirrored=new Set(), carriageLanes=new Set();
        for (const seed of [19,52,87]) {
            const rows=[];
            for (const row of streetCourse(seeded(seed),mode,()=>overtime)) {
                if(row.distance>90000) break;
                rows.push(row);
            }
            const lanes=rows.filter(r=>r.lanes);
            const carriage=lanes.filter(r=>r.encounter?.id==='horse-carriage');
            const tapes=lanes.filter(r=>r.encounter?.beat==='tape');
            assert.ok(carriage.length>=5 && tapes.length>=5);
            for(const r of carriage) {
                const occupied=r.lanes.indexOf('horseCarriage');
                assert.equal(Math.abs(occupied-r.exitLane),1);
                assert.ok(!r.lanes[r.exitLane] || r.lanes[r.exitLane]==='exit');
                carriageLanes.add(occupied);
            }
            for(const [i,r] of tapes.entries()) {
                const rowIndex=rows.indexOf(r), laneIndex=lanes.indexOf(r);
                const next=rows[rowIndex+1], after=lanes[laneIndex+2], prev=lanes[laneIndex-1];
                if(!after) continue;
                assert.equal(next.encounter?.beat,'placard');
                assert.equal(r.gate,'slide');
                assert.equal(next.gate,'jump');
                const dx=next.lanes.indexOf('jumpGate')-r.lanes.indexOf('slideGate');
                assert.ok(Math.abs(dx)<=1);
                if(i===0) assert.equal(dx,0);
                else mirrored.add(dx);
                const seconds=(a,b)=>(b.distance-a.distance)/(courseSpeed(b.distance,mode)*(overtime?1.1:1));
                assert.ok(seconds(prev,r)>=1.045);
                assert.ok(seconds(r,next)>=1.145);
                assert.ok(seconds(next,after)>=.945);
            }
        }
        assert.deepEqual([...carriageLanes].sort(),[0,1,2]);
        assert.ok(mirrored.has(-1) && mirrored.has(1));
    }
});

test('late mirrored police lines clear with real lane, duck and jump timing at both Overtime caps', () => {
    const noOp = () => {};
    for (const mode of ['day','night']) {
        const source = streetCourse(seeded(52),mode,()=>true);
        let tape, placard;
        for (const r of source) {
            if (r.distance > 180000) assert.fail('No late mirrored pair');
            if (r.distance < 60000 || r.encounter?.beat !== 'tape') continue;
            tape=r;
            placard=source.next().value;
            if (tape.lanes.indexOf('slideGate') !== placard.lanes.indexOf('jumpGate')) break;
        }
        const speed = courseSpeed(60000,mode)*1.1;
        const firstLane = tape.lanes.indexOf('slideGate'), secondLane = placard.lanes.indexOf('jumpGate');
        for (const hz of [20,30,60,120]) for (const jumpAt of [.30,.40]) {
            const s=street(), dt=1/hz, awards=[], hits=[];
            const p=Object.assign(Object.create(Player.prototype), {
                mesh:new Group(), shadow:Object.assign(new Group(),{material:{}}), flagAura:{}, bottleStars:{},
                rig:{pose:noOp,wear:noOp,material:{emissive:{setHex:noOp,setRGB:noOp}}},
                stumble:{reset:noOp,restore:noOp,update:noOp}
            });
            p.reset();
            p.currentLane=firstLane;
            p.mesh.position.x=(firstLane-1)*3;
            let distance=tape.distance-speed*1.35;
            s.add('policeTape',p.mesh.position.x,distance-tape.distance,'route',1,tape.encounter);
            s.add('fallenPlacard',(secondLane-1)*3,distance-placard.distance,'route',1,placard.encounter);
            let ducked=false, jumped=false;
            while (distance < placard.distance+speed*.9) {
                const keys=new Set();
                if (!ducked && tape.distance-distance<=speed*.26) { keys.add('down'); ducked=true; }
                const timeToPlacard=(placard.distance-distance)/speed;
                if (timeToPlacard<=.55 && p.currentLane!==secondLane) keys.add(firstLane<secondLane?'right':'left');
                if (!jumped && timeToPlacard<=jumpAt) { keys.add('up'); jumped=true; }
                p.update(dt,{isJustPressed:key=>keys.delete(key)},speed);
                distance+=speed*dt;
                s.update(dt,speed,distance);
                const hit=s.checkCollisions(p);
                if (hit) hits.push(hit);
                if (s.lastStunt) awards.push(s.lastStunt);
            }
            assert.deepEqual(hits,[],[mode,hz,jumpAt].join(' '));
            assert.deepEqual(awards,['slide','jump']);
            assert.equal(p.isGrounded,true);
            assert.equal(p.currentLane,secondLane);
        }
    }
});
