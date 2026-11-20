import { stampReceipt } from './ScoreManager.js';
import { RIVALS } from './FamilyRace.js';

export const NIGHT_SHIFT_STAMPS = 150;
export const SPEED_PRICES = Object.freeze([3, 8, 16, 28, 45]);
const initialBalance = Object.freeze({ stamps: 0, tenths: 0, nightBest: 0, nightUnlocked: false, legacyStamps: 0 });
const initialTraining = Object.freeze({ spent: 0, speedLevel: 0, familyBest: 0 });
export const emptyWallet = Object.freeze({ ...initialBalance, ...initialTraining });

export function walletBalance(wallet) {
    return wallet.stamps + wallet.tenths / 10;
}

export function walletLifetime(wallet) {
    return wallet.stamps + (wallet.spent ?? 0) + wallet.tenths / 10;
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
    const nightUnlocked = wallet.nightUnlocked || legacyStamps >= 30 || nightBest > 0 || stamps + (wallet.spent ?? 0) >= NIGHT_SHIFT_STAMPS;
    if (legacyStamps === wallet.legacyStamps && nightBest === wallet.nightBest && nightUnlocked === wallet.nightUnlocked) return wallet;
    return { ...wallet, stamps, legacyStamps, nightBest, nightUnlocked };
}

export function creditRun(previous, { mode, gross, distance }) {
    const { tax, keptTenths } = stampReceipt(gross);
    const tenths = previous.tenths + keptTenths;
    const stamps = previous.stamps + Math.floor(tenths / 10);
    const nightUnlocked = previous.nightUnlocked || stamps + (previous.spent ?? 0) >= NIGHT_SHIFT_STAMPS;
    return {
        gross, tax, kept: keptTenths / 10,
        unlocked: nightUnlocked && !previous.nightUnlocked,
        wallet: {
            ...previous, stamps, tenths: tenths % 10, nightUnlocked,
            nightBest: mode === 'night' ? Math.max(previous.nightBest, distance) : previous.nightBest
        }
    };
}

export function upgradeSpeed(wallet, expectedLevel) {
    const price = SPEED_PRICES[wallet.speedLevel];
    if (price === undefined) return { wallet, status: 'max' };
    if (expectedLevel !== wallet.speedLevel) return { wallet, status: 'changed' };
    if (wallet.stamps < price) return { wallet, status: 'short' };
    return {
        status: 'bought',
        wallet: { ...wallet, stamps: wallet.stamps - price, spent: wallet.spent + price, speedLevel: wallet.speedLevel + 1 }
    };
}

let database;
const changes = typeof window !== 'undefined' && window.BroadcastChannel ? new BroadcastChannel('mamdani_wallet') : null;
export function onWalletChange(listener) {
    changes?.addEventListener('message', listener);
}

export function openWallet() {
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

async function walletTransaction(run, updateTraining) {
    const db = await openWallet();
    return new Promise((resolve, reject) => {
        // Old tabs still credit balance-v2. Keep all earnings there and charge purchases separately.
        const transaction = db.transaction('wallet', 'readwrite');
        const store = transaction.objectStore('wallet');
        const legacy = store.get('balance');
        const balance = store.get('balance-v2');
        const training = store.get('training');
        let receipt;
        let changed = false;
        training.onsuccess = () => {
            const saved = balance.result ?? initialBalance;
            const earnings = importLegacy(saved, legacy.result);
            const bank = run ? creditRun(earnings, run) : { wallet: earnings };
            if (bank.wallet !== saved) {
                store.put(bank.wallet, 'balance-v2');
                changed = true;
            }
            const progress = training.result ?? initialTraining;
            const wallet = { ...bank.wallet, ...progress, stamps: bank.wallet.stamps - progress.spent };
            receipt = updateTraining ? updateTraining(wallet) : { ...bank, wallet };
            if (receipt.wallet !== wallet) {
                const { spent, speedLevel, familyBest } = receipt.wallet;
                store.put({ spent, speedLevel, familyBest }, 'training');
                changed = true;
            }
        };
        transaction.oncomplete = () => {
            resolve(receipt);
            if (changed) changes?.postMessage(null);
        };
        transaction.onabort = () => reject(transaction.error ?? new Error('Stamp wallet write interrupted.'));
    });
}

export async function readWallet() {
    return (await walletTransaction()).wallet;
}

export function purchaseSpeedUpgrade(expectedLevel) {
    return walletTransaction(null, wallet => upgradeSpeed(wallet, expectedLevel));
}

export async function recordFamilyWin(completedCount) {
    if (!Number.isInteger(completedCount) || completedCount < 1 || completedCount > RIVALS.length) {
        throw new RangeError('Unknown family race.');
    }
    const result = await walletTransaction(null, wallet => ({
        wallet: completedCount > wallet.familyBest ? { ...wallet, familyBest: completedCount } : wallet
    }));
    return result.wallet;
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
