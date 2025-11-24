import * as BABYLON from '@babylonjs/core';
import { GameState } from './game/GameState.js';
import { World } from './game/World.js';
import { Player } from './game/Player.js';
import { ObstacleManager } from './game/ObstacleManager.js';
import { Input } from './game/Input.js';
import { ScoreManager } from './game/ScoreManager.js';
import { Trump } from './game/Trump.js';
import { PowerupManager } from './game/PowerupManager.js';
import { ParticleSystem } from './game/ParticleSystem.js';
import { Shop } from './game/Shop.js';
import { ApiClient } from './game/ApiClient.js';

// Canvas Setup
const canvas = document.getElementById('game-canvas');
const engine = new BABYLON.Engine(canvas, true);

// Scene Setup
const createScene = () => {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.53, 0.81, 0.92, 1); // Sky blue
    scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    scene.fogColor = new BABYLON.Color3(0.53, 0.81, 0.92);
    scene.fogStart = 7;
    scene.fogEnd = 100;
    scene.useRightHandedSystem = true;

    // Camera
    const isMobile = window.innerWidth < 768;
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, isMobile ? 17 : 10), scene);
    camera.setTarget(new BABYLON.Vector3(0, 0, -5));
    // camera.attachControl(canvas, true); // Debugging only

    // Lighting
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.6;

    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.position = new BABYLON.Vector3(5, 10, 5);
    dirLight.intensity = 0.8;

    // Shadows
    const shadowGenerator = new BABYLON.ShadowGenerator(1024, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;

    return { scene, camera, shadowGenerator };
};

const { scene, camera, shadowGenerator } = createScene();

// Game Components
const gameState = new GameState();
const world = new World(scene, shadowGenerator);
const player = new Player(scene, shadowGenerator);
const powerupManager = new PowerupManager(scene);
const obstacleManager = new ObstacleManager(scene, player, powerupManager, shadowGenerator);
const scoreManager = new ScoreManager();
const trump = new Trump(scene, shadowGenerator);
const input = new Input();
const particles = new ParticleSystem(scene);
const shop = new Shop(player, scoreManager);
const apiClient = new ApiClient();

// UI Elements
const startScreen = document.getElementById('start-screen');
const hud = document.getElementById('hud');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreEl = document.getElementById('score');
const foodStampsEl = document.getElementById('food-stamps');
const bestScoreEl = document.getElementById('best-score');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const shopBtn = document.getElementById('shop-btn');
const goHomeBtn = document.getElementById('go-home-btn');
const instructionsBtn = document.getElementById('instructions-btn');
const storyModal = document.getElementById('story-modal');
const instructionsModal = document.getElementById('instructions-modal');
const closeStoryBtn = document.getElementById('close-story-btn');
const closeInstructionsBtn = document.getElementById('close-instructions-btn');

// Leaderboard UI
const registrationModal = document.getElementById('registration-modal');
const submitScoreBtn = document.getElementById('submit-score-btn');
const joinLbBtn = document.getElementById('join-lb-btn');
const regNameInput = document.getElementById('reg-name');
const regSocialInput = document.getElementById('reg-social');
const regErrorMsg = document.getElementById('reg-error');
const leaderboardList = document.getElementById('leaderboard-list');
const pbScoreEl = document.getElementById('pb-score');
const pbRankDisplay = document.getElementById('pb-rank-display');

// Player Identity
let playerId = localStorage.getItem('mamdani_player_id');
if (!playerId) {
    playerId = crypto.randomUUID();
    localStorage.setItem('mamdani_player_id', playerId);
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
shopBtn.addEventListener('click', () => shop.show());
goHomeBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    gameState.setState('START');
});
instructionsBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    instructionsModal.classList.remove('hidden');
});
closeInstructionsBtn.addEventListener('click', () => {
    instructionsModal.classList.add('hidden');
    startScreen.classList.remove('hidden');
});
closeStoryBtn.addEventListener('click', () => {
    storyModal.classList.add('hidden');
    startScreen.classList.remove('hidden');
    localStorage.setItem('mamdani_story_seen', 'true');
});

// Leaderboard Events
submitScoreBtn.addEventListener('click', handleRegistration);
if (joinLbBtn) {
    joinLbBtn.addEventListener('click', () => {
        registrationModal.classList.remove('hidden');
    });
}

// Check Story
if (!localStorage.getItem('mamdani_story_seen')) {
    startScreen.classList.add('hidden');
    storyModal.classList.remove('hidden');
    storyModal.classList.add('flex');
}

window.addEventListener('resize', () => {
    engine.resize();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        gameState.setPaused(true);
    } else {
        gameState.setPaused(false);
    }
});

function startGame() {
    gameState.setState('PLAYING');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    registrationModal.classList.add('hidden');
    hud.classList.remove('hidden');

    world.reset();
    player.reset();
    obstacleManager.reset();
    scoreManager.reset();
    trump.reset();
    powerupManager.reset();
    particles.reset();
    scoreEl.innerText = scoreManager.getDisplayScore();
    foodStampsEl.innerText = scoreManager.foodStamps;

    // Update Best Score Display
    const savedBestScore = localStorage.getItem('mamdani_best_score') || 0;
    if (bestScoreEl) bestScoreEl.innerText = savedBestScore;

    // Process Player Events
    processPlayerEvents();

    // Update Powerup Bars
    updatePowerupBars();
}

async function gameOver() {
    gameState.setState('GAME_OVER');
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');

    const taxPaid = scoreManager.applyFinalTax();
    const finalScore = scoreManager.getDisplayScore();

    const finalDistanceEl = document.getElementById('final-distance');
    const finalTaxEl = document.getElementById('final-tax');

    if (finalDistanceEl) finalDistanceEl.innerText = `${finalScore}m`;
    if (finalTaxEl) finalTaxEl.innerText = `$${taxPaid}`;

    showLeaderboard(finalScore);

    const savedName = localStorage.getItem('mamdani_name');
    if (!savedName) {
        if (joinLbBtn) joinLbBtn.style.display = 'block';
    } else {
        if (joinLbBtn) joinLbBtn.style.display = 'none';
    }
}

async function handleRegistration() {
    const name = regNameInput.value.trim();
    const social = regSocialInput.value.trim();

    if (!name) {
        regErrorMsg.innerText = "NAME IS REQUIRED!";
        regErrorMsg.style.display = 'block';
        return;
    }

    regErrorMsg.style.display = 'none';
    submitScoreBtn.disabled = true;
    submitScoreBtn.innerText = "SUBMITTING...";

    const regResult = await apiClient.register(playerId, name, social);

    if (regResult.ok || regResult.updated) {
        localStorage.setItem('mamdani_name', name);
        if (social) localStorage.setItem('mamdani_social', social);

        const score = scoreManager.getDisplayScore();
        await apiClient.submitScore(playerId, score);

        registrationModal.classList.add('hidden');
        showLeaderboard(score);
        if (joinLbBtn) joinLbBtn.style.display = 'none';

    } else {
        regErrorMsg.innerText = "ERROR REGISTERING. TRY AGAIN.";
        regErrorMsg.style.display = 'block';
    }

    submitScoreBtn.disabled = false;
    submitScoreBtn.innerText = "SUBMIT SCORE";
}

async function showLeaderboard(currentScore) {
    leaderboardList.innerHTML = '<div style="text-align: center; color: #666;">LOADING...</div>';

    if (!localStorage.getItem('mamdani_name')) {
        try {
            await apiClient.register(playerId, "", "");
        } catch (e) {
            console.error("Auto-registration failed:", e);
        }
    }

    const myRankData = await apiClient.submitScore(playerId, currentScore);
    let data = await apiClient.getLeaderboard(50);

    if (data && !Array.isArray(data)) {
        if (data.scores) data = data.scores;
        else if (data.entries) data = data.entries;
    }

    leaderboardList.innerHTML = '';
    if (Array.isArray(data) && data.length > 0) {
        data.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';

            let socialHtml = '';
            if (entry.social) {
                const handle = entry.social.replace('@', '');
                socialHtml = `<a href="https://truthsocial.com/@${handle}" target="_blank" class="lb-social-link">@${handle}</a>`;
            }

            item.innerHTML = `
                <div class="lb-rank">#${index + 1}</div>
                <div class="lb-name">${entry.name}${socialHtml}</div>
                <div class="lb-score">${entry.score}m</div>
            `;
            leaderboardList.appendChild(item);
        });
    } else {
        leaderboardList.innerHTML = '<div style="text-align: center; color: #666;">NO SCORES YET</div>';
    }

    if (myRankData && myRankData.ok) {
        pbScoreEl.innerText = `${myRankData.bestScore}m`;
        localStorage.setItem('mamdani_best_score', myRankData.bestScore);
        if (bestScoreEl) bestScoreEl.innerText = myRankData.bestScore;

        const savedName = localStorage.getItem('mamdani_name');
        if (!savedName) {
            pbRankDisplay.innerText = "(join to see your rank)";
        } else {
            const rankText = myRankData.rank > 0 ? `#${myRankData.rank}` : '-';
            pbRankDisplay.innerText = `Rank: ${rankText}`;
        }
    }
}

function updateUI() {
    scoreEl.innerText = scoreManager.getDisplayScore();
    foodStampsEl.innerText = scoreManager.foodStamps;

    processPlayerEvents();
    updatePowerupBars();
}

function processPlayerEvents() {
    while (player.events.length > 0) {
        const event = player.events.shift();
        if (event.type === 'powerupStart') {
            addPowerupIcon(event.name, event.duration);
            showNotification(`${event.name.toUpperCase()} ACTIVATED!`, '#00ff00');
        } else if (event.type === 'powerupEnd') {
            removePowerupIcon(event.name);
            showNotification(`${event.name.toUpperCase()} EXPIRED`, '#ff0000');
        } else if (event.type === 'debuffStart') {
            addPowerupIcon(event.name, event.duration);
            showNotification('HARAM!', '#800080');
        } else if (event.type === 'debuffEnd') {
            removePowerupIcon(event.name);
            showNotification('HARAM ENDED', '#00ff00');
        }
    }
}

function updatePowerupBars() {
    const powerupHud = document.getElementById('powerup-hud');
    Array.from(powerupHud.children).forEach(icon => {
        const name = icon.dataset.name;
        let timer = 0;
        let maxTime = 10.0;

        if (name === 'kafiyeh') timer = player.kafiyehTimer;
        else if (name === 'rainbow') timer = player.rainbowTimer;
        else if (name === 'covidMask') timer = player.covidMaskTimer;
        else if (name === 'confusion') {
            timer = player.confusionTimer;
            maxTime = 5.0;
        }

        const percent = (timer / maxTime) * 100;
        icon.querySelector('.powerup-bar').style.width = `${percent}%`;
    });
}

function addPowerupIcon(name, duration) {
    const hud = document.getElementById('powerup-hud');
    let icon = hud.querySelector(`[data-name="${name}"]`);
    if (!icon) {
        icon = document.createElement('div');
        icon.className = 'powerup-icon';
        icon.dataset.name = name;

        let emoji = '';
        if (name === 'kafiyeh') emoji = '🍉';
        else if (name === 'rainbow') emoji = '🏳️‍🌈';
        else if (name === 'covidMask') emoji = '😷';
        else if (name === 'confusion') emoji = '🥴';

        icon.innerText = emoji;

        const bar = document.createElement('div');
        bar.className = 'powerup-bar';
        icon.appendChild(bar);

        hud.appendChild(icon);
    }
}

function removePowerupIcon(name) {
    const hud = document.getElementById('powerup-hud');
    const icon = hud.querySelector(`[data-name="${name}"]`);
    if (icon) {
        hud.removeChild(icon);
    }
}

function showNotification(text, color) {
    const container = document.getElementById('notification-area');
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.innerText = text;
    notif.style.color = color;

    container.appendChild(notif);

    setTimeout(() => {
        if (container.contains(notif)) {
            container.removeChild(notif);
        }
    }, 2000);
}

// Game Loop
engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000;

    if (gameState.isPlaying() && !gameState.isPaused()) {
        world.update(dt);
        player.update(dt, input);
        obstacleManager.update(dt, world.speed, world.distance);
        powerupManager.update(dt, world.speed, player);
        particles.update(dt);

        scoreManager.update(dt, world.speed);
        trump.update(dt, player.mesh.position.x);

        if (input.isJustPressed('up') && player.isGrounded) {
            particles.spawnParticles(player.mesh.position, 5, new BABYLON.Color3(1, 1, 1), 0.5);
        }
        if (input.isJustPressed('down') && player.isGrounded) {
            particles.spawnParticles(player.mesh.position, 5, new BABYLON.Color3(0.6, 0.6, 0.6), 0.5);
        }

        updateUI();

        const powerupType = powerupManager.checkCollisions(player);
        if (powerupType) {
            player.activatePowerup(powerupType);
            particles.spawnParticles(player.mesh.position, 20, new BABYLON.Color3(0, 1, 1), 2);
        }

        if (player.hasRainbow) {
            for (let i = obstacleManager.obstacles.length - 1; i >= 0; i--) {
                const obj = obstacleManager.obstacles[i];
                if (obj.type === 'coin') {
                    const dist = BABYLON.Vector3.Distance(player.mesh.position, obj.mesh.position);

                    if (dist < 15) {
                        const direction = player.mesh.position.subtract(obj.mesh.position).normalize();
                        obj.mesh.position.addInPlace(direction.scale(25 * dt));
                    }

                    if (dist < 1.5) {
                        scoreManager.addFoodStamps(1);
                        particles.spawnParticles(player.mesh.position, 10, new BABYLON.Color3(1, 0.84, 0), 1);
                        obj.mesh.dispose();
                        obstacleManager.obstacles.splice(i, 1);
                    }
                }
            }
        }

        const collisionResult = obstacleManager.checkCollisions(player);
        if (collisionResult) {
            if (collisionResult.type === 'coin') {
                scoreManager.addFoodStamps(1);
                particles.spawnParticles(player.mesh.position, 10, new BABYLON.Color3(1, 0.84, 0), 1);
            } else if (collisionResult.type === 'obstacle') {
                const subtype = collisionResult.subtype;
                const isSliding = player.slideTimer > 0;

                if (subtype === 'scaffold' && isSliding) {
                    // Safe
                } else if (subtype === 'halal' && isSliding) {
                    // Safe
                } else if (subtype === 'alcohol') {
                    player.activateConfusion();
                    particles.spawnParticles(player.mesh.position, 10, new BABYLON.Color3(0.5, 0, 0.5), 1);
                    collisionResult.mesh.dispose();
                    obstacleManager.obstacles.splice(collisionResult.index, 1);
                } else {
                    if (player.hasKafiyeh) {
                        particles.spawnParticles(player.mesh.position, 10, new BABYLON.Color3(1, 1, 1), 1);
                        collisionResult.mesh.dispose();
                        obstacleManager.obstacles.splice(collisionResult.index, 1);
                    } else if (player.hasCovidMask) {
                        player.hasCovidMask = false;
                        player.mesh.getChildMeshes().forEach(child => {
                            if (child.material) child.material.diffuseColor = new BABYLON.Color3(1, 0, 0);
                        });
                        particles.spawnParticles(player.mesh.position, 15, new BABYLON.Color3(1, 1, 1), 1);
                        collisionResult.mesh.dispose();
                        obstacleManager.obstacles.splice(collisionResult.index, 1);
                    } else {
                        if (trump.isChasing) {
                            gameOver();
                        } else {
                            trump.startChase();
                            player.flashRed();
                            particles.spawnParticles(player.mesh.position, 10, new BABYLON.Color3(1, 0, 0), 2);
                            collisionResult.mesh.dispose();
                            obstacleManager.obstacles.splice(collisionResult.index, 1);
                            setTimeout(() => {
                                player.resetColor();
                            }, 100);
                        }
                    }
                }
            }
        }
    }

    scene.render();
});
