import { MessageType, Player, createMessage } from "@scuffed-mmorpg/common";
import * as Phaser from "phaser";

// Example of using the common package
const player: Player = {
  id: "player1",
  name: "Player 1",
  position: { x: 0, y: 0 },
  health: 100,
};

// Example message
const moveMessage = createMessage(MessageType.PLAYER_MOVE, {
  playerId: player.id,
  position: player.position,
});

console.log("Player:", player);
console.log("Message:", moveMessage);

// Basic Phaser game setup
class SimpleGame {
  game: Phaser.Game;

  constructor() {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 300 },
          debug: false,
        },
      },
      scene: {
        preload: this.preload,
        create: this.create,
      },
    };

    this.game = new Phaser.Game(config);
  }

  preload() {
    // Preload assets
  }

  create() {
    // Create game objects
    console.log("Game created!");
  }
}

// Start the game when the DOM is loaded
window.onload = () => {
  new SimpleGame();
};
