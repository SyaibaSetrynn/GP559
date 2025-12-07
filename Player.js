import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";
import {OrbitControls} from "https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import * as O from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/OBJLoader.js";
import * as P from "https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js";
import { Octree } from "https://unpkg.com/three@0.165.0/examples/jsm/math/Octree.js";
import { OctreeHelper } from "https://unpkg.com/three@0.165.0/examples/jsm/helpers/OctreeHelper.js";
import { Capsule } from "https://unpkg.com/three@0.165.0/examples/jsm/math/Capsule.js";
import Agent from "./Agent.js";
import AgentManager from "./AgentManager.js";
import * as M from "./MapTextures.js";
import {MapLighting} from "./MapLighting.js";

/**
 * Some references: https://www.youtube.com/watch?v=oqKzxPMLWxo
 *                  https://sbcode.net/threejs/pointerlock-controls/
 */

/**
 * Class for a player in the game
 */
class Player {
    /**
     * note: 
     * this.mesh: the group that holds mesh
     * this.camera: the camera
     * this.collider: the collider
     * they are all apart because putting in a group and update that group position doesn't work
     * this.mesh need to move with the camera, but can only rotate on z axis
     * @param {number} isFirstPerson 0 if is first person player, 1 if npc (the difference is only in PointerLockControls)
     * @param {*} renderer 
     * @param {*} collisionWorld
     * @param {*} criticalPointSystem - The critical point system instance for managing points
     */
    constructor(isFirstPerson, renderer, collisionWorld, criticalPointSystem = null) {

        this.movement = {w: false, a: false, s: false, d: false, space: false, spaceHold: false};
        this.speedY = 0;
        this.mesh = this.createObject();
        this.object = new T.Group();
        this.camera = new T.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, PLAYER_HEIGHT, 0);
        this.collider = new Capsule(new T.Vector3(0, PLAYER_HEIGHT/2, 0), new T.Vector3(0, PLAYER_HEIGHT - PLAYER_HEIGHT/4, 0), PLAYER_HEIGHT/2);
        let gunObjs = this.createGun();
        this.gun = gunObjs[0];
        this.gunTip = gunObjs[1];
        this.object.add(this.mesh);
        this.object.add(this.camera);
        this.camera.add(this.gun);
        this.onGround = false;
        this.worldCollide = collisionWorld;

        this.color = window.CP_COLORS.BLUE;
        this.laserFire = false;
        this.laser = this.initLaser();
        this.gunTip.add(this.laser);
        this.laser.position.set(0,0,0);
        this.controls = null;
        if(isFirstPerson == 0)
            this.controls = new P.PointerLockControls(this.camera, renderer.domElement);
    
        this.score = 0;
        
        // Store critical point system reference for use in methods
        this.criticalPointSystem = criticalPointSystem;

        // 3-point claiming system
        this.maxClaimedPoints = 3;
        this.claimedPointsList = []; // Array to track order of claimed points (FIFO)
        this.claimedCriticalPoints = new Set(); // Set for fast lookup

    }

    /**
     * Creates the mesh nnd collider bounding box for the player
     * @returns a three js group that contains the mesh
     */
    createObject() {
        let characterGrp = new T.Group();
        const dummyGeo = new T.BoxGeometry(PLAYER_HEIGHT, PLAYER_HEIGHT, PLAYER_HEIGHT);
        const dummyMat = new T.MeshStandardMaterial({color: "rgb(255, 123, 123)"});
        const dummyMesh = new T.Mesh(dummyGeo, dummyMat);
        characterGrp.add(dummyMesh);

        return characterGrp;
    }
    
    createGun() {
        let gunGrp = new T.Group();
        const gunBarrelGeo = new T.CylinderGeometry(0.02, 0.02, 0.2, 16);
        const gunBarrelMat = new T.MeshStandardMaterial({color: "rgb(0, 18, 110)"});
        const gunBarrelMesh = new T.Mesh(gunBarrelGeo, gunBarrelMat);
        gunBarrelMesh.rotateX(Math.PI/2);

        const gunBarrel2Geo = new T.CylinderGeometry(0.025, 0.025, 0.12, 16);
        const gunBarrel2Mat = new T.MeshStandardMaterial({color: "rgb(25, 29, 50)"});
        const gunBarrel2Mesh = new T.Mesh(gunBarrel2Geo, gunBarrel2Mat);
        gunBarrel2Mesh.rotateX(Math.PI/2);
        gunBarrel2Mesh.position.set(0, 0, -0.05);

        const gunHandleGeo = new T.CylinderGeometry(0.015, 0.022, 0.1, 16);
        const gunHandleMesh = new T.Mesh(gunHandleGeo, gunBarrelMat);
        gunHandleMesh.position.set(0, -0.05, -0.1);
        gunHandleMesh.rotateX(Math.PI / 8);

        const gunTrigger1Geo = new T.TorusGeometry(0.015, 0.005, 16, 50);
        const gunTrigger1Mesh = new T.Mesh(gunTrigger1Geo, gunBarrelMat);
        gunTrigger1Mesh.position.set(0, -0.033, -0.063);
        gunTrigger1Mesh.rotateY(Math.PI / 2);

        gunGrp.add(gunBarrelMesh);
        gunGrp.add(gunBarrel2Mesh);
        gunGrp.add(gunHandleMesh);
        gunGrp.add(gunTrigger1Mesh);
        gunGrp.rotateY(- Math.PI / 1.1);
        gunGrp.rotateX(- Math.PI / 23);
        gunGrp.position.set(0.2, -0.1, -0.3);

        let gunTip = new T.Group();
        gunTip.position.set(0, 0, 0.1);
        gunGrp.add(gunTip);
        return [gunGrp, gunTip];
    }

    initLaser() {
        const laserGeo = new T.CylinderGeometry(0.01, 0.01, 1, 16);
        const laserMat = new T.MeshStandardMaterial({color: this.color});
        const laserMesh = new T.Mesh(laserGeo, laserMat);
        laserMesh.visible = false;
        return laserMesh;
    }

    updateLaser(objectsInScene, criticalPoints) {

        const direction = new T.Vector3();
        const startPoint = new T.Vector3();

        this.gunTip.getWorldPosition(startPoint);
        this.camera.getWorldDirection(direction);

        const raycaster = new T.Raycaster(startPoint, direction);
        const hits = raycaster.intersectObjects(objectsInScene, true);

        let endPoint;
        
        if (hits.length > 0) {
            endPoint = hits[0].point;
        }
        else {
            endPoint = startPoint.clone().add(direction.clone().multiplyScalar(20));
        }
        
        const distance = startPoint.distanceTo(endPoint);
        this.laser.scale.set(1, distance, 1);

        const midpoint = startPoint.clone().add(direction.clone().multiplyScalar(distance / 2));

        this.laser.position.copy(this.gunTip.worldToLocal(midpoint));

        const up = new T.Vector3(0, 1, 0);
        const quat = new T.Quaternion().setFromUnitVectors(up, direction.clone().normalize());
        const parentQuatInverse = this.gunTip.getWorldQuaternion(new T.Quaternion()).invert();
        this.laser.quaternion.copy(quat.premultiply(parentQuatInverse));

        this.laser.visible = true;
        
        // check if hit crit point - use new registry system
        for (let point of criticalPoints) {
            let distX = Math.abs(endPoint.x - point.cp.position.x);
            let distY = Math.abs(endPoint.y - point.cp.position.y);
            let distZ = Math.abs(endPoint.z - point.cp.position.z);
            if(distX < 0.05 && distY < 0.05 && distZ < 0.05) {
                // Check if we should claim this critical point (3-point limit with FIFO)
                const cpId = point.cp.userData?.cpId || point.cp.toString();
                
                // Don't claim if already claimed by this player
                if (this.claimedCriticalPoints.has(cpId)) {
                    return; // Skip to next iteration
                }
                
                // If at max capacity, remove the oldest claimed point (FIFO)
                if (this.claimedPointsList.length >= this.maxClaimedPoints) {
                    const oldestCpId = this.claimedPointsList.shift();
                    this.claimedCriticalPoints.delete(oldestCpId);
                    
                    // Coordinate with AgentManager's globalClaimedPoints system
                    if (window.gameManager && window.gameManager.globalClaimedPoints) {
                        // Find the index of the oldest point and remove it from global tracking
                        for (let i = 0; i < criticalPoints.length; i++) {
                            const pointCpId = criticalPoints[i].cp.userData?.cpId || criticalPoints[i].cp.toString();
                            if (pointCpId === oldestCpId) {
                                window.gameManager.globalClaimedPoints.delete(i);
                                console.log(`Player released CP ${i} from global tracking due to FIFO`);
                                break;
                            }
                        }
                    }
                    
                    // Find and DON'T revert color - let ownership persist until claimed by another
                    // This matches the Agent behavior for color persistence
                    console.log(`Player released oldest CP ${oldestCpId} but color persists until claimed by another`);
                }
                
                // Check if this point is already claimed by an agent
                let pointIndex = -1;
                for (let i = 0; i < criticalPoints.length; i++) {
                    const pointCpId = criticalPoints[i].cp.userData?.cpId || criticalPoints[i].cp.toString();
                    if (pointCpId === cpId) {
                        pointIndex = i;
                        break;
                    }
                }
                
                // Only claim if not already actively claimed by agents (via line of sight)
                if (pointIndex >= 0 && window.gameManager && window.gameManager.globalClaimedPoints) {
                    if (window.gameManager.globalClaimedPoints.has(pointIndex)) {
                        // Check if any agent is actively claiming this point (has line of sight)
                        let activelyClaimedByAgent = false;
                        if (window.gameManager.agents) {
                            for (let agent of window.gameManager.agents) {
                                if (agent.claimedCriticalPoints && agent.claimedCriticalPoints.has(pointIndex)) {
                                    activelyClaimedByAgent = true;
                                    console.log(`Player tried to claim CP ${pointIndex} but it's actively claimed by Agent ${agent.agentId}`);
                                    break;
                                }
                            }
                        }
                        if (activelyClaimedByAgent) {
                            return; // Skip claiming this point
                        }
                    }
                    // Add to global tracking
                    window.gameManager.globalClaimedPoints.add(pointIndex);
                }
                
                // Claim the new point
                this.claimedCriticalPoints.add(cpId);
                this.claimedPointsList.push(cpId);
                
                console.log(`Player claimed CP, now has ${this.claimedPointsList.length}/${this.maxClaimedPoints} points`);
                
                // Use the new critical point registry system if available
                if (this.criticalPointSystem && point.cp && point.cp.userData.cpId !== undefined) {
                    // Claim the CP in the registry (line drawn to it)
                    this.criticalPointSystem.claimCriticalPoint(cpId, this.color, 'Player');
                    
                    // Capture the CP (change ownership/color)
                    this.criticalPointSystem.captureCriticalPoint(cpId, this.color, 'Player');
                } else {
                    // Fallback to old color system if registry not available
                    if (point.cp && point.cp.material) {
                        point.cp.material.color.setHex(this.color);
                        // Also color the glow if it exists
                        if (point.cp.children && point.cp.children.length > 0) {
                            point.cp.children.forEach(child => {
                                if (child.material) {
                                    child.material.color.setHex(this.color);
                                }
                            });
                        }
                    }
                }
            }
        }
    }

    /**
     * updates position of the player, needs to be called in animate()
     */
    update(objectsInScene, criticalPoints) {

        // // update player position
        let moved = false;

        if(this.movement.w) {
            this.controls.moveForward(PLAYER_SPEED);
            moved = true;
        }
            
        if(this.movement.a){
            this.controls.moveRight(-PLAYER_SPEED);
            moved = true;
        }
            
        if(this.movement.s) {
            this.controls.moveForward(-PLAYER_SPEED);
            moved = true;
        }
            
        if(this.movement.d) {
            this.controls.moveRight(PLAYER_SPEED);
            moved = true;
        }
        if(moved) {
            let newPos = new T.Vector3(this.camera.position.x, this.camera.position.y - PLAYER_HEIGHT, this.camera.position.z);
            this.mesh.position.copy(newPos);
            
            this.collider.start.x = this.camera.position.x;
            this.collider.end.x = this.camera.position.x;        
            this.collider.start.z = this.camera.position.z;
            this.collider.end.z = this.camera.position.z;      
        }

        if(this.laserFire) {
            this.updateLaser(objectsInScene, criticalPoints);
        }
        else
            this.laser.visible = false;

        // update score using color-based scoring (most reliable)
        this.score = 0;
        let debugCount = 0;
        let colorMatches = [];
        
        for (let point of criticalPoints) {
            if (point.cp && point.cp.material && point.cp.material.color) {
                const cpColorHex = point.cp.material.color.getHex();
                debugCount++;
                if (cpColorHex === this.color) {
                    this.score++;
                }
                // Collect colors for debugging
                colorMatches.push(cpColorHex.toString(16).padStart(6, '0'));
            }
        }
        
        // Debug logging every 60 frames (~1 second)
        if (debugCount > 0 && Date.now() % 1000 < 50) {
            console.log(`Player scoring: checked ${debugCount} CPs, player color: ${this.color.toString(16).padStart(6, '0')}, score: ${this.score}`);
            console.log(`CP colors found: ${colorMatches.slice(0, 5).join(', ')}...`);
        }

        // // update jump
        // if(this.movement.spaceHold || !this.onGround) {

        //     this.collider.start.y += this.speedY;
        //     this.collider.end.y += this.speedY;
        //     const center = this.collider.start.clone().add(this.collider.end).multiplyScalar(0.5);
        //     const halfHeight = PLAYER_HEIGHT / 2;
        //     this.mesh.position.set(center.x, center.y - halfHeight, center.z);
        //     this.camera.position.set(center.x, center.y + halfHeight, center.z);

        //     if(this.onGround) 
        //         this.movement.spaceHold = false;
            
        //     this.speedY -= GRAVITY;
        // }

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
     * might need some other functions for colors and shooting
     * 
     * Set custom spawn position for the player
     * @param {number} x - X coordinate for spawn position
     * @param {number} y - Y coordinate for spawn position (optional, defaults to PLAYER_HEIGHT)
     * @param {number} z - Z coordinate for spawn position
     */
    setSpawnPosition(x, y = PLAYER_HEIGHT, z) {
        this.camera.position.set(x, y, z);
        
        // Update collider position to match
        this.collider.start.set(x, y - PLAYER_HEIGHT/2, z);
        this.collider.end.set(x, y - PLAYER_HEIGHT/4, z);
        
        // Update mesh position to match camera
        const meshY = y - PLAYER_HEIGHT;
        this.mesh.position.set(x, meshY, z);
    }
}

// Global constants (will be overridden by window globals if available)
const PLAYER_HEIGHT = window.PLAYER_HEIGHT || 0.5;
const PLAYER_RADIUS = window.PLAYER_RADIUS || (0.5 * Math.sqrt(2) / 2);
const PLAYER_SPEED = window.PLAYER_SPEED || 0.02;
const PLAYER_JUMP_HEIGHT = window.PLAYER_JUMP_HEIGHT || 1.2;
const PLAYER_JUMP_SPEED = window.PLAYER_JUMP_SPEED || 0.03;
const WORLD_BOUNDARY = window.WORLD_BOUNDARY || 20;
const GRAVITY = window.GRAVITY || ((window.PLAYER_JUMP_SPEED || 0.03) * (window.PLAYER_JUMP_SPEED || 0.03)) / (2 * (window.PLAYER_JUMP_HEIGHT || 1.2));


// Function to initialize the indexjake game (called from UI transition)
window.startIndexJakeGame = async function(selectedLevel = 1) {
    // Prevent multiple game instances from being created
    if (window.gameInstance && window.gameInstance.running) {
        console.warn('⚠️ Game is already running! Ignoring duplicate start request.');
        return;
    }
    
    console.log(`✓ Initializing indexjake game for level ${selectedLevel}`);
    console.log(`🎨 Loading map textures for mode ${selectedLevel}`);
    
    // Mark game as running
    window.gameInstance = { running: true };
    
// global variables
let startGame = false;

// to switch between different levels
let level1 = false;
let level2 = false;
let useMapGenerator = true; // Toggle to use MapGenerator instead of pre-built terrain

// set up renderer
let renderer = new T.WebGLRenderer({preserveDrawingBuffer:true});
renderer.setSize(1280, 720);
document.getElementById("div1").appendChild(renderer.domElement);
renderer.domElement.id = "canvas";

// set up scene
let scene = new T.Scene();

// perspective camera for debugging
// let perspCam = new T.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// perspCam.position.set(20, 5, 0);
// let controls = new OrbitControls(perspCam, renderer.domElement);
// controls.target.set(0, 5, 0);
// controls.update();

// simple start menu
const menuOverlay = document.getElementById("menuOverlay");

// handling collision
const collisionWorld = new Octree();

// map mode - USE THE SELECTED LEVEL TO DETERMINE TEXTURE SET
let mapMode = selectedLevel; // Level 1-5 maps to texture modes 1-5
console.log(`✅ Map mode set to: ${mapMode} (${['', 'LAB', 'HEDGE', 'GLASS', 'EYES', 'LIBRARY'][mapMode] || 'UNKNOWN'})`);

// Initialize Critical Point System
const criticalPointSystem = new window.CriticalPointSystem(scene);
let criticalPointsEnabled = true; // Toggle for critical points

// Initialize Agent Manager
const agentManager = new AgentManager(scene, collisionWorld, criticalPointSystem);

// Expose globals for consistency with DQN version
window.globalCPSystem = criticalPointSystem;
window.gameManager = agentManager;

// loading terrain
let levelObj = null;
let objectsInScene = [];

if (useMapGenerator) {
    // Import MapGenerator functions
    const { createFloor, createWalls, createBlock } = await import('./MapGenerator.js');
    
    // Always use the smallest level (10x10)
    const mapWidth = 10;
    const mapDepth = 10;
    
    // Create the level using MapGenerator
    levelObj = new T.Group();
    
    // Create floor
    const floor = createFloor(scene, mapWidth, mapDepth, 0.2);
    scene.remove(floor); // Remove from scene since createFloor adds it automatically
    levelObj.add(floor);
    
    // Create walls
    const walls = createWalls(scene, mapWidth, mapDepth, 2);
    walls.forEach(wall => {
        scene.remove(wall); // Remove from scene since createWalls adds them automatically
        levelObj.add(wall);
    });
    
    // Generate maze blocks (similar to LevelContent3D.js)
    const innerWidth = mapWidth - 2;
    const innerDepth = mapDepth - 2;
    const totalCells = innerWidth * innerDepth;
    const targetWallCount = Math.floor(totalCells * 0.3); // Reduced density for better gameplay
    
    // Simple maze generation (basic random placement)
    const mazeBlocks = [];
    const halfWidth = mapWidth / 2;
    const halfDepth = mapDepth / 2;
    
    for (let i = 0; i < targetWallCount; i++) {
        const x = Math.floor(Math.random() * innerWidth);
        const z = Math.floor(Math.random() * innerDepth);
        
        // Convert to world coordinates
        const actualX = -halfWidth + 1 + x + 0.5;
        const actualZ = -halfDepth + 1 + z + 0.5;
        
        const tempScene = new T.Scene();
        const block = createBlock(tempScene, actualX, actualZ, 2);
        tempScene.remove(block); // Remove from temp scene
        
        levelObj.add(block);
        mazeBlocks.push(block);
    }
    
    // Store map layout information for agent pathfinding
    const mapLayout = {
        width: mapWidth,
        depth: mapDepth,
        innerWidth: innerWidth,
        innerDepth: innerDepth,
        walls: walls.map(wall => ({
            position: wall.position.clone(),
            type: 'boundary'
        })),
        blocks: mazeBlocks.map(block => ({
            position: block.position.clone(),
            type: 'maze'
        })),
        floor: floor ? {
            position: floor.position.clone(),
            type: 'floor'
        } : null
    };
    
    // Make map layout globally accessible for agents
    window.mapLayout = mapLayout;
    
    // Add collision detection for all generated objects
    levelObj.children.forEach(child => {
        if (child.isMesh) {
            child.updateWorldMatrix(true, false);
            collisionWorld.fromGraphNode(child);
            
            // Add critical points to walls and blocks (not floor) using smart geometric detection
            if (criticalPointsEnabled && child !== floor) {
                const CP_COLORS = window.CP_COLORS;
                const pointCount = mazeBlocks.includes(child) ? 2 : 3;
                const criticalPoints = criticalPointSystem.addCriticalPoints(child, pointCount, CP_COLORS.WHITE);
                
                // Register critical points with agent manager
                criticalPoints.forEach(cp => {
                    agentManager.addCriticalPoint(cp.position, cp);
                });
            }
            
            // Add terrain as obstacles for line of sight
            agentManager.addObstacles([child]);
            objectsInScene.push(child);
        }
    });
    
    // set up textures
    M.setMapTexture(mapMode, mazeBlocks, walls, mapWidth, mapDepth, floor);

    
} else {
    // Original OBJ loading code
    const levelLoader = new O.OBJLoader();
    if(level1) {
        levelObj = await levelLoader.loadAsync( './Objects/Terrain1.obj' );
    }
    else if(level2) {
        levelObj = await levelLoader.loadAsync( './Objects/Terrain2.obj' );
    }

    levelObj.traverse(obs => {
        obs.updateWorldMatrix(true, false);
        collisionWorld.fromGraphNode(obs);
        // just assigning a random color for now
        if (obs.isMesh) {
            obs.material = new T.MeshStandardMaterial({
                color: new T.Color(Math.random(), Math.random(), Math.random())
            });
            
            // Add critical points to terrain meshes
            if (criticalPointsEnabled) {
                const CP_COLORS = window.CP_COLORS;
                const criticalPoints = criticalPointSystem.addCriticalPoints(obs, 3, CP_COLORS.WHITE);
                
                // Register critical points with agent manager
                criticalPoints.forEach(cp => {
                    // cp is a Three.js mesh with a position
                    agentManager.addCriticalPoint(cp.position, cp);
                });
            }
            
            // Add terrain as obstacles for line of sight
            agentManager.addObstacles([obs]);
        }
    });
}

// set up sky texture
M.setSkyTexture(mapMode, scene);

// add lighting to scene
let lighting = new MapLighting(scene);

scene.add(levelObj);

// create playable player and put in scene (pass criticalPointSystem)
let player1 = new Player(0, renderer, collisionWorld, criticalPointSystem);
scene.add(player1.object);

// Create multiple agents using the agent manager (inside the maze walls)
const agent1 = agentManager.createAgent(new T.Vector3(-4, 1, -4));  // Red agent - back left corner
const agent2 = agentManager.createAgent(new T.Vector3(4, 1, 4));    // Green agent - front right corner (opposite)

// Debug summary after agent creation
console.log('=== AGENT CREATION SUMMARY ===');
console.log(`Created ${agentManager.agents.length} agents`);
agentManager.agents.forEach((agent, i) => {
    const pos = agent.getPosition();
    console.log(`Agent ${i} (ID: ${agent.agentId}): Position (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}), Mode: ${agent.getMode()}`);
});
console.log(`AgentManager has ${agentManager.criticalPoints.length} critical points`);
console.log(`Critical Point System has ${criticalPointSystem.cpRegistry.size} CPs in registry`);

// Ensure agents are in random mode (trained)
agentManager.setAllAgentsMode('random');
console.log('All agents set to random mode');
console.log('===============================');

// Initialize score display
setTimeout(() => {
    updateScoreDisplay();
}, 100);

// Function to toggle critical points on/off
function toggleCriticalPoints(enabled) {
    criticalPointsEnabled = enabled;
    
    if (enabled) {
        // Add critical points to all terrain meshes
        levelObj.traverse(obs => {
            if (obs.isMesh) {
                const CP_COLORS = window.CP_COLORS;
                criticalPointSystem.addCriticalPoints(obs, 3, CP_COLORS.WHITE);
            }
        });
        console.log("Critical points enabled");
    } else {
        // Remove all critical points
        criticalPointSystem.clearAllCriticalPoints();
        console.log("Critical points disabled");
    }
}

// Make toggle function globally accessible (for debugging)
window.toggleCriticalPoints = toggleCriticalPoints;

// WASD controls: keydown (use named function to prevent duplicates)
const handleKeyDown = function (event) {
    if(startGame) {
        switch(event.key) {
            case 'w':
            case 'W':
                player1.movement.w = true;
                break;
            case 'a':
            case 'A':
                player1.movement.a = true;
                break;
            case 's':
            case 'S':
                player1.movement.s = true;
                break;
            case 'd':
            case 'D':
                player1.movement.d = true;
                break;
        }        
    }
};

// WASD controls: keyup (use named function to prevent duplicates)
const handleKeyUp = function (event) {
    if(startGame) {
        switch(event.key) {
            case 'w':
            case 'W':
                player1.movement.w = false;
                break;
            case 'a':
            case 'A':
                player1.movement.a = false;
                break;
            case 's':
            case 'S':
                player1.movement.s = false;
                break;
            case 'd':
            case 'D':
                player1.movement.d = false;
                break;
        }
    }
};

// Player mesh rotates with first person perspective (use named function)
const handleMouseMove = function (event) {
    if(startGame) {
        let camDir = new T.Vector3();
        player1.camera.getWorldDirection(camDir);
        camDir.y = 0; 
        camDir.normalize();
        player1.mesh.rotation.y = Math.atan2(camDir.x, camDir.z);
    }
};

// Enable and disable PointerLockControls (use named function)
const handleBodyClick = () => {
    menuOverlay.style.display = "none";
    player1.controls.lock();
    startGame = true;
};

const handleUnlock = () => {
    menuOverlay.style.display = 'block';
    startGame = false;
};

// Laser firing controls (use named functions)
const handleMouseDown = (event) => {
    if(event.button === 0) {
        player1.laserFire = true;
    }
};

const handleMouseUp = (event) => {
    if(event.button === 0) {
        player1.laserFire = false;
        player1.laser.visible = false;
    }
};

// Add event listeners only once
if (!window.gameEventListenersAdded) {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('click', handleBodyClick);
    player1.controls.addEventListener('unlock', handleUnlock);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    
    window.gameEventListenersAdded = true;
    console.log('✓ Game event listeners added');
}

// // some helpers, leaving in for now so I don't have to type it again
// const helper = new OctreeHelper( collisionWorld );
// scene.add( helper );

// const cameraHelper = new T.CameraHelper(player1.camera);
// scene.add(cameraHelper);

let previousTime = 0;

// scene.add(new T.SpotLight("green", 3, 50, Math.PI / 4, 0.1, 2));

// Performance optimization: limit UI updates to 10fps instead of every frame
let lastUIUpdateTime = 0;
const UI_UPDATE_INTERVAL = 100; // Update UI every 100ms (10fps)

function animate(timestamp) {

    // putting this here for now, just in case
    if(previousTime == 0)
        previousTime = timestamp;
    let delta = (timestamp - previousTime) / 1000;

    // Check if game should end (35 seconds elapsed)
    if (startGame && gameStartTime && !gameOver) {
        const elapsedMs = Date.now() - gameStartTime;
        if (elapsedMs >= GAME_DURATION) {
            gameOver = true;
            showGameOver();
        }
    }

    // Only update game objects if the game has actually started and not over
    if (startGame && !gameOver) {
        player1.update(objectsInScene, criticalPointSystem.criticalPoints);
        
        // Update all agents and their line of sight
        agentManager.update();
        
        // Update critical points animation (less frequently for better performance)
        if (criticalPointSystem && timestamp - lastUIUpdateTime > UI_UPDATE_INTERVAL / 2) {
            criticalPointSystem.updateCriticalPoints();
        }
    }

    // when timer has only ten seconds left, light starts pulsing
    // lighting.pulsing(delta);

    renderer.render(scene, player1.camera);
    
    // Update UI less frequently to improve performance
    if (timestamp - lastUIUpdateTime > UI_UPDATE_INTERVAL) {
        updateScoreDisplay();
        lastUIUpdateTime = timestamp;
    }
    
    previousTime = timestamp;
    window.requestAnimationFrame(animate);
}

// Add keyboard controls for debugging
document.addEventListener('keydown', function(event) {
    // Reserved for future debugging controls
});

// Game start time for tracking elapsed time
let gameStartTime = null;
const GAME_DURATION = 35000; // 35 seconds in milliseconds
let gameOver = false;

// Function to update score display
function updateScoreDisplay() {
    const scoreDiv = document.getElementById('agentScores');
    if (!scoreDiv) return;
    
    // Initialize game start time if not set
    if (!gameStartTime && startGame) {
        gameStartTime = Date.now();
    }
    
    let text = '';
    
    // Show scores by color
    const scores = { Red: 0, Green: 0, Blue: 0 };
    
    // Get agent scores
    if (agentManager && agentManager.agents) {
        agentManager.agents.forEach((agent) => {
            try {
                const score = agent.getScore();
                const hexColor = agent.agentColor.toString(16).padStart(6, '0');
                const colorName = getColorName(hexColor);
                if (scores.hasOwnProperty(colorName)) {
                    scores[colorName] = score;
                }
            } catch (e) {
                // Skip if error getting agent data
            }
        });
    }
    
    // Get player score (Blue)
    if (player1) {
        scores.Blue = player1.score;
    }
    
    // Display scores
    text += `Red: ${scores.Red}\n`;
    text += `Green: ${scores.Green}\n`;
    text += `Blue: ${scores.Blue}\n\n`;
    
    // Show game time
    if (gameStartTime && startGame) {
        const elapsedMs = Date.now() - gameStartTime;
        const seconds = Math.floor(elapsedMs / 1000);
        const milliseconds = elapsedMs % 1000;
        text += `Time: ${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
    } else {
        text += `Time: 0.000s`;
    }
    
    // Update display
    scoreDiv.innerHTML = text.replace(/\n/g, '<br>');
}

// Function to show game over screen
function showGameOver() {
    console.log('🏁 GAME OVER - 35 seconds elapsed');
    
    // Calculate final scores
    const scores = { Red: 0, Green: 0, Blue: 0 };
    
    // Get agent scores
    if (agentManager && agentManager.agents) {
        agentManager.agents.forEach((agent) => {
            try {
                const score = agent.getScore();
                const hexColor = agent.agentColor.toString(16).padStart(6, '0');
                const colorName = getColorName(hexColor);
                if (scores.hasOwnProperty(colorName)) {
                    scores[colorName] = score;
                }
            } catch (e) {
                // Skip if error getting agent data
            }
        });
    }
    
    // Get player score (Blue)
    if (player1) {
        scores.Blue = player1.score;
    }
    
    // Determine winner
    let winner = 'Blue';
    let highScore = scores.Blue;
    if (scores.Red > highScore) {
        winner = 'Red';
        highScore = scores.Red;
    }
    if (scores.Green > highScore) {
        winner = 'Green';
        highScore = scores.Green;
    }
    
    // Create game over overlay
    const overlay = document.createElement('div');
    overlay.id = 'gameOverOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10002;
        font-family: monospace;
        color: white;
    `;
    
    // Create content container
    const content = document.createElement('div');
    content.style.cssText = `
        text-align: center;
        padding: 40px;
        border: 2px solid white;
        background: black;
        min-width: 400px;
    `;
    
    content.innerHTML = `
        <h1 style="font-size: 48px; margin-bottom: 30px; letter-spacing: 4px;">GAME OVER</h1>
        <div style="font-size: 24px; margin-bottom: 40px;">
            <div style="margin: 15px 0;">RED: ${scores.Red}</div>
            <div style="margin: 15px 0;">GREEN: ${scores.Green}</div>
            <div style="margin: 15px 0;">BLUE: ${scores.Blue}</div>
        </div>
        <div style="font-size: 32px; margin-top: 30px; padding-top: 30px; border-top: 1px solid white;">
            WINNER: <span style="color: ${winner.toLowerCase()};">${winner.toUpperCase()}</span>
        </div>
        <div style="font-size: 16px; margin-top: 30px; opacity: 0.7;">
            Press ESC to exit
        </div>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    // Release pointer lock if active
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
    
    // Add escape key handler
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            location.reload(); // Reload page to restart
        }
    };
    document.addEventListener('keydown', escHandler);
    
    console.log(`🏆 Winner: ${winner} with ${highScore} points`);
}

// Show LOS UI when game starts (only add listener once)
const showLOSUI = () => {
    setTimeout(() => {
        const losUI = document.getElementById('losUI');
        if (losUI) {
            losUI.style.display = 'block';
        }
    }, 1000);
};

if (!window.losUIListenerAdded) {
    document.body.addEventListener('click', showLOSUI);
    window.losUIListenerAdded = true;
}

// Start animation loop only once
if (!window.gameAnimationStarted) {
    window.requestAnimationFrame(animate);
    window.gameAnimationStarted = true;
    console.log('✓ Animation loop started');
}

// Pathfinding utilities for agents (globally accessible)
window.MapPathfinding = {
    
    /**
     * Check if a position is walkable (not blocked by walls or maze blocks)
     * @param {number} x - World X coordinate
     * @param {number} z - World Z coordinate
     * @returns {boolean} - True if walkable
     */
    isWalkable: function(x, z) {
        const layout = window.mapLayout;
        if (!layout) return false;
        
        // Check boundary walls
        const halfWidth = layout.width / 2;
        const halfDepth = layout.depth / 2;
        if (x <= -halfWidth || x >= halfWidth || z <= -halfDepth || z >= halfDepth) {
            return false;
        }
        
        // Check maze blocks (blocks are 1x1 centered on their position)
        for (const block of layout.blocks) {
            const blockX = block.position.x;
            const blockZ = block.position.z;
            if (Math.abs(x - blockX) < 0.5 && Math.abs(z - blockZ) < 0.5) {
                return false;
            }
        }
        
        return true;
    },
    
    /**
     * Get valid movement directions from a position
     * @param {number} x - Current world X coordinate
     * @param {number} z - Current world Z coordinate
     * @param {number} stepSize - Step size for movement (default 0.5)
     * @returns {Array} - Array of valid direction vectors
     */
    getValidDirections: function(x, z, stepSize = 0.5) {
        const directions = [
            {x: stepSize, z: 0, name: 'east'},
            {x: -stepSize, z: 0, name: 'west'},
            {x: 0, z: stepSize, name: 'north'},
            {x: 0, z: -stepSize, name: 'south'},
            {x: stepSize, z: stepSize, name: 'northeast'},
            {x: -stepSize, z: stepSize, name: 'northwest'},
            {x: stepSize, z: -stepSize, name: 'southeast'},
            {x: -stepSize, z: -stepSize, name: 'southwest'}
        ];
        
        return directions.filter(dir => 
            this.isWalkable(x + dir.x, z + dir.z)
        );
    },
    
    /**
     * Simple pathfinding - find next step towards target
     * @param {object} from - {x, z} starting position
     * @param {object} to - {x, z} target position
     * @returns {object|null} - Next step direction or null if blocked
     */
    getNextStep: function(from, to) {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 0.1) return null; // Already at target
        
        // Normalize direction
        const stepSize = 0.3;
        const dirX = (dx / distance) * stepSize;
        const dirZ = (dz / distance) * stepSize;
        
        // Check if direct path is walkable
        const nextX = from.x + dirX;
        const nextZ = from.z + dirZ;
        
        if (this.isWalkable(nextX, nextZ)) {
            return {x: dirX, z: dirZ};
        }
        
        // If direct path blocked, try alternative directions
        const validDirs = this.getValidDirections(from.x, from.z, stepSize);
        if (validDirs.length === 0) return null;
        
        // Choose direction closest to target
        let bestDir = null;
        let bestDot = -2;
        
        for (const dir of validDirs) {
            const dot = (dir.x * dx + dir.z * dz) / distance;
            if (dot > bestDot) {
                bestDot = dot;
                bestDir = dir;
            }
        }
        
        return bestDir;
    }
};

// Function to convert hex color codes to readable names
function getColorName(hexColor) {
    // Convert to string and pad with zeros to ensure 6 digits
    let cleanHex = hexColor.toString().replace('#', '').toLowerCase();
    cleanHex = cleanHex.padStart(6, '0'); // Ensure it's always 6 digits
    
    const colorMap = {
        'ff0000': 'Red',
        '00ff00': 'Green', 
        'ffff00': 'Yellow',
        'ff00ff': 'Magenta',
        '00ffff': 'Cyan',
        'ff8000': 'Orange',
        '8000ff': 'Purple',
        '80ff00': 'Lime',
        'ff0080': 'Pink',
        '0000ff': 'Blue'  // Added blue for player
    };
    
    return colorMap[cleanHex] || `Color ${cleanHex}`;
}

}; // End of startIndexJakeGame function
