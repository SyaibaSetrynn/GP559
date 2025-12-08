# Cubers #9825 https://jrgustmadtown.github.io/GP559/

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

## Reinforcement Learning Implementation in THREE.js [AUTOMATION CATEGORY]

- **Game State as Data**: Each frame, the AI agent is fed information about the THREE scene (player positions, critical point colors, scores) as a numerical array
- **Neural Network as Function**: TensorFlow.js allows us to use a neural network that maps the state array to action probabilities (move forward, turn left, etc)
- **Reward System**: After each action, we intepret a reward score (positive for claiming points, negative for poor positioning), which trains the network to improve
- **Browser-Based Training**: Training happens in real-time using JavaScript in the same runtime as your Three.js scene—no external servers or Python needed
- **Weight Updates**: The network weights update during gameplay
- **Trial and Error Learning**: The AI agent learns by playing the game repeatedly, gradually improving its strategy
