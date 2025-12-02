/**
 * DQN System - Phase 1: Data Collection + Phase 2: Training + Phase 3: Smart Decision Making
 * Ultra-simple approach for training agents in the maze game
 */

import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";
// TensorFlow.js is loaded globally in the HTML

/**
 * State Observer - Extracts game state into a fixed-size array
 */
class StateObserver {
    getState(agent, agentManager) {
        const state = [];
        
        try {
            // Agent position (2 numbers)
            const agentPos = agent.getPosition();
            state.push(agentPos.x || 0);
            state.push(agentPos.z || 0);
            
            // Nearest critical point info (4 numbers)
            const nearestCP = this.findNearestUnclaimedCP(agent, agentManager);
            state.push(nearestCP.x || 0);
            state.push(nearestCP.z || 0);
            state.push(nearestCP.distance || 0);
            state.push(nearestCP.isOwned ? 1 : 0);
            
            // Wall detection (4 numbers) - can agent move in each direction?
            state.push(this.canMoveInDirection(agent, 0, 0, -1) ? 1 : 0); // Forward
            state.push(this.canMoveInDirection(agent, -1, 0, 0) ? 1 : 0); // Left
            state.push(this.canMoveInDirection(agent, 0, 0, 1) ? 1 : 0);  // Back
            state.push(this.canMoveInDirection(agent, 1, 0, 0) ? 1 : 0);  // Right
            
            // Agent performance (2 numbers)
            state.push(agent.getScore() || 0);
            state.push(agentManager.criticalPoints ? agentManager.criticalPoints.length : 0);
            
            // Ensure we always have exactly 14 values
            while (state.length < 14) {
                state.push(0);
            }
            
            // Trim if we somehow have too many
            if (state.length > 14) {
                state.splice(14);
            }
            
            // Debug: Log state length if it's not 14
            if (state.length !== 14) {
                console.warn('State length mismatch:', state.length, 'Expected: 14', state);
            }
            
        } catch (error) {
            console.error('Error generating state:', error);
            // Return safe fallback state with 14 zeros
            return new Array(14).fill(0);
        }
        
        return state; // Always 14 numbers
    }
    
    /**
     * Find the nearest unclaimed critical point
     */
    findNearestUnclaimedCP(agent, agentManager) {
        const agentPos = agent.getPosition();
        let nearest = null;
        let minDistance = Infinity;
        
        for (const cp of agentManager.criticalPoints) {
            // Check if this CP is unclaimed (not owned by any agent)
            const isUnclaimed = !agentManager.globalClaimedPoints.has(agentManager.criticalPoints.indexOf(cp));
            
            if (isUnclaimed) {
                const distance = agentPos.distanceTo(cp.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = cp;
                }
            }
        }
        
        // If no unclaimed CPs, use the first available CP as fallback
        if (!nearest && agentManager.criticalPoints.length > 0) {
            nearest = agentManager.criticalPoints[0];
            minDistance = agentPos.distanceTo(nearest.position);
        }
        
        // Return fallback data if no CPs exist
        if (!nearest) {
            return { x: 0, z: 0, distance: 10, isOwned: false };
        }
        
        return {
            x: nearest.position.x,
            z: nearest.position.z,
            distance: minDistance,
            isOwned: false // We only consider unclaimed CPs
        };
    }
    
    /**
     * Check if agent can move in a specific direction (simplified wall detection)
     */
    canMoveInDirection(agent, deltaX, deltaY, deltaZ) {
        const currentPos = agent.getPosition();
        const testPos = new T.Vector3(
            currentPos.x + deltaX * 0.5,
            currentPos.y + deltaY,
            currentPos.z + deltaZ * 0.5
        );
        
        // Simple bounds check for the maze area (adjust based on your maze size)
        const bounds = 4; // Assumes maze is roughly -4 to +4
        if (testPos.x < -bounds || testPos.x > bounds || 
            testPos.z < -bounds || testPos.z > bounds) {
            return false;
        }
        
        // Check against maze blocks if available
        if (window.mapLayout && window.mapLayout.blocks) {
            for (const block of window.mapLayout.blocks) {
                const blockPos = block.position;
                if (Math.abs(testPos.x - blockPos.x) < 0.5 && 
                    Math.abs(testPos.z - blockPos.z) < 0.5) {
                    return false; // Block detected
                }
            }
        }
        
        return true; // Path is clear
    }
}

/**
 * Action Recorder - Converts agent movement to action numbers
 */
class ActionRecorder {
    getCurrentAction(agent) {
        // Check which direction agent is currently moving
        if (agent.movement.w) return 0; // Forward
        if (agent.movement.a) return 1; // Left  
        if (agent.movement.s) return 2; // Back
        if (agent.movement.d) return 3; // Right
        return 0; // Default to forward if no movement
    }
}

/**
 * Reward Calculator - Scores agent actions
 */
class RewardCalculator {
    constructor() {
        this.lastCapturedCount = new Map(); // Track captured CPs per agent
    }
    
    calculateReward(agent, oldState, newState, action) {
        let reward = 0;
        
        // Initialize tracking for this agent if needed
        if (!this.lastCapturedCount.has(agent.agentId)) {
            this.lastCapturedCount.set(agent.agentId, agent.getScore());
        }
        
        // Did agent capture a critical point? BIG REWARD!
        const currentScore = agent.getScore();
        const lastScore = this.lastCapturedCount.get(agent.agentId);
        if (currentScore > lastScore) {
            reward += 100;
            console.log(`Agent ${agent.agentId} captured CP! +100 reward`);
            this.lastCapturedCount.set(agent.agentId, currentScore);
        }
        
        // Did agent get closer to nearest unclaimed CP?
        const oldDistance = oldState[4]; // Distance was 5th element
        const newDistance = newState[4];
        if (newDistance < oldDistance) {
            reward += 2; // Small reward for moving toward goal
        } else if (newDistance > oldDistance) {
            reward -= 1; // Small penalty for moving away
        }
        
        // Did agent hit a wall or not move? (position didn't change much)
        const oldX = oldState[0], oldZ = oldState[1];
        const newX = newState[0], newZ = newState[1];
        const movement = Math.abs(newX - oldX) + Math.abs(newZ - oldZ);
        
        if (movement < 0.01) { // Very little movement
            reward -= 5; // Penalty for getting stuck
        } else {
            reward += 0.1; // Tiny reward just for moving
        }
        
        return reward;
    }
}

/**
 * Experience Buffer - Stores training data
 */
class ExperienceBuffer {
    constructor() {
        this.experiences = [];
        this.maxSize = 10000; // Keep last 10k experiences
    }
    
    addExperience(state, action, reward, nextState, done = false) {
        this.experiences.push({
            state: [...state],        // Copy arrays to avoid reference issues
            action: action,
            reward: reward,
            nextState: [...nextState],
            done: done
        });
        
        // Keep buffer from getting too big
        if (this.experiences.length > this.maxSize) {
            this.experiences.shift(); // Remove oldest experience
        }
        
        // Log progress every 100 experiences
        if (this.experiences.length % 100 === 0) {
            console.log(`Collected ${this.experiences.length} training experiences`);
        }
    }
    
    getExperienceCount() {
        return this.experiences.length;
    }
    
    getAllExperiences() {
        return this.experiences;
    }
    
    exportData() {
        const data = JSON.stringify(this.experiences, null, 2);
        console.log("\n=== TRAINING DATA READY ===");
        console.log(`Total experiences: ${this.experiences.length}`);
        console.log("Copy the following data for Phase 2 training:");
        console.log(data);
        return data;
    }
    
    clear() {
        this.experiences = [];
        console.log("Experience buffer cleared");
    }
}

/**
 * Main DQN Data Collection System
 */
class DQNDataCollector {
    constructor() {
        this.stateObserver = new StateObserver();
        this.actionRecorder = new ActionRecorder();
        this.rewardCalculator = new RewardCalculator();
        this.experienceBuffer = new ExperienceBuffer();
        
        this.isCollecting = false;
        this.agentLastStates = new Map(); // Store last state for each agent
        this.agentLastActions = new Map(); // Store last action for each agent
    }
    
    startCollection() {
        this.isCollecting = true;
        this.experienceBuffer.clear();
        console.log("Started DQN data collection");
    }
    
    stopCollection() {
        this.isCollecting = false;
        console.log(`Stopped DQN data collection. Total experiences: ${this.experienceBuffer.getExperienceCount()}`);
    }
    
    /**
     * Called from Agent.update() when in training mode
     */
    collectExperience(agent, agentManager) {
        if (!this.isCollecting) return;
        
        // 1. Observe current state
        const currentState = this.stateObserver.getState(agent, agentManager);
        
        // 2. Record current action
        const action = this.actionRecorder.getCurrentAction(agent);
        
        // 3. If we have a previous state, calculate reward and store experience
        const agentId = agent.agentId;
        if (this.agentLastStates.has(agentId)) {
            const lastState = this.agentLastStates.get(agentId);
            const lastAction = this.agentLastActions.get(agentId);
            
            // Calculate reward for the previous action
            const reward = this.rewardCalculator.calculateReward(agent, lastState, currentState, lastAction);
            
            // Store the experience
            this.experienceBuffer.addExperience(lastState, lastAction, reward, currentState, false);
        }
        
        // 4. Remember current state and action for next frame
        this.agentLastStates.set(agentId, currentState);
        this.agentLastActions.set(agentId, action);
    }
    
    getStats() {
        return {
            collecting: this.isCollecting,
            experienceCount: this.experienceBuffer.getExperienceCount(),
            maxExperiences: this.experienceBuffer.maxSize
        };
    }
    
    exportTrainingData() {
        return this.experienceBuffer.exportData();
    }
}

/**
 * PHASE 2: TRAINING SYSTEM
 * Ultra-simple neural network with TensorFlow.js
 */

/**
 * Simple DQN Neural Network - Ultra lightweight
 */
class SimpleDQNNetwork {
    constructor() {
        this.model = null;
        this.isReady = false;
        this.stateSize = 14; // Our state vector size
        this.actionSize = 4; // 4 possible actions
    }
    
    /**
     * Create the ultra-simple neural network
     * Input: 14 numbers → Output: 4 Q-values
     */
    createModel() {
        console.log('Creating ultra-simple DQN model...');
        
        // Ultra-simple: Direct linear mapping (no hidden layers)
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [this.stateSize],
                    units: this.actionSize,
                    activation: 'linear',
                    kernelInitializer: 'randomNormal'
                })
            ]
        });
        
        // Compile with simple optimizer
        this.model.compile({
            optimizer: tf.train.adam(0.001), // Low learning rate
            loss: 'meanSquaredError',
            metrics: ['mae']
        });
        
        this.isReady = true;
        console.log('Simple DQN model ready! Parameters:', this.model.countParams());
        
        return this.model;
    }
    
    /**
     * Predict Q-values for a state
     */
    predict(state) {
        if (!this.isReady || !this.model) {
            console.warn('Model not ready for prediction');
            return [0, 0, 0, 0]; // Default Q-values
        }
        
        // Ensure state is the right shape
        const stateTensor = tf.tensor2d([state], [1, this.stateSize]);
        const prediction = this.model.predict(stateTensor);
        const qValues = prediction.dataSync();
        
        // Clean up tensors
        stateTensor.dispose();
        prediction.dispose();
        
        return Array.from(qValues);
    }
    
    /**
     * Get the best action for a state
     */
    getBestAction(state) {
        const qValues = this.predict(state);
        return qValues.indexOf(Math.max(...qValues));
    }
    
    /**
     * Save model weights with shape information
     */
    async getWeights() {
        if (!this.model) return null;
        
        const weights = this.model.getWeights();
        const weightData = [];
        
        for (let weight of weights) {
            const values = await weight.data();
            weightData.push({
                data: Array.from(values),
                shape: weight.shape
            });
        }
        
        return weightData;
    }
    
    /**
     * Load model weights from array with shape information
     */
    setWeights(weightData) {
        if (!this.model || !weightData) return false;
        
        try {
            let weightTensors;
            
            // Check if we have new format (with shape) or old format (just arrays)
            if (weightData.length > 0 && weightData[0].data !== undefined && weightData[0].shape !== undefined) {
                // New format: array of {data, shape} objects
                console.log('Loading weights in new format (with shapes)');
                weightTensors = weightData.map(weightInfo => {
                    return tf.tensor(weightInfo.data, weightInfo.shape);
                });
            } else {
                // Old format: just arrays - try to infer shapes from model
                console.log('Loading weights in old format (arrays only) - attempting shape inference');
                const modelWeights = this.model.getWeights();
                
                if (modelWeights.length !== weightData.length) {
                    throw new Error(`Weight count mismatch: model has ${modelWeights.length} layers, file has ${weightData.length}`);
                }
                
                weightTensors = weightData.map((values, index) => {
                    const targetShape = modelWeights[index].shape;
                    return tf.tensor(values, targetShape);
                });
                
                // Clean up model weights reference
                modelWeights.forEach(w => w.dispose());
            }
            
            this.model.setWeights(weightTensors);
            
            // Clean up
            weightTensors.forEach(tensor => tensor.dispose());
            
            console.log('Model weights loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load weights:', error);
            console.error('Weight data:', weightData);
            return false;
        }
    }
}

/**
 * Simple DQN Trainer - Handles the training process
 */
class SimpleDQNTrainer {
    constructor() {
        this.network = new SimpleDQNNetwork();
        this.isTraining = false;
        this.trainingStats = {
            episodes: 0,
            totalLoss: 0,
            averageLoss: 0
        };
    }
    
    /**
     * Initialize the training system
     */
    initialize() {
        this.network.createModel();
        console.log('DQN Trainer initialized');
    }
    
    /**
     * Train the network on experience data
     */
    async trainOnExperiences(experiences, options = {}) {
        const {
            epochs = 10,
            batchSize = 32,
            gamma = 0.99, // Discount factor
            onProgress = null
        } = options;
        
        if (!experiences || experiences.length === 0) {
            console.warn('No training data available');
            return false;
        }
        
        if (!this.network.isReady) {
            console.warn('Network not ready for training');
            return false;
        }
        
        console.log(`Training on ${experiences.length} experiences for ${epochs} epochs...`);
        this.isTraining = true;
        
        // Prepare training data
        const states = [];
        const targets = [];
        
        for (const exp of experiences) {
            const { state, action, reward, nextState, done } = exp;
            
            // Current Q-values for this state
            const currentQ = this.network.predict(state);
            
            // Target Q-values
            const target = [...currentQ];
            
            if (done) {
                target[action] = reward; // Terminal state
            } else {
                // Q-learning: Q(s,a) = reward + gamma * max(Q(s',a'))
                const nextQ = this.network.predict(nextState);
                const maxNextQ = Math.max(...nextQ);
                target[action] = reward + gamma * maxNextQ;
            }
            
            states.push(state);
            targets.push(target);
        }
        
        // Convert to tensors
        const statesTensor = tf.tensor2d(states);
        const targetsTensor = tf.tensor2d(targets);
        
        try {
            // Train the model with UI-friendly settings
            const history = await this.network.model.fit(statesTensor, targetsTensor, {
                epochs: epochs,
                batchSize: Math.min(batchSize, states.length),
                verbose: 0, // Reduce console spam
                yieldEvery: 'batch', // Yield after each batch to prevent UI freezing
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        this.trainingStats.episodes++;
                        this.trainingStats.totalLoss += logs.loss;
                        this.trainingStats.averageLoss = this.trainingStats.totalLoss / this.trainingStats.episodes;
                        
                        if (onProgress) {
                            await onProgress(epoch + 1, epochs, logs);
                        }
                        
                        console.log(`Epoch ${epoch + 1}/${epochs} - Loss: ${logs.loss.toFixed(4)}`);
                        
                        // Yield control to prevent UI freezing
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                }
            });
            
            console.log('Training completed successfully!');
            console.log('Final loss:', history.history.loss[history.history.loss.length - 1]);
            
        } catch (error) {
            console.error('Training failed:', error);
            return false;
        } finally {
            // Clean up tensors
            statesTensor.dispose();
            targetsTensor.dispose();
            this.isTraining = false;
        }
        
        return true;
    }
    
    /**
     * Get training statistics
     */
    getStats() {
        return {
            isTraining: this.isTraining,
            episodes: this.trainingStats.episodes,
            averageLoss: this.trainingStats.averageLoss,
            networkReady: this.network.isReady
        };
    }
    
    /**
     * Export trained weights
     */
    async exportWeights() {
        const weights = await this.network.getWeights();
        const exportData = {
            weights: weights,
            stateSize: this.network.stateSize,
            actionSize: this.network.actionSize,
            trainingStats: this.trainingStats,
            timestamp: new Date().toISOString()
        };
        
        console.log('\n=== TRAINED DQN WEIGHTS ===');
        console.log('Copy this data for Phase 3:');
        console.log(JSON.stringify(exportData, null, 2));
        
        return exportData;
    }
    
    /**
     * Import trained weights
     */
    importWeights(exportData) {
        if (!exportData || !exportData.weights) {
            console.error('Invalid weight data');
            return false;
        }
        
        if (!this.network.isReady) {
            this.initialize();
        }
        
        return this.network.setWeights(exportData.weights);
    }
}

/**
 * Complete DQN System - Combines Phase 1 and Phase 2
 */
class CompleteDQNSystem {
    constructor() {
        // Phase 1: Data Collection
        this.dataCollector = new DQNDataCollector();
        
        // Phase 2: Training
        this.trainer = new SimpleDQNTrainer();
        this.trainer.initialize();
        
        console.log('Complete DQN System ready (Phase 1 + Phase 2)');
    }
    
    /**
     * Start data collection (Phase 1)
     */
    startDataCollection() {
        return this.dataCollector.startCollection();
    }
    
    /**
     * Stop data collection and get experiences
     */
    stopDataCollection() {
        this.dataCollector.stopCollection();
        return this.dataCollector.experienceBuffer.getAllExperiences();
    }
    
    /**
     * Train on collected data (Phase 2)
     */
    async trainOnCollectedData(options = {}) {
        const experiences = this.dataCollector.experienceBuffer.getAllExperiences();
        
        if (experiences.length < 100) {
            console.warn(`Only ${experiences.length} experiences collected. Recommend at least 100 for training.`);
            return false;
        }
        
        console.log(`Starting training on ${experiences.length} collected experiences...`);
        return await this.trainer.trainOnExperiences(experiences, options);
    }
    
    /**
     * Get the trained network for Phase 3
     */
    getTrainedNetwork() {
        return this.trainer.network;
    }
    
    /**
     * Export everything (data + trained weights)
     */
    async exportComplete() {
        const trainingData = this.dataCollector.exportTrainingData();
        const weights = await this.trainer.exportWeights();
        
        return {
            trainingData: trainingData,
            trainedWeights: weights
        };
    }
    
    /**
     * Get system status
     */
    getStatus() {
        return {
            phase1: this.dataCollector.getStats(),
            phase2: this.trainer.getStats(),
            readyForPhase3: this.trainer.network.isReady
        };
    }
}

/**
 * PHASE 3: SMART DECISION MAKING
 * Uses trained neural network for intelligent agent behavior
 */

/**
 * Action Executor - Converts DQN action numbers to agent movement
 */
class ActionExecutor {
    /**
     * Execute an action on an agent
     * @param {Agent} agent - The agent to control
     * @param {number} action - Action number (0=Forward, 1=Left, 2=Back, 3=Right)
     */
    executeAction(agent, action) {
        // Reset all movement first
        agent.movement.w = false;
        agent.movement.a = false;
        agent.movement.s = false;
        agent.movement.d = false;
        
        // Set movement based on DQN decision
        switch(action) {
            case 0: // Forward
                agent.movement.w = true;
                break;
            case 1: // Left
                agent.movement.a = true;
                break;
            case 2: // Back
                agent.movement.s = true;
                break;
            case 3: // Right
                agent.movement.d = true;
                break;
            default:
                // Default to forward if invalid action
                agent.movement.w = true;
                break;
        }
    }
}

/**
 * Smart Agent Controller - Handles DQN-based decision making
 */
class SmartAgentController {
    constructor(trainedNetwork) {
        this.network = trainedNetwork;
        this.stateObserver = new StateObserver();
        this.actionExecutor = new ActionExecutor();
        this.epsilon = 0.1; // 10% exploration rate
        this.lastAction = new Map(); // Track last action per agent
        this.decisionCount = new Map(); // Track decisions per agent
    }
    
    /**
     * Make a smart decision for an agent
     * @param {Agent} agent - The agent to control
     * @param {AgentManager} agentManager - The agent manager
     */
    makeDecision(agent, agentManager) {
        if (!this.network || !this.network.isReady) {
            console.warn('Network not ready for smart decisions');
            return this.makeRandomDecision(agent);
        }
        
        // Initialize tracking for this agent
        if (!this.decisionCount.has(agent.agentId)) {
            this.decisionCount.set(agent.agentId, 0);
        }
        
        // Get current state
        const currentState = this.stateObserver.getState(agent, agentManager);
        
        let action;
        
        // Epsilon-greedy exploration
        if (Math.random() < this.epsilon) {
            // Explore: random action
            action = Math.floor(Math.random() * 4);
            // console.log(`Agent ${agent.agentId}: Exploring (random action ${action})`);
        } else {
            // Exploit: use trained network
            action = this.network.getBestAction(currentState);
            // console.log(`Agent ${agent.agentId}: Using DQN (action ${action})`);
        }
        
        // Execute the chosen action
        this.actionExecutor.executeAction(agent, action);
        
        // Track decision
        this.lastAction.set(agent.agentId, action);
        this.decisionCount.set(agent.agentId, this.decisionCount.get(agent.agentId) + 1);
        
        return action;
    }
    
    /**
     * Fallback to random decision if network isn't available
     */
    makeRandomDecision(agent) {
        const action = Math.floor(Math.random() * 4);
        this.actionExecutor.executeAction(agent, action);
        return action;
    }
    
    /**
     * Set exploration rate (0.0 = pure exploitation, 1.0 = pure exploration)
     */
    setEpsilon(epsilon) {
        this.epsilon = Math.max(0, Math.min(1, epsilon));
        console.log(`Exploration rate set to ${(this.epsilon * 100).toFixed(1)}%`);
    }
    
    /**
     * Get decision statistics
     */
    getStats() {
        const stats = {};
        for (const [agentId, count] of this.decisionCount.entries()) {
            stats[`agent${agentId}`] = {
                decisions: count,
                lastAction: this.lastAction.get(agentId) || 0
            };
        }
        return {
            epsilon: this.epsilon,
            networkReady: this.network && this.network.isReady,
            agentStats: stats
        };
    }
}

/**
 * DQN Agent Behavior Manager - Manages smart vs random behavior
 */
class DQNAgentBehavior {
    constructor() {
        this.smartController = null;
        this.isSmartMode = false;
        this.trainedWeights = null;
        this.network = null;
    }
    
    /**
     * Load trained weights and enable smart mode
     */
    loadTrainedWeights(exportData) {
        if (!exportData || !exportData.weights) {
            console.error('Invalid weight data for smart mode');
            return false;
        }
        
        try {
            // Create new network and load weights
            this.network = new SimpleDQNNetwork();
            this.network.createModel();
            
            if (this.network.setWeights(exportData.weights)) {
                this.smartController = new SmartAgentController(this.network);
                this.trainedWeights = exportData;
                console.log('Smart agent behavior loaded successfully');
                return true;
            } else {
                console.error('Failed to load weights into network');
                return false;
            }
        } catch (error) {
            console.error('Error loading smart behavior:', error);
            return false;
        }
    }
    
    /**
     * Enable smart mode for agents
     */
    enableSmartMode() {
        if (!this.smartController) {
            console.error('Smart controller not available. Load trained weights first.');
            return false;
        }
        
        this.isSmartMode = true;
        console.log('Smart agent mode ENABLED');
        return true;
    }
    
    /**
     * Disable smart mode (back to random)
     */
    disableSmartMode() {
        this.isSmartMode = false;
        console.log('Smart agent mode DISABLED (random mode)');
    }
    
    /**
     * Update agent using smart behavior (called from Agent.updateDQNMode)
     */
    updateAgent(agent, agentManager) {
        if (this.isSmartMode && this.smartController) {
            return this.smartController.makeDecision(agent, agentManager);
        } else {
            // Fallback to random if smart mode not available
            return this.makeRandomDecision(agent);
        }
    }
    
    /**
     * Fallback random decision
     */
    makeRandomDecision(agent) {
        // Reset movement
        agent.movement.w = false;
        agent.movement.a = false;
        agent.movement.s = false;
        agent.movement.d = false;
        
        // Random action
        const action = Math.floor(Math.random() * 4);
        switch(action) {
            case 0: agent.movement.w = true; break;
            case 1: agent.movement.a = true; break;
            case 2: agent.movement.s = true; break;
            case 3: agent.movement.d = true; break;
        }
        
        return action;
    }
    
    /**
     * Set exploration rate for smart controller
     */
    setExplorationRate(epsilon) {
        if (this.smartController) {
            this.smartController.setEpsilon(epsilon);
        }
    }
    
    /**
     * Get behavior status and statistics
     */
    getStatus() {
        return {
            smartModeEnabled: this.isSmartMode,
            networkLoaded: this.network !== null,
            controllerReady: this.smartController !== null,
            smartStats: this.smartController ? this.smartController.getStats() : null
        };
    }
}

/**
 * Complete DQN System - All Three Phases
 */
class FullDQNSystem extends CompleteDQNSystem {
    constructor() {
        super(); // Initialize Phase 1 + 2
        
        // Phase 3: Smart Decision Making
        this.agentBehavior = new DQNAgentBehavior();
        
        console.log('Full DQN System ready (Phase 1 + Phase 2 + Phase 3)');
    }
    
    /**
     * Enable smart agent behavior with trained weights
     */
    enableSmartAgents(trainedWeights = null) {
        // Use provided weights or try to use our own trained weights
        const weights = trainedWeights || this.lastTrainedWeights;
        
        if (!weights) {
            console.error('No trained weights available. Train the model first.');
            return false;
        }
        
        if (this.agentBehavior.loadTrainedWeights(weights)) {
            return this.agentBehavior.enableSmartMode();
        }
        
        return false;
    }
    
    /**
     * Disable smart agents (back to random)
     */
    disableSmartAgents() {
        this.agentBehavior.disableSmartMode();
    }
    
    /**
     * Train and automatically enable smart agents
     */
    async trainAndEnableSmartAgents(options = {}) {
        // Train on collected data
        const trainingSuccess = await this.trainOnCollectedData(options);
        
        if (!trainingSuccess) {
            console.error('Training failed, cannot enable smart agents');
            return false;
        }
        
        // Export weights and enable smart mode
        this.lastTrainedWeights = await this.trainer.exportWeights();
        return this.enableSmartAgents(this.lastTrainedWeights);
    }
    
    /**
     * Get smart behavior controller for agent updates
     */
    getAgentBehavior() {
        return this.agentBehavior;
    }
    
    /**
     * Set exploration rate (0.0 = pure smart, 1.0 = pure random)
     */
    setExplorationRate(epsilon) {
        this.agentBehavior.setExplorationRate(epsilon);
    }
    
    /**
     * Complete system status
     */
    getFullStatus() {
        const baseStatus = this.getStatus();
        return {
            ...baseStatus,
            phase3: this.agentBehavior.getStatus()
        };
    }
}

// Export classes for use in other files
export { 
    DQNDataCollector, StateObserver, ActionRecorder, RewardCalculator, ExperienceBuffer,
    SimpleDQNNetwork, SimpleDQNTrainer, CompleteDQNSystem,
    ActionExecutor, SmartAgentController, DQNAgentBehavior, FullDQNSystem
};

// Create global instances
window.DQNDataCollector = DQNDataCollector;
window.SimpleDQNNetwork = SimpleDQNNetwork;
window.SimpleDQNTrainer = SimpleDQNTrainer;
window.CompleteDQNSystem = CompleteDQNSystem;
window.ActionExecutor = ActionExecutor;
window.SmartAgentController = SmartAgentController;
window.DQNAgentBehavior = DQNAgentBehavior;
window.FullDQNSystem = FullDQNSystem;
