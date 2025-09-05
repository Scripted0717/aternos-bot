// --- Keepalive web server (for Render / UptimeRobot) ---
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("✅ Aternos bot is alive!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Web server running on port ${PORT}`));
// -------------------------------------------------------

const mineflayer = require("mineflayer");
const fs = require("fs");

// Load bot configuration
let config;
try {
  config = JSON.parse(fs.readFileSync("config.json", "utf8"));
  console.log("[CONFIG] Configuration loaded successfully");
} catch (err) {
  console.log("[CONFIG] Could not load config.json, using defaults");
  config = {
    servers: [
      {
        host: "YourServerName.aternos.me",
        port: 25565,
        username: "AFKBot",
        auth: "offline",
        version: "1.21.8",
      },
    ],
    antiDetection: {
      minMoveDuration: 1500,
      maxMoveDuration: 8000,
      minPauseDuration: 2000,
      maxPauseDuration: 12000,
      jumpChance: 0.3,
      lookAroundChance: 0.4,
    },
  };
}

let isMoving = {}; // track per-bot movement state

// Random number generator
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random movement directions
function getRandomDirection() {
  const directions = ["forward", "back", "left", "right"];
  return directions[Math.floor(Math.random() * directions.length)];
}

// Start random movement
function startRandomMovement(bot, id) {
  if (isMoving[id]) return;
  isMoving[id] = true;
  console.log(`[BOT ${id}] Starting random movement pattern...`);

  const moveRandomly = () => {
    if (!bot || !bot.entity) return;

    // Stop all current movements
    ["forward", "back", "left", "right", "jump"].forEach((d) =>
      bot.setControlState(d, false)
    );

    // Random movement duration
    const moveDuration = randomBetween(
      config.antiDetection.minMoveDuration,
      config.antiDetection.maxMoveDuration
    );

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

    console.log(
      `[BOT ${id}] Moving ${direction} for ${moveDuration}ms${
        shouldJump ? " (jumping)" : ""
      }`
    );

    // Start movement
    bot.setControlState(direction, true);
    if (shouldJump) bot.setControlState("jump", true);

    // Stop after duration
    setTimeout(() => {
      if (bot && bot.entity) {
        bot.setControlState(direction, false);
        bot.setControlState("jump", false);

        // Random pause
        const pauseDuration = randomBetween(
          config.antiDetection.minPauseDuration,
          config.antiDetection.maxPauseDuration
        );
        console.log(`[BOT ${id}] Pausing for ${pauseDuration}ms`);

        setTimeout(() => {
          if (isMoving[id]) moveRandomly();
        }, pauseDuration);
      }
    }, moveDuration);
  };

  moveRandomly();
}

// Stop movement
function stopMovement(bot, id) {
  isMoving[id] = false;
  if (bot && bot.entity) {
    ["forward", "back", "left", "right", "jump"].forEach((d) =>
      bot.setControlState(d, false)
    );
  }
  console.log(`[BOT ${id}] Movement stopped`);
}

// Create bot for a server
function createBot(server, id) {
  try {
    console.log(`[BOT ${id}] Creating bot for ${server.host}:${server.port}...`);
    const bot = mineflayer.createBot({
      ...server,
      keepAlive: true,
      viewDistance: "far",
      chatLengthLimit: 256,
    });

    bot.on("login", () => {
      console.log(`[BOT ${id}] Successfully logged in as ${server.username}`);
    });

    bot.on("spawn", () => {
      console.log(`[BOT ${id}] Spawned in world`);
      if (bot.entity && bot.entity.position) {
        console.log(
          `[BOT ${id}] Position: ${bot.entity.position.x}, ${bot.entity.position.y}, ${bot.entity.position.z}`
        );
      }
      setTimeout(() => startRandomMovement(bot, id), 2000);
    });

    bot.on("health", () => {
      if (bot.health < 20 || bot.food < 20) {
        console.log(
          `[BOT ${id}] Health: ${bot.health}, Food: ${bot.food}`
        );
      }
    });

    bot.on("death", () => {
      console.log(`[BOT ${id}] Bot died! Respawning...`);
      stopMovement(bot, id);
      setTimeout(() => startRandomMovement(bot, id), 3000);
    });

    bot.on("kicked", (reason) => {
      console.log(`[BOT ${id}] Kicked: ${reason}`);
      stopMovement(bot, id);
      setTimeout(() => createBot(server, id), 300000);
    });

    bot.on("error", (err) => {
      console.log(`[BOT ${id}] Error: ${err.message}`);
      if (
        err.message.includes("ECONNRESET") ||
        err.message.includes("timeout") ||
        err.message.includes("EPIPE")
      ) {
        stopMovement(bot, id);
        setTimeout(() => createBot(server, id), 120000);
      }
    });

    bot.on("end", () => {
      console.log(`[BOT ${id}] Connection ended. Reconnecting...`);
      stopMovement(bot, id);
      setTimeout(() => createBot(server, id), 90000);
    });

    setInterval(() => {
      if (bot && bot.entity) {
        console.log(
          `[STATUS ${id}] Health: ${bot.health}/20, Food: ${bot.food}/20, Pos: ${Math.round(
            bot.entity.position.x
          )}, ${Math.round(bot.entity.position.y)}, ${Math.round(
            bot.entity.position.z
          )}`
        );
      }
    }, 300000);
  } catch (error) {
    console.log(`[BOT ${id}] Failed to create bot: ${error.message}`);
    setTimeout(() => createBot(server, id), 15000);
  }
}

// Start all bots
console.log("[BOT] Starting Minecraft AFK Bots...");
config.servers.forEach((server, index) => {
  createBot(server, index + 1);
});
