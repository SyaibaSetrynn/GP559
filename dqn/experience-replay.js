/**
 * Experience Replay System
 * Main interface for DQN experience replay functionality
 * Simple implementation with shared buffer for all agents
 */

import Experience from './experience.js';
import ReplayBuffer from './replay-buffer.js';

export class ExperienceReplay {
    /**
     * Create experience replay system
     * @param {number} maxBufferSize - Maximum experiences to store
     * @param {number} minBufferSize - Minimum experiences before training
     * @param {number} batchSize - Default batch size for sampling
     */
    constructor(maxBufferSize = 10000, minBufferSize = 1000, batchSize = 32) {
        this.buffer = new ReplayBuffer(maxBufferSize);
        this.minBufferSize = minBufferSize;
        this.batchSize = batchSize;
        
        // Statistics tracking
        this.totalExperiencesAdded = 0;
        this.totalBatchesSampled = 0;
        
        console.log(`Experience Replay initialized: buffer=${maxBufferSize}, min=${minBufferSize}, batch=${batchSize}`);
    }

    /**
     * Store a new experience in the replay buffer
     * @param {Array<number>} state - Current state vector
     * @param {number} action - Action taken (0-3)
     * @param {number} reward - Reward received (0-1)
     * @param {Array<number>} nextState - Next state vector
     * @param {boolean} done - Episode ended?
     * @param {number} agentId - Agent that generated this experience
     * @returns {boolean} True if experience was stored successfully
     */
    storeExperience(state, action, reward, nextState, done, agentId = 0) {
        const success = this.buffer.addExperience(state, action, reward, nextState, done, agentId);
        
        if (success) {
            this.totalExperiencesAdded++;
        }
        
        return success;
    }

    /**
     * Sample a batch of experiences for training
     * @param {number} batchSize - Size of batch to sample (optional)
     * @returns {Array<Experience>} Batch of experiences
     */
    sampleBatch(batchSize = null) {
        const actualBatchSize = batchSize || this.batchSize;
        
        if (!this.canSample(actualBatchSize)) {
            throw new Error(`Cannot sample batch of size ${actualBatchSize}. Buffer has ${this.buffer.getSize()} experiences, need at least ${this.minBufferSize}`);
        }
        
        const batch = this.buffer.sampleBatch(actualBatchSize);
        this.totalBatchesSampled++;
        
        return batch;
    }

    /**
     * Check if ready to sample for training
     * @param {number} batchSize - Required batch size (optional)
     * @returns {boolean} True if can sample
     */
    canSample(batchSize = null) {
        const actualBatchSize = batchSize || this.batchSize;
        return this.buffer.getSize() >= Math.max(this.minBufferSize, actualBatchSize);
    }

    /**
     * Check if ready to start training
     * @returns {boolean} True if ready to train
     */
    readyToTrain() {
        return this.canSample();
    }

    /**
     * Get current buffer size
     * @returns {number} Number of experiences stored
     */
    getBufferSize() {
        return this.buffer.getSize();
    }

    /**
     * Get buffer utilization (0-1)
     * @returns {number} Buffer utilization percentage
     */
    getBufferUtilization() {
        return this.buffer.getSize() / this.buffer.maxSize;
    }

    /**
     * Get recent experiences for debugging
     * @param {number} count - Number of recent experiences
     * @returns {Array<Experience>} Recent experiences
     */
    getRecentExperiences(count = 5) {
        return this.buffer.getRecentExperiences(count);
    }

    /**
     * Get experiences from specific agent
     * @param {number} agentId - Agent ID
     * @param {number} maxCount - Maximum experiences to return
     * @returns {Array<Experience>} Agent's experiences
     */
    getAgentExperiences(agentId, maxCount = 50) {
        return this.buffer.getExperiencesByAgent(agentId, maxCount);
    }

    /**
     * Get comprehensive statistics
     * @returns {Object} System statistics
     */
    getStats() {
        const bufferStats = this.buffer.getStats();
        
        return {
            // Buffer info
            bufferSize: bufferStats.size,
            maxBufferSize: bufferStats.maxSize,
            bufferUtilization: bufferStats.utilization,
            
            // Training readiness
            readyToTrain: this.readyToTrain(),
            minBufferSize: this.minBufferSize,
            batchSize: this.batchSize,
            
            // Usage statistics
            totalExperiencesAdded: this.totalExperiencesAdded,
            totalBatchesSampled: this.totalBatchesSampled,
            
            // Buffer content stats
            agentDistribution: bufferStats.agentDistribution,
            rewardStats: bufferStats.rewardStats,
            actionStats: bufferStats.actionStats,
            
            // Memory
            memoryUsage: bufferStats.memoryUsage,
            memoryUsageMB: (bufferStats.memoryUsage / 1024 / 1024).toFixed(2)
        };
    }

    /**
     * Clear all stored experiences
     */
    clear() {
        this.buffer.clear();
        this.totalExperiencesAdded = 0;
        this.totalBatchesSampled = 0;
        console.log('Experience replay buffer cleared');
    }

    /**
     * Clean up old experiences
     * @param {number} maxAge - Maximum age in milliseconds (default: 5 minutes)
     * @returns {number} Number of experiences removed
     */
    cleanup(maxAge = 300000) {
        const removed = this.buffer.removeOldExperiences(maxAge);
        if (removed > 0) {
            console.log(`Cleaned up ${removed} old experiences`);
        }
        return removed;
    }

    /**
     * Validate the replay system
     * @returns {Object} Validation results
     */
    validate() {
        const bufferValidation = this.buffer.validateBuffer();
        const issues = [...bufferValidation.issues];
        
        // Check configuration
        if (this.batchSize > this.buffer.maxSize) {
            issues.push('Batch size larger than buffer size');
        }
        
        if (this.minBufferSize > this.buffer.maxSize) {
            issues.push('Min buffer size larger than max buffer size');
        }
        
        return {
            isValid: issues.length === 0 && bufferValidation.isHealthy,
            issues,
            bufferHealth: bufferValidation
        };
    }

    /**
     * Get configuration for debugging
     * @returns {Object} Current configuration
     */
    getConfig() {
        return {
            maxBufferSize: this.buffer.maxSize,
            minBufferSize: this.minBufferSize,
            batchSize: this.batchSize,
            currentSize: this.buffer.getSize(),
            readyToTrain: this.readyToTrain()
        };
    }
}

// Global instance for easy access
export const experienceReplay = new ExperienceReplay();

// Export classes and instance
export { Experience, ReplayBuffer };
export default ExperienceReplay;
