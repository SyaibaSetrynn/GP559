/**
 * Game State Extractor
 * Clean, focused module for extracting all game state information
 * 
 * Core State Components:
 * 1. Where I am (agent position)
 * 2. How many are my color (score/ownership)  
 * 3. Where walls/blocks are (maze layout)
 */

import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";

export class GameStateExtractor {
    constructor() {
        this.currentLevel = 0; // Will be set when needed
    }

    /**
     * Get complete game state for an agent
     * @param {Agent} agent - The agent to get state for
     * @param {AgentManager} agentManager - Agent manager instance
     * @param {LevelContent3D|Object} levelDataOrMapLayout - Level content or mapLayout for maze data
     * @param {CriticalPointSystem} criticalPointSystem - CP system instance
     * @returns {Object} Complete game state
     */
    getCompleteState(agent, agentManager, levelDataOrMapLayout, criticalPointSystem) {
        return {
            // Core minimal state
            agent: this.getAgentState(agent),
            score: this.getScoreState(agent, criticalPointSystem),
            maze: this.getMazeState(agent, levelDataOrMapLayout),
            
            // Extended state (for richer DQN training)
            criticalPoints: this.getCriticalPointsState(agent, criticalPointSystem),
            visibility: this.getVisibilityState(agent, criticalPointSystem, agentManager.obstacles),
            
            // Context information
            gameContext: this.getGameContext(agentManager, criticalPointSystem)
        };
    }

    /**
     * Get minimal DQN state vector (8-12 numbers)
     * @param {Agent} agent 
     * @param {AgentManager} agentManager 
     * @param {LevelContent3D|Object} levelDataOrMapLayout 
     * @param {CriticalPointSystem} criticalPointSystem 
     * @returns {Array<number>} Fixed-size state array
     */
    getMinimalStateVector(agent, agentManager, levelDataOrMapLayout, criticalPointSystem) {
        const state = [];
        
        try {
            // 1. WHERE I AM (2 values)
            const position = this.getAgentPosition(agent);
            state.push(position.x);
            state.push(position.z);
            
            // 2. HOW MANY ARE MY COLOR (2 values)
            const scoreInfo = this.getAgentScore(agent, criticalPointSystem);
            state.push(scoreInfo.myScore);        // CPs I own
            state.push(scoreInfo.totalCPs);       // Total CPs in game
            
            // 3. WHERE WALLS/BLOCKS ARE (4 values) - movement feasibility
            const movement = this.getMovementFeasibility(agent, levelDataOrMapLayout);
            state.push(movement.canMoveForward ? 1 : 0);
            state.push(movement.canMoveLeft ? 1 : 0);
            state.push(movement.canMoveBack ? 1 : 0);
            state.push(movement.canMoveRight ? 1 : 0);
            
            // BONUS: Nearest unclaimed CP direction (2 values)
            const nearestCP = this.getNearestUnclaimedCP(agent, criticalPointSystem);
            if (nearestCP) {
                state.push(nearestCP.relativeX);  // Direction to nearest CP
                state.push(nearestCP.relativeZ);
            } else {
                state.push(0);
                state.push(0);
            }
            
        } catch (error) {
            console.error('Error extracting minimal state:', error);
            // Return safe fallback state
            return [0, 0, 0, 0, 1, 1, 1, 1, 0, 0]; // 10 values
        }
        
        return state; // Should be exactly 10 values
    }

    /**
     * 1. WHERE I AM - Get agent position
     */
    getAgentPosition(agent) {
        try {
            if (agent.camera && agent.camera.position) {
                return {
                    x: agent.camera.position.x,
                    y: agent.camera.position.y, 
                    z: agent.camera.position.z
                };
            } else if (agent.mesh && agent.mesh.position) {
                return {
                    x: agent.mesh.position.x,
                    y: agent.mesh.position.y,
                    z: agent.mesh.position.z
                };
            } else if (agent.getPosition) {
                const pos = agent.getPosition();
                return { x: pos.x, y: pos.y, z: pos.z };
            }
        } catch (error) {
            console.warn('Could not get agent position:', error);
        }
        
        return { x: 0, y: 0, z: 0 }; // Fallback
    }

    /**
     * Get full agent state information
     */
    getAgentState(agent) {
        const position = this.getAgentPosition(agent);
        
        return {
            id: agent.agentId,
            color: agent.agentColor,
            position: position,
            movement: agent.movement ? { ...agent.movement } : {},
            onGround: agent.onGround || false
        };
    }

    /**
     * 2. HOW MANY ARE MY COLOR - Get score/ownership info
     */
    getAgentScore(agent, criticalPointSystem) {
        let myScore = 0;
        let totalCPs = 0;
        let neutralCPs = 0;

        try {
            if (criticalPointSystem && criticalPointSystem.cpRegistry) {
                totalCPs = criticalPointSystem.cpRegistry.size;
                
                // Count CPs owned by this agent
                if (criticalPointSystem.cpsByOwner && criticalPointSystem.cpsByOwner.has(agent.agentColor)) {
                    myScore = criticalPointSystem.cpsByOwner.get(agent.agentColor).length;
                }
                
                // Count neutral CPs
                criticalPointSystem.cpRegistry.forEach(cpData => {
                    if (cpData.ownedBy === null) {
                        neutralCPs++;
                    }
                });
            }
            
            // Fallback: use agent's claimed points if available
            if (myScore === 0 && agent.claimedCriticalPoints) {
                myScore = agent.claimedCriticalPoints.size;
            }
            
        } catch (error) {
            console.warn('Could not get agent score:', error);
        }

        return {
            myScore,
            totalCPs,
            neutralCPs,
            ownedByOthers: totalCPs - myScore - neutralCPs
        };
    }

    /**
     * Get detailed score state
     */
    getScoreState(agent, criticalPointSystem) {
        const scoreInfo = this.getAgentScore(agent, criticalPointSystem);
        
        return {
            ...scoreInfo,
            winningRate: scoreInfo.totalCPs > 0 ? scoreInfo.myScore / scoreInfo.totalCPs : 0,
            remainingTargets: scoreInfo.neutralCPs
        };
    }

    /**
     * 3. WHERE WALLS/BLOCKS ARE - Get movement feasibility
     */
    getMovementFeasibility(agent, levelDataOrMapLayout) {
        const position = this.getAgentPosition(agent);
        const moveDistance = 0.5; // Test movement distance
        
        return {
            canMoveForward: this.canMoveInDirection(position, 0, 0, -moveDistance, levelDataOrMapLayout),
            canMoveLeft: this.canMoveInDirection(position, -moveDistance, 0, 0, levelDataOrMapLayout),
            canMoveBack: this.canMoveInDirection(position, 0, 0, moveDistance, levelDataOrMapLayout),
            canMoveRight: this.canMoveInDirection(position, moveDistance, 0, 0, levelDataOrMapLayout)
        };
    }

    /**
     * Check if agent can move in a specific direction (updated to work with both formats)
     */
    canMoveInDirection(position, deltaX, deltaY, deltaZ, levelDataOrMapLayout) {
        const testPos = {
            x: position.x + deltaX,
            y: position.y + deltaY,
            z: position.z + deltaZ
        };

        // Method 1: Check against maze blocks using adapter
        const blocks = this.getMazeBlocks(levelDataOrMapLayout);
        if (blocks && blocks.length > 0) {
            for (const block of blocks) {
                if (block.position) {
                    const distance = Math.sqrt(
                        Math.pow(testPos.x - block.position.x, 2) + 
                        Math.pow(testPos.z - block.position.z, 2)
                    );
                    if (distance < 0.8) { // Block collision threshold
                        return false;
                    }
                }
            }
        }

        // Method 2: Check bounds (maze boundaries) using adapter
        const bounds = this.getMazeBoundsFromData(levelDataOrMapLayout);
        if (testPos.x < bounds.minX || testPos.x > bounds.maxX || 
            testPos.z < bounds.minZ || testPos.z > bounds.maxZ) {
            return false;
        }

        return true; // Path is clear
    }

    /**
     * Get maze layout information
     */
    getMazeState(agent, levelDataOrMapLayout) {
        const position = this.getAgentPosition(agent);
        const currentLevel = this.getCurrentLevel(levelDataOrMapLayout);
        
        const state = {
            currentLevel,
            bounds: this.getMazeBoundsFromData(levelDataOrMapLayout),
            movement: this.getMovementFeasibility(agent, levelDataOrMapLayout),
            
            // Local area info (3x3 grid around agent)
            localGrid: this.getLocalGrid(position, levelDataOrMapLayout),
            
            // Distance to nearest walls in each direction
            wallDistances: this.getWallDistances(position, levelDataOrMapLayout)
        };

        return state;
    }

    /**
     * Get 3x3 grid around agent position
     */
    getLocalGrid(position, levelDataOrMapLayout, gridSize = 3) {
        const grid = [];
        const halfSize = Math.floor(gridSize / 2);
        const blocks = this.getMazeBlocks(levelDataOrMapLayout);
        
        for (let dx = -halfSize; dx <= halfSize; dx++) {
            for (let dz = -halfSize; dz <= halfSize; dz++) {
                const testPos = {
                    x: position.x + dx,
                    z: position.z + dz
                };
                
                // Check if there's a wall/block at this position
                let hasWall = false;
                for (const block of blocks) {
                    if (block.position) {
                        const distance = Math.sqrt(
                            Math.pow(testPos.x - block.position.x, 2) + 
                            Math.pow(testPos.z - block.position.z, 2)
                        );
                        if (distance < 0.7) {
                            hasWall = true;
                            break;
                        }
                    }
                }
                
                grid.push({
                    x: dx,
                    z: dz,
                    hasWall,
                    worldX: testPos.x,
                    worldZ: testPos.z
                });
            }
        }
        
        return grid;
    }

    /**
     * Get distances to nearest walls in each direction
     */
    getWallDistances(position, levelDataOrMapLayout) {
        const maxDistance = 10;
        const directions = [
            { name: 'forward', dx: 0, dz: -1 },
            { name: 'left', dx: -1, dz: 0 },
            { name: 'back', dx: 0, dz: 1 },
            { name: 'right', dx: 1, dz: 0 }
        ];

        const distances = {};
        
        for (const dir of directions) {
            let distance = 0;
            let found = false;
            
            for (let step = 0.5; step <= maxDistance; step += 0.5) {
                const testPos = {
                    x: position.x + dir.dx * step,
                    z: position.z + dir.dz * step
                };
                
                if (!this.canMoveInDirection(position, dir.dx * step, 0, dir.dz * step, levelDataOrMapLayout)) {
                    distance = step;
                    found = true;
                    break;
                }
            }
            
            distances[dir.name] = found ? distance : maxDistance;
        }
        
        return distances;
    }

    /**
     * Get critical points state
     */
    getCriticalPointsState(agent, criticalPointSystem) {
        const allCPs = [];
        const myCPs = [];
        const neutralCPs = [];
        const othersCPs = [];

        try {
            if (criticalPointSystem && criticalPointSystem.cpRegistry) {
                criticalPointSystem.cpRegistry.forEach(cpData => {
                    const cpInfo = {
                        id: cpData.id,
                        position: cpData.position ? { ...cpData.position } : null,
                        ownedBy: cpData.ownedBy,
                        isActivelyClaimed: cpData.isActivelyClaimed,
                        claimedBy: cpData.claimedBy
                    };
                    
                    allCPs.push(cpInfo);
                    
                    if (cpData.ownedBy === agent.agentColor) {
                        myCPs.push(cpInfo);
                    } else if (cpData.ownedBy === null) {
                        neutralCPs.push(cpInfo);
                    } else {
                        othersCPs.push(cpInfo);
                    }
                });
            }
        } catch (error) {
            console.warn('Could not get critical points state:', error);
        }

        return {
            all: allCPs,
            mine: myCPs,
            neutral: neutralCPs,
            others: othersCPs,
            total: allCPs.length
        };
    }

    /**
     * Get nearest unclaimed critical point
     */
    getNearestUnclaimedCP(agent, criticalPointSystem) {
        const agentPos = this.getAgentPosition(agent);
        let nearest = null;
        let minDistance = Infinity;

        try {
            if (criticalPointSystem && criticalPointSystem.cpRegistry) {
                criticalPointSystem.cpRegistry.forEach(cpData => {
                    if (cpData.ownedBy === null && cpData.position) {
                        const distance = Math.sqrt(
                            Math.pow(agentPos.x - cpData.position.x, 2) +
                            Math.pow(agentPos.z - cpData.position.z, 2)
                        );
                        
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearest = {
                                id: cpData.id,
                                position: { ...cpData.position },
                                distance,
                                relativeX: cpData.position.x - agentPos.x,
                                relativeZ: cpData.position.z - agentPos.z
                            };
                        }
                    }
                });
            }
        } catch (error) {
            console.warn('Could not find nearest unclaimed CP:', error);
        }

        return nearest;
    }

    /**
     * Get visibility/line-of-sight state
     */
    getVisibilityState(agent, criticalPointSystem, obstacles = []) {
        const visibleCPs = [];
        const hiddenCPs = [];
        
        // This would use the existing line-of-sight system from Agent.js
        // For now, return basic structure
        
        return {
            visibleCPs,
            hiddenCPs,
            totalVisible: visibleCPs.length,
            totalHidden: hiddenCPs.length
        };
    }

    /**
     * Get game context information
     */
    getGameContext(agentManager, criticalPointSystem) {
        return {
            totalAgents: agentManager.agents ? agentManager.agents.length : 0,
            totalCriticalPoints: criticalPointSystem?.cpRegistry?.size || 0,
            gameTime: Date.now(), // Could be enhanced with actual game time
        };
    }

    /**
     * Helper: Get current level
     */
    getCurrentLevel(levelContent3D) {
        // Try to determine current level from context
        // This might need to be passed in or stored globally
        return this.currentLevel;
    }

    /**
     * Helper: Get maze boundaries
     */
    getMazeBounds(levelContent3D) {
        const currentLevel = this.getCurrentLevel(levelContent3D);
        
        // Default bounds based on level
        const levelBounds = {
            0: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },    // 10x10
            1: { minX: -7, maxX: 7, minZ: -7, maxZ: 7 },    // 14x14
            2: { minX: -9, maxX: 9, minZ: -9, maxZ: 9 }     // 18x18
        };
        
        return levelBounds[currentLevel] || levelBounds[0];
    }

    /**
     * Set current level (call this when level changes)
     */
    setCurrentLevel(level) {
        this.currentLevel = level;
    }

    /**
     * Debug: Get human-readable state summary
     */
    getStateSummary(agent, agentManager, levelDataOrMapLayout, criticalPointSystem) {
        const state = this.getCompleteState(agent, agentManager, levelDataOrMapLayout, criticalPointSystem);
        
        return {
            position: `(${state.agent.position.x.toFixed(1)}, ${state.agent.position.z.toFixed(1)})`,
            score: `${state.score.myScore}/${state.score.totalCPs} CPs owned`,
            movement: `Can move: ${Object.entries(state.maze.movement).filter(([k,v]) => v).map(([k,v]) => k.replace('canMove', '')).join(', ')}`,
            nearestCP: state.criticalPoints.neutral.length > 0 ? 
                `${state.criticalPoints.neutral[0].id} at distance ${Math.sqrt(Math.pow(state.criticalPoints.neutral[0].position.x - state.agent.position.x, 2) + Math.pow(state.criticalPoints.neutral[0].position.z - state.agent.position.z, 2)).toFixed(1)}` : 
                'None available'
        };
    }

    /**
     * ADAPTER METHODS for different data formats
     * Handle both levelContent3D (from LevelContent3D.js) and mapLayout (from AgentTestMain.js)
     */

    /**
     * Get maze blocks from either levelContent3D or mapLayout format
     */
    getMazeBlocks(levelDataOrMapLayout) {
        // Handle levelContent3D format
        if (levelDataOrMapLayout?.mazeBlocks) {
            const currentLevel = this.getCurrentLevel(levelDataOrMapLayout);
            return levelDataOrMapLayout.mazeBlocks[currentLevel] || [];
        }
        
        // Handle mapLayout format (from AgentTestMain.js)
        if (levelDataOrMapLayout?.blocks) {
            return levelDataOrMapLayout.blocks;
        }
        
        return [];
    }

    /**
     * Get maze bounds from either format
     */
    getMazeBoundsFromData(levelDataOrMapLayout) {
        // Handle mapLayout format first (from AgentTestMain.js)
        if (levelDataOrMapLayout?.width && levelDataOrMapLayout?.depth) {
            const halfWidth = levelDataOrMapLayout.width / 2;
            const halfDepth = levelDataOrMapLayout.depth / 2;
            return {
                minX: -halfWidth,
                maxX: halfWidth,
                minZ: -halfDepth,
                maxZ: halfDepth
            };
        }
        
        // Fall back to levelContent3D format
        return this.getMazeBounds(levelDataOrMapLayout);
    }

    /**
     * Updated canMoveInDirection to work with both formats
     */
    canMoveInDirection(position, deltaX, deltaY, deltaZ, levelDataOrMapLayout) {
        const testPos = {
            x: position.x + deltaX,
            y: position.y + deltaY,
            z: position.z + deltaZ
        };

        // Method 1: Check against maze blocks directly
        const blocks = this.getMazeBlocks(levelDataOrMapLayout);
        if (blocks && blocks.length > 0) {
            for (const block of blocks) {
                if (block.position) {
                    const distance = Math.sqrt(
                        Math.pow(testPos.x - block.position.x, 2) + 
                        Math.pow(testPos.z - block.position.z, 2)
                    );
                    if (distance < 0.8) { // Block collision threshold
                        return false;
                    }
                }
            }
        }

        // Method 2: Check bounds (maze boundaries)
        const bounds = this.getMazeBoundsFromData(levelDataOrMapLayout);
        if (testPos.x < bounds.minX || testPos.x > bounds.maxX || 
            testPos.z < bounds.minZ || testPos.z > bounds.maxZ) {
            return false;
        }

        return true; // Path is clear
    }


}

// Global instance for easy access
export const gameStateExtractor = new GameStateExtractor();

// Export for direct use
export default GameStateExtractor;
