import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";

export function setMapTexture(mode, mapBlocks, walls, wallsWidth1, wallsWidth2, floor) {
    let mapTextureFiles = pickMapMode(mode);

    const loader = new T.TextureLoader();
    let texture;
    
    for(const block of mapBlocks) {
        if(block.isMesh) {
            applyUV(block.geometry);
            let index = Math.floor(Math.random() * (mapTextureFiles.length-3)) + 3;
            texture = loader.load(mapTextureFiles[index]);
            block.material.color.setRGB(1, 1, 1);
            block.material.map = texture;
        }
    }

    let wall_count = 0;
    for(const wall of walls) {
        if(wall.isMesh) {
            texture = loader.load(mapTextureFiles[2]);
            texture.wrapS = T.RepeatWrapping;
            texture.wrapT = T.RepeatWrapping;
            if(wall_count < 2)
                texture.repeat.set(wallsWidth1/2, 1);
            else
                texture.repeat.set(wallsWidth2/2, 1);
            wall.material.color.setRGB(1, 1, 1);
            wall.material.map = texture;         
        }

    }

    if(floor.isMesh) {
        texture = loader.load(mapTextureFiles[1]);
        floor.material.color.setRGB(1, 1, 1);
        floor.material.map = texture;
    }
}

export function applyUV(geo) {
    const uv = geo.attributes.uv;
    const uvArray = uv.array;

    const faces = [
        [0.5, 0.25, 0.75, 0.75],   // right
        [0, 0.25, 0.25, 0.75],     // left
        [0.25, 0.75, 0.5, 1],      // top
        [0.5, 0, 0.75, 0.25],      // bottom
        [0.25, 0.25, 0.5, 0.75],   // front
        [0.75, 0.25, 1, 0.75]      // back
    ];

    // Each face = 4 UV coordinates
    for (let i = 0; i < 6; i++) {
        const [u0, v0, u1, v1] = faces[i];

        const offset = i * 8;

        // Triangle 1
        uvArray[offset + 0] = u0; uvArray[offset + 1] = v1;
        uvArray[offset + 2] = u1; uvArray[offset + 3] = v1;
        uvArray[offset + 4] = u0; uvArray[offset + 5] = v0;

        // Triangle 2
        uvArray[offset + 6] = u1; uvArray[offset + 7] = v0;
    }

    uv.needsUpdate = true;
}

export function setSkyTexture(mode, scene) {
    let mapTextureFiles = pickMapMode(mode);
    
    let cubeTexture = new T.CubeTextureLoader().load([mapTextureFiles[0][0], 
                                                    mapTextureFiles[0][1], 
                                                    mapTextureFiles[0][2], 
                                                    mapTextureFiles[0][3],
                                                    mapTextureFiles[0][4],
                                                    mapTextureFiles[0][5]]);
    scene.background = cubeTexture;
}

export function pickMapMode(mode) {
    switch(mode) {
        case 1:
            return LAB_TEX;
        default:
            return LAB_TEX;
    }
}


export const MAP_MODES = {

}

export const LAB_TEX = [
    [
        'Textures/Lab/lab_sky_px.png',
        'Textures/Lab/lab_sky_nx.png',
        'Textures/Lab/lab_sky_py.png',
        'Textures/Lab/lab_sky_ny.png',
        'Textures/Lab/lab_sky_pz.png',
        'Textures/Lab/lab_sky_nz.png',
    ],
    'Textures/Lab/lab_floor.png',
    'Textures/Lab/lab_walls_0.png',
    'Textures/Lab/lab_walls_1.png',
    'Textures/Lab/lab_walls_2.png',
    'Textures/Lab/lab_walls_1.png',
    'Textures/Lab/lab_walls_3.png',
    'Textures/Lab/lab_walls_1.png',
    'Textures/Lab/lab_walls_4.png',
    'Textures/Lab/lab_walls_1.png',
    'Textures/Lab/lab_walls_5.png',
    'Textures/Lab/lab_walls_6.png',
    'Textures/Lab/lab_walls_7.png',
]

/**
 * 1. Lab (portal, half life): 
 *    white walls, grey floors, vents, signs
 *    sky: ceiling of portal, glados
 * 2. ancient temple (indiana jones):
 *    yellow stone walls and floor, torches, statues
 *    sky: dark, yellow stone
 * 3. hedge maze:
 *    hedges as walls
 *    sky: normal blue sky
 * 4. show me what you got:
 *    colorful walls and floor
 *    sky: rick and morty show me what you got aliens
 * 5. transparent walls:
 *    transparent, not smooth
 *    sky: normal sky
 * 6. library:
 *    bookcases as walls, wooden floors
 *    sky: library staircase?
 * 7. attack on titan:
 *    street view
 *    sky: titan
 * 8. horror:
 *    all eyes
 *    sky: eyes
 * 9. infinity castle:
 *    infinity castle walls
 *    sky: the infinity part
 */