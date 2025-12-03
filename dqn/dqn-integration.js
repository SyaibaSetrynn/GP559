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
     * @param {number} agentIndex - Index of agent to train (0 = red, 1 = green, 2 = blue)
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
            
            // Get model architecture and weights
            const modelData = {
                name: modelName,
                exported: new Date().toISOString(),
                architecture: model.toJSON(),
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
            
            if (!modelData.architecture || !modelData.weights) {
                throw new Error('Invalid model JSON format');
            }
            
            // Recreate the model from architecture
            const model = tf.models.modelFromJSON(modelData.architecture);
            
            // Recreate weights
            const weightTensors = [];
            for (const weightInfo of modelData.weights) {
                const tensor = tf.tensor(weightInfo.data, weightInfo.shape);
                weightTensors.push(tensor);
            }
            
            // Set weights
            model.setWeights(weightTensors);
            
            // Save to localStorage with imported name
            const importName = modelData.name + '_imported_' + Date.now();
            await model.save(`localstorage://${importName}`);
            
            // Clean up tensors
            weightTensors.forEach(tensor => tensor.dispose());
            
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
     * Get available pretraining phases
     */
    getPretrainingPhases() {
        if (!this.isInitialized) {
            return [];
        }
        return dqnTrainer.getPretrainingPhases();
    }

    /**
     * Start pretraining for a specific agent
     * @param {number} agentIndex - Index of agent to pretrain
     * @param {number} startPhase - Phase to start from (optional)
     */
    async startPretraining(agentIndex = 0, startPhase = 0) {
        if (!this.isInitialized) {
            throw new Error('DQN integration not initialized');
        }
        
        if (!this.gameManager.agents || this.gameManager.agents.length <= agentIndex) {
            throw new Error(`Agent ${agentIndex} not found`);
        }
        
        this.trainingAgent = this.gameManager.agents[agentIndex];
        
        console.log(`Starting DQN pretraining for agent ${agentIndex} (${this.getAgentColorName(agentIndex)}) from phase ${startPhase}`);
        
        // Set agent to DQN mode
        if (this.trainingAgent.setMode) {
            this.trainingAgent.setMode('dqn');
        }
        
        // Update UI
        this.updateStatus('Pretraining Started');
        
        // Start pretraining (non-blocking)
        dqnTrainer.startPretraining(this.trainingAgent, this.gameManager, this.gameEnvironment, startPhase)
            .then(() => {
                this.updateStatus('Pretraining Complete');
                console.log('DQN pretraining completed');
            })
            .catch((error) => {
                this.updateStatus('Pretraining Error');
                console.error('DQN pretraining error:', error);
            });
    }

    /**
     * Stop pretraining
     */
    stopPretraining() {
        if (!this.isInitialized) {
            console.warn('DQN integration not initialized');
            return;
        }
        
        dqnTrainer.stopPretraining();
        this.updateStatus('Pretraining Stopped');
        console.log('DQN pretraining stopped');
    }

    /**
     * Get pretraining statistics
     */
    getPretrainingStats() {
        if (!this.isInitialized) {
            return null;
        }
        
        return dqnTrainer.getPretrainingStats();
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
            <div style="margin-top: 6px; font-size: 9px; border-top: 1px solid #ccc; padding-top: 4px;">
                <div style="margin-bottom: 2px; font-weight: bold;">Pretraining:</div>
                <button id="dqn-pretrain-btn" style="font-size: 9px; margin-right: 4px;">Start Pretraining</button>
                <button id="dqn-pretrain-stop-btn" style="font-size: 9px; margin-right: 4px;">Stop Pretrain</button>
                <select id="dqn-phase-select" style="font-size: 9px; margin-right: 4px;">
                    <option value="0">Phase 1: Basic Movement</option>
                    <option value="1">Phase 2: Map Exploration</option>
                    <option value="2">Phase 3: Critical Points</option>
                    <option value="3">Phase 4: Basic Competition</option>
                    <option value="4">Phase 5: Multi-Agent</option>
                </select>
            </div>
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
        // Pretraining controls
        const pretrainBtn = document.getElementById('dqn-pretrain-btn');
        const pretrainStopBtn = document.getElementById('dqn-pretrain-stop-btn');
        const phaseSelect = document.getElementById('dqn-phase-select');
        
        // Training controls
        const startBtn = document.getElementById('dqn-start-btn');
        const stopBtn = document.getElementById('dqn-stop-btn');
        const saveBtn = document.getElementById('dqn-save-btn');
        
        if (pretrainBtn) {
            pretrainBtn.onclick = () => {
                const startPhase = parseInt(phaseSelect.value) || 0;
                this.startPretraining(0, startPhase); // Pretrain red agent
            };
        }
        
        if (pretrainStopBtn) {
            pretrainStopBtn.onclick = () => {
                this.stopPretraining();
            };
        }
        
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
        // Check for pretraining stats first
        const pretrainingStats = this.getPretrainingStats();
        if (pretrainingStats && pretrainingStats.isActive) {
            this.updatePretrainingDisplay(pretrainingStats);
            return;
        }
        
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
     * Update UI display with pretraining information
     */
    updatePretrainingDisplay(pretrainingStats) {
        if (this.statusElements.episode) {
            this.statusElements.episode.textContent = `${pretrainingStats.currentPhase + 1}/${pretrainingStats.totalPhases}`;
        }
        
        if (this.statusElements.phase) {
            const progress = (pretrainingStats.phaseProgress * 100).toFixed(0);
            this.statusElements.phase.textContent = `${pretrainingStats.currentPhaseName} (${progress}%)`;
        }
        
        if (this.statusElements.reward) {
            const recentRewards = pretrainingStats.phaseRewards.slice(-1);
            const avgReward = recentRewards.length > 0 ? recentRewards[0] : 0;
            this.statusElements.reward.textContent = avgReward.toFixed(3);
        }
        
        if (this.statusElements.epsilon) {
            this.statusElements.epsilon.textContent = '0.500'; // Pretraining uses moderate exploration
        }
        
        if (this.statusElements.loss) {
            this.statusElements.loss.textContent = 'Pretrain';
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
        const colors = ['Red', 'Green', 'Blue', 'Yellow'];
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
