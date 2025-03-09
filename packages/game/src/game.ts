import * as Phaser from "phaser";
import { MainScene } from "./scenes/MainScene";

export class Game {
  private game: Phaser.Game | null = null;

  constructor() {
    // Game configuration will be set up in the start method
  }

  public start(): void {
    // Create loading UI
    this.createLoadingUI();

    // Configure the game
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: "app",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [MainScene],
      backgroundColor: "#111111",
      render: {
        pixelArt: true,
        antialias: false,
      },
    };

    // Create the game instance
    this.game = new Phaser.Game(config);

    // Remove loading UI when game is created
    this.game.events.once("ready", this.removeLoadingUI);
  }

  private createLoadingUI(): void {
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "loading";
    loadingDiv.id = "loading-screen";

    const loadingText = document.createElement("div");
    loadingText.className = "loading-text";
    loadingText.textContent = "Loading game...";

    loadingDiv.appendChild(loadingText);
    document.body.appendChild(loadingDiv);
  }

  private removeLoadingUI(): void {
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.remove();
    }
  }
}
