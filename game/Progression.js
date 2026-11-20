import { stampReceipt } from './ScoreManager.js';

export const NIGHT_SHIFT_STAMPS = 150;
export const emptyWallet = Object.freeze({ stamps: 0, tenths: 0, nightBest: 0, nightUnlocked: false, legacyStamps: 0 });

export function walletBalance(wallet) {
    return wallet.stamps + wallet.tenths / 10;
}

export function availableMode(requested, wallet) {
    return requested === 'night' && wallet.nightUnlocked ? 'night' : 'day';
}

// The v1 client may still finish a run in another open tab. Import only its new earnings.
export function importLegacy(wallet, legacy) {
    if (!legacy) return wallet;
    const legacyStamps = Math.max(wallet.legacyStamps, legacy.stamps);
    const stamps = wallet.stamps + (legacyStamps - wallet.legacyStamps);
    const nightBest = Math.max(wallet.nightBest, legacy.nightBest);
    const nightUnlocked = wallet.nightUnlocked || legacyStamps >= 30 || nightBest > 0 || stamps >= NIGHT_SHIFT_STAMPS;
    if (legacyStamps === wallet.legacyStamps && nightBest === wallet.nightBest && nightUnlocked === wallet.nightUnlocked) return wallet;
    return { ...wallet, stamps, legacyStamps, nightBest, nightUnlocked };
}

export function creditRun(previous, { mode, gross, distance }) {
    const { tax, keptTenths } = stampReceipt(gross);
    const tenths = previous.tenths + keptTenths;
    const stamps = previous.stamps + Math.floor(tenths / 10);
    const nightUnlocked = previous.nightUnlocked || stamps >= NIGHT_SHIFT_STAMPS;
    return {
        gross, tax, kept: keptTenths / 10,
        unlocked: nightUnlocked && !previous.nightUnlocked,
        wallet: {
            ...previous, stamps, tenths: tenths % 10, nightUnlocked,
            nightBest: mode === 'night' ? Math.max(previous.nightBest, distance) : previous.nightBest
        }
    };
}

let database;
function openWallet() {
    if (!database) {
        database = new Promise((resolve, reject) => {
            const request = indexedDB.open('mamdani_progression', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('wallet');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        }).catch(error => {
            database = undefined;
            throw error;
        });
    }
    return database;
}

async function walletTransaction(run) {
    const db = await openWallet();
    return new Promise((resolve, reject) => {
        // A single read/write transaction also serializes finishes from different tabs.
        const transaction = db.transaction('wallet', 'readwrite');
        const store = transaction.objectStore('wallet');
        const legacy = store.get('balance');
        const read = store.get('balance-v2');
        let receipt;
        read.onsuccess = () => {
            const saved = read.result ?? emptyWallet;
            const wallet = importLegacy(saved, legacy.result);
            receipt = run ? creditRun(wallet, run) : { wallet };
            if (receipt.wallet !== saved) store.put(receipt.wallet, 'balance-v2');
        };
        transaction.oncomplete = () => resolve(receipt);
        transaction.onabort = () => reject(transaction.error ?? new Error('Stamp wallet write interrupted.'));
    });
}

export async function readWallet() {
    return (await walletTransaction()).wallet;
}

export function startAttempt(mode, transact = walletTransaction) {
    let receipt;
    return {
        mode,
        bank(gross, distance) {
            return receipt ??= transact({ mode, gross, distance });
        }
    };
}
