import geckos, { Data, GeckosServer, ServerChannel } from "@geckos.io/server";
import {
  MessageType,
  Player,
  Position,
  createMessage,
} from "@scuffed-mmorpg/common";
import express from "express";
import http from "http";

const app = express();
const server = http.createServer(app);

// Create a geckos.io server
const io: GeckosServer = geckos();

// Attach to the http server
io.addServer(server);

const PORT = process.env.PORT || 3001;

// Store connected players
const players: Record<string, Player> = {};

// Store all channels for direct access
const channels: Map<string, ServerChannel> = new Map();

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

  // Handle player movement
  channel.on("move", (data: Data) => {
    // Validate and convert the data to Position
    if (!data || typeof data !== "object") return;

    const position = data as Position;
    if (typeof position.x !== "number" || typeof position.y !== "number")
      return;

    if (players[playerId]) {
      players[playerId].position = position;

      // Create the message to broadcast
      const message = createMessage(MessageType.PLAYER_MOVE, {
        playerId,
        position,
      });

      // Broadcast to all except the sender
      broadcastToAllExcept(message, playerId);
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
  });
});

// Helper function to broadcast to all connected clients
function broadcastToAll(message: any): void {
  for (const channel of channels.values()) {
    channel.emit("message", message);
  }
}

// Helper function to broadcast to all except one client
function broadcastToAllExcept(message: any, excludeId: string): void {
  for (const [id, channel] of channels.entries()) {
    if (id !== excludeId) {
      channel.emit("message", message);
    }
  }
}

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
