/**
 * DQN Trainer
 * Main training orchestrator that connects all DQN components
 * 
 * Integrates:
 * - DQN Network (neural network)
 * - Experience Replay (memory buffer)
 * - Action Space (action selection and execution)
 * - Reward System (reward calculation)
 * - Game State Extractor (state representation)
 */

import DQNNetwork from './dqn-network.js';
import { experienceReplay } from './experience-replay.js';
import { actionSpace } from './action-space.js';
import { rewardSystem } from './reward-system.js';
import { gameStateExtractor } from './game-state-extractor.js';

export class DQNTrainer {
    constructor(config = {}) {
        // Training configuration
        this.config = {
            // Network configuration
            stateSize: config.stateSize || 10,
            actionSize: config.actionSize || 4,
            hiddenLayers: config.hiddenLayers || [64, 32],
            learningRate: config.learningRate || 0.001,
            
            // Training parameters
            batchSize: config.batchSize || 32,
            targetUpdateFreq: config.targetUpdateFreq || 100,
            gamma: config.gamma || 0.99,
            
            // Exploration parameters
            epsilonStart: config.epsilonStart || 1.0,
            epsilonEnd: config.epsilonEnd || 0.01,
            epsilonDecay: config.epsilonDecay || 0.995,
            
            // Training schedule
            trainingStartSize: config.trainingStartSize || 1000,  // Start training after N experiences
            trainingFreq: config.trainingFreq || 4,              // Train every N steps
            
            // Episode management
            maxEpisodeLength: config.maxEpisodeLength || 1000,   // Max steps per episode
            maxEpisodes: config.maxEpisodes || 10000             // Total episodes to train
        };
        
        // Components
        this.network = null;
        this.experienceReplay = experienceReplay;
        this.actionSpace = actionSpace;
        this.rewardSystem = rewardSystem;
        this.gameStateExtractor = gameStateExtractor;
        
        // Training state
        this.currentEpsilon = this.config.epsilonStart;
        this.episode = 0;
        this.totalSteps = 0;
        this.isTraining = false;
        this.isInitialized = false;
        
        // Statistics
        this.stats = {
            episodeRewards: [],
            episodeLengths: [],
            losses: [],
            epsilonHistory: [],
            lastEpisodeStats: null
        };
        
        console.log('DQN Trainer initialized with config:', this.config);
    }

    /**
     * Initialize the DQN trainer and all components
     * Must be called after TensorFlow.js is loaded
     */
    async initialize() {
        console.log('Initializing DQN trainer...');
        
        // Initialize DQN network
        this.network = new DQNNetwork({
            stateSize: this.config.stateSize,
            actionSize: this.config.actionSize,
            hiddenLayers: this.config.hiddenLayers,
            learningRate: this.config.learningRate,
            batchSize: this.config.batchSize,
            targetUpdateFreq: this.config.targetUpdateFreq,
            gamma: this.config.gamma
        });
        
        await this.network.initialize();
        
        // Reset experience replay
        this.experienceReplay.clear();
        
        // Reset reward system episode state
        this.rewardSystem.resetEpisode();
        
        this.isInitialized = true;
        console.log('DQN trainer initialized successfully');
    }

    /**
     * Start training process
     * @param {Agent} agent - The agent to train
     * @param {Object} gameManager - Game manager instance
     * @param {Object} gameEnvironment - Game environment (scene, collisionWorld, etc.)
     */
    async startTraining(agent, gameManager, gameEnvironment) {
        if (!this.isInitialized) {
            throw new Error('DQN trainer not initialized. Call initialize() first.');
        }
        
        console.log('Starting DQN training...');
        this.isTraining = true;
        
        // Training loop
        while (this.episode < this.config.maxEpisodes && this.isTraining) {
            await this.runEpisode(agent, gameManager, gameEnvironment);
            this.episode++;
            
            // Decay epsilon
            this.currentEpsilon = Math.max(
                this.config.epsilonEnd,
                this.currentEpsilon * this.config.epsilonDecay
            );
            
            this.stats.epsilonHistory.push(this.currentEpsilon);
            
            // Log progress
            if (this.episode % 100 === 0) {
                this.logTrainingProgress();
            }
        }
        
        console.log('Training completed');
        this.isTraining = false;
    }

    /**
     * Run a single training episode
     */
    async runEpisode(agent, gameManager, gameEnvironment) {
        // Reset environment for new episode
        this.resetEnvironment(agent, gameManager, gameEnvironment);
        
        let episodeReward = 0;
        let episodeLength = 0;
        let previousState = null;
        let previousAction = null;
        
        // Episode loop
        for (let step = 0; step < this.config.maxEpisodeLength; step++) {
            // Get current state
            const currentState = this.getCurrentState(agent, gameManager, gameEnvironment);
            const stateVector = this.gameStateExtractor.getMinimalStateVector(
                agent, gameManager, gameEnvironment.mapLayout, gameEnvironment.criticalPointSystem
            );
            
            // Select action
            const actionId = await this.network.selectAction(stateVector, this.currentEpsilon);
            
            // Store experience from previous step
            if (previousState !== null && previousAction !== null) {
                const experience = {
                    state: previousState,
                    action: previousAction,
                    reward: 0, // Will be calculated below
                    nextState: stateVector,
                    done: false
                };
                
                // Calculate reward for the previous action
                const rewardResult = this.rewardSystem.calculateReward(
                    agent, previousAction, 
                    { state: previousState }, 
                    currentState,
                    { success: true }, // TODO: Get actual action result
                    { gameEnded: false }
                );
                
                experience.reward = rewardResult.reward;
                episodeReward += experience.reward;
                
                // Store experience
                this.experienceReplay.storeExperience(
                    experience.state, 
                    experience.action, 
                    experience.reward, 
                    experience.nextState, 
                    experience.done, 
                    agent.agentId
                );
            }
            
            // Execute action
            const actionResult = this.executeAction(agent, actionId, gameEnvironment);
            
            // Update counters
            episodeLength++;
            this.totalSteps++;
            
            // Train network periodically
            if (this.shouldTrain()) {
                await this.trainNetwork();
            }
            
            // Check for episode termination
            if (this.isEpisodeComplete(agent, gameManager, step)) {
                // Store final experience
                if (previousState !== null) {
                    const finalReward = this.calculateFinalReward(agent, gameManager);
                    const finalExperience = {
                        state: stateVector,
                        action: actionId,
                        reward: finalReward,
                        nextState: stateVector, // Terminal state
                        done: true
                    };
                    this.experienceReplay.storeExperience(
                        finalExperience.state,
                        finalExperience.action,
                        finalExperience.reward,
                        finalExperience.nextState,
                        finalExperience.done,
                        agent.agentId
                    );
                    episodeReward += finalReward;
                }
                break;
            }
            
            // Prepare for next iteration
            previousState = stateVector;
            previousAction = actionId;
            
            // Small delay to prevent overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Record episode statistics
        this.stats.episodeRewards.push(episodeReward);
        this.stats.episodeLengths.push(episodeLength);
        this.stats.lastEpisodeStats = {
            episode: this.episode,
            reward: episodeReward,
            length: episodeLength,
            epsilon: this.currentEpsilon,
            totalSteps: this.totalSteps
        };
        
        // Reset reward system for next episode
        this.rewardSystem.resetEpisode();
    }

    /**
     * Get current game state for the agent
     */
    getCurrentState(agent, gameManager, gameEnvironment) {
        return this.gameStateExtractor.getCompleteState(
            agent, gameManager, gameEnvironment.mapLayout, gameEnvironment.criticalPointSystem
        );
    }

    /**
     * Execute an action in the environment
     */
    executeAction(agent, actionId, gameEnvironment) {
        return this.actionSpace.executeAction(actionId, agent);
    }

    /**
     * Check if network should be trained this step
     */
    shouldTrain() {
        return (
            this.experienceReplay.getBufferSize() >= this.config.trainingStartSize &&
            this.totalSteps % this.config.trainingFreq === 0
        );
    }

    /**
     * Train the neural network on a batch of experiences
     */
    async trainNetwork() {
        const batch = this.experienceReplay.sampleBatch(this.config.batchSize);
        if (batch.length === 0) return;
        
        try {
            const trainingResult = await this.network.trainBatch(batch);
            this.stats.losses.push(trainingResult.loss);
            
            if (trainingResult.loss > 0) {
                console.log(`Training step ${this.totalSteps}: loss = ${trainingResult.loss.toFixed(4)}`);
            }
        } catch (error) {
            console.error('Error during network training:', error);
        }
    }

    /**
     * Reset environment for new episode
     */
    resetEnvironment(agent, gameManager, gameEnvironment) {
        // Reset agent position to starting corner
        const startingPositions = [
            { x: -4, y: 1, z: -4 }, // Red agent - back left corner
            { x: 4, y: 1, z: -4 },  // Green agent - back right corner  
            { x: -4, y: 1, z: 4 },  // Blue agent - front left corner
            { x: 4, y: 1, z: 4 }    // Extra corner - front right corner
        ];
        
        const agentIndex = gameManager.agents.indexOf(agent);
        const startPos = startingPositions[agentIndex % startingPositions.length];
        
        // Reset agent
        if (agent.mesh) {
            agent.mesh.position.set(startPos.x, startPos.y, startPos.z);
        }
        if (agent.camera) {
            agent.camera.position.set(startPos.x, startPos.y, startPos.z);
        }
        if (agent.collider) {
            agent.collider.start.set(startPos.x, startPos.y - 0.25, startPos.z);
            agent.collider.end.set(startPos.x, startPos.y + 0.25, startPos.z);
        }
        
        // Reset scores and state
        if (agent.claimedCriticalPoints) {
            agent.claimedCriticalPoints.clear();
        }
        if (agent.testScore !== undefined) {
            agent.testScore = 0;
        }
        
        // Reset ALL agents to starting positions (for fair multi-agent environment)
        gameManager.agents.forEach((otherAgent, index) => {
            if (otherAgent === agent) return; // Already reset above
            
            const otherStartPos = startingPositions[index % startingPositions.length];
            
            if (otherAgent.mesh) {
                otherAgent.mesh.position.set(otherStartPos.x, otherStartPos.y, otherStartPos.z);
            }
            if (otherAgent.camera) {
                otherAgent.camera.position.set(otherStartPos.x, otherStartPos.y, otherStartPos.z);
            }
            if (otherAgent.collider) {
                otherAgent.collider.start.set(otherStartPos.x, otherStartPos.y - 0.25, otherStartPos.z);
                otherAgent.collider.end.set(otherStartPos.x, otherStartPos.y + 0.25, otherStartPos.z);
            }
            if (otherAgent.claimedCriticalPoints) {
                otherAgent.claimedCriticalPoints.clear();
            }
            if (otherAgent.testScore !== undefined) {
                otherAgent.testScore = 0;
            }
        });
        
        // Reset critical points to neutral state
        const criticalPointSystem = gameEnvironment.criticalPointSystem;
        if (criticalPointSystem && criticalPointSystem.criticalPoints) {
            criticalPointSystem.criticalPoints.forEach(cpData => {
                if (cpData.cp && cpData.cp.material) {
                    // Reset to original/neutral color
                    cpData.cp.material.color.setHex(cpData.originalColor || 0xffffff);
                    cpData.cp.material.opacity = 0.8;
                    
                    // Reset any glow children
                    if (cpData.cp.children && cpData.cp.children.length > 0) {
                        cpData.cp.children.forEach(child => {
                            if (child.material) {
                                child.material.color.setHex(cpData.originalColor || 0xffffff);
                            }
                        });
                    }
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
            
            // Reset registry ownership
            if (criticalPointSystem.cpsByOwner) {
                criticalPointSystem.cpsByOwner.clear();
            }
            
            // Reset registry states
            if (criticalPointSystem.cpRegistry) {
                criticalPointSystem.cpRegistry.forEach((cpData, id) => {
                    cpData.ownedBy = null;
                    cpData.isActivelyClaimed = false;
                    cpData.claimedBy = null;
                    cpData.lastClaimedTime = 0;
                    if (cpData.claimHistory) {
                        cpData.claimHistory = [];
                    }
                });
            }
        }
        
        console.log(`Episode reset: Agent ${agent.agentId} and all CPs returned to start state`);
    }

    /**
     * Check if episode is complete
     */
    isEpisodeComplete(agent, gameManager, step) {
        // Episode ends if max length reached
        if (step >= this.config.maxEpisodeLength - 1) {
            return true;
        }
        
        // TODO: Add other termination conditions
        // - All critical points claimed
        // - Agent stuck for too long
        // - Game-specific win conditions
        
        return false;
    }

    /**
     * Calculate final reward for episode termination
     */
    calculateFinalReward(agent, gameManager) {
        // TODO: Calculate based on final game state
        const score = agent.getScore ? agent.getScore() : 0;
        return score > 0 ? 1.0 : 0.0; // Simple win/lose reward
    }

    /**
     * Stop training
     */
    stopTraining() {
        this.isTraining = false;
        console.log('Training stopped');
    }

    /**
     * Log training progress
     */
    logTrainingProgress() {
        const recentRewards = this.stats.episodeRewards.slice(-100);
        const avgReward = recentRewards.length > 0 
            ? recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length 
            : 0;
            
        const recentLengths = this.stats.episodeLengths.slice(-100);
        const avgLength = recentLengths.length > 0
            ? recentLengths.reduce((a, b) => a + b, 0) / recentLengths.length
            : 0;
            
        console.log(`Episode ${this.episode}: avg_reward=${avgReward.toFixed(3)}, avg_length=${avgLength.toFixed(1)}, epsilon=${this.currentEpsilon.toFixed(3)}`);
    }

    /**
     * Get training statistics
     */
    getTrainingStats() {
        return {
            ...this.stats,
            config: this.config,
            episode: this.episode,
            totalSteps: this.totalSteps,
            currentEpsilon: this.currentEpsilon,
            isTraining: this.isTraining,
            experienceBufferSize: this.experienceReplay.getBufferSize()
        };
    }

    /**
     * Save the trained model
     */
    async saveModel(name = 'dqn_trained_model') {
        if (!this.network) {
            throw new Error('No network to save');
        }
        return await this.network.saveModel(name);
    }

    /**
     * Load a trained model
     */
    async loadModel(name = 'dqn_trained_model') {
        if (!this.network) {
            await this.initialize();
        }
        return await this.network.loadModel(name);
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        this.stopTraining();
        if (this.network) {
            this.network.dispose();
        }
        this.experienceReplay.clear();
        console.log('DQN trainer disposed');
    }
}

// Global instance for easy access
export const dqnTrainer = new DQNTrainer();

// Export for direct use
export default DQNTrainer;
