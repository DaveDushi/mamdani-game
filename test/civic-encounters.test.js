import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Group, Scene } from 'three';
import { ObstacleManager } from '../game/ObstacleManager.js';
import { Player } from '../game/Player.js';
import { civicModels } from '../game/CivicEncounters.js';
import { createCivicSchedule, createStretchSchedule } from '../game/CivicSchedule.js';
import { carriagePace } from '../game/HorseCarriage.js';
import { stretchThemes } from '../game/Stretches.js';
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
    const select = createCivicSchedule(() => { draws++; return .5; }, 500);
    for (let m=0; m<500; m++) assert.equal(select(m), false);
    assert.equal(draws, 0);
    assert.equal(select(500), true);
    assert.equal(select(500), false);
    assert.equal(select(1775), true);
    assert.equal(select(4150), false);
    assert.equal(draws, 2);
});

test('the stretch schedule deals every theme each round, never twice running, one level up per visit', () => {
    for (let seed = 1; seed <= 200; seed++) {
        const next = createStretchSchedule(seeded(seed * 0x9e3779b9));
        let last;
        for (let round = 1; round <= 8; round++) {
            const dealt = new Set();
            for (let i = 0; i < stretchThemes.length; i++) {
                const { theme, level } = next();
                assert.equal(level, round);
                assert.notEqual(theme, last);
                dealt.add(last = theme);
            }
            assert.equal(dealt.size, stretchThemes.length);
        }
    }
});

test('carriage gallops at the runner well above street pace, rings once and resets in the pool', () => {
    for (const speed of [30,60,93.5]) assert.ok(carriagePace(speed) >= speed*.5);
    for (const x of [-3,0,3]) for (const reduced of [false,true]) {
        const s=street(reduced), p=runner(x===0?3:0);
        const spawn = () => s.add('horseCarriage',x,-153,1,{approachSpeed:93.5});
        const c=spawn();
        const start=c.carriage.position.z, spin=c.frontWheels.rotation.x, rear=c.backWheels.rotation.x;
        assert.equal(c.stencil.position.z,93.5*.95);
        assert.equal(c.stencil.visible,true);
        assert.equal(c.merge.visible,false);
        c.mesh.updateMatrixWorld(true);
        const hull=new Box3().setFromObject(c.carriage,true);
        assert.ok(hull.min.x>=x-1.35 && hull.max.x<=x+1.35,JSON.stringify(hull));
        let rings=0, bellAt=0, closing=Infinity;
        const swings=c.legs.map(()=>new Set()), strides=new Set();
        for(let i=0;i<180;i++) {
            const before=c.mesh.position.z+c.carriage.position.z;
            s.update(1/90,93.5,(i+1)*93.5/90);
            if(c.mesh.position.z<0) closing=Math.min(closing,(c.mesh.position.z+c.carriage.position.z-before)*90);
            if(s.carriageBell) { rings++; bellAt=c.mesh.position.z/93.5; }
            c.legs.forEach((leg,n)=>swings[n].add(leg.rotation.x.toFixed(2)));
            strides.add(c.horse.position.y.toFixed(2));
            assert.equal(s.checkCollisions(p),null);
            assert.equal(s.lastStunt,null);
        }
        assert.equal(rings,1);
        assert.ok(bellAt<-1.4,String(bellAt));
        assert.ok(closing>93.5*1.5,String(closing));
        assert.ok(c.carriage.position.z>start+60);
        assert.equal(swings.every(set=>set.size>15),!reduced);
        assert.equal(strides.size>6,!reduced);
        assert.equal(c.dust.visible,!reduced);
        assert.equal(c.frontWheels.rotation.x===spin,reduced);
        assert.equal(c.backWheels.rotation.x===rear,reduced);
        assert.equal(spawn(),c);
        assert.equal(c.frontWheels.rotation.x,spin);
        assert.equal(c.backWheels.rotation.x,rear);
        assert.equal(c.bellRang,false);
    }
});

test('a merging horse paints its turn, finishes it early and then hits only the lane it took', () => {
    for (const hz of [20,30,60,120]) for (const speed of [30,62,93.5]) for (const [from,to] of [[0,1],[1,0],[1,2],[2,1]]) {
        for (let lane=0; lane<3; lane++) {
            const s=street(), p=runner((lane-1)*3);
            const c=s.add('horseCarriage',(to-1)*3,-1.65*speed,1,{id:'horse-carriage',lane:to,fromLane:from,approachSpeed:speed});
            assert.equal(c.merge.visible,true);
            assert.equal(c.mesh.position.x+c.merge.position.x,(from-1)*3);
            // The painted arrow bends the way the horse will.
            assert.equal(Math.sign(c.merge.scale.x),Math.sign(to-from));
            assert.ok(Math.abs(c.mesh.position.x+c.carriage.position.x-(from-1)*3)<1e-9);
            const hits=[];
            for(let tick=1; tick/hz<2; tick++) {
                s.update(1/hz,speed,speed*tick/hz);
                if(c.mesh.position.z/speed>=-.67) {
                    assert.ok(Math.abs(c.carriage.position.x)<1e-9);
                    assert.ok(Math.abs(Math.abs(c.carriage.rotation.y)-.19)<1e-9);
                }
                const hit=s.checkCollisions(p);
                if(hit) hits.push(hit);
            }
            assert.deepEqual(hits,lane===to?['horseCarriage']:[],[hz,speed,from,to,lane].join(' '));
            s.clear();
            const plain=s.add('horseCarriage',3,-155,1,{approachSpeed:93.5});
            assert.equal(plain,c);
            assert.equal(plain.merge.visible,false);
            assert.equal(plain.carriage.position.x,0);
        }
    }
});

test('the charge gives the same verdict at 20 Hz as at 2,000 Hz for a still or crossing runner', () => {
    let hits=0, misses=0;
    for (const speed of [30,93.5]) for (const drift of [-14,-6,0,6,14]) for (const x of [-1.9,-1.35,-.6,0,.6,1.35,1.9]) {
        const verdict=hz=>{
            const s=street(), p=runner();
            const c=s.add('horseCarriage',0,-.4*speed,1,{approachSpeed:speed});
            p.mesh.position.x=x-.4*drift;
            s.checkCollisions(p);
            for(let tick=1; tick<=hz*.5; tick++) {
                s.update(1/hz,speed,speed*tick/hz);
                p.mesh.position.x=x+drift*(tick/hz-.4);
                if(s.checkCollisions(p)) return true;
            }
            assert.ok(c.mesh.position.z>0);
            return false;
        };
        const exact=verdict(2000);
        if(exact) hits++; else misses++;
        for(const hz of [20,60,120]) assert.equal(verdict(hz),exact,[speed,drift,x,hz].join(' '));
    }
    assert.ok(hits>20 && misses>10,hits+' '+misses);
});

test('standing, jumping and ducking produce the advertised contact across phone frame rates', () => {
    for (const hz of [20,30,60,120]) for (const speed of [37,90.2,93.5]) {
        for (const [key,x,y,duck,hit,move] of [
            ['horseCarriage',0,0,false,true],['horseCarriage',0,1.59,false,true],['horseCarriage',0,0,true,true],
            ['horseCarriage',3,0,false,false],['policeTape',0,0,false,true],
            ['policeTape',0,0,true,false,'slide'],['policeTape',1.33,0,true,true],
            ['fallenPlacard',0,0,true,true],['fallenPlacard',0,1.38,false,false,'jump']
        ]) {
            const s=street(), p=runner(x), awards=[], hits=[];
            p.mesh.position.y=y;
            p.slideTimer=duck?.40:0;
            s.add(key,0,-.37*speed,1,{approachSpeed:speed});
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

test('horses and police lines keep their road clear and their routes reachable through both shifts', () => {
    for (const mode of ['day','night']) for (const overtime of [false,true]) {
        const beats=new Set(), carriageLanes=new Set(), styles=new Set(), turns=new Set();
        for (const seed of [19,52,87]) {
            const rows=[];
            for (const row of streetCourse(seeded(seed),mode,()=>overtime)) {
                if(row.distance>90000) break;
                rows.push(row);
            }
            const lanes=rows.filter(r=>r.lanes);
            const carriage=lanes.filter(r=>r.encounter?.id==='horse-carriage');
            const march=lanes.filter(r=>r.encounter?.id==='protest-line');
            assert.ok(carriage.length>=40 && march.length>=40);
            assert.ok(carriage[0].distance < 1200);
            assert.ok(carriage.every(r=>r.encounter.fromLane===undefined || r.distance>1500));
            for(const r of carriage) {
                const next=rows[rows.indexOf(r)+1];
                const occupied=[0,1,2].filter(lane=>r.lanes[lane]==='horseCarriage');
                assert.ok(occupied.includes(r.encounter.lane));
                assert.equal(r.lanes[r.exitLane],null);
                assert.equal(Math.abs(r.encounter.lane-r.exitLane),1);
                styles.add(occupied.length===2?'team':r.encounter.fromLane===undefined?'charge':'merge');
                if(occupied.length===2) assert.ok(r.stretch.id==='carriage' && r.stretch.level>=3);
                if(r.encounter.fromLane!==undefined) {
                    assert.equal(Math.abs(r.encounter.fromLane-r.encounter.lane),1);
                    assert.equal(occupied.length,1);
                }
                for(const lane of occupied) carriageLanes.add(lane);
                if(!next?.lanes) continue;
                // Nothing may be standing where the horse is when that row comes into view.
                const speed=r.encounter.approachSpeed, sight=Math.max(83,speed*1.65);
                const gap=next.distance-r.distance, horse=carriagePace(speed)*Math.max(0,sight-gap)/speed;
                assert.ok(gap-horse>2.6,`${mode} ${r.distance} ${gap} ${horse}`);
            }
            for(const [i,r] of lanes.entries()) {
                if(r.encounter?.id!=='protest-line' || !lanes[i+1]) continue;
                beats.add(r.encounter.beat);
                assert.equal(r.gate,r.encounter.beat==='tape'?'slide':'jump');
                assert.equal(r.stretch.id,'protest');
                const seconds=(a,b)=>(b.distance-a.distance)/(courseSpeed(b.distance,mode)*(overtime?1.1:1));
                assert.ok(seconds(lanes[i-1],r)>=.64);
                const next=lanes[i+1];
                assert.ok(seconds(r,next)>=.64);
                if(r.encounter.beat==='tape' && next.encounter?.beat==='placard') {
                    turns.add(next.lanes.indexOf('jumpGate')-r.lanes.indexOf('slideGate'));
                }
            }
        }
        assert.deepEqual([...carriageLanes].sort(),[0,1,2]);
        assert.deepEqual([...styles].sort(),['charge','merge','team']);
        assert.deepEqual([...beats].sort(),['placard','tape']);
        assert.deepEqual([...turns].sort((a,b)=>a-b),[-1,0,1]);
    }
});

test('late mirrored police lines clear with real lane, duck and jump timing at both Overtime caps', () => {
    const noOp = () => {};
    for (const mode of ['day','night']) {
        const source = streetCourse(seeded(52),mode,()=>true);
        let tape, placard;
        for (const r of source) {
            if (r.distance > 180000) assert.fail('No late mirrored pair');
            if (r.distance < 60000) continue;
            placard = tape && r.encounter?.beat === 'placard' ? r : null;
            if (placard && tape.lanes.indexOf('slideGate') !== placard.lanes.indexOf('jumpGate')) break;
            tape = r.encounter?.beat === 'tape' ? r : null;
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
            s.add('policeTape',p.mesh.position.x,distance-tape.distance,1,tape.encounter);
            s.add('fallenPlacard',(secondLane-1)*3,distance-placard.distance,1,placard.encounter);
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
