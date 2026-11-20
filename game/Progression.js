export const NIGHT_SHIFT_STAMPS = 30;
export const emptyWallet = Object.freeze({ stamps: 0, nightBest: 0 });

export function availableMode(requested, wallet) {
    return requested === 'night' && wallet.stamps >= NIGHT_SHIFT_STAMPS ? 'night' : 'day';
}

export function creditRun(wallet, { mode, kept, distance }) {
    return {
        stamps: wallet.stamps + kept,
        nightBest: mode === 'night' ? Math.max(wallet.nightBest, distance) : wallet.nightBest
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
        const transaction = db.transaction('wallet', run ? 'readwrite' : 'readonly');
        const store = transaction.objectStore('wallet');
        const read = store.get('balance');
        let receipt;
        read.onsuccess = () => {
            const previous = read.result ?? emptyWallet;
            const wallet = run ? creditRun(previous, run) : previous;
            if (run) store.put(wallet, 'balance');
            receipt = {
                wallet,
                unlocked: previous.stamps < NIGHT_SHIFT_STAMPS && wallet.stamps >= NIGHT_SHIFT_STAMPS
            };
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
        bank(kept, distance) {
            return receipt ??= transact({ mode, kept, distance });
        }
    };
}
