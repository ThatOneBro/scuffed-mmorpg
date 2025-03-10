import geckos, { Data, GeckosServer, ServerChannel } from "@geckos.io/server";
import { SnapshotInterpolation } from "@geckos.io/snapshot-interpolation";
import {
  MessageType,
  Player,
  Position,
  createMessage,
} from "@scuffed-mmorpg/common";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Create a geckos.io server with explicit port range for UDP
const io: GeckosServer = geckos({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Add more STUN servers for redundancy
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
  portRange: {
    min: 10000,
    max: 10100,
  },
  cors: {
    origin: "*", // Allow connections from any origin
    allowAuthorization: true,
  },
  authorization: async (auth, request) => {
    // Log connection attempts for debugging
    console.log(
      `Connection attempt from: ${request.headers.origin || "unknown origin"}`
    );
    return true; // Allow all connections
  },
});

// Log server information
console.log("Geckos.io server initialized");

// IMPORTANT: Attach geckos.io to the http server BEFORE defining any routes
io.addServer(server);

const PORT = process.env.PORT || 3001;

// Log the environment
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`Running on port: ${PORT}`);
console.log(`WebRTC signaling endpoint: /.wrtc/v2/connections`);

// Initialize the snapshot interpolation
const SI = new SnapshotInterpolation(60); // 60 FPS server tick rate

// Store connected players
const players: Record<string, Player> = {};

// Store all channels for direct access
const channels: Map<string, ServerChannel> = new Map();

// Game loop variables
const TICK_RATE = 20; // Send updates 20 times per second
let tick = 0;
let gameLoopInterval: NodeJS.Timeout | null = null;

// Serve static files from the game package
const gamePath = path.resolve(__dirname, "../../game/dist");
app.use(express.static(gamePath));

// Make sure the server can handle JSON requests (needed for WebRTC signaling)
app.use(express.json());

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Handle connections
io.onConnection((channel: ServerChannel) => {
  // Use string ID for consistency
  const playerId = channel.id?.toString() || "";

  if (!playerId) {
    console.error("Player connected but no ID was assigned");
    return;
  }

  console.log(`Player connected: ${playerId}`);

  // Store the channel for later use
  channels.set(playerId, channel);

  // Create a new player
  const player: Player = {
    id: playerId,
    name: `Player ${playerId.substring(0, 5)}`,
    position: {
      x: Math.floor(Math.random() * 800),
      y: Math.floor(Math.random() * 600),
    },
    health: 100,
  };

  // Add player to the list
  players[playerId] = player;

  // Send player joined message to all clients
  broadcastToAll(createMessage(MessageType.PLAYER_JOIN, player));

  // Send current game state to the new player
  channel.emit("message", createMessage(MessageType.GAME_STATE, { players }));

  // Start the game loop if it's not already running
  if (!gameLoopInterval && Object.keys(players).length > 0) {
    startGameLoop();
  }

  // Handle player movement
  channel.on("move", (data: Data) => {
    // Validate and convert the data to Position
    if (!data || typeof data !== "object") return;

    const position = data as Position & { name?: string };
    if (typeof position.x !== "number" || typeof position.y !== "number")
      return;

    if (players[playerId]) {
      // Update the player's position
      players[playerId].position = { x: position.x, y: position.y };

      // Update the player's name if provided
      if (position.name && typeof position.name === "string") {
        players[playerId].name = position.name;
      }
    }
  });

  // Handle player name updates
  channel.on("updateName", (data: Data) => {
    if (!data || typeof data !== "object") return;

    const nameData = data as { name: string };
    if (!nameData.name || typeof nameData.name !== "string") return;

    if (players[playerId]) {
      // Update the player's name
      players[playerId].name = nameData.name;
      console.log(`Player ${playerId} changed name to: ${nameData.name}`);
    }
  });

  // Handle disconnection
  channel.onDisconnect(() => {
    console.log(`Player disconnected: ${playerId}`);

    // Remove player from the list
    delete players[playerId];

    // Remove channel from our map
    channels.delete(playerId);

    // Broadcast player left message to all clients
    broadcastToAll(createMessage(MessageType.PLAYER_LEAVE, { playerId }));

    // Stop the game loop if no players are left
    if (Object.keys(players).length === 0 && gameLoopInterval) {
      stopGameLoop();
    }
  });
});

// Catch-all route to serve the game for any other routes
app.get("/", (req, res) => {
  res.sendFile(path.join(gamePath, "index.html"));
});

// Start the game loop
function startGameLoop() {
  console.log("Starting game loop");
  gameLoopInterval = setInterval(() => {
    // Create a snapshot of the current game state
    const snapshot = createSnapshot();

    // Broadcast the snapshot to all clients
    if (snapshot) {
      broadcastToAll({
        type: "snapshot",
        payload: snapshot,
      });
    }

    tick++;
  }, 1000 / TICK_RATE);
}

// Stop the game loop
function stopGameLoop() {
  console.log("Stopping game loop");
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
  }
}

// Create a snapshot of the current game state
function createSnapshot() {
  // Convert players to an array format expected by the snapshot interpolation library
  const playerArray = [];

  for (const id in players) {
    const player = players[id];
    playerArray.push({
      id,
      x: player.position.x,
      y: player.position.y,
      name: player.name,
      // Add any other properties needed for interpolation
    });
  }

  // Create the snapshot with the array of players
  return playerArray.length > 0 ? SI.snapshot.create(playerArray) : null;
}

// Helper function to broadcast to all connected clients
function broadcastToAll(message: any): void {
  for (const channel of channels.values()) {
    channel.emit("message", message);
  }
}

// Start the server
server.listen(PORT, () => {
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Server running on port ${PORT}`);
  console.log(`WebRTC UDP ports: 10000-10100`);
});
