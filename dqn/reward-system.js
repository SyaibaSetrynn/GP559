/**
 * Reward System Definition
 * Clean, focused module for defining and calculating rewards for DQN training
 * 
 * Core Reward Components:
 * 1. All rewards normalized between 0 and 1
 * 2. Same reward structure for all agents (homogeneous multi-agent)
 * 3. Clear reward shaping for desired behaviors
 */

export class RewardSystem {
    constructor() {
        // Reward weights - all sum to create rewards between 0 and 1
        this.rewards = {
            // Movement rewards
            SUCCESSFUL_MOVE: 0.1,           // Small positive for valid movement
            INVALID_MOVE: 0.0,              // Neutral for hitting walls (no punishment)
            
            // Critical Point rewards  
            CLAIM_NEW_CP: 0.8,              // High reward for claiming unclaimed CP
            APPROACH_UNCLAIMED_CP: 0.2,     // Medium reward for getting closer to unclaimed CP
            
            // Exploration and distance-based rewards (ENHANCED)
            EXPLORE_NEW_AREA: 0.4,          // HIGH reward for moving to areas not recently visited
            MOVE_TO_DISTANT_CP: 0.5,        // HIGH reward for going to distant CPs instead of nearest
            AREA_COVERAGE: 0.3,             // Reward for covering more map area
            MOVE_AWAY_FROM_CP: 0.15,        // INCREASED reward for moving away (exploration)
            
            // Progress rewards
            IMPROVE_SCORE_RATIO: 0.6,       // Good reward for improving score percentage
            MAINTAIN_LEAD: 0.3,             // Moderate reward for keeping high score
            
            // Time-based rewards
            BASELINE_EXISTENCE: 0.1,        // Small baseline reward per step
            
            // Game completion
            WIN_GAME: 1.0,                  // Maximum reward for winning
            LOSE_GAME: 0.0,                 // Neutral for losing (not punishment)
            DRAW_GAME: 0.4                  // Moderate reward for draw
        };
        
        // Distance thresholds for proximity rewards
        this.proximityThreshold = 2.0;      // Distance considered "close" to CP
        this.explorationRadius = 1.5;       // Radius for considering an area "visited"
        this.mapBounds = { minX: -8, maxX: 8, minZ: -8, maxZ: 8 }; // Approximate map bounds
        
        // Previous state tracking for calculating deltas
        this.previousStates = new Map();    // Maps agent ID to previous state
        
        // Exploration tracking (ENHANCED)
        this.visitedAreas = new Map();      // Maps agent ID to Set of visited grid positions
        this.positionHistory = new Map();   // Maps agent ID to recent position history
        this.lastVisitTime = new Map();     // Maps agent ID to Map of area->timestamp
    }

    /**
     * Calculate reward for an agent's action
     * @param {Agent} agent - The agent that took the action
     * @param {number} actionId - The action that was taken
     * @param {Object} previousState - Game state before the action
     * @param {Object} currentState - Game state after the action
     * @param {Object} actionResult - Result from executing the action
     * @param {Object} gameInfo - Additional game context (level, time, etc.)
     * @returns {number} Reward value between 0 and 1
     */
    calculateReward(agent, actionId, previousState, currentState, actionResult, gameInfo = {}) {
        let totalReward = 0;
        const rewardBreakdown = {};
        
        try {
            // 1. BASELINE EXISTENCE REWARD
            totalReward += this.rewards.BASELINE_EXISTENCE;
            rewardBreakdown.baseline = this.rewards.BASELINE_EXISTENCE;
            
            // 2. MOVEMENT REWARDS
            const movementReward = this.calculateMovementReward(actionResult);
            totalReward += movementReward;
            rewardBreakdown.movement = movementReward;
            
            // 3. CRITICAL POINT REWARDS
            const cpReward = this.calculateCriticalPointReward(agent, previousState, currentState);
            totalReward += cpReward;
            rewardBreakdown.criticalPoints = cpReward;
            
            // 4. EXPLORATION REWARDS (NEW - HIGH PRIORITY)
            const explorationReward = this.calculateExplorationReward(agent, previousState, currentState);
            totalReward += explorationReward;
            rewardBreakdown.exploration = explorationReward;
            
            // 5. PROGRESS REWARDS
            const progressReward = this.calculateProgressReward(agent, previousState, currentState);
            totalReward += progressReward;
            rewardBreakdown.progress = progressReward;
            
            // 6. GAME COMPLETION REWARDS
            const completionReward = this.calculateCompletionReward(currentState, gameInfo);
            totalReward += completionReward;
            rewardBreakdown.completion = completionReward;
            
        } catch (error) {
            console.warn('Error calculating reward:', error);
            totalReward = this.rewards.BASELINE_EXISTENCE; // Safe fallback
            rewardBreakdown.error = 'Calculation failed, using baseline';
        }
        
        // Ensure reward is between 0 and 1
        totalReward = Math.max(0, Math.min(1, totalReward));
        
        // Store state for next calculation
        this.previousStates.set(agent.agentId, {
            state: currentState,
            timestamp: Date.now()
        });
        
        return {
            reward: totalReward,
            breakdown: rewardBreakdown
        };
    }

    /**
     * Calculate movement-based rewards
     */
    calculateMovementReward(actionResult) {
        if (actionResult.success) {
            return this.rewards.SUCCESSFUL_MOVE;
        } else {
            return this.rewards.INVALID_MOVE;
        }
    }

    /**
     * Calculate critical point related rewards
     */
    calculateCriticalPointReward(agent, previousState, currentState) {
        let reward = 0;
        
        // Check if agent claimed a new CP
        const prevScore = previousState?.score?.myScore || 0;
        const currScore = currentState?.score?.myScore || 0;
        
        if (currScore > prevScore) {
            // Claimed a new CP!
            reward += this.rewards.CLAIM_NEW_CP;
        }
        
        // Check proximity to unclaimed CPs
        const proximityReward = this.calculateProximityReward(
            previousState?.agent?.position,
            currentState?.agent?.position,
            currentState?.criticalPoints?.neutral || []
        );
        reward += proximityReward;
        
        return reward;
    }

    /**
     * Calculate proximity-based rewards for getting closer to objectives
     */
    calculateProximityReward(previousPos, currentPos, neutralCPs) {
        if (!previousPos || !currentPos || neutralCPs.length === 0) {
            return 0;
        }
        
        // Find nearest neutral CP
        let nearestCP = null;
        let minDistance = Infinity;
        
        for (const cp of neutralCPs) {
            if (cp.position) {
                const distance = Math.sqrt(
                    Math.pow(currentPos.x - cp.position.x, 2) + 
                    Math.pow(currentPos.z - cp.position.z, 2)
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestCP = cp;
                }
            }
        }
        
        if (!nearestCP) return 0;
        
        // Calculate previous and current distances to nearest CP
        const prevDistance = Math.sqrt(
            Math.pow(previousPos.x - nearestCP.position.x, 2) + 
            Math.pow(previousPos.z - nearestCP.position.z, 2)
        );
        
        const currDistance = Math.sqrt(
            Math.pow(currentPos.x - nearestCP.position.x, 2) + 
            Math.pow(currentPos.z - nearestCP.position.z, 2)
        );
        
        // Reward for getting closer, moderate reward for moving away (exploration)
        if (currDistance < prevDistance) {
            // Getting closer - reward proportional to improvement
            const improvement = prevDistance - currDistance;
            return Math.min(this.rewards.APPROACH_UNCLAIMED_CP, improvement * 0.15);
        } else {
            // Moving away - ENHANCED exploration reward
            const moveAwayDistance = currDistance - prevDistance;
            const baseReward = this.rewards.MOVE_AWAY_FROM_CP;
            
            // Scale reward based on how far they're moving away
            return Math.min(baseReward * 2, baseReward + (moveAwayDistance * 0.1));
        }
    }

    /**
     * Calculate progress-based rewards (score improvement)
     */
    calculateProgressReward(agent, previousState, currentState) {
        let reward = 0;
        
        const prevRatio = this.getScoreRatio(previousState);
        const currRatio = this.getScoreRatio(currentState);
        
        if (currRatio > prevRatio) {
            // Score ratio improved
            const improvement = currRatio - prevRatio;
            reward += this.rewards.IMPROVE_SCORE_RATIO * improvement;
        }
        
        // Reward for maintaining a good position
        if (currRatio > 0.5) { // Leading
            reward += this.rewards.MAINTAIN_LEAD * currRatio;
        }
        
        return reward;
    }

    /**
     * Calculate game completion rewards
     */
    calculateCompletionReward(currentState, gameInfo) {
        if (!gameInfo.gameEnded) {
            return 0;
        }
        
        const scoreRatio = this.getScoreRatio(currentState);
        const totalCPs = currentState?.score?.totalCPs || 1;
        
        if (totalCPs === 0) return this.rewards.DRAW_GAME;
        
        // Determine game outcome based on score ratio
        if (scoreRatio > 0.5) {
            return this.rewards.WIN_GAME; // Winning
        } else if (scoreRatio === 0.5) {
            return this.rewards.DRAW_GAME; // Tie
        } else {
            return this.rewards.LOSE_GAME; // Losing
        }
    }

    /**
     * Helper: Get score ratio (my score / total CPs)
     */
    getScoreRatio(state) {
        if (!state?.score) return 0;
        const myScore = state.score.myScore || 0;
        const totalCPs = state.score.totalCPs || 1;
        return totalCPs > 0 ? myScore / totalCPs : 0;
    }

    /**
     * Get reward configuration for inspection/debugging
     * @returns {Object} Current reward settings
     */
    getRewardConfig() {
        return {
            rewards: { ...this.rewards },
            proximityThreshold: this.proximityThreshold,
            explorationRadius: this.explorationRadius,
            mapBounds: this.mapBounds,
            description: 'Enhanced exploration-focused rewards: agents heavily rewarded for going to distant areas and new locations'
        };
    }

    /**
     * Update reward weights (for tuning)
     * @param {Object} newRewards - New reward values
     */
    updateRewards(newRewards) {
        this.rewards = { ...this.rewards, ...newRewards };
    }

    /**
     * Reset tracking state (call between episodes)
     */
    resetEpisode() {
        this.previousStates.clear();
        // Clear exploration tracking for fresh start each episode
        this.visitedAreas.clear();
        this.positionHistory.clear();
        this.lastVisitTime.clear();
        console.log('Reward system reset - exploration tracking cleared');
    }

    /**
     * Get reward statistics for analysis
     * @returns {Object} Reward statistics
     */
    getRewardStats() {
        return {
            maxPossibleReward: Math.max(...Object.values(this.rewards)),
            minPossibleReward: Math.min(...Object.values(this.rewards)),
            averageReward: Object.values(this.rewards).reduce((a, b) => a + b, 0) / Object.keys(this.rewards).length,
            rewardTypes: Object.keys(this.rewards).length
        };
    }

    /**
     * Validate reward configuration
     * @returns {Object} Validation results
     */
    validateRewards() {
        const issues = [];
        
        // Check that all rewards are between 0 and 1
        for (const [name, value] of Object.entries(this.rewards)) {
            if (value < 0 || value > 1) {
                issues.push(`Reward ${name} (${value}) is outside 0-1 range`);
            }
        }
        
        return {
            isValid: issues.length === 0,
            issues: issues,
            totalRewardTypes: Object.keys(this.rewards).length
        };
    }
    
    /**
     * Calculate exploration-based rewards (NEW - ENHANCED)
     * Rewards agents for going to new areas and distant locations
     */
    calculateExplorationReward(agent, previousState, currentState) {
        let explorationReward = 0;
        
        const currentPos = currentState?.agent?.position;
        const previousPos = previousState?.agent?.position;
        
        if (!currentPos || !previousPos) return 0;
        
        const agentId = agent.agentId || 0;
        
        // Initialize tracking for this agent if needed
        if (!this.visitedAreas.has(agentId)) {
            this.visitedAreas.set(agentId, new Set());
            this.positionHistory.set(agentId, []);
            this.lastVisitTime.set(agentId, new Map());
        }
        
        const visitedAreas = this.visitedAreas.get(agentId);
        const positionHistory = this.positionHistory.get(agentId);
        const lastVisitTime = this.lastVisitTime.get(agentId);
        
        // 1. NEW AREA EXPLORATION REWARD
        const currentGridPos = this.positionToGrid(currentPos);
        const currentGridKey = `${currentGridPos.x},${currentGridPos.z}`;
        
        if (!visitedAreas.has(currentGridKey)) {
            // First time visiting this area - BIG reward!
            explorationReward += this.rewards.EXPLORE_NEW_AREA;
            visitedAreas.add(currentGridKey);
            console.log(`Agent ${agentId} explored new area ${currentGridKey} - reward: ${this.rewards.EXPLORE_NEW_AREA}`);
        } else {
            // Check if we haven't been here recently
            const lastVisit = lastVisitTime.get(currentGridKey) || 0;
            const timeSinceLastVisit = Date.now() - lastVisit;
            const recentVisitThreshold = 30000; // 30 seconds
            
            if (timeSinceLastVisit > recentVisitThreshold) {
                // Revisiting after a while - partial exploration reward
                explorationReward += this.rewards.EXPLORE_NEW_AREA * 0.3;
            }
        }
        
        // Update visit time
        lastVisitTime.set(currentGridKey, Date.now());
        
        // 2. DISTANT CP TARGETING REWARD
        const distantCPReward = this.calculateDistantCPReward(currentPos, previousPos, currentState);
        explorationReward += distantCPReward;
        
        // 3. AREA COVERAGE REWARD
        const coverageReward = this.calculateAreaCoverageReward(agentId, visitedAreas);
        explorationReward += coverageReward;
        
        // 4. ENHANCED MOVE AWAY REWARD (distance from starting corner)
        const moveAwayReward = this.calculateMoveAwayReward(agentId, currentPos);
        explorationReward += moveAwayReward;
        
        // Update position history (keep last 10 positions)
        positionHistory.push({...currentPos});
        if (positionHistory.length > 10) {
            positionHistory.shift();
        }
        
        return explorationReward;
    }

    /**
     * Convert world position to grid position for area tracking
     */
    positionToGrid(position, gridSize = 2) {
        return {
            x: Math.floor(position.x / gridSize),
            z: Math.floor(position.z / gridSize)
        };
    }

    /**
     * Calculate reward for targeting distant CPs instead of just the nearest
     */
    calculateDistantCPReward(currentPos, previousPos, currentState) {
        const neutralCPs = currentState?.criticalPoints?.neutral || [];
        if (neutralCPs.length < 2) return 0; // Need at least 2 CPs to compare distances
        
        // Find nearest and farthest CPs
        let nearestDistance = Infinity;
        let farthestDistance = -1;
        let targetCP = null;
        
        for (const cp of neutralCPs) {
            if (cp.position) {
                const distance = Math.sqrt(
                    Math.pow(currentPos.x - cp.position.x, 2) + 
                    Math.pow(currentPos.z - cp.position.z, 2)
                );
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                }
                if (distance > farthestDistance) {
                    farthestDistance = distance;
                    targetCP = cp;
                }
            }
        }
        
        if (!targetCP || nearestDistance >= farthestDistance) return 0;
        
        // Calculate if agent is moving toward a distant CP
        const prevDistanceToFarthest = Math.sqrt(
            Math.pow(previousPos.x - targetCP.position.x, 2) + 
            Math.pow(previousPos.z - targetCP.position.z, 2)
        );
        
        const currDistanceToFarthest = Math.sqrt(
            Math.pow(currentPos.x - targetCP.position.x, 2) + 
            Math.pow(currentPos.z - targetCP.position.z, 2)
        );
        
        // Reward for getting closer to distant CPs
        if (currDistanceToFarthest < prevDistanceToFarthest) {
            const improvement = prevDistanceToFarthest - currDistanceToFarthest;
            const distanceRatio = currDistanceToFarthest / nearestDistance;
            
            // Higher reward for targeting more distant CPs
            if (distanceRatio > 1.5) { // Target is significantly farther than nearest
                return Math.min(this.rewards.MOVE_TO_DISTANT_CP, improvement * distanceRatio * 0.1);
            }
        }
        
        return 0;
    }

    /**
     * Calculate area coverage reward based on unique areas visited
     */
    calculateAreaCoverageReward(agentId, visitedAreas) {
        const totalPossibleAreas = Math.abs(this.mapBounds.maxX - this.mapBounds.minX) * 
                                  Math.abs(this.mapBounds.maxZ - this.mapBounds.minZ) / 4; // Grid size 2x2
        
        const coverageRatio = visitedAreas.size / totalPossibleAreas;
        
        // Progressive reward for exploring more areas
        if (coverageRatio > 0.7) {
            return this.rewards.AREA_COVERAGE * 0.8; // High coverage
        } else if (coverageRatio > 0.4) {
            return this.rewards.AREA_COVERAGE * 0.5; // Medium coverage
        } else if (coverageRatio > 0.2) {
            return this.rewards.AREA_COVERAGE * 0.2; // Low coverage
        }
        
        return 0;
    }

    /**
     * Calculate enhanced move away reward (distance from agent's starting corner)
     */
    calculateMoveAwayReward(agentId, currentPos) {
        // Starting corners for agents (matches AgentTestMain.js)
        const startingPositions = [
            { x: -4, z: -4 }, // Red agent - back left corner
            { x: 4, z: -4 },  // Green agent - back right corner  
            { x: -4, z: 4 },  // Blue agent - front left corner
            { x: 4, z: 4 }    // Extra corner - front right corner
        ];
        
        const startPos = startingPositions[agentId % startingPositions.length];
        const distanceFromStart = Math.sqrt(
            Math.pow(currentPos.x - startPos.x, 2) + 
            Math.pow(currentPos.z - startPos.z, 2)
        );
        
        // Reward increases with distance from starting corner
        const maxDistance = Math.sqrt(Math.pow(8, 2) + Math.pow(8, 2)); // Max map distance
        const distanceRatio = Math.min(distanceFromStart / maxDistance, 1.0);
        
        // Progressive reward for being far from start
        return this.rewards.MOVE_AWAY_FROM_CP * distanceRatio * 2; // Amplify the reward
    }

    /**
     * Get exploration statistics for debugging
     */
    getExplorationStats() {
        const stats = {
            totalAgentsTracked: this.visitedAreas.size,
            agentStats: {}
        };
        
        for (const [agentId, visitedAreas] of this.visitedAreas.entries()) {
            const positionHistory = this.positionHistory.get(agentId) || [];
            const lastVisitTime = this.lastVisitTime.get(agentId) || new Map();
            
            stats.agentStats[agentId] = {
                areasVisited: visitedAreas.size,
                positionHistoryLength: positionHistory.length,
                recentAreas: lastVisitTime.size,
                currentPosition: positionHistory.length > 0 ? positionHistory[positionHistory.length - 1] : null
            };
        }
        
        return stats;
    }

}

// Global instance for easy access
export const rewardSystem = new RewardSystem();

// Export for direct use
export default RewardSystem;
