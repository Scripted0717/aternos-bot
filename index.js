// --- Web keepalive server (Render + UptimeRobot) ---
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("✅ Multi Aternos bots alive!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Web server on port ${PORT}`));
// ----------------------------------------------------

const mineflayer = require("mineflayer");
const fs = require("fs");

// Load config
let config;
try {
  config = JSON.parse(fs.readFileSync("config.json", "utf8"));
  console.log("[CONFIG] Loaded");
} catch (err) {
  console.error("[CONFIG] Failed, check config.json");
  process.exit(1);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDirection() {
  const dirs = ["forward", "back", "left", "right"];
  return dirs[Math.floor(Math.random() * dirs.length)];
}

const chatMessages = ["hello", "brb", "lol", "hmm", "ok", "what’s up?", "idk", "xD", "cool"];

// Start anti-detection behavior
function startRandomMovement(bot, settings) {
  const moveRandomly = () => {
    if (!bot || !bot.entity) return;

    ["forward", "back", "left", "right", "jump"].forEach(key => bot.setControlState(key, false));

    const moveDuration = randomBetween(settings.minMoveDuration, settings.maxMoveDuration);
    const direction = getRandomDirection();
    const shouldJump = Math.random() < settings.jumpChance;

    if (Math.random() < settings.lookAroundChance) {
      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI * 0.5;
      bot.look(yaw, pitch);
    }

    if (Math.random() < settings.chatChance) {
      const msg = chatMessages[Math.floor(Math.random() * chatMessages.length)];
      bot.chat(msg);
      console.log(`[${bot.username}] Chat: ${msg}`);
    }

    console.log(`[${bot.username}] Moving ${direction} for ${moveDuration}ms`);

    bot.setControlState(direction, true);
    if (shouldJump) bot.setControlState("jump", true);

    setTimeout(() => {
      if (bot && bot.entity) {
        bot.setControlState(direction, false);
        bot.setControlState("jump", false);

        const pauseDuration = randomBetween(settings.minPauseDuration, settings.maxPauseDuration);
        console.log(`[${bot.username}] Pausing ${pauseDuration}ms`);

        setTimeout(moveRandomly, pauseDuration);
      }
    }, moveDuration);
  };

  moveRandomly();
}

// Create bot instance
function createBot(botConfig, settings) {
  console.log(`[BOT] Starting ${botConfig.username}...`);

  let bot = mineflayer.createBot({
    ...botConfig,
    keepAlive: true,
    viewDistance: "far"
  });

  bot.on("login", () => {
    console.log(`[${bot.username}] Logged in!`);
  });

  bot.on("spawn", () => {
    console.log(`[${bot.username}] Spawned`);
    setTimeout(() => startRandomMovement(bot, settings), 5000);
  });

  bot.on("death", () => {
    console.log(`[${bot.username}] Died - respawning`);
    setTimeout(() => startRandomMovement(bot, settings), 5000);
  });

  bot.on("kicked", reason => {
    console.log(`[${bot.username}] Kicked: ${reason}`);
    setTimeout(() => createBot(botConfig, settings), 900000); // 15min
  });

  bot.on("end", () => {
    console.log(`[${bot.username}] Disconnected - retrying`);
    setTimeout(() => createBot(botConfig, settings), 600000); // 10min
  });

  bot.on("error", err => {
    console.log(`[${bot.username}] Error: ${err.message}`);
    setTimeout(() => createBot(botConfig, settings), 600000);
  });
}

// Start all bots
config.bots.forEach(botConfig => {
  createBot(botConfig, config.antiDetection);
});
