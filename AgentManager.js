import Agent from './Agent.js';
import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";

/**
 * AgentManager - Manages multiple agents and their line of sight interactions
 */
class AgentManager {
    constructor(scene, collisionWorld, criticalPointSystem = null) {
        this.scene = scene;
        this.collisionWorld = collisionWorld;
        this.criticalPointSystem = criticalPointSystem;
        this.agents = [];
        this.criticalPoints = [];
        this.obstacles = [];
        this.globalClaimedPoints = new Set(); // Track which critical points are claimed
        

        
        // Predefined agent colors
        this.agentColors = [
            0xff0000, // Red
            0x00ff00, // Green  
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

    }

    /**
     * Add obstacles for line of sight calculations
     * @param {Array} obstacleObjects - Array of Three.js objects that block line of sight
     */
    addObstacles(obstacleObjects) {
        this.obstacles = this.obstacles.concat(obstacleObjects);
    }

    /**
     * Update all agents' line of sight using their individual 3-point claiming system
     */
    updateAllLineOfSight() {
        // Use each agent's individual updateLineOfSight method which enforces 3-point limit
        this.agents.forEach(agent => {
            agent.updateLineOfSight(this.criticalPoints, this.obstacles, this.scene, this.globalClaimedPoints);
        });
    }

    /**
     * Update all agents (movement and line of sight)
     */
    update() {
        // Update agent movement (pass agentManager for DQN data collection)
        this.agents.forEach(agent => {
            agent.update(this);
        });
        
        // Update line of sight every few frames to avoid performance issues
        if (this.updateCounter === undefined) this.updateCounter = 0;
        this.updateCounter++;
        
        if (this.updateCounter % 3 === 0) { // Update LOS every 3 frames (reduced from 5 to minimize race conditions)
            this.updateAllLineOfSight();
        }
    }

    /**
     * Simple AI behavior - agents handle their own random movement now
     */
    updateSimpleAI() {
        // Agents now handle their own pure random movement in Agent.update()
        // This function can be used for other high-level AI logic if needed
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
    
    /**
     * Set mode for all agents
     */
    setAllAgentsMode(mode, dqnDataCollector = null, dqnAgentBehavior = null) {
        this.agents.forEach(agent => {
            agent.setMode(mode, dqnDataCollector, dqnAgentBehavior);
        });
        console.log(`All agents set to mode: ${mode}`);
    }
    
    /**
     * Set DQN behavior for all agents (for smart mode)
     */
    setAllAgentsDQNBehavior(dqnAgentBehavior) {
        this.agents.forEach(agent => {
            agent.setDQNBehavior(dqnAgentBehavior);
        });
        console.log(`DQN behavior set for all agents`);
    }
    
    /**
     * Get mode status for all agents
     */
    getAgentModes() {
        return this.agents.map(agent => ({
            agentId: agent.agentId,
            mode: agent.getMode()
        }));
    }

    /**
     * Update movement speed for all agents
     * @param {number} speed - New movement speed
     */
    setGlobalMovementSpeed(speed) {
        this.agents.forEach(agent => {
            agent.movementSpeed = speed;
        });
        console.log(`Updated all ${this.agents.length} agents to movement speed: ${speed}`);
    }

    /**
     * Get current movement speed from first agent (assuming all agents have same speed)
     * @returns {number} Current movement speed
     */
    getGlobalMovementSpeed() {
        return this.agents.length > 0 ? this.agents[0].movementSpeed : 0.025;
    }
}

export default AgentManager;
