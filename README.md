# Scuffed MMORPG

A simple monorepo-based MMORPG project with a client game and server, sharing common code.

## Project Structure

This project is set up as a monorepo using npm workspaces and Turborepo:

- `packages/common`: Shared types, interfaces, and utilities
- `packages/game`: The game client built with Phaser
- `packages/server`: The game server built with Express and Socket.IO

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v10 or higher)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Development

To run all packages in development mode:

```bash
npm run dev
```

To run a specific package:

```bash
# For the game client
npm run dev --workspace=@scuffed-mmorpg/game

# For the server
npm run dev --workspace=@scuffed-mmorpg/server
```

### Building

To build all packages:

```bash
npm run build
```

To build a specific package:

```bash
# For the common package
npm run build --workspace=@scuffed-mmorpg/common

# For the game client
npm run build --workspace=@scuffed-mmorpg/game

# For the server
npm run build --workspace=@scuffed-mmorpg/server
```

## License

MIT 