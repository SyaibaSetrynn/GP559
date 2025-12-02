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
        
        // 1. MAJOR REWARD: Captured a critical point
        const currentScore = agent.getScore();
        const lastScore = this.lastCapturedCount.get(agent.agentId);
        if (currentScore > lastScore) {
            reward += 50; // Big reward for success
            this.lastCapturedCount.set(agent.agentId, currentScore);
        }
        
        // 2. MOVEMENT REWARD: Progress toward nearest critical point
        const oldDistance = oldState[4]; // Distance was 5th element
        const newDistance = newState[4];
        if (newDistance < oldDistance) {
            reward += 1; // Reward for getting closer
        } else if (newDistance > oldDistance) {
            reward -= 0.5; // Small penalty for moving away
        }
        
        // 3. MOVEMENT QUALITY: Encourage meaningful movement, discourage jostling
        const oldX = oldState[0], oldZ = oldState[1];
        const newX = newState[0], newZ = newState[1];
        const movement = Math.abs(newX - oldX) + Math.abs(newZ - oldZ);
        
        if (movement < 0.005) { // Very little movement (stuck/jostling)
            reward -= 2; // Penalty for not moving or jostling
        } else if (movement > 0.01 && movement < 0.1) { // Good movement
            reward += 0.2; // Small reward for meaningful movement
        }
        
        // 4. EXPLORATION BONUS: Reward for being in different areas
        const centerDistance = Math.sqrt(newX * newX + newZ * newZ);
        if (centerDistance > 2) { // Agent is exploring edges
            reward += 0.1; // Small exploration bonus
        }
        
        // 5. WALL COLLISION PENALTY: Check if agent can move in current direction
        const canMoveForward = newState[6]; // Wall detection forward
        const canMoveLeft = newState[7];    // Wall detection left
        const canMoveBack = newState[8];    // Wall detection back  
        const canMoveRight = newState[9];   // Wall detection right
        
        // Penalty for choosing actions that lead to walls
        if ((action === 0 && !canMoveForward) ||
            (action === 1 && !canMoveLeft) ||
            (action === 2 && !canMoveBack) ||
            (action === 3 && !canMoveRight)) {
            reward -= 1; // Penalty for bad action choice
        }
        
        // Clamp reward to reasonable range to prevent training instability
        return Math.max(-10, Math.min(60, reward));
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
        
        // Throttling mechanism - collect experiences every 500ms (0.5 seconds)
        this.collectionInterval = 500; // milliseconds between data collection
        this.agentLastCollectionTime = new Map(); // Track when each agent last collected data
    }
    
    startCollection() {
        this.isCollecting = true;
        this.experienceBuffer.clear();
        
        // Clear previous agent states and timers
        this.agentLastStates.clear();
        this.agentLastActions.clear();
        this.agentLastCollectionTime.clear();
        
        console.log("Started DQN data collection (throttled to 2 experiences per second per agent)");
        console.log("Expected collection rate: ~6 experiences/second for 3 agents");
    }
    
    stopCollection() {
        this.isCollecting = false;
        console.log(`Stopped DQN data collection. Total experiences: ${this.experienceBuffer.getExperienceCount()}`);
    }
    
    /**
     * Called from Agent.update() when in training mode
     * Now throttled to collect data every 0.5 seconds instead of every frame
     */
    collectExperience(agent, agentManager) {
        if (!this.isCollecting) return;
        
        const agentId = agent.agentId;
        const currentTime = Date.now();
        
        // Check if enough time has passed since last collection for this agent
        const lastCollectionTime = this.agentLastCollectionTime.get(agentId) || 0;
        if (currentTime - lastCollectionTime < this.collectionInterval) {
            return; // Skip this frame - not enough time has passed
        }
        
        // Update last collection time
        this.agentLastCollectionTime.set(agentId, currentTime);
        
        // 1. Observe current state
        const currentState = this.stateObserver.getState(agent, agentManager);
        
        // 2. Record current action
        const action = this.actionRecorder.getCurrentAction(agent);
        
        // 3. If we have a previous state, calculate reward and store experience
        if (this.agentLastStates.has(agentId)) {
            const lastState = this.agentLastStates.get(agentId);
            const lastAction = this.agentLastActions.get(agentId);
            
            // Calculate reward for the previous action
            const reward = this.rewardCalculator.calculateReward(agent, lastState, currentState, lastAction);
            
            // Store the experience
            this.experienceBuffer.addExperience(lastState, lastAction, reward, currentState, false);
            
            // Debug log occasionally
            if (this.experienceBuffer.getExperienceCount() % 50 === 0) {
                console.log(`Collected ${this.experienceBuffer.getExperienceCount()} experiences (Agent ${agentId})`);
            }
        }
        
        // 4. Remember current state and action for next collection
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
        this.epsilon = 0.05; // 5% exploration rate (lower to reduce jostling)
        this.lastAction = new Map(); // Track last action per agent
        this.decisionCount = new Map(); // Track decisions per agent
        
        // Action smoothing to reduce jostling
        this.actionStickyness = 5; // Frames to stick with same action
        this.actionFrameCount = new Map(); // Count frames for current action
        this.currentStickyAction = new Map(); // Current sticky action per agent
    }
    
    /**
     * Make a smart decision for an agent with action smoothing to reduce jostling
     * @param {Agent} agent - The agent to control  
     * @param {AgentManager} agentManager - The agent manager
     */
    makeDecision(agent, agentManager) {
        if (!this.network || !this.network.isReady) {
            console.warn('Network not ready for smart decisions');
            return this.makeRandomDecision(agent);
        }
        
        // Initialize tracking for this agent
        const agentId = agent.agentId;
        if (!this.decisionCount.has(agentId)) {
            this.decisionCount.set(agentId, 0);
            this.actionFrameCount.set(agentId, 0);
            this.currentStickyAction.set(agentId, -1);
        }
        
        let action;
        const currentFrameCount = this.actionFrameCount.get(agentId);
        const currentStickyAction = this.currentStickyAction.get(agentId);
        
        // Check if we should stick with current action to reduce jostling
        if (currentStickyAction !== -1 && currentFrameCount < this.actionStickyness) {
            // Continue with current action
            action = currentStickyAction;
            this.actionFrameCount.set(agentId, currentFrameCount + 1);
        } else {
            // Time to make a new decision
            const currentState = this.stateObserver.getState(agent, agentManager);
            
            // Epsilon-greedy exploration
            if (Math.random() < this.epsilon) {
                // Explore: random action
                action = Math.floor(Math.random() * 4);
                
                // Debug: Log exploration decisions occasionally
                if (Math.random() < 0.01) { // 1% chance to log
                    console.log(`Agent ${agentId} exploring: action ${action} (${['Forward', 'Left', 'Back', 'Right'][action]})`);
                }
            } else {
                // Exploit: use trained network
                action = this.network.getBestAction(currentState);
                
                // Debug: Log smart decisions occasionally
                if (Math.random() < 0.01) { // 1% chance to log
                    const nearestCPDist = currentState[4];
                    console.log(`Agent ${agentId} smart decision: action ${action} (${['Forward', 'Left', 'Back', 'Right'][action]}) | Nearest CP: ${nearestCPDist.toFixed(2)} units away`);
                }
            }
            
            // Start new sticky action period
            this.currentStickyAction.set(agentId, action);
            this.actionFrameCount.set(agentId, 0);
        }
        
        // Execute the chosen action
        this.actionExecutor.executeAction(agent, action);
        
        // Track decision
        this.lastAction.set(agentId, action);
        this.decisionCount.set(agentId, this.decisionCount.get(agentId) + 1);
        
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

/**
 * STEP 1: Episode Manager - OpenAI Multi-Agent Episode-Based Training
 * 
 * This class manages the episode-based training cycle:
 * 1. Reset environment to initial state
 * 2. Run episode for fixed duration
 * 3. Collect experiences during episode
 * 4. Prepare for learning phase
 * 
 * Inspired by OpenAI's multi-agent emergence environments paper
 */
class EpisodeManager {
    constructor() {
        this.currentEpisode = 0;
        this.totalEpisodes = 0;
        this.episodeLength = 15000; // 15 seconds per episode (good for fast iteration)
        this.isRunning = false;
        
        // Episode state tracking
        this.episodeStartTime = 0;
        this.episodeEndTime = 0;
        this.episodeExperiences = [];
        
        // Environment references (set during initialization)
        this.gameManager = null;
        this.dataCollector = null;
        
        // Episode statistics
        this.episodeStats = [];
        this.globalStats = {
            totalEpisodes: 0,
            totalExperiences: 0,
            averageReward: 0,
            averageCPsCaptured: 0
        };
        
        console.log('Episode Manager initialized for OpenAI-style training');
    }
    
    /**
     * Initialize the episode manager with game components
     */
    initialize(gameManager, dataCollector) {
        this.gameManager = gameManager;
        this.dataCollector = dataCollector;
        
        console.log('Episode Manager connected to game systems');
        console.log('   - Game Manager:', !!this.gameManager);
        console.log('   - Data Collector:', !!this.dataCollector);
        
        return true;
    }
    
    /**
     * Reset environment to initial state (Step 1a: Environment Reset)
     */
    async resetEnvironment() {
        console.log('=== ENVIRONMENT RESET STARTING ===');
        
        if (!this.gameManager) {
            throw new Error('Game manager not initialized');
        }
        
        // Reset critical points to neutral state FIRST
        if (this.gameManager.criticalPointSystem) {
            console.log('Step 1: Resetting critical points...');
            this.resetCriticalPointsCompletely();
            console.log('Critical points reset completed');
        }
        
        // Reset agent positions and states SECOND
        if (this.gameManager.agents) {
            console.log(`Step 2: Resetting ${this.gameManager.agents.length} agents to starting positions...`);
            this.gameManager.agents.forEach((agent, index) => {
                // Reset to initial positions (spread around circle)
                const angle = (index / this.gameManager.agents.length) * 2 * Math.PI;
                const radius = 15;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                const y = 0.5;
                
                if (agent.mesh) {
                    // Store previous position for debugging
                    const prevPos = { 
                        x: agent.mesh.position.x, 
                        z: agent.mesh.position.z 
                    };
                    
                    // Force position reset
                    agent.mesh.position.set(x, y, z);
                    agent.mesh.rotation.set(0, 0, 0);
                    
                    // Verify position was set
                    const newPos = {
                        x: agent.mesh.position.x,
                        z: agent.mesh.position.z
                    };
                    
                    console.log(`Agent ${index}: (${prevPos.x.toFixed(1)},${prevPos.z.toFixed(1)}) -> (${newPos.x.toFixed(1)},${newPos.z.toFixed(1)})`);
                    
                    // Double-check the reset worked
                    const distance = Math.sqrt((newPos.x - x) ** 2 + (newPos.z - z) ** 2);
                    if (distance > 0.1) {
                        console.warn(`Agent ${index} position reset failed! Distance from target: ${distance.toFixed(2)}`);
                        // Try again
                        agent.mesh.position.set(x, y, z);
                    }
                }
                
                // Reset agent scores and claimed points
                if (agent.claimedCriticalPoints) {
                    const prevClaimedCount = agent.claimedCriticalPoints.size;
                    agent.claimedCriticalPoints.clear();
                    if (prevClaimedCount > 0) {
                        console.log(`Agent ${index}: Reset ${prevClaimedCount} claimed critical points`);
                    }
                }
                if (agent.testScore !== undefined) {
                    const prevScore = agent.testScore;
                    agent.testScore = 0;
                    if (prevScore !== 0) {
                        console.log(`Agent ${index}: Reset score from ${prevScore} to 0`);
                    }
                }
                
                // Reset any other agent state
                if (agent.velocity) {
                    agent.velocity.set(0, 0, 0);
                }
                
                // Reset any action/decision state that might persist
                if (agent.lastAction !== undefined) {
                    agent.lastAction = null;
                }
                if (agent.actionHistory) {
                    agent.actionHistory = [];
                }
            });
            console.log('All agents reset to starting positions confirmed');
        }
        
        console.log('=== ENVIRONMENT RESET COMPLETE ===');
        
        // Longer pause for environment to settle and become visually obvious
        await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    /**
     * Run a single episode (Step 1b: Episode Execution)
     */
    async runSingleEpisode(episodeNumber, episodeLength = null) {
        const length = episodeLength || this.episodeLength;
        
        console.log(`\n=== Starting Episode ${episodeNumber} ===`);
        console.log(`   Duration: ${length/1000} seconds`);
        console.log(`   Agents: ${this.gameManager.agents.length}`);
        
        // Reset environment first
        await this.resetEnvironment();
        
        // Clear experience buffer for this episode
        if (this.dataCollector && this.dataCollector.experienceBuffer) {
            this.dataCollector.experienceBuffer.clear();
        }
        
        // Set agents to training mode and start data collection
        this.gameManager.setAllAgentsMode('training', this.dataCollector);
        this.dataCollector.startCollection();
        
        // Track episode timing
        this.episodeStartTime = Date.now();
        this.isRunning = true;
        
        console.log(`Episode ${episodeNumber} running...`);
        
        // Run episode for specified duration
        return new Promise((resolve) => {
            const episodeTimer = setTimeout(async () => {
                // Episode completed
                this.episodeEndTime = Date.now();
                this.isRunning = false;
                
                // Stop data collection
                this.dataCollector.stopCollection();
                
                // Collect episode results
                const episodeData = await this.collectEpisodeResults(episodeNumber, length);
                
                console.log(`Episode ${episodeNumber} completed:`);
                console.log(`   Duration: ${episodeData.actualDuration/1000}s`);
                console.log(`   Experiences: ${episodeData.experienceCount}`);
                console.log(`   CPs Captured: ${episodeData.cpsCaptured}`);
                console.log(`   Total Reward: ${episodeData.totalReward.toFixed(2)}`);
                
                resolve(episodeData);
            }, length);
        });
    }
    
    /**
     * Collect and analyze episode results (Step 1c: Episode Analysis)
     */
    async collectEpisodeResults(episodeNumber, plannedDuration) {
        const actualDuration = this.episodeEndTime - this.episodeStartTime;
        const experiences = this.dataCollector.experienceBuffer.getAllExperiences();
        
        // Calculate episode statistics
        let totalReward = 0;
        experiences.forEach(exp => {
            totalReward += exp.reward;
        });
        
        // Count captured critical points
        let cpsCaptured = 0;
        if (this.gameManager.criticalPointSystem && this.gameManager.criticalPointSystem.criticalPoints) {
            this.gameManager.criticalPointSystem.criticalPoints.forEach(cpData => {
                if (cpData.ownedBy !== null) {
                    cpsCaptured++;
                }
            });
        }
        
        // Create episode data object
        const episodeData = {
            episode: episodeNumber,
            plannedDuration: plannedDuration,
            actualDuration: actualDuration,
            experienceCount: experiences.length,
            experiences: experiences,
            totalReward: totalReward,
            averageReward: experiences.length > 0 ? totalReward / experiences.length : 0,
            cpsCaptured: cpsCaptured,
            agentCount: this.gameManager.agents.length,
            timestamp: new Date().toISOString()
        };
        
        // Store episode stats
        this.episodeStats.push(episodeData);
        this.currentEpisode = episodeNumber;
        
        // Update global statistics
        this.globalStats.totalEpisodes = episodeNumber;
        this.globalStats.totalExperiences += experiences.length;
        this.globalStats.averageReward = this.calculateGlobalAverageReward();
        this.globalStats.averageCPsCaptured = this.calculateAverageCPsCaptured();
        
        return episodeData;
    }
    
    /**
     * Calculate global average reward across all episodes
     */
    calculateGlobalAverageReward() {
        if (this.episodeStats.length === 0) return 0;
        
        const totalReward = this.episodeStats.reduce((sum, ep) => sum + ep.totalReward, 0);
        const totalExperiences = this.episodeStats.reduce((sum, ep) => sum + ep.experienceCount, 0);
        
        return totalExperiences > 0 ? totalReward / totalExperiences : 0;
    }
    
    /**
     * Calculate average critical points captured per episode
     */
    calculateAverageCPsCaptured() {
        if (this.episodeStats.length === 0) return 0;
        
        const totalCPs = this.episodeStats.reduce((sum, ep) => sum + ep.cpsCaptured, 0);
        return totalCPs / this.episodeStats.length;
    }
    
    /**
     * Get episode manager status and statistics
     */
    getStatus() {
        return {
            currentEpisode: this.currentEpisode,
            totalEpisodes: this.totalEpisodes,
            isRunning: this.isRunning,
            episodeLength: this.episodeLength,
            globalStats: { ...this.globalStats },
            recentEpisodes: this.episodeStats.slice(-3), // Last 3 episodes
            initialized: !!(this.gameManager && this.dataCollector)
        };
    }
    
    /**
     * Reset critical points to neutral state without duplicating them
     */
    resetCriticalPointsCompletely() {
        const cps = this.gameManager.criticalPointSystem;
        
        if (!cps) return;

        console.log('=== CRITICAL POINTS RESET STARTING ===');
        console.log(`Before reset: ${cps.criticalPoints ? cps.criticalPoints.length : 0} critical points exist`);

        // Reset existing critical points to neutral state (don't regenerate!)
        if (cps.criticalPoints && cps.criticalPoints.length > 0) {
            console.log(`Resetting ${cps.criticalPoints.length} existing critical points to neutral state`);
            
            let resetCount = 0;
            cps.criticalPoints.forEach((cpData, index) => {
                if (cpData.cp && cpData.cp.material) {
                    // Reset to original/neutral color
                    const originalColor = cpData.originalColor || 0xffffff;
                    cpData.cp.material.color.setHex(originalColor);
                    cpData.cp.material.opacity = 0.8;
                    
                    // Reset any glow children
                    if (cpData.cp.children && cpData.cp.children.length > 0) {
                        cpData.cp.children.forEach(child => {
                            if (child.material) {
                                child.material.color.setHex(originalColor);
                            }
                        });
                    }
                    
                    console.log(`CP ${index}: Reset to color 0x${originalColor.toString(16)}`);
                    resetCount++;
                }
                
                // Reset ownership and state
                cpData.ownedBy = null;
                cpData.currentOwner = null;
                if (cpData.fillProgress !== undefined) {
                    cpData.fillProgress = 0;
                }
                if (cpData.currentColor) {
                    cpData.currentColor = cpData.originalColor || 0xffffff;
                }
            });
            
            console.log(`Successfully reset ${resetCount} critical points visually`);
            
            // Reset registry ownership but keep the critical points
            if (cps.cpsByOwner) {
                const prevOwnerCount = cps.cpsByOwner.size;
                cps.cpsByOwner.clear();
                console.log(`Cleared ${prevOwnerCount} ownership registries`);
            }
            
            // Reset registry states but don't clear the points themselves
            if (cps.cpRegistry) {
                let registryResetCount = 0;
                cps.cpRegistry.forEach((cpData, id) => {
                    cpData.ownedBy = null;
                    cpData.isActivelyClaimed = false;
                    cpData.claimedBy = null;
                    cpData.lastClaimedTime = 0;
                    if (cpData.claimHistory) {
                        cpData.claimHistory = [];
                    }
                    registryResetCount++;
                });
                console.log(`Reset ${registryResetCount} registry entries`);
            }
        } else {
            console.log('No existing critical points found to reset');
        }

        console.log('=== CRITICAL POINTS RESET COMPLETE ===');
        console.log(`After reset: ${cps.criticalPoints ? cps.criticalPoints.length : 0} critical points exist`);
    }

    stopEpisode() {
        if (this.isRunning) {
            this.isRunning = false;
            this.dataCollector.stopCollection();
            console.log('Episode stopped early by user');
        }
    }
}

/**
 * STEP 2: Episode-Based Learning Loop - OpenAI Multi-Agent Style
 * 
 * This replaces the old experience replay training with episode-based learning:
 * 1. Run episodes using Episode Manager
 * 2. Learn immediately from each episode's experiences
 * 3. Update network weights after each episode
 * 4. Track learning progress across episodes
 * 
 * This is the core of OpenAI's approach - learn from actual gameplay, not replay buffers
 */
class EpisodeBasedTrainer {
    constructor() {
        this.network = null;
        this.targetNetwork = null; // For stable DQN learning
        this.episodeManager = null;
        this.dataCollector = null;
        
        // Training parameters
        this.learningRate = 0.0001;
        this.batchSize = 32;
        this.targetUpdateFreq = 5; // Update target network every N episodes
        this.maxEpisodesPerSession = 50;
        
        // Training state
        this.isTraining = false;
        this.currentSession = 0;
        this.totalEpisodesRun = 0;
        
        // Learning statistics
        this.learningStats = {
            episodeLosses: [],
            episodeRewards: [],
            episodeCPsCaptured: [],
            averageLoss: 0,
            averageReward: 0,
            bestEpisodeReward: -Infinity,
            totalTrainingTime: 0
        };
        
        console.log('Episode-Based Trainer initialized (OpenAI Style)');
    }
    
    /**
     * Initialize the trainer with necessary components
     */
    async initialize(gameManager, dataCollector) {
        console.log('Initializing Episode-Based Trainer...');
        
        // Create fresh neural network
        this.network = new SimpleDQNNetwork();
        this.network.createModel();
        
        // Create target network for stable DQN learning
        this.targetNetwork = new SimpleDQNNetwork();
        this.targetNetwork.createModel();
        this.updateTargetNetwork(); // Copy initial weights
        
        // Initialize episode manager
        this.episodeManager = new EpisodeManager();
        this.episodeManager.initialize(gameManager, dataCollector);
        
        this.dataCollector = dataCollector;
        
        console.log('Episode-Based Trainer ready:');
        console.log('   - Neural Network: Ready');
        console.log('   - Target Network: Ready');
        console.log('   - Episode Manager: Ready');
        console.log('   - Data Collector: Ready');
        
        return true;
    }
    
    /**
     * Update target network weights (DQN stability technique)
     */
    updateTargetNetwork() {
        if (this.network && this.targetNetwork && this.network.model && this.targetNetwork.model) {
            const weights = this.network.model.getWeights();
            this.targetNetwork.model.setWeights(weights);
            console.log('Target network updated for stable learning');
        }
    }
    
    /**
     * Main training loop - runs multiple episodes with learning
     */
    async runEpisodeBasedTraining(config) {
        const {
            episodes = 20,           // Fewer episodes for faster iteration
            episodeLength = 10000,   // 10 seconds per episode (faster)
            onEpisodeStart,          // Callback when episode starts
            onEpisodeComplete,
            onTrainingComplete
        } = config;
        
        console.log('=== STARTING EPISODE-BASED TRAINING (STEP 2) ===');
        console.log('Learning after each episode - no experience replay!');
        console.log(`Training Plan: ${episodes} episodes × ${episodeLength/1000}s = ${(episodes*episodeLength/1000/60).toFixed(1)} minutes`);
        
        this.isTraining = true;
        this.totalEpisodesRun = 0;
        const trainingStartTime = Date.now();
        
        try {
            for (let episode = 1; episode <= episodes; episode++) {
                if (!this.isTraining) {
                    console.log('Training stopped early');
                    break;
                }
                
                console.log(`\nEpisode ${episode}/${episodes} - Learn & Play Cycle`);
                
                // Step 2a: Episode start callback
                if (onEpisodeStart) {
                    await onEpisodeStart(episode, episodes);
                }
                
                // Step 2b: Run single episode
                const episodeData = await this.episodeManager.runSingleEpisode(episode, episodeLength);
                
                // Step 2c: Learn immediately from this episode
                const learningResult = await this.learnFromEpisode(episodeData, episode);
                
                // Step 2d: Update target network periodically
                if (episode % this.targetUpdateFreq === 0) {
                    this.updateTargetNetwork();
                }
                
                // Step 2e: Track learning progress
                this.updateLearningStats(episodeData, learningResult);
                
                // Step 2f: Report progress
                if (onEpisodeComplete) {
                    await onEpisodeComplete(episode, episodes, {
                        ...episodeData,
                        ...learningResult,
                        averageLoss: this.learningStats.averageLoss
                    });
                }
                
                this.totalEpisodesRun = episode;
                
                // Brief pause between episodes
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const trainingTime = Date.now() - trainingStartTime;
            this.learningStats.totalTrainingTime = trainingTime;
            
            console.log('=== EPISODE-BASED TRAINING COMPLETED ===');
            console.log(`Total time: ${(trainingTime/1000/60).toFixed(1)} minutes`);
            console.log(`Episodes completed: ${this.totalEpisodesRun}`);
            console.log(`Best episode reward: ${this.learningStats.bestEpisodeReward.toFixed(2)}`);
            console.log(`Final average loss: ${this.learningStats.averageLoss.toFixed(4)}`);
            console.log('Network learned from real gameplay episodes!');
            
            if (onTrainingComplete) {
                await onTrainingComplete(this.learningStats);
            }
            
            return true;
            
        } catch (error) {
            console.error('Episode-based training failed:', error);
            return false;
        } finally {
            this.isTraining = false;
        }
    }
    
    /**
     * Learn from a single episode's experiences (Step 2b)
     */
    async learnFromEpisode(episodeData, episodeNumber) {
        const experiences = episodeData.experiences;
        
        if (experiences.length < 10) {
            console.log(`Warning - Episode ${episodeNumber}: Only ${experiences.length} experiences, skipping learning`);
            return { loss: 0, learned: false };
        }
        
        console.log(`Learning from Episode ${episodeNumber}: ${experiences.length} experiences`);
        
        try {
            // Prepare training data from episode experiences
            const states = experiences.map(exp => exp.state);
            const actions = experiences.map(exp => exp.action);
            const rewards = experiences.map(exp => exp.reward);
            const nextStates = experiences.map(exp => exp.nextState);
            const dones = experiences.map(() => false); // Episodes don't end with terminal states
            
            // Convert to tensors
            const stateTensor = tf.tensor2d(states);
            const nextStateTensor = tf.tensor2d(nextStates);
            const actionTensor = tf.tensor1d(actions, 'int32');
            const rewardTensor = tf.tensor1d(rewards);
            
            // Calculate Q-targets using target network (DQN approach)
            const currentQValues = this.network.model.predict(stateTensor);
            const nextQValues = this.targetNetwork.model.predict(nextStateTensor);
            
            // Create targets by getting current Q-values and updating them
            const targetsData = await currentQValues.data();
            const targetsArray = Array.from(targetsData);
            const numActions = currentQValues.shape[1];
            
            // Update Q-values for taken actions using Bellman equation
            const gamma = 0.95; // Discount factor
            for (let i = 0; i < experiences.length; i++) {
                const nextQSlice = nextQValues.slice([i, 0], [1, -1]);
                const maxNextQ = await nextQSlice.max(1).data();
                const target = rewards[i] + gamma * maxNextQ[0];
                
                // Update the Q-value for the action taken in this experience
                const targetIndex = i * numActions + actions[i];
                targetsArray[targetIndex] = target;
                
                // Clean up slice tensor
                nextQSlice.dispose();
            }
            
            // Create targets tensor from updated array
            const targets = tf.tensor2d(targetsArray, currentQValues.shape);
            
            // Train the network
            const history = await this.network.model.fit(stateTensor, targets, {
                epochs: 1,
                batchSize: Math.min(this.batchSize, experiences.length),
                verbose: 0
            });
            
            const loss = history.history.loss[0];
            
            // Clean up tensors
            stateTensor.dispose();
            nextStateTensor.dispose();
            actionTensor.dispose();
            rewardTensor.dispose();
            currentQValues.dispose();
            nextQValues.dispose();
            targets.dispose();
            
            console.log(`Episode ${episodeNumber} learning complete: Loss = ${loss.toFixed(4)}`);
            
            return { loss, learned: true };
            
        } catch (error) {
            console.error(`Episode ${episodeNumber} learning failed:`, error);
            return { loss: 999, learned: false };
        }
    }
    
    /**
     * Update learning statistics (Step 2d)
     */
    updateLearningStats(episodeData, learningResult) {
        // Track losses
        if (learningResult.learned) {
            this.learningStats.episodeLosses.push(learningResult.loss);
            this.learningStats.averageLoss = this.learningStats.episodeLosses.reduce((a, b) => a + b, 0) / this.learningStats.episodeLosses.length;
        }
        
        // Track rewards
        this.learningStats.episodeRewards.push(episodeData.totalReward);
        this.learningStats.averageReward = this.learningStats.episodeRewards.reduce((a, b) => a + b, 0) / this.learningStats.episodeRewards.length;
        
        // Track best episode
        if (episodeData.totalReward > this.learningStats.bestEpisodeReward) {
            this.learningStats.bestEpisodeReward = episodeData.totalReward;
        }
        
        // Track critical points captured
        this.learningStats.episodeCPsCaptured.push(episodeData.cpsCaptured);
    }
    
    /**
     * Stop training early
     */
    stopTraining() {
        this.isTraining = false;
        if (this.episodeManager) {
            this.episodeManager.stopEpisode();
        }
        console.log('Episode-based training stopped');
    }
    
    /**
     * Get current training statistics
     */
    getStats() {
        return {
            isTraining: this.isTraining,
            totalEpisodesRun: this.totalEpisodesRun,
            network: !!this.network,
            learningStats: { ...this.learningStats },
            episodeManager: this.episodeManager ? this.episodeManager.getStatus() : null
        };
    }
}

/**
 * STEP 3: Simplified Advanced Episode Management - OpenAI Style
 * 
 * This adds advanced features to episode-based training:
 * 1. Curriculum Learning: Start easy, increase difficulty
 * 2. Population Training: Multiple learning strategies
 * 3. Self-Evaluation: Adaptive learning based on performance
 * 
 * Simplified version inspired by OpenAI's multi-agent emergence
 */
class AdvancedEpisodeManager {
    constructor() {
        this.episodeBasedTrainer = null;
        
        // Curriculum Learning
        this.curriculumLevel = 1;
        this.maxCurriculumLevel = 3;
        this.episodesPerLevel = 8; // Episodes before advancing curriculum
        this.levelEpisodeCount = 0;
        
        // Population Training
        this.populationSize = 1; // Start with 1, can expand
        this.populations = [];
        
        // Self-Evaluation
        this.performanceHistory = [];
        this.adaptiveParameters = {
            episodeLength: 10000,  // Start at 10 seconds
            learningRate: 0.0001,
            explorationRate: 0.1
        };
        
        // Learning objectives
        this.objectives = {
            minRewardThreshold: 0.5,
            minCPsPerEpisode: 1,
            consistencyWindow: 5  // Episodes to check consistency
        };
        
        console.log('Advanced Episode Manager initialized (Simplified)');
    }
    
    /**
     * Initialize with episode-based trainer
     */
    async initialize(gameManager, dataCollector) {
        console.log('Initializing Advanced Episode Management...');
        
        // Create episode-based trainer
        this.episodeBasedTrainer = new EpisodeBasedTrainer();
        await this.episodeBasedTrainer.initialize(gameManager, dataCollector);
        
        // Initialize curriculum
        this.setCurriculumLevel(1);
        
        console.log('Advanced Episode Manager ready:');
        console.log('   - Curriculum Learning: Ready (3 levels)');
        console.log('   - Population Training: Ready (adaptive)');
        console.log('   - Self-Evaluation: Ready (performance tracking)');
        
        return true;
    }
    
    /**
     * Set curriculum difficulty level (1 = easy, 3 = hard)
     */
    setCurriculumLevel(level) {
        this.curriculumLevel = Math.min(level, this.maxCurriculumLevel);
        
        switch (this.curriculumLevel) {
            case 1: // Easy: Short episodes, more reward
                this.adaptiveParameters.episodeLength = 8000;   // 8 seconds
                this.objectives.minRewardThreshold = 0.3;
                this.objectives.minCPsPerEpisode = 1;
                console.log('📚 Curriculum Level 1: Easy mode (8s episodes, low thresholds)');
                break;
                
            case 2: // Medium: Normal episodes, balanced reward
                this.adaptiveParameters.episodeLength = 12000;  // 12 seconds
                this.objectives.minRewardThreshold = 0.6;
                this.objectives.minCPsPerEpisode = 2;
                console.log('📚 Curriculum Level 2: Medium mode (12s episodes, balanced)');
                break;
                
            case 3: // Hard: Long episodes, high reward requirements
                this.adaptiveParameters.episodeLength = 15000;  // 15 seconds
                this.objectives.minRewardThreshold = 0.8;
                this.objectives.minCPsPerEpisode = 3;
                console.log('📚 Curriculum Level 3: Hard mode (15s episodes, high thresholds)');
                break;
        }
        
        this.levelEpisodeCount = 0;
    }
    
    /**
     * Evaluate if agent should advance curriculum
     */
    evaluateCurriculumProgress(episodeData) {
        this.levelEpisodeCount++;
        
        // Check if agent meets objectives for current level
        const meetsReward = episodeData.averageReward >= this.objectives.minRewardThreshold;
        const meetsCPs = episodeData.cpsCaptured >= this.objectives.minCPsPerEpisode;
        
        console.log(`Curriculum Progress (Level ${this.curriculumLevel}):`);
        console.log(`   Episodes at this level: ${this.levelEpisodeCount}/${this.episodesPerLevel}`);
        console.log(`   Reward: ${episodeData.averageReward.toFixed(3)} (need ${this.objectives.minRewardThreshold})`);
        console.log(`   CPs: ${episodeData.cpsCaptured} (need ${this.objectives.minCPsPerEpisode})`);
        
        // Advance if objectives met for enough episodes
        if (meetsReward && meetsCPs && this.levelEpisodeCount >= this.episodesPerLevel) {
            if (this.curriculumLevel < this.maxCurriculumLevel) {
                this.setCurriculumLevel(this.curriculumLevel + 1);
                console.log(`Advanced to Curriculum Level ${this.curriculumLevel}!`);
                return true;
            } else {
                console.log('Maximum curriculum level reached!');
            }
        }
        
        return false;
    }
    
    /**
     * Self-evaluate performance and adapt parameters
     */
    selfEvaluateAndAdapt(episodeData) {
        // Add to performance history
        this.performanceHistory.push({
            episode: episodeData.episode,
            reward: episodeData.averageReward,
            cps: episodeData.cpsCaptured,
            experiences: episodeData.experienceCount,
            level: this.curriculumLevel
        });
        
        // Keep only recent history
        if (this.performanceHistory.length > 20) {
            this.performanceHistory.shift();
        }
        
        // Analyze recent performance
        if (this.performanceHistory.length >= this.objectives.consistencyWindow) {
            const recentPerformance = this.performanceHistory.slice(-this.objectives.consistencyWindow);
            const avgReward = recentPerformance.reduce((sum, p) => sum + p.reward, 0) / recentPerformance.length;
            const avgCPs = recentPerformance.reduce((sum, p) => sum + p.cps, 0) / recentPerformance.length;
            
            console.log(`Self-Evaluation (last ${this.objectives.consistencyWindow} episodes):`);
            console.log(`   Average Reward: ${avgReward.toFixed(3)}`);
            console.log(`   Average CPs: ${avgCPs.toFixed(1)}`);
            
            // Adapt parameters based on performance
            if (avgReward < 0.2) {
                // Poor performance - make it easier
                this.adaptiveParameters.episodeLength = Math.max(6000, this.adaptiveParameters.episodeLength - 1000);
                console.log(`📉 Poor performance detected - reducing episode length to ${this.adaptiveParameters.episodeLength/1000}s`);
            } else if (avgReward > 0.8 && avgCPs > 2) {
                // Great performance - can handle more challenge
                this.adaptiveParameters.episodeLength = Math.min(18000, this.adaptiveParameters.episodeLength + 500);
                console.log(`Great performance detected - increasing episode length to ${this.adaptiveParameters.episodeLength/1000}s`);
            }
        }
    }
    
    /**
     * Run advanced episode-based training with curriculum and adaptation
     */
    async runAdvancedTraining(config) {
        const {
            totalEpisodes = 20,
            onEpisodeComplete,
            onCurriculumAdvance,
            onTrainingComplete
        } = config;
        
        console.log('=== ADVANCED EPISODE-BASED TRAINING ===');
        console.log('Curriculum Learning + Self-Adaptation + Population Training');
        console.log(`Training Plan: ${totalEpisodes} episodes with adaptive curriculum`);
        
        let episodeCount = 0;
        let curriculumAdvances = 0;
        
        try {
            while (episodeCount < totalEpisodes && this.episodeBasedTrainer.isTraining !== false) {
                episodeCount++;
                
                console.log(`\nAdvanced Episode ${episodeCount}/${totalEpisodes}`);
                console.log(`📚 Curriculum Level: ${this.curriculumLevel}`);
                console.log(`Episode Length: ${this.adaptiveParameters.episodeLength/1000}s`);
                
                // Run episode with current parameters
                const success = await this.episodeBasedTrainer.runEpisodeBasedTraining({
                    episodes: 1, // One episode at a time for fine control
                    episodeLength: this.adaptiveParameters.episodeLength,
                    onEpisodeComplete: async (episode, totalEpisodes, episodeData) => {
                        // Evaluate curriculum progress
                        const advanced = this.evaluateCurriculumProgress(episodeData);
                        if (advanced) {
                            curriculumAdvances++;
                            if (onCurriculumAdvance) {
                                await onCurriculumAdvance(this.curriculumLevel, episodeData);
                            }
                        }
                        
                        // Self-evaluate and adapt
                        this.selfEvaluateAndAdapt(episodeData);
                        
                        // Report to parent callback
                        if (onEpisodeComplete) {
                            await onEpisodeComplete(episodeCount, totalEpisodes, {
                                ...episodeData,
                                curriculumLevel: this.curriculumLevel,
                                adaptiveLength: this.adaptiveParameters.episodeLength,
                                performanceHistory: this.performanceHistory.slice(-5) // Recent 5
                            });
                        }
                    }
                });
                
                if (!success) {
                    throw new Error(`Episode ${episodeCount} failed`);
                }
                
                // Brief pause between episodes
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            console.log('=== ADVANCED TRAINING COMPLETED ===');
            console.log(`Episodes completed: ${episodeCount}`);
            console.log(`Curriculum advances: ${curriculumAdvances}`);
            console.log(`Final curriculum level: ${this.curriculumLevel}/${this.maxCurriculumLevel}`);
            
            if (onTrainingComplete) {
                const finalStats = {
                    episodesCompleted: episodeCount,
                    curriculumAdvances: curriculumAdvances,
                    finalCurriculumLevel: this.curriculumLevel,
                    performanceHistory: [...this.performanceHistory],
                    adaptiveParameters: { ...this.adaptiveParameters },
                    trainerStats: this.episodeBasedTrainer.getStats().learningStats
                };
                
                await onTrainingComplete(finalStats);
            }
            
            return true;
            
        } catch (error) {
            console.error('Advanced training failed:', error);
            return false;
        }
    }
    
    /**
     * Stop advanced training
     */
    stopTraining() {
        if (this.episodeBasedTrainer) {
            this.episodeBasedTrainer.stopTraining();
        }
        console.log('Advanced training stopped');
    }
    
    /**
     * Get comprehensive status
     */
    getStatus() {
        return {
            curriculumLevel: this.curriculumLevel,
            maxCurriculumLevel: this.maxCurriculumLevel,
            levelEpisodeCount: this.levelEpisodeCount,
            episodesPerLevel: this.episodesPerLevel,
            adaptiveParameters: { ...this.adaptiveParameters },
            objectives: { ...this.objectives },
            performanceHistory: this.performanceHistory.slice(-10), // Recent 10
            trainerStatus: this.episodeBasedTrainer ? this.episodeBasedTrainer.getStats() : null
        };
    }
}

// Export classes for use in other files
export { 
    DQNDataCollector, StateObserver, ActionRecorder, RewardCalculator, ExperienceBuffer,
    SimpleDQNNetwork, SimpleDQNTrainer, CompleteDQNSystem,
    ActionExecutor, SmartAgentController, DQNAgentBehavior, FullDQNSystem,
    EpisodeManager, EpisodeBasedTrainer, AdvancedEpisodeManager
};

// Create global instances
window.DQNDataCollector = DQNDataCollector;
window.SimpleDQNNetwork = SimpleDQNNetwork;
window.SimpleDQNTrainer = SimpleDQNTrainer;
window.CompleteDQNSystem = CompleteDQNSystem;
window.EpisodeManager = EpisodeManager;
window.ActionExecutor = ActionExecutor;
window.SmartAgentController = SmartAgentController;
window.DQNAgentBehavior = DQNAgentBehavior;
window.FullDQNSystem = FullDQNSystem;
window.EpisodeBasedTrainer = EpisodeBasedTrainer;
window.AdvancedEpisodeManager = AdvancedEpisodeManager;

/**
 * SimpleDQNTrainer - DEPRECATED: Use EpisodeBasedTrainer instead
 * 
 * This class used experience replay training which has been replaced
 * by episode-based training for better multi-agent learning.
 * 
 * @deprecated Use EpisodeBasedTrainer for OpenAI-style episode learning
 */
