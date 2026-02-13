import { Application, Graphics } from 'pixi.js';

const app = new Application();

// Game State
let score = 0;
let health = 100;
let highScore = localStorage.getItem('void_pulse_high') || '0';
let gameActive = true;
let difficulty = 1;

async function init() {
    await app.init({ background: '#020202', resizeTo: window, antialias: true });
    document.body.appendChild(app.canvas);

    const scoreEl = document.getElementById('score')!;
    const healthEl = document.getElementById('health')!;
    const highEl = document.getElementById('high-score')!;
    const gameOverEl = document.getElementById('game-over')!;
    highEl.innerText = highScore;

    // Player Setup
    const player = new Graphics().poly([0, -15, 12, 12, -12, 12]).fill(0x00ffff);
    player.x = app.screen.width / 2;
    player.y = app.screen.height / 2;
    app.stage.addChild(player);

    // Arrays for entities
    const bullets: any[] = [];
    const enemies: any[] = [];
    const particles: any[] = [];
    const keys: Record<string, boolean> = {};

    // Input Listeners
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    const createExplosion = (x: number, y: number, color: number) => {
        for (let i = 0; i < 10; i++) {
            const p = new Graphics().circle(0, 0, Math.random() * 3).fill(color);
            p.x = x; p.y = y;
            (p as any).vel = { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 };
            (p as any).alpha = 1;
            particles.push(p);
            app.stage.addChild(p);
        }
    };

    window.addEventListener('mousedown', (e) => {
        if (!gameActive) return;
        const b = new Graphics().circle(0, 0, 4).fill(0xffffff);
        b.x = player.x; b.y = player.y;
        const angle = Math.atan2(e.clientY - player.y, e.clientX - player.x);
        (b as any).vel = { x: Math.cos(angle) * 15, y: Math.sin(angle) * 15 };
        bullets.push(b);
        app.stage.addChild(b);
    });

    // Enemy Spawner with Difficulty Ramp
    const spawnEnemy = () => {
        if (!gameActive) return;
        const size = 10 + Math.random() * 20;
        const enemy = new Graphics().circle(0, 0, size).fill(0xff0055);
        
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { enemy.x = Math.random() * app.screen.width; enemy.y = -50; }
        else if (side === 1) { enemy.x = app.screen.width + 50; enemy.y = Math.random() * app.screen.height; }
        else if (side === 2) { enemy.x = Math.random() * app.screen.width; enemy.y = app.screen.height + 50; }
        else { enemy.x = -50; enemy.y = Math.random() * app.screen.height; }

        enemies.push(enemy);
        app.stage.addChild(enemy);
        
        // Spawn faster over time
        setTimeout(spawnEnemy, Math.max(200, 1000 - (difficulty * 50)));
    };
    spawnEnemy();

    app.ticker.add((time) => {
        if (!gameActive) return;

        // 1. WASD Movement
        const speed = 5 * time.deltaTime;
        if (keys['w']) player.y -= speed;
        if (keys['s']) player.y += speed;
        if (keys['a']) player.x -= speed;
        if (keys['d']) player.x += speed;

        // Keep in bounds
        player.x = Math.max(20, Math.min(app.screen.width - 20, player.x));
        player.y = Math.max(20, Math.min(app.screen.height - 20, player.y));

        // 2. Rotation
        const mouse = app.renderer.events.pointer;
        player.rotation = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI / 2;

        // 3. Update Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vel.x; p.y += p.vel.y;
            p.alpha -= 0.02;
            if (p.alpha <= 0) { app.stage.removeChild(p); particles.splice(i, 1); }
        }

        // 4. Update Bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.vel.x * time.deltaTime; b.y += b.vel.y * time.deltaTime;
            if (b.x < -50 || b.x > app.screen.width + 50 || b.y < -50 || b.y > app.screen.height + 50) {
                app.stage.removeChild(b); bullets.splice(i, 1);
            }
        }

        // 5. Update Enemies & Collision
        difficulty += 0.001; // Slow ramp
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const angle = Math.atan2(player.y - e.y, player.x - e.x);
            e.x += Math.cos(angle) * (2 + difficulty * 0.2) * time.deltaTime;
            e.y += Math.sin(angle) * (2 + difficulty * 0.2) * time.deltaTime;

            // Player Collision
            const distToPlayer = Math.hypot(player.x - e.x, player.y - e.y);
            if (distToPlayer < 25) {
                health -= 1;
                healthEl.innerText = Math.max(0, health).toString();
                if (health <= 0) {
                    gameActive = false;
                    gameOverEl.style.display = 'block';
                    if (score > parseInt(highScore)) localStorage.setItem('void_pulse_high', score.toString());
                    setTimeout(() => location.reload(), 3000);
                }
            }

            // Bullet Collision
            for (let j = bullets.length - 1; j >= 0; j--) {
                const b = bullets[j];
                if (Math.hypot(b.x - e.x, b.y - e.y) < 25) {
                    createExplosion(e.x, e.y, 0xff0055);
                    score += 100;
                    scoreEl.innerText = score.toString();
                    app.stage.removeChild(e); enemies.splice(i, 1);
                    app.stage.removeChild(b); bullets.splice(j, 1);
                    break;
                }
            }
        }
    });
}

init();
