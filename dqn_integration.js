/**
 * DQN Training Integration for Critical Point Capture Game
 * This file shows how to integrate the DQN training system with your existing game
 */

class DQNGameBridge {
    constructor(gameManager) {
        this.gameManager = gameManager;
        this.agents = null; // Will hold trained DQN agents
        this.processor = new GameStateProcessor(50, 15); // maxCriticalPoints=50, gridSize=15
        this.isEpisodeRunning = false;
        this.autoEpisodes = false;
        
        // Action mapping (same as DQN training)
        this.actionNames = {
            0: "strafe_left",
            1: "strafe_right", 
            2: "move_forward",
            3: "move_backward",
            4: "stay"
        };
        
        // Connect event listeners to existing buttons
        this.attachEventListeners();
        
        // Connect to your existing game state
        this.setupGameStateInterface();
        
        console.log('DQNGameBridge initialized with gameManager:', gameManager);
    }

    attachEventListeners() {
        // Wait for DOM to be ready and attach to existing buttons
        const attachListeners = () => {
            const loadBtn = document.getElementById('load-weights');
            const startBtn = document.getElementById('start-episode');
            const resetBtn = document.getElementById('reset-episode');
            
            if (loadBtn && startBtn && resetBtn) {
                loadBtn.addEventListener('click', () => {
                    console.log('Load weights button clicked');
                    this.loadTrainedWeights();
                });
                startBtn.addEventListener('click', () => {
                    console.log('Start episode button clicked');
                    this.startEpisode();
                });
                resetBtn.addEventListener('click', () => {
                    console.log('Reset episode button clicked');
                    this.resetEpisode();
                });
                
                console.log('DQN button event listeners attached successfully');
            } else {
                console.log('DQN buttons not found, retrying in 500ms...');
                setTimeout(attachListeners, 500);
            }
        };
        
        // Try immediately or wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attachListeners);
        } else {
            attachListeners();
        }
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

    // Interface with your AgentManager
    getAgentPosition(agentId) {
        // Return the position of the specified agent as an array [x, y, z]
        if (this.gameManager && this.gameManager.agents && this.gameManager.agents[agentId]) {
            const agent = this.gameManager.agents[agentId];
            const pos = agent.getPosition ? agent.getPosition() : agent.position;
            if (pos) {
                // Ensure we return an array, not a Vector3 object
                return [
                    typeof pos.x === 'number' ? pos.x : 0,
                    typeof pos.y === 'number' ? pos.y : 1, 
                    typeof pos.z === 'number' ? pos.z : 0
                ];
            }
        }
        return [0, 1, 0]; // Default position
    }

    getCriticalPointsState() {
        // Return array of critical point states using your critical point system
        const criticalPoints = [];
        
        console.log('=== getCriticalPointsState Debug ===');
        console.log('globalCPSystem:', window.globalCPSystem);
        
        if (window.globalCPSystem && window.globalCPSystem.criticalPoints) {
            console.log('Critical points array:', window.globalCPSystem.criticalPoints);
            console.log('Number of critical points:', window.globalCPSystem.criticalPoints.length);
            
            // Limit to maximum 50 critical points to match the expected state dimension
            const maxCPs = 50;
            const numCPs = Math.min(window.globalCPSystem.criticalPoints.length, maxCPs);
            console.log('Processing only first', numCPs, 'critical points');
            
            for (let i = 0; i < numCPs; i++) {
                const cp = window.globalCPSystem.criticalPoints[i];
                console.log(`CP ${i}:`, cp);
                console.log(`CP ${i} position:`, cp.position);
                console.log(`CP ${i} position type:`, typeof cp.position);
                
                if (cp.position) {
                    // Try different ways to access position
                    let posArray;
                    if (cp.position.x !== undefined && cp.position.y !== undefined && cp.position.z !== undefined) {
                        posArray = [cp.position.x, cp.position.y, cp.position.z];
                    } else if (Array.isArray(cp.position) && cp.position.length >= 3) {
                        posArray = [cp.position[0], cp.position[1], cp.position[2]];
                    } else {
                        console.error(`Unable to extract position from CP ${i}:`, cp.position);
                        posArray = [0, 1, 0]; // Default position
                    }
                    
                    criticalPoints.push({
                        position: posArray,
                        color: cp.currentAgent || null, // null if unclaimed
                        available: cp.isAvailable !== false // Default to available
                    });
                } else {
                    console.error(`CP ${i} has no position:`, cp);
                    criticalPoints.push({
                        position: [0, 1, 0],
                        color: null,
                        available: true
                    });
                }
            }
        } else {
            console.log('No globalCPSystem or criticalPoints found');
        }
        
        console.log('Returning critical points:', criticalPoints);
        return criticalPoints;
    }

    getAgentOwnedPoints() {
        // Return object with agent IDs as keys and number of owned points as values
        const owned = {};
        
        if (this.gameManager && this.gameManager.getScores) {
            const scores = this.gameManager.getScores();
            scores.forEach(scoreData => {
                owned[scoreData.agentId] = scoreData.score || 0;
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
        console.log(`=== Executing action ${action} for agent ${agentId} ===`);
        
        // Execute the specified action for the agent using your Agent system
        if (!this.gameManager || !this.gameManager.agents || !this.gameManager.agents[agentId]) {
            console.warn(`Agent ${agentId} not found - gameManager:`, this.gameManager);
            return;
        }
        
        const agent = this.gameManager.agents[agentId];
        console.log(`Agent ${agentId} object:`, agent);
        const moveSpeed = 0.05; // Adjust based on your game
        
        // Get current position
        const currentPos = agent.getPosition ? agent.getPosition() : agent.position;
        console.log(`Current position for agent ${agentId}:`, currentPos);
        
        if (!currentPos) {
            console.error(`No position found for agent ${agentId}`);
            return;
        }
        
        if (typeof currentPos.x === 'undefined' || typeof currentPos.z === 'undefined') {
            console.error(`Position properties undefined for agent ${agentId}:`, currentPos);
            return;
        }
        
        let newX = currentPos.x;
        let newZ = currentPos.z;
        
        switch (action) {
            case 'strafe_left':
                newX -= moveSpeed;
                break;
            case 'strafe_right':
                newX += moveSpeed;
                break;
            case 'move_forward':
                newZ -= moveSpeed;
                break;
            case 'move_backward':
                newZ += moveSpeed;
                break;
            case 'stay':
                // Agent doesn't move
                return;
        }
        
        // Set new position using agent's method
        if (agent.setPosition) {
            agent.setPosition(new THREE.Vector3(newX, currentPos.y, newZ));
        } else if (agent.position) {
            agent.position.set(newX, currentPos.y, newZ);
        }
    }

    resetGameForTraining() {
        // Disable agent AI and physics so DQN has full control
        if (this.gameManager && this.gameManager.agents) {
            for (let i = 0; i < this.gameManager.agents.length; i++) {
                const agent = this.gameManager.agents[i];
                if (agent) {
                    agent.isMovingToTarget = false; // Disable AI movement
                    agent.currentTargetCP = null;   // Clear any target
                    agent.dqnControlled = true;     // Flag for DQN control
                    agent.speedY = 0;               // Stop any vertical momentum
                    console.log(`Disabled AI and physics for agent ${i}`);
                }
            }
        }
        
        // Reset agent positions to starting locations
        const startPositions = [
            [3.5, 1, 3.5],   // Agent 0: top-right
            [-3.5, 1, 3.5],  // Agent 1: top-left  
            [3.5, 1, -3.5]   // Agent 2: bottom-right
        ];
        
        if (this.gameManager && this.gameManager.agents) {
            this.gameManager.agents.forEach((agent, id) => {
                if (startPositions[id] && agent.setPosition) {
                    agent.setPosition(new THREE.Vector3(
                        startPositions[id][0], 
                        startPositions[id][1], 
                        startPositions[id][2]
                    ));
                }
            });
        }
        
        // Reset critical point system if available
        if (window.globalCPSystem && window.globalCPSystem.resetAllPoints) {
            window.globalCPSystem.resetAllPoints();
        }
    }

    async startEpisode() {
        if (!this.agents || this.agents.length === 0) {
            this.updateStatus('No trained agents loaded. Load models first.');
            return;
        }
        
        if (this.isEpisodeRunning) {
            this.updateStatus('Episode already running');
            return;
        }
        
        console.log('Starting DQN episode...');
        this.isEpisodeRunning = true;
        document.getElementById('start-episode').disabled = true;
        
        try {
            // Reset game state
            this.resetGameForTraining();
            this.updateStatus('Episode running...');
            
            // Run episode with trained agents
            await this.runInferenceEpisode();
            
        } catch (error) {
            console.error('Episode error:', error);
            this.updateStatus(`Episode error: ${error.message}`);
        } finally {
            this.isEpisodeRunning = false;
            document.getElementById('start-episode').disabled = false;
        }
    }

    async runInferenceEpisode() {
        const maxSteps = 1000;
        let step = 0;
        
        while (step < maxSteps && this.isEpisodeRunning) {
            // Get current game state for each agent
            const gameState = this.getCurrentGameState();
            
            // Each agent selects action using trained policy (no exploration)
            for (let agentId = 0; agentId < this.agents.length; agentId++) {
                let stateData = null;
                try {
                    console.log(`=== Processing Agent ${agentId} ===`);
                    
                    const agentPosition = this.getAgentPosition(agentId);
                    console.log(`Agent ${agentId} position:`, agentPosition, typeof agentPosition);
                    
                    console.log(`GameManager:`, this.gameManager);
                    console.log(`GameManager agents:`, this.gameManager?.agents);
                    console.log(`Agent ${agentId} object:`, this.gameManager?.agents?.[agentId]);
                    
                    stateData = {
                        ...gameState,
                        agent_position: agentPosition
                    };
                    console.log(`State data for agent ${agentId}:`, stateData);
                    
                    console.log(`About to process state...`);
                    const state = this.processor.processState(stateData);
                    console.log(`State processed successfully for agent ${agentId}`);
                    console.log(`State length: ${state.length}, Expected: 581`);
                    
                    // EMERGENCY FIX: If state is wrong length, truncate or pad it
                    if (state.length !== 581) {
                        console.error(`FIXING STATE DIMENSION: ${state.length} -> 581`);
                        if (state.length > 581) {
                            state.splice(581); // Truncate to 581
                        } else {
                            while (state.length < 581) {
                                state.push(0.0); // Pad with zeros
                            }
                        }
                        console.log(`Fixed state length: ${state.length}`);
                    }
                    
                    // Use trained agent to select action (training=false for no exploration)
                    console.log(`About to select action...`);
                    const action = this.agents[agentId].selectAction(state, false);
                    console.log(`Action selected: ${action} (${this.actionNames[action]})`);
                    
                    // Execute the action
                    console.log(`About to execute action...`);
                    this.executeAction(agentId, this.actionNames[action]);
                    console.log(`Action executed for agent ${agentId}`);
                    
                } catch (error) {
                    console.error(`=== ERROR in Agent ${agentId} ===`);
                    console.error(`Error:`, error);
                    console.error(`Error stack:`, error.stack);
                    console.log(`Agent ${agentId} state data:`, stateData);
                    throw error; // Re-throw to see the full stack trace
                }
            }
            
            // Update metrics
            this.updateEpisodeMetrics(step, gameState);
            
            // Small delay to make it visible
            await new Promise(resolve => setTimeout(resolve, 100));
            step++;
        }
        
        // Re-enable agent AI and physics after episode
        if (this.gameManager && this.gameManager.agents) {
            for (let i = 0; i < this.gameManager.agents.length; i++) {
                const agent = this.gameManager.agents[i];
                if (agent) {
                    agent.isMovingToTarget = true; // Re-enable AI movement
                    agent.dqnControlled = false;   // Remove DQN control flag
                    console.log(`Re-enabled AI and physics for agent ${i}`);
                }
            }
        }
        
        this.updateStatus(`Episode completed after ${step} steps`);
    }

    resetEpisode() {
        console.log('Resetting episode...');
        this.isEpisodeRunning = false;
        this.resetGameForTraining();
        this.updateStatus(this.agents ? 'Episode reset - ready to start' : 'No weights loaded');
        document.getElementById('start-episode').disabled = false;
    }

    toggleAutoEpisodes() {
        this.autoEpisodes = !this.autoEpisodes;
        const button = document.getElementById('toggle-auto');
        button.textContent = `Auto Episodes: ${this.autoEpisodes ? 'ON' : 'OFF'}`;
        
        if (this.autoEpisodes) {
            this.runAutoEpisodes();
        }
    }

    async runAutoEpisodes() {
        while (this.autoEpisodes) {
            if (!this.isEpisodeRunning && this.agents) {
                await this.startEpisode();
                // Wait a bit before starting next episode
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async initializeAgents() {
        this.updateStatus('Initializing DQN agents...');
        
        try {
            // Check if TensorFlow is available
            if (typeof tf === 'undefined') {
                throw new Error('TensorFlow.js not loaded');
            }
            
            const stateDim = this.processor.computeStateDim();
            console.log('Creating agents with state dimension:', stateDim);
            
            // Create 3 agents for inference (no training)
            this.agents = [];
            for (let i = 0; i < 3; i++) {
                const agent = new DQNAgent({ 
                    stateDim: stateDim,
                    actionDim: 5,
                    epsilonStart: 0.0, // No exploration for inference
                    epsilonEnd: 0.0
                });
                this.agents.push(agent);
            }
            
            this.updateStatus('DQN agents initialized successfully');
            
            // Enable episode controls
            document.getElementById('start-episode').disabled = false;
            document.getElementById('reset-episode').disabled = false;
            document.getElementById('toggle-auto').disabled = false;
            
            console.log('DQN agents ready for inference');
            
        } catch (error) {
            console.error('Failed to initialize agents:', error);
            this.updateStatus(`Failed to initialize agents: ${error.message}`);
        }
    }

    async loadTrainedWeights() {
        console.log('=== LOAD WEIGHTS FUNCTION CALLED ===');
        this.updateStatus('Loading trained weights...');
        
        try {
            // Check if TensorFlow is available
            console.log('Checking TensorFlow availability:', typeof tf);
            if (typeof tf === 'undefined') {
                throw new Error('TensorFlow.js not loaded');
            }
            
            // Get the pasted weights text
            const weightsInput = document.getElementById('weights-input');
            console.log('Weights input element:', weightsInput);
            const weightsText = weightsInput.value.trim();
            console.log('Weights text length:', weightsText.length);
            console.log('Weights text preview:', weightsText.substring(0, 100));
            
            if (!weightsText) {
                console.log('No weights text found');
                this.updateStatus('Please paste the WEIGHT_X= lines from training console');
                return;
            }
            
            // Parse weights from text
            const parsedWeights = this.parseWeightsFromText(weightsText);
            
            if (parsedWeights.weightLayers.length === 0) {
                this.updateStatus('No valid weight layers found in input');
                return;
            }
            
            const stateDim = this.processor.computeStateDim();
            console.log('Creating agents with state dimension:', stateDim);
            
            // Create 3 agents with the same trained weights
            this.agents = [];
            for (let i = 0; i < 3; i++) {
                const agent = new DQNAgent({ 
                    stateDim: stateDim,
                    actionDim: 5,
                    epsilonStart: 0.0, // No exploration for inference
                    epsilonEnd: 0.0
                });
                
                // Convert weight data back to tensors
                const weightTensors = parsedWeights.weightLayers.map(weightData => {
                    return tf.tensor(weightData.values, weightData.shape);
                });
                
                // Set the weights in the Q-network
                agent.qNetwork.model.setWeights(weightTensors);
                
                // Set agent properties
                agent.epsilon = parsedWeights.epsilon;
                agent.stepCount = parsedWeights.stepCount;
                
                this.agents[i] = agent;
                
                // Clean up temporary tensors
                weightTensors.forEach(tensor => tensor.dispose());
            }
            
            this.updateStatus(`Successfully loaded weights for ${this.agents.length} agents`);
            
            // Enable episode controls
            const startBtn = document.getElementById('start-episode');
            const resetBtn = document.getElementById('reset-episode');
            if (startBtn) startBtn.disabled = false;
            if (resetBtn) resetBtn.disabled = false;
            
        } catch (error) {
            console.error('Failed to load weights:', error);
            this.updateStatus(`Failed to load weights: ${error.message}`);
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

    getCurrentGameState() {
        // Get current game state for DQN processing
        const criticalPoints = this.getCriticalPointsState();
        
        // HARD LIMIT to exactly 50 critical points to fix dimension mismatch
        const limitedCriticalPoints = criticalPoints.slice(0, 50);
        console.log(`Critical points: ${criticalPoints.length} -> limited to ${limitedCriticalPoints.length}`);
        
        return {
            agent_position: [0, 1, 0], // Will be overridden per agent
            critical_points: limitedCriticalPoints,
            agent_owned_points: this.getAgentOwnedPoints(),
            time_remaining: 1.0, // Could be made dynamic
            navigation_grid: new Array(15 * 15).fill(0), // Simple grid for now
            nearest_unclaimed_distance: 0.5,
            nearest_enemy_distance: 0.7,
            map_size: 10
        };
    }

    updateEpisodeMetrics(step, gameState) {
        const metrics = document.getElementById('training-metrics');
        if (metrics) {
            const scores = this.getAgentOwnedPoints();
            const totalPoints = gameState.critical_points ? gameState.critical_points.length : 0;
            
            metrics.innerHTML = `
                <div>Step: ${step}</div>
                <div>Agent Scores:</div>
                <div>  Red: ${scores[0] || 0}/${totalPoints}</div>
                <div>  Green: ${scores[1] || 0}/${totalPoints}</div>
                <div>  Blue: ${scores[2] || 0}/${totalPoints}</div>
            `;
        }
    }

    dispose() {
        this.autoEpisodes = false;
        this.isEpisodeRunning = false;
        
        if (this.agents) {
            for (const agent of this.agents) {
                agent.dispose();
            }
            this.agents = null;
        }
    }

    parseWeightsFromText(weightsText) {
        console.log('=== PARSE WEIGHTS FROM TEXT ===');
        console.log('Input text:', weightsText);
        const weightLayers = [];
        let epsilon = 0.05; // Default epsilon
        let stepCount = 1000; // Default step count
        
        // Split text into lines
        const lines = weightsText.split('\n');
        console.log('Split into', lines.length, 'lines:', lines);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // Skip empty lines
            
            // Try to parse as WEIGHT_X= format first
            const weightMatch = line.match(/WEIGHT_(\d+)=(.+)$/);
            if (weightMatch) {
                const layerIdx = parseInt(weightMatch[1]);
                const weightJson = weightMatch[2];
                
                try {
                    const weightData = JSON.parse(weightJson);
                    weightLayers[layerIdx] = weightData;
                    console.log(`Found weight layer ${layerIdx} (WEIGHT_X format)`);
                } catch (error) {
                    console.error(`Error parsing weight layer ${layerIdx}:`, error);
                }
            }
            // If it's just a number, create a simple weight structure
            else if (!isNaN(parseFloat(line))) {
                const value = parseFloat(line);
                console.log(`Found simple number ${value} at line ${i}`);
                
                // Create appropriate weight structures for the exact DQN network architecture
                // Network: 581 -> 512 -> 256 -> 128 -> 5 (with biases for each layer)
                if (i === 0) {
                    // First layer weights (581 input to 512 hidden)
                    const inputDim = 581;
                    const hiddenDim = 512;
                    const values = new Array(inputDim * hiddenDim).fill(value / 1000000);
                    weightLayers[i] = { shape: [inputDim, hiddenDim], values: values };
                } else if (i === 1) {
                    // First layer biases (512 neurons)
                    const hiddenDim = 512;
                    const values = new Array(hiddenDim).fill(value / 1000000);
                    weightLayers[i] = { shape: [hiddenDim], values: values };
                } else if (i === 2) {
                    // Second layer weights (512 to 256)
                    const values = new Array(512 * 256).fill(value / 1000000);
                    weightLayers[i] = { shape: [512, 256], values: values };
                } else if (i === 3) {
                    // Second layer biases (256 neurons)
                    const values = new Array(256).fill(value / 1000000);
                    weightLayers[i] = { shape: [256], values: values };
                } else if (i === 4) {
                    // Third layer weights (256 to 128)
                    const values = new Array(256 * 128).fill(value / 1000000);
                    weightLayers[i] = { shape: [256, 128], values: values };
                } else if (i === 5) {
                    // Third layer biases (128 neurons)
                    const values = new Array(128).fill(value / 1000000);
                    weightLayers[i] = { shape: [128], values: values };
                } else if (i === 6) {
                    // Output layer weights (128 to 5 actions)
                    const values = new Array(128 * 5).fill(value / 1000000);
                    weightLayers[i] = { shape: [128, 5], values: values };
                } else if (i === 7) {
                    // Output layer biases (5 actions)
                    const values = new Array(5).fill(value / 1000000);
                    weightLayers[i] = { shape: [5], values: values };
                }
            }
            
            // Match epsilon and step count
            const epsilonMatch = line.match(/EPSILON=(.+)$/);
            if (epsilonMatch) {
                epsilon = parseFloat(epsilonMatch[1]);
            }
            
            const stepMatch = line.match(/STEP_COUNT=(.+)$/);
            if (stepMatch) {
                stepCount = parseInt(stepMatch[1]);
            }
        }
        
        console.log(`Parsed ${weightLayers.length} weight layers`);
        return { weightLayers, epsilon, stepCount };
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
