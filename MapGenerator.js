// MapGenerator.js - 地图生成器，用于创建地板和围墙

/**
 * 创建地板
 * @param {THREE.Scene} scene - Three.js 场景
 * @param {number} width - 地板宽度
 * @param {number} depth - 地板深度
 * @param {number} thickness - 地板厚度
 * @returns {THREE.Mesh} 地板网格对象
 */
export function createFloor(scene, width, depth, thickness) {
    const THREE = window.THREE;
    if (!THREE) {
        throw new Error('THREE is not defined');
    }
    
    // 创建地板几何体（PlaneGeometry，然后旋转和缩放）
    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    
    // 旋转90度使其水平（PlaneGeometry默认是垂直的）
    floorGeometry.rotateX(-Math.PI / 2);
    
    // 创建材质
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x808080, // 灰色
        roughness: 0.8,
        metalness: 0.2
    });
    
    // 创建网格
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    
    // 设置位置：地板上表面在 y=0
    // 由于地板厚度为 thickness，中心应该在 y = -thickness/2
    floor.position.set(0, -thickness / 2+0.15, 0);
    
    // 接收阴影
    floor.receiveShadow = true;
    
    // 添加到场景
    scene.add(floor);
    
    return floor;
}

/**
 * 创建围墙
 * @param {THREE.Scene} scene - Three.js 场景
 * @param {number} width - 地图宽度
 * @param {number} depth - 地图深度
 * @param {number} height - 围墙高度
 * @returns {Array<THREE.Mesh>} 围墙网格对象数组
 */
export function createWalls(scene, width, depth, height) {
    const THREE = window.THREE;
    if (!THREE) {
        throw new Error('THREE is not defined');
    }
    
    const walls = [];
    const wallThickness = 1; // 围墙厚度
    console.log(`MapGenerator: Creating walls with thickness = ${wallThickness}`);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666, // 深灰色
        roughness: 0.7,
        metalness: 0.1
    });
    
    // 计算围墙位置（地图边界）
    // 为了确保墙围住的内部空间正好是 width x depth，墙应该放置在边界外侧
    // 墙的内边缘应该正好在边界上，这样墙的厚度不会侵占内部空间
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const halfWallThickness = wallThickness / 2;
    
    // 创建四面墙
    // 前墙：内边缘在 z = -halfDepth，所以中心在 z = -halfDepth - halfWallThickness（向外偏移）
    const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(width + wallThickness * 2, height, wallThickness),
        wallMaterial
    );
    frontWall.position.set(0, height / 2, -halfDepth - halfWallThickness);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    scene.add(frontWall);
    walls.push(frontWall);
    
    // 后墙：内边缘在 z = halfDepth，所以中心在 z = halfDepth + halfWallThickness（向外偏移）
    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(width + wallThickness * 2, height, wallThickness),
        wallMaterial
    );
    backWall.position.set(0, height / 2, halfDepth + halfWallThickness);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    scene.add(backWall);
    walls.push(backWall);
    
    // 左墙：内边缘在 x = -halfWidth，所以中心在 x = -halfWidth - halfWallThickness（向外偏移）
    // 深度需要扩展到 depth + wallThickness * 2 以覆盖前后墙的厚度
    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, height, depth + wallThickness * 2),
        wallMaterial
    );
    console.log(`MapGenerator: Left wall geometry: width=${wallThickness}, height=${height}, depth=${depth + wallThickness * 2}`);
    leftWall.position.set(-halfWidth - halfWallThickness, height / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    scene.add(leftWall);
    walls.push(leftWall);
    
    // 右墙：内边缘在 x = halfWidth，所以中心在 x = halfWidth + halfWallThickness（向外偏移）
    // 深度需要扩展到 depth + wallThickness * 2 以覆盖前后墙的厚度
    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, height, depth + wallThickness * 2),
        wallMaterial
    );
    console.log(`MapGenerator: Right wall geometry: width=${wallThickness}, height=${height}, depth=${depth + wallThickness * 2}`);
    rightWall.position.set(halfWidth + halfWallThickness, height / 2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    scene.add(rightWall);
    walls.push(rightWall);
    
    return walls;
}

/**
 * 创建迷宫障碍物方块
 * @param {THREE.Scene} scene - Three.js 场景
 * @param {number} x - X坐标（网格位置）
 * @param {number} z - Z坐标（网格位置）
 * @param {number} height - 方块高度
 * @returns {THREE.Mesh} 方块网格对象
 */
export function createBlock(scene, x, z, height) {
    const THREE = window.THREE;
    if (!THREE) {
        throw new Error('THREE is not defined');
    }
    
    // 方块大小为 1x1xheight
    const blockSize = 1;
    const blockGeometry = new THREE.BoxGeometry(blockSize, height, blockSize);
    
    // 创建材质
    const blockMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555, // 深灰色
        roughness: 0.7,
        metalness: 0.1
    });
    
    // 创建网格
    const block = new THREE.Mesh(blockGeometry, blockMaterial);
    
    // 设置位置
    // 地图坐标系统：地图中心在(0, 0, 0)
    // 传入的 x 和 z 参数已经是方块中心的世界坐标
    // 方块应该在 y=height/2 的位置（底部在地面上）
    block.position.set(x, height / 2, z);
    
    // 投射和接收阴影
    block.castShadow = true;
    block.receiveShadow = true;
    
    // 添加到场景
    scene.add(block);
    
    return block;
}

