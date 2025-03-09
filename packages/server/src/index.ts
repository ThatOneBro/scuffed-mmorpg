import { MessageType, Player, Position, createMessage } from '@scuffed-mmorpg/common';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Store connected players
const players: Record<string, Player> = {};

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create a new player
  const player: Player = {
    id: socket.id,
    name: `Player ${socket.id.substring(0, 5)}`,
    position: { x: Math.floor(Math.random() * 800), y: Math.floor(Math.random() * 600) },
    health: 100
  };

  // Add player to the list
  players[socket.id] = player;

  // Send player joined message to all clients
  io.emit('message', createMessage(MessageType.PLAYER_JOIN, player));

  // Send current game state to the new player
  socket.emit('message', createMessage(MessageType.GAME_STATE, { players }));

  // Handle player movement
  socket.on('move', (position: Position) => {
    if (players[socket.id]) {
      players[socket.id].position = position;
      
      // Broadcast player movement to all other clients
      socket.broadcast.emit('message', createMessage(MessageType.PLAYER_MOVE, {
        playerId: socket.id,
        position
      }));
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    // Remove player from the list
    delete players[socket.id];
    
    // Broadcast player left message to all clients
    io.emit('message', createMessage(MessageType.PLAYER_LEAVE, { playerId: socket.id }));
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 