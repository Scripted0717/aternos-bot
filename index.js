// --- Keepalive web server (for Render / UptimeRobot) ---
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("✅ Aternos bot is alive!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Web server running on port ${PORT}`));
// -------------------------------------------------------

const mineflayer = require('mineflayer');
const fs = require('fs');

// Load bot configuration
let config;
try {
    config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    console.log('[CONFIG] Configuration loaded successfully');
} catch (err) {
    console.log('[CONFIG] Could not load config.json, using defaults');
    config = {
        host: 'YourServerName.aternos.me',
        port: 25565,
        username: 'AFKBot',
        auth: 'offline',
        version: '1.21.8',
        antiDetection: {
            minMoveDuration: 1500,
            maxMoveDuration: 8000,
            minPauseDuration: 2000,
            maxPauseDuration: 12000,
            jumpChance: 0.3,
            lookAroundChance: 0.4
        }
    };
}

let bot;
let isMoving = false;

// Random number generator
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random movement directions
function getRandomDirection() {
    const directions = ['forward', 'back', 'left', 'right'];
    return directions[Math.floor(Math.random() * directions.length)];
}

// Start random movement
function startRandomMovement() {
    if (isMoving) return;
    isMoving = true;
    console.log('[BOT] Starting random movement pattern...');

    const moveRandomly = () => {
        if (!bot || !bot.entity) return;

        // Stop all current movements
        bot.setControlState('forward', false);
        bot.setControlState('back', false);
        bot.setControlState('left', false);
        bot.setControlState('right', false);
        bot.setControlState('jump', false);

        // Random movement duration
        const moveDuration = randomBetween(config.antiDetection.minMoveDuration, config.antiDetection.maxMoveDuration);

        // Random direction
        const direction = getRandomDirection();

        // Sometimes add jumping
        const shouldJump = Math.random() < config.antiDetection.jumpChance;

        // Sometimes rotate the view
        if (Math.random() < config.antiDetection.lookAroundChance) {
            const yaw = Math.random() * Math.PI * 2;
            const pitch = (Math.random() - 0.5) * Math.PI * 0.5;
            bot.look(yaw, pitch);
        }

        console.log(`[BOT] Moving ${direction} for ${moveDuration}ms${shouldJump ? ' (jumping)' : ''}`);

        // Start movement
        bot.setControlState(direction, true);
        if (shouldJump) bot.setControlState('jump', true);

        // Stop after duration
        setTimeout(() => {
            if (bot && bot.entity) {
                bot.setControlState(direction, false);
                bot.setControlState('jump', false);

                // Random pause
                const pauseDuration = randomBetween(config.antiDetection.minPauseDuration, config.antiDetection.maxPauseDuration);
                console.log(`[BOT] Pausing for ${pauseDuration}ms`);

                setTimeout(() => {
                    if (isMoving) moveRandomly();
                }, pauseDuration);
            }
        }, moveDuration);
    };

    // Start cycle
    moveRandomly();
}

// Stop movement
function stopMovement() {
    isMoving = false;
    if (bot && bot.entity) {
        bot.setControlState('forward', false);
        bot.setControlState('back', false);
        bot.setControlState('left', false);
        bot.setControlState('right', false);
        bot.setControlState('jump', false);
    }
    console.log('[BOT] Movement stopped');
}

// Create bot
function createBot() {
    try {
        console.log('[BOT] Creating bot...');
        const botConfig = {
            ...config,
            keepAlive: true,
            viewDistance: 'far',
            chatLengthLimit: 256
        };
        bot = mineflayer.createBot(botConfig);

        // Events
        bot.on('login', () => {
            console.log('[BOT] Successfully logged in!');
            console.log(`[BOT] Connected to ${bot.game.serverBrand || 'unknown server'}`);
        });

        bot.on('spawn', () => {
            console.log('[BOT] Spawned in world');
            if (bot.entity && bot.entity.position) {
                console.log(`[BOT] Position: ${bot.entity.position.x}, ${bot.entity.position.y}, ${bot.entity.position.z}`);
            }
            setTimeout(() => startRandomMovement(), 2000);
        });

        bot.on('health', () => {
            if (bot.health < 20 || bot.food < 20) {
                console.log(`[BOT] Health: ${bot.health}, Food: ${bot.food}`);
            }
            if (bot.health < 10) {
                console.log('[BOT] Health is low!');
                if (isMoving) {
                    stopMovement();
                    setTimeout(() => {
                        if (!isMoving) startRandomMovement();
                    }, 10000);
                }
            }
        });

        bot.on('death', () => {
            console.log('[BOT] Bot died! Respawning...');
            stopMovement();
            setTimeout(() => startRandomMovement(), 3000);
        });

        bot.on('kicked', (reason) => {
            console.log(`[BOT] Kicked: ${reason}`);
            stopMovement();
            setTimeout(() => {
                console.log('[BOT] Reconnecting after kick...');
                createBot();
            }, 300000); // 5 min
        });

        bot.on('error', (err) => {
            console.log(`[BOT] Error: ${err.message}`);
            if (err.message.includes('ECONNRESET') || err.message.includes('timeout') || err.message.includes('EPIPE')) {
                stopMovement();
                setTimeout(() => {
                    console.log('[BOT] Reconnecting after network error...');
                    createBot();
                }, 120000);
            }
        });

        bot._client.on('error', (err) => {
            console.log(`[BOT] Client error: ${err.message}`);
        });

        bot.on('end', () => {
            console.log('[BOT] Connection ended. Reconnecting...');
            stopMovement();
            setTimeout(() => createBot(), 90000);
        });

        setInterval(() => {
            if (bot && bot.entity) {
                console.log(`[STATUS] Health: ${bot.health}/20, Food: ${bot.food}/20, Pos: ${Math.round(bot.entity.position.x)}, ${Math.round(bot.entity.position.y)}, ${Math.round(bot.entity.position.z)}`);
            }
        }, 300000);

    } catch (error) {
        console.log(`[BOT] Failed to create bot: ${error.message}`);
        setTimeout(() => createBot(), 15000);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[BOT] Shutting down...');
    stopMovement();
    if (bot) bot.quit('Bot shutting down');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[BOT] Terminating...');
    stopMovement();
    if (bot) bot.quit('Bot terminating');
    process.exit(0);
});

// Error handlers
process.on('uncaughtException', (error) => {
    console.log(`[BOT] Uncaught exception: ${error.message}`);
});

process.on('unhandledRejection', (reason) => {
    console.log(`[BOT] Unhandled rejection: ${reason}`);
});

// Start bot
console.log('[BOT] Starting Minecraft AFK Bot...');
console.log('[BOT] Update config.json with your server details!');
createBot();
