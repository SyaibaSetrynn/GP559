import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";

export function setMapTexture(mode, mapBlocks, walls, wallsWidth1, wallsWidth2, floor) {
    let mapTextureFiles = pickMapMode(mode);

    if(mode == 3) {
        setGlass(mapBlocks, walls, wallsWidth1, wallsWidth2, floor);
        return;
    }

    const loader = new T.TextureLoader();
    let texture;
    
    for(const block of mapBlocks) {
        if(block.isMesh) {

            // let bmap = loader.load("Textures/Lab/Lab_walls_1_bump.png");
            // block.material.bumpMap = bmap;
            // block.material.needsUpdate = true;
            // block.material.bumpScale = 5;
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
        case 2:
            return HEDGE_TEX;
        case 3:
            return GLASS_TEX;
        case 4:
            return EYES_TEX;
        case 5:
            return LIBRARY_TEX;
        default:
            return LAB_TEX;
    }
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
    'Textures/Lab/lab_walls_5.png',
    'Textures/Lab/lab_walls_6.png',
    'Textures/Lab/lab_walls_7.png',
]

export const HEDGE_TEX = [
    [
        'Textures/Hedge/hedge_sky_px.png',
        'Textures/Hedge/hedge_sky_nx.png',
        'Textures/Hedge/hedge_sky_py.png',
        'Textures/Hedge/hedge_sky_ny.png',
        'Textures/Hedge/hedge_sky_pz.png',
        'Textures/Hedge/hedge_sky_nz.png',
    ],
    'Textures/Hedge/hedge_floor.png',
    'Textures/Hedge/hedge_walls_0.png',
    'Textures/Hedge/hedge_walls_1.png',
    'Textures/Hedge/hedge_walls_2.png',
    'Textures/Hedge/hedge_walls_1.png',
    'Textures/Hedge/hedge_walls_1.png',
]

const GLASS_TEX = [
    [
        'Textures/Glass/glass_sky_px.png',
        'Textures/Glass/glass_sky_nx.png',
        'Textures/Glass/glass_sky_py.png',
        'Textures/Glass/glass_sky_ny.png',
        'Textures/Glass/glass_sky_pz.png',
        'Textures/Glass/glass_sky_nz.png',
    ],
    'Textures/Glass/glass_normal_map.png',
    'Textures/Glass/glass_normal_map_blocks.png'
];

export const EYES_TEX = [
    [
        'Textures/Eyes/eyes_sky_px.png',
        'Textures/Eyes/eyes_sky_nx.png',
        'Textures/Eyes/eyes_sky_py.png',
        'Textures/Eyes/eyes_sky_ny.png',
        'Textures/Eyes/eyes_sky_pz.png',
        'Textures/Eyes/eyes_sky_nz.png',
    ],
    'Textures/Eyes/eyes_floor.png',
    'Textures/Eyes/eyes_walls_0.png',
    'Textures/Eyes/eyes_walls_1.png',
    'Textures/Eyes/eyes_walls_2.png',
]

export const LIBRARY_TEX = [
    [
        'Textures/Library/library_sky_px.png',
        'Textures/Library/library_sky_nx.png',
        'Textures/Library/library_sky_py.png',
        'Textures/Library/library_sky_ny.png',
        'Textures/Library/library_sky_pz.png',
        'Textures/Library/library_sky_nz.png',
    ],
    'Textures/Library/library_floor.png',
    'Textures/Library/library_walls_0.png',
    'Textures/Library/library_walls_1.png',
]

function setGlass(mapBlocks, walls, wallsWidth1, wallsWidth2, floor) {

    const glassMaterial = new T.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.5,
        roughness: 0.1,
        transmission: 1.0,
        thickness: 0.5,
        ior: 1.7,
        transparent: true,
        opacity: 1,
    });
    glassMaterial.side = T.DoubleSide;
    const envMap = new T.CubeTextureLoader().load([GLASS_TEX[0][0], GLASS_TEX[0][1], GLASS_TEX[0][2], GLASS_TEX[0][3], GLASS_TEX[0][4], GLASS_TEX[0][5]]);
    glassMaterial.envMap = envMap;

    const textureLoader = new T.TextureLoader();
    let normalMap = textureLoader.load(GLASS_TEX[2]);
    glassMaterial.normalMap = normalMap;

    for(const block of mapBlocks) {
        if(block.isMesh) {
            applyUV(block.geometry);
            block.material = glassMaterial.clone();
        }
    }
    
    normalMap = textureLoader.load(GLASS_TEX[1]);
    if(floor.isMesh) {
        floor.material = glassMaterial.clone();
    }
    
    let wall_count = 0;
    for(const wall of walls) {
        if(wall.isMesh) {

            normalMap.wrapS = T.RepeatWrapping;
            normalMap.wrapT = T.RepeatWrapping;

            if(wall_count < 2)
                normalMap.repeat.set(wallsWidth1/2, 1);
            else
                normalMap.repeat.set(wallsWidth2/2, 1);

            glassMaterial.normalMap = normalMap;
            glassMaterial.normalScale.set(0.2, 0.2);  // adjust strength
            wall.material = glassMaterial;
 
        }
    }
}
/**
 * modes:
 * 1. Lab (portal, half life): 
 *    white walls, grey floors, vents, signs
 *    sky: ceiling of portal, glados
 * 2. hedge maze:
 *    hedges as walls
 *    sky: normal blue sky
 * 3. transparent walls:
 *    transparent, not smooth
 *    sky: normal sky
 * 8. horror:
 *    all eyes
 *    sky: eyes
 * 
 * 4. show me what you got:
 *    colorful walls and floor
 *    sky: rick and morty show me what you got aliens
 * 5. ancient temple (indiana jones):
 *    yellow stone walls and floor, torches, statues
 *    sky: dark, yellow stone
 * 6. library:
 *    bookcases as walls, wooden floors
 *    sky: library staircase?
 * 7. attack on titan:
 *    street view
 *    sky: titan
 * 9. infinity castle:
 *    infinity castle walls
 *    sky: the infinity part
 */