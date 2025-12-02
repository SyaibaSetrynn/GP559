/**
 * Experience Data Structure
 * Simple container for storing individual DQN experiences
 */

export class Experience {
    /**
     * Create a new experience tuple
     * @param {Array<number>} state - Current state vector (10 values)
     * @param {number} action - Action taken (0-3)
     * @param {number} reward - Reward received (0-1)
     * @param {Array<number>} nextState - Next state vector (10 values)
     * @param {boolean} done - Episode ended?
     * @param {number} agentId - Which agent generated this experience
     */
    constructor(state, action, reward, nextState, done, agentId = 0) {
        this.state = Array.from(state);         // Copy state array
        this.action = action;
        this.reward = reward;
        this.nextState = Array.from(nextState); // Copy next state array
        this.done = done;
        this.agentId = agentId;
        this.timestamp = Date.now();
    }

    /**
     * Validate experience data
     * @returns {boolean} True if experience is valid
     */
    isValid() {
        try {
            // Check state vectors are arrays with 10 elements
            if (!Array.isArray(this.state) || this.state.length !== 10) return false;
            if (!Array.isArray(this.nextState) || this.nextState.length !== 10) return false;
            
            // Check action is valid (0-3)
            if (typeof this.action !== 'number' || this.action < 0 || this.action > 3) return false;
            
            // Check reward is valid (0-1)
            if (typeof this.reward !== 'number' || this.reward < 0 || this.reward > 1) return false;
            
            // Check done is boolean
            if (typeof this.done !== 'boolean') return false;
            
            // Check all state values are numbers
            const allNumbers = [...this.state, ...this.nextState].every(val => 
                typeof val === 'number' && !isNaN(val) && isFinite(val)
            );
            if (!allNumbers) return false;
            
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get memory size of this experience (rough estimate)
     * @returns {number} Size in bytes
     */
    getMemorySize() {
        // 20 floats (state + nextState) * 8 bytes + metadata
        return (20 * 8) + 32; // ~192 bytes per experience
    }

    /**
     * Convert to plain object for serialization
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            state: this.state,
            action: this.action,
            reward: this.reward,
            nextState: this.nextState,
            done: this.done,
            agentId: this.agentId,
            timestamp: this.timestamp
        };
    }

    /**
     * Create experience from plain object
     * @param {Object} obj - Plain object
     * @returns {Experience} New experience instance
     */
    static fromObject(obj) {
        const exp = new Experience(
            obj.state,
            obj.action,
            obj.reward,
            obj.nextState,
            obj.done,
            obj.agentId
        );
        exp.timestamp = obj.timestamp;
        return exp;
    }
}

export default Experience;
