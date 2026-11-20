import { RACE_METRES, RACE_TOP_SPEED, RIVALS } from './FamilyRace.js';

const FINISH_HOLD_MS = 650;

const markup = `
    <div class="race-standings">
        <header class="race-heading">
            <div class="race-heading-line">
                <span>Family race <span data-race="number"></span></span>
                <span data-race="milepost" title="Street milestone"></span>
            </div>
            <h2 id="race-opponent"></h2>
        </header>

        <div class="race-board" role="group" aria-label="Positions in the ${RACE_METRES} m sprint">
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
            <div class="race-finish" aria-hidden="true"><span>0 m</span><span>${RACE_METRES} m</span></div>
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
        <button class="race-button race-tap" type="button" aria-describedby="race-keys">Tap to sprint</button>
        <button class="race-button race-continue" type="button" hidden>Continue</button>
        <span id="race-keys">Space or ↑</span>
    </div>
`;

function write(element, text) {
    if (element.textContent !== text) element.textContent = text;
}

function fill(element, fraction) {
    element.style.transform = `scaleX(${fraction})`;
}

export class RacePanel {
    constructor(hud, onTap, onContinue) {
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
        hud.append(this.element);

        // iPhone smart zoom can move the finish button offscreen during repeated sprint taps.
        const keepTrackInView = event => {
            if (event.cancelable && !event.target.closest('.race-continue')) event.preventDefault();
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
        if (target === this.continueButton && (code === 'Space' || code === 'Enter')) {
            if (this.pressedKeys.has(code) || event.repeat) event.preventDefault();
            return;
        }
        const raceKey = code === 'Space' || code === 'ArrowUp' || (code === 'Enter' && target === this.tapButton);
        if (!this.active || !raceKey || event.altKey || event.ctrlKey || event.metaKey) return;
        if (target !== this.tapButton && target.closest?.('button, input, textarea, select, a, [contenteditable]')) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat || this.pressedKeys.has(code)) return;
        this.pressedKeys.add(code);
        this.tap();
    }

    show(rival, speedLevel) {
        clearTimeout(this.finishTimer);
        write(this.opponent, rival.name);
        write(this.nodes.number, `${rival.index + 1}/${RIVALS.length}`);
        write(this.nodes.milepost, `${rival.at.toLocaleString()} m`);
        write(this.nodes.level, `Race speed Lv. ${speedLevel}`);
        this.continueButton.disabled = false;
        this.setPhase('intro');
        this.element.hidden = false;
        this.hud.classList.add('is-racing');
        this.element.inert = false;
        this.paused = false;
        this.tapButton.focus({ preventScroll: true });
    }

    paint(race) {
        if (this.element.hidden) return;
        const { phase, countdown, elapsed, playerProgress, rivalProgress, speed } = race;
        const wasDone = this.done;
        this.setPhase(phase);
        const { nodes } = this;
        const playerMetres = playerProgress * RACE_METRES;
        const rivalMetres = rivalProgress * RACE_METRES;
        const gap = playerMetres - rivalMetres;
        const ahead = gap >= 0.1;
        const separated = Math.abs(gap) >= 0.1;
        const lead = separated ? `${ahead ? 'Ahead' : 'Behind'} by ${Math.abs(gap).toFixed(1)} m` : 'Tied';
        write(nodes.gap, phase === 'intro' ? 'At the line' : lead);
        nodes.gap.dataset.lead = !separated ? 'tied' : ahead ? 'ahead' : 'behind';
        const seconds = elapsed.toFixed(1);
        write(nodes.time, `${seconds} s`);
        if (nodes.time.dateTime !== `PT${seconds}S`) nodes.time.dateTime = `PT${seconds}S`;
        write(nodes['player-metres'], `${playerMetres.toFixed(1)} m`);
        write(nodes['rival-metres'], `${rivalMetres.toFixed(1)} m`);
        fill(nodes['player-fill'], playerProgress);
        fill(nodes['rival-fill'], rivalProgress);
        fill(nodes['boost-fill'], speed / RACE_TOP_SPEED);

        const showSpeed = phase === 'racing' && elapsed >= 0.65;
        nodes.speed.hidden = !showSpeed;
        nodes.signal.classList.toggle('race-signal-announcement', showSpeed);
        if (showSpeed) write(nodes['speed-value'], speed.toFixed(1));
        switch (phase) {
            case 'intro':
                write(nodes.signal, `Ready · ${countdown}`);
                break;
            case 'racing':
                write(nodes.signal, 'Go!');
                break;
            case 'won':
                write(nodes.signal, 'You win');
                break;
            case 'lost':
                write(nodes.signal, 'Rival wins');
                break;
        }
        if (!wasDone && this.done) {
            write(this.continueButton, phase === 'won' ? 'Continue' : 'Results');
            this.continueButton.disabled = true;
            this.finishTimer = setTimeout(() => {
                this.continueButton.disabled = false;
                if (this.active) this.continueButton.focus({ preventScroll: true });
            }, FINISH_HOLD_MS);
        }
    }

    setPhase(phase) {
        if (phase === this.element.dataset.phase) return;
        this.element.dataset.phase = phase;
        this.tapButton.setAttribute('aria-disabled', String(phase !== 'racing'));
        this.tapButton.hidden = this.keyHint.hidden = this.done;
        this.continueButton.hidden = !this.done;
    }

    get done() {
        const phase = this.element.dataset.phase;
        return phase === 'won' || phase === 'lost';
    }

    setPaused(paused) {
        if (this.paused === paused) return;
        this.paused = paused;
        this.element.inert = paused;
        if (!paused && this.active) (this.done ? this.continueButton : this.tapButton).focus({ preventScroll: true });
    }

    hide() {
        clearTimeout(this.finishTimer);
        this.element.hidden = true;
        this.hud.classList.remove('is-racing');
    }
}
