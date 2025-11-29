import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";
import {OrbitControls} from "https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import * as O from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/OBJLoader.js";
import * as P from "https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js";
import { Octree } from "https://unpkg.com/three@0.165.0/examples/jsm/math/Octree.js";
import { OctreeHelper } from "https://unpkg.com/three@0.165.0/examples/jsm/helpers/OctreeHelper.js";
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
        
        this.mesh = this.createObject();
        this.object = new T.Group();
        this.camera = new T.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, AGENT_HEIGHT, 0);
        this.collider = new Capsule(new T.Vector3(0, AGENT_HEIGHT/2, 0), new T.Vector3(0, AGENT_HEIGHT - AGENT_HEIGHT/4, 0), AGENT_HEIGHT/2);
        console.log("Agent collider start: " + this.collider.start.x + " " + this.collider.start.y + " " + this.collider.start.z);
        console.log("Agent radius: " + AGENT_RADIUS);
        this.object.add(this.mesh);
        this.object.add(this.camera);
        this.onGround = false;
        this.worldCollide = collisionWorld;

        // No pointer lock controls for NPC - agents don't have vision controls
        this.controls = null;
    
        // Agent-specific properties
        this.targetPosition = new T.Vector3(0, 0, 0);
        this.isMovingToTarget = false;
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
     * Set a target position for the agent to move towards
     * @param {T.Vector3} targetPos - The target position
     */
    setTarget(targetPos) {
        this.targetPosition.copy(targetPos);
        this.isMovingToTarget = true;
    }

    /**
     * Stop the agent from moving
     */
    stop() {
        this.isMovingToTarget = false;
        this.movement.w = false;
        this.movement.a = false;
        this.movement.s = false;
        this.movement.d = false;
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
    update() {
        // console.log("Agent collider start: " + this.collider.start.x + " " + this.collider.start.y + " " + this.collider.start.z);
        
        // AI movement towards target using pathfinding
        if (this.isMovingToTarget) {
            const currentPos = new T.Vector3(this.camera.position.x, this.camera.position.y, this.camera.position.z);
            const distance = currentPos.distanceTo(this.targetPosition);
            
            if (distance > 0.2) { // Still moving towards target
                // Use the pathfinding system if available
                if (window.MapPathfinding) {
                    const from = { x: currentPos.x, z: currentPos.z };
                    const to = { x: this.targetPosition.x, z: this.targetPosition.z };
                    
                    const nextStep = window.MapPathfinding.getNextStep(from, to);
                    
                    if (nextStep) {
                        // Convert pathfinding direction to movement flags
                        const stepThreshold = 0.1;
                        
                        this.movement.w = nextStep.z > stepThreshold;   // Moving north (positive Z)
                        this.movement.s = nextStep.z < -stepThreshold;  // Moving south (negative Z)
                        this.movement.d = nextStep.x > stepThreshold;   // Moving east (positive X)
                        this.movement.a = nextStep.x < -stepThreshold;  // Moving west (negative X)
                    } else {
                        // No valid path found, stop moving
                        this.stop();
                    }
                } else {
                    // Fallback to simple direct movement if pathfinding not available
                    const direction = this.targetPosition.clone().sub(currentPos);
                    direction.y = 0; // Only move in XZ plane
                    direction.normalize();
                    
                    // Simple movement logic - move towards target
                    const forward = new T.Vector3(0, 0, -1);
                    const right = new T.Vector3(1, 0, 0);
                    
                    // Calculate movement components
                    const forwardMovement = direction.dot(forward);
                    const rightMovement = direction.dot(right);
                    
                    // Set movement flags based on direction
                    this.movement.w = forwardMovement > 0.1;
                    this.movement.s = forwardMovement < -0.1;
                    this.movement.d = rightMovement > 0.1;
                    this.movement.a = rightMovement < -0.1;
                }
            } else {
                // Reached target
                this.isMovingToTarget = false;
                this.stop();
            }
        }

        // Update agent position (same logic as player but without pointer lock controls)
        let moved = false;

        if(this.movement.w) {
            // Move forward in camera direction
            const direction = new T.Vector3();
            this.camera.getWorldDirection(direction);
            direction.y = 0;
            direction.normalize();
            this.camera.position.add(direction.multiplyScalar(this.movementSpeed));
            moved = true;
        }
            
        if(this.movement.a){
            // Move left relative to camera direction
            const direction = new T.Vector3();
            this.camera.getWorldDirection(direction);
            const left = new T.Vector3(-direction.z, 0, direction.x);
            left.normalize();
            this.camera.position.add(left.multiplyScalar(this.movementSpeed));
            moved = true;
        }
            
        if(this.movement.s) {
            // Move backward
            const direction = new T.Vector3();
            this.camera.getWorldDirection(direction);
            direction.y = 0;
            direction.normalize();
            this.camera.position.add(direction.multiplyScalar(-this.movementSpeed));
            moved = true;
        }
            
        if(this.movement.d) {
            // Move right relative to camera direction
            const direction = new T.Vector3();
            this.camera.getWorldDirection(direction);
            const right = new T.Vector3(direction.z, 0, -direction.x);
            right.normalize();
            this.camera.position.add(right.multiplyScalar(this.movementSpeed));
            moved = true;
        }
        
        if(moved) {
            let newPos = new T.Vector3(this.camera.position.x, this.camera.position.y - AGENT_HEIGHT, this.camera.position.z);
            this.mesh.position.copy(newPos);
            
            this.collider.start.x = this.camera.position.x;
            this.collider.end.x = this.camera.position.x;        
            this.collider.start.z = this.camera.position.z;
            this.collider.end.z = this.camera.position.z;      
        }

        // update jump
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
            console.log(`Agent ${this.agentId}: No obstacles, clear LOS to CP at distance ${distance.toFixed(2)}`);
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
            console.log(`Agent ${this.agentId}: LOS blocked by ${validIntersections.length} obstacles`);
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
     * Check if the agent can move to a specific world position
     * @param {number} x - World X coordinate
     * @param {number} z - World Z coordinate
     * @returns {boolean} True if the position is walkable
     */
    canMoveTo(x, z) {
        return window.MapPathfinding ? window.MapPathfinding.isWalkable(x, z) : true;
    }

    /**
     * Get all valid directions the agent can move from its current position
     * @returns {Array} Array of valid movement directions
     */
    getValidMoveDirections() {
        if (!window.MapPathfinding) return [];
        
        const currentPos = this.getPosition();
        return window.MapPathfinding.getValidDirections(currentPos.x, currentPos.z);
    }

    /**
     * Find a random walkable position within the map boundaries
     * @returns {T.Vector3|null} Random walkable position or null if none found
     */
    findRandomWalkablePosition() {
        if (!window.mapLayout) return null;
        
        const layout = window.mapLayout;
        const halfWidth = layout.width / 2;
        const halfDepth = layout.depth / 2;
        
        // Try up to 50 times to find a valid position
        for (let attempts = 0; attempts < 50; attempts++) {
            const x = (Math.random() - 0.5) * (layout.width - 2); // Stay inside walls
            const z = (Math.random() - 0.5) * (layout.depth - 2);
            
            if (this.canMoveTo(x, z)) {
                return new T.Vector3(x, 1, z); // Y=1 for agent height
            }
        }
        
        return null;
    }

    /**
     * Set a random target within the walkable area
     */
    setRandomTarget() {
        const randomPos = this.findRandomWalkablePosition();
        if (randomPos) {
            this.setTarget(randomPos);
            console.log(`Agent ${this.agentId}: New random target at (${randomPos.x.toFixed(2)}, ${randomPos.z.toFixed(2)})`);
        }
    }

    /**
     * Check if the direct path to target is clear
     * @returns {boolean} True if direct path is walkable
     */
    isDirectPathClear() {
        if (!window.MapPathfinding || !this.isMovingToTarget) return false;
        
        const currentPos = this.getPosition();
        const from = { x: currentPos.x, z: currentPos.z };
        const to = { x: this.targetPosition.x, z: this.targetPosition.z };
        
        // Check several points along the path
        const steps = 10;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const checkX = from.x + (to.x - from.x) * t;
            const checkZ = from.z + (to.z - from.z) * t;
            
            if (!window.MapPathfinding.isWalkable(checkX, checkZ)) {
                return false;
            }
        }
        
        return true;
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
            console.log(`Agent ${this.agentId}: Seeking critical point at (${targetPos.x.toFixed(2)}, ${targetPos.z.toFixed(2)})`);
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
}

// Agent-specific global variables
const AGENT_HEIGHT = 0.5;
const AGENT_RADIUS = 0.5 * Math.sqrt(2) / 2;
const AGENT_SPEED = 0.02;
const AGENT_JUMP_HEIGHT = 1.2;
const AGENT_JUMP_SPEED = 0.03;
const GRAVITY = (AGENT_JUMP_SPEED * AGENT_JUMP_SPEED) / (2 * AGENT_JUMP_HEIGHT);

// Export the Agent class
export default Agent;
