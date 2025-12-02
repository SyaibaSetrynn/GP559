/**
 * DQN Neural Network
 * Simple Deep Q-Network implementation using TensorFlow.js
 * 
 * Architecture:
 * - Input: Game state vector (from game-state-extractor.js)
 * - Hidden layers: Dense layers with ReLU activation
 * - Output: Q-values for each action (from action-space.js)
 */

// TensorFlow.js will be loaded from CDN in the HTML
// This assumes tf is available globally

export class DQNNetwork {
    constructor(config = {}) {
        // Network architecture configuration
        this.config = {
            stateSize: config.stateSize || 8,           // Input size (state vector length)
            actionSize: config.actionSize || 4,         // Output size (number of actions)
            hiddenLayers: config.hiddenLayers || [64, 32], // Hidden layer sizes
            learningRate: config.learningRate || 0.001, // Adam optimizer learning rate
            activation: config.activation || 'relu',    // Hidden layer activation
            outputActivation: config.outputActivation || 'linear' // Output activation
        };
        
        // Network models
        this.mainNetwork = null;        // Primary network for action selection
        this.targetNetwork = null;      // Target network for stable training
        
        // Training configuration
        this.trainingConfig = {
            batchSize: config.batchSize || 32,
            targetUpdateFreq: config.targetUpdateFreq || 100, // Update target network every N steps
            gamma: config.gamma || 0.99,    // Discount factor
            clipNorm: config.clipNorm || 1.0 // Gradient clipping
        };
        
        // Training state
        this.trainingStep = 0;
        this.isInitialized = false;
        
        console.log('DQN Network initialized with config:', this.config);
    }

    /**
     * Initialize the neural networks
     * Must be called after TensorFlow.js is loaded
     */
    async initialize() {
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js not loaded. Please load tf before initializing DQN.');
        }
        
        console.log('Building DQN networks...');
        
        // Build main network
        this.mainNetwork = this.buildNetwork('main');
        
        // Build target network (same architecture)
        this.targetNetwork = this.buildNetwork('target');
        
        // Set initialized flag first
        this.isInitialized = true;
        
        // Copy weights from main to target network
        await this.updateTargetNetwork();
        console.log('DQN networks initialized successfully');
        console.log('Main network:', this.mainNetwork.summary());
    }

    /**
     * Build a neural network with the specified architecture
     * @param {string} name - Network name for identification
     * @returns {tf.Sequential} TensorFlow.js sequential model
     */
    buildNetwork(name) {
        const model = tf.sequential({
            name: `dqn_${name}_network`
        });
        
        // Input layer
        model.add(tf.layers.dense({
            inputShape: [this.config.stateSize],
            units: this.config.hiddenLayers[0],
            activation: this.config.activation,
            name: `${name}_input_dense`
        }));
        
        // Hidden layers
        for (let i = 1; i < this.config.hiddenLayers.length; i++) {
            model.add(tf.layers.dense({
                units: this.config.hiddenLayers[i],
                activation: this.config.activation,
                name: `${name}_hidden_${i}`
            }));
        }
        
        // Output layer (Q-values for each action)
        model.add(tf.layers.dense({
            units: this.config.actionSize,
            activation: this.config.outputActivation,
            name: `${name}_output`
        }));
        
        // Compile with Adam optimizer
        model.compile({
            optimizer: tf.train.adam(this.config.learningRate),
            loss: 'meanSquaredError',
            metrics: ['mse']
        });
        
        return model;
    }

    /**
     * Predict Q-values for a given state
     * @param {Array|tf.Tensor} state - Game state vector
     * @param {boolean} useTarget - Use target network instead of main network
     * @returns {Promise<Array>} Q-values for each action
     */
    async predict(state, useTarget = false) {
        if (!this.isInitialized) {
            throw new Error('DQN not initialized. Call initialize() first.');
        }
        
        const network = useTarget ? this.targetNetwork : this.mainNetwork;
        
        // Convert state to tensor if needed
        const stateTensor = Array.isArray(state) ? 
            tf.tensor2d([state]) : 
            state.expandDims(0);
        
        try {
            const prediction = network.predict(stateTensor);
            const qValues = await prediction.data();
            
            // Clean up tensors
            stateTensor.dispose();
            prediction.dispose();
            
            return Array.from(qValues);
        } catch (error) {
            console.error('Error during prediction:', error);
            stateTensor.dispose();
            throw error;
        }
    }

    /**
     * Select action using epsilon-greedy policy
     * @param {Array} state - Game state vector
     * @param {number} epsilon - Exploration rate (0-1)
     * @returns {Promise<number>} Selected action ID
     */
    async selectAction(state, epsilon = 0.1) {
        // Exploration: random action
        if (Math.random() < epsilon) {
            return Math.floor(Math.random() * this.config.actionSize);
        }
        
        // Exploitation: action with highest Q-value
        const qValues = await this.predict(state);
        return qValues.indexOf(Math.max(...qValues));
    }

    /**
     * Train the network on a batch of experiences
     * @param {Array} batch - Array of {state, action, reward, nextState, done} experiences
     * @returns {Promise<Object>} Training metrics
     */
    async trainBatch(batch) {
        if (!this.isInitialized) {
            throw new Error('DQN not initialized. Call initialize() first.');
        }
        
        if (batch.length === 0) {
            return { loss: 0, metrics: {} };
        }
        
        console.log(`Training on batch of ${batch.length} experiences...`);
        
        try {
            // Prepare training data
            const states = batch.map(exp => exp.state);
            const actions = batch.map(exp => exp.action);
            const rewards = batch.map(exp => exp.reward);
            const nextStates = batch.map(exp => exp.nextState);
            const dones = batch.map(exp => exp.done);
            
            // Validate and clean data
            const cleanStates = states.map(state => 
                Array.isArray(state) ? state.map(v => Number(v) || 0) : []
            );
            const cleanNextStates = nextStates.map(state => 
                Array.isArray(state) ? state.map(v => Number(v) || 0) : []
            );
            
            // Convert to tensors
            const statesTensor = tf.tensor2d(cleanStates);
            const nextStatesTensor = tf.tensor2d(cleanNextStates);
            
            // Get current Q-values and next Q-values
            const currentQValues = this.mainNetwork.predict(statesTensor);
            const nextQValues = this.targetNetwork.predict(nextStatesTensor);
            
            // Calculate target Q-values using Bellman equation
            const currentQData = await currentQValues.data();
            const nextQData = await nextQValues.data();
            const targetQValues = Array.from(currentQData);
            
            for (let i = 0; i < batch.length; i++) {
                const actionIndex = actions[i];
                const reward = rewards[i];
                const done = dones[i];
                
                let targetValue = reward;
                if (!done) {
                    // Get max Q-value from next state
                    const nextStateStart = i * this.config.actionSize;
                    const nextStateEnd = nextStateStart + this.config.actionSize;
                    const nextStateQValues = Array.from(nextQData.slice(nextStateStart, nextStateEnd));
                    const maxNextQ = Math.max(...nextStateQValues);
                    targetValue += this.trainingConfig.gamma * maxNextQ;
                }
                
                // Update the Q-value for the taken action
                const qIndex = i * this.config.actionSize + actionIndex;
                targetQValues[qIndex] = targetValue;
            }
            
            const targetTensor = tf.tensor2d(targetQValues, [batch.length, this.config.actionSize]);
            
            // Train the network
            const history = await this.mainNetwork.fit(statesTensor, targetTensor, {
                epochs: 1,
                batchSize: this.trainingConfig.batchSize,
                verbose: 0,
                validationSplit: 0
            });
            
            // Clean up tensors
            statesTensor.dispose();
            nextStatesTensor.dispose();
            currentQValues.dispose();
            nextQValues.dispose();
            targetTensor.dispose();
            
            // Update training step and target network if needed
            this.trainingStep++;
            if (this.trainingStep % this.trainingConfig.targetUpdateFreq === 0) {
                await this.updateTargetNetwork();
                console.log(`Target network updated at step ${this.trainingStep}`);
            }
            
            const loss = history.history.loss[0];
            return {
                loss: loss,
                step: this.trainingStep,
                targetUpdated: this.trainingStep % this.trainingConfig.targetUpdateFreq === 0
            };
            
        } catch (error) {
            console.error('Error during batch training:', error);
            throw error;
        }
    }

    /**
     * Update target network weights with main network weights
     */
    async updateTargetNetwork() {
        if (!this.isInitialized) {
            throw new Error('DQN not initialized. Call initialize() first.');
        }
        
        const mainWeights = this.mainNetwork.getWeights();
        this.targetNetwork.setWeights(mainWeights);
        
        console.log('Target network weights updated');
    }

    /**
     * Save the model to browser storage or download
     * @param {string} name - Model name for saving
     */
    async saveModel(name = 'dqn_model') {
        if (!this.isInitialized) {
            throw new Error('DQN not initialized. Call initialize() first.');
        }
        
        try {
            await this.mainNetwork.save(`localstorage://${name}`);
            console.log(`Model saved as ${name}`);
            return true;
        } catch (error) {
            console.error('Error saving model:', error);
            return false;
        }
    }

    /**
     * Load a model from browser storage
     * @param {string} name - Model name to load
     */
    async loadModel(name = 'dqn_model') {
        try {
            this.mainNetwork = await tf.loadLayersModel(`localstorage://${name}`);
            
            // Rebuild target network and update it
            this.targetNetwork = this.buildNetwork('target');
            await this.updateTargetNetwork();
            
            this.isInitialized = true;
            console.log(`Model loaded from ${name}`);
            return true;
        } catch (error) {
            console.error('Error loading model:', error);
            return false;
        }
    }

    /**
     * Get network information and statistics
     * @returns {Object} Network information
     */
    getNetworkInfo() {
        return {
            config: { ...this.config },
            trainingConfig: { ...this.trainingConfig },
            trainingStep: this.trainingStep,
            isInitialized: this.isInitialized,
            memoryUsage: this.isInitialized ? {
                mainNetwork: this.mainNetwork.countParams(),
                targetNetwork: this.targetNetwork.countParams(),
                totalParams: this.mainNetwork.countParams() * 2
            } : null
        };
    }

    /**
     * Dispose of all tensors and models to free memory
     */
    dispose() {
        if (this.mainNetwork) {
            this.mainNetwork.dispose();
            this.mainNetwork = null;
        }
        if (this.targetNetwork) {
            this.targetNetwork.dispose();
            this.targetNetwork = null;
        }
        this.isInitialized = false;
        console.log('DQN networks disposed');
    }
}

// Export for direct use
export default DQNNetwork;
