# Cubers #9825

A 3D multiplayer territory control game built with Three.js, featuring AI agents powered by Deep Q-Network (DQN) reinforcement learning.

## Overview

In the year 9825, players spawn in a cube world where everyone is an emissive cube! Compete to occupy the world by claiming critical points on walls with your laser. The player with the most occupied critical points after 35 seconds wins.

## Features

- **3D Graphics Engine**: Built with Three.js
- **AI Agents**: DQN-powered AI opponents with reinforcement learning
- **Territory Control**: Claim critical points by hitting them with your laser
- **Multiple Themes**: Various visual themes including Eyes, Glass, Hedge, Lab, and Library
- **Physics System**: Collision detection using Octree and Capsule colliders
- **Dynamic Lighting**: Advanced lighting system with spotlights and lasers

## Game Mechanics

### Controls
- **WASD**: Move around the world
- **Mouse**: Look around
- **Left Click**: Emit laser to claim critical points
- **ESC**: Release mouse lock

### Gameplay
1. Players spawn as colored emissive cubes
2. Use your laser to hit critical points on walls
3. Successfully hit critical points turn to YOUR color
4. The counter in the top right shows everyone's scores
5. After 35 seconds, the player with the most critical points wins

## Technology Stack

### Core Technologies
- **Three.js** (v0.161.0+): 3D graphics rendering
- **JavaScript ES6 Modules**: Modern modular architecture
- **HTML5 Canvas**: Rendering surface

### AI/ML Components
- **Deep Q-Network (DQN)**: Reinforcement learning for AI agents
- **Experience Replay**: Memory buffer for training stability
- **Neural Network**: TensorFlow.js-based network architecture
- **Reward System**: Custom reward calculation for game-specific behaviors

## Project Structure

```
.
├── index.html              # Main game entry point
├── indexdqn.html          # DQN testing interface
├── style.css              # Game styling
├── Player.js              # Player controller and physics
├── Agent.js               # AI agent implementation
├── AgentManager.js        # Manages multiple AI agents
├── GameManager.js         # Core game mechanics
├── StateManager.js        # Game state management
├── UI.js                  # User interface components
├── MapGenerator.js        # Procedural map generation
├── MapTextures.js         # Texture management
├── MapLighting.js         # Lighting system
├── LevelSelection3D.js    # Level selection menu
├── LevelContent3D.js      # Level content management
├── critical-point-system.js # Critical point mechanics
├── game-state.js          # Game state tracking
├── game-state-extractor.js # State extraction for AI
├── dqn/                   # DQN AI system
│   ├── dqn-network.js     # Neural network architecture
│   ├── dqn-trainer.js     # Training orchestrator
│   ├── dqn-integration.js # Game integration
│   ├── experience-replay.js # Memory replay system
│   ├── reward-system.js   # Reward calculation
│   ├── action-space.js    # Action definitions
│   └── pretraining-system.js # Pre-training utilities
├── Objects/               # 3D models (.obj, .mtl)
└── Textures/             # Game textures and skyboxes
    ├── Eyes/
    ├── Glass/
    ├── Hedge/
    ├── Lab/
    └── Library/
```

## Installation & Setup

### Prerequisites
- Modern web browser with WebGL support (Chrome, Firefox, Edge, Safari)
- Local web server (Python, Node.js, or similar)

### Running the Game

1. **Clone or download** this repository

2. **Start a local web server** in the project directory:

   Using Python 3:
   ```bash
   python -m http.server 8000
   ```

   Using Python 2:
   ```bash
   python -m SimpleHTTPServer 8000
   ```

   Using Node.js (with http-server):
   ```bash
   npx http-server -p 8000
   ```

3. **Open your browser** and navigate to:
   ```
   http://localhost:8000/index.html
   ```

4. **For DQN training/testing**, navigate to:
   ```
   http://localhost:8000/indexdqn.html
   ```

> **Note**: The game requires a web server due to CORS restrictions with ES6 modules. Simply opening `index.html` in a browser will not work.

## AI System (DQN)

The game features an advanced Deep Q-Network reinforcement learning system for AI agents.

### DQN Features
- **State Representation**: Game state extraction including player positions, critical points, and environmental data
- **Action Space**: Discrete actions for movement and point claiming
- **Reward System**: Custom rewards for claiming points, strategic positioning, and survival
- **Experience Replay**: Stabilizes training by replaying past experiences
- **Target Network**: Reduces correlation in Q-value updates
- **Epsilon-Greedy Exploration**: Balances exploration vs exploitation

### Training Configuration
- **State Size**: 10 dimensions
- **Action Size**: 4 discrete actions
- **Network Architecture**: Configurable hidden layers [64, 32]
- **Learning Rate**: 0.001
- **Batch Size**: 32
- **Gamma (Discount Factor)**: 0.99
- **Epsilon Decay**: 0.995

## Development

### Key Classes

#### Player.js
- Handles player movement and collision detection
- Manages first-person camera controls
- Implements laser shooting mechanics
- Uses Capsule collider for physics

#### Agent.js
- AI agent behavior and decision-making
- Integrates with DQN system
- Pathfinding and target selection

#### GameManager.js
- Core game loop and mechanics
- Time management and game state
- Player and terrain management

#### MapGenerator.js
- Procedural map generation
- Critical point placement
- Terrain mesh creation


