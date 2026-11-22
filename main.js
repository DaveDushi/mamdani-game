import { Capacitor } from '@capacitor/core';
import { setupPosters } from './game/Posters.js';
import { frontPage } from './game/CityWire.js';
import { RIVALS } from './game/FamilyRace.js';
import { Shop, nextGoal } from './game/Shop.js';
import { startAnalytics, track, setupSupportLinks } from './game/Analytics.js';
import { Sound } from './game/Sound.js';
import { loadCast, loadMayor, loadOutfit } from './game/Cast.js';
import { ApiClient } from './game/ApiClient.js';
import { offerDomainMove } from './game/DomainMove.js';
import {
    NIGHT_SHIFT_STAMPS, availableMode, emptyWallet, onWalletChange, purchasePowerup, purchaseSpeedUpgrade,
    readWallet, recordFamilyWin, startAttempt, walletBalance, walletLifetime
} from './game/Progression.js';

const $ = (id) => document.getElementById(id);
startAnalytics();
setupSupportLinks();
const screenIds = [
    'start-screen',
    'hud',
    'pause-screen',
    'game-over-screen',
    'story-modal',
    'settings-modal',
    'instructions-modal',
    'shop-screen',
    'poster-room',
    'rankings-screen',
    'privacy-modal',
    'registration-modal',
    'feedback-modal'
];
const sound = new Sound(),
    api = new ApiClient();
const native = api.native;
const onlineKey = native ? 'mamdani_ios_online' : 'mamdani_online';
const scoreKey = native ? 'mamdani_ios_score_key' : 'mamdani_score_key';
const savedNameKey = 'mamdani_name_posted';
// The app asks first. The website plays online until the player turns it off.
const onlinePlay = () => native ? localStorage.getItem(onlineKey) === 'on' : localStorage.getItem(onlineKey) !== 'off';
const RESULT_GUARD_MS = 500;
const RECORD_FRESH_MS = 60000;
let run,
    fittingRoom,
    roomRequest,
    streetRequest,
    startButton,
    entryVersion = 0,
    view,
    resultVersion = 0,
    activeAttempt,
    lastResult,
    resultShownAt = 0,
    liveRecord,
    recordReadAt,
    recordFailed = false,
    trail = [],
    wallet = emptyWallet,
    walletAvailable = true;
const bought = async purchase => {
    const result = await purchase;
    wallet = result.wallet;
    walletAvailable = true;
    return result;
};
const shop = new Shop({
    select: () => updatePreview(),
    buySpeed: expectedLevel => bought(purchaseSpeedUpgrade(expectedLevel)),
    buyPower: (type, expectedLevel) => bought(purchasePowerup(type, expectedLevel)),
    resize: () => fittingRoom?.resize()
});
const best = () => Number(localStorage.getItem('mamdani_best_score')) || 0;
const bestFor = (mode) => mode === 'night' ? wallet.nightBest : best();
const modeKey = 'mamdani_run_type';
const modeNames = { day: 'Day Run', night: 'Night Shift' };
const selectedMode = () => availableMode(localStorage.getItem(modeKey), wallet);
const metres = (n) => Number(n).toLocaleString() + ' m';
const points = (n) => Number(n).toLocaleString();
const stampCount = (n) => n.toLocaleString() + (n === 1 ? ' stamp' : ' stamps');
const overlays = new Set(['story-modal', 'settings-modal', 'instructions-modal', 'privacy-modal', 'feedback-modal']);
const backdrops = new Set(['start-screen', 'game-over-screen']);
function show(id, focus, behind) {
    if (view !== id) {
        entryVersion++;
        clearStartButton();
    }
    view = id;
    if (overlays.has(id) && backdrops.has(trail[0]?.view)) behind = trail[0].view;
    for (const key of screenIds) {
        $(key).classList.toggle('hidden', key !== id && key !== behind);
        $(key).inert = key !== id;
    }
    (typeof focus === 'string' ? $(focus) : focus)?.focus({ preventScroll: true });
}
function remember() {
    trail.push({ view, focus: document.activeElement });
}
function open(id, focus = $(id).querySelector('.sheet-close')) {
    remember();
    show(id, focus);
    const body = $(id).querySelector('.sheet-body');
    if (body) body.scrollTop = 0;
}
function back() {
    const from = trail.pop();
    if (!from || from.view === 'start-screen') {
        home();
        (from?.focus?.id ? from.focus : $('start-btn')).focus({ preventScroll: true });
        return;
    }
    if (view === 'shop-screen') closeRoom();
    if (from.view === 'game-over-screen') paintGoal();
    if (from.view === 'settings-modal') paintSettings();
    show(from.view, from.focus);
}
function paintMenu() {
    const mode = selectedMode();
    const unlocked = wallet.nightUnlocked;
    const balance = walletBalance(wallet);
    $('mode-night').disabled = !unlocked;
    $('night-lock').toggleAttribute('hidden', unlocked);
    $('mode-day').setAttribute('aria-pressed', String(mode === 'day'));
    $('mode-night').setAttribute('aria-pressed', String(mode === 'night'));
    const lifetime = walletLifetime(wallet);
    $('menu-progress').hidden = unlocked || !walletAvailable;
    $('menu-meter').style.transform = 'scaleX(' + Math.min(1, lifetime / NIGHT_SHIFT_STAMPS) + ')';
    $('menu-wallet').textContent = !walletAvailable ? 'Stamp wallet unavailable on this device.'
        : unlocked ? stampCount(balance) + ' to spend in the shop'
        : !lifetime ? 'Grab stamps. Bank ' + NIGHT_SHIFT_STAMPS + ' and Night Shift opens.'
        : lifetime.toLocaleString() + ' of ' + NIGHT_SHIFT_STAMPS + ' stamps to Night Shift'
            + (wallet.spent ? ' · ' + balance.toLocaleString() + ' to spend' : '');
    $('start-btn').querySelector('span').textContent = 'Start ' + modeNames[mode];
    $('menu-best-label').textContent = mode === 'night' ? 'Night best' : 'Day best';
    $('menu-best').textContent = points(bestFor(mode));
    $('menu-record').textContent = !onlinePlay() || recordFailed ? '—' : liveRecord === undefined ? '…' : liveRecord === null ? 'None yet' : points(liveRecord);
    const wins = wallet.familyBest;
    $('takeover-count').textContent = wins + '/' + RIVALS.length;
    $('takeover-skyline').setAttribute('aria-label', wins + ' of ' + RIVALS.length + ' family wins in your best run');
    $('takeover-skyline').querySelectorAll('g').forEach((lot, index) => lot.classList.toggle('taken', index < wins));
}
// The menu never waits for this. A failed read shows a dash and tries again on the next visit.
async function refreshRecord() {
    if (view !== 'start-screen' || !onlinePlay() || performance.now() - recordReadAt < RECORD_FRESH_MS) return;
    recordReadAt = performance.now();
    const record = await api.getSeasonRecord();
    recordFailed = !record && liveRecord === undefined;
    if (record) liveRecord = record.score;
    else recordReadAt = undefined;
    if (view === 'start-screen') paintMenu();
}
async function refreshWallet() {
    try {
        wallet = await readWallet();
        walletAvailable = true;
    } catch {
        walletAvailable = false;
    }
    if (view === 'start-screen') paintMenu();
    if (view === 'shop-screen') shop.updateWallet(wallet, walletAvailable);
}
function selectMode(mode) {
    localStorage.setItem(modeKey, availableMode(mode, wallet));
    paintMenu();
}
$('mode-day').onclick = () => selectMode('day');
$('mode-night').onclick = () => selectMode('night');
function refreshVisibleWallet() {
    if (view === 'start-screen' || view === 'shop-screen') refreshWallet();
}
onWalletChange(refreshVisibleWallet);
window.addEventListener('focus', refreshVisibleWallet);
window.addEventListener('storage', (event) => {
    if (view === 'start-screen' && event.key === modeKey) refreshWallet();
});
function closeRoom() {
    if (run) run.stop();
    else fittingRoom?.close();
}
function home() {
    trail = [];
    closeRoom();
    activeAttempt = null;
    resultVersion++;
    $('load-status').hidden = true;
    show('start-screen');
    paintMenu();
    refreshWallet();
    setTimeout(refreshRecord, 250);
}
const soundButtons = document.querySelectorAll('.sound-toggle');
function updateSound() {
    for (const button of soundButtons) {
        button.setAttribute('aria-pressed', String(sound.enabled));
        button.querySelector('span').textContent = sound.enabled ? 'Sound on' : 'Sound off';
        button.querySelector('use').setAttribute('href', sound.enabled ? '#i-sound' : '#i-mute');
    }
}
for (const button of soundButtons) {
    button.addEventListener('click', () => {
        sound.toggle();
        updateSound();
    });
}
updateSound();
home();
offerDomainMove();
const preview = $('outfit-preview');
let drag = null;
// Keep a preview swipe from consuming the next tap on a shop button.
preview.addEventListener('touchstart', e => {
    if (e.cancelable) e.preventDefault();
}, { passive: false });
preview.addEventListener('pointerdown', e => {
    if (!fittingRoom?.active || !e.isPrimary || e.button !== 0 || drag) return;
    drag = { id: e.pointerId, x: e.clientX };
    preview.setPointerCapture(e.pointerId);
});
preview.addEventListener('pointermove', e => {
    if (drag?.id !== e.pointerId || !fittingRoom?.active) return;
    const dx = e.clientX - drag.x;
    if (dx) fittingRoom.rotate(dx * 0.014);
    drag.x = e.clientX;
});
preview.addEventListener('lostpointercapture', e => {
    if (drag?.id === e.pointerId) drag = null;
});
preview.addEventListener('keydown', e => {
    if (!fittingRoom?.active || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    fittingRoom.rotate(e.key === 'ArrowLeft' ? -Math.PI / 4 : Math.PI / 4);
});
setupPosters(() => open('poster-room', 'poster-next'));
const previewStatus = $('preview-status');
let status = $('load-status');

function clearStartButton() {
    if (!startButton) return;
    startButton.disabled = false;
    startButton.removeAttribute('aria-busy');
    startButton = null;
    status.hidden = true;
}

function getRoom() {
    if (fittingRoom) return Promise.resolve(fittingRoom);
    roomRequest ??= Promise.all([
        import('./game/Wardrobe.js'),
        loadMayor(),
        afterPaint()
    ]).then(([{ createFittingRoom }, mayor]) => {
        if (view !== 'shop-screen' && !startButton) return null;
        return (fittingRoom = createFittingRoom($('game-canvas'), mayor));
    }).finally(() => { roomRequest = null; });
    return roomRequest;
}

function streetFiles() {
    return Promise.all([
        import('./game/Run.js'),
        loadCast(),
        import('./game/Geometry.js').then(module => module.preloadStreetArt()),
        document.fonts.load('700 16px Condensed')
    ]);
}

async function getStreet(ticket) {
    const outfit = shop.selected;
    const [files, room, clothing] = await Promise.all([run ? null : streetFiles(), getRoom(), outfitFiles(outfit)]);
    if (entryVersion !== ticket) return null;
    applyOutfit(room, outfit, clothing);
    if (run) return run;
    const [{ Run }, cast] = files;
    streetRequest ??= (async () => {
        const street = new Run($('game-canvas'), sound, null, cast, room);
        await street.ready;
        return (run = street);
    })().catch(error => { streetRequest = null; throw error; });
    return streetRequest;
}

function afterPaint() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function outfitFiles(outfit) {
    if (outfit.id === 'default' || fittingRoom?.player.rig.suits.has(outfit.id)) return null;
    return loadOutfit(outfit.id);
}

function applyOutfit(room, outfit, clothing) {
    const pieces = room.player.rig.addOutfit(outfit.id, clothing);
    if (pieces.length) run?.raceStage?.addOutfit(pieces);
    room.player.setSkin(outfit);
}

function openShop() {
    if (view === 'shop-screen') return;
    shop.open(wallet, walletAvailable);
    open('shop-screen', 'show-outfits');
    refreshWallet();
    updatePreview();
}

async function updatePreview() {
    const ticket = entryVersion;
    const outfit = shop.selected;
    if (fittingRoom?.active && fittingRoom.player.rig.suits.has(outfit.id)) {
        fittingRoom.player.setSkin(outfit);
        fittingRoom.render();
        previewStatus.hidden = true;
        $('shop-screen').classList.remove('preparing-preview');
        return;
    }
    previewStatus.hidden = false;
    previewStatus.textContent = 'Loading fitting room…';
    $('shop-screen').classList.add('preparing-preview');
    try {
        const [room, clothing] = await Promise.all([getRoom(), outfitFiles(outfit), afterPaint()]);
        if (streetRequest && !run) await streetRequest;
        if (entryVersion !== ticket || shop.selected !== outfit) return;
        applyOutfit(room, outfit, clothing);
        if (room.active) room.render();
        else if (run) run.showOutfit();
        else {
            room.player.reset();
            room.open();
        }
        previewStatus.hidden = true;
        $('shop-screen').classList.remove('preparing-preview');
    } catch (error) {
        console.error(error);
        if (entryVersion === ticket && shop.selected === outfit) previewStatus.textContent = 'Preview unavailable. You can still train or pick an outfit.';
    }
}

async function startRun(requested, button = $('start-btn')) {
    if (startButton) return;
    const ticket = ++entryVersion;
    startButton = button;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    status = $({ 'start-btn': 'load-status', 'pause-restart': 'pause-load-status' }[button.id] ?? 'result-load-status');
    status.hidden = false;
    status.textContent = 'Loading street…';
    try {
        const ready = getStreet(ticket);
        const online = onlinePlay();
        let openingRecord = online ? api.getSeasonRecord() : null;
        sound.unlock();
        const [street] = await Promise.all([ready, refreshWallet(), afterPaint()]);
        if (entryVersion !== ticket || !street) return;
        const attempt = {
            ...startAttempt(availableMode(requested ?? selectedMode(), wallet)),
            key: online ? playerKey() : null
        };
        attempt.previousBest = bestFor(attempt.mode);
        attempt.ticket = attempt.key ? api.startRun({
            key: attempt.key, mode: attempt.mode, wanted: () => activeAttempt === attempt
        }) : null;
        if (attempt.key) postSavedName(attempt.key);
        const recordProvider = online ? {
            getRecord() {
                const request = openingRecord ?? api.getSeasonRecord();
                openingRecord = null;
                return request;
            },
            async claim(score) {
                const issued = await attempt.ticket;
                if (!issued && !this.told) {
                    this.told = true;
                    street.bulletin('This run started offline. Donald only races ranked runs.', 'Race desk', true);
                }
                return issued && api.claimSeasonRecord({ key: attempt.key, ticket: issued.ticket, score, mode: attempt.mode });
            }
        } : undefined;
        attempt.ticket?.then(issued => { recordProvider.unranked = !issued; });
        activeAttempt = attempt;
        trail = [];
        street.onEnd = (score, gross, cause, stats) => finish(attempt, score, gross, cause, stats);
        street.onRaceWin = count => recordFamilyWin(count).catch(() => { walletAvailable = false; });
        street.onFinishPhoto = (canvas, stage) => { attempt.photo = finishPhoto(canvas, stage); };
        // Bank when the run ends, even if the player leaves during the celebration.
        street.onDefeat = (gross, score) => {
            settleScore(attempt, score);
            attempt.bank(gross, score).catch(() => { walletAvailable = false; });
        };
        resultVersion++;
        show('hud');
        street.start(attempt.mode, wallet.speedLevel, recordProvider, wallet.powerLevels);
        sound.play('start');
        afterPaint().then(() => import('./game/Geometry.js')).then(module => module.loadStreetDetails()).catch(() => {});
        track('game_start', { run_mode: attempt.mode });
    } catch (error) {
        console.error(error);
        if (entryVersion === ticket) {
            clearStartButton();
            status.hidden = false;
            status.textContent = 'The street could not load. Enable WebGL and try again.';
        }
    }
}

$('start-btn').onclick = () => startRun();
// A tap or key meant for the run must not skip the front page.
const resultReady = () => performance.now() - resultShownAt > RESULT_GUARD_MS;
$('restart-btn').onclick = event => {
    if (resultReady()) startRun(lastResult.mode, event.currentTarget);
};
$('play-night').onclick = event => {
    selectMode('night');
    startRun('night', event.currentTarget);
};
$('shop-btn').onclick = openShop;
$('result-shop').onclick = openShop;

// Warm shared files after the title paints. Only a requested run constructs the city or starts its renderer.
afterPaint().then(() => {
    const connection = navigator.connection;
    if (document.hidden || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
    const warmShared = () => {
        if (view !== 'start-screen' || startButton) return;
        loadMayor().catch(() => {});
        if (shop.selected.id !== 'default') outfitFiles(shop.selected)?.catch(() => {});
        import('./game/Wardrobe.js').catch(() => {});
        setTimeout(() => {
            if (view !== 'start-screen' || document.hidden || startButton) return;
            streetFiles().then(async () => {
                if (view === 'start-screen' && !startButton) await (await import('./game/Geometry.js')).loadStreetDetails();
            }).catch(() => {});
        }, 750);
    };
    if (window.requestIdleCallback) window.requestIdleCallback(warmShared, { timeout: 600 });
    else setTimeout(warmShared, 70);
});
$('story-btn').onclick = () => open('story-modal');
$('instructions-btn').onclick = $('pause-help').onclick = () => open('instructions-modal');
$('settings-btn').onclick = $('pause-settings').onclick = () => {
    paintSettings();
    open('settings-modal');
};
$('feedback-btn').hidden = native;
$('feedback-btn').onclick = () => {
    $('feedback-status').textContent = '';
    open('feedback-modal', 'feedback-msg');
};
$('wire-data-btn').hidden = !native;
$('privacy-feedback').hidden = native;
function paintSettings() {
    $('settings-online').textContent = onlinePlay() ? 'On' : 'Off';
}
for (const id of ['privacy-btn', 'wire-data-btn', 'result-online-settings']) {
    $(id).onclick = () => {
        $('online-play').checked = onlinePlay();
        $('delete-online-confirmation').hidden = true;
        $('delete-online-data').disabled = $('online-play').disabled || !localStorage.getItem(scoreKey);
        if (!$('online-play').disabled) $('privacy-status').textContent = '';
        open('privacy-modal', 'online-play');
    };
}
$('online-play').onchange = event => {
    localStorage.setItem(onlineKey, event.target.checked ? 'on' : 'off');
    $('privacy-status').textContent = event.target.checked ? 'Online play enabled for your next run.' : 'Online play is off.';
};
$('delete-online-data').onclick = () => {
    $('delete-online-confirmation').hidden = false;
    $('confirm-delete-online-data').focus();
};
$('cancel-delete-online-data').onclick = () => {
    $('delete-online-confirmation').hidden = true;
    $('delete-online-data').focus();
};
$('confirm-delete-online-data').onclick = async () => {
    const key = localStorage.getItem(scoreKey);
    if (!key || $('online-play').disabled) return;
    $('delete-online-confirmation').hidden = true;
    localStorage.setItem(onlineKey, 'off');
    $('online-play').checked = false;
    $('online-play').disabled = true;
    $('delete-online-data').disabled = true;
    $('privacy-status').textContent = 'Deleting online data…';
    const result = await api.deleteSeasonData(key);
    if (result.ok) {
        localStorage.removeItem(scoreKey);
        localStorage.removeItem('mamdani_name');
        localStorage.removeItem('mamdani_social');
        localStorage.removeItem(savedNameKey);
        updateNameButtons();
        $('privacy-status').textContent = 'Online data deleted. Online play is off.';
    } else {
        $('delete-online-data').disabled = false;
        $('privacy-status').textContent = 'Online play is off. Could not confirm deletion. Try again when connected.';
    }
    $('online-play').disabled = false;
    if (view === 'privacy-modal') $('online-play').focus();
};
document.querySelectorAll('[data-home]').forEach((b) =>
    b.addEventListener('click', () => {
        home();
        $('start-btn').focus({ preventScroll: true });
    })
);
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', back));
// A press on the dimmed backdrop closes a screen. A drag that only ends there does not.
let pressed;
document.addEventListener('pointerdown', event => { pressed = event.target; });
for (const id of ['story-modal', 'settings-modal', 'instructions-modal', 'privacy-modal', 'feedback-modal', 'rankings-screen', 'poster-room']) {
    $(id).addEventListener('click', event => {
        if (event.target === $(id) && pressed === $(id)) back();
    });
}
function paintPause() {
    const { mode } = activeAttempt;
    $('pause-mode').textContent = modeNames[mode];
    $('pause-points').textContent = Number($('score').textContent).toLocaleString();
    $('pause-best-label').textContent = mode === 'night' ? 'Night best' : 'Day best';
    $('pause-best').textContent = points(activeAttempt.previousBest);
    const part = name => $('race-checkpoint').querySelector('[data-approach-' + name + ']').textContent;
    $('pause-goal').textContent = run.race ? 'Racing ' + run.race.rival.name
        : [part('label'), part('name'), part('detail')].filter(Boolean).join(' · ');
}
function pause() {
    if (view !== 'hud') return;
    run.pause();
    paintPause();
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
// Like Menu, a restart drops the run without banking it. Resume cancels one that is still loading.
$('pause-restart').onclick = event => startRun(activeAttempt.mode, event.currentTarget);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
});
window.addEventListener('blur', pause);
window.addEventListener('keydown', (e) => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'Escape') {
        if (view === 'hud') pause();
        else if (view === 'pause-screen') resume();
        else if (view === 'registration-modal') $('cancel-reg').click();
        else if (view === 'game-over-screen') {
            if (resultReady()) $('game-over-screen').querySelector('[data-home]').click();
        } else if (view !== 'start-screen') back();
    } else if (e.code === 'KeyP' && (view === 'hud' || view === 'pause-screen')) {
        if (view === 'hud') pause();
        else resume();
    } else if (view === 'start-screen' && e.code === 'Enter' && document.activeElement === document.body) {
        e.preventDefault();
        startRun();
    }
});

// The only credential for this player's scores and name. The older mamdani_player_id was public, so it is never sent.
function playerKey() {
    let key = localStorage.getItem(scoreKey);
    if (!key) {
        key = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(scoreKey, key);
    }
    return key;
}
const ownKey = () => onlinePlay() ? localStorage.getItem(scoreKey) : null;

// Carry a nickname saved under the public ID over to the private key.
async function postSavedName(key) {
    const name = localStorage.getItem('mamdani_name');
    if (native || !name || localStorage.getItem(savedNameKey) === name) return;
    const result = await api.register(key, name, localStorage.getItem('mamdani_social') || '', installed());
    if (result.ok && localStorage.getItem('mamdani_name') === name) localStorage.setItem(savedNameKey, name);
}
const installed = () =>
    Capacitor.isNativePlatform() ||
    matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;
if (!installed()) {
    if (/iPhone|iPad/i.test(navigator.userAgent))
        $('pwa-prompt').textContent = 'To install on iOS, open Share and choose Add to Home Screen.';
    else if (/Android/i.test(navigator.userAgent))
        $('pwa-prompt').textContent = 'Choose Install app in your browser menu to keep the game.';
}
// The last frame of a lost race shows whoever actually won it.
function finishPhoto(canvas, { rival, camera }) {
    const head = rival?.root.getObjectByName('mixamorigHead');
    if (!head) return null;
    const { width, height } = canvas;
    const place = head.getWorldPosition(rival.root.position.clone());
    const feet = rival.root.position.clone().project(camera).y;
    place.project(camera);
    const body = (place.y - feet) / 2 * height;
    const w = Math.min(width, body * 1.5), h = w / 2;
    const x = Math.max(0, Math.min(width - w, (place.x + 1) / 2 * width - w / 2));
    const y = Math.max(0, Math.min(height - h, (1 - place.y) / 2 * height - Math.min(h * .42, body * .2)));
    const photo = document.createElement('canvas');
    photo.width = 960;
    photo.height = 480;
    photo.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, 960, 480);
    return photo;
}

function showResultArt(overtime, rival, photo) {
    const figure = $('result-illustration');
    figure.dataset.rival = rival?.id ?? '';
    if (rival && rival.id !== 'donald') {
        const caption = document.createElement('figcaption');
        caption.textContent = rival.name;
        if (photo) {
            photo.setAttribute('role', 'img');
            photo.setAttribute('aria-label', rival.name + ' at the finish line.');
            figure.replaceChildren(photo, caption);
        } else figure.replaceChildren(caption);
        return;
    }
    const file = overtime ? 'takeover-finish.webp' : 'american-finish.webp';
    const src = import.meta.env.BASE_URL + 'art/' + file;
    const previous = figure.querySelector('img');
    if (previous?.getAttribute('src') === src) return;
    // A reused img can keep painting its previous portrait while the new source loads.
    const art = new Image(1050, 700);
    art.id = 'result-art';
    art.alt = overtime
        ? 'Zohran Mamdani before gray New York towers, between a Palestinian flag and a red banner bearing a gold hammer and sickle.'
        : 'Donald Trump waves at a New York race with a United States flag behind him.';
    art.decoding = 'async';
    art.src = src;
    figure.replaceChildren(art);
}

// The bar under the stamp receipt. The shop can move it while the front page waits.
function paintGoal() {
    const goal = walletAvailable ? nextGoal(wallet) : null;
    $('result-meter').parentElement.hidden = !goal;
    if (!walletAvailable) $('result-progress').textContent = 'Stamp wallet unavailable on this device.';
    else if (!goal) $('result-progress').textContent = 'Everything in the shop is yours.';
    else {
        const left = Math.round(10 * (goal.need - goal.have)) / 10;
        $('result-meter').style.transform = 'scaleX(' + Math.max(0, Math.min(1, goal.have / goal.need)) + ')';
        $('result-progress').textContent = left <= 0 ? goal.name + ' is in reach. Open the shop.'
            : goal.unlock ? stampCount(left) + ' to Night Shift'
            : stampCount(left) + ' to ' + goal.name + ' (' + stampCount(goal.need) + ')';
    }
    $('result-wallet').textContent = walletAvailable ? walletBalance(wallet).toLocaleString() : '—';
}

async function finish(attempt, score, gross, cause, stats) {
    if (activeAttempt !== attempt) return;
    activeAttempt = null;
    const version = ++resultVersion;
    const night = attempt.mode === 'night';
    const { cleanMoves, familyWins } = run;
    const { overtime } = run.world;
    const caught = !!run.capture;
    const seconds = Math.floor(run.elapsed);
    const result = settleScore(attempt, score);
    lastResult = result;
    let receipt;
    try {
        receipt = await attempt.bank(gross, score);
        if (receipt.unlocked) track('unlock_achievement', { achievement_id: 'night_shift' });
        wallet = receipt.wallet;
        walletAvailable = true;
    } catch {
        walletAvailable = false;
    }
    track('game_end', { run_mode: attempt.mode, score, distance_m: stats.metres, best_multiplier: stats.bestMultiplier, stamps_collected: gross, stamps_kept: receipt?.kept ?? 0, clean_moves: cleanMoves });
    if (version !== resultVersion) return;
    const issue = (Number(localStorage.getItem('mamdani_edition')) || 0) + 1;
    localStorage.setItem('mamdani_edition', String(issue));
    const rival = RIVALS.find(racer => cause === 'race:' + racer.id);
    const { slug, headline, copy } = frontPage(cause, issue - 1, { overtime, caught });
    const newBest = score > attempt.previousBest;
    $('result-edition').textContent = modeNames[attempt.mode] + (overtime ? ' · Overtime' : '') + ' · No. ' + issue;
    $('result-slug').textContent = rival ? slug + ' · ' + rival.name + ' wins' : slug;
    $('result-headline').textContent = headline;
    showResultArt(overtime, rival, attempt.photo);
    $('result-copy').textContent = copy;
    $('final-moves').textContent = cleanMoves;
    $('run-seconds').textContent = seconds + ' second' + (seconds === 1 ? '' : 's');
    $('final-distance').textContent = points(score);
    $('final-metres').textContent = metres(stats.metres);
    $('final-style').textContent = points(stats.stylePoints);
    $('final-multiplier').textContent = 'x' + stats.bestMultiplier;
    $('final-gross').textContent = gross.toLocaleString();
    $('final-tax').textContent = receipt ? receipt.tax.toLocaleString() : '—';
    $('result-banked').textContent = receipt ? '+' + stampCount(receipt.kept) + ' banked' : 'Stamps could not be saved';
    paintGoal();
    if (receipt?.unlocked) $('result-progress').textContent = 'Night Shift unlocked!';
    $('play-night').hidden = !receipt?.unlocked;
    $('result-family').textContent = familyWins + '/' + RIVALS.length;
    $('result-new-best').hidden = !newBest;
    $('result-best-label').textContent = newBest ? 'Previous best' : night ? 'Night Shift best' : 'Day Run best';
    $('pb-score').closest('dl').hidden = newBest && !attempt.previousBest;
    $('pb-score').textContent = points(newBest ? attempt.previousBest : bestFor(attempt.mode));
    $('pb-rank-display').textContent = '';
    $('result-unranked').hidden = true;
    $('result-online-settings').hidden = !native && onlinePlay();
    $('day-board').open = false;
    $('result-details').open = false;
    recordReadAt = undefined;
    resultShownAt = performance.now();
    show('game-over-screen', 'restart-btn');
    document.querySelector('.result-page').scrollTop = 0;
    if (newBest) setTimeout(() => { if (version === resultVersion) sound.play('newBest'); }, 650);
    loadBoard(version, result);
}

const shareButton = $('share-btn');
shareButton.hidden = !navigator.share && !navigator.clipboard?.writeText;
shareButton.onclick = async () => {
    if (!lastResult) return;
    const label = shareButton.querySelector('span');
    const text = 'I scored ' + points(lastResult.score) + ' in Mamdani Run. Trump has the receipts.';
    const url = 'https://mamdanirun.com';
    try {
        if (navigator.share) return await navigator.share({ title: 'Mamdani Run', text, url });
        await navigator.clipboard.writeText(text + ' ' + url);
        label.textContent = 'Copied';
    } catch (error) {
        if (error.name === 'AbortError') return;
        label.textContent = 'Could not share';
    }
    setTimeout(() => { label.textContent = 'Share'; }, 2200);
};

function settleScore(attempt, score) {
    if (attempt.result) return attempt.result;
    if (attempt.mode === 'day') localStorage.setItem('mamdani_best_score', Math.max(best(), score));
    const result = attempt.result = { key: attempt.key, ticket: attempt.ticket, mode: attempt.mode, score };
    if (result.key) postScore(result);
    return result;
}

function postScore(result, retry = false) {
    if (retry && result.submitFailed) {
        result.rank = null;
        result.submitFailed = false;
    }
    return result.rank ??= Promise.resolve(result.ticket).then(issued => issued
        ? api.submitSeasonScore({ key: result.key, ticket: issued.ticket, mode: result.mode, score: result.score })
        : { ok: false, unranked: true }
    ).then(rank => {
        result.submitFailed = !rank.ok;
        return rank;
    });
}

function showStandings(list, entries) {
    list.replaceChildren();
    if (!entries?.length) {
        list.textContent = entries ? 'No scores yet. The first ranked run takes the record.' : 'The standings could not be loaded.';
        return;
    }
    const table = document.createElement('table');
    table.setAttribute('aria-label', 'Global leaderboard');
    const header = table.createTHead().insertRow();
    for (const label of ['Rank', 'Runner', 'Score']) {
        const column = document.createElement('th');
        column.scope = 'col';
        column.textContent = label;
        header.append(column);
    }
    const rows = table.createTBody();
    entries.forEach((entry, index) => {
        const row = rows.insertRow();
        row.className = 'leaderboard-item';
        if (index < 3) row.dataset.medal = index + 1;
        const rank = document.createElement('b');
        rank.textContent = index + 1;
        row.insertCell().append(rank);
        const runner = row.insertCell();
        const name = document.createElement('bdi');
        name.textContent = entry.name || 'Anonymous';
        runner.append(name);
        if (entry.you) {
            row.classList.add('own');
            const you = document.createElement('small');
            you.className = 'rank-owner';
            you.textContent = 'You';
            runner.append(you);
        }
        if (!native && entry.social) {
            const link = document.createElement('a');
            const handle = String(entry.social).replace(/^@/, '');
            link.textContent = '@' + handle;
            link.href = 'https://truthsocial.com/@' + encodeURIComponent(handle);
            link.target = '_blank';
            link.rel = 'noopener';
            runner.append(link);
        }
        row.insertCell().textContent = points(entry.score);
    });
    list.append(table);
    scrollToOwn(list);
}

// The own row also sticks to the edge of the list, so it stays readable at any scroll position.
function scrollToOwn(list) {
    const own = list.querySelector('.own');
    list.scrollTop = own ? own.offsetTop - (list.clientHeight - own.offsetHeight) / 2 : 0;
}

// Counted from the player's best, which is what the board ranks.
function chaseLine(entries, { rank, bestScore }) {
    const listed = entries?.findIndex(entry => entry.you) ?? -1;
    const position = listed >= 0 ? listed + 1 : rank;
    if (!(position > 0)) return '';
    const place = 'Season rank #' + position;
    if (position === 1) return place + '. The record is yours.';
    if (listed > 0) return place + ' · ' + points(entries[listed - 1].score - entries[listed].score + 1) + ' points to #' + listed;
    if (entries?.length === 50) return place + ' · ' + points(entries[49].score - bestScore + 1) + ' points to the top 50';
    return place;
}

async function standings(list, retry, current) {
    list.textContent = 'Loading standings…';
    retry.hidden = true;
    const entries = await api.getSeasonLeaderboard(50, ownKey());
    if (current()) {
        showStandings(list, entries);
        retry.hidden = entries !== null;
    }
    return entries;
}

function paintRankPrompt(entries) {
    const own = entries?.find(entry => entry.you);
    const named = !!localStorage.getItem('mamdani_name');
    $('rankings-prompt').classList.toggle('callout', !named);
    $('rankings-prompt-copy').textContent = named ? (own || !entries ? '' : 'Your best is below the top 50.')
        : own ? 'You’re listed as ' + (own.name || 'Anonymous') + '.'
        : onlinePlay() ? 'Put a name to your next run.' : 'Online play is off, so your runs are not posted.';
}

let standingsRequest = 0;
async function openRankings(focus = 'close-rankings') {
    const request = ++standingsRequest;
    const current = () => view === 'rankings-screen' && request === standingsRequest;
    show('rankings-screen', focus);
    $('rankings-list').scrollTop = 0;
    paintRankPrompt(null);
    const entries = await standings($('rankings-list'), $('rankings-retry'), current);
    if (!current() || !entries) return;
    paintRankPrompt(entries);
    scrollToOwn($('rankings-list'));
}
$('rankings-btn').onclick = () => {
    remember();
    openRankings();
};
$('rankings-retry').onclick = () => openRankings();
$('close-rankings').onclick = back;
$('day-board').ontoggle = () => { if ($('day-board').open) scrollToOwn($('leaderboard-list')); };

async function loadBoard(version, result, retryScore = false) {
    if (!result) return;
    const current = () => version === resultVersion && result === lastResult;
    const list = $('leaderboard-list');
    const retry = $('result-board-retry');
    if (!result.key) {
        $('pb-rank-display').textContent = onlinePlay()
            ? 'Your next run can appear on the leaderboard.'
            : 'Online play is off. Score saved on this device.';
        await standings(list, retry, current);
        return;
    }
    list.textContent = 'Updating season standings…';
    retry.hidden = true;
    const rank = await postScore(result, retryScore);
    if (!current()) return;
    if (!rank.ok) {
        $('result-unranked').hidden = false;
        $('result-unranked').textContent = rank.unranked ? 'Not ranked. No connection at the start.'
            : rank.rejected ? 'Not ranked. The board turned this run down.'
            : 'Not posted yet. Open the leaderboard and tap Retry.';
        $('pb-rank-display').textContent = 'Score saved on this device.';
    } else $('result-unranked').hidden = true;
    const entries = await standings(list, retry, current);
    if (!current()) return;
    if (!rank.ok) {
        if (!rank.unranked && !rank.rejected) {
            $('day-board').open = true;
            retry.hidden = false;
        }
        return;
    }
    $('pb-rank-display').textContent = chaseLine(entries, rank);
}
$('result-board-retry').onclick = () => loadBoard(++resultVersion, lastResult, true);
let nameReturn;
function updateNameButtons() {
    const named = !!localStorage.getItem('mamdani_name');
    $('rankings-name-btn').textContent = named ? 'Edit name' : 'Add a name';
    $('join-lb-btn').textContent = named ? 'Edit leaderboard name' : 'Add your name to the leaderboard';
}
function openNameEditor(button) {
    nameReturn = { screen: view, button };
    const name = localStorage.getItem('mamdani_name') || '';
    const enableOnline = !onlinePlay();
    $('reg-name').value = name;
    $('reg-name').required = !native || !name;
    $('reg-social').value = native ? '' : localStorage.getItem('mamdani_social') || '';
    $('reg-social-label').hidden = native;
    $('reg-social-label').open = !native && !!$('reg-social').value;
    $('reg-help').textContent = 'Your nickname appears in the public rankings.'
        + (native && name ? ' Leave it blank to appear as “iPhone runner”.' : '')
        + (enableOnline ? ' Saving turns on online play for your next run.' : '');
    $('reg-error').textContent = '';
    $('submit-score-btn').textContent = enableOnline ? 'Save and enable online play' : 'Save name';
    show('registration-modal', 'reg-name', nameReturn.screen);
}
function closeNameEditor() {
    if (nameReturn.screen === 'rankings-screen') return openRankings(nameReturn.button);
    show('game-over-screen', nameReturn.button);
    return loadBoard(++resultVersion, lastResult);
}
updateNameButtons();
$('rankings-name-btn').onclick = () => openNameEditor('rankings-name-btn');
$('join-lb-btn').onclick = () => openNameEditor('join-lb-btn');
$('cancel-reg').onclick = $('close-reg').onclick = closeNameEditor;
$('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const button = $('submit-score-btn');
    if (button.disabled) return;
    const name = $('reg-name').value.trim(),
        social = $('reg-social').value.trim();
    if ((!name && $('reg-name').required) || /[\p{Cc}\p{Cf}]/u.test(name)) {
        $('reg-error').textContent = 'Enter a display nickname up to 15 characters.';
        return;
    }
    button.disabled = true;
    $('cancel-reg').disabled = $('close-reg').disabled = true;
    $('reg-error').textContent = 'Saving…';
    const result = await api.register(playerKey(), name, social, installed());
    button.disabled = false;
    $('cancel-reg').disabled = $('close-reg').disabled = false;
    if (result.ok) {
        localStorage.setItem(savedNameKey, name);
        if (name) localStorage.setItem('mamdani_name', name);
        else localStorage.removeItem('mamdani_name');
        localStorage.setItem(onlineKey, 'on');
        if (native) localStorage.removeItem('mamdani_social');
        else if (social) localStorage.setItem('mamdani_social', social);
        else localStorage.removeItem('mamdani_social');
        updateNameButtons();
        closeNameEditor();
    } else $('reg-error').textContent = 'Couldn’t save your name. Try again.';
};
$('feedback-form').onsubmit = async (e) => {
    e.preventDefault();
    const message = $('feedback-msg').value.trim();
    if (!message) return;
    $('send-feedback-btn').disabled = true;
    const response = await api.sendFeedback(playerKey(), message);
    $('send-feedback-btn').disabled = false;
    $('feedback-status').textContent = response.ok
        ? 'Feedback sent. Thank you.'
        : 'Could not send. Try again.';
    if (response.ok) $('feedback-msg').value = '';
};
