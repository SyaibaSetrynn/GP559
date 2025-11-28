import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";
import {OrbitControls} from "https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { Octree } from "https://unpkg.com/three@0.165.0/examples/jsm/math/Octree.js";
import Agent from "./Agent.js";
import AgentManager from "./AgentManager.js";

// Make Three.js available globally for mapgenerator.js
window.THREE = T;

// Load critical point system and colors
try {
    const criticalPointModule = await import('./critical-point-system.js');
    window.CriticalPointSystem = criticalPointModule.CriticalPointSystem;
    window.CP_COLORS = criticalPointModule.CP_COLORS;
    console.log("Critical Point System loaded successfully");
} catch (error) {
    console.warn("Could not load Critical Point System:", error);
    window.CriticalPointSystem = null;
    // Fallback colors
    window.CP_COLORS = {
        WHITE: 0xffffff,
        RED: 0xff0000,
        GREEN: 0x00ff00,
        BLUE: 0x0000ff,
        YELLOW: 0xffff00,
        MAGENTA: 0xff00ff,
        CYAN: 0x00ffff
    };
}

/**
 * Agent Test Environment
 * A dedicated testing ground for agents with free-roam camera
 * Completely separate from the player game
 */

// Global variables
let scene, renderer, camera, controls;
let collisionWorld;
let agentManager;
let criticalPointSystem;
let objectsInScene = [];
let levelObj = null;

// Free-roam camera variables
let cameraMovement = {w: false, a: false, s: false, d: false, space: false, shift: false};
const CAMERA_SPEED = 0.1;

// Initialize the agent test environment
async function init() {
    console.log("Starting agent test environment initialization...");
    
    try {
        // Set up renderer
        renderer = new T.WebGLRenderer({preserveDrawingBuffer: true});
        renderer.setSize(1280, 720);
        document.getElementById("div1").appendChild(renderer.domElement);
        renderer.domElement.id = "canvas";
        console.log("Renderer created");

        // Set up scene
        scene = new T.Scene();
        console.log("Scene created");

        // Set up free-roam camera
        camera = new T.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(15, 10, 15);
        
        // Set up orbit controls for free camera movement
        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 2, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.minDistance = 2;
        controls.maxDistance = 50;
        controls.maxPolarAngle = Math.PI * 0.9; // Prevent camera from going completely under
        controls.update();
        console.log("Camera and controls created");

        // Add lighting
        scene.add(new T.AmbientLight("white", 0.8));
        const directionalLight = new T.DirectionalLight("white", 0.5);
        directionalLight.position.set(10, 10, 5);
        scene.add(directionalLight);
        console.log("Lighting added");

        // Add a test cube to verify rendering is working
        const testGeo = new T.BoxGeometry(1, 1, 1);
        const testMat = new T.MeshStandardMaterial({color: 0xff0000});
        const testCube = new T.Mesh(testGeo, testMat);
        testCube.position.set(0, 0.5, 0);
        scene.add(testCube);
        console.log("Test cube added");

        // Initialize collision world
        collisionWorld = new Octree();
        console.log("Collision world created");

        // Initialize Critical Point System (check if available)
        if (window.CriticalPointSystem) {
            criticalPointSystem = new window.CriticalPointSystem(scene);
            console.log("Critical Point System initialized");
        } else {
            console.warn("Critical Point System not available - creating fallback");
            // Create a simple fallback
            criticalPointSystem = {
                addCriticalPoints: () => [],
                updateCriticalPoints: () => {},
                clearAllCriticalPoints: () => {}
            };
        }

        // Initialize Agent Manager
        agentManager = new AgentManager(scene, collisionWorld);
        console.log("Agent Manager created");

        // Load the procedural map (same as player version)
        try {
            await loadProceduralMap();
            console.log("Map loaded");
        } catch (error) {
            console.error("Error loading map:", error);
        }

        // Add keyboard controls for camera movement
        setupCameraControls();
        console.log("Controls setup");

        // Start the animation loop
        animate();
        console.log("Animation started");

        console.log("Agent Test Environment initialized successfully!");
        
    } catch (error) {
        console.error("Error initializing agent test environment:", error);
    }
}

// Load the same procedural map as the player version
async function loadProceduralMap() {
    // Import MapGenerator functions
    const { createFloor, createWalls, createBlock } = await import('./mapgenerator.js');
    
    // Use the same map size as player version
    const mapWidth = 10;
    const mapDepth = 10;
    
    // Create the level using MapGenerator
    levelObj = new T.Group();
    
    // Create floor
    const floor = createFloor(scene, mapWidth, mapDepth, 0.2);
    scene.remove(floor);
    levelObj.add(floor);
    
    // Create walls
    const walls = createWalls(scene, mapWidth, mapDepth, 2);
    walls.forEach(wall => {
        scene.remove(wall);
        levelObj.add(wall);
    });
    
    // Generate maze blocks
    const innerWidth = mapWidth - 2;
    const innerDepth = mapDepth - 2;
    const totalCells = innerWidth * innerDepth;
    const targetWallCount = Math.floor(totalCells * 0.3);
    
    const mazeBlocks = [];
    const halfWidth = mapWidth / 2;
    const halfDepth = mapDepth / 2;
    
    for (let i = 0; i < targetWallCount; i++) {
        const x = Math.floor(Math.random() * innerWidth);
        const z = Math.floor(Math.random() * innerDepth);
        
        const actualX = -halfWidth + 1 + x + 0.5;
        const actualZ = -halfDepth + 1 + z + 0.5;
        
        const tempScene = new T.Scene();
        const block = createBlock(tempScene, actualX, actualZ, 2);
        tempScene.remove(block);
        
        levelObj.add(block);
        mazeBlocks.push(block);
    }
    
    // Store map layout for pathfinding (same as player version)
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
    
    // Make map layout globally accessible
    window.mapLayout = mapLayout;
    
    // Add pathfinding utilities (copy from Player.js)
    window.MapPathfinding = {
        isWalkable: function(x, z) {
            const layout = window.mapLayout;
            if (!layout) return false;
            
            const halfWidth = layout.width / 2;
            const halfDepth = layout.depth / 2;
            if (x <= -halfWidth || x >= halfWidth || z <= -halfDepth || z >= halfDepth) {
                return false;
            }
            
            for (const block of layout.blocks) {
                const blockX = block.position.x;
                const blockZ = block.position.z;
                if (Math.abs(x - blockX) < 0.5 && Math.abs(z - blockZ) < 0.5) {
                    return false;
                }
            }
            
            return true;
        },
        
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
        
        getNextStep: function(from, to) {
            const dx = to.x - from.x;
            const dz = to.z - from.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < 0.1) return null;
            
            const stepSize = 0.3;
            const dirX = (dx / distance) * stepSize;
            const dirZ = (dz / distance) * stepSize;
            
            const nextX = from.x + dirX;
            const nextZ = from.z + dirZ;
            
            if (this.isWalkable(nextX, nextZ)) {
                return {x: dirX, z: dirZ};
            }
            
            const validDirs = this.getValidDirections(from.x, from.z, stepSize);
            if (validDirs.length === 0) return null;
            
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
    
    // Add collision detection and critical points
    levelObj.children.forEach(child => {
        if (child.isMesh) {
            child.updateWorldMatrix(true, false);
            collisionWorld.fromGraphNode(child);
            
            // Add critical points (only to walls and blocks, not floor)
            if (child !== floor) {
                const CP_COLORS = window.CP_COLORS;
                const pointCount = mazeBlocks.includes(child) ? 2 : 3;
                const criticalPoints = criticalPointSystem.addCriticalPoints(child, pointCount, CP_COLORS.WHITE);
                
                criticalPoints.forEach(cp => {
                    agentManager.addCriticalPoint(cp.position, cp);
                });
            }
            
            agentManager.addObstacles([child]);
            objectsInScene.push(child);
        }
    });
    
    scene.add(levelObj);
}

// Set up camera controls
function setupCameraControls() {
    // Keyboard controls for camera movement
    document.addEventListener('keydown', function(event) {
        switch(event.key.toLowerCase()) {
            case 'w':
                cameraMovement.w = true;
                break;
            case 'a':
                cameraMovement.a = true;
                break;
            case 's':
                cameraMovement.s = true;
                break;
            case 'd':
                cameraMovement.d = true;
                break;
            case ' ':
                cameraMovement.space = true;
                event.preventDefault();
                break;
            case 'shift':
                cameraMovement.shift = true;
                break;
        }
    });

    document.addEventListener('keyup', function(event) {
        switch(event.key.toLowerCase()) {
            case 'w':
                cameraMovement.w = false;
                break;
            case 'a':
                cameraMovement.a = false;
                break;
            case 's':
                cameraMovement.s = false;
                break;
            case 'd':
                cameraMovement.d = false;
                break;
            case ' ':
                cameraMovement.space = false;
                break;
            case 'shift':
                cameraMovement.shift = false;
                break;
        }
    });
}

// Update camera position based on keyboard input
function updateCameraMovement() {
    if (!camera || !controls) return;

    const direction = new T.Vector3();
    camera.getWorldDirection(direction);
    const right = new T.Vector3();
    right.crossVectors(direction, camera.up).normalize();

    if (cameraMovement.w) {
        camera.position.add(direction.multiplyScalar(CAMERA_SPEED));
        controls.target.add(direction.multiplyScalar(CAMERA_SPEED));
    }
    if (cameraMovement.s) {
        camera.position.add(direction.multiplyScalar(-CAMERA_SPEED));
        controls.target.add(direction.multiplyScalar(-CAMERA_SPEED));
    }
    if (cameraMovement.a) {
        camera.position.add(right.multiplyScalar(-CAMERA_SPEED));
        controls.target.add(right.multiplyScalar(-CAMERA_SPEED));
    }
    if (cameraMovement.d) {
        camera.position.add(right.multiplyScalar(CAMERA_SPEED));
        controls.target.add(right.multiplyScalar(CAMERA_SPEED));
    }
    if (cameraMovement.space) {
        camera.position.y += CAMERA_SPEED;
        controls.target.y += CAMERA_SPEED;
    }
    if (cameraMovement.shift) {
        camera.position.y -= CAMERA_SPEED;
        controls.target.y -= CAMERA_SPEED;
    }
}

// Animation loop
function animate() {
    updateCameraMovement();
    controls.update();
    
    // Update agents
    if (agentManager) {
        agentManager.update();
    }
    
    // Update critical points
    if (criticalPointSystem) {
        criticalPointSystem.updateCriticalPoints();
    }
    
    // Update UI
    updateScoreDisplay();
    
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// UI Control Functions (globally accessible)
window.spawnRandomAgent = function() {
    if (!agentManager) return;
    
    const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Find a random walkable position
    if (window.mapLayout) {
        const layout = window.mapLayout;
        let spawnPos = null;
        
        for (let attempts = 0; attempts < 50; attempts++) {
            const x = (Math.random() - 0.5) * (layout.width - 2);
            const z = (Math.random() - 0.5) * (layout.depth - 2);
            
            if (window.MapPathfinding && window.MapPathfinding.isWalkable(x, z)) {
                spawnPos = new T.Vector3(x, 1, z);
                break;
            }
        }
        
        if (spawnPos) {
            const agent = agentManager.createAgent(spawnPos, randomColor);
            console.log(`Spawned agent ${agent.agentId} at (${spawnPos.x.toFixed(2)}, ${spawnPos.z.toFixed(2)})`);
        } else {
            console.log("Could not find valid spawn position");
        }
    }
};

window.clearAllAgents = function() {
    if (agentManager) {
        agentManager.clearAllAgents();
        console.log("All agents cleared");
    }
};

window.toggleCriticalPoints = function() {
    if (criticalPointSystem) {
        // This would need to be implemented in the critical point system
        console.log("Toggle critical points (not yet implemented)");
    }
};

window.makeAgentsSeekPoints = function() {
    if (agentManager) {
        const agents = agentManager.getAgents();
        const criticalPoints = agentManager.getCriticalPoints();
        
        agents.forEach(agent => {
            agent.seekNearestCriticalPoint(criticalPoints, objectsInScene);
        });
        
        console.log("Agents now seeking critical points");
    }
};

window.setRandomTargets = function() {
    if (agentManager) {
        const agents = agentManager.getAgents();
        agents.forEach(agent => {
            agent.setRandomTarget();
        });
        console.log("Set random targets for all agents");
    }
};

window.stopAllAgents = function() {
    if (agentManager) {
        const agents = agentManager.getAgents();
        agents.forEach(agent => {
            agent.stop();
        });
        console.log("Stopped all agents");
    }
};

// Update score display
function updateScoreDisplay() {
    const scoreDiv = document.getElementById('agentScores');
    if (scoreDiv && agentManager) {
        const scores = agentManager.getScores();
        if (scores && scores.length > 0) {
            scoreDiv.innerHTML = scores.map(s => 
                `<div style="color: #${s.color.toString(16).padStart(6, '0')};">Agent ${s.agentId}: ${s.score} points</div>`
            ).join('');
        } else {
            scoreDiv.innerHTML = '<div>No agents spawned</div>';
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
