/**
 * DQN Training System for Critical Point Capture Game
 * Multi-agent competitive environment with line-of-sight mechanics
 * Using TensorFlow.js for in-browser training
 */

// Import TensorFlow.js (add this script tag to your HTML: <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest"></script>)

class DQNNetwork {
    /**
     * Deep Q-Network for the critical point capture game.
     */
    constructor(stateDim, actionDim, hiddenDims = [512, 256, 128]) {
        this.stateDim = stateDim;
        this.actionDim = actionDim;
        this.model = this.buildModel(stateDim, actionDim, hiddenDims);
    }

    buildModel(stateDim, actionDim, hiddenDims) {
        const model = tf.sequential();
        
        // Input layer
        model.add(tf.layers.dense({
            inputShape: [stateDim],
            units: hiddenDims[0],
            activation: 'relu',
            kernelInitializer: 'glorotUniform',
            name: 'dense_0'
        }));
        
        model.add(tf.layers.dropout({ rate: 0.2, name: 'dropout_0' }));
        
        // Hidden layers
        for (let i = 1; i < hiddenDims.length; i++) {
            model.add(tf.layers.dense({
                units: hiddenDims[i],
                activation: 'relu',
                kernelInitializer: 'glorotUniform',
                name: `dense_${i}`
            }));
            
            model.add(tf.layers.dropout({ rate: 0.2, name: `dropout_${i}` }));
        }
        
        // Output layer
        model.add(tf.layers.dense({
            units: actionDim,
            activation: 'linear',
            kernelInitializer: 'glorotUniform',
            name: 'output'
        }));
        
        return model;
    }

    predict(state, training = false) {
        return this.model.predict(state, { training });
    }

    getWeights() {
        return this.model.getWeights();
    }

    setWeights(weights) {
        this.model.setWeights(weights);
    }

    dispose() {
        this.model.dispose();
    }
}

class ReplayBuffer {
    /**
     * Experience replay buffer for DQN training.
     */
    constructor(capacity = 100000) {
        this.capacity = capacity;
        this.buffer = [];
        this.position = 0;
    }

    push(state, action, reward, nextState, done) {
        if (this.buffer.length < this.capacity) {
            this.buffer.push({});
        }
        
        this.buffer[this.position] = {
            state: state,
            action: action,
            reward: reward,
            nextState: nextState,
            done: done
        };
        
        this.position = (this.position + 1) % this.capacity;
    }

    sample(batchSize) {
        const batch = [];
        for (let i = 0; i < batchSize; i++) {
            const randomIndex = Math.floor(Math.random() * this.buffer.length);
            batch.push(this.buffer[randomIndex]);
        }
        
        const states = batch.map(exp => exp.state);
        const actions = batch.map(exp => exp.action);
        const rewards = batch.map(exp => exp.reward);
        const nextStates = batch.map(exp => exp.nextState);
        const dones = batch.map(exp => exp.done);
        
        return {
            states: tf.tensor2d(states),
            actions: tf.tensor1d(actions, 'int32'),
            rewards: tf.tensor1d(rewards),
            nextStates: tf.tensor2d(nextStates),
            dones: tf.tensor1d(dones, 'bool')
        };
    }

    size() {
        return this.buffer.length;
    }
}

class GameStateProcessor {
    /**
     * Processes game state into DQN-compatible format.
     */
    constructor(maxCriticalPoints = 50, gridSize = 15) {
        this.maxCPs = maxCriticalPoints;
        this.gridSize = gridSize;
        this.cpFeatureDim = 7; // x, y, z, color_onehot(4), available
    }

    computeStateDim() {
        const agentPos = 3; // x, y, z
        const cpFeatures = this.maxCPs * this.cpFeatureDim;
        const navGrid = this.gridSize * this.gridSize;
        const timeRemaining = 1;
        const distances = 2; // nearest_unclaimed, nearest_enemy
        
        return agentPos + cpFeatures + navGrid + timeRemaining + distances;
    }

    processState(gameState) {
        const state = [];
        console.log('=== PROCESS STATE DEBUG ===');
        
        // Agent position (normalized to [0,1])
        const agentPos = gameState.agent_position;
        const mapSize = gameState.map_size || 10;
        
        const normalizedPos = [
            (agentPos[0] + mapSize/2) / mapSize,  // x
            agentPos[1] / 5,                      // y (height)
            (agentPos[2] + mapSize/2) / mapSize   // z
        ];
        state.push(...normalizedPos);
        console.log('After agent position:', state.length, 'features');
        
        // Critical points features
        const criticalPoints = gameState.critical_points || [];
        console.log('Number of critical points:', criticalPoints.length);
        console.log('Max CPs:', this.maxCPs);
        
        for (let i = 0; i < this.maxCPs; i++) {
            if (i < criticalPoints.length) {
                const cp = criticalPoints[i];
                
                // Position (normalized)
                const cpPos = [
                    (cp.position[0] + mapSize/2) / mapSize,
                    cp.position[1] / 5,
                    (cp.position[2] + mapSize/2) / mapSize
                ];
                
                // Color (one-hot: neutral, agent1, agent2, agent3)
                const colorOnehot = [0, 0, 0, 0];
                if (cp.color !== null && cp.color !== undefined) {
                    const colorIdx = Math.min(Math.floor(cp.color) + 1, 3);
                    colorOnehot[colorIdx] = 1;
                } else {
                    colorOnehot[0] = 1; // Neutral
                }
                
                // Availability
                const available = cp.available ? 1.0 : 0.0;
                
                state.push(...cpPos, ...colorOnehot, available);
            } else {
                // Pad with zeros for missing CPs
                state.push(...new Array(this.cpFeatureDim).fill(0.0));
            }
        }
        console.log('After critical points:', state.length, 'features');
        console.log('Expected after CPs:', 3 + (this.maxCPs * this.cpFeatureDim));
        
        // Navigation grid (walls around agent)
        const navGrid = gameState.navigation_grid || new Array(this.gridSize * this.gridSize).fill(0);
        console.log('Navigation grid size:', navGrid.length);
        state.push(...navGrid);
        console.log('After navigation grid:', state.length, 'features');
        
        // Time remaining (normalized)
        const timeRemaining = gameState.time_remaining || 1.0;
        state.push(timeRemaining);
        
        // Distance to objectives
        const nearestUnclaimed = gameState.nearest_unclaimed_distance || 1.0;
        const nearestEnemy = gameState.nearest_enemy_distance || 1.0;
        state.push(nearestUnclaimed, nearestEnemy);
        console.log('After distances:', state.length, 'features');
        
        console.log('Final state length:', state.length);
        console.log('Expected state length:', this.computeStateDim());
        if (state.length !== this.computeStateDim()) {
            console.error('STATE LENGTH MISMATCH!');
            console.error('Expected:', this.computeStateDim());
            console.error('Actual:', state.length);
        }
        
        return state;
    }
}

class DQNAgent {
    /**
     * DQN Agent for critical point capture game.
     */
    constructor(options = {}) {
        // Default parameters
        const defaults = {
            stateDim: 580,
            actionDim: 5,
            learningRate: 1e-4,
            epsilonStart: 1.0,
            epsilonEnd: 0.05,
            epsilonDecay: 0.995,
            gamma: 0.99,
            targetUpdateFreq: 1000,
            batchSize: 64
        };
        
        Object.assign(this, defaults, options);
        
        this.epsilon = this.epsilonStart;
        this.stepCount = 0;
        this.lossHistory = [];
        
        // Networks
        this.qNetwork = new DQNNetwork(this.stateDim, this.actionDim);
        this.targetNetwork = new DQNNetwork(this.stateDim, this.actionDim);
        
        // Optimizer
        this.optimizer = tf.train.adam(this.learningRate);
        
        // Copy weights to target network
        this.updateTargetNetwork();
        
        // Replay buffer
        this.memory = new ReplayBuffer();
    }

    updateTargetNetwork() {
        const weights = this.qNetwork.getWeights();
        this.targetNetwork.setWeights(weights);
    }

    selectAction(state, training = true) {
        if (training && Math.random() < this.epsilon) {
            return Math.floor(Math.random() * this.actionDim);
        }
        
        const stateTensor = tf.tensor2d([state]);
        const qValues = this.qNetwork.predict(stateTensor, false);
        const action = qValues.argMax(1).dataSync()[0];
        
        stateTensor.dispose();
        qValues.dispose();
        
        return action;
    }

    storeExperience(state, action, reward, nextState, done) {
        this.memory.push(state, action, reward, nextState, done);
    }

    async trainStep() {
        if (this.memory.size() < this.batchSize) {
            return null;
        }
        
        const batch = this.memory.sample(this.batchSize);
        
        const loss = await tf.tidy(() => {
            // Current Q values
            const currentQValues = this.qNetwork.predict(batch.states, true);
            const actionIndices = tf.stack([
                tf.range(0, this.batchSize, 1, 'int32'),
                batch.actions
            ], 1);
            const currentQValuesForActions = tf.gatherND(currentQValues, actionIndices);
            
            // Target Q values
            const nextQValues = this.targetNetwork.predict(batch.nextStates, false);
            const maxNextQValues = nextQValues.max(1);
            
            // Convert boolean dones to float32 for computation
            const donesFloat = batch.dones.cast('float32');
            const targetQValues = batch.rewards.add(
                maxNextQValues.mul(tf.scalar(this.gamma)).mul(donesFloat.logicalNot().cast('float32'))
            );
            
            // Compute Huber loss
            const loss = tf.losses.huberLoss(targetQValues, currentQValuesForActions);
            
            return loss;
        });
        
        // Compute gradients and apply them
        const grads = tf.grad(f => {
            const currentQValues = this.qNetwork.predict(batch.states, true);
            const actionIndices = tf.stack([
                tf.range(0, this.batchSize, 1, 'int32'),
                batch.actions
            ], 1);
            const currentQValuesForActions = tf.gatherND(currentQValues, actionIndices);
            
            const nextQValues = this.targetNetwork.predict(batch.nextStates, false);
            const maxNextQValues = nextQValues.max(1);
            const donesFloat = batch.dones.cast('float32');
            const targetQValues = batch.rewards.add(
                maxNextQValues.mul(tf.scalar(this.gamma)).mul(donesFloat.logicalNot().cast('float32'))
            );
            
            return tf.losses.huberLoss(targetQValues, currentQValuesForActions);
        })(this.qNetwork.model.trainableWeights);
        
        // Apply gradients with clipping
        const clippedGrads = grads.map(grad => tf.clipByNorm(grad, 1.0));
        this.optimizer.applyGradients(
            clippedGrads.map((grad, i) => ({
                value: grad,
                name: this.qNetwork.model.trainableWeights[i].name
            }))
        );
        
        // Dispose tensors
        batch.states.dispose();
        batch.actions.dispose();
        batch.rewards.dispose();
        batch.nextStates.dispose();
        batch.dones.dispose();
        grads.forEach(grad => grad.dispose());
        clippedGrads.forEach(grad => grad.dispose());
        
        // Update epsilon
        this.epsilon = Math.max(this.epsilonEnd, this.epsilon * this.epsilonDecay);
        
        // Update target network
        this.stepCount++;
        if (this.stepCount % this.targetUpdateFreq === 0) {
            this.updateTargetNetwork();
        }
        
        const lossValue = await loss.data();
        this.lossHistory.push(lossValue[0]);
        loss.dispose();
        
        return lossValue[0];
    }

    // Removed save/load functionality - agents train in memory only

    dispose() {
        this.qNetwork.dispose();
        this.targetNetwork.dispose();
    }
}

class GameEnvironment {
    /**
     * Interface between DQN and the JavaScript game.
     */
    constructor(gameManager, maxEpisodeSteps = 3000) {
        this.gameManager = gameManager;
        this.maxEpisodeSteps = maxEpisodeSteps;
        this.currentStep = 0;
        this.processor = new GameStateProcessor();
        this.previousOwnedPoints = {};
        this.previousPositions = {};
        
        // Action mapping
        this.actions = {
            0: "strafe_left",
            1: "strafe_right", 
            2: "move_forward",
            3: "move_backward",
            4: "stay"
        };
    }

    reset() {
        this.currentStep = 0;
        this.previousOwnedPoints = {};
        this.previousPositions = {};
        
        // Reset the game
        if (this.gameManager && this.gameManager.resetEpisode) {
            this.gameManager.resetEpisode();
        }
        
        const initialState = this.getCurrentGameState();
        return this.processor.processState(initialState);
    }

    step(action, agentId = 0) {
        this.currentStep++;
        
        // Execute action in the game
        if (this.gameManager && this.gameManager.executeAgentAction) {
            this.gameManager.executeAgentAction(agentId, this.actions[action]);
        }
        
        // Get new state from game
        const newState = this.getCurrentGameState();
        const processedState = this.processor.processState(newState);
        
        // Calculate reward
        const reward = this.calculateReward(newState, agentId);
        
        // Check if episode is done
        const done = (this.currentStep >= this.maxEpisodeSteps || 
                     (newState.time_remaining !== undefined && newState.time_remaining <= 0));
        
        const info = {
            step: this.currentStep,
            owned_points: newState.agent_owned_points ? newState.agent_owned_points[agentId] || 0 : 0,
            total_points: newState.critical_points ? newState.critical_points.length : 0,
            epsilon: 0.1 // This will be updated by the training manager
        };
        
        return { state: processedState, reward, done, info };
    }

    getCurrentGameState() {
        // This should interface with your actual game state
        // For now, return a mock state - replace this with actual game integration
        if (this.gameManager && this.gameManager.getGameState) {
            return this.gameManager.getGameState();
        }
        
        // Mock state for testing
        return {
            agent_position: [0.0, 1.0, 0.0],
            critical_points: [
                {
                    position: [1.0, 1.0, 1.0],
                    color: null,
                    available: true
                },
                {
                    position: [-1.0, 1.0, -1.0], 
                    color: 1,
                    available: false
                }
            ],
            agent_owned_points: {0: 0, 1: 1, 2: 0},
            time_remaining: 0.8,
            navigation_grid: new Array(15 * 15).fill(0),
            nearest_unclaimed_distance: 0.5,
            nearest_enemy_distance: 0.7,
            map_size: 10
        };
    }

    calculateReward(state, agentId) {
        let reward = 0.0;
        
        // Get current owned points
        const currentOwned = state.agent_owned_points ? (state.agent_owned_points[agentId] || 0) : 0;
        const previousOwned = this.previousOwnedPoints[agentId] || 0;
        
        // Point capture/loss reward
        const pointChange = currentOwned - previousOwned;
        if (pointChange > 0) {
            reward += 1.0 * pointChange; // +1 per point gained
        } else if (pointChange < 0) {
            reward += -1.0 * Math.abs(pointChange); // -1 per point lost
        }
        
        this.previousOwnedPoints[agentId] = currentOwned;
        
        // Movement rewards (proximity to objectives)
        const currentPosition = state.agent_position;
        
        if (this.previousPositions[agentId]) {
            const proximityReward = this.getProximityReward(
                currentPosition, 
                this.previousPositions[agentId], 
                state.critical_points, 
                agentId
            );
            reward += proximityReward;
        }
        
        this.previousPositions[agentId] = [...currentPosition];
        
        // Small time penalty to encourage urgency
        reward -= 0.01;
        
        // Clip reward to reasonable range
        return Math.max(-5.0, Math.min(5.0, reward));
    }

    getProximityReward(currentPos, prevPos, criticalPoints, agentId) {
        if (!criticalPoints || criticalPoints.length === 0) {
            return 0.0;
        }
        
        const unclaimedPoints = [];
        const enemyPoints = [];
        
        for (const cp of criticalPoints) {
            if (cp.color === null || cp.color === undefined) {
                unclaimedPoints.push(cp.position);
            } else if (cp.color !== agentId) {
                enemyPoints.push(cp.position);
            }
        }
        
        let reward = 0.0;
        
        // Reward for moving closer to unclaimed points
        if (unclaimedPoints.length > 0) {
            const minPrevDist = Math.min(...unclaimedPoints.map(p => this.distance(prevPos, p)));
            const minCurrDist = Math.min(...unclaimedPoints.map(p => this.distance(currentPos, p)));
            reward += 0.1 * (minPrevDist - minCurrDist);
        }
        
        // Higher reward for moving closer to enemy points
        if (enemyPoints.length > 0) {
            const minPrevDist = Math.min(...enemyPoints.map(p => this.distance(prevPos, p)));
            const minCurrDist = Math.min(...enemyPoints.map(p => this.distance(currentPos, p)));
            reward += 0.2 * (minPrevDist - minCurrDist);
        }
        
        return reward;
    }

    distance(p1, p2) {
        return Math.sqrt(
            (p1[0] - p2[0]) ** 2 + 
            (p1[1] - p2[1]) ** 2 + 
            (p1[2] - p2[2]) ** 2
        );
    }
}

class TrainingManager {
    /**
     * Manages the overall training process.
     */
    constructor(gameManager, options = {}) {
        const defaults = {
            numAgents: 3,
            savePrefix: "dqn_agent"
        };
        
        Object.assign(this, defaults, options);
        
        // Initialize environment and agents
        this.env = new GameEnvironment(gameManager);
        const stateDim = this.env.processor.computeStateDim();
        
        this.agents = [];
        for (let i = 0; i < this.numAgents; i++) {
            const agent = new DQNAgent({ stateDim });
            this.agents.push(agent);
        }
        
        // Training metrics
        this.episodeRewards = {};
        this.episodeLengths = [];
        this.isTraining = false;
        
        for (let i = 0; i < this.numAgents; i++) {
            this.episodeRewards[i] = [];
        }
    }

    async train(options = {}) {
        const defaults = {
            numEpisodes: 1000,
            saveInterval: 100,
            evalInterval: 50
        };
        
        const config = Object.assign(defaults, options);
        
        console.log(`Starting training for ${config.numEpisodes} episodes...`);
        console.log(`State dimension: ${this.env.processor.computeStateDim()}`);
        console.log(`Number of agents: ${this.numAgents}`);
        
        this.isTraining = true;
        
        for (let episode = 0; episode < config.numEpisodes && this.isTraining; episode++) {
            const episodeRewards = await this.runEpisode(true);
            
            // Log progress
            if (episode % 10 === 0) {
                const avgRewards = [];
                for (let i = 0; i < this.numAgents; i++) {
                    const recent = this.episodeRewards[i].slice(-10);
                    avgRewards[i] = recent.length > 0 ? 
                        recent.reduce((a, b) => a + b, 0) / recent.length : 0;
                }
                const epsilons = this.agents.map(agent => agent.epsilon);
                
                console.log(`Episode ${episode}`);
                console.log(`  Avg Rewards: ${avgRewards.map(r => r.toFixed(2))}`);
                console.log(`  Epsilons: ${epsilons.map(e => e.toFixed(3))}`);
            }
            
            // Evaluation
            if (episode % config.evalInterval === 0 && episode > 0) {
                await this.evaluate(5);
            }
            
            // Training progress - no model saving needed
            
            // Allow UI updates
            await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        console.log("Training completed!");
        
        // Output trained weights to console
        await this.outputWeightsToConsole();
        
        this.isTraining = false;
    }

    async runEpisode(training = true) {
        let states = {};
        const episodeRewards = {};
        
        for (let i = 0; i < this.numAgents; i++) {
            episodeRewards[i] = [];
        }
        
        // Reset environment
        const initialState = this.env.reset();
        for (let agentId = 0; agentId < this.numAgents; agentId++) {
            states[agentId] = [...initialState];
        }
        
        let done = false;
        let step = 0;
        
        while (!done && step < 1000) {
            // Each agent takes an action
            const actions = {};
            for (let agentId = 0; agentId < this.numAgents; agentId++) {
                actions[agentId] = this.agents[agentId].selectAction(states[agentId], training);
            }
            
            // Execute actions
            const nextStates = {};
            const rewards = {};
            
            for (let agentId = 0; agentId < this.numAgents; agentId++) {
                const result = this.env.step(actions[agentId], agentId);
                nextStates[agentId] = result.state;
                rewards[agentId] = result.reward;
                done = result.done; // Use the same done flag for all agents
                episodeRewards[agentId].push(result.reward);
                
                // Store experience and train
                if (training) {
                    this.agents[agentId].storeExperience(
                        states[agentId], 
                        actions[agentId], 
                        result.reward, 
                        result.state, 
                        result.done
                    );
                    
                    // Train after some initial experiences
                    if (this.agents[agentId].memory.size() > 1000) {
                        await this.agents[agentId].trainStep();
                    }
                }
            }
            
            states = nextStates;
            step++;
        }
        
        // Store episode metrics
        for (let agentId = 0; agentId < this.numAgents; agentId++) {
            const totalReward = episodeRewards[agentId].reduce((a, b) => a + b, 0);
            this.episodeRewards[agentId].push(totalReward);
        }
        
        this.episodeLengths.push(step);
        
        return episodeRewards;
    }

    async evaluate(numEpisodes = 10) {
        console.log(`\n--- Evaluation over ${numEpisodes} episodes ---`);
        
        const evalRewards = {};
        for (let i = 0; i < this.numAgents; i++) {
            evalRewards[i] = [];
        }
        
        for (let episode = 0; episode < numEpisodes; episode++) {
            const episodeRewards = await this.runEpisode(false);
            for (let agentId = 0; agentId < this.numAgents; agentId++) {
                const totalReward = episodeRewards[agentId].reduce((a, b) => a + b, 0);
                evalRewards[agentId].push(totalReward);
            }
        }
        
        // Print results
        for (let agentId = 0; agentId < this.numAgents; agentId++) {
            const rewards = evalRewards[agentId];
            const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
            const variance = rewards.reduce((a, b) => a + (b - avgReward) ** 2, 0) / rewards.length;
            const stdReward = Math.sqrt(variance);
            console.log(`  Agent ${agentId}: ${avgReward.toFixed(2)} ± ${stdReward.toFixed(2)}`);
        }
        
        console.log("--- End Evaluation ---\n");
    }

    // Removed save functionality - agents train in memory only
    
    async outputWeightsToConsole() {
        console.log('\n=== TRAINED DQN WEIGHTS ===');
        console.log('Training completed! Here are the trained weights:');
        
        for (let agentId = 0; agentId < this.numAgents; agentId++) {
            try {
                console.log(`\n--- Agent ${agentId} Weights ---`);
                
                // Get Q-network weights
                const qWeights = this.agents[agentId].qNetwork.model.getWeights();
                const qWeightData = await Promise.all(qWeights.map(async (weight) => {
                    const data = await weight.data();
                    return {
                        shape: weight.shape,
                        values: Array.from(data)
                    };
                }));
                
                console.log(`Agent ${agentId} Q-Network Weights:`, qWeightData);
                console.log(`Agent ${agentId} Epsilon:`, this.agents[agentId].epsilon);
                console.log(`Agent ${agentId} Step Count:`, this.agents[agentId].stepCount);
                
                // Also log training metrics for this agent
                const recentRewards = this.episodeRewards[agentId].slice(-10);
                const avgReward = recentRewards.length > 0 ? 
                    recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length : 0;
                console.log(`Agent ${agentId} Average Reward (last 10 episodes):`, avgReward.toFixed(3));
                
                // Dispose of the weight tensors to free memory
                qWeights.forEach(w => w.dispose());
                
            } catch (error) {
                console.error(`Error extracting weights for agent ${agentId}:`, error);
            }
        }
        
        console.log('\n=== TRAINING STATISTICS ===');
        console.log('Total episodes completed:', this.episodeLengths.length);
        console.log('Average episode length:', 
            this.episodeLengths.reduce((a, b) => a + b, 0) / this.episodeLengths.length);
        
        console.log('\n=== END TRAINED WEIGHTS ===');
        console.log('You can copy these weights from the console if needed.');
    }

    stopTraining() {
        this.isTraining = false;
    }

    dispose() {
        for (const agent of this.agents) {
            agent.dispose();
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DQNAgent, TrainingManager, GameEnvironment, GameStateProcessor };
}
