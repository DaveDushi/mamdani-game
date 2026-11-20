import { openWallet } from './Progression.js';

const destination = 'https://mamdanirun.com';
const formerSites = ['https://mamdanirun.cc', 'https://www.mamdanirun.cc'];
// Accept old-site messages only while the domain is ours (expires at 14:11:28 UTC).
const cutoff = Date.UTC(2026, 10, 21, 14);
const closed = 'The saved-game transfer window has closed.';
const ready = 'mamdani-save-ready';
const transfer = 'mamdani-save-copy';
const walletKeys = ['balance', 'balance-v2', 'training'];
const settingsKeys = ['best_score', 'edition', 'outfit', 'player_id', 'name', 'social', 'sound', 'run_type']
    .map(key => 'mamdani_' + key);

function readSettings() {
    return Object.fromEntries(settingsKeys.map(key => [key, localStorage.getItem(key)]).filter(([, value]) => value !== null));
}

async function readSave() {
    const db = await openWallet();
    const wallet = await new Promise((resolve, reject) => {
        const tx = db.transaction('wallet', 'readonly');
        const records = {};
        for (const key of walletKeys) {
            const read = tx.objectStore('wallet').get(key);
            read.onsuccess = () => { if (read.result !== undefined) records[key] = read.result; };
        }
        tx.oncomplete = () => resolve(records);
        tx.onabort = () => reject(tx.error);
    });
    return { wallet, settings: readSettings() };
}

async function copyToEmptySave({ wallet, settings }) {
    const db = await openWallet();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('wallet', 'readwrite');
        const store = tx.objectStore('wallet');
        const count = store.count();
        const added = [];
        let copied = false;
        count.onsuccess = () => {
            try {
                if (Date.now() >= cutoff) throw new Error(closed);
                if (count.result || Object.keys(readSettings()).length) return;
                for (const key of walletKeys) {
                    if (Object.hasOwn(wallet, key)) store.add(wallet[key], key);
                }
                for (const key of settingsKeys) {
                    if (typeof settings[key] !== 'string') continue;
                    localStorage.setItem(key, settings[key]);
                    added.push(key);
                }
                copied = true;
            } catch {
                tx.abort();
            }
        };
        tx.oncomplete = () => resolve(copied);
        tx.onabort = () => {
            for (const key of added) {
                if (localStorage.getItem(key) === settings[key]) localStorage.removeItem(key);
            }
            reject(tx.error ?? new Error('Could not save game progress.'));
        };
    });
}

export async function offerDomainMove() {
    if (!formerSites.includes(location.origin) || Date.now() >= cutoff) return;
    const button = document.getElementById('move-save');
    const dispatch = button.previousElementSibling;
    button.hidden = false;
    dispatch.hidden = true;
    let receiver;
    setTimeout(() => {
        button.hidden = true;
        dispatch.hidden = false;
        receiver = null;
    }, cutoff - Date.now());
    button.onclick = () => {
        if (Date.now() >= cutoff) return;
        receiver = window.open(destination + '/transfer-save.html', '_blank');
        if (!receiver) {
            button.textContent = 'Allow pop-ups, then copy your saved game';
        }
    };
    window.addEventListener('message', async event => {
        if (Date.now() >= cutoff || !receiver || event.source !== receiver || event.origin !== destination || event.data !== ready) return;
        const tab = receiver;
        receiver = null;
        let save;
        try { save = await readSave(); } catch { /* The receiver offers a retry on the original tab. */ }
        if (Date.now() < cutoff) tab.postMessage({ type: transfer, save }, destination);
    });
    try {
        const save = await readSave();
        if (Object.keys(save.wallet).length || Object.keys(save.settings).length) return;
        // Keep the old game playable when the new host is offline. A user who has
        // already started interacting with this page can finish here as well.
        const check = new Image();
        check.onload = () => {
            if (document.visibilityState !== 'visible' || navigator.userActivation?.hasBeenActive) return;
            const url = new URL(location.href);
            url.host = new URL(destination).host;
            location.replace(url.href);
        };
        check.src = destination + '/favicon.png';
    } catch { /* A browser with unavailable storage can keep playing on its current host. */ }
}

export function receiveDomainMove(status) {
    if (Date.now() >= cutoff) {
        status.textContent = closed;
        return;
    }
    const source = window.opener;
    if (location.origin !== destination || !source) {
        status.textContent = 'Open the copy link from your saved game on mamdanirun.cc.';
        return;
    }
    const timeout = setTimeout(() => {
        window.removeEventListener('message', receive);
        status.textContent = Date.now() >= cutoff ? closed : 'Could not reach the original tab. Keep it open and try its copy link again.';
    }, Math.min(cutoff - Date.now(), 20000));
    async function receive(event) {
        if (Date.now() >= cutoff || event.source !== source || !formerSites.includes(event.origin) || event.data?.type !== transfer) return;
        clearTimeout(timeout);
        window.removeEventListener('message', receive);
        try {
            if (await copyToEmptySave(event.data.save)) {
                location.replace('/');
            } else {
                status.textContent = 'This browser already has a saved game on mamdanirun.com. Both saves are intact.';
            }
        } catch {
            status.textContent = Date.now() >= cutoff ? closed : 'Your original save is still on mamdanirun.cc. Return to that tab and try again.';
        }
    }
    window.addEventListener('message', receive);
    for (const origin of formerSites) source.postMessage(ready, origin);
}
