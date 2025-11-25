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
    constructor(renderer, collisionWorld) {

        this.movement = {w: false, a: false, s: false, d: false, space: false, spaceHold: false};
        this.speedY = 0;
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
    }

    /**
     * Creates the mesh and collider bounding box for the agent
     * @returns a three js group that contains the mesh
     */
    createObject() {
        let characterGrp = new T.Group();
        const dummyGeo = new T.BoxGeometry(AGENT_HEIGHT, AGENT_HEIGHT, AGENT_HEIGHT);
        // Different color for agent - blue instead of pink, with transparency
        const dummyMat = new T.MeshStandardMaterial({
            color: "rgb(123, 123, 255)",
            transparent: true,
            opacity: 0.7
        });
        const dummyMesh = new T.Mesh(dummyGeo, dummyMat);
        characterGrp.add(dummyMesh);

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
        console.log("Agent collider start: " + this.collider.start.x + " " + this.collider.start.y + " " + this.collider.start.z);
        
        // AI movement towards target
        if (this.isMovingToTarget) {
            const currentPos = new T.Vector3(this.camera.position.x, this.camera.position.y, this.camera.position.z);
            const direction = this.targetPosition.clone().sub(currentPos);
            direction.y = 0; // Only move in XZ plane
            
            const distance = direction.length();
            if (distance > 0.1) { // Still moving towards target
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
