import geckos from "@geckos.io/client";
import { SnapshotInterpolation } from "@geckos.io/snapshot-interpolation";
import { MessageType, Position } from "@scuffed-mmorpg/common";
import * as Phaser from "phaser";

interface OtherPlayerObject {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  targetPosition: Position;
  currentPosition: Position;
}

// Define a type for the player state in snapshots
interface PlayerState {
  id: string;
  x: number | string;
  y: number | string;
  name?: string;
  [key: string]: any;
}

export class MainScene extends Phaser.Scene {
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null =
    null;
  private otherPlayers: Map<string, OtherPlayerObject> = new Map();
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private playerSpeed = 200;
  private channel: any = null;
  private playerId: string = "";
  private playerName: string = "";
  private lastPosition: Position = { x: 0, y: 0 };
  private connectionStatusElement: HTMLElement | null = null;
  private playerCountElement: HTMLElement | null = null;
  private usernameInput: HTMLInputElement | null = null;
  private playerInitialized: boolean = false;
  private inputFocused: boolean = false;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 5;

  // Snapshot interpolation
  private SI: SnapshotInterpolation;

  constructor() {
    super({ key: "MainScene" });

    // Initialize snapshot interpolation with 60 FPS
    this.SI = new SnapshotInterpolation(60);
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

    // Set up keyboard input
    this.cursors = this.input.keyboard.createCursorKeys();

    // Add UI overlay
    this.createUI();

    // Connect to the server
    this.connectToServer();

    // Set up a timer to send position updates regularly
    this.time.addEvent({
      // We want it to stay at 50ms to avoid lag
      delay: 50, // 50ms = 20 updates per second
      callback: this.sendPositionUpdate,
      callbackScope: this,
      loop: true,
    });

    // Disable keyboard capture when input is focused
    this.input.keyboard.disableGlobalCapture();

    // Make sure the canvas doesn't capture pointer events over UI elements
    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvas.style.position = "absolute";
      canvas.style.zIndex = "1";
    }
  }

  // Initialize the player after we have a player ID from the server
  private initializePlayer(): void {
    if (this.playerInitialized) return;

    // Create player sprite
    this.player = this.physics.add.sprite(400, 300, "player");
    if (this.player) {
      this.player.setCollideWorldBounds(true);

      // Set up camera to follow player
      this.cameras.main.startFollow(this.player);

      // Set initial position
      this.lastPosition = {
        x: this.player.x,
        y: this.player.y,
      };

      // Set default player name
      this.playerName = `Player ${this.playerId.substring(0, 5)}`;
      if (this.usernameInput) {
        this.usernameInput.value = this.playerName;
      }

      this.playerInitialized = true;
    }
  }

  update(): void {
    if (!this.player || !this.cursors) return;

    // Skip player movement if input is focused
    if (!this.inputFocused) {
      // Reset velocity
      this.player.setVelocity(0);

      // Handle movement with cursor keys
      if (this.cursors.left.isDown) {
        this.player.setVelocityX(-this.playerSpeed);
      } else if (this.cursors.right.isDown) {
        this.player.setVelocityX(this.playerSpeed);
      }

      if (this.cursors.up.isDown) {
        this.player.setVelocityY(-this.playerSpeed);
      } else if (this.cursors.down.isDown) {
        this.player.setVelocityY(this.playerSpeed);
      }

      // Update last position if player has moved
      if (
        this.player.x !== this.lastPosition.x ||
        this.player.y !== this.lastPosition.y
      ) {
        this.lastPosition = {
          x: this.player.x,
          y: this.player.y,
        };
      }
    }

    // Process snapshot interpolation for other players
    this.processSnapshots();

    // Update player count
    if (this.playerCountElement) {
      this.playerCountElement.textContent = `Players: ${this.otherPlayers.size + 1}`;
    }
  }

  // Process snapshots for interpolation
  private processSnapshots(): void {
    // Get the interpolated snapshot
    const snapshot = this.SI.calcInterpolation("x y");

    if (!snapshot) return;

    // Update player positions based on the snapshot
    const state = snapshot.state;

    // Create a map of player IDs to track which players are in the current snapshot
    const currentPlayerIds = new Set<string>();

    // Process each player in the snapshot
    for (let i = 0; i < state.length; i++) {
      const playerState = state[i] as PlayerState;
      const id = playerState.id;

      // Skip our own player - we handle our own movement locally
      if (id === this.playerId) {
        currentPlayerIds.add(id);
        continue;
      }

      // Add this player ID to our tracking set
      currentPlayerIds.add(id);

      // Check if we have this player
      let playerObj = this.otherPlayers.get(id);

      if (!playerObj) {
        // Create a new player if we don't have it
        // Make sure to convert string values to numbers
        const posX = this.ensureNumber(playerState.x);
        const posY = this.ensureNumber(playerState.y);

        if (posX !== null && posY !== null) {
          // Use the player's name from the state if available
          const playerName = playerState.name || `Player ${id.substring(0, 5)}`;
          this.addOtherPlayer(id, posX, posY, playerName);
          playerObj = this.otherPlayers.get(id);
          if (!playerObj) continue;
        } else {
          continue; // Skip this player if we can't get valid coordinates
        }
      } else if (playerState.name && playerObj.label) {
        // Update the player's name if it has changed
        playerObj.label.setText(playerState.name);
      }

      // Update the player's position
      // Make sure to convert string values to numbers
      const posX = this.ensureNumber(playerState.x);
      const posY = this.ensureNumber(playerState.y);

      if (posX !== null && posY !== null) {
        playerObj.sprite.x = posX;
        playerObj.sprite.y = posY;

        // Update the label position
        playerObj.label.setPosition(posX, posY - 20);
      }
    }

    // Remove players that are no longer in the snapshot
    for (const [id, playerObj] of this.otherPlayers.entries()) {
      if (!currentPlayerIds.has(id) && id !== this.playerId) {
        playerObj.sprite.destroy();
        playerObj.label.destroy();
        this.otherPlayers.delete(id);
      }
    }
  }

  // Helper method to ensure a value is a number
  private ensureNumber(value: any): number | null {
    if (typeof value === "number") {
      return value;
    } else if (typeof value === "string") {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  private createUI(): void {
    const appElement = document.getElementById("app");
    if (!appElement) return;

    // Create UI container
    const uiContainer = document.createElement("div");
    uiContainer.className = "ui-overlay";

    // Style the UI container to be above the canvas
    uiContainer.style.position = "absolute";
    uiContainer.style.top = "10px";
    uiContainer.style.left = "10px";
    uiContainer.style.zIndex = "1000";
    uiContainer.style.pointerEvents = "auto";
    uiContainer.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    uiContainer.style.padding = "10px";
    uiContainer.style.borderRadius = "5px";
    uiContainer.style.width = "200px";

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
    this.playerCountElement.style.marginBottom = "10px";
    uiContainer.appendChild(this.playerCountElement);

    // Add username input
    const usernameLabel = document.createElement("label");
    usernameLabel.textContent = "Username: ";
    usernameLabel.style.display = "block";
    usernameLabel.style.marginBottom = "5px";
    uiContainer.appendChild(usernameLabel);

    this.usernameInput = document.createElement("input");
    this.usernameInput.type = "text";
    this.usernameInput.placeholder = "Enter your name";
    this.usernameInput.style.width = "100%";
    this.usernameInput.style.padding = "5px";
    this.usernameInput.style.marginBottom = "10px";
    this.usernameInput.style.boxSizing = "border-box";
    this.usernameInput.style.backgroundColor = "#333";
    this.usernameInput.style.color = "#fff";
    this.usernameInput.style.border = "1px solid #555";
    this.usernameInput.style.borderRadius = "3px";
    this.usernameInput.style.zIndex = "1001";
    this.usernameInput.style.position = "relative";
    this.usernameInput.style.pointerEvents = "auto";

    // Add event listeners for focus and blur
    this.usernameInput.addEventListener("focus", () => {
      this.inputFocused = true;
      // Stop player movement when input is focused
      if (this.player) {
        this.player.setVelocity(0);
      }
    });

    this.usernameInput.addEventListener("blur", () => {
      this.inputFocused = false;
    });

    // Add event listener for name changes
    this.usernameInput.addEventListener(
      "change",
      this.handleNameChange.bind(this)
    );

    // Add event listener for Enter key to blur the input
    this.usernameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.usernameInput?.blur();
      }
    });

    uiContainer.appendChild(this.usernameInput);

    // Add a button to update the name (for mobile users)
    const updateButton = document.createElement("button");
    updateButton.textContent = "Update Name";
    updateButton.style.width = "100%";
    updateButton.style.padding = "5px";
    updateButton.style.backgroundColor = "#4a4a9c";
    updateButton.style.color = "#fff";
    updateButton.style.border = "none";
    updateButton.style.borderRadius = "3px";
    updateButton.style.cursor = "pointer";
    updateButton.style.marginTop = "5px";
    updateButton.style.zIndex = "1001";
    updateButton.style.position = "relative";
    updateButton.style.pointerEvents = "auto";

    updateButton.addEventListener("click", () => {
      if (this.usernameInput) {
        this.handleNameChange({
          target: this.usernameInput,
        } as unknown as Event);
        this.usernameInput.blur();
      }
    });

    uiContainer.appendChild(updateButton);

    // Make sure the UI is clickable
    document.addEventListener("DOMContentLoaded", () => {
      // Ensure the canvas doesn't block UI interactions
      const canvasElements = document.querySelectorAll("canvas");
      canvasElements.forEach((canvas) => {
        canvas.style.position = "absolute";
        canvas.style.zIndex = "1";
      });
    });
  }

  // Handle username changes
  private handleNameChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newName = input.value.trim();

    if (newName && newName !== this.playerName) {
      this.playerName = newName;

      // Send name update to server
      if (this.channel) {
        this.channel.emit("updateName", { name: this.playerName });
      }
    }
  }

  // Helper method to add other players to the scene
  private addOtherPlayer(
    id: string,
    x: number,
    y: number,
    name: string = ""
  ): void {
    // Skip if this is our own player ID or if the player already exists
    if (id === this.playerId || this.otherPlayers.has(id)) {
      return;
    }

    // Create the sprite for the other player
    const sprite = this.add.sprite(x, y, "otherPlayer");

    // Use the provided name or a default based on ID
    const displayName = name || `Player ${id.substring(0, 5)}`;

    // Add a text label with the player name
    const label = this.add
      .text(x, y - 20, displayName, {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#000000",
        padding: { x: 3, y: 3 },
      })
      .setOrigin(0.5, 0.5);

    // Store the sprite and label in our map with initial positions
    const initialPosition = { x, y };
    this.otherPlayers.set(id, {
      sprite,
      label,
      targetPosition: { ...initialPosition },
      currentPosition: { ...initialPosition },
    });
  }

  private connectToServer(): void {
    // Get the server URL based on the current hostname
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const port =
      process.env.NODE_ENV === "production" ? window.location.port : "3001";

    // Connect to the geckos.io server with WebRTC configuration
    this.channel = geckos({
      url: `${protocol}//${host}`,
      port: parseInt(port || "3001"),
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    // Handle connection
    this.channel.onConnect((error: any) => {
      if (error) {
        console.error("Connection error:", error);
        if (this.connectionStatusElement) {
          this.connectionStatusElement.textContent =
            "Connection error - Trying to reconnect...";
          this.connectionStatusElement.style.color = "#ff0000";
        }

        // Retry connection with exponential backoff
        this.connectionAttempts++;
        if (this.connectionAttempts < this.maxConnectionAttempts) {
          const delay = Math.min(
            1000 * Math.pow(2, this.connectionAttempts),
            10000
          );
          console.log(
            `Retrying connection in ${delay}ms (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`
          );
          setTimeout(() => this.connectToServer(), delay);
        }
        return;
      }

      // Reset connection attempts on successful connection
      this.connectionAttempts = 0;

      this.playerId = this.channel?.id || "";

      // Initialize player now that we have an ID
      this.initializePlayer();

      // Update connection status
      if (this.connectionStatusElement) {
        this.connectionStatusElement.textContent = "Connected";
        this.connectionStatusElement.style.color = "#00ff00";
      }
    });

    // Handle disconnection
    this.channel.onDisconnect(() => {
      // Update connection status
      if (this.connectionStatusElement) {
        this.connectionStatusElement.textContent =
          "Disconnected - Trying to reconnect...";
        this.connectionStatusElement.style.color = "#ff0000";
      }

      // Try to reconnect after a delay
      setTimeout(() => {
        if (this.connectionAttempts < this.maxConnectionAttempts) {
          this.connectToServer();
        }
      }, 3000);
    });

    // Handle messages from the server
    this.channel.on("message", (message: any) => {
      if (!message) return;

      if (message.type === "snapshot") {
        // Process snapshot data
        const snapshot = message.payload;
        this.SI.snapshot.add(snapshot);
      } else {
        // Handle other message types
        this.handleServerMessage(message);
      }
    });
  }

  private sendPositionUpdate(): void {
    if (this.channel && this.player && this.playerInitialized) {
      this.channel.emit("move", {
        ...this.lastPosition,
        name: this.playerName,
      });
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

      case MessageType.GAME_STATE:
        this.handleGameState(message.payload);
        break;

      default:
        console.log("Unknown message type:", message.type);
    }
  }

  private handlePlayerJoin(payload: any): void {
    if (payload.id === this.playerId) return; // Don't add ourselves

    this.addOtherPlayer(
      payload.id,
      payload.position.x,
      payload.position.y,
      payload.name
    );
  }

  private handlePlayerLeave(payload: any): void {
    const { playerId } = payload;

    // Remove the player sprite and label
    const playerObj = this.otherPlayers.get(playerId);
    if (playerObj) {
      playerObj.sprite.destroy();
      playerObj.label.destroy();
      this.otherPlayers.delete(playerId);
    }
  }

  private handleGameState(payload: any): void {
    const { players } = payload;

    // Add all existing players
    Object.values(players).forEach((player: any) => {
      if (player.id !== this.playerId && !this.otherPlayers.has(player.id)) {
        this.addOtherPlayer(
          player.id,
          player.position.x,
          player.position.y,
          player.name
        );
      }
    });
  }
}
