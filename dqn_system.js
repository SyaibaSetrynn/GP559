/**
 * DQN System - Phase 1: Data Collection
 * Ultra-simple approach for training agents in the maze game
 */

import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";

/**
 * State Observer - Extracts game state into a fixed-size array
 */
class StateObserver {
    getState(agent, agentManager) {
        const state = [];
        const agentPos = agent.getPosition();
        
        // Agent position (2 numbers)
        state.push(agentPos.x);
        state.push(agentPos.z);
        
        // Nearest critical point info (4 numbers)
        const nearestCP = this.findNearestUnclaimedCP(agent, agentManager);
        state.push(nearestCP.x);
        state.push(nearestCP.z);
        state.push(nearestCP.distance);
        state.push(nearestCP.isOwned ? 1 : 0);
        
        // Wall detection (4 numbers) - can agent move in each direction?
        state.push(this.canMoveInDirection(agent, 0, 0, -1) ? 1 : 0); // Forward
        state.push(this.canMoveInDirection(agent, -1, 0, 0) ? 1 : 0); // Left
        state.push(this.canMoveInDirection(agent, 0, 0, 1) ? 1 : 0);  // Back
        state.push(this.canMoveInDirection(agent, 1, 0, 0) ? 1 : 0);  // Right
        
        // Agent performance (2 numbers)
        state.push(agent.getScore());
        state.push(agentManager.criticalPoints.length);
        
        return state; // Array of 14 numbers
    }
    
    /**
     * Find the nearest unclaimed critical point
     */
    findNearestUnclaimedCP(agent, agentManager) {
        const agentPos = agent.getPosition();
        let nearest = null;
        let minDistance = Infinity;
        
        for (const cp of agentManager.criticalPoints) {
            // Check if this CP is unclaimed (not owned by any agent)
            const isUnclaimed = !agentManager.globalClaimedPoints.has(agentManager.criticalPoints.indexOf(cp));
            
            if (isUnclaimed) {
                const distance = agentPos.distanceTo(cp.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = cp;
                }
            }
        }
        
        // If no unclaimed CPs, use the first available CP as fallback
        if (!nearest && agentManager.criticalPoints.length > 0) {
            nearest = agentManager.criticalPoints[0];
            minDistance = agentPos.distanceTo(nearest.position);
        }
        
        // Return fallback data if no CPs exist
        if (!nearest) {
            return { x: 0, z: 0, distance: 10, isOwned: false };
        }
        
        return {
            x: nearest.position.x,
            z: nearest.position.z,
            distance: minDistance,
            isOwned: false // We only consider unclaimed CPs
        };
    }
    
    /**
     * Check if agent can move in a specific direction (simplified wall detection)
     */
    canMoveInDirection(agent, deltaX, deltaY, deltaZ) {
        const currentPos = agent.getPosition();
        const testPos = new T.Vector3(
            currentPos.x + deltaX * 0.5,
            currentPos.y + deltaY,
            currentPos.z + deltaZ * 0.5
        );
        
        // Simple bounds check for the maze area (adjust based on your maze size)
        const bounds = 4; // Assumes maze is roughly -4 to +4
        if (testPos.x < -bounds || testPos.x > bounds || 
            testPos.z < -bounds || testPos.z > bounds) {
            return false;
        }
        
        // Check against maze blocks if available
        if (window.mapLayout && window.mapLayout.blocks) {
            for (const block of window.mapLayout.blocks) {
                const blockPos = block.position;
                if (Math.abs(testPos.x - blockPos.x) < 0.5 && 
                    Math.abs(testPos.z - blockPos.z) < 0.5) {
                    return false; // Block detected
                }
            }
        }
        
        return true; // Path is clear
    }
}

/**
 * Action Recorder - Converts agent movement to action numbers
 */
class ActionRecorder {
    getCurrentAction(agent) {
        // Check which direction agent is currently moving
        if (agent.movement.w) return 0; // Forward
        if (agent.movement.a) return 1; // Left  
        if (agent.movement.s) return 2; // Back
        if (agent.movement.d) return 3; // Right
        return 0; // Default to forward if no movement
    }
}

/**
 * Reward Calculator - Scores agent actions
 */
class RewardCalculator {
    constructor() {
        this.lastCapturedCount = new Map(); // Track captured CPs per agent
    }
    
    calculateReward(agent, oldState, newState, action) {
        let reward = 0;
        
        // Initialize tracking for this agent if needed
        if (!this.lastCapturedCount.has(agent.agentId)) {
            this.lastCapturedCount.set(agent.agentId, agent.getScore());
        }
        
        // Did agent capture a critical point? BIG REWARD!
        const currentScore = agent.getScore();
        const lastScore = this.lastCapturedCount.get(agent.agentId);
        if (currentScore > lastScore) {
            reward += 100;
            console.log(`Agent ${agent.agentId} captured CP! +100 reward`);
            this.lastCapturedCount.set(agent.agentId, currentScore);
        }
        
        // Did agent get closer to nearest unclaimed CP?
        const oldDistance = oldState[4]; // Distance was 5th element
        const newDistance = newState[4];
        if (newDistance < oldDistance) {
            reward += 2; // Small reward for moving toward goal
        } else if (newDistance > oldDistance) {
            reward -= 1; // Small penalty for moving away
        }
        
        // Did agent hit a wall or not move? (position didn't change much)
        const oldX = oldState[0], oldZ = oldState[1];
        const newX = newState[0], newZ = newState[1];
        const movement = Math.abs(newX - oldX) + Math.abs(newZ - oldZ);
        
        if (movement < 0.01) { // Very little movement
            reward -= 5; // Penalty for getting stuck
        } else {
            reward += 0.1; // Tiny reward just for moving
        }
        
        return reward;
    }
}

/**
 * Experience Buffer - Stores training data
 */
class ExperienceBuffer {
    constructor() {
        this.experiences = [];
        this.maxSize = 10000; // Keep last 10k experiences
    }
    
    addExperience(state, action, reward, nextState, done = false) {
        this.experiences.push({
            state: [...state],        // Copy arrays to avoid reference issues
            action: action,
            reward: reward,
            nextState: [...nextState],
            done: done
        });
        
        // Keep buffer from getting too big
        if (this.experiences.length > this.maxSize) {
            this.experiences.shift(); // Remove oldest experience
        }
        
        // Log progress every 100 experiences
        if (this.experiences.length % 100 === 0) {
            console.log(`Collected ${this.experiences.length} training experiences`);
        }
    }
    
    getExperienceCount() {
        return this.experiences.length;
    }
    
    getAllExperiences() {
        return this.experiences;
    }
    
    exportData() {
        const data = JSON.stringify(this.experiences, null, 2);
        console.log("\n=== TRAINING DATA READY ===");
        console.log(`Total experiences: ${this.experiences.length}`);
        console.log("Copy the following data for Phase 2 training:");
        console.log(data);
        return data;
    }
    
    clear() {
        this.experiences = [];
        console.log("Experience buffer cleared");
    }
}

/**
 * Main DQN Data Collection System
 */
class DQNDataCollector {
    constructor() {
        this.stateObserver = new StateObserver();
        this.actionRecorder = new ActionRecorder();
        this.rewardCalculator = new RewardCalculator();
        this.experienceBuffer = new ExperienceBuffer();
        
        this.isCollecting = false;
        this.agentLastStates = new Map(); // Store last state for each agent
        this.agentLastActions = new Map(); // Store last action for each agent
    }
    
    startCollection() {
        this.isCollecting = true;
        this.experienceBuffer.clear();
        console.log("Started DQN data collection");
    }
    
    stopCollection() {
        this.isCollecting = false;
        console.log(`Stopped DQN data collection. Total experiences: ${this.experienceBuffer.getExperienceCount()}`);
    }
    
    /**
     * Called from Agent.update() when in training mode
     */
    collectExperience(agent, agentManager) {
        if (!this.isCollecting) return;
        
        // 1. Observe current state
        const currentState = this.stateObserver.getState(agent, agentManager);
        
        // 2. Record current action
        const action = this.actionRecorder.getCurrentAction(agent);
        
        // 3. If we have a previous state, calculate reward and store experience
        const agentId = agent.agentId;
        if (this.agentLastStates.has(agentId)) {
            const lastState = this.agentLastStates.get(agentId);
            const lastAction = this.agentLastActions.get(agentId);
            
            // Calculate reward for the previous action
            const reward = this.rewardCalculator.calculateReward(agent, lastState, currentState, lastAction);
            
            // Store the experience
            this.experienceBuffer.addExperience(lastState, lastAction, reward, currentState, false);
        }
        
        // 4. Remember current state and action for next frame
        this.agentLastStates.set(agentId, currentState);
        this.agentLastActions.set(agentId, action);
    }
    
    getStats() {
        return {
            collecting: this.isCollecting,
            experienceCount: this.experienceBuffer.getExperienceCount(),
            maxExperiences: this.experienceBuffer.maxSize
        };
    }
    
    exportTrainingData() {
        return this.experienceBuffer.exportData();
    }
}

// Export classes for use in other files
export { DQNDataCollector, StateObserver, ActionRecorder, RewardCalculator, ExperienceBuffer };

// Create global instance
window.DQNDataCollector = DQNDataCollector;
