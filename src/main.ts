import { Application, Graphics } from 'pixi.js';

const app = new Application();

async function init() {
    await app.init({ 
        background: '#020202', 
        resizeTo: window,
        antialias: true 
    });
    document.body.appendChild(app.canvas);

    const player = new Graphics().circle(0, 0, 15).fill(0x00ffff);
    player.x = app.screen.width / 2;
    player.y = app.screen.height / 2;
    app.stage.addChild(player);

    const bullets: Graphics[] = [];
    const enemies: Graphics[] = [];

    // Shooting logic
    window.addEventListener('mousedown', (e) => {
        const bullet = new Graphics().circle(0, 0, 5).fill(0xffffff);
        bullet.x = player.x;
        bullet.y = player.y;
        
        const angle = Math.atan2(e.clientY - player.y, e.clientX - player.x);
        (bullet as any).velocity = { 
            x: Math.cos(angle) * 10, 
            y: Math.sin(angle) * 10 
        };
        
        bullets.push(bullet);
        app.stage.addChild(bullet);
    });

    // Enemy Spawner
    setInterval(() => {
        const enemy = new Graphics().poly([0, -15, 15, 15, -15, 15]).fill(0xff0055);
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { enemy.x = Math.random() * app.screen.width; enemy.y = -20; }
        else if (side === 1) { enemy.x = app.screen.width + 20; enemy.y = Math.random() * app.screen.height; }
        else if (side === 2) { enemy.x = Math.random() * app.screen.width; enemy.y = app.screen.height + 20; }
        else { enemy.x = -20; enemy.y = Math.random() * app.screen.height; }
        
        enemies.push(enemy);
        app.stage.addChild(enemy);
    }, 800);

    app.ticker.add((time) => {
        // Bullet movement
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += (b as any).velocity.x * time.deltaTime;
            b.y += (b as any).velocity.y * time.deltaTime;
            
            if (b.x < 0 || b.x > app.screen.width || b.y < 0 || b.y > app.screen.height) {
                app.stage.removeChild(b);
                bullets.splice(i, 1);
            }
        }

        // Enemy movement & collision
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const angle = Math.atan2(player.y - e.y, player.x - e.x);
            e.x += Math.cos(angle) * 2 * time.deltaTime;
            e.y += Math.sin(angle) * 2 * time.deltaTime;
            e.rotation += 0.1 * time.deltaTime;

            // Simple Distance Collision
            for (let j = bullets.length - 1; j >= 0; j--) {
                const b = bullets[j];
                const dx = b.x - e.x;
                const dy = b.y - e.y;
                if (Math.sqrt(dx * dx + dy * dy) < 20) {
                    app.stage.removeChild(e);
                    enemies.splice(i, 1);
                    app.stage.removeChild(b);
                    bullets.splice(j, 1);
                    break;
                }
            }
        }
    });
}

init();
