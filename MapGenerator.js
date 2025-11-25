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
    const wallThickness = 0.3; // 围墙厚度（增加到0.3，之前是0.1太细了）
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666, // 深灰色
        roughness: 0.7,
        metalness: 0.1
    });
    
    // 计算围墙位置（地图边界）
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    
    // 创建四面墙
    // 前墙（z = -halfDepth）
    const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, wallThickness),
        wallMaterial
    );
    frontWall.position.set(0, height / 2, -halfDepth);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    scene.add(frontWall);
    walls.push(frontWall);
    
    // 后墙（z = halfDepth）
    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, wallThickness),
        wallMaterial
    );
    backWall.position.set(0, height / 2, halfDepth);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    scene.add(backWall);
    walls.push(backWall);
    
    // 左墙（x = -halfWidth）
    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, height, depth),
        wallMaterial
    );
    leftWall.position.set(-halfWidth, height / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    scene.add(leftWall);
    walls.push(leftWall);
    
    // 右墙（x = halfWidth）
    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, height, depth),
        wallMaterial
    );
    rightWall.position.set(halfWidth, height / 2, 0);
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
    // 地图坐标系统：地图中心在(0, 0, 0)，模型会被居中到原点
    // x 和 z 是网格坐标（从1开始，因为0是围墙）
    // 由于模型会被居中，我们需要将网格坐标转换为相对于模型中心的坐标
    // 假设地图是 mapWidth x mapDepth，中心在 (0,0,0)
    // 网格坐标 (1,1) 在世界坐标中是 (-mapWidth/2 + 0.5, -mapDepth/2 + 0.5)
    // 但由于模型会被居中，这些坐标会相对于模型中心
    // 为了简化，我们假设传入的 x 和 z 已经是相对于模型中心的世界坐标
    // 实际上，由于模型会通过偏移来居中，我们直接使用传入的坐标即可
    // 方块应该在 y=height/2 的位置（底部在地面上）
    block.position.set(x - 0.5, height / 2, z - 0.5);
    
    // 投射和接收阴影
    block.castShadow = true;
    block.receiveShadow = true;
    
    // 添加到场景
    scene.add(block);
    
    return block;
}

