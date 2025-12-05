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
        
        console.log(`Starting DQN training for agent ${agentIndex} (${this.getAgentColorName(agentIndex)})`);
        
        // Set agent to DQN mode (if applicable)
        if (this.trainingAgent.setMode) {
            this.trainingAgent.setMode('dqn');
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
            right: 10px;
            background: rgba(240, 240, 240, 0.95);
            border: 1px solid #ccc;
            padding: 8px;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            z-index: 1000;
            max-width: 300px;
            color: #333;
        `;
        
        statusDiv.innerHTML = `
            <div style="margin: 0 0 6px 0; font-weight: bold; font-size: 11px;">DQN Training Status</div>
            <div>Status: <span id="dqn-status">Not Started</span></div>
            <div>Episode: <span id="dqn-episode">0</span></div>
            <div>Phase: <span id="dqn-phase">-</span></div>
            <div>Avg Reward: <span id="dqn-reward">0.000</span></div>
            <div>Epsilon: <span id="dqn-epsilon">1.000</span></div>
            <div>Loss: <span id="dqn-loss">0.000</span></div>

            <div style="margin-top: 4px; font-size: 9px; border-top: 1px solid #ccc; padding-top: 4px;">
                <div style="margin-bottom: 2px; font-weight: bold;">Training:</div>
                <button id="dqn-start-btn" style="font-size: 9px; margin-right: 4px;">Start Training</button>
                <button id="dqn-stop-btn" style="font-size: 9px; margin-right: 4px;">Stop</button>
                <button id="dqn-save-btn" style="font-size: 9px;">Save Model</button>
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
            loss: document.getElementById('dqn-loss')
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
}

// Global instance for easy access
export const dqnIntegration = new DQNIntegration();

// Export for direct use
export default DQNIntegration;
