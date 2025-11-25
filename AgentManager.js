import Agent from './Agent.js';

/**
 * AgentManager - Manages multiple agents and their line of sight interactions
 */
class AgentManager {
    constructor(scene, collisionWorld) {
        this.scene = scene;
        this.collisionWorld = collisionWorld;
        this.agents = [];
        this.criticalPoints = [];
        this.obstacles = [];
        this.globalClaimedPoints = new Set(); // Track which critical points are claimed
        
        // Predefined agent colors
        this.agentColors = [
            0xff0000, // Red
            0x00ff00, // Green  
            0x0000ff, // Blue
            0xffff00, // Yellow
            0xff00ff, // Magenta
            0x00ffff, // Cyan
            0xff8000, // Orange
            0x8000ff, // Purple
            0x80ff00, // Lime
            0xff0080  // Pink
        ];
    }

    /**
     * Create and add a new agent
     * @param {T.Vector3} position - Starting position for the agent
     * @returns {Agent} The created agent
     */
    createAgent(position = new T.Vector3(0, 1, 0)) {
        const agentId = this.agents.length;
        const agentColor = this.agentColors[agentId % this.agentColors.length];
        
        const agent = new Agent(null, this.collisionWorld, agentId, agentColor);
        agent.setPosition(position);
        
        // Add agent to scene
        this.scene.add(agent.object);
        this.agents.push(agent);
        
        console.log(`Created agent ${agentId} with color ${agentColor.toString(16)}`);
        return agent;
    }

    /**
     * Add a critical point to track
     * @param {T.Vector3} position - Position of the critical point
     * @param {T.Mesh} mesh - The mesh object of the critical point
     */
    addCriticalPoint(position, mesh) {
        this.criticalPoints.push({
            position: position.clone(),
            mesh: mesh,
            originalColor: mesh.material.color.getHex()
        });
        console.log(`Added critical point ${this.criticalPoints.length - 1} at position:`, position);
    }

    /**
     * Add obstacles for line of sight calculations
     * @param {Array} obstacleObjects - Array of Three.js objects that block line of sight
     */
    addObstacles(obstacleObjects) {
        this.obstacles = this.obstacles.concat(obstacleObjects);
    }

    /**
     * Update all agents' line of sight
     */
    updateAllLineOfSight() {
        // Clear all existing lines first
        this.agents.forEach(agent => {
            agent.clearLOSLines(this.scene);
            agent.claimedCriticalPoints.clear(); // Clear claimed points for fresh calculation
        });
        
        // Clear globally claimed points
        this.globalClaimedPoints.clear();
        
        // Debug logging
        console.log(`Checking LOS for ${this.criticalPoints.length} critical points with ${this.agents.length} agents`);
        
        // For each critical point, find which agents can see it and resolve conflicts
        this.criticalPoints.forEach((cp, pointIndex) => {
            const agentsWithLOS = [];
            
            // Find all agents that have line of sight to this critical point
            this.agents.forEach(agent => {
                if (agent.hasLineOfSight(cp.position, this.obstacles)) {
                    agentsWithLOS.push(agent);
                }
            });
            
            // Debug logging for each critical point
            if (agentsWithLOS.length > 0) {
                console.log(`CP ${pointIndex}: ${agentsWithLOS.length} agents can see it`);
            }
            
            // If multiple agents can see it, only the first one gets to claim it
            // This prevents conflicts as specified in the requirements
            if (agentsWithLOS.length > 0) {
                const claimingAgent = agentsWithLOS[0]; // First agent wins
                
                // Only the claiming agent gets to draw a line and claim the point
                claimingAgent.claimedCriticalPoints.add(pointIndex);
                this.globalClaimedPoints.add(pointIndex);
                
                // Create visual line for the claiming agent
                claimingAgent.createLOSLine(cp.position, this.scene);
                
                // Color the critical point with the claiming agent's color
                if (cp.mesh && cp.mesh.material) {
                    cp.mesh.material.color.setHex(claimingAgent.agentColor);
                    
                    // Also color the glow if it exists
                    if (cp.mesh.children && cp.mesh.children.length > 0) {
                        cp.mesh.children.forEach(child => {
                            if (child.material) {
                                child.material.color.setHex(claimingAgent.agentColor);
                            }
                        });
                    }
                }
                
                console.log(`Agent ${claimingAgent.agentId} claimed CP ${pointIndex}`);
            }
        });
    }

    /**
     * Update all agents (movement and line of sight)
     */
    update() {
        // Update agent movement
        this.agents.forEach(agent => {
            agent.update();
        });
        
        // Update line of sight every few frames to avoid performance issues
        if (this.updateCounter === undefined) this.updateCounter = 0;
        this.updateCounter++;
        
        if (this.updateCounter % 5 === 0) { // Update LOS every 5 frames
            this.updateAllLineOfSight();
        }
    }

    /**
     * Get scores for all agents
     * @returns {Array} Array of {agentId, color, score} objects
     */
    getScores() {
        return this.agents.map(agent => ({
            agentId: agent.agentId,
            color: agent.agentColor,
            score: agent.getScore()
        }));
    }



    /**
     * Get agent by ID
     * @param {number} agentId - ID of the agent
     * @returns {Agent|null} The agent or null if not found
     */
    getAgent(agentId) {
        return this.agents.find(agent => agent.agentId === agentId) || null;
    }

    /**
     * Remove an agent
     * @param {number} agentId - ID of the agent to remove
     */
    removeAgent(agentId) {
        const agentIndex = this.agents.findIndex(agent => agent.agentId === agentId);
        if (agentIndex !== -1) {
            const agent = this.agents[agentIndex];
            agent.clearLOSLines(this.scene);
            this.scene.remove(agent.object);
            this.agents.splice(agentIndex, 1);
        }
    }
}

export default AgentManager;
