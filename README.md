# Scuffed MMORPG

A simple monorepo-based MMORPG project with a client game and server, sharing common code.

## Project Structure

This project is set up as a monorepo using npm workspaces and Turborepo:

- `packages/common`: Shared types, interfaces, and utilities
- `packages/game`: The game client built with Phaser
- `packages/server`: The game server built with Express and Geckos.io

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
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

## Deployment to Fly.io

This project is configured for easy deployment to [Fly.io](https://fly.io).

### Prerequisites

1. Install the Fly CLI:

   ```bash
   # macOS
   brew install flyctl

   # Windows
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

   # Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. Sign up and log in:
   ```bash
   fly auth signup
   # or
   fly auth login
   ```

### Deployment Steps

1. Launch the app (first time only):

   ```bash
   fly launch
   ```

   This will use the existing `fly.toml` configuration.

2. For subsequent deployments:

   ```bash
   fly deploy
   ```

3. Open your deployed app:
   ```bash
   fly open
   ```

### Configuration

The deployment configuration is defined in the following files:

- `fly.toml`: Main configuration file for Fly.io
- `Dockerfile`: Defines how the application is built and run
- `.dockerignore`: Specifies files to exclude from the Docker build

### Scaling

To scale your application:

```bash
# Add more instances
fly scale count 2

# Change VM size
fly scale vm shared-cpu-1x
```

### Monitoring

Monitor your application:

```bash
# View logs
fly logs

# Check app status
fly status
```

## License

MIT
