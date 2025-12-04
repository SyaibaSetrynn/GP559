/**
 * Simplified DQN Pretraining System
 * Easy-to-understand curriculum learning with clear phases
 */

export class SimplePretrainingSystem {
    constructor() {
        this.currentPhase = 0;
        this.isActive = false;
        this.phases = this.createPhases();
        this.stats = {
            phase: 0,
            episode: 0,
            progress: 0,
            rewards: [],
            phaseResults: []
        };
        
        console.log('Simple Pretraining System initialized with', this.phases.length, 'phases');
    }

    /**
     * Create simple, clear pretraining phases
     */
    createPhases() {
        return [
            {
                name: "Learn to Move",
                description: "Basic movement without getting stuck",
                episodes: 5,  // Reduced for testing
                maxSteps: 50, // Reduced for testing
                
                // Simple rewards for this phase
                getReward: (agent, prevPos, gameEnv, stepInfo) => {
                    let reward = 0;
                    
                    // Reward for moving
                    const moved = (prevPos.x !== agent.x || prevPos.z !== agent.z);
                    if (moved) reward += 1.0;
                    
                    // Penalty for not moving (getting stuck)
                    if (!moved) reward -= 2.0;
                    
                    // Small exploration bonus
                    const distance = Math.sqrt(agent.x ** 2 + agent.z ** 2);
                    reward += distance * 0.1;
                    
                    return reward;
                },
                
                // Simple success check
                isEpisodeSuccessful: (totalReward, steps) => {
                    return totalReward > 5 && steps > 50; // Must move and not get stuck
                },
                
                // Environment setup
                setupEnvironment: (gameManager, gameEnv, system) => {
                    // Disable enemies and CPs for basic movement learning
                    system.setEnemiesActive(gameManager, false);
                    system.setCriticalPointsActive(gameEnv, false);
                }
            },
            
            {
                name: "Explore the Map",
                description: "Learn to explore different areas of the map",
                episodes: 5,  // Reduced for testing
                maxSteps: 75, // Reduced for testing
                
                getReward: (agent, prevPos, gameEnv, stepInfo) => {
                    let reward = 0;
                    
                    // Small movement reward
                    const moved = (prevPos.x !== agent.x || prevPos.z !== agent.z);
                    if (moved) reward += 0.5;
                    
                    // Big exploration reward - encourage going to new areas
                    const distance = Math.sqrt(agent.x ** 2 + agent.z ** 2);
                    reward += Math.min(distance * 0.5, 10); // Cap at 10
                    
                    // Track how far agent has traveled
                    if (!stepInfo.maxDistance) stepInfo.maxDistance = 0;
                    if (distance > stepInfo.maxDistance) {
                        stepInfo.maxDistance = distance;
                        reward += 5; // Bonus for reaching new max distance
                    }
                    
                    return reward;
                },
                
                isEpisodeSuccessful: (totalReward, steps, stepInfo) => {
                    return totalReward > 20 && (stepInfo.maxDistance || 0) > 15;
                },
                
                setupEnvironment: (gameManager, gameEnv, system) => {
                    system.setEnemiesActive(gameManager, false);
                    system.setCriticalPointsActive(gameEnv, true); // Show CPs but don't reward yet
                }
            },
            
            {
                name: "Find Critical Points",
                description: "Learn to approach and capture critical points",
                episodes: 5,   // Reduced for testing
                maxSteps: 100, // Reduced for testing
                
                getReward: (agent, prevPos, gameEnv, stepInfo, system) => {
                    let reward = 0;
                    
                    // Small movement reward
                    const moved = (prevPos.x !== agent.x || prevPos.z !== agent.z);
                    if (moved) reward += 0.2;
                    
                    // Find nearest CP and reward getting closer
                    const nearestCP = system.findNearestCriticalPoint(agent, gameEnv);
                    if (nearestCP) {
                        const distance = nearestCP.distance;
                        
                        // Reward being close to CP
                        if (distance < 10) {
                            reward += (10 - distance) * 2; // Closer = more reward
                        }
                        
                        // Big reward for capturing CP
                        if (distance < 2) {
                            reward += 20;
                            stepInfo.cpsCaptured = (stepInfo.cpsCaptured || 0) + 1;
                        }
                    }
                    
                    return reward;
                },
                
                isEpisodeSuccessful: (totalReward, steps, stepInfo) => {
                    return totalReward > 40 && (stepInfo.cpsCaptured || 0) >= 1;
                },
                
                setupEnvironment: (gameManager, gameEnv, system) => {
                    system.setEnemiesActive(gameManager, false);
                    system.setCriticalPointsActive(gameEnv, true);
                }
            },
            
            {
                name: "Basic Competition",
                description: "Learn to compete with one opponent",
                episodes: 5,   // Reduced for testing
                maxSteps: 150, // Reduced for testing
                
                getReward: (agent, prevPos, gameEnv, stepInfo, system) => {
                    let reward = 0;
                    
                    // Small movement reward
                    const moved = (prevPos.x !== agent.x || prevPos.z !== agent.z);
                    if (moved) reward += 0.1;
                    
                    // CP capture rewards
                    const nearestCP = system.findNearestCriticalPoint(agent, gameEnv);
                    if (nearestCP && nearestCP.distance < 2) {
                        reward += 25; // Higher reward in competition
                    }
                    
                    // Win condition bonus
                    const ownedCPs = system.countOwnedCriticalPoints(agent, gameEnv);
                    if (ownedCPs >= 3) {
                        reward += 100; // Big bonus for winning
                        stepInfo.won = true;
                    }
                    
                    return reward;
                },
                
                isEpisodeSuccessful: (totalReward, steps, stepInfo) => {
                    return totalReward > 60 || stepInfo.won;
                },
                
                setupEnvironment: (gameManager, gameEnv, system) => {
                    system.setEnemiesActive(gameManager, true, 1, 'easy'); // 1 easy enemy
                    system.setCriticalPointsActive(gameEnv, true);
                }
            }
        ];
    }

    /**
     * Start pretraining from a specific phase
     */
    async startPretraining(agent, gameManager, gameEnvironment, dqnTrainer, startPhase = 0) {
        console.log(`🚀 Starting Simple Pretraining from Phase ${startPhase + 1}...`);
        console.log('📋 Input validation:', {
            agent: !!agent,
            gameManager: !!gameManager,
            gameEnvironment: !!gameEnvironment,
            dqnTrainer: !!dqnTrainer,
            startPhase,
            totalPhases: this.phases.length
        });
        
        this.isActive = true;
        this.currentPhase = startPhase;
        this.stats = { phase: startPhase, episode: 0, progress: 0, rewards: [], phaseResults: [] };
        
        // Add a small delay to ensure we can see the start
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('⏰ Initial delay completed, starting phases...');
        
        try {
            // Run each phase in sequence
            for (let phaseIndex = startPhase; phaseIndex < this.phases.length; phaseIndex++) {
                console.log(`🔄 About to start phase ${phaseIndex + 1}, isActive: ${this.isActive}`);
                
                if (!this.isActive) {
                    console.log('⏹️ Pretraining stopped by user');
                    break;
                }
                
                console.log(`▶️ Starting runPhase(${phaseIndex})...`);
                const startTime = Date.now();
                
                const success = await this.runPhase(phaseIndex, agent, gameManager, gameEnvironment, dqnTrainer);
                
                const duration = Date.now() - startTime;
                console.log(`⏱️ Phase ${phaseIndex + 1} took ${duration}ms, success: ${success}`);
                
                if (success) {
                    console.log(`✅ Phase ${phaseIndex + 1} completed successfully!`);
                    this.stats.phaseResults.push({ phase: phaseIndex, success: true });
                } else {
                    console.log(`❌ Phase ${phaseIndex + 1} failed. Stopping pretraining.`);
                    this.stats.phaseResults.push({ phase: phaseIndex, success: false });
                    break;
                }
                
                // Small delay between phases
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            if (this.isActive) {
                console.log('🎉 Pretraining completed successfully!');
            }
            
        } catch (error) {
            console.error('❌ Pretraining error:', error);
            console.error('Error stack:', error.stack);
        } finally {
            this.isActive = false;
            console.log('🔚 Pretraining finally block - isActive set to false');
        }
    }

    /**
     * Run a single phase
     */
    async runPhase(phaseIndex, agent, gameManager, gameEnvironment, dqnTrainer) {
        console.log(`🎬 runPhase() called with phaseIndex: ${phaseIndex}`);
        
        const phase = this.phases[phaseIndex];
        if (!phase) {
            console.error(`❌ Phase ${phaseIndex} not found in phases array`);
            return false;
        }
        
        console.log(`\n📚 Phase ${phaseIndex + 1}: ${phase.name}`);
        console.log(`Description: ${phase.description}`);
        console.log(`Episodes: ${phase.episodes}`);
        console.log(`Max Steps per Episode: ${phase.maxSteps}`);
        
        this.currentPhase = phaseIndex;
        this.stats.phase = phaseIndex;
        
        // Setup environment for this phase
        console.log(`🔧 Setting up environment for phase ${phaseIndex + 1}...`);
        try {
            phase.setupEnvironment(gameManager, gameEnvironment, this);
            console.log(`✅ Environment setup completed`);
        } catch (error) {
            console.error(`❌ Environment setup failed:`, error);
        }
        
        let successCount = 0;
        const episodeRewards = [];
        
        // Run episodes for this phase
        for (let episode = 0; episode < phase.episodes; episode++) {
            if (!this.isActive) {
                console.log(`⏹️ Pretraining stopped at episode ${episode}`);
                break;
            }
            
            this.stats.episode = episode;
            this.stats.progress = episode / phase.episodes;
            
            // Run single episode
            console.log(`🎮 Running episode ${episode + 1}/${phase.episodes}...`);
            const result = await this.runEpisode(phase, agent, gameManager, gameEnvironment, dqnTrainer);
            
            console.log(`Episode ${episode + 1} result: reward=${result.totalReward.toFixed(2)}, steps=${result.steps}`);
            episodeRewards.push(result.totalReward);
            
            const episodeSuccessful = phase.isEpisodeSuccessful(result.totalReward, result.steps, result.stepInfo);
            if (episodeSuccessful) {
                successCount++;
                console.log(`✅ Episode ${episode + 1} was successful!`);
            } else {
                console.log(`❌ Episode ${episode + 1} failed`);
            }
            
            // Log progress every 5 episodes instead of 10 for more visibility
            if ((episode + 1) % 5 === 0) {
                const avgReward = episodeRewards.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, episodeRewards.length);
                const successRate = successCount / (episode + 1) * 100;
                console.log(`📊 Episode ${episode + 1}/${phase.episodes} - Avg Reward: ${avgReward.toFixed(1)}, Success: ${successRate.toFixed(0)}%`);
            }
        }
        
        // Evaluate phase success
        const avgReward = episodeRewards.length > 0 ? 
            episodeRewards.reduce((a, b) => a + b, 0) / episodeRewards.length : 0;
        const successRate = phase.episodes > 0 ? successCount / phase.episodes : 0;
        
        console.log(`\n📊 Phase ${phaseIndex + 1} Results:`);
        console.log(`Episodes completed: ${episodeRewards.length}/${phase.episodes}`);
        console.log(`Average Reward: ${avgReward.toFixed(2)}`);
        console.log(`Success Rate: ${(successRate * 100).toFixed(1)}% (${successCount}/${phase.episodes})`);
        
        // More lenient success criteria for testing - adjust as needed
        const phaseSuccess = successRate >= 0.4 && avgReward > 5 && episodeRewards.length >= phase.episodes * 0.8;
        
        console.log(`Phase ${phaseIndex + 1} success: ${phaseSuccess ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`  Required: successRate >= 0.4 (${successRate >= 0.4}), avgReward > 5 (${avgReward > 5}), completed >= 80% episodes (${episodeRewards.length >= phase.episodes * 0.8})`);
        
        return phaseSuccess;
    }

    /**
     * Run a single episode
     */
    async runEpisode(phase, agent, gameManager, gameEnvironment, dqnTrainer) {
        console.log(`  🔄 Starting episode with max steps: ${phase.maxSteps}`);
        
        // Reset environment
        if (gameManager.resetAgentsToCorners) {
            gameManager.resetAgentsToCorners();
        }
        if (gameEnvironment.criticalPointSystem && gameEnvironment.criticalPointSystem.resetAllCriticalPoints) {
            gameEnvironment.criticalPointSystem.resetAllCriticalPoints();
        }
        
        let totalReward = 0;
        let steps = 0;
        let stepInfo = {}; // Track episode-specific info
        
        const startPos = { x: agent.x, y: agent.y, z: agent.z };
        console.log(`  Agent starting position: (${startPos.x.toFixed(2)}, ${startPos.z.toFixed(2)})`);
        
        // Episode loop
        for (let step = 0; step < phase.maxSteps; step++) {
            if (!this.isActive) {
                console.log(`  ⏹️ Episode stopped at step ${step}`);
                break;
            }
            
            const prevPosition = { x: agent.x, y: agent.y, z: agent.z };
            
            // Get action from DQN (or random for early training)
            let state, action;
            try {
                if (gameEnvironment.gameStateExtractor && gameEnvironment.gameStateExtractor.extractState) {
                    state = gameEnvironment.gameStateExtractor.extractState(agent, gameManager, gameEnvironment);
                } else {
                    // Fallback simple state
                    state = [agent.x, agent.z, 0, 0, 0];
                }
                
                if (dqnTrainer.selectAction) {
                    action = await dqnTrainer.selectAction(state, true);
                } else {
                    // Fallback random action
                    action = Math.floor(Math.random() * 4);
                }
            } catch (error) {
                console.warn(`  Warning: Error getting state/action at step ${step}:`, error.message);
                action = Math.floor(Math.random() * 4); // Fallback
                state = [agent.x, agent.z, 0, 0, 0];
            }
            
            // Execute action
            this.executeAction(agent, action);
            
            // Calculate reward for this step
            const stepReward = phase.getReward(agent, prevPosition, gameEnvironment, stepInfo, this);
            totalReward += stepReward;
            steps++;
            
            // Log first few steps for debugging
            if (step < 3) {
                console.log(`    Step ${step}: pos=(${agent.x.toFixed(2)}, ${agent.z.toFixed(2)}), action=${action}, reward=${stepReward.toFixed(2)}`);
            }
            
            // Store experience in DQN (with error handling)
            try {
                const nextState = gameEnvironment.gameStateExtractor ? 
                    gameEnvironment.gameStateExtractor.extractState(agent, gameManager, gameEnvironment) :
                    [agent.x, agent.z, 0, 0, 0];
                const done = step >= phase.maxSteps - 1 || stepInfo.won;
                
                if (dqnTrainer.storeExperience) {
                    await dqnTrainer.storeExperience(state, action, stepReward, nextState, done);
                }
                
                // Train network occasionally
                if (step % 10 === 0 && dqnTrainer.trainNetwork && dqnTrainer.experienceReplay && dqnTrainer.experienceReplay.getSize() > 50) {
                    await dqnTrainer.trainNetwork();
                }
            } catch (error) {
                console.warn(`  Warning: Error storing experience at step ${step}:`, error.message);
            }
            
            // Early termination conditions
            if (stepInfo.won || (steps > 20 && totalReward < -50)) {
                console.log(`  🏁 Episode terminated early at step ${step}: won=${stepInfo.won}, totalReward=${totalReward.toFixed(2)}`);
                break;
            }
            
            // Small delay
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        console.log(`  Episode completed: ${steps} steps, total reward: ${totalReward.toFixed(2)}`);
        return { totalReward, steps, stepInfo };
    }

    /**
     * Execute action (simplified)
     */
    executeAction(agent, action) {
        const actions = [
            { dx: 0, dz: 1 },   // Forward
            { dx: 0, dz: -1 },  // Backward  
            { dx: -1, dz: 0 },  // Left
            { dx: 1, dz: 0 },   // Right
        ];
        
        const move = actions[action] || { dx: 0, dz: 0 };
        const speed = 0.5;
        
        agent.x += move.dx * speed;
        agent.z += move.dz * speed;
        
        if (agent.mesh) {
            agent.mesh.position.set(agent.x, agent.y, agent.z);
        }
    }

    /**
     * Helper: Find nearest critical point
     */
    findNearestCriticalPoint(agent, gameEnvironment) {
        if (!gameEnvironment.criticalPointSystem?.criticalPoints) return null;
        
        let nearest = null;
        let minDistance = Infinity;
        
        gameEnvironment.criticalPointSystem.criticalPoints.forEach(cpData => {
            if (cpData.cp) {
                const distance = Math.sqrt(
                    (agent.x - cpData.cp.position.x) ** 2 +
                    (agent.z - cpData.cp.position.z) ** 2
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = { cp: cpData, distance };
                }
            }
        });
        
        return nearest;
    }

    /**
     * Helper: Count critical points owned by agent
     */
    countOwnedCriticalPoints(agent, gameEnvironment) {
        if (!gameEnvironment.criticalPointSystem?.criticalPoints) return 0;
        
        let count = 0;
        gameEnvironment.criticalPointSystem.criticalPoints.forEach(cpData => {
            if (cpData.ownedBy === agent.id || cpData.currentOwner === agent.id) {
                count++;
            }
        });
        
        return count;
    }

    /**
     * Helper: Set enemies active/inactive
     */
    setEnemiesActive(gameManager, active, count = 1, difficulty = 'easy') {
        if (!gameManager.agents || gameManager.agents.length <= 1) return;
        
        for (let i = 1; i < gameManager.agents.length && i <= count; i++) {
            const enemy = gameManager.agents[i];
            if (active) {
                enemy.setMode(difficulty === 'easy' ? 'random' : 'moderate');
            } else {
                enemy.setMode('passive');
            }
        }
    }

    /**
     * Helper: Set critical points active/inactive
     */
    setCriticalPointsActive(gameEnvironment, active) {
        if (gameEnvironment.criticalPointSystem) {
            gameEnvironment.criticalPointSystem.setEnabled(active);
        }
    }

    /**
     * Stop pretraining
     */
    stop() {
        this.isActive = false;
        console.log('⏹️ Pretraining stopped');
    }

    /**
     * Get current stats
     */
    getStats() {
        return {
            isActive: this.isActive,
            currentPhase: this.currentPhase,
            phaseName: this.phases[this.currentPhase]?.name || 'Unknown',
            episode: this.stats.episode,
            progress: this.stats.progress,
            totalPhases: this.phases.length,
            phaseResults: this.stats.phaseResults
        };
    }

    /**
     * Get phase info
     */
    getPhases() {
        return this.phases.map((phase, index) => ({
            index,
            name: phase.name,
            description: phase.description,
            episodes: phase.episodes
        }));
    }
}

// Export singleton
export const simplePretrainingSystem = new SimplePretrainingSystem();
