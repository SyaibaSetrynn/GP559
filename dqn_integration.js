/**
 * DQN Training Integration for Critical Point Capture Game
 * This file shows how to integrate the DQN training system with your existing game
 */

class DQNGameBridge {
    constructor(gameManager) {
        this.gameManager = gameManager;
        this.trainingManager = null;
        this.isTrainingActive = false;
        
        // Training controls
        this.trainingControls = this.createTrainingControls();
        
        // Connect to your existing game state
        this.setupGameStateInterface();
    }

    createTrainingControls() {
        // Create a simple UI for controlling DQN training
        const controlsDiv = document.createElement('div');
        controlsDiv.id = 'dqn-controls';
        controlsDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 1000;
            font-family: Arial, sans-serif;
            min-width: 200px;
        `;
        
        controlsDiv.innerHTML = `
            <h3>DQN Training</h3>
            <button id="start-training">Start Training</button>
            <button id="stop-training" disabled>Stop Training</button>
            <button id="save-models">Save Models</button>
            <button id="load-models">Load Models</button>
            <div id="training-status">Ready</div>
            <div id="training-metrics"></div>
        `;
        
        document.body.appendChild(controlsDiv);
        
        // Add event listeners
        document.getElementById('start-training').addEventListener('click', () => this.startTraining());
        document.getElementById('stop-training').addEventListener('click', () => this.stopTraining());
        document.getElementById('save-models').addEventListener('click', () => this.saveModels());
        document.getElementById('load-models').addEventListener('click', () => this.loadModels());
        
        return controlsDiv;
    }

    setupGameStateInterface() {
        // This method should be customized to work with your specific game architecture
        // Here's an example of how you might extend your GameManager
        
        if (this.gameManager) {
            // Add method to get current game state for DQN
            this.gameManager.getGameState = () => {
                return {
                    agent_position: this.getAgentPosition(0), // Get position of agent 0
                    critical_points: this.getCriticalPointsState(),
                    agent_owned_points: this.getAgentOwnedPoints(),
                    time_remaining: this.getRemainingTime(),
                    navigation_grid: this.getNavigationGrid(),
                    nearest_unclaimed_distance: this.getNearestUnclaimedDistance(0),
                    nearest_enemy_distance: this.getNearestEnemyDistance(0),
                    map_size: 10 // Your map size
                };
            };
            
            // Add method to execute agent actions
            this.gameManager.executeAgentAction = (agentId, action) => {
                this.executeAction(agentId, action);
            };
            
            // Add method to reset episode
            this.gameManager.resetEpisode = () => {
                this.resetGameForTraining();
            };
        }
    }

    // These methods should be implemented to interface with your specific game
    getAgentPosition(agentId) {
        // Return the position of the specified agent
        // Example: return [x, y, z]
        if (this.gameManager.agents && this.gameManager.agents[agentId]) {
            const agent = this.gameManager.agents[agentId];
            return [agent.position.x, agent.position.y, agent.position.z];
        }
        return [0, 1, 0]; // Default position
    }

    getCriticalPointsState() {
        // Return array of critical point states
        // Example format for each critical point:
        // { position: [x, y, z], color: agentId or null, available: boolean }
        
        if (this.gameManager.criticalPoints) {
            return this.gameManager.criticalPoints.map(cp => ({
                position: [cp.position.x, cp.position.y, cp.position.z],
                color: cp.controllingAgent, // null if unclaimed
                available: cp.isAvailable
            }));
        }
        return [];
    }

    getAgentOwnedPoints() {
        // Return object with agent IDs as keys and number of owned points as values
        // Example: { 0: 2, 1: 3, 2: 1 }
        const owned = {};
        if (this.gameManager.agents) {
            this.gameManager.agents.forEach((agent, id) => {
                owned[id] = agent.ownedPoints || 0;
            });
        }
        return owned;
    }

    getRemainingTime() {
        // Return remaining time as a value between 0 and 1
        if (this.gameManager.gameTimer) {
            return this.gameManager.gameTimer.remaining / this.gameManager.gameTimer.total;
        }
        return 1.0;
    }

    getNavigationGrid() {
        // Return a flattened grid representing walls/obstacles around the agent
        // This should be a 15x15 grid with 1 for walls, 0 for free space
        return new Array(15 * 15).fill(0); // Default: no walls
    }

    getNearestUnclaimedDistance(agentId) {
        // Return normalized distance to nearest unclaimed critical point
        const agentPos = this.getAgentPosition(agentId);
        const criticalPoints = this.getCriticalPointsState();
        const unclaimedPoints = criticalPoints.filter(cp => cp.color === null);
        
        if (unclaimedPoints.length === 0) return 1.0;
        
        const distances = unclaimedPoints.map(cp => 
            Math.sqrt(
                (agentPos[0] - cp.position[0]) ** 2 + 
                (agentPos[1] - cp.position[1]) ** 2 + 
                (agentPos[2] - cp.position[2]) ** 2
            )
        );
        
        return Math.min(...distances) / 10.0; // Normalize by map size
    }

    getNearestEnemyDistance(agentId) {
        // Return normalized distance to nearest enemy-controlled critical point
        const agentPos = this.getAgentPosition(agentId);
        const criticalPoints = this.getCriticalPointsState();
        const enemyPoints = criticalPoints.filter(cp => cp.color !== null && cp.color !== agentId);
        
        if (enemyPoints.length === 0) return 1.0;
        
        const distances = enemyPoints.map(cp => 
            Math.sqrt(
                (agentPos[0] - cp.position[0]) ** 2 + 
                (agentPos[1] - cp.position[1]) ** 2 + 
                (agentPos[2] - cp.position[2]) ** 2
            )
        );
        
        return Math.min(...distances) / 10.0; // Normalize by map size
    }

    executeAction(agentId, action) {
        // Execute the specified action for the agent
        // Map DQN actions to your game's movement system
        
        if (!this.gameManager.agents || !this.gameManager.agents[agentId]) return;
        
        const agent = this.gameManager.agents[agentId];
        const moveSpeed = 0.1; // Adjust based on your game
        
        switch (action) {
            case 'strafe_left':
                // Move agent left relative to current orientation
                agent.position.x -= moveSpeed;
                break;
            case 'strafe_right':
                // Move agent right relative to current orientation
                agent.position.x += moveSpeed;
                break;
            case 'move_forward':
                // Move agent forward relative to current orientation
                agent.position.z -= moveSpeed;
                break;
            case 'move_backward':
                // Move agent backward relative to current orientation
                agent.position.z += moveSpeed;
                break;
            case 'stay':
                // Agent doesn't move
                break;
        }
        
        // Update agent in your game system
        if (this.gameManager.updateAgent) {
            this.gameManager.updateAgent(agentId);
        }
    }

    resetGameForTraining() {
        // Reset the game state for a new training episode
        if (this.gameManager.resetGame) {
            this.gameManager.resetGame();
        }
        
        // Set agent positions to starting locations
        const startPositions = [
            [3.5, 1, 3.5],   // Agent 1: top-right
            [-3.5, 1, 3.5],  // Agent 2: top-left  
            [3.5, 1, -3.5]   // Agent 3: bottom-right
        ];
        
        if (this.gameManager.agents) {
            this.gameManager.agents.forEach((agent, id) => {
                if (startPositions[id]) {
                    agent.position.x = startPositions[id][0];
                    agent.position.y = startPositions[id][1];
                    agent.position.z = startPositions[id][2];
                }
            });
        }
    }

    async startTraining() {
        if (this.isTrainingActive) return;
        
        this.updateStatus('Initializing training...');
        
        try {
            // Initialize training manager if not already done
            if (!this.trainingManager) {
                this.trainingManager = new TrainingManager(this.gameManager, {
                    numAgents: 3,
                    savePrefix: 'game_dqn_agent'
                });
            }
            
            this.isTrainingActive = true;
            document.getElementById('start-training').disabled = true;
            document.getElementById('stop-training').disabled = false;
            
            this.updateStatus('Training in progress...');
            
            // Start training
            await this.trainingManager.train({
                numEpisodes: 2000,
                saveInterval: 200,
                evalInterval: 100
            });
            
        } catch (error) {
            console.error('Training error:', error);
            this.updateStatus(`Error: ${error.message}`);
        } finally {
            this.stopTraining();
        }
    }

    stopTraining() {
        if (this.trainingManager) {
            this.trainingManager.stopTraining();
        }
        
        this.isTrainingActive = false;
        document.getElementById('start-training').disabled = false;
        document.getElementById('stop-training').disabled = true;
        
        this.updateStatus('Training stopped');
    }

    async saveModels() {
        if (this.trainingManager) {
            await this.trainingManager.saveModels('manual_save');
            this.updateStatus('Models saved');
        }
    }

    async loadModels() {
        if (this.trainingManager) {
            // This would need to be implemented to load specific saved models
            this.updateStatus('Load functionality needs to be implemented');
        }
    }

    updateStatus(message) {
        const statusElement = document.getElementById('training-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
        console.log('DQN Status:', message);
    }

    updateMetrics(metrics) {
        const metricsElement = document.getElementById('training-metrics');
        if (metricsElement && metrics) {
            metricsElement.innerHTML = `
                <div>Episode: ${metrics.episode || 0}</div>
                <div>Avg Reward: ${metrics.avgReward ? metrics.avgReward.toFixed(2) : 'N/A'}</div>
                <div>Epsilon: ${metrics.epsilon ? metrics.epsilon.toFixed(3) : 'N/A'}</div>
            `;
        }
    }

    dispose() {
        if (this.trainingManager) {
            this.trainingManager.dispose();
        }
        
        if (this.trainingControls && this.trainingControls.parentNode) {
            this.trainingControls.parentNode.removeChild(this.trainingControls);
        }
    }
}

// Usage example - add this to your main game initialization:
/*
// After your GameManager is initialized:
const dqnBridge = new DQNGameBridge(gameManager);

// The DQN training controls will appear in the top-right corner
// Click "Start Training" to begin DQN training with your game
*/

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DQNGameBridge };
}
