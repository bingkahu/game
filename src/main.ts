import { Application, Graphics, Text, TextStyle } from 'pixi.js';

// Game State Variables
let gameState = 'MENU';
let score = 0, level = 1, exp = 0, expNeeded = 100;
let hp = 100, maxHp = 100;
let frameCount = 0;
let dashCooldown = 0;
let shieldTimer = 0;
let bossActive = false;

// DOM Elements
const elements = {
    startScreen: document.getElementById('start-screen')!,
    startBtn: document.getElementById('start-btn')!,
    hud: document.getElementById('hud')!,
    hpBar: document.getElementById('hp-bar')!,
    hpText: document.getElementById('hp-text')!,
    expBar: document.getElementById('exp-bar')!,
    levelText: document.getElementById('level-text')!,
    scoreText: document.getElementById('score')!,
    dashStatus: document.getElementById('dash-status')!,
    shieldStatus: document.getElementById('shield-status')!,
    levelAlert: document.getElementById('level-alert')!,
    bossAlert: document.getElementById('boss-alert')!
};

const app = new Application();

// Types
type Entity = { sprite: Graphics, vx: number, vy: number, life?: number };
type Enemy = { sprite: Graphics, hp: number, maxHp: number, type: 'hunter' | 'tank' | 'sniper' | 'boss', speed: number, expVal: number, radius: number, lastShot: number };
type Drop = { sprite: Graphics, type: 'heal' | 'shield', life: number };
type DmgText = { sprite: Text, life: number, vy: number };

async function init() {
    await app.init({ background: '#050510', resizeTo: window, antialias: true });
    document.body.appendChild(app.canvas);

    // Engine Arrays
    const bullets: Entity[] = [];
    const enemyBullets: Entity[] = [];
    const enemies: Enemy[] = [];
    const particles: Entity[] = [];
    const drops: Drop[] = [];
    const floatTexts: DmgText[] = [];
    const keys: Record<string, boolean> = {};

    // Player Avatar
    const player = new Graphics();
    player.poly([0, -20, 15, 15, 0, 5, -15, 15]).fill(0x00ffff);
    player.circle(0, 0, 5).fill(0xffffff);
    app.stage.addChild(player);

    // Input
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    let lastShot = 0;
    window.addEventListener('mousedown', (e) => {
        if (gameState !== 'PLAYING') return;
        const fireDelay = level >= 4 ? 8 : (level >= 2 ? 12 : 20); 
        if (frameCount - lastShot < fireDelay) return;
        lastShot = frameCount;

        const angle = Math.atan2(e.clientY - player.y, e.clientX - player.x);
        const spawnBullet = (offset: number) => {
            const b = new Graphics().rect(-2, -8, 4, 16).fill(0xffff00);
            b.x = player.x; b.y = player.y;
            b.rotation = angle + offset + Math.PI / 2;
            bullets.push({ sprite: b, vx: Math.cos(angle + offset) * 20, vy: Math.sin(angle + offset) * 20 });
            app.stage.addChild(b);
        };

        spawnBullet(0);
        if (level >= 3) { spawnBullet(0.15); spawnBullet(-0.15); }
        if (level >= 5) { spawnBullet(0.3); spawnBullet(-0.3); } // 5-way spread
    });

    // Helpers
    const spawnText = (x: number, y: number, amount: string, color: string) => {
        const style = new TextStyle({ fontFamily: 'Courier New', fontSize: 20, fill: color, fontWeight: 'bold' });
        const t = new Text({ text: amount, style });
        t.x = x - 10; t.y = y - 20;
        floatTexts.push({ sprite: t, life: 1, vy: -2 });
        app.stage.addChild(t);
    };

    const spawnExplosion = (x: number, y: number, color: number, amount: number) => {
        for (let i = 0; i < amount; i++) {
            const p = new Graphics().circle(0, 0, Math.random() * 4 + 1).fill(color);
            p.x = x; p.y = y;
            particles.push({ sprite: p, vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15, life: 1.0 });
            app.stage.addChild(p);
        }
    };

    const spawnDrop = (x: number, y: number) => {
        if (Math.random() > 0.3) return; // 30% drop rate
        const isShield = Math.random() > 0.7;
        const d = new Graphics();
        if (isShield) d.poly([0,-10, 10,0, 0,10, -10,0]).fill(0x0055ff);
        else d.rect(-8, -8, 16, 16).fill(0x00ff00);
        d.x = x; d.y = y;
        drops.push({ sprite: d, type: isShield ? 'shield' : 'heal', life: 600 });
        app.stage.addChild(d);
    };

    const spawnEnemy = () => {
        if (gameState !== 'PLAYING') return;
        
        // Boss trigger
        if (level % 5 === 0 && !bossActive) {
            bossActive = true;
            elements.bossAlert.style.opacity = '1';
            setTimeout(() => elements.bossAlert.style.opacity = '0', 3000);
            
            const boss = new Graphics().poly([-50,-50, 50,-50, 60,0, 50,50, -50,50, -60,0]).fill(0xff0000);
            boss.x = app.screen.width / 2; boss.y = -100;
            enemies.push({ sprite: boss, type: 'boss', hp: 500 * level, maxHp: 500 * level, speed: 0.5, expVal: 500, radius: 55, lastShot: 0 });
            app.stage.addChild(boss);
            return; // Wait to spawn regular enemies until boss is dead
        }

        if (bossActive) return; // Stop spawning while boss is alive

        const rand = Math.random();
        let type: 'hunter' | 'tank' | 'sniper' = 'hunter';
        if (rand > 0.8) type = 'tank';
        else if (rand > 0.6) type = 'sniper';

        const radius = type === 'tank' ? 30 : 15;
        const color = type === 'tank' ? 0xff0055 : (type === 'sniper' ? 0xff00ff : 0xffaa00);
        
        const eSprite = new Graphics();
        if (type === 'tank') eSprite.poly([-30,-30, 30,-30, 30,30, -30,30]).fill(color);
        else if (type === 'sniper') eSprite.poly([0,-15, 15,0, 0,15, -15,0]).fill(color);
        else eSprite.poly([0,-15, 12,12, -12,12]).fill(color);

        const angle = Math.random() * Math.PI * 2;
        eSprite.x = player.x + Math.cos(angle) * (app.screen.width / 2 + 100);
        eSprite.y = player.y + Math.sin(angle) * (app.screen.height / 2 + 100);

        enemies.push({ sprite: eSprite, type, hp: type === 'tank' ? 50 + (level * 10) : 10 + (level * 2), maxHp: type === 'tank' ? 50 + (level * 10) : 10 + (level * 2), speed: type === 'tank' ? 1.5 : (type === 'sniper' ? 2 : 3.5 + (level * 0.2)), expVal: type === 'tank' ? 50 : 20, radius, lastShot: 0 });
        
        app.stage.addChild(eSprite);
        setTimeout(spawnEnemy, Math.max(300, 1500 - (level * 100)));
    };

    const takeDamage = (amount: number) => {
        if (shieldTimer > 0) return;
        hp -= amount;
        spawnExplosion(player.x, player.y, 0x00ffff, 5);
        elements.hpBar.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
        elements.hpText.innerText = `${Math.max(0, Math.floor((hp / maxHp) * 100))}%`;
        
        if (hp <= 0) {
            gameState = 'DEAD';
            elements.startScreen.innerHTML = `<h1>SYSTEM DESTROYED</h1><p class="lore">Level: ${level} | Score: ${score}</p><button onclick="location.reload()">REBOOT</button>`;
            elements.startScreen.classList.remove('hidden');
            elements.hud.classList.add('hidden');
        }
    };

    // GAME LOOP
    app.ticker.add((time) => {
        if (gameState !== 'PLAYING') return;
        frameCount++;

        // Status Updates
        dashCooldown -= time.deltaTime;
        shieldTimer -= time.deltaTime;
        
        if (dashCooldown <= 0) { elements.dashStatus.innerText = 'READY'; elements.dashStatus.style.color = '#00ffff'; }
        else { elements.dashStatus.innerText = 'CHARGING'; elements.dashStatus.style.color = '#555'; }
        
        if (shieldTimer > 0) {
            elements.shieldStatus.innerText = 'ACTIVE'; elements.shieldStatus.style.color = '#0055ff';
            player.alpha = 0.5 + Math.sin(frameCount * 0.2) * 0.5; // Pulse effect
        } else {
            elements.shieldStatus.innerText = 'INACTIVE'; elements.shieldStatus.style.color = '#555';
            player.alpha = 1;
        }

        // 1. Movement & Dash
        let speed = 6;
        if (keys[' '] && dashCooldown <= 0) {
            speed = 25; // DASH!
            dashCooldown = 60; // 1 second cooldown
            spawnExplosion(player.x, player.y, 0x00ffff, 3); // Trail
        }
        
        speed *= time.deltaTime;
        if (keys['w']) player.y -= speed;
        if (keys['s']) player.y += speed;
        if (keys['a']) player.x -= speed;
        if (keys['d']) player.x += speed;

        player.x = Math.max(20, Math.min(app.screen.width - 20, player.x));
        player.y = Math.max(20, Math.min(app.screen.height - 20, player.y));

        const mouse = app.renderer.events.pointer;
        player.rotation = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI / 2;

        // 2. Arrays Cleanup & Updates
        for (let i = floatTexts.length - 1; i >= 0; i--) {
            const t = floatTexts[i];
            t.sprite.y += t.vy * time.deltaTime;
            t.life -= 0.02 * time.deltaTime;
            t.sprite.alpha = t.life;
            if (t.life <= 0) { app.stage.removeChild(t.sprite); floatTexts.splice(i, 1); }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.sprite.x += p.vx * time.deltaTime; p.sprite.y += p.vy * time.deltaTime;
            p.life! -= 0.03 * time.deltaTime; p.sprite.alpha = p.life!;
            if (p.life! <= 0) { app.stage.removeChild(p.sprite); particles.splice(i, 1); }
        }

        for (let i = drops.length - 1; i >= 0; i--) {
            const d = drops[i];
            d.life -= time.deltaTime;
            d.sprite.alpha = d.life > 100 ? 1 : d.life / 100;
            if (Math.hypot(player.x - d.sprite.x, player.y - d.sprite.y) < 30) {
                if (d.type === 'heal') { hp = Math.min(maxHp, hp + 30); elements.hpBar.style.width = `${(hp/maxHp)*100}%`; elements.hpText.innerText = `${Math.floor((hp/maxHp)*100)}%`; spawnText(player.x, player.y, "+30", "#00ff00"); }
                else if (d.type === 'shield') { shieldTimer = 300; spawnText(player.x, player.y, "SHIELD", "#0055ff"); }
                app.stage.removeChild(d.sprite); drops.splice(i, 1); continue;
            }
            if (d.life <= 0) { app.stage.removeChild(d.sprite); drops.splice(i, 1); }
        }

        // Bullets Updates
        const updateBullets = (arr: Entity[], isEnemyBullet: boolean) => {
            for (let i = arr.length - 1; i >= 0; i--) {
                const b = arr[i];
                b.sprite.x += b.vx * time.deltaTime; b.sprite.y += b.vy * time.deltaTime;
                if (b.sprite.x < -100 || b.sprite.x > app.screen.width + 100 || b.sprite.y < -100 || b.sprite.y > app.screen.height + 100) {
                    app.stage.removeChild(b.sprite); arr.splice(i, 1); continue;
                }
                if (isEnemyBullet && Math.hypot(player.x - b.sprite.x, player.y - b.sprite.y) < 15) {
                    takeDamage(10);
                    app.stage.removeChild(b.sprite); arr.splice(i, 1);
                }
            }
        };
        updateBullets(bullets, false);
        updateBullets(enemyBullets, true);

        // 3. Enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const dist = Math.hypot(player.x - e.sprite.x, player.y - e.sprite.y);
            const angle = Math.atan2(player.y - e.sprite.y, player.x - e.sprite.x);
            
            // Movement Logic
            if (e.type === 'sniper' && dist < 300) {
                // Run away if too close
                e.sprite.x -= Math.cos(angle) * e.speed * time.deltaTime;
                e.sprite.y -= Math.sin(angle) * e.speed * time.deltaTime;
            } else if (e.type !== 'boss') {
                e.sprite.x += Math.cos(angle) * e.speed * time.deltaTime;
                e.sprite.y += Math.sin(angle) * e.speed * time.deltaTime;
            } else if (e.type === 'boss') {
                e.sprite.x += Math.cos(angle) * 0.5 * time.deltaTime;
                e.sprite.y += Math.sin(angle) * 0.5 * time.deltaTime;
            }
            
            e.sprite.rotation = angle + Math.PI / 2;

            // Enemy Shooting
            if ((e.type === 'sniper' || e.type === 'boss') && frameCount - e.lastShot > (e.type === 'boss' ? 40 : 100)) {
                e.lastShot = frameCount;
                if (e.type === 'boss') {
                    // Boss Ring Attack
                    for (let r = 0; r < Math.PI * 2; r += Math.PI / 4) {
                        const eb = new Graphics().circle(0, 0, 6).fill(0xff0000);
                        eb.x = e.sprite.x; eb.y = e.sprite.y;
                        enemyBullets.push({ sprite: eb, vx: Math.cos(r) * 5, vy: Math.sin(r) * 5 });
                        app.stage.addChild(eb);
                    }
                } else {
                    const eb = new Graphics().circle(0, 0, 4).fill(0xff00ff);
                    eb.x = e.sprite.x; eb.y = e.sprite.y;
                    enemyBullets.push({ sprite: eb, vx: Math.cos(angle) * 8, vy: Math.sin(angle) * 8 });
                    app.stage.addChild(eb);
                }
            }

            // Player Collision Damage
            if (dist < e.radius + 15) {
                takeDamage(e.type === 'boss' ? 50 : (e.type === 'tank' ? 20 : 5));
            }

            // Hit by Player Bullet
            for (let j = bullets.length - 1; j >= 0; j--) {
                const b = bullets[j];
                if (Math.hypot(b.sprite.x - e.sprite.x, b.sprite.y - e.sprite.y) < e.radius + 5) {
                    const dmg = 10 + (level * 2);
                    e.hp -= dmg;
                    spawnText(e.sprite.x, e.sprite.y, dmg.toString(), "#ffff00"); // Damage numbers!
                    app.stage.removeChild(b.sprite); bullets.splice(j, 1);
                    
                    if (e.hp <= 0) {
                        spawnExplosion(e.sprite.x, e.sprite.y, e.type === 'tank' ? 0xff0055 : 0xffaa00, e.type === 'boss' ? 50 : 10);
                        spawnDrop(e.sprite.x, e.sprite.y);
                        
                        score += e.type === 'boss' ? 5000 : e.expVal * 10;
                        elements.scoreText.innerText = score.toString();
                        
                        exp += e.expVal;
                        if (exp >= expNeeded) {
                            level++; exp -= expNeeded; expNeeded = Math.floor(expNeeded * 1.5);
                            elements.levelText.innerText = level.toString();
                            hp = Math.min(maxHp, hp + 50); // Big heal on level up
                            elements.hpBar.style.width = `${(hp / maxHp) * 100}%`;
                            elements.levelAlert.style.opacity = '1';
                            setTimeout(() => elements.levelAlert.style.opacity = '0', 2000);
                        }
                        elements.expBar.style.width = `${(exp / expNeeded) * 100}%`;

                        if (e.type === 'boss') {
                            bossActive = false;
                            setTimeout(spawnEnemy, 1000); // Resume regular spawning
                        }
                        
                        app.stage.removeChild(e.sprite); enemies.splice(i, 1);
                    } else {
                        e.sprite.alpha = 0.5;
                        setTimeout(() => { if (e.sprite) e.sprite.alpha = 1; }, 50);
                    }
                    break;
                }
            }
        }
    });

    elements.startBtn.addEventListener('click', () => {
        elements.startScreen.classList.add('hidden');
        elements.hud.classList.remove('hidden');
        player.x = app.screen.width / 2;
        player.y = app.screen.height / 2;
        gameState = 'PLAYING';
        spawnEnemy();
    });
}

init();
