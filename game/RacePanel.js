import { RACE_POINTS, RACE_TOP_SPEED, RIVALS, takeoverPercent } from './FamilyRace.js';
import { raceDistance, racePoints } from './RaceSchedule.js';

const PADS = [-1, 0, 1];
const faults = { stop: 'Tripped!', side: 'Wrong pad', foot: 'Same foot' };
const labels = { tap: 'Tap fast', warn: 'Get ready', stop: 'Hands off', gold: 'Go all out' };
const hints = { feet: 'Left, right, left, right', side: 'Tap the lit pad' };
// Seconds each pad state holds in the preview on the ready screen.
const DEMO_HOLD = .9;
const demos = {
    junior: [['tap']],
    ivanka: [['tap'], ['gold']],
    eric: [['tap'], ['warn'], ['stop']],
    tiffany: [['side', 0], ['side', -1], ['side', 0], ['side', 1]],
    barron: [['feet', -1], ['feet', 1]],
    donald: [['tap'], ['warn'], ['stop'], ['feet', -1], ['feet', 1], ['gold']]
};
const keySides = { Space: 0, ArrowUp: 0, Enter: null, ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };

const markup = `
    <div class="race-standings">
        <header class="race-heading">
            <div class="race-heading-line">
                <span>Family race <span data-race="number"></span></span>
                <span data-race="milepost" title="Street milestone"></span>
            </div>
            <h2 id="race-opponent"></h2>
        </header>

        <div class="race-board" role="group" data-race="board">
            <div class="race-board-line">
                <span class="race-gap" data-race="gap"></span>
                <time data-race="time"></time>
            </div>
            <div class="race-lane race-lane-player">
                <b>You</b>
                <div class="race-track" aria-hidden="true"><i data-race="player-fill"></i></div>
                <span data-race="player-metres"></span>
            </div>
            <div class="race-lane race-lane-rival">
                <b>Rival</b>
                <div class="race-track" aria-hidden="true"><i data-race="rival-fill"></i></div>
                <span data-race="rival-metres"></span>
            </div>
            <div class="race-finish" aria-hidden="true"><span>0 m</span><span data-race="finish"></span></div>
        </div>
        <div class="race-takeover" role="status">
            <div><strong data-race="takeover-title"></strong><b data-race="takeover-percent"></b></div>
            <div class="takeover-track" aria-hidden="true"><i data-race="takeover-fill"></i></div>
            <span data-race="takeover-result"></span>
            <b data-race="prize"></b>
            <span data-race="form"></span>
        </div>
    </div>

    <div class="race-deck">
        <div class="race-photo" data-race="photo" role="status" hidden>
            <strong>Photo finish</strong><span data-race="photo-margin"></span>
        </div>
        <div class="race-calls" aria-hidden="true">
            <span class="race-combo" data-race="combo"></span>
            <strong class="race-verdict" data-race="verdict"></strong>
            <span class="race-cue" data-race="cue"></span>
        </div>
        <div class="race-pads" data-race="pads" aria-hidden="true">
            <i data-pad="-1">Left</i><i data-pad="0">Tap fast</i><i data-pad="1">Right</i>
        </div>
        <div class="race-tutorial" hidden>
            <div id="race-instructions">
                <strong data-race="line"></strong>
                <p data-race="rule"></p>
                <p data-race="instructions">Tap anywhere, or press Space or Up, as fast as you can. Holding counts once.</p>
            </div>
            <button class="race-button race-ready" type="button" aria-describedby="race-instructions">Start race</button>
        </div>
        <div class="race-command">
            <div class="race-call">
                <div role="status" class="race-signal" data-race="signal"></div>
                <div class="race-speed" data-race="speed" hidden>
                    <b data-race="speed-value"></b>
                    <span>m/s</span>
                </div>
                <div class="race-boost">
                    <span data-race="level"></span>
                    <div class="race-boost-track" aria-hidden="true"><i data-race="boost-fill"></i></div>
                </div>
            </div>
            <button class="race-button race-tap" type="button" aria-label="Tap fast to sprint" aria-describedby="race-keys">Tap fast</button>
            <button class="race-button race-continue" type="button" hidden>Continue</button>
            <span id="race-keys">Press Space or Up repeatedly</span>
        </div>
    </div>
    <div class="race-start" data-race="start" role="status" aria-atomic="true" hidden>
        <span data-race="start-rival"></span>
        <strong data-race="start-digit"></strong>
    </div>
`;

function write(element, text) {
    if (element.textContent !== text) element.textContent = text;
}

function fill(element, fraction) {
    element.style.transform = `scaleX(${fraction})`;
}

export class RacePanel {
    constructor(hud, onTap, onContinue, onReady) {
        this.hud = hud;
        this.onTap = onTap;
        this.onContinue = onContinue;
        this.paused = false;
        this.pressedKeys = new Set();
        this.element = document.createElement('section');
        this.element.className = 'race-panel';
        this.element.setAttribute('aria-labelledby', 'race-opponent');
        this.element.innerHTML = markup;
        this.element.hidden = true;
        this.nodes = Object.fromEntries(
            Array.from(this.element.querySelectorAll('[data-race]'), node => [node.dataset.race, node])
        );
        this.opponent = this.element.querySelector('#race-opponent');
        this.tapButton = this.element.querySelector('.race-tap');
        this.continueButton = this.element.querySelector('.race-continue');
        this.keyHint = this.element.querySelector('#race-keys');
        this.tutorial = this.element.querySelector('.race-tutorial');
        this.readyButton = this.element.querySelector('.race-ready');
        this.reduce = matchMedia('(prefers-reduced-motion: reduce)');
        this.pads = Array.from(this.nodes.pads.children);
        this.lastFaults = 0;
        hud.append(this.element, this.nodes.start);

        // iPhone smart zoom can move the finish button offscreen during repeated sprint taps.
        const keepTrackInView = event => {
            if (event.cancelable && !event.target.closest('.race-continue, .race-ready')) event.preventDefault();
        };
        for (const type of ['touchstart', 'touchend']) {
            this.element.addEventListener(type, keepTrackInView, { passive: false });
        }
        this.element.addEventListener('pointerdown', event => {
            if (event.button === 0) this.tap(this.side(event));
        });
        this.tapButton.addEventListener('click', event => {
            if (event.detail === 0 && !event.pointerType) this.tap(null);
        });
        this.continueButton.addEventListener('click', () => {
            if (!this.active || this.continueButton.hidden || this.continueButton.disabled) return;
            this.continueButton.disabled = true;
            this.onContinue();
        });
        this.readyButton.addEventListener('click', () => {
            if (this.active && !this.tutorial.hidden) onReady();
        });

        window.addEventListener('keydown', event => this.keydown(event), { capture: true });
        window.addEventListener('keyup', event => this.pressedKeys.delete(event.code), { capture: true });
        window.addEventListener('blur', () => this.pressedKeys.clear());
    }

    get active() {
        return !this.element.hidden && !this.paused && !this.hud.inert;
    }

    // A pad under the finger wins. Elsewhere the screen splits into halves or thirds.
    side(event) {
        const pad = event.target.closest?.('[data-pad]');
        if (pad) return Number(pad.dataset.pad);
        if (typeof event.clientX !== 'number') return null;
        const across = event.clientX / innerWidth;
        if (this.nodes.pads.dataset.mode === 'feet') return across < .5 ? -1 : 1;
        return across < 1 / 3 ? -1 : across > 2 / 3 ? 1 : 0;
    }

    tap(side) {
        if (this.active && this.element.dataset.phase === 'racing') this.onTap(side);
    }

    keydown(event) {
        const { code, target } = event;
        if ((target === this.continueButton || target === this.readyButton) && (code === 'Space' || code === 'Enter')) {
            if (this.pressedKeys.has(code) || event.repeat) event.preventDefault();
            return;
        }
        const raceKey = code in keySides && (code !== 'Enter' || target === this.tapButton);
        if (!this.active || !raceKey || event.altKey || event.ctrlKey || event.metaKey) return;
        if (this.element.dataset.phase === 'ready') return;
        if (target !== this.tapButton && target.closest?.('button, input, textarea, select, a, [contenteditable]')) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat || this.pressedKeys.has(code)) return;
        this.pressedKeys.add(code);
        this.tap(keySides[code]);
    }

    prepare(race, showInstructions) {
        const { rival, speedLevel } = race;
        write(this.opponent, rival.name);
        write(this.nodes['start-rival'], `Racing ${rival.name}`);
        write(this.nodes.line, rival.line);
        write(this.nodes.rule, rival.rule);
        this.nodes.instructions.hidden = !showInstructions;
        write(this.nodes.number, `${rival.index + 1}/${RIVALS.length}`);
        write(this.nodes.milepost, rival.record ? `Record ${racePoints(rival.target)}` : `Street ${raceDistance(rival.at)}`);
        this.demoFrom = performance.now();
        this.lastFaults = race.faults;
        this.nodes.photo.hidden = true;
        write(this.nodes.verdict, '');
        write(this.nodes.combo, '');
        write(this.nodes.cue, '');
        write(this.nodes.level, `${rival.metres} m sprint · Lv. ${speedLevel}`);
        write(this.nodes.finish, raceDistance(rival.metres));
        this.nodes.board.setAttribute('aria-label', `Positions in the ${rival.metres} m sprint`);
        this.continueButton.disabled = false;
        this.paint(race);
    }

    show(race, showInstructions) {
        if (this.lastRace !== race) this.prepare(race, showInstructions);
        this.element.hidden = false;
        this.hud.classList.add('is-racing');
        this.element.inert = false;
        this.paused = false;
        this.focusControl();
    }

    paint(race, finishReady = false) {
        if (finishReady && race.phase === 'won' && this.continueButton.disabled) {
            this.continueButton.disabled = false;
            if (this.active) this.continueButton.focus({ preventScroll: true });
        }
        const { phase, countdown, elapsed, playerProgress, rivalProgress, speed } = race;
        this.paintPads(race);
        // The clock stands still at the tape and between countdown digits.
        if (this.lastRace === race && this.element.dataset.phase === phase && this.lastTime === elapsed &&
            this.lastCount === countdown && this.lastSpeed === speed) return;
        this.lastRace = race;
        this.lastTime = elapsed;
        this.lastCount = countdown;
        this.lastSpeed = speed;
        const wasDone = this.done;
        this.setPhase(phase);
        const { nodes } = this;
        const playerMetres = race.distance;
        const rivalMetres = rivalProgress * race.rival.metres;
        const gap = playerMetres - rivalMetres;
        const ahead = gap >= 0.1;
        const separated = Math.abs(gap) >= 0.1;
        const lead = separated ? `${ahead ? 'Ahead' : 'Behind'} by ${Math.abs(gap).toFixed(1)} m` : 'Tied';
        write(nodes.gap, phase === 'intro' || phase === 'ready' ? 'At the line' : lead);
        nodes.gap.dataset.lead = !separated ? 'tied' : ahead ? 'ahead' : 'behind';
        const seconds = elapsed.toFixed(1);
        write(nodes.time, `${seconds} s`);
        if (nodes.time.dateTime !== `PT${seconds}S`) nodes.time.dateTime = `PT${seconds}S`;
        write(nodes['player-metres'], `${playerMetres.toFixed(1)} m`);
        write(nodes['rival-metres'], `${rivalMetres.toFixed(1)} m`);
        fill(nodes['player-fill'], playerProgress);
        fill(nodes['rival-fill'], rivalProgress);
        fill(nodes['boost-fill'], speed / RACE_TOP_SPEED);

        const showGo = phase === 'racing' && elapsed < 0.7;
        const startDigit = phase === 'intro' ? String(countdown) : showGo ? 'GO!' : '';
        const overlay = nodes.start;
        overlay.hidden = this.paused || !startDigit;
        overlay.dataset.go = String(showGo);
        if (nodes['start-digit'].textContent !== startDigit) {
            write(nodes['start-digit'], startDigit);
            if (startDigit && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
                nodes['start-digit'].animate(
                    [{ transform: 'scale(1.18)', opacity: .65 }, { transform: 'scale(1)', opacity: 1 }],
                    { duration: 200, easing: 'ease-out' }
                );
            }
        }

        const showSpeed = phase === 'racing';
        nodes.speed.hidden = !showSpeed;
        nodes.signal.hidden = !this.done;
        if (showSpeed) write(nodes['speed-value'], speed.toFixed(1));
        switch (phase) {
            case 'won':
                write(nodes.signal, 'You win');
                break;
            case 'lost':
                write(nodes.signal, `Beaten by ${Math.max(.1, race.rival.metres - race.distance).toFixed(1)} m`);
                break;
        }
        if (!wasDone && this.done) {
            const wins = race.rival.index + 1;
            const champion = phase === 'won' && wins === RIVALS.length;
            if (phase === 'won') {
                write(nodes['takeover-title'], champion ? 'Communist takeover' : 'City takeover');
                write(nodes['takeover-percent'], takeoverPercent(wins) + '%');
                fill(nodes['takeover-fill'], wins / RIVALS.length);
                write(nodes['takeover-result'], `${wins}/${RIVALS.length} beaten · won by ${race.margin.toFixed(2)} s`);
                write(nodes.prize, `+${race.rival.prize} stamps · +${RACE_POINTS} points`);
                write(nodes.form, `${race.taps} taps · best ${race.bestRate} a second`);
            }
            if (phase === 'won') write(this.continueButton, champion ? 'Run Overtime' : 'Back to street');
            this.continueButton.disabled = true;
            nodes.photo.hidden = !race.photoFinish;
            if (race.photoFinish) {
                write(nodes['photo-margin'], `${phase === 'won' ? 'You' : race.rival.name} by ${race.margin.toFixed(2)} s`);
                if (!this.reduce.matches) {
                    nodes.photo.animate([{ opacity: 0, transform: 'scale(1.2)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' });
                    this.element.animate([{ backgroundColor: '#fffc' }, { backgroundColor: '#fff0' }], { duration: 380, easing: 'ease-out' });
                }
            }
        }
    }

    paintPads(race) {
        const { nodes } = this;
        const ready = race.phase === 'ready';
        if (race.phase !== 'racing' && race.phase !== 'intro' && !ready) return;
        const demo = demos[race.rival.id];
        const step = ready && !this.reduce.matches ? Math.floor((performance.now() - this.demoFrom) / (1000 * DEMO_HOLD)) % demo.length : 0;
        // Reduced motion and the countdown hold the state that shows the trick.
        const still = race.phase === 'intro' ? race.windowAt(0)?.kind ?? 'tap' : demo.at(-1)[0];
        const mode = !ready ? race.phase === 'intro' ? still : race.mode : this.reduce.matches ? still : demo[step][0];
        const pad = ready ? demo[this.reduce.matches ? demo.length - 1 : step][1] ?? 0 : race.pad;
        const next = ready ? null : race.nextPad;
        const aimed = mode === 'side' || mode === 'feet';
        if (nodes.pads.dataset.mode !== mode) nodes.pads.dataset.mode = mode;
        for (const node of this.pads) {
            const side = Number(node.dataset.pad);
            const look = aimed ? side === pad ? 'on' : side === next ? 'next' : '' : side === 0 ? mode : '';
            if (node.className !== look) node.className = look;
            if (side === 0) write(node, aimed ? 'Middle' : labels[mode]);
        }
        const lean = String(race.leaning);
        if (nodes.pads.dataset.lean !== lean) nodes.pads.dataset.lean = lean;
        if (ready) return;
        const { element } = this;
        if (element.dataset.mode !== mode) {
            element.dataset.mode = mode;
            write(this.tapButton, labels[mode] ?? 'Tap fast');
            write(this.keyHint, mode === 'feet' ? 'Left and Right arrows in turn' : mode === 'side'
                ? 'Left arrow, Space or Right arrow' : mode === 'stop' ? 'Do not press anything' : 'Press Space or Up repeatedly');
        }
        write(nodes.cue, race.leaning ? 'Lean!' : race.cue || hints[mode] || '');
        write(nodes.combo, race.rate > 1 ? `${race.rate} taps/s` : '');
        if (race.faults !== this.lastFaults) {
            this.lastFaults = race.faults;
            this.announce(race);
        }
    }

    announce(race) {
        const { verdict } = this.nodes;
        write(verdict, faults[race.fault]);
        this.verdictMotion?.cancel();
        this.verdictMotion = verdict.animate(this.reduce.matches
            ? [{ opacity: 1 }, { opacity: 1, offset: .75 }, { opacity: 0 }]
            : [{ opacity: 1, transform: 'scale(1.22)' }, { opacity: 1, transform: 'none', offset: .22 },
                { opacity: 1, transform: 'none', offset: .7 }, { opacity: 0, transform: 'translateY(-7px)' }],
        { duration: 620, easing: 'ease-out', fill: 'forwards' });
    }

    setPhase(phase) {
        if (phase === this.element.dataset.phase) return;
        this.element.dataset.phase = phase;
        this.tutorial.hidden = phase !== 'ready';
        this.tapButton.setAttribute('aria-disabled', String(phase !== 'racing'));
        this.tapButton.hidden = this.keyHint.hidden = this.done;
        this.continueButton.hidden = phase !== 'won';
    }

    get done() {
        const phase = this.element.dataset.phase;
        return phase === 'won' || phase === 'lost';
    }

    setPaused(paused) {
        if (this.paused === paused) return;
        this.paused = paused;
        this.element.inert = paused;
        this.nodes.start.hidden = paused || !this.nodes['start-digit'].textContent;
        if (!paused && this.active) this.focusControl();
    }

    focusControl() {
        const button = this.done ? this.continueButton : this.tutorial.hidden ? this.tapButton : this.readyButton;
        if (!button.hidden && !button.disabled) button.focus({ preventScroll: true });
    }

    hide() {
        this.element.hidden = true;
        this.nodes.start.hidden = true;
        this.element.inert = true;
        delete this.element.dataset.phase;
        this.hud.classList.remove('is-racing');
    }
}
