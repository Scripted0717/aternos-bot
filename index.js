const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Aternos bot is alive!");
});

app.listen(3000, () => console.log("✅ Web server running on port 3000"));



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
let movementTimer;

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
        
        // Random movement duration using config settings
        const moveDuration = randomBetween(config.antiDetection.minMoveDuration, config.antiDetection.maxMoveDuration);
        
        // Random direction
        const direction = getRandomDirection();
        
        // Sometimes add jumping for more realistic movement
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
        if (shouldJump) {
            bot.setControlState('jump', true);
        }
        
        // Stop movement after duration
        setTimeout(() => {
            if (bot && bot.entity) {
                bot.setControlState(direction, false);
                bot.setControlState('jump', false);
                
                // Random pause between movements using config settings
                const pauseDuration = randomBetween(config.antiDetection.minPauseDuration, config.antiDetection.maxPauseDuration);
                console.log(`[BOT] Pausing for ${pauseDuration}ms`);
                
                setTimeout(() => {
                    if (isMoving) moveRandomly();
                }, pauseDuration);
            }
        }, moveDuration);
    };
    
    // Start the movement cycle
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
        
        // Enhanced bot configuration for stability
        const botConfig = {
            ...config,
            keepAlive: true,
            viewDistance: 'far',
            chatLengthLimit: 256
        };
        
        bot = mineflayer.createBot(botConfig);
    
    // Bot events
    bot.on('login', () => {
        console.log('[BOT] Successfully logged in!');
        console.log(`[BOT] Connected to ${bot.game.serverBrand || 'unknown server'}`);
    });
    
    bot.on('spawn', () => {
        console.log('[BOT] Spawned in world');
        if (bot.entity && bot.entity.position) {
            console.log(`[BOT] Position: ${bot.entity.position.x}, ${bot.entity.position.y}, ${bot.entity.position.z}`);
        }
        
        // Start random movement after a short delay
        setTimeout(() => {
            startRandomMovement();
        }, 2000);
    });
    
    // No chat functionality - pure AFK bot
    
    bot.on('health', () => {
        if (bot.health < 20 || bot.food < 20) {
            console.log(`[BOT] Health: ${bot.health}, Food: ${bot.food}`);
        }
        
        // If health is low, try to find food or avoid danger
        if (bot.health < 10) {
            console.log('[BOT] Health is low!');
            // Stop movement temporarily when health is critical
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
        setTimeout(() => {
            startRandomMovement();
        }, 3000);
    });
    
    bot.on('kicked', (reason) => {
        console.log(`[BOT] Kicked from server: ${reason}`);
        console.log('[BOT] Waiting 5 minutes before reconnecting to prevent throttling...');
        
        // Clean up
        stopMovement();
        
        // Much longer delay to prevent server throttling
        setTimeout(() => {
            console.log('[BOT] Attempting reconnection after kick...');
            createBot();
        }, 300000); // 5 minute delay
    });
    
    bot.on('error', (err) => {
        console.log(`[BOT] Error: ${err.message}`);
        
        // Only reconnect on specific errors, not all errors
        if (err.message.includes('ECONNRESET') || err.message.includes('timeout') || err.message.includes('EPIPE')) {
            console.log('[BOT] Network error detected - waiting 2 minutes before reconnecting...');
            stopMovement();
            
            setTimeout(() => {
                console.log('[BOT] Attempting to reconnect after network error...');
                try {
                    createBot();
                } catch (reconnectError) {
                    console.log(`[BOT] Reconnection failed: ${reconnectError.message}`);
                }
            }, 120000); // 2 minute delay for network errors
        } else {
            console.log('[BOT] Non-network error - bot will continue without reconnecting');
        }
    });
    
    // Handle packet errors that could crash the bot
    bot._client.on('error', (err) => {
        console.log(`[BOT] Client error (non-fatal): ${err.message}`);
        // Don't reconnect on client errors, just log them
    });
    
    bot.on('end', () => {
        console.log('[BOT] Connection ended - waiting 90 seconds before reconnecting...');
        stopMovement();
        
        // Much longer delay for normal disconnections
        setTimeout(() => {
            console.log('[BOT] Reconnecting after connection end...');
            createBot();
        }, 90000); // 90 second delay
    });
    
    // Periodic status updates (reduced frequency for stability)
    setInterval(() => {
        if (bot && bot.entity) {
            console.log(`[STATUS] Health: ${bot.health}/20, Food: ${bot.food}/20, Position: ${Math.round(bot.entity.position.x)}, ${Math.round(bot.entity.position.y)}, ${Math.round(bot.entity.position.z)}`);
        }
    }, 300000); // Every 5 minutes
    
    } catch (error) {
        console.log(`[BOT] Failed to create bot: ${error.message}`);
        console.log('[BOT] Retrying in 15 seconds...');
        setTimeout(() => {
            createBot();
        }, 15000);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n[BOT] Shutting down...');
    stopMovement();
    if (bot) {
        bot.quit('Bot shutting down');
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[BOT] Terminating...');
    stopMovement();
    if (bot) {
        bot.quit('Bot terminating');
    }
    process.exit(0);
});

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
    console.log(`[BOT] Uncaught exception: ${error.message}`);
    console.log('[BOT] Bot will continue running...');
});

process.on('unhandledRejection', (reason, promise) => {
    console.log(`[BOT] Unhandled rejection: ${reason}`);
    console.log('[BOT] Bot will continue running...');
});

// Start the bot
console.log('[BOT] Starting Minecraft AFK Bot...');
console.log('[BOT] Remember to update the server config before running!');
createBot();