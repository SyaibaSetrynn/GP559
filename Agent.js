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
        
        // 3-point claiming system
        this.maxClaimedPoints = 3;
        this.claimedPointsList = []; // Array to track order of claimed points (FIFO)
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
        // DEBUG: Track mode switches to detect rapid switching
        if (this._lastMode !== this.mode) {
            console.log(`Agent ${this.agentId} mode changed from ${this._lastMode} to ${this.mode}`);
            this._lastMode = this.mode;
        }
        
        // DEBUG: Count update calls per mode
        if (!this._modeCallCount) this._modeCallCount = {};
        if (!this._modeCallCount[this.mode]) this._modeCallCount[this.mode] = 0;
        this._modeCallCount[this.mode]++;
        
        // Log every 60 frames for each mode
        if (this._modeCallCount[this.mode] % 60 === 0) {
            console.log(`Agent ${this.agentId} in ${this.mode} mode: ${this._modeCallCount[this.mode]} updates`);
        }
        
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
        // Use the EXACT same random movement method - no differences at all
        this.updateRandomMode();
        
        // Data collection disabled for debugging movement issues
        // if (this.dqnDataCollector && agentManager) {
        //     this.dqnDataCollector.collectExperience(this, agentManager);
        // }
    }
    
    /**
     * DQN mode: use trained neural network for decisions
     */
    updateDQNMode(agentManager) {
        // Use smart behavior if available
        if (this.dqnAgentBehavior) {
            this.dqnAgentBehavior.updateAgent(this, agentManager);
        } else {
            // During DQN training, agent movement is controlled by the DQN trainer
            // Don't do any autonomous movement to avoid speed issues
            // The DQN trainer will control movement via actionSpace.executeAction()
        }
        
        // Continue with physics and collision detection
        this.handlePhysicsAndCollisions();
    }
    
    /**
     * Random mode: pure random movement with stuck detection and natural exploration
     */
    updateRandomMode() {
        // Initialize random movement state
        if (!this.randomMoveTimer) this.randomMoveTimer = 0;
        if (!this.lastPosition) this.lastPosition = this.getPosition().clone();
        if (!this.stuckTimer) this.stuckTimer = 0;
        if (!this.currentDirection) this.currentDirection = null;
        
        this.randomMoveTimer++;
        
        // Check if agent is stuck (hasn't moved much in the last few frames)
        const currentPos = this.getPosition();
        const distanceMoved = currentPos.distanceTo(this.lastPosition);
        
        if (distanceMoved < 0.001) { // Very small movement threshold
            this.stuckTimer++;
        } else {
            this.stuckTimer = 0;
        }
        
        // Update last position
        this.lastPosition.copy(currentPos);
        
        // Get movement tuning settings (from UI or defaults)
        const tuning = this.movementTuning || window.globalMovementSettings || {};
        const directionChangeFreq = tuning.directionChangeFreq || 60;
        const cpSeekingChance = tuning.cpSeekingChance || 0.4; // Increased from 0.2 to make agents more competitive
        
        // Force direction change if stuck or at regular intervals
        const baseInterval = directionChangeFreq;
        const changeInterval = baseInterval + (Math.random() - 0.5) * 20; // Add some variation
        const isStuck = this.stuckTimer > 10; // Stuck for more than 10 frames
        const shouldChangeDirection = this.randomMoveTimer > changeInterval || isStuck || !this.currentDirection;
        
        // Check for CP seeking behavior
        const shouldSeekCP = Math.random() < cpSeekingChance && window.globalCPSystem;
        
        if (shouldChangeDirection) {
            this.randomMoveTimer = 0;
            this.stuckTimer = 0;
            
            // Choose a new random direction (might be influenced by CP seeking)
            this.selectNewRandomDirection(isStuck, shouldSeekCP);
        }
        
        // Apply the current movement
        this.applyMovement();
        
        // Continue with physics and collision detection
        this.handlePhysicsAndCollisions();
    }
    
    /**
     * Select a new random direction for movement
     */
    selectNewRandomDirection(isStuck = false, shouldSeekCP = false) {
        // Reset all movement flags
        this.movement.w = false;
        this.movement.a = false;
        this.movement.s = false;
        this.movement.d = false;
        
        // Get movement tuning settings
        const tuning = this.movementTuning || window.globalMovementSettings || {};
        const diagonalChance = tuning.diagonalChance || 0.2;
        const explorationBonus = tuning.explorationBonus || 0.1;
        
        let availableDirections = ['w', 's', 'a', 'd'];
        let preferredDirection = null;
        
        // If seeking CPs, try to find direction towards CPs that are not owned by this agent
        if (shouldSeekCP && window.globalCPSystem && window.globalCPSystem.criticalPoints) {
            const currentPos = this.getPosition();
            let targetCP = null;
            let bestScore = -1;
            
            // Find best target CP (prioritize unclaimed, then opponent-owned)
            window.globalCPSystem.criticalPoints.forEach(cpData => {
                // Skip CPs already owned by this agent
                if (cpData.ownedBy === this.agentId) return;
                
                const distance = currentPos.distanceTo(cpData.cp.position);
                let score = 0;
                
                // Scoring system:
                // - Higher score for unclaimed CPs
                // - Medium score for opponent-owned CPs  
                // - Closer CPs get higher scores
                if (!cpData.ownedBy || cpData.ownedBy === null) {
                    score = 100 / (distance + 1); // Unclaimed - highest priority
                } else {
                    score = 60 / (distance + 1); // Opponent-owned - medium priority
                }
                
                if (score > bestScore) {
                    bestScore = score;
                    targetCP = cpData.cp.position;
                }
            });
            
            // If we found a target CP, bias movement towards it
            if (targetCP) {
                const dx = targetCP.x - currentPos.x;
                const dz = targetCP.z - currentPos.z;
                
                // Determine preferred directions based on distance to CP
                if (Math.abs(dx) > Math.abs(dz)) {
                    preferredDirection = dx > 0 ? 'd' : 'a'; // East or West
                } else {
                    preferredDirection = dz > 0 ? 's' : 'w'; // South or North
                }
                
                // DEBUG: Log target selection occasionally
                if (this.randomMoveTimer % 180 === 0) { // Every 3 seconds
                    const ownerText = !window.globalCPSystem.criticalPoints.find(cp => cp.cp.position === targetCP)?.ownedBy ? 
                        'unclaimed' : `owned by agent ${window.globalCPSystem.criticalPoints.find(cp => cp.cp.position === targetCP)?.ownedBy}`;
                    console.log(`Agent ${this.agentId} targeting CP at (${targetCP.x.toFixed(1)}, ${targetCP.z.toFixed(1)}) - ${ownerText}`);
                }
            }
        }
        
        // If stuck, avoid the opposite of current direction and try something different
        if (isStuck && this.currentDirection) {
            const opposites = { 'w': 's', 's': 'w', 'a': 'd', 'd': 'a' };
            const avoidDirection = opposites[this.currentDirection];
            availableDirections = availableDirections.filter(dir => dir !== this.currentDirection && dir !== avoidDirection);
        }
        
        // Enhanced direction selection for more natural movement
        const baseDiagonalChance = Math.random() < 0.7 ? 0 : (Math.random() < 0.8 ? 1 : 0);
        const finalDiagonalChance = Math.random() < diagonalChance ? 1 : baseDiagonalChance;
        const numDirections = finalDiagonalChance ? 2 : 1;
        
        for (let i = 0; i < numDirections && availableDirections.length > 0; i++) {
            let selectedDir;
            
            // On first direction selection, prefer the CP-seeking direction if available
            if (i === 0 && preferredDirection && availableDirections.includes(preferredDirection)) {
                selectedDir = preferredDirection;
                availableDirections = availableDirections.filter(dir => dir !== preferredDirection);
            } else {
                const dirIndex = Math.floor(Math.random() * availableDirections.length);
                selectedDir = availableDirections[dirIndex];
                availableDirections.splice(dirIndex, 1);
            }
            
            this.movement[selectedDir] = true;
            
            // Track primary direction for stuck detection
            if (i === 0) {
                this.currentDirection = selectedDir;
            }
        }
        
        // Ensure at least one direction is always selected
        if (!this.movement.w && !this.movement.s && !this.movement.a && !this.movement.d) {
            const fallbackDir = ['w', 's', 'a', 'd'][Math.floor(Math.random() * 4)];
            this.movement[fallbackDir] = true;
            this.currentDirection = fallbackDir;
        }
        
        // Remove jumping - agents will navigate around obstacles instead
    }
    
    /**
     * Apply movement based on current movement flags
     */
    applyMovement() {
        // This will be handled in handlePhysicsAndCollisions, 
        // but we keep this method for potential future enhancements
    }
    
    /**
     * Handle physics and collision detection (shared by all modes)
     */
    handlePhysicsAndCollisions() {
        // Apply movement based on current movement flags
        let moved = false;
        const moveVector = new T.Vector3(0, 0, 0);
        
        // Get current movement speed (from tuning or default)
        const tuning = this.movementTuning || window.globalMovementSettings || {};
        const currentSpeed = tuning.movementSpeed !== undefined ? tuning.movementSpeed : this.movementSpeed;
        
        // DEBUG: Track speed variations
        if (!this._lastLoggedSpeed || this._lastLoggedSpeed !== currentSpeed) {
            console.log(`Agent ${this.agentId} (${this.mode}): speed = ${currentSpeed}, tuning:`, tuning);
            this._lastLoggedSpeed = currentSpeed;
        }

        // Use world directions for consistent movement
        if(this.movement.w) {
            moveVector.z -= currentSpeed; // Forward is negative Z
            moved = true;
        }
        if(this.movement.a){
            moveVector.x -= currentSpeed; // Left is negative X
            moved = true;
        }
        if(this.movement.s) {
            moveVector.z += currentSpeed; // Backward is positive Z
            moved = true;
        }
        if(this.movement.d) {
            moveVector.x += currentSpeed; // Right is positive X
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
     * Update line of sight and claim critical points with proper 3-point limit
     * @param {Array} criticalPoints - Array of critical point objects with position and mesh properties
     * @param {Array} obstacles - Array of obstacle objects for collision detection
     * @param {T.Scene} scene - Three.js scene for line rendering
     * @param {Set} globalClaimedPoints - Set of globally claimed critical points to avoid conflicts
     */
    updateLineOfSight(criticalPoints, obstacles, scene, globalClaimedPoints) {
        // Clear existing lines
        this.clearLOSLines(scene);
        
        // First, check if any of our claimed points have unexpectedly changed color
        for (let claimedIndex of this.claimedPointsList) {
            if (criticalPoints[claimedIndex] && criticalPoints[claimedIndex].mesh && criticalPoints[claimedIndex].mesh.material) {
                const currentColor = criticalPoints[claimedIndex].mesh.material.color.getHex();
                if (currentColor !== this.agentColor) {
                    console.warn(`OWNERSHIP CONFLICT! Agent ${this.agentId} thought it owned CP ${claimedIndex} (expected: ${this.agentColor.toString(16)}, actual: ${currentColor.toString(16)})`);
                    // Remove from our tracking since we lost ownership
                    this.claimedCriticalPoints.delete(claimedIndex);
                    const listIndex = this.claimedPointsList.indexOf(claimedIndex);
                    if (listIndex > -1) {
                        this.claimedPointsList.splice(listIndex, 1);
                    }
                }
            }
        }
        
        // Step 1: Find all currently visible critical points
        const visibleCPs = [];
        criticalPoints.forEach((cp, index) => {
            // Skip if claimed by another agent (not this agent)
            if (globalClaimedPoints.has(index) && !this.claimedCriticalPoints.has(index)) {
                return;
            }
            
            // Check if claimed by player - look for player's color
            const cpColorHex = cp.mesh?.material?.color?.getHex();
            const isClaimedByPlayer = cpColorHex === window.CP_COLORS?.BLUE && !this.claimedCriticalPoints.has(index);
            if (isClaimedByPlayer) {
                console.log(`Agent ${this.agentId} skipping CP ${index} - claimed by player (color: ${cpColorHex?.toString(16)})`);
                return;
            }
            
            if (this.hasLineOfSight(cp.position, obstacles)) {
                visibleCPs.push({ cp, index });
            }
        });
        
        console.log(`Agent ${this.agentId} sees ${visibleCPs.length} CPs, currently owns ${this.claimedPointsList.length}/${this.maxClaimedPoints}`);
        
        // Step 2: Release any claimed points that are no longer visible
        const stillVisibleIndices = visibleCPs.map(v => v.index);
        const toRelease = [];
        
        for (let claimedIndex of this.claimedPointsList) {
            if (!stillVisibleIndices.includes(claimedIndex)) {
                toRelease.push(claimedIndex);
            }
        }
        
        // Release points that lost line of sight
        toRelease.forEach(index => {
            const cpColorBefore = criticalPoints[index]?.mesh?.material?.color?.getHex();
            this.releaseCriticalPoint(index, criticalPoints, globalClaimedPoints);
            const cpColorAfter = criticalPoints[index]?.mesh?.material?.color?.getHex();
            console.log(`Agent ${this.agentId} lost line of sight, released CP ${index} (color before: ${cpColorBefore?.toString(16)}, after: ${cpColorAfter?.toString(16)})`);
        });
        
        // Step 3: Draw lines to all visible points we already own
        visibleCPs.forEach(({ cp, index }) => {
            if (this.claimedCriticalPoints.has(index)) {
                this.createLOSLine(cp.position, scene);
            }
        });
        
        // Step 4: Claim new visible points up to our limit (3 total)
        visibleCPs.forEach(({ cp, index }) => {
            // Skip if we already own this point
            if (this.claimedCriticalPoints.has(index)) {
                return;
            }
            
            // Skip if we've reached our maximum claimed points
            if (this.claimedPointsList.length >= this.maxClaimedPoints) {
                // At max capacity, release the oldest point (FIFO) to make room
                const oldestIndex = this.claimedPointsList.shift();
                this.releaseCriticalPoint(oldestIndex, criticalPoints, globalClaimedPoints);
                console.log(`Agent ${this.agentId} at capacity, released oldest CP ${oldestIndex} to make room for CP ${index}`);
            }
            
            // Claim new point
            this.claimCriticalPoint(index, cp, globalClaimedPoints);
            this.createLOSLine(cp.position, scene);
            console.log(`Agent ${this.agentId} claimed new CP ${index}, now has ${this.claimedPointsList.length}/${this.maxClaimedPoints}`);
        });
    }
    
    /**
     * Claim a critical point
     */
    claimCriticalPoint(index, cp, globalClaimedPoints) {
        // Safety check: don't claim if already at max capacity
        if (this.claimedPointsList.length >= this.maxClaimedPoints) {
            console.warn(`Agent ${this.agentId} tried to claim CP ${index} but already at max capacity!`);
            return;
        }
        
        // Check if this point was previously owned by the player
        const cpColorHex = cp.mesh?.material?.color?.getHex();
        const wasPlayerOwned = cpColorHex === window.CP_COLORS?.BLUE;
        
        this.claimedCriticalPoints.add(index);
        this.claimedPointsList.push(index);
        globalClaimedPoints.add(index);
        
        // Color the critical point first (most reliable method)
        if (cp.mesh && cp.mesh.material) {
            const previousColor = cp.mesh.material.color.getHex();
            cp.mesh.material.color.setHex(this.agentColor);
            if (cp.mesh.children && cp.mesh.children.length > 0) {
                cp.mesh.children.forEach(child => {
                    if (child.material) {
                        child.material.color.setHex(this.agentColor);
                    }
                });
            }
            if (wasPlayerOwned) {
                console.log(`Agent ${this.agentId} claimed CP ${index} from Player (was blue: ${previousColor.toString(16).padStart(6, '0')}, now: ${this.agentColor.toString(16).padStart(6, '0')})`);
            } else {
                console.log(`Agent ${this.agentId} set CP ${index} color to ${this.agentColor.toString(16).padStart(6, '0')}`);
            }
        }
        
        // Update centralized system if available
        if (window.globalCPSystem && cp.mesh && cp.mesh.userData.cpId !== undefined) {
            try {
                window.globalCPSystem.claimCriticalPoint(cp.mesh.userData.cpId, this.agentColor, `Agent${this.agentId}`);
                window.globalCPSystem.captureCriticalPoint(cp.mesh.userData.cpId, this.agentColor, `Agent${this.agentId}`);
            } catch (error) {
                // Silent error handling
            }
        }
    }
    
    /**
     * Release a claimed critical point - removes line of sight but preserves ownership/color
     */
    releaseCriticalPoint(index, criticalPoints, globalClaimedPoints) {
        this.claimedCriticalPoints.delete(index);
        globalClaimedPoints.delete(index);
        
        // Remove from list (maintain order)
        const listIndex = this.claimedPointsList.indexOf(index);
        if (listIndex > -1) {
            this.claimedPointsList.splice(listIndex, 1);
        }
        
        // DO NOT revert color - the point should stay the agent's color until claimed by another agent
        // This maintains ownership even when line of sight is lost
        
        // Debug: Check if color actually persists
        if (criticalPoints[index] && criticalPoints[index].mesh && criticalPoints[index].mesh.material) {
            const currentColor = criticalPoints[index].mesh.material.color.getHex();
            const expectedColor = this.agentColor;
            if (currentColor !== expectedColor) {
                console.warn(`UNEXPECTED COLOR CHANGE! Agent ${this.agentId} released CP ${index}, expected color ${expectedColor.toString(16)}, actual color ${currentColor.toString(16)}`);
            } else {
                console.log(`Agent ${this.agentId} lost line of sight to CP ${index} but color/ownership preserved (${currentColor.toString(16)})`);
            }
        }
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
        
        // Validation: ensure we never exceed max claimed points
        if (this.claimedPointsList.length > this.maxClaimedPoints) {
            console.error(`Agent ${this.agentId} has ${this.claimedPointsList.length} claimed points, exceeds max ${this.maxClaimedPoints}!`);
            // Emergency cleanup: remove excess points
            while (this.claimedPointsList.length > this.maxClaimedPoints) {
                const excessIndex = this.claimedPointsList.shift();
                this.claimedCriticalPoints.delete(excessIndex);
                console.log(`Emergency cleanup: removed excess CP ${excessIndex} from Agent ${this.agentId}`);
            }
        }
        
        // Use centralized CP system if available and fully initialized
        if (window.globalCPSystem && typeof window.globalCPSystem.getCriticalPointsByOwner === 'function') {
            try {
                const ownedCPs = window.globalCPSystem.getCriticalPointsByOwner(this.agentColor);
                return ownedCPs ? ownedCPs.length : 0;
            } catch (error) {
                // Silent fallback to color-based counting
            }
        }
        
        // Fallback to color-based scoring - count CPs that match our color
        if (window.gameManager && window.gameManager.criticalPoints) {
            let score = 0;
            let debugCount = 0;
            for (let cp of window.gameManager.criticalPoints) {
                if (cp.mesh && cp.mesh.material && cp.mesh.material.color) {
                    debugCount++;
                    const cpColorHex = cp.mesh.material.color.getHex();
                    if (cpColorHex === this.agentColor) {
                        score++;
                    }
                }
            }
            
            // Debug logging occasionally
            if (this.agentId === 0 && debugCount > 0 && Date.now() % 2000 < 50) { // Agent 0, every 2 seconds
                console.log(`Agent ${this.agentId} scoring: checked ${debugCount} CPs, agent color: ${this.agentColor.toString(16).padStart(6, '0')}, score: ${score}`);
            }
            
            return score;
        }
        
        // Last resort fallback
        return 0;
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
const AGENT_SPEED = 0.025;
const AGENT_JUMP_HEIGHT = 1.2;
const AGENT_JUMP_SPEED = 0.03;
const GRAVITY = (AGENT_JUMP_SPEED * AGENT_JUMP_SPEED) / (2 * AGENT_JUMP_HEIGHT);

// Export the Agent class
export default Agent;
