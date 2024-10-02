// Add this at the beginning of the file
const font = new FontFace('DepartureMono', 'url(DepartureMono-Regular.otf)');
font.load().then(function(loadedFont) {
    document.fonts.add(loadedFont);
    // Re-render the canvas after the font is loaded
    if (!gameState.gameOver) {
        gameLoop();
    }
}).catch(function(error) {
    console.error('Font loading failed:', error);
});

// Create the canvas
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);

// Game state
let gameState = {
    player: null,
    bullets: [],
    enemies: [],
    enemySpawnCounter: 0,
    startTime: 0,
    gameOver: false,
    lastShotTime: 0,
    score: 0,
    highScores: [],
    lastShotEnemy: null,
    bossSpawnTimer: 0,
    bossActive: false,
    bossShootAngle: 0
};

// Constants
const bulletSpeed = 5; // Reduced from 10
const enemySpawnRate = 120; // Increased from 60 to further slow down enemy spawning
const gameDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
const fireRate = 750; // Increased from 500 to reduce fire rate
const COLORS = {
    background: '#EDEAE6',
    main: '#282727',
    enemy1: '#F1491D',
    enemy2: '#F1CA1D',
    enemy3: '#561DF1'
};

// Initialize game
function initGame() {
    // Load high scores from local storage
    const storedHighScores = JSON.parse(localStorage.getItem('highScores')) || [];
    
    gameState = {
        player: {
            x: canvas.width / 2,
            y: canvas.height / 2,
            radius: 20,
            speed: 3, // Reduced from 5
            health: 100,
            invulnerableTime: 0
        },
        bullets: [],
        enemies: [],
        enemySpawnCounter: 0,
        startTime: Date.now(),
        gameOver: false,
        lastShotTime: 0,
        score: 0,
        highScores: storedHighScores,
        lastShotEnemy: null,
        bossSpawnTimer: 0,
        bossActive: false,
        bossShootAngle: 0
    };
}

// Game loop
function gameLoop() {
    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update timer
    const currentTime = Date.now();
    const elapsedTime = currentTime - gameState.startTime;
    const remainingTime = Math.max(0, gameDuration - elapsedTime);
    
    // Draw timer, score, and enemy health
    ctx.font = '18px DepartureMono, monospace'; // Reduced font size
    ctx.fillStyle = COLORS.main;
    ctx.textAlign = 'center';
    const minutes = Math.floor(elapsedTime / 60000);
    const seconds = Math.floor((elapsedTime % 60000) / 1000);
    const milliseconds = elapsedTime % 1000;
    
    // Draw score and time above player health bar, swapped positions
    const healthBarY = canvas.height - 36; // 16px (health bar height) + 20px (from bottom)
    ctx.fillText(`Score: ${gameState.score}`, canvas.width / 2, healthBarY - 40);
    ctx.fillText(`Time: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`, canvas.width / 2, healthBarY - 20);

    // Draw enemy health bar at the top if applicable
    if (gameState.lastShotEnemy && gameState.lastShotEnemy.health) {
        const enemyHealthBarWidth = canvas.width * 0.3;
        const enemyHealthBarHeight = 16; // Reduced to 16px
        const enemyHealthBarX = (canvas.width - enemyHealthBarWidth) / 2;
        const enemyHealthBarY = 20;

        // Background of enemy health bar
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(enemyHealthBarX, enemyHealthBarY, enemyHealthBarWidth, enemyHealthBarHeight);

        // Actual enemy health
        ctx.fillStyle = 'rgba(255, 165, 0, 0.7)'; // Orange for enemy health
        const currentEnemyHealthWidth = (gameState.lastShotEnemy.health / gameState.lastShotEnemy.maxHealth) * enemyHealthBarWidth;
        ctx.fillRect(enemyHealthBarX, enemyHealthBarY, currentEnemyHealthWidth, enemyHealthBarHeight);

        // Border for enemy health bar
        ctx.strokeStyle = COLORS.main;
        ctx.lineWidth = 2;
        ctx.strokeRect(enemyHealthBarX, enemyHealthBarY, enemyHealthBarWidth, enemyHealthBarHeight);

        // Enemy type label
        ctx.fillStyle = COLORS.main;
        ctx.textAlign = 'center';
        ctx.font = '14px DepartureMono, monospace'; // Reduced font size for enemy name
        ctx.fillText(gameState.lastShotEnemy.type, canvas.width / 2, enemyHealthBarY + enemyHealthBarHeight + 15);
    }

    // Check for win condition
    if (elapsedTime >= gameDuration && !gameState.gameOver) {
        endGame('Time\'s up!');
        return;
    }

    // Boss spawn logic
    if (!gameState.bossActive) {
        gameState.bossSpawnTimer += 1000 / 60; // Assuming 60 FPS
        if (gameState.bossSpawnTimer >= 40000) { // 40 seconds
            spawnBoss();
            gameState.bossSpawnTimer = 0;
        }
    }

    // Only spawn regular enemies if there's no boss
    if (!gameState.bossActive) {
        gameState.enemySpawnCounter++;
        if (gameState.enemySpawnCounter >= enemySpawnRate) {
            spawnEnemy();
            gameState.enemySpawnCounter = 0;
        }
    }

    updatePlayer();
    updateBullets();
    updateEnemies();

    if (!gameState.gameOver) {
        requestAnimationFrame(gameLoop);
    }
}

function updatePlayer() {
    const player = gameState.player;

    // Move player
    if (keys.ArrowLeft) player.x -= player.speed;
    if (keys.ArrowRight) player.x += player.speed;
    if (keys.ArrowUp) player.y -= player.speed;
    if (keys.ArrowDown) player.y += player.speed;

    // Keep player in bounds
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

    // Draw player
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.invulnerableTime > 0 ? 'rgba(40, 39, 39, 0.5)' : COLORS.main;
    ctx.fill();

    // Draw player health bar at the bottom of the screen
    const healthBarWidth = canvas.width * 0.3; // 30% of screen width
    const healthBarHeight = 16; // Reduced to 16px
    const healthBarX = (canvas.width - healthBarWidth) / 2;
    const healthBarY = canvas.height - healthBarHeight - 20; // 20px from bottom

    // Background of health bar
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

    // Actual health
    ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
    const currentHealthWidth = (player.health / 100) * healthBarWidth;
    ctx.fillRect(healthBarX, healthBarY, currentHealthWidth, healthBarHeight);

    // Border for health bar
    ctx.strokeStyle = COLORS.main;
    ctx.lineWidth = 2;
    ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

    // Update invulnerability timer
    if (player.invulnerableTime > 0) {
        player.invulnerableTime--;
    }

    // Auto-attack
    if (Date.now() - gameState.lastShotTime >= fireRate) {
        const closestEnemy = findClosestEnemy();
        if (closestEnemy) {
            shootBullet(closestEnemy);
            gameState.lastShotTime = Date.now();
        }
    }
}

function updateBullets() {
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const bullet = gameState.bullets[i];
        bullet.x += bullet.dx * 0.5; // Reduced bullet speed
        bullet.y += bullet.dy * 0.5; // Reduced bullet speed

        // Remove bullets that are out of bounds
        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            gameState.bullets.splice(i, 1);
            continue;
        }

        // Draw bullet
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = bullet.isEnemy ? COLORS.enemy2 : COLORS.main;
        ctx.fill();
    }
}

function updateEnemies() {
    const player = gameState.player;

    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const enemy = gameState.enemies[i];
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate new position
        let newX = enemy.x + (dx / distance) * enemy.speed;
        let newY = enemy.y + (dy / distance) * enemy.speed;

        // Check for collision with other enemies
        let canMove = true;
        for (let j = 0; j < gameState.enemies.length; j++) {
            if (i !== j) {
                const otherEnemy = gameState.enemies[j];
                const distanceToOther = Math.sqrt((newX - otherEnemy.x) ** 2 + (newY - otherEnemy.y) ** 2);
                if (distanceToOther < enemy.radius + otherEnemy.radius) {
                    canMove = false;
                    break;
                }
            }
        }

        // Move enemy if no collision
        if (canMove) {
            enemy.x = newX;
            enemy.y = newY;
        }

        // Enemy shooting
        if (enemy.canShoot) {
            enemy.shootCounter++;
            if (enemy.shootCounter >= enemy.shootRate) {
                enemyShoot(enemy);
                enemy.shootCounter = 0;
            }
        }

        // Check for collision with player bullets
        for (let j = gameState.bullets.length - 1; j >= 0; j--) {
            const bullet = gameState.bullets[j];
            if (!bullet.isEnemy) {
                const bulletDistance = Math.sqrt((bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2);
                if (bulletDistance < enemy.radius + 5) {
                    if (enemy.health) {
                        enemy.health -= 1;
                        gameState.lastShotEnemy = enemy;
                        if (enemy.health <= 0) {
                            if (enemy.type === 'boss') {
                                gameState.bossActive = false;
                                gameState.bossSpawnTimer = 0;
                            } else if (enemy.type === 'splitting') {
                                // Spawn two smaller enemies
                                for (let k = 0; k < 2; k++) {
                                    gameState.enemies.push({
                                        x: enemy.x + (Math.random() - 0.5) * 20,
                                        y: enemy.y + (Math.random() - 0.5) * 20,
                                        radius: enemy.radius / 2,
                                        speed: enemy.speed * 1.5,
                                        health: 1,
                                        maxHealth: 1,
                                        color: enemy.color,
                                        damage: Math.floor(enemy.damage / 2),
                                        type: 'split_child'
                                    });
                                }
                            }
                            if (enemy.type === 'explosive') {
                                createExplosion(enemy);
                            }
                            gameState.enemies.splice(i, 1);
                            gameState.score += getScoreForEnemy(enemy.type);
                            break;
                        }
                    } else {
                        if (enemy.type === 'explosive') {
                            createExplosion(enemy);
                        }
                        gameState.enemies.splice(i, 1);
                        gameState.score += getScoreForEnemy(enemy.type);
                    }
                    gameState.bullets.splice(j, 1);
                    break;
                }
            }
        }

        // Special behavior for different enemy types
        switch (enemy.type) {
            case 'boss':
                if (enemy.canShoot) {
                    enemy.shootCounter++;
                    if (enemy.shootCounter >= enemy.shootRate) {
                        // Rotate the shooting pattern
                        gameState.bossShootAngle += Math.PI / 16;
                        if (gameState.bossShootAngle >= Math.PI * 2) {
                            gameState.bossShootAngle -= Math.PI * 2;
                        }
                        
                        // Shoot in 8 directions
                        for (let i = 0; i < 8; i++) {
                            const angle = gameState.bossShootAngle + (i * Math.PI / 4);
                            enemyShoot(enemy, angle);
                        }
                        enemy.shootCounter = 0;
                    }
                }
                break;
            case 'regenerating':
                if (enemy.health < enemy.maxHealth) {
                    enemy.health = Math.min(enemy.maxHealth, enemy.health + enemy.regenerationRate);
                }
                break;
            case 'teleporting':
                enemy.teleportCounter++;
                if (enemy.teleportCounter >= enemy.teleportCooldown) {
                    enemy.x = Math.random() * canvas.width;
                    enemy.y = Math.random() * canvas.height;
                    enemy.teleportCounter = 0;
                }
                break;
        }

        // Check for collision with player
        if (distance < player.radius + enemy.radius && player.invulnerableTime <= 0) {
            player.health -= enemy.damage;
            player.invulnerableTime = 60; // 1 second of invulnerability (assuming 60 FPS)
            if (player.health <= 0) {
                endGame('Game Over!');
                return;
            }
        }

        // Draw enemy
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fillStyle = enemy.color;
        ctx.fill();
    }

    // Check if boss is still alive
    gameState.bossActive = gameState.enemies.some(enemy => enemy.type === 'boss');

    // Check for player collision with enemy bullets
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const bullet = gameState.bullets[i];
        if (bullet.isEnemy) {
            const bulletDistance = Math.sqrt((bullet.x - player.x) ** 2 + (bullet.y - player.y) ** 2);
            if (bulletDistance < player.radius + 5 && player.invulnerableTime <= 0) {
                player.health -= 10;
                player.invulnerableTime = 60; // 1 second of invulnerability (assuming 60 FPS)
                gameState.bullets.splice(i, 1);
                if (player.health <= 0) {
                    endGame('Game Over!');
                    return;
                }
            }
        }
    }
}

function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
        case 0: // Top
            x = Math.random() * canvas.width;
            y = 0;
            break;
        case 1: // Right
            x = canvas.width;
            y = Math.random() * canvas.height;
            break;
        case 2: // Bottom
            x = Math.random() * canvas.width;
            y = canvas.height;
            break;
        case 3: // Left
            x = 0;
            y = Math.random() * canvas.height;
            break;
    }
    
    const enemyType = Math.random();
    let enemy;
    
    if (enemyType < 0.20) { // 20% chance for basic enemy
        enemy = { 
            x, y, 
            radius: 15, 
            speed: 0.75,
            canShoot: false,
            color: COLORS.enemy1,
            damage: 25,
            type: 'basic'
        };
    } else if (enemyType < 0.35) { // 15% chance for shooting enemy
        enemy = { 
            x, y, 
            radius: 15, 
            speed: 0.5,
            canShoot: true, 
            shootRate: 180,
            shootCounter: 0,
            color: COLORS.enemy2,
            damage: 20,
            type: 'shooter'
        };
    } else if (enemyType < 0.50) { // 15% chance for tank enemy
        enemy = { 
            x, y, 
            radius: 25, 
            speed: 0.25,
            canShoot: false,
            health: 5,
            maxHealth: 5,
            color: COLORS.enemy3,
            damage: 40,
            type: 'tank'
        };
    } else if (enemyType < 0.60) { // 10% chance for speedy enemy
        enemy = {
            x, y,
            radius: 10,
            speed: 1.5,
            canShoot: false,
            color: '#FF00FF', // Magenta
            damage: 15,
            type: 'speedy'
        };
    } else if (enemyType < 0.70) { // 10% chance for super speedy enemy
        enemy = {
            x, y,
            radius: 8,
            speed: 2.5,
            canShoot: false,
            color: '#00FFFF', // Cyan
            damage: 20,
            type: 'super_speedy'
        };
    } else if (enemyType < 0.77) { // 7% chance for explosive enemy
        enemy = {
            x, y,
            radius: 20,
            speed: 0.4,
            canShoot: false,
            color: '#FFA500', // Orange
            damage: 50,
            explosionRadius: 100,
            type: 'explosive'
        };
    } else if (enemyType < 0.84) { // 7% chance for regenerating enemy
        enemy = {
            x, y,
            radius: 18,
            speed: 0.6,
            canShoot: false,
            health: 3,
            maxHealth: 3,
            regenerationRate: 0.005,
            color: '#00FF00', // Green
            damage: 30,
            type: 'regenerating'
        };
    } else if (enemyType < 0.91) { // 7% chance for splitting enemy
        enemy = {
            x, y,
            radius: 22,
            speed: 0.5,
            canShoot: false,
            health: 2,
            maxHealth: 2,
            color: '#8A2BE2', // BlueViolet
            damage: 35,
            type: 'splitting'
        };
    } else { // 9% chance for teleporting enemy (increased from 5%)
        enemy = {
            x, y,
            radius: 12,
            speed: 1,
            canShoot: false,
            color: '#FF1493', // DeepPink
            damage: 25,
            teleportCooldown: 180,
            teleportCounter: 0,
            type: 'teleporting'
        };
    }
    
    // Check if the new enemy overlaps with existing enemies
    const canSpawn = !gameState.enemies.some(existingEnemy => {
        const distance = Math.sqrt((x - existingEnemy.x) ** 2 + (y - existingEnemy.y) ** 2);
        return distance < enemy.radius + existingEnemy.radius;
    });

    if (canSpawn) {
        gameState.enemies.push(enemy);
    }
}

function enemyShoot(enemy, angle = null) {
    const player = gameState.player;
    let dx, dy;
    if (angle === null) {
        dx = player.x - enemy.x;
        dy = player.y - enemy.y;
    } else {
        dx = Math.cos(angle);
        dy = Math.sin(angle);
    }
    const distance = Math.sqrt(dx * dx + dy * dy);
    const bulletSpeed = enemy.type === 'boss' ? 3 : 2; // Faster bullets for boss
    gameState.bullets.push({
        x: enemy.x,
        y: enemy.y,
        dx: (dx / distance) * bulletSpeed,
        dy: (dy / distance) * bulletSpeed,
        isEnemy: true
    });
}

function findClosestEnemy() {
    let closestEnemy = null;
    let closestDistance = Infinity;
    const player = gameState.player;

    for (const enemy of gameState.enemies) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestEnemy = enemy;
        }
    }

    return closestEnemy;
}

function shootBullet(target) {
    const player = gameState.player;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    gameState.bullets.push({
        x: player.x,
        y: player.y,
        dx: (dx / distance) * bulletSpeed,
        dy: (dy / distance) * bulletSpeed,
        isEnemy: false
    });
}

function endGame(message) {
    gameState.gameOver = true;
    const time = Date.now() - gameState.startTime;
    const score = gameState.score;
    gameState.highScores.push({ time, score });
    gameState.highScores.sort((a, b) => b.score - a.score);
    
    // Save high scores to local storage
    localStorage.setItem('highScores', JSON.stringify(gameState.highScores));
    
    setTimeout(() => {
        displayScoreModal(message, time, score);
    }, 100);
}

function displayScoreModal(message, time, score) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = COLORS.background;
    modal.style.color = COLORS.main;
    modal.style.padding = '40px';
    modal.style.borderRadius = '20px';
    modal.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
    modal.style.zIndex = '1000';
    modal.style.width = '80%';
    modal.style.maxWidth = '600px';
    modal.style.maxHeight = '80%';
    modal.style.overflowY = 'auto';
    modal.style.fontFamily = 'DepartureMono, monospace';
    modal.style.textAlign = 'center'; // Center all contentt

    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    const milliseconds = time % 1000;

    modal.innerHTML = `
        <h2 style="font-size: 28px; margin-bottom: 20px;">${message}</h2>
        <p style="font-size: 24px; margin-bottom: 10px;">Your time: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}</p>
        <p style="font-size: 24px; margin-bottom: 30px;">Your score: ${score}</p>
        <h3 style="font-size: 24px; margin-bottom: 20px;">High Scores:</h3>
        <div id="highScoresContainer" style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
            <ol id="highScoresList" style="font-size: 18px; padding-left: 0; list-style-position: inside;"></ol>
        </div>
        <button onclick="closeModal()" style="background-color: ${COLORS.main}; color: ${COLORS.background}; border: none; padding: 15px 30px; cursor: pointer; font-size: 20px; margin-top: 30px; font-family: inherit;">Play Again</button>
    `;

    document.body.appendChild(modal);

    const highScoresList = document.getElementById('highScoresList');
    gameState.highScores.forEach((highScore, index) => {
        const li = document.createElement('li');
        const highScoreMinutes = Math.floor(highScore.time / 60000);
        const highScoreSeconds = Math.floor((highScore.time % 60000) / 1000);
        const highScoreMilliseconds = highScore.time % 1000;
        li.textContent = `Score: ${highScore.score} - Time: ${highScoreMinutes.toString().padStart(2, '0')}:${highScoreSeconds.toString().padStart(2, '0')}.${highScoreMilliseconds.toString().padStart(3, '0')}`;
        li.style.marginBottom = '10px';
        if (highScore.time === time && highScore.score === score) {
            li.style.fontWeight = 'bold';
            li.style.color = COLORS.enemy1;
        }
        highScoresList.appendChild(li);
    });
}

function closeModal() {
    const modal = document.querySelector('div[style*="position: fixed"]');
    if (modal) {
        modal.remove();
    }
    initGame();
    gameLoop();
}

// Keyboard input
const keys = {};
document.addEventListener('keydown', (e) => keys[e.code] = true);
document.addEventListener('keyup', (e) => keys[e.code] = false);

// Resize canvas when window is resized
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Start the game
initGame();
gameLoop();

// Add this function to handle explosions
function createExplosion(enemy) {
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const otherEnemy = gameState.enemies[i];
        const distance = Math.sqrt((enemy.x - otherEnemy.x) ** 2 + (enemy.y - otherEnemy.y) ** 2);
        if (distance <= enemy.explosionRadius) {
            gameState.enemies.splice(i, 1);
        }
    }

    // Check if player is caught in the explosion
    const playerDistance = Math.sqrt((enemy.x - gameState.player.x) ** 2 + (enemy.y - gameState.player.y) ** 2);
    if (playerDistance <= enemy.explosionRadius && gameState.player.invulnerableTime <= 0) {
        gameState.player.health -= enemy.damage;
        gameState.player.invulnerableTime = 60;
        if (gameState.player.health <= 0) {
            endGame('Game Over!');
        }
    }

    // Visual effect for explosion
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.explosionRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 165, 0, 0.5)';
    ctx.fill();
}

// Update the getScoreForEnemy function
function getScoreForEnemy(enemyType) {
    switch (enemyType) {
        case 'basic': return 10;
        case 'shooter': return 20;
        case 'tank': return 30;
        case 'speedy': return 15;
        case 'super_speedy': return 25;
        case 'explosive': return 25;
        case 'regenerating': return 35;
        case 'splitting': return 30;
        case 'split_child': return 15;
        case 'teleporting': return 40;
        case 'boss': return 100;
        default: return 5;
    }
}

// New function to spawn a boss
function spawnBoss() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
        case 0: x = Math.random() * canvas.width; y = 0; break;
        case 1: x = canvas.width; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height; break;
        case 3: x = 0; y = Math.random() * canvas.height; break;
    }

    const boss = {
        x, y,
        radius: 35,
        speed: 0.2,
        canShoot: true,
        shootRate: 240,
        shootCounter: 0,
        health: 20, // Reduced from 30 to 20
        maxHealth: 20, // Also reduced maxHealth
        color: '#FF0000', // Red
        damage: 60,
        type: 'boss'
    };

    gameState.enemies.push(boss);
    gameState.bossActive = true;
}