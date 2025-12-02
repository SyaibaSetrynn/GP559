import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { Capsule } from "https://unpkg.com/three@0.165.0/examples/jsm/math/Capsule.js";

/**
 * Agent class - NPC version of Player with no vision/camera controls
 * Based on Player.js but designed for NPCs
 */

/**
 * Class for an agent/NPC in the game
 */
class Agent {
    /**
     * note: 
     * this.mesh: the group that holds mesh
     * this.camera: the camera (exists but not used for vision)
     * this.collider: the collider
     * they are all apart because putting in a group and update that group position doesn't work
     * this.mesh need to move with the camera, but can only rotate on z axis
     * @param {*} renderer 
     * @param {*} collisionWorld
     */
    constructor(renderer, collisionWorld, agentId = 0, agentColor = 0xff0000) {

        this.movement = {w: false, a: false, s: false, d: false, space: false, spaceHold: false};
        this.speedY = 0;
        
        // Agent identification and color
        this.agentId = agentId;
        this.agentColor = agentColor;
        
        // DQN mode switching
        this.mode = 'random'; // 'random', 'training', or 'dqn'
        this.dqnDataCollector = null;
        
        this.mesh = this.createObject();
        this.object = new T.Group();
        this.camera = new T.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, AGENT_HEIGHT, 0);
        this.collider = new Capsule(new T.Vector3(0, AGENT_HEIGHT/2, 0), new T.Vector3(0, AGENT_HEIGHT - AGENT_HEIGHT/4, 0), AGENT_HEIGHT/2);
        // Agent collider initialized
        this.object.add(this.mesh);
        this.object.add(this.camera);
        this.onGround = false;
        this.worldCollide = collisionWorld;

        // No pointer lock controls for NPC - agents don't have vision controls
        this.controls = null;
    
        // Agent-specific properties
        this.movementSpeed = AGENT_SPEED;
        
        // Line of sight properties
        this.losLines = []; // Store line objects for visual rendering
        this.claimedCriticalPoints = new Set(); // Critical points this agent has claimed
        this.raycaster = new T.Raycaster(); // For line of sight calculations
    }

    /**
     * Creates the mesh and collider bounding box for the agent
     * @returns a three js group that contains the mesh
     */
    createObject() {
        let characterGrp = new T.Group();
        const dummyGeo = new T.BoxGeometry(AGENT_HEIGHT, AGENT_HEIGHT, AGENT_HEIGHT);
        // Use the agent's assigned color with transparency
        const dummyMat = new T.MeshStandardMaterial({
            color: this.agentColor,
            transparent: true,
            opacity: 0.7
        });
        const dummyMesh = new T.Mesh(dummyGeo, dummyMat);
        // Position the cube so its bottom is at y=0 relative to the group
        // This way, when characterGrp is positioned at collider.start.y (bottom),
        // the cube's center will be at characterGrp.position.y + AGENT_HEIGHT/2
        dummyMesh.position.y = AGENT_HEIGHT / 2;
        characterGrp.add(dummyMesh);

        // Add a critical point at the exact center of the cube
        if (window.CriticalPointSystem && window.CP_COLORS) {
            // Create a small sphere for the critical point using the agent's color
            const cpGeometry = new T.SphereGeometry(0.08, 16, 16);
            const cpMaterial = new T.MeshBasicMaterial({
                color: this.agentColor,
                transparent: true,
                opacity: 1.0,
                depthTest: false,  // Makes it render on top of other objects
                depthWrite: false  // Prevents it from blocking other objects
            });
            const criticalPoint = new T.Mesh(cpGeometry, cpMaterial);
            
            // Add glow effect that's also visible through the body using agent's color
            const glowGeometry = new T.SphereGeometry(0.15, 16, 16);
            const glowMaterial = new T.MeshBasicMaterial({
                color: this.agentColor,
                transparent: true,
                opacity: 0.5,
                side: T.DoubleSide,
                depthTest: false,
                depthWrite: false
            });
            const glow = new T.Mesh(glowGeometry, glowMaterial);
            criticalPoint.add(glow);
            
            // Position at exact center of the cube (same Y as the cube center)
            criticalPoint.position.set(0, AGENT_HEIGHT / 2, 0);
            
            characterGrp.add(criticalPoint);
        }

        return characterGrp;
    }



    /**
     * Make the agent jump
     */
    jump() {
        if (this.onGround && !this.movement.spaceHold) {
            this.movement.space = true;
            this.movement.spaceHold = true;
            this.speedY = AGENT_JUMP_SPEED;
        }
    }

    /**
     * updates position of the agent, needs to be called in animate()
     */
    update(agentManager = null) {
        // Handle different modes
        switch(this.mode) {
            case 'training':
                this.updateTrainingMode(agentManager);
                break;
            case 'dqn':
                this.updateDQNMode(agentManager);
                break;
            case 'random':
            default:
                this.updateRandomMode();
                break;
        }
    }
    
    /**
     * Training mode: collect data while moving randomly
     */
    updateTrainingMode(agentManager) {
        // Collect training data if DQN system is available
        if (this.dqnDataCollector && agentManager) {
            this.dqnDataCollector.collectExperience(this, agentManager);
        }
        
        // Continue with random movement
        this.updateRandomMode();
    }
    
    /**
     * DQN mode: use trained neural network for decisions
     */
    updateDQNMode(agentManager) {
        // Use smart behavior if available
        if (this.dqnAgentBehavior) {
            this.dqnAgentBehavior.updateAgent(this, agentManager);
        } else {
            // Fallback to random movement if no DQN behavior loaded
            this.updateRandomMode();
        }
        
        // Continue with physics and collision detection
        this.handlePhysicsAndCollisions();
    }
    
    /**
     * Random mode: pure random movement (original behavior)
     */
    updateRandomMode() {
        // Pure random movement - continuous motion with occasional direction changes
        if (!this.randomMoveTimer) this.randomMoveTimer = 0;
        this.randomMoveTimer++;
        
        // Change movement direction every 20-60 frames (more frequent direction changes for better exploration)
        const changeInterval = this.mode === 'training' ? (20 + Math.random() * 40) : (30 + Math.random() * 60);
        if (this.randomMoveTimer > changeInterval) {
            this.randomMoveTimer = 0;
            
            // More aggressive exploration during training mode
            const explorationBonus = this.mode === 'training' ? 0.3 : 0.0;
            const directions = [];
            
            // Add forward/backward with higher weight (boosted during training)
            if (Math.random() < (0.7 + explorationBonus)) directions.push('w');
            if (Math.random() < (0.7 + explorationBonus)) directions.push('s');
            
            // Add left/right with higher weight during training
            if (Math.random() < (0.5 + explorationBonus)) directions.push('a');
            if (Math.random() < (0.5 + explorationBonus)) directions.push('d');
            
            // If no directions selected, force one
            if (directions.length === 0) {
                const allDirections = ['w', 's', 'd', 'a'];
                directions.push(allDirections[Math.floor(Math.random() * allDirections.length)]);
            }
            
            // Reset all movement flags
            this.movement.w = false;
            this.movement.a = false;
            this.movement.s = false;
            this.movement.d = false;
            
            // Set selected directions
            directions.forEach(dir => {
                this.movement[dir] = true;
            });
        }

        // Update agent position using world-space directions (not camera-relative)
        let moved = false;
        const moveVector = new T.Vector3(0, 0, 0);

        // Use world directions instead of camera directions for consistent movement
        if(this.movement.w) {
            moveVector.z -= this.movementSpeed; // Forward is negative Z
            moved = true;
        }
            
        if(this.movement.a){
            moveVector.x -= this.movementSpeed; // Left is negative X
            moved = true;
        }
            
        if(this.movement.s) {
            moveVector.z += this.movementSpeed; // Backward is positive Z
            moved = true;
        }
            
        if(this.movement.d) {
            moveVector.x += this.movementSpeed; // Right is positive X
            moved = true;
        }
        
        // Continue with physics and collision detection
        this.handlePhysicsAndCollisions();
    }
    
    /**
     * Handle physics and collision detection (shared by all modes)
     */
    handlePhysicsAndCollisions() {
        // Apply movement based on current movement flags
        let moved = false;
        const moveVector = new T.Vector3(0, 0, 0);

        // Use world directions for consistent movement
        if(this.movement.w) {
            moveVector.z -= this.movementSpeed; // Forward is negative Z
            moved = true;
        }
        if(this.movement.a){
            moveVector.x -= this.movementSpeed; // Left is negative X
            moved = true;
        }
        if(this.movement.s) {
            moveVector.z += this.movementSpeed; // Backward is positive Z
            moved = true;
        }
        if(this.movement.d) {
            moveVector.x += this.movementSpeed; // Right is positive X
            moved = true;
        }
        
        // Apply combined movement vector
        if(moved) {
            this.camera.position.add(moveVector);
        }
        
        if(moved) {
            let newPos = new T.Vector3(this.camera.position.x, this.camera.position.y - AGENT_HEIGHT, this.camera.position.z);
            this.mesh.position.copy(newPos);
            
            this.collider.start.x = this.camera.position.x;
            this.collider.end.x = this.camera.position.x;        
            this.collider.start.z = this.camera.position.z;
            this.collider.end.z = this.camera.position.z;      
        }

        // Handle jumping
        if(this.movement.spaceHold || !this.onGround) {
            this.collider.start.y += this.speedY;
            this.collider.end.y += this.speedY;
            const center = this.collider.start.clone().add(this.collider.end).multiplyScalar(0.5);
            const halfHeight = AGENT_HEIGHT / 2;
            this.mesh.position.set(center.x, center.y - halfHeight, center.z);
            this.camera.position.set(center.x, center.y + halfHeight, center.z);

            if(this.onGround) 
                this.movement.spaceHold = false;
            
            this.speedY -= GRAVITY;
        }

        this.collisions();
        

    }

    /**
     * checks for collision
     */
    collisions() {
        const result = this.worldCollide.capsuleIntersect(this.collider);
        this.onGround = false;
        
        if (result) {

            this.onGround = result.normal.y > 0.5;

            if ( result.depth >= 1e-5 ) {
                this.collider.translate(result.normal.multiplyScalar(result.depth));
                
            }

            if(this.onGround)
                this.speedY = 0;

        }

        const center = this.collider.start.clone().add(this.collider.end).multiplyScalar(0.5);
        this.mesh.position.set(center.x, this.collider.start.y, center.z);
        this.camera.position.set(center.x, this.collider.end.y, center.z);
    }

    /**
     * Get the agent's current position
     * @returns {T.Vector3} Current position
     */
    getPosition() {
        return this.camera.position.clone();
    }

    /**
     * Set the agent's position
     * @param {T.Vector3} position - New position
     */
    setPosition(position) {
        this.camera.position.copy(position);
        this.collider.start.set(position.x, position.y - AGENT_HEIGHT/2, position.z);
        this.collider.end.set(position.x, position.y + AGENT_HEIGHT/2, position.z);
        
        const newMeshPos = new T.Vector3(position.x, position.y - AGENT_HEIGHT, position.z);
        this.mesh.position.copy(newMeshPos);
    }

    /**
     * Get the agent's head position (center of the cube where the critical point is)
     * @returns {T.Vector3} Head position
     */
    getHeadPosition() {
        // Now the cube is positioned so its bottom is at characterGrp origin
        // and the critical point is at (0, AGENT_HEIGHT/2, 0) relative to characterGrp
        // So the world position of the critical point is:
        const centerPos = this.mesh.position.clone();
        centerPos.y += AGENT_HEIGHT / 2;
        
        return centerPos;
    }

    /**
     * Check line of sight to a critical point
     * @param {T.Vector3} criticalPointPosition - Position of the critical point
     * @param {Array} obstacles - Array of Three.js objects to check for intersections
     * @returns {boolean} True if the critical point is in line of sight
     */
    hasLineOfSight(criticalPointPosition, obstacles = []) {
        const headPosition = this.getHeadPosition();
        const direction = criticalPointPosition.clone().sub(headPosition).normalize();
        const distance = headPosition.distanceTo(criticalPointPosition);

        // Debug: temporarily disable obstacles to test if that's the issue
        if (obstacles.length === 0) {
            // Clear LOS to critical point
            return true;
        }

        this.raycaster.set(headPosition, direction);
        this.raycaster.far = distance;

        const intersections = this.raycaster.intersectObjects(obstacles, true);
        
        // Filter out intersections that are very close to the start or end points
        // to avoid self-intersection issues
        const validIntersections = intersections.filter(intersection => {
            const distFromStart = intersection.distance;
            const distFromEnd = distance - intersection.distance;
            return distFromStart > 0.01 && distFromEnd > 0.01;
        });

        const hasLOS = validIntersections.length === 0;
        if (!hasLOS) {
            // LOS blocked by obstacles
        }

        return hasLOS;
    }

    /**
     * Create a visual line from head to critical point
     * @param {T.Vector3} criticalPointPosition - Position of the critical point
     * @param {T.Scene} scene - Three.js scene to add the line to
     * @returns {T.Line} The created line object
     */
    createLOSLine(criticalPointPosition, scene) {
        const headPosition = this.getHeadPosition();
        
        const geometry = new T.BufferGeometry().setFromPoints([
            headPosition,
            criticalPointPosition
        ]);
        
        const material = new T.LineBasicMaterial({
            color: this.agentColor,
            transparent: true,
            opacity: 0.8,
            linewidth: 2
        });
        
        const line = new T.Line(geometry, material);
        scene.add(line);
        this.losLines.push(line);
        
        return line;
    }

    /**
     * Remove all LOS lines for this agent
     * @param {T.Scene} scene - Three.js scene to remove lines from
     */
    clearLOSLines(scene) {
        this.losLines.forEach(line => {
            scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        });
        this.losLines = [];
    }

    /**
     * Update line of sight and claim critical points
     * @param {Array} criticalPoints - Array of critical point objects with position and mesh properties
     * @param {Array} obstacles - Array of obstacle objects for collision detection
     * @param {T.Scene} scene - Three.js scene for line rendering
     * @param {Set} globalClaimedPoints - Set of globally claimed critical points to avoid conflicts
     */
    updateLineOfSight(criticalPoints, obstacles, scene, globalClaimedPoints) {
        // Clear existing lines
        this.clearLOSLines(scene);
        
        // Check each critical point
        criticalPoints.forEach((cp, index) => {
            // Skip if already claimed by another agent
            if (globalClaimedPoints.has(index) && !this.claimedCriticalPoints.has(index)) {
                return;
            }
            
            // Check line of sight
            if (this.hasLineOfSight(cp.position, obstacles)) {
                // Create visual line
                this.createLOSLine(cp.position, scene);
                

                
                // Claim the critical point using centralized system
                if (!this.claimedCriticalPoints.has(index)) {
                    this.claimedCriticalPoints.add(index);
                    globalClaimedPoints.add(index);
                    
                    // Also capture in the centralized CP system if available and ready
                    if (window.globalCPSystem && window.cpsFullyLoaded && cp.mesh && cp.mesh.userData.cpId !== undefined) {
                        try {
                            // First claim (draw line), then capture (take ownership) 
                            window.globalCPSystem.claimCriticalPoint(cp.mesh.userData.cpId, this.agentColor, `Agent${this.agentId}`);
                            window.globalCPSystem.captureCriticalPoint(cp.mesh.userData.cpId, this.agentColor, `Agent${this.agentId}`);
                        } catch (error) {
                            // Silent error handling
                        }
                    }
                }
                
                // Color the critical point with agent's color
                if (cp.mesh && cp.mesh.material) {
                    cp.mesh.material.color.setHex(this.agentColor);
                    
                    // Also color the glow if it exists
                    if (cp.mesh.children && cp.mesh.children.length > 0) {
                        cp.mesh.children.forEach(child => {
                            if (child.material) {
                                child.material.color.setHex(this.agentColor);
                            }
                        });
                    }
                }
            }
        });
    }





    /**
     * Find the nearest critical point that this agent can see
     * @param {Array} criticalPoints - Array of critical point objects
     * @param {Array} obstacles - Array of obstacle objects for LOS checking
     * @returns {Object|null} Nearest visible critical point or null
     */
    findNearestVisibleCriticalPoint(criticalPoints, obstacles) {
        const currentPos = this.getHeadPosition();
        let nearestCP = null;
        let nearestDistance = Infinity;
        
        criticalPoints.forEach((cp, index) => {
            // Skip if already claimed by this or another agent
            if (this.claimedCriticalPoints.has(index)) return;
            
            const distance = currentPos.distanceTo(cp.position);
            if (distance < nearestDistance && this.hasLineOfSight(cp.position, obstacles)) {
                nearestDistance = distance;
                nearestCP = { ...cp, index };
            }
        });
        
        return nearestCP;
    }

    /**
     * Set target to move toward the nearest unclaimed critical point
     * @param {Array} criticalPoints - Array of critical point objects
     * @param {Array} obstacles - Array of obstacle objects for LOS checking
     */
    seekNearestCriticalPoint(criticalPoints, obstacles) {
        const nearestCP = this.findNearestVisibleCriticalPoint(criticalPoints, obstacles);
        
        if (nearestCP) {
            // Move to a position near the critical point
            const targetPos = nearestCP.position.clone();
            targetPos.y = 1; // Set appropriate Y level for agent
            this.setTarget(targetPos);
            // Agent targeting critical point
        } else {
            // No visible critical points, move randomly
            this.setRandomTarget();
        }
    }

    /**
     * Get the agent's score (number of claimed critical points)
     * @returns {number} Number of claimed critical points
     */
    getScore() {
        // Use test score for now to debug UI updates
        if (this.testScore !== undefined) {
            return this.testScore;
        }
        
        // Use centralized CP system if available and fully initialized
        if (window.globalCPSystem && typeof window.globalCPSystem.getCriticalPointsByOwner === 'function') {
            try {
                const ownedCPs = window.globalCPSystem.getCriticalPointsByOwner(this.agentColor);
                return ownedCPs ? ownedCPs.length : 0;
            } catch (error) {
                // Silent fallback to local system
            }
        }
        
        // Fallback to local system
        return this.claimedCriticalPoints.size;
    }
    
    /**
     * Set agent mode and initialize DQN system if needed
     */
    setMode(mode, dqnDataCollector = null, dqnAgentBehavior = null) {
        this.mode = mode;
        if (mode === 'training' && dqnDataCollector) {
            this.dqnDataCollector = dqnDataCollector;
        }
        if (mode === 'dqn' && dqnAgentBehavior) {
            this.dqnAgentBehavior = dqnAgentBehavior;
        }
        
        // Visual feedback for mode changes
        this.updateVisualMode(mode);
        
        console.log(`Agent ${this.agentId} mode set to: ${mode}`);
    }
    
    /**
     * Update visual appearance based on mode
     */
    updateVisualMode(mode) {
        if (this.mesh && this.mesh.children && this.mesh.children.length > 0) {
            const agentMesh = this.mesh.children[0]; // The main cube
            
            switch(mode) {
                case 'training':
                    // Pulsing effect during training
                    agentMesh.material.opacity = 0.9;
                    agentMesh.material.emissive.setHex(0x004400); // Slight green glow
                    break;
                case 'dqn':
                    // Bright glow for smart mode
                    agentMesh.material.opacity = 1.0;
                    agentMesh.material.emissive.setHex(0x000044); // Blue glow for smart mode
                    break;
                case 'random':
                default:
                    // Normal appearance
                    agentMesh.material.opacity = 0.7;
                    agentMesh.material.emissive.setHex(0x000000); // No glow
                    break;
            }
        }
    }
    
    /**
     * Set DQN behavior for smart mode
     */
    setDQNBehavior(dqnAgentBehavior) {
        this.dqnAgentBehavior = dqnAgentBehavior;
        console.log(`Agent ${this.agentId} DQN behavior loaded`);
    }
    
    /**
     * Get current agent mode
     */
    getMode() {
        return this.mode;
    }
}

// Agent-specific global variables
const AGENT_HEIGHT = 0.5;
const AGENT_RADIUS = 0.5 * Math.sqrt(2) / 2;
const AGENT_SPEED = 0.05;
const AGENT_JUMP_HEIGHT = 1.2;
const AGENT_JUMP_SPEED = 0.03;
const GRAVITY = (AGENT_JUMP_SPEED * AGENT_JUMP_SPEED) / (2 * AGENT_JUMP_HEIGHT);

// Export the Agent class
export default Agent;
