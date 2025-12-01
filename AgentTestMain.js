import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";
import {OrbitControls} from "https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { Octree } from "https://unpkg.com/three@0.165.0/examples/jsm/math/Octree.js";
import Agent from "./Agent.js";
import AgentManager from "./AgentManager.js";

/**
 * Agent Test Main - Replicates Player.js but with free roam camera and agents
 * Uses the exact same map generation and critical point system as indexjake.html
 */

// Map generation settings
let useMapGenerator = true; // Use MapGenerator instead of pre-built terrain

// Set up renderer
let renderer = new T.WebGLRenderer({preserveDrawingBuffer:true});
renderer.setSize(1280, 720);
document.getElementById("div1").appendChild(renderer.domElement);
renderer.domElement.id = "canvas";

// Set up scene
let scene = new T.Scene();

// FREE ROAM CAMERA instead of player camera
let camera = new T.PerspectiveCamera(75, 1280 / 720, 0.1, 1000);
camera.position.set(15, 10, 15);
let controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

// Add lighting
scene.add(new T.AmbientLight("white"));

// Collision handling
const collisionWorld = new Octree();

// Initialize Critical Point System
const criticalPointSystem = new window.CriticalPointSystem(scene);
let criticalPointsEnabled = true;

// Initialize Agent Manager
const agentManager = new AgentManager(scene, collisionWorld, criticalPointSystem);

// Expose globals for DQN integration
window.globalCPSystem = criticalPointSystem;
window.gameManager = agentManager;

// Loading terrain
let levelObj = null;
let objectsInScene = [];

if (useMapGenerator) {
    // Import MapGenerator functions
    const { createFloor, createWalls, createBlock } = await import('./mapgenerator.js');
    
    // Always use the smallest level (10x10)
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
    
    // Store map layout information
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
    
    // Add collision detection for all generated objects
    levelObj.children.forEach(child => {
        if (child.isMesh) {
            child.updateWorldMatrix(true, false);
            collisionWorld.fromGraphNode(child);
            
            // Add critical points to walls and blocks (not floor)
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
    
}

scene.add(levelObj);

// Create multiple agents in corners (10x10 map goes from -5 to +5, stay inside walls at -4 to +4)
const agent1 = agentManager.createAgent(new T.Vector3(-4, 1, -4));  // Red agent - back left corner
const agent2 = agentManager.createAgent(new T.Vector3(4, 1, -4));   // Green agent - back right corner  
const agent3 = agentManager.createAgent(new T.Vector3(-4, 1, 4));   // Blue agent - front left corner

// Debug summary after level creation
console.log('=== LEVEL CREATION SUMMARY ===');
console.log(`AgentManager has ${agentManager.criticalPoints.length} critical points`);
console.log(`Critical Point System has ${criticalPointSystem.cpRegistry.size} CPs in registry`);
console.log(`Agents created: ${agentManager.agents.length}`);
console.log('===============================');

// Add pathfinding utilities
window.MapPathfinding = {
    isWalkable: function(x, z) {
        const layout = window.mapLayout;
        if (!layout) {
            console.log('MapPathfinding: mapLayout not available');
            return false;
        }
        
        const halfWidth = layout.width / 2;
        const halfDepth = layout.depth / 2;
        
        // Check map boundaries (leave some margin inside walls)
        if (x <= -halfWidth + 0.5 || x >= halfWidth - 0.5 || z <= -halfDepth + 0.5 || z >= halfDepth - 0.5) {
            return false;
        }
        
        // Check against maze blocks
        for (const block of layout.blocks) {
            const blockX = block.position.x;
            const blockZ = block.position.z;
            if (Math.abs(x - blockX) < 0.8 && Math.abs(z - blockZ) < 0.8) {
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


let previousTime = 0;

function animate(timestamp) {
    // Update delta time
    if (previousTime == 0) {
        previousTime = timestamp;
    }
    let delta = (timestamp - previousTime) / 1000;

    // Update free roam camera
    controls.update();
    
    // Update all agents and their line of sight
    agentManager.update();
    
    // Update critical points animation
    if (criticalPointSystem) {
        criticalPointSystem.updateCriticalPoints();
    }

    // Render scene
    renderer.render(scene, camera);
    
    // Update UI every frame for real-time feedback
    updateScoreDisplay();
    
    previousTime = timestamp;
    window.requestAnimationFrame(animate);
}

// Function to update score display - Plain text version
function updateScoreDisplay() {
    const scoreDiv = document.getElementById('agentScores');
    if (!scoreDiv) return;
    
    let text = '';
    
    // Show critical point info
    if (criticalPointSystem && criticalPointSystem.cpRegistry) {
        const cpScoring = criticalPointSystem.getScoring();
        
        text += `Critical Points:\n`;
        text += `Total: ${criticalPointSystem.cpRegistry.size}\n`;
        text += `Neutral: ${cpScoring.neutral}\n`;
        text += `Claimed: ${cpScoring.activelyClaimed}\n\n`;
        
        // Show owner breakdown
        if (Object.keys(cpScoring.byOwner).length > 0) {
            text += `Owned by agents:\n`;
            for (const [owner, data] of Object.entries(cpScoring.byOwner)) {
                const colorName = getColorName(owner);
                text += `  ${colorName}: ${data.owned} owned\n`;
            }
            text += `\n`;
        }
    } else {
        text += `Critical Points: Not initialized\n\n`;
    }
    
    // Show agent info
    if (agentManager && agentManager.agents) {
        text += `Agents (${agentManager.agents.length}):\n`;
        agentManager.agents.forEach((agent, i) => {
            try {
                const pos = agent.getPosition();
                const score = agent.getScore();
                const hexColor = agent.agentColor.toString(16);
                const colorName = getColorName(hexColor);
                text += `${colorName} Agent ${agent.agentId}: Score ${score}, Pos (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})\n`;
            } catch (e) {
                text += `Agent ${i}: Error getting data\n`;
            }
        });
    } else {
        text += `Agents: Not found\n`;
    }
    
    // Update display
    scoreDiv.innerHTML = text.replace(/\n/g, '<br>');
}

// Function to convert hex color codes to readable names
function getColorName(hexColor) {
    // Convert to string and pad with zeros to ensure 6 digits
    let cleanHex = hexColor.toString().replace('#', '').toLowerCase();
    cleanHex = cleanHex.padStart(6, '0'); // Ensure it's always 6 digits
    
    const colorMap = {
        'ff0000': 'Red',
        '00ff00': 'Green', 
        '0000ff': 'Blue',
        'ffff00': 'Yellow',
        'ff00ff': 'Magenta',
        '00ffff': 'Cyan',
        'ff8000': 'Orange',
        '8000ff': 'Purple',
        '80ff00': 'Lime',
        'ff0080': 'Pink'
    };
    
    return colorMap[cleanHex] || `Color ${cleanHex}`;
}

// Expose functions globally
window.updateScoreDisplay = updateScoreDisplay;
window.agentManager = agentManager;
window.criticalPointSystem = criticalPointSystem;

// Start animation loop
window.requestAnimationFrame(animate);




