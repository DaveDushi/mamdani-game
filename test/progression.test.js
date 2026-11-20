import assert from 'node:assert/strict';
import test from 'node:test';
import { NIGHT_SHIFT_STAMPS, SPEED_PRICES, availableMode, creditRun, emptyWallet, importLegacy, startAttempt, upgradeSpeed, walletBalance, walletLifetime } from '../game/Progression.js';
import { ScoreManager, stampReceipt } from '../game/ScoreManager.js';

const day = gross => ({ mode: 'day', gross, distance: 500 });

test('each new hundred takes 90 immediately and the finish taxes only the unaudited remainder', () => {
    const score = new ScoreManager();
    for (const [gross, held, tax, kept] of [
        [0, 0, 0, 0], [1, 1, 0.9, 0.1], [99, 99, 89.1, 9.9], [100, 10, 90, 10],
        [101, 11, 90.9, 10.1], [199, 109, 179.1, 19.9], [200, 20, 180, 20], [451, 91, 405.9, 45.1]
    ]) {
        score.addFoodStamps(gross - score.grossStamps);
        assert.equal(score.foodStamps, held);
        assert.equal(score.auditedGross, gross - gross % 100);
        assert.deepEqual(stampReceipt(gross), { gross, tax, keptTenths: kept * 10 });
        const result = creditRun(emptyWallet, day(gross));
        assert.equal(result.tax, tax);
        assert.equal(result.kept, kept);
        assert.equal(walletBalance(result.wallet), kept);
        assert.equal(score.foodStamps, held);
    }
    score.reset();
    assert.equal(score.foodStamps, 0);
    assert.equal(score.auditedGross, 0);
});

test('short runs carry exact tenths and unlock at the same gross total as a single run', () => {
    assert.equal(NIGHT_SHIFT_STAMPS, 150);
    for (const chunk of [1, 7, 10, 99, 100, 101, 207, 1499]) {
        let wallet = emptyWallet;
        for (let gross = 0; gross < 1499;) {
            const batch = Math.min(chunk, 1499 - gross);
            const result = creditRun(wallet, day(batch));
            wallet = result.wallet;
            gross += batch;
            assert.equal(wallet.stamps * 10 + wallet.tenths, gross);
            assert.equal(result.unlocked, false);
        }
        assert.equal(walletBalance(wallet), 149.9);
        assert.equal(availableMode('night', wallet), 'day');
        const finish = creditRun(wallet, day(1));
        assert.equal(finish.unlocked, true);
        assert.deepEqual(finish.wallet, creditRun(emptyWallet, day(1500)).wallet);
        assert.equal(availableMode('day', finish.wallet), 'day');
        assert.equal(availableMode('night', finish.wallet), 'night');
        assert.equal(creditRun(finish.wallet, day(100)).unlocked, false);
    }
});

test('a v1 balance and earned Night access migrate exactly once, including a later v1 finish', () => {
    const legacy = { stamps: 29, nightBest: 0 };
    const imported = importLegacy(emptyWallet, legacy);
    const atThirty = creditRun(imported, day(10)).wallet;
    assert.equal(walletBalance(atThirty), 30);
    assert.equal(availableMode('night', atThirty), 'day');
    assert.equal(importLegacy(atThirty, legacy), atThirty);
    const oldTab = { stamps: 30, nightBest: 0 };
    const grandfathered = importLegacy(atThirty, oldTab);
    assert.equal(walletBalance(grandfathered), 31);
    assert.equal(availableMode('night', grandfathered), 'night');
    assert.equal(importLegacy(grandfathered, oldTab), grandfathered);
    assert.equal(importLegacy(emptyWallet, { stamps: 30, nightBest: 0 }).nightUnlocked, true);
    assert.equal(importLegacy(emptyWallet, { stamps: 150, nightBest: 590 }).nightBest, 590);
    assert.equal(importLegacy(emptyWallet, undefined), emptyWallet);
});

test('repeated finish calls share a single wallet credit and replay earns its own receipt', async () => {
    let wallet = emptyWallet;
    let transactions = 0;
    const transact = async run => {
        await Promise.resolve();
        transactions++;
        const result = creditRun(wallet, run);
        wallet = result.wallet;
        return result;
    };
    const first = startAttempt('day', transact);
    const deposit = first.bank(9, 55);
    assert.equal(first.bank(9, 55), deposit);
    await Promise.all([deposit, first.bank(9, 55), startAttempt('day', transact).bank(1, 40)]);
    await first.bank(9, 55);
    assert.equal(transactions, 2);
    assert.equal(walletBalance(wallet), 1);
});

test('Night best stays separate while both modes bank stamps', () => {
    const opened = importLegacy(emptyWallet, { stamps: 30, nightBest: 150 });
    const night = creditRun(opened, { mode: 'night', gross: 105, distance: 234 }).wallet;
    const dayRun = creditRun(night, day(9)).wallet;
    assert.equal(dayRun.nightBest, 234);
    assert.equal(walletBalance(dayRun), 41.4);
    assert.equal(creditRun(dayRun, { mode: 'night', gross: 0, distance: 120 }).wallet.nightBest, 234);
});

test('a purchase charges the displayed level once and preserves fractional stamps', () => {
    const poor = creditRun(emptyWallet, day(29)).wallet;
    assert.deepEqual(upgradeSpeed(poor, 0), { wallet: poor, status: 'short' });
    const funded = creditRun(poor, day(2)).wallet;
    const bought = upgradeSpeed(funded, 0);
    assert.equal(bought.status, 'bought');
    assert.equal(walletBalance(bought.wallet), 0.1);
    assert.equal(walletLifetime(bought.wallet), 3.1);
    assert.deepEqual(upgradeSpeed(bought.wallet, 0), { wallet: bought.wallet, status: 'changed' });
    assert.deepEqual(upgradeSpeed(bought.wallet, 1), { wallet: bought.wallet, status: 'short' });
});

test('buying every level before Night Shift leaves the original unlock threshold intact', () => {
    let wallet = creditRun(emptyWallet, day(1499)).wallet;
    for (let level = 0; level < SPEED_PRICES.length; level++) {
        const purchase = upgradeSpeed(wallet, level);
        assert.equal(purchase.status, 'bought');
        assert.equal(purchase.wallet.stamps, wallet.stamps - SPEED_PRICES[level]);
        assert.equal(purchase.wallet.speedLevel, level + 1);
        assert.equal(walletLifetime(purchase.wallet), 149.9);
        assert.equal(purchase.wallet.nightUnlocked, false);
        wallet = purchase.wallet;
    }
    assert.equal(walletBalance(wallet), 49.9);
    assert.deepEqual(upgradeSpeed(wallet, 5), { wallet, status: 'max' });
    const bank = creditRun(wallet, day(1));
    assert.equal(bank.unlocked, true);
    assert.equal(walletBalance(bank.wallet), 50);
    assert.equal(walletLifetime(bank.wallet), 150);
    assert.equal(importLegacy(wallet, { stamps: 1, nightBest: 0 }).nightUnlocked, true);
});
