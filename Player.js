// 优先使用全局的 THREE（如果已存在），避免重复导入
// 如果 window.THREE 存在，就使用它；否则导入
let T, OrbitControls, O, P, Octree, OctreeHelper, Capsule, Agent;

// 在模块顶层，我们需要使用同步导入
// 但如果 window.THREE 存在，我们优先使用它
if (typeof window !== 'undefined' && window.THREE) {
    // 使用全局 THREE（从 HTML 文件导入）
    T = window.THREE;
} else {
    // 如果没有全局 THREE，则导入（为 indexjake.html 等文件）
    // 注意：这会触发 "Multiple instances" 警告，但为了兼容性需要保留
    const threeModule = await import("https://unpkg.com/three@0.161.0/build/three.module.js");
    T = threeModule.default || threeModule;
    if (typeof window !== 'undefined') {
        window.THREE = T;
    }
}

// 导入其他依赖
const controlsModule = await import("https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js");
OrbitControls = controlsModule.OrbitControls;

O = await import("https://unpkg.com/three@0.161.0/examples/jsm/loaders/OBJLoader.js");

P = await import("https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js");

const octreeModule = await import("https://unpkg.com/three@0.165.0/examples/jsm/math/Octree.js");
Octree = octreeModule.Octree;

const helperModule = await import("https://unpkg.com/three@0.165.0/examples/jsm/helpers/OctreeHelper.js");
OctreeHelper = helperModule.OctreeHelper;

const capsuleModule = await import("https://unpkg.com/three@0.165.0/examples/jsm/math/Capsule.js");
Capsule = capsuleModule.Capsule;

const agentModule = await import("./Agent.js");
Agent = agentModule.default;
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
        console.log("collider start: " + this.collider.start.x + " " + this.collider.start.y + " " + this.collider.start.z);
        console.log("radius: " + PLAYER_RADIUS);
        this.object.add(this.mesh);
        this.object.add(this.camera);
        this.onGround = false;
        this.worldCollide = collisionWorld;

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

    /**
     * updates position of the player, needs to be called in animate()
     */
    update() {
        // console.log("update");
        console.log("collider start: " + this.collider.start.x + " " + this.collider.start.y + " " + this.collider.start.z);
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


        // // update jump
        if(this.movement.spaceHold || !this.onGround) {

            this.collider.start.y += this.speedY;
            this.collider.end.y += this.speedY;
            const center = this.collider.start.clone().add(this.collider.end).multiplyScalar(0.5);
            const halfHeight = PLAYER_HEIGHT / 2;
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
     * might need some other functions for colors and shooting
     */
}

// Export Player class to global scope so it can be used by LevelSelection3D
// 立即导出，不等待模块加载完成
if (typeof window !== 'undefined') {
    window.Player = Player;
    console.log('Player class exported to window.Player');
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

// 模块级代码：只在特定条件下执行（为 indexjake.html 等文件设计）
// 检查是否有 div1 元素，如果没有则跳过这些初始化代码
const div1 = document.getElementById("div1");
if (div1) {
    // set up renderer
    let renderer = new T.WebGLRenderer({preserveDrawingBuffer:true});
    renderer.setSize(1280, 720);
    div1.appendChild(renderer.domElement);
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

    // loading terrain
    const levelLoader = new O.OBJLoader();
    let levelObj = null;
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
    scene.add(levelObj);

    // create playable player and put in scene
    let player1 = new Player(0, renderer, collisionWorld);
    scene.add(player1.object);

    // create an agent (NPC) and put in scene
    let agent1 = new Agent(renderer, collisionWorld);
    agent1.setPosition(new T.Vector3(5, 1, 5)); // Start at position (5, 1, 5)
    scene.add(agent1.object);

    // Agent stays still - no target set

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
            case ' ':
                if(player1.movement.spaceHold)
                    break;
                player1.movement.space = true;
                player1.movement.spaceHold = true;
                player1.speedY = PLAYER_JUMP_SPEED;
                break;
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
            case ' ':
                player1.movement.space = false;
                break;
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

        player1.update();
        agent1.update(); // Update the agent
        
        // Update critical points animation
        if (criticalPointSystem) {
            criticalPointSystem.updateCriticalPoints();
        }

        renderer.render(scene, player1.camera);
        previousTime = timestamp;
        window.requestAnimationFrame(animate);
    }
    window.requestAnimationFrame(animate);
} // 结束 if (div1) 块
