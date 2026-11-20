import { Capacitor } from '@capacitor/core';
import { setupPosters } from './game/Posters.js';
import { frontPage } from './game/CityWire.js';
import { Shop } from './game/Shop.js';
import { Sound } from './game/Sound.js';
import { ApiClient } from './game/ApiClient.js';
import { NIGHT_SHIFT_STAMPS, availableMode, emptyWallet, readWallet, startAttempt } from './game/Progression.js';
import './progression.css';

const $ = (id) => document.getElementById(id);
const screenIds = [
    'start-screen',
    'hud',
    'pause-screen',
    'game-over-screen',
    'story-modal',
    'instructions-modal',
    'shop-screen',
    'poster-room',
    'registration-modal',
    'feedback-modal'
];
const sound = new Sound(),
    api = new ApiClient();
let run,
    loading,
    view,
    resultVersion = 0,
    activeAttempt,
    lastResult,
    wallet = emptyWallet,
    walletReady,
    walletAvailable = true;
const shop = new Shop((skin) => {
    if (run) {
        run.player.setSkin(skin);
        run.wardrobe.render();
    }
});
const best = () => Number(localStorage.getItem('mamdani_best_score')) || 0;
const modeKey = 'mamdani_run_type';
const modeNames = { day: 'Day Run', night: 'Night Shift' };
const selectedMode = () => availableMode(localStorage.getItem(modeKey), wallet);
const metres = (n) => Number(n).toLocaleString() + ' m';
const stampCount = (n) => n.toLocaleString() + (n === 1 ? ' stamp' : ' stamps');
const homeOverlay = new Set(['story-modal', 'instructions-modal', 'feedback-modal']);
function show(id, focus) {
    view = id;
    for (const key of screenIds) {
        const visible = key === id || (key === 'start-screen' && homeOverlay.has(id));
        $(key).classList.toggle('hidden', !visible);
        $(key).inert = key !== id;
    }
    if (focus) $(focus)?.focus({ preventScroll: true });
}
const dispatches = [
    'Mayor endorses today’s march. Aide sent ahead to find out what it’s for.',
    'Committee for Faster Buses votes to meet again on foot.',
    'Pride planning caucus schedules march against its own sponsor.',
    'Free Palestine rally petitions City Hall for a free megaphone.',
    'Party caucus sends question about condemning Hamas back to committee.',
    'City Hall unveils free everything. Budget office requests a transfer.'
];
let dispatchIndex = 0;
function paintMenu() {
    const mode = selectedMode();
    const unlocked = wallet.stamps >= NIGHT_SHIFT_STAMPS;
    $('mode-night').disabled = !unlocked;
    $('night-lock').hidden = unlocked;
    $('mode-day').setAttribute('aria-pressed', String(mode === 'day'));
    $('mode-night').setAttribute('aria-pressed', String(mode === 'night'));
    $('menu-wallet').textContent = unlocked
        ? stampCount(wallet.stamps) + ' banked · Night Shift unlocked'
        : wallet.stamps + '/' + NIGHT_SHIFT_STAMPS + ' stamps banked to unlock Night Shift';
    if (!walletAvailable) $('menu-wallet').textContent = 'Stamp wallet unavailable on this device.';
    $('start-btn').querySelector('span').textContent = 'Start ' + modeNames[mode];
    $('menu-best-label').textContent = mode === 'night' ? 'Night best' : 'Day best';
    $('menu-best').textContent = metres(mode === 'night' ? wallet.nightBest : best());
}
async function refreshWallet() {
    try {
        wallet = await readWallet();
        walletAvailable = true;
    } catch {
        walletAvailable = false;
    }
    if (view === 'start-screen') paintMenu();
}
function selectMode(mode) {
    localStorage.setItem(modeKey, availableMode(mode, wallet));
    paintMenu();
}
$('mode-day').onclick = () => selectMode('day');
$('mode-night').onclick = () => selectMode('night');
window.addEventListener('focus', () => {
    if (view === 'start-screen') walletReady = refreshWallet();
});
window.addEventListener('storage', (event) => {
    if (view === 'start-screen' && event.key === modeKey) walletReady = refreshWallet();
});
function home() {
    document.querySelector('.wire p').textContent = dispatches[dispatchIndex++ % dispatches.length];
    run?.stop();
    activeAttempt = null;
    resultVersion++;
    $('load-status').hidden = true;
    show('start-screen');
    paintMenu();
    walletReady = refreshWallet();
}
function updateSound() {
    const button = document.querySelector('.sound-toggle');
    button.setAttribute('aria-label', 'Game sound');
    button.setAttribute('aria-pressed', String(sound.enabled));
    button.querySelector('span').textContent = sound.enabled ? 'Sound on' : 'Sound off';
    button.querySelector('use').setAttribute('href', sound.enabled ? '#i-sound' : '#i-mute');
}
document.querySelector('.sound-toggle').addEventListener('click', () => {
    sound.toggle();
    updateSound();
});
updateSound();
home();
$('turn-left').onclick = () => run?.wardrobe.rotate(-Math.PI / 4);
$('turn-right').onclick = () => run?.wardrobe.rotate(Math.PI / 4);
let lastDrag = null;
$('shop-screen').addEventListener('pointerdown', (e) => {
    if (e.target !== $('shop-screen')) return;
    lastDrag = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
});
$('shop-screen').addEventListener('pointermove', (e) => {
    if (lastDrag !== null) {
        run?.wardrobe.rotate((e.clientX - lastDrag) * 0.014);
        lastDrag = e.clientX;
    }
});
for (const type of ['pointerup', 'pointercancel'])
    $('shop-screen').addEventListener(type, () => {
        lastDrag = null;
    });
setupPosters(() => show('poster-room', 'poster-next'));
if (!Capacitor.isNativePlatform()) {
    const analytics = document.createElement('script');
    analytics.async = true;
    analytics.src = 'https://www.googletagmanager.com/gtag/js?id=G-M4V8F77Y5F';
    document.head.append(analytics);
}
const status = $('load-status');
async function enter(mode, requested) {
    if (loading) return;
    loading = true;
    sound.unlock();
    const btn = mode === 'run' ? $('start-btn') : $('shop-btn');
    try {
        if (!run) {
            btn.disabled = true;
            status.hidden = false;
            status.textContent = 'Opening the street…';
            const [{ Run }, { loadCast }] = await Promise.all([
                import('./game/Run.js'),
                import('./game/RunnerModel.js')
            ]);
            const [cast] = await Promise.all([loadCast(), document.fonts.load('700 16px Condensed')]);
            run = new Run($('game-canvas'), sound, null, cast);
            await run.ready;
        }
        await walletReady;
        if (view !== 'start-screen' && !(view === 'game-over-screen' && mode === 'run')) return;
        status.hidden = true;
        run.player.setSkin(shop.selected);
        if (mode === 'run') {
            const attempt = startAttempt(availableMode(requested ?? selectedMode(), wallet));
            activeAttempt = attempt;
            run.onEnd = (distance, tax, cause) => finish(attempt, distance, tax, cause);
            resultVersion++;
            show('hud');
            run.start(attempt.mode);
            sound.play('start');
            window.gtag?.('event', 'game_start');
        } else {
            show('shop-screen', 'close-shop-btn');
            run.showOutfit();
        }
    } catch (error) {
        console.error(error);
        run = null;
        status.hidden = false;
        status.textContent = 'The street could not load. Enable WebGL and try again.';
    } finally {
        btn.disabled = false;
        loading = false;
    }
}
$('start-btn').onclick = () => enter('run');
$('restart-btn').onclick = () => enter('run', lastResult.mode);
$('play-night').onclick = () => {
    selectMode('night');
    enter('run', 'night');
};
$('shop-btn').onclick = () => enter('outfits');
$('story-btn').onclick = () => show('story-modal', 'close-story-btn');
$('instructions-btn').onclick = () => show('instructions-modal', 'instructions-modal');
$('feedback-btn').onclick = () => show('feedback-modal', 'feedback-msg');
document.querySelectorAll('[data-home]').forEach((b) =>
    b.addEventListener('click', () => {
        home();
        $('start-btn').focus({ preventScroll: true });
    })
);
function pause() {
    if (view !== 'hud') return;
    run.pause();
    show('pause-screen', 'resume-btn');
}
function resume() {
    if (view === 'pause-screen') {
        show('hud');
        sound.unlock();
        run.resume();
    }
}
$('pause-btn').onclick = pause;
$('resume-btn').onclick = resume;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
});
window.addEventListener('blur', pause);
window.addEventListener('keydown', (e) => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'Escape') {
        if (view === 'hud') pause();
        else if (view === 'pause-screen') resume();
        else if (view === 'registration-modal') show('game-over-screen', 'join-lb-btn');
        else if (view !== 'start-screen') home();
    } else if (e.code === 'KeyP' && (view === 'hud' || view === 'pause-screen')) {
        if (view === 'hud') pause();
        else resume();
    } else if (view === 'start-screen' && e.code === 'Enter' && document.activeElement === document.body) {
        e.preventDefault();
        enter('run');
    }
});

function playerId() {
    let id = localStorage.getItem('mamdani_player_id');
    if (!id) {
        id =
            crypto.randomUUID?.() ??
            'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
                ((c === 'x' ? Math.random() * 16 : 8 + Math.random() * 4) | 0).toString(16)
            );
        localStorage.setItem('mamdani_player_id', id);
    }
    return id;
}
const installed = () =>
    Capacitor.isNativePlatform() ||
    matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;
if (!installed()) {
    if (/iPhone|iPad/i.test(navigator.userAgent))
        $('pwa-prompt').textContent = 'Install on iOS with Share → Add to Home Screen.';
    else if (/Android/i.test(navigator.userAgent))
        $('pwa-prompt').textContent = 'Choose Install app in your browser menu to keep the game.';
}
async function finish(attempt, distance, tax, cause) {
    if (activeAttempt !== attempt) return;
    activeAttempt = null;
    const version = ++resultVersion;
    const night = attempt.mode === 'night';
    const kept = run.scoreManager.foodStamps;
    const cleanMoves = run.cleanMoves;
    const seconds = Math.floor(run.elapsed);
    const result = { mode: attempt.mode, distance };
    lastResult = result;
    if (!night) localStorage.setItem('mamdani_best_score', Math.max(best(), distance));
    let receipt;
    try {
        receipt = await attempt.bank(kept, distance);
        wallet = receipt.wallet;
        walletAvailable = true;
    } catch {
        walletAvailable = false;
    }
    if (version !== resultVersion) return;
    const issue = (Number(localStorage.getItem('mamdani_edition')) || 0) + 1;
    localStorage.setItem('mamdani_edition', String(issue));
    const [headline, copy] = frontPage(cause, issue - 1);
    $('result-edition').textContent = modeNames[attempt.mode] + ' · No. ' + issue;
    $('result-headline').textContent = headline;
    $('result-copy').textContent = copy;
    $('final-moves').textContent = cleanMoves;
    $('run-seconds').textContent = seconds + ' second' + (seconds === 1 ? '' : 's');
    $('final-distance').textContent = metres(distance);
    $('final-tax').textContent = tax;
    $('result-banked').textContent = receipt ? '+' + stampCount(kept) + ' banked' : 'Stamps could not be saved';
    $('result-wallet').textContent = receipt ? 'Wallet · ' + wallet.stamps.toLocaleString() : '';
    const remaining = NIGHT_SHIFT_STAMPS - wallet.stamps;
    $('result-progress').textContent = !receipt ? 'Stamp wallet unavailable on this device.'
        : receipt.unlocked ? 'Night Shift unlocked!'
        : remaining > 0 ? stampCount(remaining) + ' to unlock Night Shift.'
        : 'Night Shift unlocked';
    $('play-night').hidden = !receipt?.unlocked;
    $('result-progress').parentElement.classList.toggle('just-unlocked', !!receipt?.unlocked);
    $('result-best-label').textContent = night ? 'Night Shift best on this device' : 'Day Run best';
    $('pb-score').textContent = metres(night ? wallet.nightBest : best());
    $('pb-rank-display').textContent = '';
    $('join-lb-btn').hidden = !!localStorage.getItem('mamdani_name');
    $('day-board').hidden = night;
    document.querySelector('.results').scrollTop = 0;
    show('game-over-screen', 'restart-btn');
    if (!night) loadBoard(version, result);
}
async function submitDayScore(score) {
    if (!localStorage.getItem('mamdani_name')) await api.register(playerId(), '', '', installed());
    return api.submitScore(playerId(), score);
}
async function loadBoard(version, result) {
    if (result.mode !== 'day') return;
    const list = $('leaderboard-list');
    list.textContent = 'Counting the votes…';
    result.rank ??= submitDayScore(result.distance);
    const rank = await result.rank;
    const board = await api.getLeaderboard(50);
    if (version !== resultVersion) return;
    const entries = Array.isArray(board) ? board : board?.entries || board?.scores;
    list.replaceChildren();
    if (!rank?.ok && !entries?.length)
        list.textContent = 'Leaderboard offline. Your best is saved on this device.';
    else if (!entries?.length) list.textContent = 'No scores yet.';
    else
        entries.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-item';
            const place = document.createElement('b'),
                name = document.createElement('span'),
                value = document.createElement('b');
            place.textContent = index + 1;
            name.textContent = entry.name || 'Anonymous';
            value.textContent = metres(entry.score);
            if (entry.social) {
                const link = document.createElement('a'),
                    handle = String(entry.social).replace(/^@/, '');
                link.textContent = '@' + handle;
                link.href = 'https://truthsocial.com/@' + encodeURIComponent(handle);
                link.target = '_blank';
                link.rel = 'noopener';
                name.append(link);
            }
            row.append(place, name, value);
            list.append(row);
        });
    if (rank?.ok) {
        localStorage.setItem('mamdani_best_score', Math.max(best(), Number(rank.bestScore) || 0));
        $('pb-score').textContent = metres(best());
        if (rank.rank > 0 && localStorage.getItem('mamdani_name'))
            $('pb-rank-display').textContent = ' · Rank #' + rank.rank;
    }
}
$('join-lb-btn').onclick = () => show('registration-modal', 'reg-name');
$('cancel-reg').onclick = () => show('game-over-screen', 'join-lb-btn');
$('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('reg-name').value.trim(),
        social = $('reg-social').value.trim();
    if (!name) {
        $('reg-error').textContent = 'Enter a name to join.';
        return;
    }
    const version = resultVersion;
    $('submit-score-btn').disabled = true;
    const result = await api.register(playerId(), name, social, installed());
    $('submit-score-btn').disabled = false;
    if (result.ok || result.updated) {
        localStorage.setItem('mamdani_name', name);
        if (social) localStorage.setItem('mamdani_social', social);
        if (view === 'registration-modal' && version === resultVersion) {
            show('game-over-screen', 'restart-btn');
            $('join-lb-btn').hidden = true;
            loadBoard(++resultVersion, lastResult);
        }
    } else $('reg-error').textContent = 'Could not join. Try again.';
};
$('feedback-form').onsubmit = async (e) => {
    e.preventDefault();
    const message = $('feedback-msg').value.trim();
    if (!message) return;
    $('send-feedback-btn').disabled = true;
    const response = await api.sendFeedback(playerId(), message);
    $('send-feedback-btn').disabled = false;
    $('feedback-status').textContent = response.ok
        ? 'Feedback sent. Thank you.'
        : 'Could not send. Try again.';
    if (response.ok) $('feedback-msg').value = '';
};
$('bmc-wrapper').onclick = () => window.gtag?.('event', 'bmc_click');
