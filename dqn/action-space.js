/**
 * Action Space Definition
 * Clean, focused module for defining and managing agent actions for DQN
 * 
 * Core Action Components:
 * 1. Action definitions and encoding
 * 2. Action validation (can this action be taken?)
 * 3. Action execution (convert action to agent movement)
 */

export class ActionSpace {
    constructor() {
        // Define all possible actions
        this.actions = {
            MOVE_FORWARD: 0,
            MOVE_LEFT: 1,
            MOVE_BACK: 2,
            MOVE_RIGHT: 3,
            // Future actions could include:
            // JUMP: 4,
            // CLAIM_CP: 5,
            // NO_ACTION: 6
        };
        
        // Reverse mapping for decoding
        this.actionNames = Object.keys(this.actions);
        this.actionCount = this.actionNames.length;
        
        // Movement parameters
        this.moveDistance = 0.05; // Same as AGENT_SPEED from Agent.js
    }

    /**
     * Get total number of possible actions
     * @returns {number} Number of actions in the action space
     */
    getActionCount() {
        return this.actionCount;
    }

    /**
     * Get all action definitions
     * @returns {Object} Action definitions with names and IDs
     */
    getActions() {
        return { ...this.actions };
    }

    /**
     * Convert action ID to action name
     * @param {number} actionId - The action ID (0, 1, 2, 3...)
     * @returns {string} Action name (MOVE_FORWARD, MOVE_LEFT, etc.)
     */
    getActionName(actionId) {
        if (actionId < 0 || actionId >= this.actionCount) {
            return 'INVALID_ACTION';
        }
        return this.actionNames[actionId];
    }

    /**
     * Convert action name to action ID
     * @param {string} actionName - The action name
     * @returns {number} Action ID or -1 if invalid
     */
    getActionId(actionName) {
        return this.actions[actionName] !== undefined ? this.actions[actionName] : -1;
    }

    /**
     * Check if an action is valid given the current state
     * @param {number} actionId - The action to validate
     * @param {Agent} agent - The agent attempting the action
     * @param {Object} gameState - Current game state from GameStateExtractor
     * @param {Object} levelDataOrMapLayout - Level data for collision checking
     * @returns {boolean} True if action is valid, false otherwise
     */
    isActionValid(actionId, agent, gameState, levelDataOrMapLayout) {
        if (actionId < 0 || actionId >= this.actionCount) {
            return false;
        }

        const actionName = this.getActionName(actionId);
        
        switch (actionName) {
            case 'MOVE_FORWARD':
                return gameState?.maze?.movement?.canMoveForward || false;
            case 'MOVE_LEFT':
                return gameState?.maze?.movement?.canMoveLeft || false;
            case 'MOVE_BACK':
                return gameState?.maze?.movement?.canMoveBack || false;
            case 'MOVE_RIGHT':
                return gameState?.maze?.movement?.canMoveRight || false;
            default:
                return false;
        }
    }

    /**
     * Execute an action on an agent
     * @param {number} actionId - The action to execute
     * @param {Agent} agent - The agent to move
     * @returns {Object} Result of action execution
     */
    executeAction(actionId, agent) {
        if (actionId < 0 || actionId >= this.actionCount) {
            return {
                success: false,
                message: 'Invalid action ID',
                actionTaken: 'INVALID_ACTION'
            };
        }

        const actionName = this.getActionName(actionId);
        let success = false;

        try {
            // Clear all movement flags first
            agent.movement = {
                w: false,
                a: false,
                s: false,
                d: false,
                space: false,
                spaceHold: false
            };

            // Set the appropriate movement flag
            switch (actionName) {
                case 'MOVE_FORWARD':
                    agent.movement.w = true;
                    success = true;
                    break;
                case 'MOVE_LEFT':
                    agent.movement.a = true;
                    success = true;
                    break;
                case 'MOVE_BACK':
                    agent.movement.s = true;
                    success = true;
                    break;
                case 'MOVE_RIGHT':
                    agent.movement.d = true;
                    success = true;
                    break;
                default:
                    success = false;
                    break;
            }

        } catch (error) {
            console.error('Error executing action:', error);
            success = false;
        }

        return {
            success: success,
            message: success ? `Executed ${actionName}` : `Failed to execute ${actionName}`,
            actionTaken: actionName
        };
    }

    /**
     * Get a random valid action for the given state
     * @param {Agent} agent - The agent
     * @param {Object} gameState - Current game state
     * @param {Object} levelDataOrMapLayout - Level data
     * @returns {number} Random valid action ID
     */
    getRandomValidAction(agent, gameState, levelDataOrMapLayout) {
        const validActions = [];
        
        for (let actionId = 0; actionId < this.actionCount; actionId++) {
            if (this.isActionValid(actionId, agent, gameState, levelDataOrMapLayout)) {
                validActions.push(actionId);
            }
        }
        
        if (validActions.length === 0) {
            // If no actions are valid, return MOVE_FORWARD as fallback
            return this.actions.MOVE_FORWARD;
        }
        
        const randomIndex = Math.floor(Math.random() * validActions.length);
        return validActions[randomIndex];
    }

    /**
     * Get action mask for neural network (1 for valid actions, 0 for invalid)
     * @param {Agent} agent - The agent
     * @param {Object} gameState - Current game state
     * @param {Object} levelDataOrMapLayout - Level data
     * @returns {Array<number>} Action mask array
     */
    getActionMask(agent, gameState, levelDataOrMapLayout) {
        const mask = [];
        
        for (let actionId = 0; actionId < this.actionCount; actionId++) {
            mask.push(this.isActionValid(actionId, agent, gameState, levelDataOrMapLayout) ? 1 : 0);
        }
        
        return mask;
    }

    /**
     * Get human-readable description of an action
     * @param {number} actionId - The action ID
     * @returns {string} Human-readable description
     */
    getActionDescription(actionId) {
        const actionName = this.getActionName(actionId);
        
        const descriptions = {
            'MOVE_FORWARD': 'Move forward (negative Z direction)',
            'MOVE_LEFT': 'Move left (negative X direction)',
            'MOVE_BACK': 'Move backward (positive Z direction)',
            'MOVE_RIGHT': 'Move right (positive X direction)',
            'INVALID_ACTION': 'Invalid action ID'
        };
        
        return descriptions[actionName] || 'Unknown action';
    }

    /**
     * Get action space information for debugging/logging
     * @returns {Object} Action space summary
     */
    getActionSpaceInfo() {
        const info = {
            totalActions: this.actionCount,
            actions: {}
        };
        
        for (let actionId = 0; actionId < this.actionCount; actionId++) {
            const actionName = this.getActionName(actionId);
            info.actions[actionId] = {
                name: actionName,
                description: this.getActionDescription(actionId)
            };
        }
        
        return info;
    }

    /**
     * Validate action space consistency
     * @returns {Object} Validation results
     */
    validateActionSpace() {
        const issues = [];
        
        // Check that action IDs are sequential starting from 0
        for (let i = 0; i < this.actionCount; i++) {
            if (!this.actionNames[i]) {
                issues.push(`Missing action name for ID ${i}`);
            }
        }
        
        // Check for duplicate action IDs
        const actionIds = Object.values(this.actions);
        const uniqueIds = new Set(actionIds);
        if (actionIds.length !== uniqueIds.size) {
            issues.push('Duplicate action IDs found');
        }
        
        return {
            isValid: issues.length === 0,
            issues: issues,
            actionCount: this.actionCount
        };
    }
}

// Global instance for easy access
export const actionSpace = new ActionSpace();

// Export for direct use
export default ActionSpace;
