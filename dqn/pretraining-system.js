/**
 * DQN Pretraining System
 * Implements curriculum-based pretraining in phases to teach agents basic behaviors
 * before full competitive training.
 */

export class PretrainingSystem {
    constructor() {
        this.phases = [];
        this.currentPhase = 0;
        this.phaseProgress = 0;
        this.isPretraining = false;
        this.dqnTrainerRef = null; // Reference to DQN trainer for experience storage
        this.pretrainingStats = {
            currentPhase: 0,
            phaseProgress: 0,
            totalPhases: 0,
            phaseStartTime: 0,
            totalPretrainingTime: 0,
            phaseRewards: [],
            phaseSuccessRates: []
        };
        
        this.initializePhases();
        console.log('Pretraining system initialized with', this.phases.length, 'phases');
    }

    /**
     * Initialize pretraining phases with increasing complexity
     */
    initializePhases() {
        this.phases = [
            {
                name: "Basic Movement",
                description: "Learn to move around the map without getting stuck",
                episodes: 50,
                maxSteps: 200,
                rewardConfig: {
                    movement: 1.0,
                    stuck: -5.0,
                    exploration: 2.0,
                    wallCollision: -1.0
                },
                successCriteria: {
                    minAvgReward: 10.0,
                    minSuccessRate: 0.6
                },
                environmentConfig: {
                    enableEnemies: false,
                    enableCriticalPoints: false,
                    simplifiedMap: true
                }
            },
            {
                name: "Map Exploration",
                description: "Learn to explore the entire map systematically",
                episodes: 75,
                maxSteps: 300,
                rewardConfig: {
                    movement: 0.5,
                    exploration: 5.0,
                    newArea: 10.0,
                    coverage: 3.0,
                    stuck: -5.0
                },
                successCriteria: {
                    minAvgReward: 25.0,
                    minSuccessRate: 0.7,
                    minCoverage: 0.6
                },
                environmentConfig: {
                    enableEnemies: false,
                    enableCriticalPoints: true,
                    criticalPointReward: 0.0 // Don't reward CP capture yet
                }
            },
            {
                name: "Critical Point Awareness",
                description: "Learn to find and approach critical points",
                episodes: 100,
                maxSteps: 400,
                rewardConfig: {
                    movement: 0.3,
                    exploration: 3.0,
                    cpApproach: 15.0,
                    cpProximity: 5.0,
                    cpCapture: 20.0
                },
                successCriteria: {
                    minAvgReward: 40.0,
                    minSuccessRate: 0.75,
                    minCpVisited: 3
                },
                environmentConfig: {
                    enableEnemies: false,
                    enableCriticalPoints: true,
                    highlightCriticalPoints: true
                }
            },
            {
                name: "Basic Competition",
                description: "Learn to compete with one passive opponent",
                episodes: 150,
                maxSteps: 500,
                rewardConfig: {
                    movement: 0.2,
                    exploration: 2.0,
                    cpCapture: 25.0,
                    cpDefense: 15.0,
                    winReward: 100.0
                },
                successCriteria: {
                    minAvgReward: 60.0,
                    minSuccessRate: 0.8,
                    minWinRate: 0.3
                },
                environmentConfig: {
                    enableEnemies: true,
                    enemyCount: 1,
                    enemyDifficulty: 'easy'
                }
            },
            {
                name: "Multi-Agent Competition",
                description: "Learn to compete with multiple opponents",
                episodes: 200,
                maxSteps: 600,
                rewardConfig: {
                    movement: 0.1,
                    exploration: 1.5,
                    cpCapture: 30.0,
                    cpDefense: 20.0,
                    strategicPosition: 10.0,
                    winReward: 150.0
                },
                successCriteria: {
                    minAvgReward: 80.0,
                    minSuccessRate: 0.85,
                    minWinRate: 0.25
                },
                environmentConfig: {
                    enableEnemies: true,
                    enemyCount: 2,
                    enemyDifficulty: 'medium'
                }
            }
        ];

        this.pretrainingStats.totalPhases = this.phases.length;
    }

    /**
     * Start pretraining from a specific phase
     */
    async startPretraining(agent, gameManager, gameEnvironment, startPhase = 0, dqnTrainerRef = null) {
        console.log(`Starting pretraining from phase ${startPhase}`);
        
        this.isPretraining = true;
        this.currentPhase = startPhase;
        this.dqnTrainerRef = dqnTrainerRef;
        this.pretrainingStats.currentPhase = startPhase;
        this.pretrainingStats.totalPretrainingTime = Date.now();
        
        try {
            for (let phaseIndex = startPhase; phaseIndex < this.phases.length; phaseIndex++) {
                const success = await this.runPhase(phaseIndex, agent, gameManager, gameEnvironment);
                
                if (!success) {
                    console.log(`Phase ${phaseIndex} failed, stopping pretraining`);
                    break;
                }
                
                if (!this.isPretraining) {
                    console.log('Pretraining stopped by user');
                    break;
                }
            }
            
            if (this.isPretraining) {
                console.log('Pretraining completed successfully!');
                this.pretrainingStats.totalPretrainingTime = Date.now() - this.pretrainingStats.totalPretrainingTime;
            }
            
        } catch (error) {
            console.error('Pretraining error:', error);
        } finally {
            this.isPretraining = false;
        }
    }

    /**
     * Run a single pretraining phase
     */
    async runPhase(phaseIndex, agent, gameManager, gameEnvironment) {
        const phase = this.phases[phaseIndex];
        console.log(`\n=== Starting Phase ${phaseIndex + 1}: ${phase.name} ===`);
        console.log(`Description: ${phase.description}`);
        console.log(`Episodes: ${phase.episodes}, Max Steps: ${phase.maxSteps}`);
        
        this.currentPhase = phaseIndex;
        this.phaseProgress = 0;
        this.pretrainingStats.currentPhase = phaseIndex;
        this.pretrainingStats.phaseProgress = 0;
        this.pretrainingStats.phaseStartTime = Date.now();
        
        // Configure environment for this phase
        this.configureEnvironmentForPhase(phase, gameManager, gameEnvironment);
        
        // Configure rewards for this phase
        this.configureRewardsForPhase(phase, gameEnvironment);
        
        // Training variables
        let episodeRewards = [];
        let successCount = 0;
        let episodeStats = [];
        
        // Run episodes for this phase
        for (let episode = 0; episode < phase.episodes; episode++) {
            if (!this.isPretraining) break;
            
            const episodeResult = await this.runPhaseEpisode(
                episode, phase, agent, gameManager, gameEnvironment
            );
            
            episodeRewards.push(episodeResult.totalReward);
            episodeStats.push(episodeResult);
            
            if (this.evaluateEpisodeSuccess(episodeResult, phase)) {
                successCount++;
            }
            
            // Update progress
            this.phaseProgress = (episode + 1) / phase.episodes;
            this.pretrainingStats.phaseProgress = this.phaseProgress;
            
            // Log progress periodically
            if ((episode + 1) % 10 === 0) {
                const avgReward = episodeRewards.slice(-10).reduce((a, b) => a + b, 0) / 10;
                const successRate = successCount / (episode + 1);
                console.log(`Phase ${phaseIndex + 1} - Episode ${episode + 1}/${phase.episodes}: Avg Reward: ${avgReward.toFixed(2)}, Success Rate: ${(successRate * 100).toFixed(1)}%`);
            }
        }
        
        // Evaluate phase completion
        const avgReward = episodeRewards.reduce((a, b) => a + b, 0) / episodeRewards.length;
        const successRate = successCount / phase.episodes;
        const phaseSuccess = this.evaluatePhaseSuccess(avgReward, successRate, episodeStats, phase);
        
        // Store phase results
        this.pretrainingStats.phaseRewards.push(avgReward);
        this.pretrainingStats.phaseSuccessRates.push(successRate);
        
        console.log(`\n=== Phase ${phaseIndex + 1} Results ===`);
        console.log(`Average Reward: ${avgReward.toFixed(2)}`);
        console.log(`Success Rate: ${(successRate * 100).toFixed(1)}%`);
        console.log(`Phase Success: ${phaseSuccess ? 'PASS' : 'FAIL'}`);
        
        if (phaseSuccess) {
            console.log(`✅ Phase ${phaseIndex + 1} completed successfully!`);
        } else {
            console.log(`❌ Phase ${phaseIndex + 1} failed to meet success criteria`);
        }
        
        return phaseSuccess;
    }

    /**
     * Run a single episode within a phase
     */
    async runPhaseEpisode(episode, phase, agent, gameManager, gameEnvironment) {
        // Reset environment
        gameManager.resetAgentsToCorners();
        gameEnvironment.criticalPointSystem.resetAllCriticalPoints();
        
        let totalReward = 0;
        let stepCount = 0;
        let episodeStats = {
            episode: episode,
            totalReward: 0,
            steps: 0,
            cpVisited: 0,
            cpCaptured: 0,
            coverage: 0,
            stuck: false,
            won: false
        };
        
        let prevState = null;
        let prevAction = null;
        
        // Episode loop
        for (let step = 0; step < phase.maxSteps; step++) {
            if (!this.isPretraining) break;
            
            // Get current state
            const state = gameEnvironment.gameStateExtractor.extractState(agent, gameManager, gameEnvironment);
            
            // Agent takes action (through DQN trainer)
            const action = await this.getAgentAction(agent, state);
            
            // Execute action
            const prevPosition = { x: agent.x, y: agent.y, z: agent.z };
            this.executeAction(agent, action);
            
            // Calculate step reward
            const stepReward = this.calculatePhaseReward(
                agent, prevPosition, action, phase, gameManager, gameEnvironment, episodeStats
            );
            
            totalReward += stepReward;
            stepCount++;
            
            // Store experience if we have a previous state
            if (prevState !== null && prevAction !== null && this.dqnTrainerRef) {
                const done = this.checkPhaseEpisodeTermination(agent, phase, episodeStats);
                await this.dqnTrainerRef.trainDuringPretraining(
                    prevState, prevAction, stepReward, state, done
                );
            }
            
            prevState = state;
            prevAction = action;
            
            // Check for episode termination conditions
            if (this.checkPhaseEpisodeTermination(agent, phase, episodeStats)) {
                break;
            }
            
            // Small delay to prevent overwhelming
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        episodeStats.totalReward = totalReward;
        episodeStats.steps = stepCount;
        
        return episodeStats;
    }

    /**
     * Configure environment settings for a specific phase
     */
    configureEnvironmentForPhase(phase, gameManager, gameEnvironment) {
        const config = phase.environmentConfig;
        
        // Configure enemy agents
        if (config.enableEnemies && gameManager.agents.length > 1) {
            // Set enemy behavior based on phase
            for (let i = 1; i < gameManager.agents.length; i++) {
                const enemy = gameManager.agents[i];
                if (config.enemyDifficulty === 'easy') {
                    enemy.setMode('random');
                } else if (config.enemyDifficulty === 'medium') {
                    enemy.setMode('moderate');
                } else {
                    enemy.setMode('aggressive');
                }
            }
        } else {
            // Disable enemy agents
            for (let i = 1; i < gameManager.agents.length; i++) {
                gameManager.agents[i].setMode('passive');
            }
        }
        
        // Configure critical points
        if (config.enableCriticalPoints) {
            gameEnvironment.criticalPointSystem.setEnabled(true);
            
            if (config.highlightCriticalPoints) {
                // Make CPs more visible during training
                gameEnvironment.criticalPointSystem.criticalPoints.forEach(cpData => {
                    if (cpData.cp && cpData.cp.material) {
                        cpData.cp.material.emissive.setHex(0x333333);
                    }
                });
            }
        } else {
            gameEnvironment.criticalPointSystem.setEnabled(false);
        }
        
        console.log(`Environment configured for phase: ${phase.name}`);
    }

    /**
     * Configure reward system for a specific phase
     */
    configureRewardsForPhase(phase, gameEnvironment) {
        if (gameEnvironment.rewardSystem && gameEnvironment.rewardSystem.updateConfig) {
            gameEnvironment.rewardSystem.updateConfig(phase.rewardConfig);
            console.log(`Rewards configured for phase: ${phase.name}`);
        }
    }

    /**
     * Get agent action (placeholder - will be implemented by DQN trainer)
     */
    async getAgentAction(agent, state) {
        // This will be overridden by the actual DQN trainer
        // For now, return a random action
        return Math.floor(Math.random() * 8); // 8 possible actions
    }

    /**
     * Execute action on agent
     */
    executeAction(agent, action) {
        // Map action to movement
        const actionMap = {
            0: { dx: 0, dy: 0, dz: 1 },   // Forward
            1: { dx: 0, dy: 0, dz: -1 },  // Backward
            2: { dx: -1, dy: 0, dz: 0 },  // Left
            3: { dx: 1, dy: 0, dz: 0 },   // Right
            4: { dx: -1, dy: 0, dz: 1 },  // Forward-Left
            5: { dx: 1, dy: 0, dz: 1 },   // Forward-Right
            6: { dx: -1, dy: 0, dz: -1 }, // Backward-Left
            7: { dx: 1, dy: 0, dz: -1 }   // Backward-Right
        };
        
        const movement = actionMap[action] || { dx: 0, dy: 0, dz: 0 };
        const speed = 0.5;
        
        agent.x += movement.dx * speed;
        agent.z += movement.dz * speed;
        
        // Update agent position in 3D scene
        if (agent.mesh) {
            agent.mesh.position.set(agent.x, agent.y, agent.z);
        }
    }

    /**
     * Calculate reward for a step within a phase
     */
    calculatePhaseReward(agent, prevPosition, action, phase, gameManager, gameEnvironment, episodeStats) {
        let reward = 0;
        const config = phase.rewardConfig;
        
        // Movement reward
        const moved = (prevPosition.x !== agent.x || prevPosition.z !== agent.z);
        if (moved && config.movement) {
            reward += config.movement;
        }
        
        // Exploration reward
        if (config.exploration) {
            const explorationReward = this.calculateExplorationReward(agent, gameEnvironment);
            reward += explorationReward * config.exploration;
        }
        
        // Critical point rewards
        if (config.cpApproach || config.cpProximity || config.cpCapture) {
            const cpReward = this.calculateCriticalPointReward(agent, gameEnvironment, episodeStats, config);
            reward += cpReward;
        }
        
        // Penalty for being stuck
        if (!moved && config.stuck) {
            reward += config.stuck;
            episodeStats.stuck = true;
        }
        
        return reward;
    }

    /**
     * Calculate exploration-based rewards
     */
    calculateExplorationReward(agent, gameEnvironment) {
        // Simple exploration reward based on distance from starting position
        const startX = agent.startingPosition?.x || 0;
        const startZ = agent.startingPosition?.z || 0;
        const distance = Math.sqrt((agent.x - startX) ** 2 + (agent.z - startZ) ** 2);
        
        return Math.min(distance / 10, 5); // Cap at 5 reward units
    }

    /**
     * Calculate critical point related rewards
     */
    calculateCriticalPointReward(agent, gameEnvironment, episodeStats, config) {
        let reward = 0;
        
        if (!gameEnvironment.criticalPointSystem) return reward;
        
        // Find nearest critical point
        let nearestCP = null;
        let nearestDistance = Infinity;
        
        gameEnvironment.criticalPointSystem.criticalPoints.forEach(cpData => {
            if (cpData.cp) {
                const distance = Math.sqrt(
                    (agent.x - cpData.cp.position.x) ** 2 +
                    (agent.z - cpData.cp.position.z) ** 2
                );
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestCP = cpData;
                }
            }
        });
        
        if (nearestCP) {
            // Proximity reward
            if (config.cpProximity && nearestDistance < 5) {
                reward += config.cpProximity * (5 - nearestDistance) / 5;
            }
            
            // Approach reward (getting closer)
            if (config.cpApproach && nearestDistance < 3) {
                reward += config.cpApproach;
                episodeStats.cpVisited++;
            }
            
            // Capture reward
            if (config.cpCapture && nearestDistance < 1.5) {
                reward += config.cpCapture;
                episodeStats.cpCaptured++;
            }
        }
        
        return reward;
    }

    /**
     * Check if episode should terminate
     */
    checkPhaseEpisodeTermination(agent, phase, episodeStats) {
        // Phase-specific termination conditions
        switch (phase.name) {
            case "Basic Movement":
                // Terminate if agent gets badly stuck
                return episodeStats.stuck && episodeStats.steps > 50;
                
            case "Critical Point Awareness":
                // Terminate if captured enough CPs
                return episodeStats.cpCaptured >= 2;
                
            case "Basic Competition":
            case "Multi-Agent Competition":
                // Terminate if won/lost decisively
                return episodeStats.won || episodeStats.steps > phase.maxSteps * 0.8;
                
            default:
                return false;
        }
    }

    /**
     * Evaluate if an episode was successful
     */
    evaluateEpisodeSuccess(episodeResult, phase) {
        switch (phase.name) {
            case "Basic Movement":
                return episodeResult.totalReward > 5 && !episodeResult.stuck;
                
            case "Map Exploration":
                return episodeResult.totalReward > 15 && episodeResult.steps > 100;
                
            case "Critical Point Awareness":
                return episodeResult.cpVisited >= 2 && episodeResult.totalReward > 30;
                
            case "Basic Competition":
                return episodeResult.totalReward > 40 || episodeResult.won;
                
            case "Multi-Agent Competition":
                return episodeResult.totalReward > 60 || episodeResult.won;
                
            default:
                return episodeResult.totalReward > 10;
        }
    }

    /**
     * Evaluate if a phase was completed successfully
     */
    evaluatePhaseSuccess(avgReward, successRate, episodeStats, phase) {
        const criteria = phase.successCriteria;
        
        let success = true;
        
        if (criteria.minAvgReward && avgReward < criteria.minAvgReward) {
            success = false;
        }
        
        if (criteria.minSuccessRate && successRate < criteria.minSuccessRate) {
            success = false;
        }
        
        if (criteria.minCoverage) {
            // Calculate average coverage across episodes
            const avgCoverage = episodeStats.reduce((sum, ep) => sum + (ep.coverage || 0), 0) / episodeStats.length;
            if (avgCoverage < criteria.minCoverage) {
                success = false;
            }
        }
        
        if (criteria.minCpVisited) {
            const avgCpVisited = episodeStats.reduce((sum, ep) => sum + ep.cpVisited, 0) / episodeStats.length;
            if (avgCpVisited < criteria.minCpVisited) {
                success = false;
            }
        }
        
        if (criteria.minWinRate) {
            const winRate = episodeStats.reduce((sum, ep) => sum + (ep.won ? 1 : 0), 0) / episodeStats.length;
            if (winRate < criteria.minWinRate) {
                success = false;
            }
        }
        
        return success;
    }

    /**
     * Stop pretraining
     */
    stopPretraining() {
        this.isPretraining = false;
        console.log('Pretraining stopped');
    }

    /**
     * Get pretraining statistics
     */
    getPretrainingStats() {
        return {
            ...this.pretrainingStats,
            isActive: this.isPretraining,
            currentPhaseName: this.phases[this.currentPhase]?.name || 'Unknown',
            currentPhaseDescription: this.phases[this.currentPhase]?.description || ''
        };
    }

    /**
     * Get phase information
     */
    getPhaseInfo(phaseIndex) {
        return this.phases[phaseIndex] || null;
    }

    /**
     * Get all phases information
     */
    getAllPhases() {
        return this.phases.map((phase, index) => ({
            index,
            name: phase.name,
            description: phase.description,
            episodes: phase.episodes,
            maxSteps: phase.maxSteps
        }));
    }
}

// Export singleton instance
export const pretrainingSystem = new PretrainingSystem();
