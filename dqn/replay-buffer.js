/**
 * Replay Buffer
 * Simple circular buffer for storing and sampling DQN experiences
 * Shared buffer - all agents contribute to the same buffer
 */

import Experience from './experience.js';

export class ReplayBuffer {
    /**
     * Create a new replay buffer
     * @param {number} maxSize - Maximum number of experiences to store
     */
    constructor(maxSize = 10000) {
        this.maxSize = maxSize;
        this.buffer = [];           // Circular buffer of experiences
        this.index = 0;             // Current write position
        this.size = 0;              // Current number of experiences
    }

    /**
     * Add a new experience to the buffer
     * @param {Array<number>} state - Current state
     * @param {number} action - Action taken
     * @param {number} reward - Reward received
     * @param {Array<number>} nextState - Next state
     * @param {boolean} done - Episode ended?
     * @param {number} agentId - Agent ID
     */
    addExperience(state, action, reward, nextState, done, agentId = 0) {
        try {
            const experience = new Experience(state, action, reward, nextState, done, agentId);
            
            // Validate experience
            if (!experience.isValid()) {
                console.warn('Invalid experience, skipping:', experience);
                return false;
            }
            
            // Add to circular buffer
            this.buffer[this.index] = experience;
            this.index = (this.index + 1) % this.maxSize;
            
            // Update size (up to maxSize)
            if (this.size < this.maxSize) {
                this.size++;
            }
            
            return true;
        } catch (error) {
            console.error('Error adding experience:', error);
            return false;
        }
    }

    /**
     * Sample random batch of experiences for training
     * @param {number} batchSize - Number of experiences to sample
     * @returns {Array<Experience>} Random batch of experiences
     */
    sampleBatch(batchSize = 32) {
        if (!this.canSample(batchSize)) {
            throw new Error(`Cannot sample ${batchSize} experiences, only have ${this.size}`);
        }

        const batch = [];
        const usedIndices = new Set();
        
        // Sample without replacement
        while (batch.length < batchSize) {
            const randomIndex = Math.floor(Math.random() * this.size);
            
            if (!usedIndices.has(randomIndex)) {
                usedIndices.add(randomIndex);
                batch.push(this.buffer[randomIndex]);
            }
        }
        
        return batch;
    }

    /**
     * Check if buffer has enough experiences to sample
     * @param {number} batchSize - Required batch size
     * @returns {boolean} True if can sample
     */
    canSample(batchSize = 32) {
        return this.size >= batchSize;
    }

    /**
     * Get current buffer size
     * @returns {number} Number of experiences stored
     */
    getSize() {
        return this.size;
    }

    /**
     * Check if buffer is full
     * @returns {boolean} True if buffer is at max capacity
     */
    isFull() {
        return this.size >= this.maxSize;
    }

    /**
     * Get most recent experiences
     * @param {number} count - Number of recent experiences to get
     * @returns {Array<Experience>} Recent experiences
     */
    getRecentExperiences(count = 10) {
        const recent = [];
        const actualCount = Math.min(count, this.size);
        
        for (let i = 0; i < actualCount; i++) {
            const idx = (this.index - 1 - i + this.maxSize) % this.maxSize;
            if (idx < this.size) {
                recent.push(this.buffer[idx]);
            }
        }
        
        return recent;
    }

    /**
     * Get experiences from specific agent
     * @param {number} agentId - Agent ID to filter by
     * @param {number} maxCount - Maximum experiences to return
     * @returns {Array<Experience>} Experiences from specified agent
     */
    getExperiencesByAgent(agentId, maxCount = 100) {
        const agentExperiences = [];
        
        for (let i = 0; i < this.size && agentExperiences.length < maxCount; i++) {
            if (this.buffer[i].agentId === agentId) {
                agentExperiences.push(this.buffer[i]);
            }
        }
        
        return agentExperiences;
    }

    /**
     * Get buffer statistics
     * @returns {Object} Buffer statistics
     */
    getStats() {
        if (this.size === 0) {
            return {
                size: 0,
                maxSize: this.maxSize,
                utilization: 0,
                agentDistribution: {},
                rewardStats: {},
                actionStats: {},
                memoryUsage: 0
            };
        }

        // Count by agent
        const agentCounts = {};
        const rewards = [];
        const actions = [0, 0, 0, 0]; // Count for each action (0-3)
        
        for (let i = 0; i < this.size; i++) {
            const exp = this.buffer[i];
            
            // Agent distribution
            agentCounts[exp.agentId] = (agentCounts[exp.agentId] || 0) + 1;
            
            // Reward stats
            rewards.push(exp.reward);
            
            // Action stats
            if (exp.action >= 0 && exp.action <= 3) {
                actions[exp.action]++;
            }
        }
        
        // Calculate reward statistics
        rewards.sort((a, b) => a - b);
        const rewardStats = {
            min: rewards[0],
            max: rewards[rewards.length - 1],
            mean: rewards.reduce((a, b) => a + b, 0) / rewards.length,
            median: rewards[Math.floor(rewards.length / 2)]
        };
        
        return {
            size: this.size,
            maxSize: this.maxSize,
            utilization: this.size / this.maxSize,
            agentDistribution: agentCounts,
            rewardStats: rewardStats,
            actionStats: {
                forward: actions[0],
                left: actions[1],
                back: actions[2],
                right: actions[3]
            },
            memoryUsage: this.size * 192 // Rough estimate in bytes
        };
    }

    /**
     * Clear all experiences
     */
    clear() {
        this.buffer = [];
        this.index = 0;
        this.size = 0;
    }

    /**
     * Remove old experiences (older than maxAge milliseconds)
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {number} Number of experiences removed
     */
    removeOldExperiences(maxAge = 300000) { // 5 minutes default
        const cutoffTime = Date.now() - maxAge;
        let removed = 0;
        
        // Simple approach: rebuild buffer without old experiences
        const validExperiences = [];
        
        for (let i = 0; i < this.size; i++) {
            if (this.buffer[i].timestamp >= cutoffTime) {
                validExperiences.push(this.buffer[i]);
            } else {
                removed++;
            }
        }
        
        // Rebuild buffer
        this.buffer = validExperiences;
        this.size = validExperiences.length;
        this.index = this.size % this.maxSize;
        
        return removed;
    }

    /**
     * Validate all experiences in buffer
     * @returns {Object} Validation results
     */
    validateBuffer() {
        let validCount = 0;
        let invalidCount = 0;
        const issues = [];
        
        for (let i = 0; i < this.size; i++) {
            if (this.buffer[i] && this.buffer[i].isValid()) {
                validCount++;
            } else {
                invalidCount++;
                issues.push(`Invalid experience at index ${i}`);
            }
        }
        
        return {
            validCount,
            invalidCount,
            totalCount: this.size,
            isHealthy: invalidCount === 0,
            issues
        };
    }
}

export default ReplayBuffer;
