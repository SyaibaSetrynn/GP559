import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";
import {OrbitControls} from "https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { Octree } from "https://unpkg.com/three@0.165.0/examples/jsm/math/Octree.js";
import Agent from "./Agent.js";
import AgentManager from "./AgentManager.js";

/**
 * Agent Test Main - Replicates Player.js but with free roam camera and agents
 * Uses the exact same map generation and critical point system as indexjake.html
 */

// Global variables (same as Player.js)
const WORLD_BOUNDARY = 20;

let startGame = false;

// Map generation settings (same as Player.js)
let level1 = false;
let level2 = false;
let useMapGenerator = true; // Use MapGenerator instead of pre-built terrain

// Set up renderer (same as Player.js)
let renderer = new T.WebGLRenderer({preserveDrawingBuffer:true});
renderer.setSize(1280, 720);
document.getElementById("div1").appendChild(renderer.domElement);
renderer.domElement.id = "canvas";

// Set up scene (same as Player.js)
let scene = new T.Scene();

// FREE ROAM CAMERA instead of player camera
let camera = new T.PerspectiveCamera(75, 1280 / 720, 0.1, 1000);
camera.position.set(15, 10, 15);
let controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

// Add lighting (same as Player.js)
scene.add(new T.AmbientLight("white"));

// Collision handling (same as Player.js)
const collisionWorld = new Octree();

// Initialize Critical Point System (same as Player.js)
const criticalPointSystem = new window.CriticalPointSystem(scene);
let criticalPointsEnabled = true;

// Set global reference immediately after creation
window.globalCPSystem = criticalPointSystem;

// Initialize Agent Manager (same as Player.js)
const agentManager = new AgentManager(scene, collisionWorld, criticalPointSystem);

// Loading terrain (same logic as Player.js)
let levelObj = null;
let objectsInScene = [];

if (useMapGenerator) {
    // Import MapGenerator functions (same as Player.js)
    const { createFloor, createWalls, createBlock } = await import('./mapgenerator.js');
    
    // Always use the smallest level (10x10) (same as Player.js)
    const mapWidth = 10;
    const mapDepth = 10;
    
    // Create the level using MapGenerator (same as Player.js)
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
    
    // Generate maze blocks (same as Player.js)
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
    
    // Store map layout information (same as Player.js)
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
    
    // Make map layout globally accessible (same as Player.js)
    window.mapLayout = mapLayout;
    
    // Add collision detection for all generated objects (same as Player.js)
    levelObj.children.forEach(child => {
        if (child.isMesh) {
            child.updateWorldMatrix(true, false);
            collisionWorld.fromGraphNode(child);
            
            // Add critical points to walls and blocks (not floor) using smart geometric detection
            if (criticalPointsEnabled && child !== floor) {
                const CP_COLORS = window.CP_COLORS;
                const pointCount = mazeBlocks.includes(child) ? 2 : 3;
                
                // Debug logging for CP creation
                console.log(`🎯 Attempting to add ${pointCount} CPs to object:`, child.geometry.type, child.position);
                
                const criticalPoints = criticalPointSystem.addCriticalPoints(child, pointCount, CP_COLORS.WHITE);
                
                console.log(`✅ Added ${criticalPoints.length} CPs to object`);
                
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
    
} else {
    // Original OBJ loading code (same as Player.js)
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
        if (obs.isMesh) {
            obs.material = new T.MeshStandardMaterial({
                color: new T.Color(Math.random(), Math.random(), Math.random())
            });
            
            if (criticalPointsEnabled) {
                const CP_COLORS = window.CP_COLORS;
                const criticalPoints = criticalPointSystem.addCriticalPoints(obs, 3, CP_COLORS.WHITE);
                
                // Debug logging for CP creation
                console.log(`🎯 Attempting to add 3 CPs to object:`, obs.geometry.type, obs.position);
                
                criticalPoints.forEach(cp => {
                    agentManager.addCriticalPoint(cp.position, cp);
                });
                
                console.log(`✅ Added ${criticalPoints.length} CPs to object`);
            }
            
            agentManager.addObstacles([obs]);
        }
    });
}

scene.add(levelObj);

// Mark CPs as fully loaded after scene setup
setTimeout(() => {
    cpsFullyLoaded = true;
    window.cpsFullyLoaded = true; // Global flag for agents to check
    
    // Force initial score display update after CPs are loaded
    updateScoreDisplay();
}, 100); // Small delay to ensure all async operations complete

// Create multiple agents in corners of the map (slightly inset to avoid walls)
const agent1 = agentManager.createAgent(new T.Vector3(3.5, 1, 3.5));   // Red agent - top-right corner
const agent2 = agentManager.createAgent(new T.Vector3(-3.5, 1, 3.5));  // Green agent - top-left corner
const agent3 = agentManager.createAgent(new T.Vector3(3.5, 1, -3.5));  // Blue agent - bottom-right corner

// Add pathfinding utilities (same as Player.js)
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


// Track when critical points are fully loaded
let cpsFullyLoaded = false;
let isUpdatingScores = false;

// Initial score display will be called after CPs are fully loaded
// (moved to the cpsFullyLoaded setTimeout above to avoid race conditions)

let previousTime = 0;

function animate(timestamp) {
    // Same as Player.js but with free roam camera updates
    if(previousTime == 0)
        previousTime = timestamp;
    let delta = (timestamp - previousTime) / 1000;

    // Update free roam camera
    controls.update();
    
    // Update all agents and their line of sight (same as Player.js)
    agentManager.update();
    
    // Update critical points animation (same as Player.js)
    if (criticalPointSystem) {
        criticalPointSystem.updateCriticalPoints();
    }

    renderer.render(scene, camera); // Use free roam camera instead of player camera
    previousTime = timestamp;
    
    // Update scores display (same as Player.js)  
    if (Math.floor(timestamp / 200) !== Math.floor(previousTime / 200)) {
        try {
            // Only update scores if CPs are fully loaded OR if there are actually CPs in the registry
            if (cpsFullyLoaded || (criticalPointSystem && criticalPointSystem.cpRegistry.size > 0)) {
                updateScoreDisplay();
            } else {

            }
        } catch (error) {
            console.error('Score display update error:', error);
        }
    }

    window.requestAnimationFrame(animate);
}

// Function to update score display (same as Player.js)
function updateScoreDisplay() {
    // Prevent overlapping updates
    if (isUpdatingScores) return;
    isUpdatingScores = true;
    
    // Set timeout to ensure flag gets reset even if there's an error
    setTimeout(() => { isUpdatingScores = false; }, 50);
    
    const scoreDiv = document.getElementById('agentScores');
    if (scoreDiv) {
        let html = '';
        
        // Show CP-based scoring from the registry
        if (criticalPointSystem) {
            const cpScoring = criticalPointSystem.getScoring();
            const currentTime = new Date().toLocaleTimeString();
            

            

            
            // Debug CP info to find the zero issue
            html += `<div style="color: white; font-weight: bold;">Critical Points:</div>`;
            html += `<div style="color: #ccc;">Total: ${criticalPointSystem.cpRegistry.size}</div>`;
            html += `<div style="color: #ccc;">Neutral: ${cpScoring.neutral}</div>`;
            html += `<div style="color: #ccc;">Claimed: ${cpScoring.activelyClaimed}</div>`;
            

            

            
            html += '<br>';
        } else {
            html += `<div style="color: red;">⚠️ Critical Point System not initialized</div><br>`;
        }
        
        // Show agent scores from AgentManager
        if (agentManager) {
            const scores = agentManager.getScores();
            if (scores && scores.length > 0) {
                html += `<div style="color: white; font-weight: bold;">Agent Scores:</div>`;
                html += scores.map(s => 
                    `<div style="color: #${s.color.toString(16).padStart(6, '0')};">Agent ${s.agentId}: ${s.score} points</div>`
                ).join('');
            } else {
                html += '<div style="color: #ccc;">No agents found</div>';
            }
        }
        
        scoreDiv.innerHTML = html;
    }
}

// Expose score display function globally
window.updateScoreDisplay = updateScoreDisplay;

window.requestAnimationFrame(animate);



async function generateScene() {
    console.log('🏗️ Generating new scene...');
    
    // Always use the smallest level (10x10) (same as Player.js)
    const mapWidth = 10;
    const mapDepth = 10;
    
    // Create the level using MapGenerator (same as Player.js)
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
    
    // Generate maze blocks (same as Player.js)
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
    
    // Store map layout information (same as Player.js)
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
    
    // Make map layout globally accessible (same as Player.js)
    window.mapLayout = mapLayout;
    
    // Add collision detection for all generated objects (same as Player.js)
    levelObj.children.forEach(child => {
        if (child.isMesh) {
            child.updateWorldMatrix(true, false);
            collisionWorld.fromGraphNode(child);
            
            // Add critical points to walls and blocks (not floor) using smart geometric detection
            if (criticalPointsEnabled && child !== floor) {
                const CP_COLORS = window.CP_COLORS;
                const pointCount = mazeBlocks.includes(child) ? 2 : 3;
                
                // Debug logging for CP creation
                console.log(`🎯 Attempting to add ${pointCount} CPs to object:`, child.geometry.type, child.position);
                
                const criticalPoints = criticalPointSystem.addCriticalPoints(child, pointCount, CP_COLORS.WHITE);
                
                console.log(`✅ Added ${criticalPoints.length} CPs to object`);
                
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
    
    scene.add(levelObj);
    
    // Mark CPs as fully loaded after scene setup
    setTimeout(() => {
        cpsFullyLoaded = true;
        console.log(`✅ CPs loaded: ${criticalPointSystem.cpRegistry.size} total`);
    }, 100); // Small delay to ensure all async operations complete

    // Create multiple agents (same as Player.js but spawn more)
    const agent1 = agentManager.createAgent(new T.Vector3(2, 1, 2));   // Red agent
    const agent2 = agentManager.createAgent(new T.Vector3(-2, 1, -2)); // Green agent
    const agent3 = agentManager.createAgent(new T.Vector3(3, 1, -1));  // Blue agent

    // Add pathfinding utilities (same as Player.js)
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


    // Track when critical points are fully loaded
    let cpsFullyLoaded = false;

    // Initialize score display (same as Player.js)
    setTimeout(() => {
        updateScoreDisplay();
    }, 100);

    let previousTime = 0;

    function animate(timestamp) {
        // Same as Player.js but with free roam camera updates
        if(previousTime == 0)
            previousTime = timestamp;
        let delta = (timestamp - previousTime) / 1000;

        // Update free roam camera
        controls.update();
        
        // Update all agents and their line of sight (same as Player.js)
        agentManager.update();
        
        // Update critical points animation (same as Player.js)
        if (criticalPointSystem) {
            criticalPointSystem.updateCriticalPoints();
        }

        renderer.render(scene, camera); // Use free roam camera instead of player camera
        previousTime = timestamp;
        
        // Update scores display (same as Player.js)  
        if (Math.floor(timestamp / 500) !== Math.floor(previousTime / 500)) {
            if (cpsFullyLoaded) {
                updateScoreDisplay();
            }
        }

        window.requestAnimationFrame(animate);
    }

    // Function to update score display (same as Player.js)
    function updateScoreDisplay() {
        const scoreDiv = document.getElementById('agentScores');
        if (scoreDiv) {
            let html = '';
            
            // Show CP-based scoring from the registry
            if (criticalPointSystem) {
                const cpScoring = criticalPointSystem.getScoring();
                const currentTime = Date.now();
                
                // Always show detailed debug info to track inconsistencies
                html += `<div style="color: white; font-weight: bold;">Critical Points Status (${new Date().toLocaleTimeString()}):</div>`;
                html += `<div style="color: #ccc;">Registry size: ${criticalPointSystem.cpRegistry.size}</div>`;
                html += `<div style="color: #ccc;">Total CPs: ${cpScoring.total}</div>`;
                html += `<div style="color: #ccc;">Neutral: ${cpScoring.neutral}</div>`;
                html += `<div style="color: #ccc;">Currently Claimed: ${cpScoring.activelyClaimed}</div>`;
                
                // Show detailed registry state
                if (criticalPointSystem.cpRegistry.size > 0) {
                    let owned = 0;
                    let claimed = 0;
                    for (const [cpId, cpData] of criticalPointSystem.cpRegistry) {
                        if (cpData.ownedBy !== null) owned++;
                        if (cpData.isActivelyClaimed) claimed++;
                    }
                    html += `<div style="color: yellow;">Direct count - Owned: ${owned}, Claimed: ${claimed}</div>`;
                }
                
                // Show breakdown by owner
                for (const [ownerColor, data] of Object.entries(cpScoring.byOwner)) {
                    html += `<div style="color: #${ownerColor};">Color ${ownerColor}: ${data.owned} owned, ${data.activelyClaimed} claimed</div>`;
                }
                
                // Show if inconsistency detected
                if (cpScoring.total !== criticalPointSystem.cpRegistry.size) {
                    html += `<div style="color: red;">⚠️ INCONSISTENCY: scoring.total(${cpScoring.total}) != registry.size(${criticalPointSystem.cpRegistry.size})</div>`;
                }
                
                html += '<br>';
            } else {
                html += `<div style="color: red;">⚠️ Critical Point System not initialized</div><br>`;
            }
            
            // Show agent scores from AgentManager
            if (agentManager) {
                const scores = agentManager.getScores();
                if (scores && scores.length > 0) {
                    html += `<div style="color: white; font-weight: bold;">Agent Scores:</div>`;
                    html += scores.map(s => 
                        `<div style="color: #${s.color.toString(16).padStart(6, '0')};">Agent ${s.agentId}: ${s.score} points</div>`
                    ).join('');
                } else {
                    html += '<div style="color: #ccc;">No agents found</div>';
                }
            }
            
            scoreDiv.innerHTML = html;
        }
    }
    
    // Reset the update flag
    isUpdatingScores = false;

    // Expose critical point system globally for agents/players
    window.globalCPSystem = criticalPointSystem;
    
    // Expose agentManager globally for DQN integration
    window.gameManager = agentManager;

    window.requestAnimationFrame(animate);
}


