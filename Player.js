
import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";
import {OrbitControls} from "https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import * as O from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/OBJLoader.js";
import * as P from "https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js";
import { Octree } from "https://unpkg.com/three@0.165.0/examples/jsm/math/Octree.js";
import { OctreeHelper } from "https://unpkg.com/three@0.165.0/examples/jsm/helpers/OctreeHelper.js";
import { Capsule } from "https://unpkg.com/three@0.165.0/examples/jsm/math/Capsule.js";
import Agent from "./Agent.js";
import AgentManager from "./AgentManager.js";

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
     */
    constructor(isFirstPerson, renderer, collisionWorld) {

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

        this.laserFire = false;
        this.laser = this.initLaser();
        this.gunTip.add(this.laser);
        this.laser.position.set(0,0,0);
        this.controls = null;
        if(isFirstPerson == 0)
            this.controls = new P.PointerLockControls(this.camera, renderer.domElement);
    
        // might need some other variables for colors and shooting

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
        const laserMat = new T.MeshStandardMaterial({color: "rgb(255, 255, 255)"});
        const laserMesh = new T.Mesh(laserGeo, laserMat);
        laserMesh.visible = false;
        return laserMesh;
    }

    updateLaser(objectsInScene) {

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
            endPoint = startPoint.clone().add(direction.clone().multiplyScalar(100));
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
    }

    /**
     * updates position of the player, needs to be called in animate()
     */
    update(objectsInScene) {

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
            this.updateLaser(objectsInScene);
        }
        else
            this.laser.visible = false;

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
     */
}

// global variables
const PLAYER_HEIGHT = 0.5;
const PLAYER_RADIUS = 0.5 * Math.sqrt(2) / 2;
const PLAYER_SPEED = 0.02;
const PLAYER_JUMP_HEIGHT = 1.2;
const PLAYER_JUMP_SPEED = 0.03;
const WORLD_BOUNDARY = 20;
const GRAVITY = (PLAYER_JUMP_SPEED * PLAYER_JUMP_SPEED) / (2 * PLAYER_JUMP_HEIGHT);

let startGame = false;

// to switch between different levels
let level1 = false;
let level2 = true;
let useMapGenerator = true; // Toggle to use MapGenerator instead of pre-built terrain

// set up renderer
let renderer = new T.WebGLRenderer({preserveDrawingBuffer:true});
renderer.setSize(1280, 720);
document.getElementById("div1").appendChild(renderer.domElement);
renderer.domElement.id = "canvas";

// set up scene
let scene = new T.Scene();

// // perspective camera for debugging
// let perspCam = new T.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// perspCam.position.set(20, 5, 0);
// let controls = new OrbitControls(perspCam, renderer.domElement);
// controls.target.set(0, 5, 0);
// controls.update();

// let ocontrols = new OrbitControls(player2.camera, renderer.domElement);
// ocontrols.target.set(0, 5, 0);
// ocontrols.update();

// add an ambient light
scene.add(new T.AmbientLight("white"));

// simple start menu
const menuOverlay = document.getElementById("menuOverlay");

// handling collision
const collisionWorld = new Octree();

// Initialize Critical Point System
const criticalPointSystem = new window.CriticalPointSystem(scene);
let criticalPointsEnabled = true; // Toggle for critical points

// Initialize Agent Manager
const agentManager = new AgentManager(scene, collisionWorld);

// loading terrain
let levelObj = null;

if (useMapGenerator) {
    // Import MapGenerator functions
    const { createFloor, createWalls, createBlock } = await import('./mapgenerator.js');
    
    // Determine map size based on selected level
    let mapWidth, mapDepth;
    if (level1) {
        mapWidth = 14;
        mapDepth = 14;
    } else if (level2) {
        mapWidth = 18;
        mapDepth = 18;
    } else {
        // Default level (level 0)
        mapWidth = 10;
        mapDepth = 10;
    }
    
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
    
    // Add collision detection for all generated objects
    levelObj.children.forEach(child => {
        if (child.isMesh) {
            child.updateWorldMatrix(true, false);
            collisionWorld.fromGraphNode(child);
            
            // Add critical points to terrain meshes
            if (criticalPointsEnabled) {
                const CP_COLORS = window.CP_COLORS;
                const criticalPoints = criticalPointSystem.addCriticalPoints(child, 3, CP_COLORS.WHITE);
                
                // Register critical points with agent manager
                criticalPoints.forEach(cp => {
                    agentManager.addCriticalPoint(cp.position, cp);
                });
            }
            
            // Add terrain as obstacles for line of sight
            agentManager.addObstacles([child]);
        }
    });
    
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

scene.add(levelObj);

// create playable player and put in scene
let player1 = new Player(0, renderer, collisionWorld);
scene.add(player1.object);

// Create multiple agents using the agent manager
const agent1 = agentManager.createAgent(new T.Vector3(5, 1, 5));   // Red agent
const agent2 = agentManager.createAgent(new T.Vector3(-5, 1, -5)); // Green agent
const agent3 = agentManager.createAgent(new T.Vector3(8, 1, -3));  // Blue agent

// Agents should remain stationary - no targets set
// agent1.setTarget(new T.Vector3(-2, 1, 3));
// agent2.setTarget(new T.Vector3(3, 1, -2));
// agent3.setTarget(new T.Vector3(-6, 1, 4));

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

// WASD controls: keydwon
document.addEventListener('keydown', function (event) {
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
            // case ' ':
            //     if(player1.movement.spaceHold)
            //         break;
            //     player1.movement.space = true;
            //     player1.movement.spaceHold = true;
            //     player1.speedY = PLAYER_JUMP_SPEED;
            //     break;
        }        
    }

});
// WASD controls: keyup
document.addEventListener('keyup', function (event) {
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
            // case ' ':
            //     player1.movement.space = false;
            //     break;
        }
    }

});

// playe mesh rotates with first person perspective
document.addEventListener('mousemove', function (event) {
    if(startGame) {
        let camDir = new T.Vector3();
        player1.camera.getWorldDirection(camDir);
        camDir.y = 0; 
        camDir.normalize();
        player1.mesh.rotation.y = Math.atan2(camDir.x, camDir.z);
    }

});

// enable and disable PoiniterLockControls
document.body.addEventListener('click', () => {
    menuOverlay.style.display = "none";
    player1.controls.lock();
    startGame = true;

});
player1.controls.addEventListener('unlock', () => {
    menuOverlay.style.display = 'block';
    startGame = false;
});

// laser firing controls
document.addEventListener('mousedown', (event) => {
    if(event.button === 0) {
        player1.laserFire = true;
    }
});

document.addEventListener('mouseup', (event) => {
    if(event.button === 0) {
        player1.laserFire = false;
        player1.laser.visible = false;
    }
});

// // some helpers, leaving in for now so I don't have to type it again
// const helper = new OctreeHelper( collisionWorld );
// scene.add( helper );

// const cameraHelper = new T.CameraHelper(player1.camera);
// scene.add(cameraHelper);

let previousTime = 0;

function animate(timestamp) {

    // putting this here for now, just in case
    if(previousTime == 0)
        previousTime = timestamp;
    let delta = (timestamp - previousTime) / 1000;

    player1.update(levelObj);
    
    // Update all agents and their line of sight
    agentManager.update();
    
    // Update critical points animation
    if (criticalPointSystem) {
        criticalPointSystem.updateCriticalPoints();
    }

    renderer.render(scene, player1.camera);
    previousTime = timestamp;
    // Update scores display more frequently
    if (Math.floor(timestamp / 500) !== Math.floor(previousTime / 500)) {
        updateScoreDisplay();
    }

    window.requestAnimationFrame(animate);
}

// Add keyboard controls for debugging
document.addEventListener('keydown', function(event) {
    if (event.key === 'p' || event.key === 'P') {
        // Print current scores
        const scores = agentManager.getScores();
        console.log('Current Scores:');
        scores.forEach(s => {
            console.log(`Agent ${s.agentId} (Color: #${s.color.toString(16)}): ${s.score} points`);
        });
    }
    if (event.key === 'l' || event.key === 'L') {
        // Toggle LOS UI visibility
        const losUI = document.getElementById('losUI');
        if (losUI) {
            losUI.style.display = losUI.style.display === 'none' ? 'block' : 'none';
        }
    }
});

// Function to update score display
function updateScoreDisplay() {
    const scoreDiv = document.getElementById('agentScores');
    if (scoreDiv && agentManager) {
        const scores = agentManager.getScores();
        if (scores && scores.length > 0) {
            scoreDiv.innerHTML = scores.map(s => 
                `<div style="color: #${s.color.toString(16).padStart(6, '0')};">Agent ${s.agentId}: ${s.score} points</div>`
            ).join('');
        } else {
            scoreDiv.innerHTML = '<div>No agents found</div>';
        }
    }
}

// Show LOS UI when game starts
document.body.addEventListener('click', () => {
    setTimeout(() => {
        const losUI = document.getElementById('losUI');
        if (losUI) {
            losUI.style.display = 'block';
        }
    }, 1000);
});

window.requestAnimationFrame(animate);
