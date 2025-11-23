import * as THREE from 'three';
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

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue
scene.fog = new THREE.Fog(0x87CEEB, 7, 100);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const isMobile = window.innerWidth < 768;
// Zoom out slightly on mobile to see side lanes better
camera.position.set(0, 5, isMobile ? 10 : 6);
camera.lookAt(0, 0, -5);

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#game-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
scene.add(dirLight);

// Game Components
const gameState = new GameState();
const world = new World(scene);
const player = new Player(scene);
const powerupManager = new PowerupManager(scene);
const obstacleManager = new ObstacleManager(scene, player, powerupManager);
const scoreManager = new ScoreManager();
const trump = new Trump(scene);
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
// const leaderboardModal = document.getElementById('leaderboard-modal'); // Removed
const submitScoreBtn = document.getElementById('submit-score-btn');
const joinLbBtn = document.getElementById('join-lb-btn'); // New button
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
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function startGame() {
    gameState.setState('PLAYING');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    // leaderboardModal.classList.add('hidden');
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

    // Update Powerup Bars
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

    // Always show leaderboard in the game over screen
    // This will handle score submission for both registered and anonymous players
    showLeaderboard(finalScore);

    // Show/Hide Join Button
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

    // Register
    const regResult = await apiClient.register(playerId, name, social);

    if (regResult.ok || regResult.updated) {
        localStorage.setItem('mamdani_name', name);
        if (social) localStorage.setItem('mamdani_social', social);

        // Submit current score
        const score = scoreManager.getDisplayScore();
        await apiClient.submitScore(playerId, score);

        registrationModal.classList.add('hidden');

        // Refresh leaderboard and hide join button
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
    // leaderboardModal.classList.remove('hidden'); // No longer using modal
    leaderboardList.innerHTML = '<div style="text-align: center; color: #666;">LOADING...</div>';

    // 0. Ensure Player is Registered (Anonymous or Named)
    if (!localStorage.getItem('mamdani_name')) {
        try {
            await apiClient.register(playerId, "", "");
        } catch (e) {
            console.error("Auto-registration failed:", e);
        }
    }

    // 1. Submit Score FIRST to ensure it's recorded
    const myRankData = await apiClient.submitScore(playerId, currentScore);

    // 2. THEN Fetch Leaderboard Data
    let data = await apiClient.getLeaderboard(50);

    // Debugging: Handle if data is wrapped in an object (e.g. { scores: [...] } or { entries: [...] })
    // Debugging: Handle if data is wrapped in an object (e.g. { scores: [...] } or { entries: [...] })
    if (data && !Array.isArray(data)) {
        if (data.scores) data = data.scores;
        else if (data.entries) data = data.entries; // Fix for user issue
    }

    // Render List
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
        console.log("Leaderboard Data:", data); // Log for debugging
        leaderboardList.innerHTML = '<div style="text-align: center; color: #666;">NO SCORES YET</div>';
    }

    // Update Personal Best
    if (myRankData && myRankData.ok) {
        pbScoreEl.innerText = `${myRankData.bestScore}m`;

        // Cache best score for HUD
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

    // Process Player Events
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

    // Update Powerup Bars
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
    // Check if exists
    let icon = hud.querySelector(`[data-name="${name}"]`);
    if (!icon) {
        icon = document.createElement('div');
        icon.className = 'powerup-icon';
        icon.dataset.name = name;

        // Emoji Icons
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

    // Remove after animation
    setTimeout(() => {
        if (container.contains(notif)) {
            container.removeChild(notif);
        }
    }, 2000);
}



// Game Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();

    if (gameState.isPlaying()) {
        // Update Game Logic
        world.update(dt);
        player.update(dt, input);
        obstacleManager.update(dt, world.speed, world.distance);
        powerupManager.update(dt, world.speed, player);
        particles.update(dt);

        scoreManager.update(dt, world.speed);
        trump.update(dt, player.mesh.position.x);

        // Particle Effects for Player Actions
        if (input.isJustPressed('up') && player.isGrounded) {
            particles.spawnParticles(player.mesh.position, 5, 0xffffff, 0.5); // Jump dust
        }
        if (input.isJustPressed('down') && player.isGrounded) {
            particles.spawnParticles(player.mesh.position, 5, 0xaaaaaa, 0.5); // Slide dust
        }

        // Update UI
        updateUI();

        // Check Powerup Collisions
        const powerupType = powerupManager.checkCollisions(player);
        if (powerupType) {
            player.activatePowerup(powerupType);
            particles.spawnParticles(player.mesh.position, 20, 0x00ffff, 2); // Powerup sparkles
        }

        // Magnet Effect (Rainbow)
        if (player.hasRainbow) {
            for (let i = obstacleManager.obstacles.length - 1; i >= 0; i--) {
                const obj = obstacleManager.obstacles[i];
                if (obj.type === 'coin') {
                    const dist = player.mesh.position.distanceTo(obj.mesh.position);

                    // Move towards player if in range
                    if (dist < 15) {
                        const direction = new THREE.Vector3().subVectors(player.mesh.position, obj.mesh.position).normalize();
                        obj.mesh.position.add(direction.multiplyScalar(25 * dt)); // Increased speed slightly
                    }

                    // Auto-collect if very close (Fixes missing collisions)
                    if (dist < 1.5) {
                        scoreManager.addFoodStamps(1);
                        particles.spawnParticles(player.mesh.position, 10, 0xffd700, 1); // Coin sparkles
                        obstacleManager.scene.remove(obj.mesh);
                        obstacleManager.obstacles.splice(i, 1);
                    }
                }
            }
        }

        // Check Obstacle Collisions
        const collisionResult = obstacleManager.checkCollisions(player);
        if (collisionResult) {
            if (collisionResult.type === 'coin') {
                scoreManager.addFoodStamps(1);
                particles.spawnParticles(player.mesh.position, 10, 0xffd700, 1); // Coin sparkles
            } else if (collisionResult.type === 'obstacle') {
                const subtype = collisionResult.subtype;
                const isSliding = player.slideTimer > 0;

                if (subtype === 'scaffold' && isSliding) {
                    // Slide under Scaffold -> Safe (No hit)
                    // Do nothing, just pass through
                } else if (subtype === 'halal' && isSliding) {
                    // Slide under Halal Cart -> Safe
                    // Do nothing, just pass through
                } else if (subtype === 'alcohol') {
                    // Alcohol -> Confusion
                    player.activateConfusion();
                    particles.spawnParticles(player.mesh.position, 10, 0x800080, 1); // Purple bubbles
                    obstacleManager.scene.remove(collisionResult.mesh);
                    obstacleManager.obstacles.splice(collisionResult.index, 1);
                } else {
                    // Standard Hit (Bus, Taxi, Protestor, Halal if not sliding, etc.)
                    if (player.hasKafiyeh) {
                        // Invincible!
                        // Maybe destroy obstacle?
                        particles.spawnParticles(player.mesh.position, 10, 0xffffff, 1);
                        obstacleManager.scene.remove(collisionResult.mesh);
                        obstacleManager.obstacles.splice(collisionResult.index, 1);
                    } else if (player.hasCovidMask) {
                        player.hasCovidMask = false;
                        player.mesh.traverse(child => {
                            if (child.isMesh) child.material.color.setHex(0xff0000);
                        });
                        particles.spawnParticles(player.mesh.position, 15, 0xffffff, 1); // Shield break
                        obstacleManager.scene.remove(collisionResult.mesh);
                        obstacleManager.obstacles.splice(collisionResult.index, 1);
                    } else {
                        if (trump.isChasing) {
                            // Second hit while chasing -> Game Over
                            gameOver();
                        } else {
                            // First hit -> Start Chase
                            trump.startChase();

                            // Visual Feedback
                            player.flashRed();
                            particles.spawnParticles(player.mesh.position, 10, 0xff0000, 2); // Hit blood/sparks

                            // Remove obstacle so we don't hit it again immediately
                            obstacleManager.scene.remove(collisionResult.mesh);
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


    renderer.render(scene, camera);
}

animate();
