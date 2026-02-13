import { Application, Graphics, Text, TextStyle } from 'pixi.js';

// --- GAME STATE ---
let gameState = 'MENU'; // MENU, PLAYING, DEAD
let score = 0;
let level = 1;
let exp = 0;
let expNeeded = 100;
let maxHp = 100;
let hp = maxHp;
let frameCount = 0;

// --- DOM ELEMENTS ---
const startScreen = document.getElementById('start-screen')!;
const startBtn = document.getElementById('start-btn')!;
const hud = document.getElementById('hud')!;
const hpBar = document.getElementById('hp-bar')!;
const hpText = document.getElementById('hp-text')!;
const expBar = document.getElementById('exp-bar')!;
const levelText = document.getElementById('level-text')!;
const scoreText = document.getElementById('score')!;
const levelAlert = document.getElementById('level-alert')!;

const app = new Application();

// --- ENTITY TYPES ---
type Bullet = { sprite: Graphics, vx: number, vy: number };
type Enemy = { sprite: Graphics, hp: number, maxHp: number, type: 'hunter' | 'tank', speed: number, expVal: number, radius: number };
type Particle = { sprite: Graphics, vx: number, vy: number, life: number };

async function init() {
    await app.init({ background: '#050510', resizeTo: window, antialias: true });
    document.body.appendChild(app.canvas);

    // Arrays
    const bullets: Bullet[] = [];
    const enemies: Enemy[] = [];
    const particles: Particle[] = [];
    const keys: Record<string, boolean> = {};

    // --- PLAYER AVATAR ---
    // Making the avatar look like a high-tech drone instead of a simple triangle
    const player = new Graphics();
    player.poly([0, -20, 15, 15, 0, 5, -15, 15]).fill(0x00ffff); // Main body
    player.circle(0, 0, 5).fill(0xffffff); // Core
    player.x = app.screen.width / 2;
    player.y = app.screen.height / 2;
    app.stage.addChild(player);

    // --- INPUT ---
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    // Shooting Mechanics
    let lastShot = 0;
    window.addEventListener('mousedown', (e) => {
        if (gameState !== 'PLAYING') return;
        
        // Fire Rate based on Level
        const fireDelay = level >= 2 ? 10 : 20; 
        if (frameCount - lastShot < fireDelay) return;
        lastShot = frameCount;

        const angle = Math.atan2(e.clientY - player.y, e.clientX - player.x);
        
        const spawnBullet = (offsetAngle: number) => {
            const b = new Graphics().rect(-2, -8, 4, 16).fill(0xffff00);
            b.x = player.x; b.y = player.y;
            b.rotation = angle + offsetAngle + Math.PI / 2;
            bullets.push({ 
                sprite: b, 
                vx: Math.cos(angle + offsetAngle) * 20, 
                vy: Math.sin(angle + offsetAngle) * 20 
            });
            app.stage.addChild(b);
        };

        spawnBullet(0);
        // Level 3 grants Spread Shot
        if (level >= 3) {
            spawnBullet(0.2);
            spawnBullet(-0.2);
        }
    });

    // --- HELPERS ---
    const spawnExplosion = (x: number, y: number, color: number, amount: number) => {
        for (let i = 0; i < amount; i++) {
            const p = new Graphics().circle(0, 0, Math.random() * 4 + 1).fill(color);
            p.x = x; p.y = y;
            particles.push({
                sprite: p,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 1.0
            });
            app.stage.addChild(p);
        }
    };

    const spawnEnemy = () => {
        if (gameState !== 'PLAYING') return;
        
        const isTank = Math.random() > 0.8; // 20% chance for a Tank
        const radius = isTank ? 30 : 15;
        const color = isTank ? 0xff0055 : 0xffaa00;
        
        const eSprite = new Graphics();
        if (isTank) {
            eSprite.poly([-30,-30, 30,-30, 30,30, -30,30]).fill(color); // Square tank
        } else {
            eSprite.poly([0,-15, 12,12, -12,12]).fill(color); // Triangle hunter
        }

        // Spawn outside screen
        const angle = Math.random() * Math.PI * 2;
        eSprite.x = player.x + Math.cos(angle) * (app.screen.width / 2 + 100);
        eSprite.y = player.y + Math.sin(angle) * (app.screen.height / 2 + 100);

        enemies.push({
            sprite: eSprite,
            type: isTank ? 'tank' : 'hunter',
            hp: isTank ? 50 + (level * 10) : 10 + (level * 2), // Scale with level
            maxHp: isTank ? 50 + (level * 10) : 10 + (level * 2),
            speed: isTank ? 1.5 : 3.5 + (level * 0.2),
            expVal: isTank ? 50 : 10,
            radius: radius
        });
        
        app.stage.addChild(eSprite);
        setTimeout(spawnEnemy, Math.max(300, 1500 - (level * 100)));
    };

    // --- GAME LOOP ---
    app.ticker.add((time) => {
        if (gameState !== 'PLAYING') return;
        frameCount++;

        // 1. Player Movement
        const speed = 6 * time.deltaTime;
        if (keys['w']) player.y -= speed;
        if (keys['s']) player.y += speed;
        if (keys['a']) player.x -= speed;
        if (keys['d']) player.x += speed;

        player.x = Math.max(20, Math.min(app.screen.width - 20, player.x));
        player.y = Math.max(20, Math.min(app.screen.height - 20, player.y));

        const mouse = app.renderer.events.pointer;
        player.rotation = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI / 2;

        // 2. Bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.sprite.x += b.vx * time.deltaTime;
            b.sprite.y += b.vy * time.deltaTime;
            if (b.sprite.x < -100 || b.sprite.x > app.screen.width + 100 || b.sprite.y < -100 || b.sprite.y > app.screen.height + 100) {
                app.stage.removeChild(b.sprite); bullets.splice(i, 1);
            }
        }

        // 3. Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.sprite.x += p.vx * time.deltaTime;
            p.sprite.y += p.vy * time.deltaTime;
            p.life -= 0.03 * time.deltaTime;
            p.sprite.alpha = p.life;
            if (p.life <= 0) { app.stage.removeChild(p.sprite); particles.splice(i, 1); }
        }

        // 4. Enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const angle = Math.atan2(player.y - e.sprite.y, player.x - e.sprite.x);
            e.sprite.x += Math.cos(angle) * e.speed * time.deltaTime;
            e.sprite.y += Math.sin(angle) * e.speed * time.deltaTime;
            e.sprite.rotation = angle + Math.PI / 2;

            // Player Damage
            if (Math.hypot(player.x - e.sprite.x, player.y - e.sprite.y) < e.radius + 15) {
                hp -= e.type === 'tank' ? 20 : 5;
                spawnExplosion(player.x, player.y, 0x00ffff, 5);
                app.stage.removeChild(e.sprite); enemies.splice(i, 1);
                
                // Update UI
                hpBar.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
                hpText.innerText = `${Math.max(0, Math.floor((hp / maxHp) * 100))}%`;
                
                if (hp <= 0) {
                    gameState = 'DEAD';
                    startScreen.innerHTML = `<h1>SYSTEM DESTROYED</h1><p class="lore">Final Level: ${level} | Score: ${score}</p><button onclick="location.reload()">REBOOT</button>`;
                    startScreen.classList.remove('hidden');
                    hud.classList.add('hidden');
                }
                continue; // Skip bullet check if destroyed
            }

            // Bullet Collision
            for (let j = bullets.length - 1; j >= 0; j--) {
                const b = bullets[j];
                if (Math.hypot(b.sprite.x - e.sprite.x, b.sprite.y - e.sprite.y) < e.radius + 5) {
                    e.hp -= 10;
                    app.stage.removeChild(b.sprite); bullets.splice(j, 1); // Kill bullet
                    
                    if (e.hp <= 0) {
                        spawnExplosion(e.sprite.x, e.sprite.y, e.type === 'tank' ? 0xff0055 : 0xffaa00, e.type === 'tank' ? 20 : 8);
                        score += e.type === 'tank' ? 500 : 100;
                        scoreText.innerText = score.toString();
                        
                        // EXP System
                        exp += e.expVal;
                        if (exp >= expNeeded) {
                            level++;
                            exp -= expNeeded;
                            expNeeded = Math.floor(expNeeded * 1.5); // Next level requires more
                            levelText.innerText = level.toString();
                            
                            // Heal on level up
                            hp = Math.min(maxHp, hp + 20);
                            hpBar.style.width = `${(hp / maxHp) * 100}%`;
                            hpText.innerText = `${Math.floor((hp / maxHp) * 100)}%`;

                            // Show Alert
                            levelAlert.style.opacity = '1';
                            setTimeout(() => levelAlert.style.opacity = '0', 2000);
                        }
                        expBar.style.width = `${(exp / expNeeded) * 100}%`;

                        app.stage.removeChild(e.sprite); enemies.splice(i, 1);
                    } else {
                        // Hit flash
                        e.sprite.alpha = 0.5;
                        setTimeout(() => { if (e.sprite) e.sprite.alpha = 1; }, 50);
                    }
                    break;
                }
            }
        }
    });

    // --- START BUTTON LOGIC ---
    startBtn.addEventListener('click', () => {
        startScreen.classList.add('hidden');
        hud.classList.remove('hidden');
        gameState = 'PLAYING';
        spawnEnemy();
    });
}

init();
