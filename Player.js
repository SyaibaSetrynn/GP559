import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";
import {OrbitControls} from "https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import * as O from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/OBJLoader.js";
import * as P from "https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js";
// import { Octree } from './three.js-dev/examples/jsm/math/Octree.js';
// import { OctreeHelper } from './three.js-dev/examples/jsm/helpers/OctreeHelper.js';
// import { Capsule } from './three.js-dev/examples/jsm/math/Capsule.js';

/**
 * Some references: https://www.youtube.com/watch?v=oqKzxPMLWxo
 *                  https://sbcode.net/threejs/pointerlock-controls/
 */

/**
 * Class for a player in the game
 */
class Player {
    /**
     * @param {number} isFirstPerson 0 if is first person player, 1 if npc (the difference is only in PointerLockControls)
     * @param {*} renderer 
     */
    constructor(isFirstPerson, renderer) {
        this.movement = {w: false, a: false, s: false, d: false, space: false, spaceHold: false};
        this.speedY = 0;
        this.mesh = this.createObject();
        this.object = new T.Group();
        this.object.position.set(0, -PLAYER_HEIGHT, PLAYER_HEIGHT/2);
        this.camera = new T.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.add(this.mesh);
        this.object.add(this.camera);
        this.controls = null;
        if(isFirstPerson == 0)
            this.controls = new P.PointerLockControls(this.camera, renderer.domElement);
    }

    /**
     * Creates the mesh for the player
     * @returns a three js group that contains the mesh
     */
    createObject() {
        let characterGrp = new T.Group();
        const dummyGeo = new T.BoxGeometry(PLAYER_HEIGHT, PLAYER_HEIGHT, PLAYER_HEIGHT);
        const dummyMat = new T.MeshStandardMaterial({color: "rgb(255, 123, 123)"});
        const dummyMesh = new T.Mesh(dummyGeo, dummyMat);
        characterGrp.position.set(0, -PLAYER_HEIGHT, PLAYER_HEIGHT/2);
        dummyMesh.position.set(0, PLAYER_HEIGHT/2, 0);
        characterGrp.add(dummyMesh);
        return characterGrp;
    }
    /**
     * updates position of the player, needs to be called in animate()
     */
    update() {
            // update player position
        if(this.movement.w)
            this.controls.moveForward(PLAYER_SPEED);
        if(this.movement.a)
            this.controls.moveRight(-PLAYER_SPEED);
        if(this.movement.s)
            this.controls.moveForward(-PLAYER_SPEED);
        if(this.movement.d)
            this.controls.moveRight(PLAYER_SPEED);

        // update jump
        if(this.movement.spaceHold) {
            this.speedY -= GRAVITY;
            this.object.position.y += this.speedY;
            if(this.object.position.y <= PLAYER_HEIGHT/**player1.charHeight/2*/) {
                this.object.position.y = PLAYER_HEIGHT;
                this.movement.spaceHold = false;
            }
        }
    }
}

// global variables
const PLAYER_HEIGHT = 0.5;
const PLAYER_SPEED = 0.02;
const PLAYER_JUMP_HEIGHT = 1.2;
const PLAYER_JUMP_SPEED = 0.03;
const WORLD_BOUNDARY = 20;
const GRAVITY = (PLAYER_JUMP_SPEED * PLAYER_JUMP_SPEED) / (2 * PLAYER_JUMP_HEIGHT);

// set up renderer
let renderer = new T.WebGLRenderer({preserveDrawingBuffer:true});
renderer.setSize(1280, 720);
document.getElementById("div1").appendChild(renderer.domElement);
renderer.domElement.id = "canvas";

// set up scene
let scene = new T.Scene();

// perspective camera for debugging
let perspCam = new T.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
perspCam.position.set(20, 5, 0);
let controls = new OrbitControls(perspCam, renderer.domElement);
controls.target.set(0, 5, 0);
controls.update();

// let ocontrols = new OrbitControls(player2.camera, renderer.domElement);
// ocontrols.target.set(0, 5, 0);
// ocontrols.update();

// add an ambient light
scene.add(new T.AmbientLight("white"));

// simple start menu
const menuOverlay = document.getElementById("menuOverlay");

// ground
// const groundGeo = new T.BoxGeometry(20, 0.05, 20);
// const groundMat = new T.MeshStandardMaterial({color: "rgb(158, 158, 158)"});
// const groundMesh = new T.Mesh(groundGeo, groundMat);
// groundMesh.position.set(0, -0.025, 0);
// scene.add(groundMesh);

// loading Terrain1
const loader = new O.OBJLoader();
const object = await loader.loadAsync( './Objects/Terrain1.obj' );
scene.add( object );
object.traverse(child => {
    if (child.isMesh) {
        child.material = new T.MeshStandardMaterial({
            color: new T.Color(Math.random(), Math.random(), Math.random())
        });
    }
});

// WASD controls: keydwon
document.addEventListener('keydown', function (event) {
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
});
// WASD controls: keyup
document.addEventListener('keyup', function (event) {
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
});

// enable and disable PoiniterLockControls
document.body.addEventListener('click', () => {
    menuOverlay.style.display = "none";
    player1.controls.lock();
});
controls.addEventListener('unlock', () => {
    menuOverlay.style.display = 'block';
});

// create playable player and put in scene
let player1 = new Player(0, renderer);
player1.object.position.set(0, PLAYER_HEIGHT, 0);
scene.add(player1.object);

let previousTime = 0;

function animate(timestamp) {

    // putting this here for now, just in case
    if(previousTime == 0)
        previousTime = timestamp;
    let delta = (timestamp - previousTime) / 1000;

    player1.update();

    renderer.render(scene, player1.camera);
    previousTime = timestamp;
    window.requestAnimationFrame(animate);
}
window.requestAnimationFrame(animate);


