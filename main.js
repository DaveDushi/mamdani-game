import { Capacitor } from '@capacitor/core';
import { setupPosters } from './game/Posters.js';
import { frontPage } from './game/CityWire.js';
import { RIVALS } from './game/FamilyRace.js';
import { Shop } from './game/Shop.js';
import { startAnalytics, track, trackScreen, setupSupportLinks } from './game/Analytics.js';
import { Sound } from './game/Sound.js';
import { loadCast, loadMayor, loadOutfit } from './game/Cast.js';
import { ApiClient } from './game/ApiClient.js';
import {
    NIGHT_SHIFT_STAMPS, availableMode, emptyWallet, onWalletChange, purchaseSpeedUpgrade,
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
    'instructions-modal',
    'shop-screen',
    'poster-room',
    'rankings-screen',
    'registration-modal',
    'feedback-modal'
];
const sound = new Sound(),
    api = new ApiClient();
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
    wallet = emptyWallet,
    walletAvailable = true;
const shop = new Shop(() => updatePreview(), async expectedLevel => {
    const result = await purchaseSpeedUpgrade(expectedLevel);
    wallet = result.wallet;
    walletAvailable = true;
    return result;
}, () => fittingRoom?.resize());
const best = () => Number(localStorage.getItem('mamdani_best_score')) || 0;
const modeKey = 'mamdani_run_type';
const modeNames = { day: 'Day Run', night: 'Night Shift' };
const selectedMode = () => availableMode(localStorage.getItem(modeKey), wallet);
const metres = (n) => Number(n).toLocaleString() + ' m';
const stampCount = (n) => n.toLocaleString() + (n === 1 ? ' stamp' : ' stamps');
const homeOverlay = new Set(['story-modal', 'instructions-modal', 'feedback-modal']);
function show(id, focus) {
    if (view !== id) {
        entryVersion++;
        clearStartButton();
        trackScreen(id);
    }
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
    const unlocked = wallet.nightUnlocked;
    const balance = walletBalance(wallet);
    $('mode-night').disabled = !unlocked;
    $('night-lock').toggleAttribute('hidden', unlocked);
    $('mode-day').setAttribute('aria-pressed', String(mode === 'day'));
    $('mode-night').setAttribute('aria-pressed', String(mode === 'night'));
    $('menu-wallet').textContent = unlocked
        ? stampCount(balance) + ' banked · Night Shift unlocked'
        : wallet.spent ? 'Wallet · ' + balance.toLocaleString() + ' · Night Shift ' + walletLifetime(wallet).toLocaleString() + '/' + NIGHT_SHIFT_STAMPS
        : balance.toLocaleString() + '/' + NIGHT_SHIFT_STAMPS + ' stamps banked to unlock Night Shift';
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
function home() {
    document.querySelector('.wire p').textContent = dispatches[dispatchIndex++ % dispatches.length];
    if (run) run.stop();
    else fittingRoom?.close();
    activeAttempt = null;
    resultVersion++;
    $('load-status').hidden = true;
    show('start-screen');
    paintMenu();
    refreshWallet();
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
$('turn-left').onclick = () => fittingRoom?.rotate(-Math.PI / 4);
$('turn-right').onclick = () => fittingRoom?.rotate(Math.PI / 4);
let lastDrag = null;
$('shop-screen').addEventListener('pointerdown', (e) => {
    if (e.target !== $('shop-screen')) return;
    lastDrag = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
});
$('shop-screen').addEventListener('pointermove', (e) => {
    if (lastDrag !== null) {
        fittingRoom?.rotate((e.clientX - lastDrag) * 0.014);
        lastDrag = e.clientX;
    }
});
for (const type of ['pointerup', 'pointercancel'])
    $('shop-screen').addEventListener(type, () => {
        lastDrag = null;
    });
setupPosters(() => show('poster-room', 'poster-next'));
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
    show('shop-screen', 'show-training');
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
    status = button === $('start-btn') ? $('load-status') : $('result-load-status');
    status.hidden = false;
    status.textContent = 'Loading street…';
    try {
        const ready = getStreet(ticket);
        let openingRecord = api.getSeasonRecord();
        sound.unlock();
        const [street] = await Promise.all([ready, refreshWallet(), afterPaint()]);
        if (entryVersion !== ticket || !street) return;
        const attempt = {
            ...startAttempt(availableMode(requested ?? selectedMode(), wallet)),
            playerId: playerId()
        };
        const attemptId = newId();
        const recordProvider = {
            getRecord() {
                const request = openingRecord ?? api.getSeasonRecord();
                openingRecord = null;
                return request;
            },
            claim: score => api.claimSeasonRecord({ playerId: attempt.playerId, attemptId, score, mode: attempt.mode })
        };
        activeAttempt = attempt;
        street.onEnd = (distance, gross, cause) => finish(attempt, distance, gross, cause);
        street.onRaceWin = count => recordFamilyWin(count).catch(() => { walletAvailable = false; });
        // Bank at the tape even if the player leaves before opening Results.
        street.onRaceLoss = (gross, distance) => {
            settleScore(attempt, distance);
            attempt.bank(gross, distance).catch(() => { walletAvailable = false; });
        };
        resultVersion++;
        show('hud');
        street.start(attempt.mode, wallet.speedLevel, recordProvider);
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
$('restart-btn').onclick = event => startRun(lastResult.mode, event.currentTarget);
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
        else if (view === 'rankings-screen') $('close-rankings').click();
        else if (view === 'registration-modal') show('game-over-screen', 'join-lb-btn');
        else if (view !== 'start-screen') home();
    } else if (e.code === 'KeyP' && (view === 'hud' || view === 'pause-screen')) {
        if (view === 'hud') pause();
        else resume();
    } else if (view === 'start-screen' && e.code === 'Enter' && document.activeElement === document.body) {
        e.preventDefault();
        startRun();
    }
});

function newId() {
    return crypto.randomUUID?.() ??
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
            ((c === 'x' ? Math.random() * 16 : 8 + Math.random() * 4) | 0).toString(16)
        );
}

function playerId() {
    let id = localStorage.getItem('mamdani_player_id');
    if (!id) {
        id = newId();
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
async function finish(attempt, distance, gross, cause) {
    if (activeAttempt !== attempt) return;
    activeAttempt = null;
    const version = ++resultVersion;
    const night = attempt.mode === 'night';
    const cleanMoves = run.cleanMoves;
    const familyWins = run.familyWins;
    const seconds = Math.floor(run.elapsed);
    const result = settleScore(attempt, distance);
    lastResult = result;
    let receipt;
    try {
        receipt = await attempt.bank(gross, distance);
        if (receipt.unlocked) track('unlock_achievement', { achievement_id: 'night_shift' });
        wallet = receipt.wallet;
        walletAvailable = true;
    } catch {
        walletAvailable = false;
    }
    track('game_end', { run_mode: attempt.mode, distance_m: distance, stamps_collected: gross, stamps_kept: receipt?.kept ?? 0, clean_moves: cleanMoves });
    if (version !== resultVersion) return;
    const issue = (Number(localStorage.getItem('mamdani_edition')) || 0) + 1;
    localStorage.setItem('mamdani_edition', String(issue));
    const rival = RIVALS.find(racer => cause === 'race:' + racer.id);
    const [headline, copy] = rival
        ? [rival.name + ' takes the tape.', 'The flag goes up. City Hall files to move the finish line back.']
        : frontPage(cause, issue - 1);
    $('result-edition').textContent = modeNames[attempt.mode] + ' · No. ' + issue;
    $('result-headline').textContent = headline;
    if (!$('result-art').hasAttribute('src')) $('result-art').src = import.meta.env.BASE_URL + 'art/american-finish.webp';
    $('result-copy').textContent = copy;
    $('final-moves').textContent = cleanMoves;
    $('run-seconds').textContent = seconds + ' second' + (seconds === 1 ? '' : 's');
    $('final-distance').textContent = metres(distance);
    $('final-gross').textContent = gross.toLocaleString();
    $('final-tax').textContent = receipt ? receipt.tax.toLocaleString() : '—';
    $('result-banked').textContent = receipt ? '+' + stampCount(receipt.kept) + ' banked' : 'Stamps could not be saved';
    const balance = walletBalance(wallet);
    $('result-wallet').textContent = receipt ? 'Wallet · ' + balance.toLocaleString() : '';
    const remaining = NIGHT_SHIFT_STAMPS - walletLifetime(wallet);
    $('result-progress').textContent = !receipt ? 'Stamp wallet unavailable on this device.'
        : receipt.unlocked ? 'Night Shift unlocked!'
        : !wallet.nightUnlocked ? stampCount(remaining) + ' to unlock Night Shift.'
        : 'Night Shift unlocked';
    $('play-night').hidden = !receipt?.unlocked;
    const familyLine = 'Family races · ' + familyWins + '/' + RIVALS.length + ' this run';
    $('result-family').textContent = walletAvailable && wallet.familyBest > familyWins
        ? familyLine + ' · Best ' + wallet.familyBest + '/' + RIVALS.length
        : familyLine;
    $('result-progress').parentElement.classList.toggle('just-unlocked', !!receipt?.unlocked);
    $('result-best-label').textContent = night ? 'Night Shift best on this device' : 'Day Run best on this device';
    $('pb-score').textContent = metres(night ? wallet.nightBest : best());
    $('pb-rank-display').textContent = '';
    $('join-lb-btn').hidden = !!localStorage.getItem('mamdani_name');
    document.querySelector('.results').scrollTop = 0;
    show('game-over-screen', 'restart-btn');
    loadBoard(version, result);
}

function settleScore(attempt, distance) {
    if (attempt.result) return attempt.result;
    if (attempt.mode === 'day') localStorage.setItem('mamdani_best_score', Math.max(best(), distance));
    const result = attempt.result = { playerId: attempt.playerId, mode: attempt.mode, distance };
    postScore(result);
    return result;
}

function postScore(result, retry = false) {
    if (retry && result.submitFailed) {
        result.rank = null;
        result.submitFailed = false;
    }
    return result.rank ??= api.submitSeasonScore({
        playerId: result.playerId, mode: result.mode, score: result.distance
    }).then(rank => {
        result.submitFailed = !rank.ok;
        return rank;
    });
}

function showStandings(list, entries) {
    list.replaceChildren();
    if (!entries?.length) {
        list.textContent = entries ? 'No scores on the season board yet.' : 'The standings could not be loaded.';
        return;
    }
    const rows = document.createDocumentFragment();
    entries.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-item';
        const place = document.createElement('b');
        const name = document.createElement('span');
        const value = document.createElement('b');
        place.textContent = index + 1;
        name.textContent = entry.name || 'Anonymous';
        value.textContent = metres(entry.score);
        if (entry.social) {
            const link = document.createElement('a');
            const handle = String(entry.social).replace(/^@/, '');
            link.textContent = '@' + handle;
            link.href = 'https://truthsocial.com/@' + encodeURIComponent(handle);
            link.target = '_blank';
            link.rel = 'noopener';
            name.append(link);
        }
        row.append(place, name, value);
        rows.append(row);
    });
    list.append(rows);
}

async function standings(list, retry, current) {
    list.textContent = 'Loading standings…';
    retry.hidden = true;
    const entries = await api.getSeasonLeaderboard(50);
    if (current()) {
        showStandings(list, entries);
        retry.hidden = entries !== null;
    }
    return entries;
}

let standingsRequest = 0;
function openRankings() {
    const request = ++standingsRequest;
    show('rankings-screen', 'close-rankings');
    return standings($('rankings-list'), $('rankings-retry'), () => view === 'rankings-screen' && request === standingsRequest);
}
$('rankings-btn').onclick = openRankings;
$('rankings-retry').onclick = openRankings;
$('close-rankings').onclick = () => {
    home();
    $('rankings-btn').focus({ preventScroll: true });
};

async function loadBoard(version, result, retryScore = false) {
    if (!result) return;
    const current = () => version === resultVersion && result === lastResult;
    const list = $('leaderboard-list');
    const retry = $('result-board-retry');
    list.textContent = 'Updating season standings…';
    retry.hidden = true;
    const rank = await postScore(result, retryScore);
    if (!current()) return;
    if (!rank.ok) $('pb-rank-display').textContent = ' · Saved locally. Tap Retry to post.';
    const entries = await standings(list, retry, current);
    if (!current()) return;
    if (!rank.ok) {
        retry.hidden = false;
        return;
    }
    const listed = entries?.findIndex(entry => entry.player_id === result.playerId) ?? -1;
    const position = listed >= 0 ? listed + 1 : rank.rank;
    $('pb-rank-display').textContent = position > 0 ? ' · Season rank #' + position : '';
}
$('result-board-retry').onclick = () => loadBoard(++resultVersion, lastResult, true);
$('join-lb-btn').onclick = () => show('registration-modal', 'reg-name');
$('cancel-reg').onclick = () => show('game-over-screen', 'join-lb-btn');
$('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const button = $('submit-score-btn');
    if (button.disabled) return;
    const name = $('reg-name').value.trim(),
        social = $('reg-social').value.trim();
    if (!name) {
        $('reg-error').textContent = 'Enter a leaderboard name.';
        return;
    }
    const version = resultVersion;
    button.disabled = true;
    const result = await api.register(lastResult?.playerId ?? playerId(), name, social, installed());
    button.disabled = false;
    if (result.ok || result.updated) {
        localStorage.setItem('mamdani_name', name);
        if (social) localStorage.setItem('mamdani_social', social);
        else localStorage.removeItem('mamdani_social');
        if (view === 'registration-modal' && version === resultVersion) {
            show('game-over-screen', 'restart-btn');
            $('join-lb-btn').hidden = true;
            loadBoard(++resultVersion, lastResult);
        }
    } else $('reg-error').textContent = 'Couldn’t save your name. Try again.';
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
