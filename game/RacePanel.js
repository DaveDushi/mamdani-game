import { RACE_TOP_SPEED, RIVALS, takeoverPercent } from './FamilyRace.js';
import { raceDistance } from './RaceSchedule.js';

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
        </div>
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
    <div class="race-start" data-race="start" role="status" aria-atomic="true" hidden>
        <span data-race="start-rival"></span>
        <strong data-race="start-digit"></strong>
    </div>
    <div class="race-tutorial" hidden>
        <div id="race-instructions" data-race="instructions">
            <strong>How to race</strong>
            <p>When you see Go, tap the screen fast or press Space or Up repeatedly. Keep tapping to stay fast and beat your rival to the finish.</p>
        </div>
        <button class="race-button race-ready" type="button">Start race</button>
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
        hud.append(this.element, this.nodes.start);

        // iPhone smart zoom can move the finish button offscreen during repeated sprint taps.
        const keepTrackInView = event => {
            if (event.cancelable && !event.target.closest('.race-continue, .race-ready')) event.preventDefault();
        };
        for (const type of ['touchstart', 'touchend']) {
            this.element.addEventListener(type, keepTrackInView, { passive: false });
        }
        this.element.addEventListener('pointerdown', event => {
            if (event.button === 0) this.tap();
        });
        this.tapButton.addEventListener('click', event => {
            if (event.detail === 0 && !event.pointerType) this.tap();
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

    tap() {
        if (this.active && this.element.dataset.phase === 'racing') this.onTap();
    }

    keydown(event) {
        const { code, target } = event;
        if ((target === this.continueButton || target === this.readyButton) && (code === 'Space' || code === 'Enter')) {
            if (this.pressedKeys.has(code) || event.repeat) event.preventDefault();
            return;
        }
        const raceKey = code === 'Space' || code === 'ArrowUp' || (code === 'Enter' && target === this.tapButton);
        if (!this.active || !raceKey || event.altKey || event.ctrlKey || event.metaKey) return;
        if (this.element.dataset.phase === 'ready') return;
        if (target !== this.tapButton && target.closest?.('button, input, textarea, select, a, [contenteditable]')) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat || this.pressedKeys.has(code)) return;
        this.pressedKeys.add(code);
        this.tap();
    }

    prepare(race, showInstructions) {
        const { rival, speedLevel } = race;
        write(this.opponent, rival.name);
        write(this.nodes['start-rival'], `Racing ${rival.name}`);
        this.nodes.instructions.hidden = !showInstructions;
        if (showInstructions) this.readyButton.setAttribute('aria-describedby', 'race-instructions');
        else this.readyButton.removeAttribute('aria-describedby');
        write(this.nodes.number, `${rival.index + 1}/${RIVALS.length}`);
        write(this.nodes.milepost, `Street ${raceDistance(rival.at)}`);
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
                write(nodes.signal, 'Rival wins');
                break;
        }
        if (!wasDone && this.done) {
            const wins = race.rival.index + 1;
            const champion = phase === 'won' && wins === RIVALS.length;
            if (phase === 'won') {
                write(nodes['takeover-title'], champion ? 'Communist takeover' : 'City takeover');
                write(nodes['takeover-percent'], takeoverPercent(wins) + '%');
                fill(nodes['takeover-fill'], wins / RIVALS.length);
                write(nodes['takeover-result'], `${wins}/${RIVALS.length} beaten · ${elapsed.toFixed(2)} s`);
            }
            if (phase === 'won') write(this.continueButton, champion ? 'Run Overtime' : 'Back to street');
            this.continueButton.disabled = true;
        }
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
