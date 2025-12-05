/**
 * DQN Integration
 * Connects the DQN training system to the existing game environment
 * 
 * This module provides a simple interface to:
 * - Initialize DQN training
 * - Start/stop training sessions  
 * - Monitor training progress
 * - Switch agents between manual/random/DQN modes
 */

import { dqnTrainer } from './dqn-trainer.js';

export class DQNIntegration {
    constructor() {
        // Integration state
        this.isInitialized = false;
        this.trainingAgent = null;
        this.gameManager = null;
        this.gameEnvironment = null;
        
        // UI elements for monitoring
        this.statusElements = {
            status: null,
            episode: null,
            reward: null,
            epsilon: null,
            loss: null
        };
        
        console.log('DQN Integration initialized');
    }

    /**
     * Initialize DQN integration with game environment
     * @param {Object} gameManager - The game's agent manager
     * @param {Object} gameEnvironment - Game environment objects
     */
    async initialize(gameManager, gameEnvironment) {
        console.log('Initializing DQN integration...');
        
        // Store references
        this.gameManager = gameManager;
        this.gameEnvironment = {
            scene: gameEnvironment.scene,
            collisionWorld: gameEnvironment.collisionWorld,
            criticalPointSystem: gameEnvironment.criticalPointSystem,
            mapLayout: gameEnvironment.mapLayout || window.mapLayout
        };
        
        // Wait for TensorFlow.js to be available
        if (typeof tf === 'undefined') {
            console.log('Waiting for TensorFlow.js to load...');
            await this.waitForTensorFlow();
        }
        
        // Initialize DQN trainer
        await dqnTrainer.initialize();
        
        // Set up UI monitoring
        this.setupUIMonitoring();
        
        this.isInitialized = true;
        console.log('DQN integration initialized successfully');
    }

    /**
     * Wait for TensorFlow.js to load
     */
    async waitForTensorFlow() {
        let attempts = 0;
        const maxAttempts = 100; // 10 seconds
        
        while (typeof tf === 'undefined' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js failed to load within timeout');
        }
        
        console.log('TensorFlow.js loaded successfully');
    }

    /**
     * Start DQN training for a specific agent
     * @param {number} agentIndex - Index of agent to train (0 = red, 1 = green)
     */
    async startTraining(agentIndex = 0) {
        if (!this.isInitialized) {
            throw new Error('DQN integration not initialized');
        }
        
        if (!this.gameManager.agents || this.gameManager.agents.length <= agentIndex) {
            throw new Error(`Agent ${agentIndex} not found`);
        }
        
        this.trainingAgent = this.gameManager.agents[agentIndex];
        
        this.trainingAgent = this.gameManager.agents[agentIndex];
        
        console.log(`Starting DQN training for agent ${agentIndex} (${this.getAgentColorName(agentIndex)})`);
        
        // Set red agent to DQN mode for neural network control
        if (this.trainingAgent && this.trainingAgent.setMode) {
            this.trainingAgent.setMode('dqn');
        }
        
        // Set green agent to training mode for competitive movement (same speed/style as red)
        if (this.gameManager.agents.length > 1 && agentIndex === 0) {
            const greenAgent = this.gameManager.agents[1];
            if (greenAgent && greenAgent.setMode) {
                greenAgent.setMode('training');
                console.log('Green agent set to training mode for competitive movement');
            }
        }
        
        // Update UI
        this.updateStatus('Training Started');
        
        // Start training (non-blocking)
        dqnTrainer.startTraining(this.trainingAgent, this.gameManager, this.gameEnvironment)
            .then(() => {
                this.updateStatus('Training Complete');
                console.log('DQN training completed');
            })
            .catch((error) => {
                this.updateStatus('Training Error');
                console.error('DQN training error:', error);
            });
    }



    /**
     * Stop DQN training
     */
    stopTraining() {
        if (!this.isInitialized) {
            console.warn('DQN integration not initialized');
            return;
        }
        
        dqnTrainer.stopTraining();
        
        // Reset both red and green agents back to random mode
        const redAgent = this.gameManager.agents[0];
        const greenAgent = this.gameManager.agents.length > 1 ? this.gameManager.agents[1] : null;
        
        if (redAgent && redAgent.setMode) {
            redAgent.setMode('random');
        }
        if (greenAgent && greenAgent.setMode) {
            greenAgent.setMode('random');
            console.log('Both red and green agents reset to random mode');
        }
        
        this.updateStatus('Training Stopped');
        console.log('DQN training stopped');
    }

    /**
     * Get training statistics
     */
    getTrainingStats() {
        if (!this.isInitialized) {
            return null;
        }
        
        return dqnTrainer.getTrainingStats();
    }

    /**
     * Save the trained model
     */
    async saveModel(name) {
        if (!this.isInitialized) {
            throw new Error('DQN integration not initialized');
        }
        
        const success = await dqnTrainer.saveModel(name);
        if (success) {
            console.log('Model saved successfully');
            this.updateStatus('Model Saved');
        } else {
            console.error('Failed to save model');
            this.updateStatus('Save Failed');
        }
        return success;
    }

    /**
     * Load a trained model
     */
    async loadModel(name) {
        if (!this.isInitialized) {
            throw new Error('DQN integration not initialized');
        }
        
        const success = await dqnTrainer.loadModel(name);
        if (success) {
            console.log('Model loaded successfully');
            this.updateStatus('Model Loaded');
        } else {
            console.error('Failed to load model');
            this.updateStatus('Load Failed');
        }
        return success;
    }

    /**
     * Export a model as JSON file for download
     */
    async exportModelAsJSON(modelName) {
        try {
            console.log(`Exporting model ${modelName} as JSON...`);
            
            // Load the model from localStorage
            const model = await tf.loadLayersModel(`localstorage://${modelName}`);
            
            // Get model architecture in the proper format for TensorFlow.js
            const modelJSON = model.toJSON();
            
            console.log('Model JSON structure:', Object.keys(modelJSON));
            console.log('Model JSON sample:', JSON.stringify(modelJSON).substring(0, 300) + '...');
            
            const modelData = {
                name: modelName,
                exported: new Date().toISOString(),
                architecture: modelJSON, // This contains the full model definition
                weights: []
            };
            
            // Extract weights
            const weights = model.getWeights();
            for (let i = 0; i < weights.length; i++) {
                const weightData = await weights[i].data();
                modelData.weights.push({
                    name: `layer_${i}`,
                    shape: weights[i].shape,
                    data: Array.from(weightData)
                });
            }
            
            // Convert to JSON string
            const jsonString = JSON.stringify(modelData, null, 2);
            
            // Create and download file
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${modelName}_export.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            console.log(`Model ${modelName} exported successfully as JSON`);
            this.updateStatus(`Model exported: ${modelName}.json`);
            
            return true;
        } catch (error) {
            console.error('Error exporting model as JSON:', error);
            this.updateStatus('Export failed');
            return false;
        }
    }

    /**
     * Import a model from JSON file
     */
    async importModelFromJSON(file) {
        try {
            console.log('Importing model from JSON file...');
            
            const jsonString = await file.text();
            const modelData = JSON.parse(jsonString);
            
            console.log('Parsed model data structure:', {
                hasArchitecture: !!modelData.architecture,
                hasWeights: !!modelData.weights,
                weightsLength: modelData.weights ? modelData.weights.length : 0
            });
            
            if (!modelData.architecture || !modelData.weights) {
                throw new Error('Invalid model JSON format - missing architecture or weights');
            }
            
            // Use a simpler approach: create the model from JSON and manually set weights
            console.log('Creating model from architecture...');
            
            // Handle different JSON formats that TensorFlow.js might produce
            let modelConfig;
            
            console.log('Architecture keys:', Object.keys(modelData.architecture));
            console.log('Architecture sample:', JSON.stringify(modelData.architecture).substring(0, 300) + '...');
            
            // Handle the direct TensorFlow.js JSON export format
            if (modelData.architecture.class_name && modelData.architecture.config) {
                // This is the standard TensorFlow.js JSON format
                modelConfig = modelData.architecture;
                console.log('Using direct TensorFlow.js JSON format (class_name + config)');
            } else if (modelData.architecture.modelTopology) {
                // Full TensorFlow.js save format
                modelConfig = modelData.architecture.modelTopology;
                console.log('Using modelTopology from architecture');
            } else if (modelData.architecture.className && modelData.architecture.config) {
                // Alternative className format
                modelConfig = modelData.architecture;
                console.log('Using className/config format');
            } else {
                // Fallback: use the architecture as-is
                modelConfig = modelData.architecture;
                console.log('Using architecture as-is (fallback)');
            }
            
            console.log('Final model config keys:', Object.keys(modelConfig));
            console.log('Final model config:', JSON.stringify(modelConfig).substring(0, 200) + '...');
            
            // Create the model using the correct TensorFlow.js approach
            let model;
            try {
                // Use tf.sequential() to create the model from layers if it's a Sequential model
                const modelType = modelConfig.class_name || modelConfig.className;
                console.log('Detected model type:', modelType);
                
                if (modelType === 'Sequential') {
                    console.log('Creating Sequential model from layers...');
                    const layers = modelConfig.config.layers;
                    
                    model = tf.sequential();
                    
                    // Add each layer to the sequential model
                    for (let i = 0; i < layers.length; i++) {
                        const layerConfig = layers[i];
                        console.log(`Adding layer ${i}: ${layerConfig.class_name}`, layerConfig.config);
                        
                        if (layerConfig.class_name === 'Dense') {
                            const denseConfig = layerConfig.config;
                            const layerOptions = {
                                units: denseConfig.units,
                                activation: denseConfig.activation,
                                useBias: denseConfig.use_bias !== false, // Default to true
                                name: denseConfig.name
                            };
                            
                            // Add input shape for first layer
                            if (i === 0 && denseConfig.batch_input_shape) {
                                layerOptions.inputShape = denseConfig.batch_input_shape.slice(1); // Remove batch dimension
                                console.log('  Input shape:', layerOptions.inputShape);
                            }
                            
                            model.add(tf.layers.dense(layerOptions));
                            console.log(`  Added Dense layer: ${denseConfig.units} units, activation: ${denseConfig.activation}`);
                        } else {
                            console.warn(`  Unsupported layer type: ${layerConfig.class_name}`);
                        }
                    }
                } else {
                    throw new Error(`Unsupported model type: ${modelType}. Only Sequential models are currently supported for import.`);
                }
                
                console.log('Model created successfully');
            } catch (modelCreationError) {
                console.error('Error creating model:', modelCreationError);
                throw new Error(`Failed to create model: ${modelCreationError.message}`);
            }
            
            // Now set the weights manually
            console.log('Creating weight tensors...');
            const weightTensors = [];
            
            for (let i = 0; i < modelData.weights.length; i++) {
                const weightInfo = modelData.weights[i];
                const tensor = tf.tensor(weightInfo.data, weightInfo.shape, 'float32');
                weightTensors.push(tensor);
            }
            
            console.log('Setting weights...');
            model.setWeights(weightTensors);
            
            // Clean up weight tensors
            weightTensors.forEach(tensor => tensor.dispose());
            
            // Save to localStorage with imported name
            const importName = modelData.name + '_imported_' + Date.now();
            console.log(`Saving model as: ${importName}`);
            
            await model.save(`localstorage://${importName}`);
            
            console.log(`Model imported successfully as ${importName}`);
            this.updateStatus(`Model imported: ${importName}`);
            
            return importName;
        } catch (error) {
            console.error('Error importing model from JSON:', error);
            this.updateStatus('Import failed');
            throw error;
        }
    }



    /**
     * Set up UI monitoring elements
     */
    setupUIMonitoring() {
        // Create DQN status display if it doesn't exist
        this.createDQNStatusDisplay();
        
        // Start monitoring loop
        this.startMonitoringLoop();
    }

    /**
     * Create DQN status display UI
     */
    createDQNStatusDisplay() {
        // Check if display already exists
        if (document.getElementById('dqn-status-display')) {
            this.connectStatusElements();
            return;
        }
        
        // Create new status display
        const statusDiv = document.createElement('div');
        statusDiv.id = 'dqn-status-display';
        statusDiv.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            right: 330px;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 8px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 9px;
            z-index: 1000;
            height: 65px;
            color: #c9d1d9;
            box-sizing: border-box;
            pointer-events: auto;
        `;
        
        statusDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 12px; height: 100%; align-items: center;">
                <!-- DQN Status Section -->
                <div style="min-width: 200px;">
                    <div style="font-weight: 600; font-size: 9px; color: #c9d1d9; margin-bottom: 4px;">DQN Status</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; font-size: 8px; margin-bottom: 3px;">
                        <div><span style="color: #8b949e;">Status:</span><br><span id="dqn-status" style="color: #f85149;">Not Started</span></div>
                        <div><span style="color: #8b949e;">Episode:</span><br><span id="dqn-episode" style="color: #c9d1d9;">0</span></div>
                        <div><span style="color: #8b949e;">Reward:</span><br><span id="dqn-reward" style="color: #3fb950;">0.00</span></div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2px;">
                        <button id="dqn-start-btn" style="padding: 2px 4px; background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 3px; cursor: pointer; font-size: 8px;">Start</button>
                        <button id="dqn-stop-btn" style="padding: 2px 4px; background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 3px; cursor: pointer; font-size: 8px;">Stop</button>
                        <button id="dqn-save-btn" style="padding: 2px 4px; background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 3px; cursor: pointer; font-size: 8px;">Save</button>
                    </div>
                </div>
                
                <!-- Red Agent State Section -->
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 9px; color: #c9d1d9; margin-bottom: 4px;">Red Agent State</div>
                    <div id="red-state-vector" style="font-family: 'Courier New', monospace; font-size: 8px; color: #f0f6fc; word-break: break-all; line-height: 1.1; background: #0d1117; padding: 4px; border-radius: 3px; border: 1px solid #58a6ff; box-shadow: 0 0 3px rgba(88, 166, 255, 0.2); white-space: pre-wrap; max-height: 32px; overflow: hidden;">[Loading...]</div>
                </div>
                
                <!-- Additional Info Section -->
                <div style="min-width: 120px; font-size: 8px;">
                    <div style="font-weight: 600; font-size: 9px; color: #c9d1d9; margin-bottom: 4px;">Agent Info</div>
                    <div style="color: #8b949e; line-height: 1.2;">
                        <div>Mode: <span id="agent-mode" style="color: #c9d1d9;">Training</span></div>
                        <div>Score: <span id="agent-score" style="color: #3fb950;">0</span></div>
                        <div>Position: <span id="agent-pos" style="color: #58a6ff;">-,-,-</span></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(statusDiv);
        
        // Connect elements and event handlers
        this.connectStatusElements();
        this.setupUIEventHandlers();
    }

    /**
     * Connect to status UI elements
     */
    connectStatusElements() {
        this.statusElements = {
            status: document.getElementById('dqn-status'),
            episode: document.getElementById('dqn-episode'),
            phase: document.getElementById('dqn-phase'),
            reward: document.getElementById('dqn-reward'),
            epsilon: document.getElementById('dqn-epsilon'),
            loss: document.getElementById('dqn-loss'),
            agentMode: document.getElementById('agent-mode'),
            agentScore: document.getElementById('agent-score'),
            agentPos: document.getElementById('agent-pos')
        };
    }

    /**
     * Set up UI event handlers
     */
    setupUIEventHandlers() {
        // Training controls
        const startBtn = document.getElementById('dqn-start-btn');
        const stopBtn = document.getElementById('dqn-stop-btn');
        const saveBtn = document.getElementById('dqn-save-btn');
        
        if (startBtn) {
            startBtn.onclick = () => {
                this.startTraining(0); // Train red agent by default
            };
        }
        
        if (stopBtn) {
            stopBtn.onclick = () => {
                this.stopTraining();
            };
        }
        
        if (saveBtn) {
            saveBtn.onclick = () => {
                this.saveModel('dqn_model_' + Date.now());
            };
        }
    }

    /**
     * Start monitoring loop to update UI
     */
    startMonitoringLoop() {
        setInterval(() => {
            if (this.isInitialized) {
                this.updateUIDisplay();
            }
        }, 1000); // Update every second
    }

    /**
     * Update UI display with current training stats
     */
    updateUIDisplay() {
        // Regular training stats
        const stats = this.getTrainingStats();
        if (!stats) return;
        
        // Update status elements
        if (this.statusElements.episode) {
            this.statusElements.episode.textContent = stats.episode.toString();
        }
        
        if (this.statusElements.phase) {
            this.statusElements.phase.textContent = 'Training';
        }
        
        if (this.statusElements.reward) {
            const recentRewards = stats.episodeRewards.slice(-10);
            const avgReward = recentRewards.length > 0 
                ? recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length 
                : 0;
            this.statusElements.reward.textContent = avgReward.toFixed(3);
        }
        
        if (this.statusElements.epsilon) {
            this.statusElements.epsilon.textContent = stats.currentEpsilon.toFixed(3);
        }
        
        if (this.statusElements.loss) {
            const recentLosses = stats.losses.slice(-10);
            const avgLoss = recentLosses.length > 0
                ? recentLosses.reduce((a, b) => a + b, 0) / recentLosses.length
                : 0;
            this.statusElements.loss.textContent = avgLoss.toFixed(3);
        }
    }



    /**
     * Update status message
     */
    updateStatus(message) {
        if (this.statusElements.status) {
            this.statusElements.status.textContent = message;
        }
        console.log(`DQN Status: ${message}`);
    }

    /**
     * Get agent color name for display
     */
    getAgentColorName(agentIndex) {
        const colors = ['Red', 'Green', 'Yellow'];
        return colors[agentIndex] || `Agent ${agentIndex}`;
    }

    /**
     * Dispose of resources
     */
    dispose() {
        if (this.isInitialized) {
            dqnTrainer.dispose();
        }
        
        // Remove UI
        const statusDisplay = document.getElementById('dqn-status-display');
        if (statusDisplay) {
            statusDisplay.remove();
        }
        
        console.log('DQN integration disposed');
    }

    /**
     * List all saved models in localStorage
     */
    async listSavedModels() {
        try {
            const models = [];
            
            // Get all localStorage keys
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                
                // Check if this is a TensorFlow.js model
                if (key && key.includes('tensorflowjs_models/') && key.endsWith('/info')) {
                    // Extract model name from key
                    const modelName = key.replace('tensorflowjs_models/', '').replace('/info', '');
                    
                    try {
                        // Try to get model info
                        const modelInfo = JSON.parse(localStorage.getItem(key));
                        models.push({
                            name: modelName,
                            dateSaved: modelInfo.dateSaved || 'Unknown',
                            modelTopology: modelInfo.modelTopology ? 'Present' : 'Missing'
                        });
                    } catch (e) {
                        // If we can't parse the info, still add the model name
                        models.push({
                            name: modelName,
                            dateSaved: 'Unknown',
                            modelTopology: 'Unknown'
                        });
                    }
                }
            }
            
            console.log('Found saved models:', models);
            return models;
        } catch (error) {
            console.error('Error listing saved models:', error);
            return [];
        }
    }

    /**
     * Update agent info display
     * @param {Object} agent - The red agent object
     */
    updateAgentInfo(agent) {
        if (!this.statusElements.agentMode) return;
        
        try {
            // Update agent mode - show "Training" for training mode, otherwise show actual mode
            let displayMode = agent.mode || 'Unknown';
            if (displayMode === 'training') {
                displayMode = 'Training';
            } else if (displayMode === 'random') {
                displayMode = 'Training'; // Show as "Training" in DQN context
            }
            this.statusElements.agentMode.textContent = displayMode;
            
            // Update agent score (from critical points or other scoring system)
            const score = agent.score || agent.points || 0;
            this.statusElements.agentScore.textContent = score.toString();
            
            // Update agent position
            if (agent.mesh && agent.mesh.position) {
                const pos = agent.mesh.position;
                this.statusElements.agentPos.textContent = `${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}`;
            }
        } catch (error) {
            console.warn('Error updating agent info:', error);
        }
    }
}

// Global instance for easy access
export const dqnIntegration = new DQNIntegration();

// Export for direct use
export default DQNIntegration;
