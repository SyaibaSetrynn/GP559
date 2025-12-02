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
            MOVE_AWAY_FROM_CP: 0.05,        // Small reward for moving away (exploration)
            
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
        
        // Previous state tracking for calculating deltas
        this.previousStates = new Map();    // Maps agent ID to previous state
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
            
            // 4. PROGRESS REWARDS
            const progressReward = this.calculateProgressReward(agent, previousState, currentState);
            totalReward += progressReward;
            rewardBreakdown.progress = progressReward;
            
            // 5. GAME COMPLETION REWARDS
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
        
        // Reward for getting closer, small reward for moving away (exploration)
        if (currDistance < prevDistance) {
            // Getting closer - reward proportional to improvement
            const improvement = prevDistance - currDistance;
            return Math.min(this.rewards.APPROACH_UNCLAIMED_CP, improvement * 0.1);
        } else {
            // Moving away - small exploration reward
            return this.rewards.MOVE_AWAY_FROM_CP;
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
            description: 'All rewards normalized between 0 and 1, homogeneous multi-agent setup'
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
}

// Global instance for easy access
export const rewardSystem = new RewardSystem();

// Export for direct use
export default RewardSystem;
