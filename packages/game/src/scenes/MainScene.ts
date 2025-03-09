import { MessageType, Position } from "@scuffed-mmorpg/common";
import * as Phaser from "phaser";
import { io, Socket } from "socket.io-client";

interface OtherPlayerObject {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
}

export class MainScene extends Phaser.Scene {
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null =
    null;
  private otherPlayers: Map<string, OtherPlayerObject> = new Map();
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private playerSpeed = 200;
  private socket: Socket | null = null;
  private playerId: string = "";
  private lastPosition: Position = { x: 0, y: 0 };
  private positionUpdateInterval: number | null = null;
  private connectionStatusElement: HTMLElement | null = null;
  private playerCountElement: HTMLElement | null = null;

  constructor() {
    super({ key: "MainScene" });
  }

  preload(): void {
    // Load assets
    this.load.image("player", "assets/player.png");
    this.load.image("otherPlayer", "assets/other-player.png");
    this.load.image("background", "assets/background.png");
  }

  create(): void {
    // Add background
    this.add.image(400, 300, "background");

    // Create player sprite
    this.player = this.physics.add.sprite(400, 300, "player");
    if (this.player) {
      this.player.setCollideWorldBounds(true);

      // Set up camera to follow player
      this.cameras.main.startFollow(this.player);
    }

    // Create a test other player
    this.addOtherPlayer("test-player-1", 300, 300);

    // Set up keyboard input
    this.cursors = this.input.keyboard.createCursorKeys();

    // Add UI overlay
    this.createUI();

    // Connect to the server
    this.connectToServer();
  }

  update(): void {
    if (!this.player || !this.cursors) return;

    // Handle player movement
    const velocity = new Phaser.Math.Vector2(0, 0);

    if (this.cursors.left.isDown) {
      velocity.x = -this.playerSpeed;
    } else if (this.cursors.right.isDown) {
      velocity.x = this.playerSpeed;
    }

    if (this.cursors.up.isDown) {
      velocity.y = -this.playerSpeed;
    } else if (this.cursors.down.isDown) {
      velocity.y = this.playerSpeed;
    }

    // Normalize and scale the velocity so that player can't move faster diagonally
    if (velocity.x !== 0 || velocity.y !== 0) {
      velocity.normalize().scale(this.playerSpeed);
    }

    this.player.setVelocity(velocity.x, velocity.y);

    // Update current position for sending to server
    if (
      this.player.x !== this.lastPosition.x ||
      this.player.y !== this.lastPosition.y
    ) {
      this.lastPosition = {
        x: this.player.x,
        y: this.player.y,
      };
    }

    // Update other player labels to follow their sprites
    this.otherPlayers.forEach((playerObj) => {
      playerObj.label.setPosition(playerObj.sprite.x, playerObj.sprite.y - 20);
    });

    // Update player count
    if (this.playerCountElement) {
      this.playerCountElement.textContent = `Players: ${this.otherPlayers.size + 1}`;
    }
  }

  private createUI(): void {
    const appElement = document.getElementById("app");
    if (!appElement) return;

    // Create UI container
    const uiContainer = document.createElement("div");
    uiContainer.className = "ui-overlay";
    appElement.appendChild(uiContainer);

    // Add controls info
    const controlsElement = document.createElement("div");
    controlsElement.textContent = "Arrow Keys to move";
    controlsElement.style.marginBottom = "10px";
    uiContainer.appendChild(controlsElement);

    // Add connection status
    this.connectionStatusElement = document.createElement("div");
    this.connectionStatusElement.textContent = "Connecting...";
    this.connectionStatusElement.style.color = "#ffff00";
    this.connectionStatusElement.style.marginBottom = "5px";
    uiContainer.appendChild(this.connectionStatusElement);

    // Add player count
    this.playerCountElement = document.createElement("div");
    this.playerCountElement.textContent = "Players: 1";
    uiContainer.appendChild(this.playerCountElement);
  }

  // Helper method to add other players to the scene
  private addOtherPlayer(id: string, x: number, y: number): void {
    console.log(`Adding other player: ${id} at position (${x}, ${y})`);

    // Create the sprite for the other player
    const sprite = this.add.sprite(x, y, "otherPlayer");

    // Add a text label with the player ID
    const label = this.add
      .text(x, y - 20, id.substring(0, 5), {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#000000",
        padding: { x: 3, y: 3 },
      })
      .setOrigin(0.5, 0.5);

    // Store the sprite and label in our map
    this.otherPlayers.set(id, { sprite, label });
  }

  private connectToServer(): void {
    // Connect to the Socket.IO server
    this.socket = io("http://localhost:3001");

    // Handle connection
    this.socket.on("connect", () => {
      console.log("Connected to server with ID:", this.socket.id);
      this.playerId = this.socket.id;

      // Update connection status
      if (this.connectionStatusElement) {
        this.connectionStatusElement.textContent = "Connected";
        this.connectionStatusElement.style.color = "#00ff00";
      }

      // Set up interval to send position updates to the server
      this.positionUpdateInterval = window.setInterval(() => {
        this.sendPositionUpdate();
      }, 100); // Send position updates every 100ms
    });

    // Handle disconnection
    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");

      // Update connection status
      if (this.connectionStatusElement) {
        this.connectionStatusElement.textContent =
          "Disconnected - Trying to reconnect...";
        this.connectionStatusElement.style.color = "#ff0000";
      }

      if (this.positionUpdateInterval) {
        clearInterval(this.positionUpdateInterval);
        this.positionUpdateInterval = null;
      }
    });

    // Handle connection error
    this.socket.on("connect_error", (error: Error) => {
      console.error("Connection error:", error);

      // Update connection status
      if (this.connectionStatusElement) {
        this.connectionStatusElement.textContent =
          "Connection error - Trying to reconnect...";
        this.connectionStatusElement.style.color = "#ff0000";
      }
    });

    // Handle messages from the server
    this.socket.on("message", (message: any) => {
      this.handleServerMessage(message);
    });
  }

  private sendPositionUpdate(): void {
    if (this.socket && this.player) {
      this.socket.emit("move", this.lastPosition);
    }
  }

  private handleServerMessage(message: any): void {
    if (!message || !message.type) return;

    switch (message.type) {
      case MessageType.PLAYER_JOIN:
        this.handlePlayerJoin(message.payload);
        break;

      case MessageType.PLAYER_LEAVE:
        this.handlePlayerLeave(message.payload);
        break;

      case MessageType.PLAYER_MOVE:
        this.handlePlayerMove(message.payload);
        break;

      case MessageType.GAME_STATE:
        this.handleGameState(message.payload);
        break;

      default:
        console.log("Unknown message type:", message.type);
    }
  }

  private handlePlayerJoin(payload: any): void {
    if (payload.id === this.playerId) return; // Don't add ourselves

    console.log("Player joined:", payload);
    this.addOtherPlayer(payload.id, payload.position.x, payload.position.y);
  }

  private handlePlayerLeave(payload: any): void {
    const { playerId } = payload;
    console.log("Player left:", playerId);

    // Remove the player sprite and label
    const playerObj = this.otherPlayers.get(playerId);
    if (playerObj) {
      playerObj.sprite.destroy();
      playerObj.label.destroy();
      this.otherPlayers.delete(playerId);
    }
  }

  private handlePlayerMove(payload: any): void {
    const { playerId, position } = payload;
    if (playerId === this.playerId) return; // Don't move ourselves

    // Update the player's position
    const playerObj = this.otherPlayers.get(playerId);
    if (playerObj) {
      playerObj.sprite.x = position.x;
      playerObj.sprite.y = position.y;
      // Label position is updated in the update method
    }
  }

  private handleGameState(payload: any): void {
    const { players } = payload;
    console.log("Received game state:", players);

    // Add all existing players
    Object.values(players).forEach((player: any) => {
      if (player.id !== this.playerId && !this.otherPlayers.has(player.id)) {
        this.addOtherPlayer(player.id, player.position.x, player.position.y);
      }
    });
  }
}
