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

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue
scene.fog = new THREE.Fog(0x87CEEB, 10, 60);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 6);
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

// UI Elements
const startScreen = document.getElementById('start-screen');
const hud = document.getElementById('hud');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreEl = document.getElementById('score');
const stampsEl = document.getElementById('stamps');
const purityBar = document.getElementById('purity-bar');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const shopBtn = document.getElementById('shop-btn');
const storyModal = document.getElementById('story-modal');
const closeStoryBtn = document.getElementById('close-story-btn');

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
shopBtn.addEventListener('click', () => shop.show());
closeStoryBtn.addEventListener('click', () => {
    storyModal.classList.add('hidden');
    startScreen.classList.remove('hidden');
    localStorage.setItem('mamdani_story_seen', 'true');
});

// Check Story
if (!localStorage.getItem('mamdani_story_seen')) {
    startScreen.classList.add('hidden');
    storyModal.classList.remove('hidden');
    storyModal.classList.add('flex'); // Ensure flex for centering if needed, or just remove hidden
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
    hud.classList.remove('hidden');

    world.reset();
    player.reset();
    obstacleManager.reset();
    scoreManager.reset();
    trump.reset();
    powerupManager.reset();
    particles.reset();
    updateUI();
}

function gameOver() {
    gameState.setState('GAME_OVER');
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    finalScoreEl.innerText = scoreManager.getDisplayScore();
}

function updateUI() {
    scoreEl.innerText = scoreManager.getDisplayScore();
    stampsEl.innerText = scoreManager.stamps;

    const purityPercent = (player.purity / player.maxPurity) * 100;
    purityBar.style.width = `${purityPercent}%`;

    // Color change based on purity
    if (purityPercent > 60) purityBar.style.backgroundColor = '#00ff00';
    else if (purityPercent > 30) purityBar.style.backgroundColor = '#ffff00';
    else purityBar.style.backgroundColor = '#ff0000';
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
        obstacleManager.update(dt, world.speed);
        powerupManager.update(dt, world.speed, player);
        particles.update(dt);

        if (scoreManager.update(dt, world.speed)) {
            // Show Tax Notification
            const taxNotif = document.getElementById('tax-notification');
            taxNotif.classList.remove('hidden');
            setTimeout(() => {
                taxNotif.classList.add('hidden');
            }, 3000);
        }
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

        // Check Obstacle Collisions
        const collisionResult = obstacleManager.checkCollisions(player);
        if (collisionResult) {
            if (collisionResult.type === 'coin') {
                scoreManager.addStamps(1);
                particles.spawnParticles(player.mesh.position, 10, 0xffd700, 1); // Coin sparkles
            } else if (collisionResult.type === 'obstacle') {
                const subtype = collisionResult.subtype;
                const isSliding = player.slideTimer > 0;

                // Handle Mechanics
                if (subtype === 'halal' && isSliding) {
                    // Slide into Halal Cart -> Heal
                    player.heal(20);
                    obstacleManager.scene.remove(collisionResult.mesh);
                    obstacleManager.obstacles.splice(collisionResult.index, 1);
                    particles.spawnParticles(player.mesh.position, 15, 0x00ff00, 1); // Green heal particles
                } else if (subtype === 'scaffold' && isSliding) {
                    // Slide under Scaffold -> Safe (No hit)
                    // Do nothing, just pass through
                } else {
                    // Standard Hit
                    if (player.hasMask) {
                        player.hasMask = false;
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
                            player.takeDamage(10);

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
