// LevelContent3D.js - 关卡内部构建和管理

class LevelContent3D {
    constructor(scene, camera, renderer, controls) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;
        
        // 玩家相关
        this.player = null;
        this.playerVisualization = null;
        this.playerKeydownHandler = null;
        this.playerKeyupHandler = null;
        this.pointerLockClickHandler = null;
        this.pointerLockUnlockHandler = null;
        this.playerMovementLocked = false;
        this.floorSurfaceY = null;
        this.playerInitialPosition = null;
        
        // 碰撞检测
        this.collisionWorld = null;
        
        // 相机动画
        this.cameraAnimationState = null;
        
        // 关卡灯
        this.levelLight = null;
        this.levelLightTarget = null;
        
        // 迷宫相关
        this.mazeBlocks = {}; // 每个level的迷宫障碍物 { level: [blocks...] }
        this.emptyPositions = {}; // 每个level的空闲位置 { level: [{x, z}, ...] }
        
        // 时间管理
        this.lastUpdateTime = null;
        
        // 模型引用（从外部传入）
        this.models = {};
        this.modelGroups = {};
        
        // UI 实例引用（用于暂停功能）
        this.uiInstance = null;
        
        // 调试变量
        this.lastCenterY = null;
    }
    
    // 设置模型引用（从 LevelSelection3D 传入）
    setModels(models, modelGroups) {
        this.models = models;
        this.modelGroups = modelGroups;
    }
    
    // 设置 UI 实例引用（用于暂停功能）
    setUIInstance(uiInstance) {
        this.uiInstance = uiInstance;
    }
    
    // 进入关卡：初始化关卡内容
    async enterLevel(level) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        console.log(`LevelContent3D: Entering level ${level}`);
        
        // 生成迷宫
        await this.generateMaze(level);
        
        // 添加关卡灯
        this.addLevelLight(level);
        
        // 创建碰撞检测世界
        await this.setupCollisionWorld(level);
        
        // 创建玩家并放置在空闲位置
        await this.createPlayer(level);
    }
    
    // 退出关卡：清理关卡内容
    exitLevel() {
        // 清除所有关卡的迷宫障碍物
        for (const levelKey in this.mazeBlocks) {
            const level = parseInt(levelKey);
            const blocks = this.mazeBlocks[level];
            if (blocks && blocks.length > 0) {
                blocks.forEach(block => {
                    if (block.parent) {
                        block.parent.remove(block);
                    }
                    if (block.geometry) block.geometry.dispose();
                    if (block.material) {
                        if (Array.isArray(block.material)) {
                            block.material.forEach(m => m.dispose());
                        } else {
                            block.material.dispose();
                        }
                    }
                });
                this.mazeBlocks[level] = [];
            }
        }
        
        // 清除关卡灯
        if (this.levelLight) {
            this.scene.remove(this.levelLight);
            if (this.levelLightTarget) {
                this.scene.remove(this.levelLightTarget);
            }
            this.levelLight = null;
            this.levelLightTarget = null;
        }
        
        // 清除player
        if (this.player) {
            this.scene.remove(this.player.object);
            this.player = null;
        }
        
        // 清除player visualization
        if (this.playerVisualization) {
            this.scene.remove(this.playerVisualization);
            this.playerVisualization = null;
        }
        
        // 移除键盘事件监听器
        if (this.playerKeydownHandler) {
            document.removeEventListener('keydown', this.playerKeydownHandler);
            this.playerKeydownHandler = null;
        }
        if (this.playerKeyupHandler) {
            document.removeEventListener('keyup', this.playerKeyupHandler);
            this.playerKeyupHandler = null;
        }
        
        // 移除PointerLockControls事件监听器
        if (this.pointerLockClickHandler && this.renderer && this.renderer.domElement) {
            this.renderer.domElement.removeEventListener('click', this.pointerLockClickHandler);
            this.pointerLockClickHandler = null;
        }
        if (this.pointerLockUnlockHandler && this.player && this.player.controls) {
            this.player.controls.removeEventListener('unlock', this.pointerLockUnlockHandler);
            this.pointerLockUnlockHandler = null;
        }
        
        // 清除碰撞世界
        this.collisionWorld = null;
        
        // 重置动画状态
        this.cameraAnimationState = null;
        this.playerMovementLocked = false;
        this.lastUpdateTime = null;
        this.floorSurfaceY = null;
        this.playerInitialPosition = null;
        
        console.log('LevelContent3D: Exited level, cleaned up all resources');
    }
    
    // 生成迷宫
    async generateMaze(level) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        // 清除旧的迷宫
        if (this.mazeBlocks[level]) {
            this.mazeBlocks[level].forEach(block => {
                if (block.parent) {
                    block.parent.remove(block);
                }
                if (block.geometry) block.geometry.dispose();
                if (block.material) {
                    if (Array.isArray(block.material)) {
                        block.material.forEach(m => m.dispose());
                    } else {
                        block.material.dispose();
                    }
                }
            });
            this.mazeBlocks[level] = [];
        }
        
        // 获取地图大小
        let mapWidth, mapDepth;
        if (level === 0) {
            mapWidth = 10;
            mapDepth = 10;
        } else if (level === 1) {
            mapWidth = 14;
            mapDepth = 14;
        } else if (level === 2) {
            mapWidth = 18;
            mapDepth = 18;
        } else {
            return;
        }
        
        // 动态导入 MapGenerator
        const { createBlock } = await import('./mapgenerator.js');
        
        // 内部空间大小（正好是 mapWidth x mapDepth，因为墙现在在边界外侧）
        // 方块应该覆盖从 -halfWidth 到 +halfWidth 的整个内部空间
        const innerWidth = mapWidth;
        const innerDepth = mapDepth;
        const totalCells = innerWidth * innerDepth;
        const targetWallCount = Math.floor(totalCells * 0.5);
        
        // 使用递归回溯算法生成连通迷宫
        const maze = this.generateConnectedMaze(innerWidth, innerDepth, targetWallCount);
        
        // 根据生成的迷宫放置障碍物
        const mazeBlocks = [];
        const model = this.models[level];
        if (!model) return;
        
        const halfWidth = mapWidth / 2;
        const halfDepth = mapDepth / 2;
        
        for (let x = 0; x < innerWidth; x++) {
            for (let z = 0; z < innerDepth; z++) {
                if (maze[x][z] === 1) {
                    // 计算方块位置（相对于地图中心）
                    // 地图中心在 (0,0,0)，内部空间从 [-halfWidth, halfWidth] x [-halfDepth, halfDepth]
                    // 网格索引 x 从 0 到 innerWidth-1，对应世界坐标从 -halfWidth 到 halfWidth-1
                    // 方块中心应该在每个格子的中心，并向 xz 正方向偏移 0.5 单位，所以：
                    // actualX = -halfWidth + x + 0.5 + 0.5 = -halfWidth + x + 1.0
                    // actualZ = -halfDepth + z + 0.5 + 0.5 = -halfDepth + z + 1.0
                    const actualX = -halfWidth + x + 1.0;
                    const actualZ = -halfDepth + z + 1.0;
                    
                    const tempScene = new THREE.Scene();
                    const block = createBlock(tempScene, actualX, actualZ, 2);
                    tempScene.remove(block);
                    
                    model.add(block);
                    mazeBlocks.push(block);
                }
            }
        }
        
        this.mazeBlocks[level] = mazeBlocks;
        const wallCount = mazeBlocks.length;
        const emptyCount = totalCells - wallCount;
        
        // 保存空闲位置（使用与方块相同的坐标系统）
        const emptyPositions = [];
        for (let x = 0; x < innerWidth; x++) {
            for (let z = 0; z < innerDepth; z++) {
                if (maze[x][z] === 0) {
                    // 使用与方块相同的坐标计算方式（也向 xz 正方向偏移 0.5 单位）
                    const actualX = -halfWidth + x + 1.0;
                    const actualZ = -halfDepth + z + 1.0;
                    emptyPositions.push({ x: actualX, z: actualZ });
                }
            }
        }
        this.emptyPositions[level] = emptyPositions;
        
        console.log(`LevelContent3D: Generated maze for level ${level} (${mapWidth}x${mapDepth}): ${wallCount} walls, ${emptyCount} empty`);
    }
    
    // 使用递归回溯算法生成完全连通的迷宫
    generateConnectedMaze(width, depth, targetWallCount) {
        // 先使用递归回溯算法生成一个完全连通的迷宫（所有单元格都可达）
        const maze = Array(width).fill(null).map(() => Array(depth).fill(1));
        const visited = Array(width).fill(null).map(() => Array(depth).fill(false));
        
        const directions = [
            { dx: 0, dz: -1 },
            { dx: 1, dz: 0 },
            { dx: 0, dz: 1 },
            { dx: -1, dz: 0 }
        ];
        
        const startX = Math.floor(Math.random() * width);
        const startZ = Math.floor(Math.random() * depth);
        
        const stack = [[startX, startZ]];
        let pathCells = 0;
        
        maze[startX][startZ] = 0;
        visited[startX][startZ] = true;
        pathCells++;
        
        // 第一阶段：使用递归回溯算法生成完全连通的迷宫
        // 跳两格（跳过中间墙）确保路径是连通的
        while (stack.length > 0) {
            const [currentX, currentZ] = stack[stack.length - 1];
            
            const neighbors = [];
            for (const dir of directions) {
                const nextX = currentX + dir.dx * 2;
                const nextZ = currentZ + dir.dz * 2;
                
                if (nextX >= 0 && nextX < width && 
                    nextZ >= 0 && nextZ < depth && 
                    !visited[nextX][nextZ]) {
                    neighbors.push({
                        x: nextX,
                        z: nextZ,
                        midX: currentX + dir.dx,
                        midZ: currentZ + dir.dz
                    });
                }
            }
            
            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                maze[next.midX][next.midZ] = 0;
                maze[next.x][next.z] = 0;
                visited[next.x][next.z] = true;
                pathCells++;
                stack.push([next.x, next.z]);
            } else {
                stack.pop();
            }
        }
        
        // 第二阶段：如果路径单元格数少于目标，在已有连通路径上随机扩展
        // 但只扩展与现有路径相邻的单元格，确保保持连通性
        const allPathCells = [];
        for (let x = 0; x < width; x++) {
            for (let z = 0; z < depth; z++) {
                if (maze[x][z] === 0) {
                    allPathCells.push([x, z]);
                }
            }
        }
        
        // 收集所有可扩展的墙壁位置（必须与至少一个路径单元格相邻）
        const expandableWalls = [];
        for (let x = 0; x < width; x++) {
            for (let z = 0; z < depth; z++) {
                if (maze[x][z] === 1) {
                    // 检查是否与至少一个路径单元格相邻
                    let hasPathNeighbor = false;
                    for (const dir of directions) {
                        const neighborX = x + dir.dx;
                        const neighborZ = z + dir.dz;
                        if (neighborX >= 0 && neighborX < width && 
                            neighborZ >= 0 && neighborZ < depth && 
                            maze[neighborX][neighborZ] === 0) {
                            hasPathNeighbor = true;
                            break;
                        }
                    }
                    if (hasPathNeighbor) {
                        expandableWalls.push([x, z]);
                    }
                }
            }
        }
        
        // 随机扩展墙壁，直到达到目标路径数量
        while (pathCells < (width * depth - targetWallCount) && expandableWalls.length > 0) {
            const randomIndex = Math.floor(Math.random() * expandableWalls.length);
            const [wallX, wallZ] = expandableWalls[randomIndex];
            
            maze[wallX][wallZ] = 0;
            allPathCells.push([wallX, wallZ]);
            pathCells++;
            
            // 从可扩展列表中移除这个位置
            expandableWalls.splice(randomIndex, 1);
            
            // 检查这个新路径单元格的邻居，如果它们是墙壁，添加到可扩展列表
            for (const dir of directions) {
                const neighborX = wallX + dir.dx;
                const neighborZ = wallZ + dir.dz;
                if (neighborX >= 0 && neighborX < width && 
                    neighborZ >= 0 && neighborZ < depth && 
                    maze[neighborX][neighborZ] === 1) {
                    // 检查这个墙壁是否已经在可扩展列表中
                    const alreadyInList = expandableWalls.some(
                        ([x, z]) => x === neighborX && z === neighborZ
                    );
                    if (!alreadyInList) {
                        expandableWalls.push([neighborX, neighborZ]);
                    }
                }
            }
        }
        
        // 第三阶段：验证连通性（使用 BFS）
        this.verifyMazeConnectivity(maze, width, depth);
        
        return maze;
    }
    
    // 验证迷宫连通性，如果发现不连通的区域，将它们连接起来
    verifyMazeConnectivity(maze, width, depth) {
        const visited = Array(width).fill(null).map(() => Array(depth).fill(false));
        const directions = [
            { dx: 0, dz: -1 },
            { dx: 1, dz: 0 },
            { dx: 0, dz: 1 },
            { dx: -1, dz: 0 }
        ];
        
        // 找到所有路径单元格
        const pathCells = [];
        for (let x = 0; x < width; x++) {
            for (let z = 0; z < depth; z++) {
                if (maze[x][z] === 0) {
                    pathCells.push([x, z]);
                }
            }
        }
        
        if (pathCells.length === 0) return;
        
        // 使用 BFS 从第一个路径单元格开始标记所有连通的单元格
        const queue = [[pathCells[0][0], pathCells[0][1]]];
        visited[pathCells[0][0]][pathCells[0][1]] = true;
        let connectedCount = 1;
        
        while (queue.length > 0) {
            const [currentX, currentZ] = queue.shift();
            
            for (const dir of directions) {
                const nextX = currentX + dir.dx;
                const nextZ = currentZ + dir.dz;
                
                if (nextX >= 0 && nextX < width && 
                    nextZ >= 0 && nextZ < depth && 
                    maze[nextX][nextZ] === 0 && 
                    !visited[nextX][nextZ]) {
                    visited[nextX][nextZ] = true;
                    connectedCount++;
                    queue.push([nextX, nextZ]);
                }
            }
        }
        
        // 如果存在不连通的区域，找到最近的路径单元格并连接它们
        if (connectedCount < pathCells.length) {
            console.warn(`Maze has ${pathCells.length - connectedCount} disconnected cells, connecting them...`);
            
            // 找到未访问的路径单元格
            const disconnectedCells = [];
            for (let x = 0; x < width; x++) {
                for (let z = 0; z < depth; z++) {
                    if (maze[x][z] === 0 && !visited[x][z]) {
                        disconnectedCells.push([x, z]);
                    }
                }
            }
            
            // 为每个不连通的区域找到最近的连通区域并连接
            for (const [disX, disZ] of disconnectedCells) {
                // 使用 BFS 找到最近的连通路径单元格
                const distQueue = [[disX, disZ, []]]; // 每个元素：[x, z, path]
                const distVisited = Array(width).fill(null).map(() => Array(depth).fill(false));
                distVisited[disX][disZ] = true;
                
                let foundPath = false;
                while (distQueue.length > 0 && !foundPath) {
                    const [currX, currZ, path] = distQueue.shift();
                    
                    for (const dir of directions) {
                        const nextX = currX + dir.dx;
                        const nextZ = currZ + dir.dz;
                        
                        if (nextX >= 0 && nextX < width && 
                            nextZ >= 0 && nextZ < depth) {
                            if (maze[nextX][nextZ] === 0 && visited[nextX][nextZ]) {
                                // 找到连通的路径，沿着路径创建连接
                                const connectionPath = [[disX, disZ], ...path, [nextX, nextZ]];
                                for (const [px, pz] of connectionPath) {
                                    maze[px][pz] = 0;
                                    visited[px][pz] = true;
                                }
                                foundPath = true;
                                break;
                            } else if (!distVisited[nextX][nextZ]) {
                                distVisited[nextX][nextZ] = true;
                                distQueue.push([nextX, nextZ, [...path, [currX, currZ]]]);
                            }
                        }
                    }
                }
            }
            
            // 再次验证连通性
            const finalVisited = Array(width).fill(null).map(() => Array(depth).fill(false));
            const finalQueue = [[pathCells[0][0], pathCells[0][1]]];
            finalVisited[pathCells[0][0]][pathCells[0][1]] = true;
            let finalConnectedCount = 1;
            
            while (finalQueue.length > 0) {
                const [currentX, currentZ] = finalQueue.shift();
                for (const dir of directions) {
                    const nextX = currentX + dir.dx;
                    const nextZ = currentZ + dir.dz;
                    if (nextX >= 0 && nextX < width && 
                        nextZ >= 0 && nextZ < depth && 
                        maze[nextX][nextZ] === 0 && 
                        !finalVisited[nextX][nextZ]) {
                        finalVisited[nextX][nextZ] = true;
                        finalConnectedCount++;
                        finalQueue.push([nextX, nextZ]);
                    }
                }
            }
            
            if (finalConnectedCount < pathCells.length) {
                console.error(`Maze still has ${pathCells.length - finalConnectedCount} disconnected cells after connection attempt!`);
            } else {
                console.log(`Maze is fully connected with ${finalConnectedCount} path cells.`);
            }
        }
    }
    
    // 添加关卡灯
    addLevelLight(level) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        if (this.levelLight) {
            this.scene.remove(this.levelLight);
            if (this.levelLightTarget) {
                this.scene.remove(this.levelLightTarget);
            }
            this.levelLight = null;
            this.levelLightTarget = null;
        }
        
        const model = this.models[level];
        if (!model) return;
        
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        
        const lightPosition = new THREE.Vector3(
            center.x,
            center.y + 12,
            center.z
        );
        
        const spotlight = new THREE.SpotLight(0xffffff, 1.0);
        spotlight.position.copy(lightPosition);
        
        const target = new THREE.Object3D();
        target.position.copy(center);
        spotlight.target = target;
        
        spotlight.angle = Math.PI / 3;
        spotlight.penumbra = 0.5;
        spotlight.decay = 2;
        spotlight.distance = 50;
        
        this.scene.add(spotlight);
        this.scene.add(target);
        
        this.levelLight = spotlight;
        this.levelLightTarget = target;
        
        console.log(`LevelContent3D: Added level light at (${lightPosition.x.toFixed(2)}, ${lightPosition.y.toFixed(2)}, ${lightPosition.z.toFixed(2)})`);
    }
    
    // 设置碰撞检测世界
    async setupCollisionWorld(level) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        const { Octree } = await import('https://unpkg.com/three@0.165.0/examples/jsm/math/Octree.js');
        
        this.collisionWorld = new Octree();
        
        const model = this.models[level];
        if (!model) return;
        
        model.updateMatrixWorld(true);
        model.traverse((child) => {
            if (child.isMesh) {
                child.updateWorldMatrix(true, false);
                this.collisionWorld.fromGraphNode(child);
            }
        });
        
        console.log('LevelContent3D: Collision world set up for level', level);
    }
    
    // 创建玩家
    async createPlayer(level) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        if (this.player) {
            this.scene.remove(this.player.object);
            this.player = null;
        }
        
        let PlayerClass = null;
        let waitCount = 0;
        const maxWait = 200;
        
        while ((typeof window.Player === 'undefined' || window.Player === null) && 
               waitCount < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 50));
            waitCount++;
            if (waitCount % 20 === 0) {
                console.log(`LevelContent3D: Waiting for Player class... (${waitCount * 50}ms)`);
            }
        }
        
        PlayerClass = window.Player || null;
        
        if (!PlayerClass) {
            console.error('LevelContent3D: Player class not found after waiting.');
            return;
        }
        
        if (typeof PlayerClass !== 'function') {
            console.error('LevelContent3D: window.Player is not a function:', typeof PlayerClass);
            return;
        }
        
        const emptyPositions = this.emptyPositions[level];
        if (!emptyPositions || emptyPositions.length === 0) {
            console.error(`LevelContent3D: No empty positions available for level ${level}`);
            return;
        }
        
        const randomPos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
        
        const model = this.models[level];
        if (!model) return;
        
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const modelCenter = box.getCenter(new THREE.Vector3());
        
        const PLAYER_HEIGHT = 0.5;
        const startY = 10.0;
        
        let mapWidth, mapDepth;
        if (level === 0) {
            mapWidth = 10;
            mapDepth = 10;
        } else if (level === 1) {
            mapWidth = 14;
            mapDepth = 14;
        } else if (level === 2) {
            mapWidth = 18;
            mapDepth = 18;
        }
        
        const localX = randomPos.x;
        const localZ = randomPos.z;
        const localY = startY;
        
        const localPos = new THREE.Vector3(localX, localY, localZ);
        localPos.applyMatrix4(model.matrixWorld);
        
        const playerWorldX = localPos.x;
        const playerWorldY = localPos.y;
        const playerWorldZ = localPos.z;
        
        this.player = new PlayerClass(0, this.renderer, this.collisionWorld);
        
        if (this.player.speedY === undefined) {
            this.player.speedY = 0;
        }
        
        const groundWorldY = box.min.y;
        const floorSurfaceY = groundWorldY + 0.2;
        this.floorSurfaceY = floorSurfaceY;
        
        const PLAYER_VISUAL_SIZE = 0.8 * 0.05 * 0.3;
        const COLLIDER_RADIUS = PLAYER_VISUAL_SIZE / 2;
        const COLLIDER_HEIGHT = PLAYER_VISUAL_SIZE;
        
        try {
            const capsuleModule = await import("https://unpkg.com/three@0.165.0/examples/jsm/math/Capsule.js");
            const Capsule = capsuleModule.Capsule;
            this.player.collider = new Capsule(
                new THREE.Vector3(playerWorldX, groundWorldY, playerWorldZ),
                new THREE.Vector3(playerWorldX, groundWorldY + COLLIDER_HEIGHT, playerWorldZ),
                COLLIDER_RADIUS
            );
            console.log('LevelContent3D: Collider resized to match red cube size');
        } catch (e) {
            console.warn('LevelContent3D: Failed to import Capsule, adjusting collider position only:', e);
            this.player.collider.start.set(playerWorldX, groundWorldY, playerWorldZ);
            this.player.collider.end.set(playerWorldX, groundWorldY + COLLIDER_HEIGHT, playerWorldZ);
        }
        
        this.player.camera.position.set(playerWorldX, this.player.collider.end.y, playerWorldZ);
        
        const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
        this.player.mesh.position.set(center.x, this.player.collider.start.y, center.z);
        this.player.object.position.set(0, 0, 0);
        
        if (this.player && this.player.mesh) {
            this.player.mesh.visible = false;
            this.player.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.visible = false;
                }
            });
        }
        
        this.player.object.visible = true;
        this.player.camera.visible = true;
        
        if (!this.scene.children.includes(this.player.object)) {
            this.scene.add(this.player.object);
        }
        
        this.playerMovementLocked = true;
        this.player.onGround = false;
        
        this.setupPlayerKeyboardControls();
        
        console.log(`LevelContent3D: Player created at (${playerWorldX.toFixed(2)}, ${playerWorldY.toFixed(2)}, ${playerWorldZ.toFixed(2)})`);
        
        this.createPlayerVisualization(playerWorldX, playerWorldY, playerWorldZ);
        
        if (this.player && this.player.controls) {
            if (this.pointerLockClickHandler) {
                this.renderer.domElement.removeEventListener('click', this.pointerLockClickHandler);
            }
            
            this.pointerLockClickHandler = () => {
                if (this.player && this.player.controls && !this.player.controls.isLocked) {
                    this.player.controls.lock();
                    console.log('LevelContent3D: PointerLockControls locked via click');
                }
            };
            
            this.renderer.domElement.addEventListener('click', this.pointerLockClickHandler);
            
            if (!this.pointerLockUnlockHandler) {
                this.pointerLockUnlockHandler = () => {
                    console.log('LevelContent3D: PointerLockControls unlocked');
                };
                this.player.controls.addEventListener('unlock', this.pointerLockUnlockHandler);
            }
        }
    }
    
    // 创建player可视化正方体
    createPlayerVisualization(x, y, z) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        if (this.playerVisualization) {
            this.scene.remove(this.playerVisualization);
        }
        
        const size = 0.8 * 0.05 * 0.3;
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0x660000,
            metalness: 0.3,
            roughness: 0.7
        });
        
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(x, y, z);
        cube.name = 'PlayerVisualization';
        
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        cube.add(wireframe);
        
        this.scene.add(cube);
        this.playerVisualization = cube;
        
        console.log(`LevelContent3D: Player visualization cube created at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
    }
    
    // 更新player visualization位置
    updatePlayerVisualization(centerX, centerY, centerZ) {
        if (!this.playerVisualization) return;
        
        // 只在位置有明显变化时才更新（减少不必要的更新，避免闪动）
        const currentPos = this.playerVisualization.position;
        const distanceThreshold = 0.0001; // 0.1mm 阈值
        
        const dx = Math.abs(currentPos.x - centerX);
        const dy = Math.abs(currentPos.y - centerY);
        const dz = Math.abs(currentPos.z - centerZ);
        
        // 调试：如果 y 坐标变化明显，打印
        if (dy > 0.001) {
            console.log(`[PlayerVis Y Change] Old Y: ${currentPos.y.toFixed(4)} -> New Y: ${centerY.toFixed(4)} (delta: ${(centerY - currentPos.y).toFixed(4)}) | Center: (${centerX.toFixed(3)}, ${centerY.toFixed(3)}, ${centerZ.toFixed(3)})`);
        }
        
        if (dx > distanceThreshold || dy > distanceThreshold || dz > distanceThreshold) {
            this.playerVisualization.position.set(centerX, centerY, centerZ);
        }
    }
    
    // 设置player键盘控制
    setupPlayerKeyboardControls() {
        if (!this.player) return;
        
        if (this.playerKeydownHandler) {
            document.removeEventListener('keydown', this.playerKeydownHandler);
        }
        if (this.playerKeyupHandler) {
            document.removeEventListener('keyup', this.playerKeyupHandler);
        }
        
        this.playerKeydownHandler = (event) => {
            // ESC 键处理：进入暂停界面
            if (event.key === 'Escape' || event.key === 'Esc') {
                if (this.uiInstance && typeof this.uiInstance.handlePauseClick === 'function') {
                    // 如果 PointerLockControls 已锁定，先解锁
                    if (this.player && this.player.controls && this.player.controls.isLocked) {
                        this.player.controls.unlock();
                    }
                    this.uiInstance.handlePauseClick();
                }
                return;
            }
            
            if (!this.player || this.playerMovementLocked) return;
            
            switch(event.key.toLowerCase()) {
                case 'w':
                    this.player.movement.w = true;
                    break;
                case 'a':
                    this.player.movement.a = true;
                    break;
                case 's':
                    this.player.movement.s = true;
                    break;
                case 'd':
                    this.player.movement.d = true;
                    break;
                case ' ':
                    if (!this.player.movement.spaceHold) {
                        this.player.movement.space = true;
                        this.player.movement.spaceHold = true;
                        if (this.player.onGround) {
                            this.player.speedY = 0.03;
                        }
                    }
                    break;
            }
        };
        
        this.playerKeyupHandler = (event) => {
            if (!this.player || this.playerMovementLocked) return;
            
            switch(event.key.toLowerCase()) {
                case 'w':
                    this.player.movement.w = false;
                    break;
                case 'a':
                    this.player.movement.a = false;
                    break;
                case 's':
                    this.player.movement.s = false;
                    break;
                case 'd':
                    this.player.movement.d = false;
                    break;
                case ' ':
                    this.player.movement.space = false;
                    this.player.movement.spaceHold = false;
                    break;
            }
        };
        
        document.addEventListener('keydown', this.playerKeydownHandler);
        document.addEventListener('keyup', this.playerKeyupHandler);
        
        console.log('LevelContent3D: Player keyboard controls set up (WASD + Space)');
    }
    
    // 更新player（物理、碰撞等）
    updatePlayer(deltaTime) {
        if (!this.player || !this.collisionWorld) {
            return;
        }
        
        if (!deltaTime || deltaTime <= 0) {
            deltaTime = 0.016;
        }
        
        const PLAYER_HEIGHT = 0.5;
        // 重力已禁用
        const PLAYER_VISUAL_SIZE = 0.8 * 0.05 * 0.3;
        const COLLIDER_HEIGHT = PLAYER_VISUAL_SIZE;
        
        const floorSurfaceY = this.floorSurfaceY !== undefined ? this.floorSurfaceY : 0.2;
        
        // 重力已禁用，speedY 始终为 0
        if (this.player.speedY === undefined) {
            this.player.speedY = 0;
        } else {
            this.player.speedY = 0; // 强制设置为 0
        }
        
        if (!this.playerInitialPosition) {
            const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
            this.playerInitialPosition = {
                x: center.x,
                y: center.y,
                z: center.z,
                groundY: this.player.collider.start.y
            };
        }
        
        // 重力已禁用，确保 player 始终保持在 floorSurfaceY 上方（初始化时）
        if (!this.playerHeightFixed) {
            const targetY = floorSurfaceY + COLLIDER_HEIGHT / 2;
            const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
            if (Math.abs(center.y - targetY) > 0.01) {
                const yOffset = targetY - center.y;
                this.player.collider.start.y += yOffset;
                this.player.collider.end.y += yOffset;
                this.player.speedY = 0;
                this.player.onGround = true;
                
                const halfHeight = PLAYER_HEIGHT / 2;
                const newCenter = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                this.player.mesh.position.set(newCenter.x, newCenter.y - halfHeight, newCenter.z);
                this.player.camera.position.set(newCenter.x, newCenter.y + halfHeight, newCenter.z);
                this.updatePlayerVisualization(newCenter.x, newCenter.y, newCenter.z);
                
                if (!this.cameraAnimationState || (!this.cameraAnimationState.isAnimating && !this.cameraAnimationState.completed)) {
                    console.log('LevelContent3D: Player initialized, starting camera animation');
                    this.startCameraAnimation();
                }
                
                this.playerHeightFixed = true;
                return;
            }
        }
        
        if (this.playerMovementLocked) {
            if (this.player.collider.start.y < floorSurfaceY) {
                const PLAYER_VISUAL_SIZE = 0.8 * 0.05 * 0.3;
                const COLLIDER_HEIGHT = PLAYER_VISUAL_SIZE;
                this.player.collider.start.y = floorSurfaceY;
                this.player.collider.end.y = floorSurfaceY + COLLIDER_HEIGHT;
                this.player.speedY = 0;
                this.player.onGround = true;
                
                const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                const halfHeight = PLAYER_HEIGHT / 2;
                this.player.mesh.position.set(center.x, center.y - halfHeight, center.z);
                this.player.camera.position.set(center.x, center.y + halfHeight, center.z);
                
                this.updatePlayerVisualization(center.x, center.y, center.z);
                
                if (!this.cameraAnimationState || (!this.cameraAnimationState.isAnimating && !this.cameraAnimationState.completed)) {
                    console.log('LevelContent3D: Player reached floor, starting camera animation');
                    this.startCameraAnimation();
                }
            } else {
                // 重力已禁用，不再应用重力
                // player 保持在固定高度
                const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                const halfHeight = PLAYER_HEIGHT / 2;
                this.player.mesh.position.set(center.x, center.y - halfHeight, center.z);
                this.player.camera.position.set(center.x, center.y + halfHeight, center.z);
                
                this.updatePlayerVisualization(center.x, center.y, center.z);
            }
            
            const result = this.collisionWorld.capsuleIntersect(this.player.collider);
            this.player.onGround = false;
            
            if (this.player.collider.start.y < floorSurfaceY) {
                const PLAYER_VISUAL_SIZE = 0.8 * 0.05 * 0.3;
                const COLLIDER_HEIGHT = PLAYER_VISUAL_SIZE;
                this.player.collider.start.y = floorSurfaceY;
                this.player.collider.end.y = floorSurfaceY + COLLIDER_HEIGHT;
                this.player.speedY = 0;
                this.player.onGround = true;
                
                const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                const halfHeight = PLAYER_HEIGHT / 2;
                this.player.mesh.position.set(center.x, center.y - halfHeight, center.z);
                this.player.camera.position.set(center.x, center.y + halfHeight, center.z);
                
                this.updatePlayerVisualization(center.x, center.y, center.z);
                
                if (!this.cameraAnimationState || (!this.cameraAnimationState.isAnimating && !this.cameraAnimationState.completed)) {
                    console.log('LevelContent3D: Player reached floor, starting camera animation');
                    this.startCameraAnimation();
                }
            } else if (result) {
                this.player.onGround = result.normal.y > 0.5;
                
                if (result.depth >= 1e-5) {
                    this.player.collider.translate(result.normal.multiplyScalar(result.depth));
                }
                
                if (this.player.onGround) {
                    this.player.speedY = 0;
                    
                    if (!this.cameraAnimationState || (!this.cameraAnimationState.isAnimating && !this.cameraAnimationState.completed)) {
                        console.log('LevelContent3D: Player landed, starting camera animation');
                        this.startCameraAnimation();
                    }
                }
                
                const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                const halfHeight = PLAYER_HEIGHT / 2;
                this.player.mesh.position.set(center.x, this.player.collider.start.y, center.z);
                this.player.camera.position.set(center.x, this.player.collider.end.y, center.z);
                
                // 调试：打印 center.y 和 collider 位置
                if (Math.abs(center.y - (this.lastCenterY || center.y)) > 0.001) {
                    console.log(`[LevelContent3D updatePlayer] center.y: ${center.y.toFixed(4)} | collider.start.y: ${this.player.collider.start.y.toFixed(4)} | collider.end.y: ${this.player.collider.end.y.toFixed(4)}`);
                    this.lastCenterY = center.y;
                }
                
                this.updatePlayerVisualization(center.x, center.y, center.z);
            } else {
                const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                this.updatePlayerVisualization(center.x, center.y, center.z);
            }
        } else {
            if (this.player && this.player.update && this.player.controls) {
                this.player.update();
                
                // 重力已禁用，不再需要频繁检查 y<floorSurface
                // 只在必要时（初始化或错误情况）修复位置
                if (this.player.collider.start.y < floorSurfaceY || this.player.collider.end.y < floorSurfaceY) {
                    const PLAYER_VISUAL_SIZE = 0.8 * 0.05 * 0.3;
                    const COLLIDER_HEIGHT = PLAYER_VISUAL_SIZE;
                    this.player.collider.start.y = floorSurfaceY;
                    this.player.collider.end.y = floorSurfaceY + COLLIDER_HEIGHT;
                    this.player.speedY = 0;
                    this.player.onGround = true;
                    
                    const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                    const PLAYER_HEIGHT = 0.5;
                    const halfHeight = PLAYER_HEIGHT / 2;
                    this.player.mesh.position.set(center.x, center.y - halfHeight, center.z);
                    this.player.camera.position.set(center.x, center.y + halfHeight, center.z);
                }
                
                const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                this.updatePlayerVisualization(center.x, center.y, center.z);
            } else if (this.player && !this.player.controls) {
                console.warn('LevelContent3D: Player controls not available, cannot move');
            }
        }
    }
    
    // 启动camera动画
    startCameraAnimation() {
        if (!this.player) return;
        
        const THREE = window.THREE;
        if (!THREE) return;
        
        const startPos = this.camera.position.clone();
        
        const playerCenter = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
        const PLAYER_HEIGHT = 0.5;
        const halfHeight = PLAYER_HEIGHT / 2;
        
        let visualizationPos = playerCenter.clone();
        if (this.playerVisualization) {
            visualizationPos = this.playerVisualization.position.clone();
        }
        
        let playerDirection = new THREE.Vector3(0, 0, -1);
        if (this.player && this.player.camera && this.player.controls) {
            try {
                this.player.camera.getWorldDirection(playerDirection);
                playerDirection.normalize();
            } catch (e) {
                playerDirection = new THREE.Vector3(0, 0, -1);
            }
        }
        
        const offsetHeight = 1.0;
        const targetPos = new THREE.Vector3(
            visualizationPos.x,
            visualizationPos.y + offsetHeight,
            visualizationPos.z
        );
        
        const targetLookAt = visualizationPos.clone();
        
        this.cameraAnimationState = {
            isAnimating: true,
            completed: false,
            startTime: Date.now(),
            duration: 600,
            startPos: startPos,
            targetPos: targetPos,
            startLookAt: this.controls ? this.controls.target.clone() : startPos.clone().add(new THREE.Vector3(0, 0, -5)),
            targetLookAt: targetLookAt
        };
        
        console.log('LevelContent3D: Camera animation started');
    }
    
    // 更新camera动画
    updateCameraAnimation() {
        if (!this.cameraAnimationState || !this.cameraAnimationState.isAnimating) return;
        
        const elapsed = Date.now() - this.cameraAnimationState.startTime;
        const progress = Math.min(elapsed / this.cameraAnimationState.duration, 1);
        
        const easedProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        const startPos = this.cameraAnimationState.startPos;
        const targetPos = this.cameraAnimationState.targetPos;
        const currentPos = startPos.clone().lerp(targetPos, easedProgress);
        
        // 只在位置有明显变化时才更新（减少不必要的更新）
        const currentCameraPos = this.camera.position;
        const distanceThreshold = 0.001; // 1mm 阈值
        if (currentCameraPos.distanceTo(currentPos) > distanceThreshold) {
            this.camera.position.copy(currentPos);
        }
        
        if (this.controls) {
            const startLookAt = this.cameraAnimationState.startLookAt;
            const targetLookAt = this.cameraAnimationState.targetLookAt;
            const currentLookAt = startLookAt.clone().lerp(targetLookAt, easedProgress);
            
            // 只在目标有明显变化时才更新
            const currentTarget = this.controls.target;
            if (currentTarget.distanceTo(currentLookAt) > distanceThreshold) {
                this.controls.target.copy(currentLookAt);
                this.controls.update();
            }
        } else {
            const startLookAt = this.cameraAnimationState.startLookAt;
            const targetLookAt = this.cameraAnimationState.targetLookAt;
            const currentLookAt = startLookAt.clone().lerp(targetLookAt, easedProgress);
            this.camera.lookAt(currentLookAt);
        }
        
        if (progress >= 1) {
            this.cameraAnimationState.isAnimating = false;
            this.cameraAnimationState.completed = true;
            
            this.playerMovementLocked = false;
            
            if (this.player && this.player.controls) {
                try {
                    this.player.controls.lock();
                    console.log('LevelContent3D: PointerLockControls locked, mouse movement enabled');
                } catch (e) {
                    console.warn('LevelContent3D: Failed to lock PointerLockControls:', e);
                }
            }
            
            if (!this.playerKeydownHandler) {
                this.setupPlayerKeyboardControls();
            }
        }
    }
    
    // 更新（在render循环中调用）
    update(deltaTime) {
        if (!deltaTime || deltaTime <= 0) {
            const currentTime = Date.now();
            if (!this.lastUpdateTime) {
                this.lastUpdateTime = currentTime;
            }
            deltaTime = (currentTime - this.lastUpdateTime) / 1000;
            this.lastUpdateTime = currentTime;
        }
        
        if (this.player) {
            this.updatePlayer(deltaTime);
            this.updateCameraAnimation();
        }
    }
    
    // 获取玩家对象（供外部访问）
    getPlayer() {
        return this.player;
    }
    
    // 获取玩家可视化对象（供外部访问）
    getPlayerVisualization() {
        return this.playerVisualization;
    }
    
    // 获取相机动画状态（供外部访问）
    getCameraAnimationState() {
        return this.cameraAnimationState;
    }
    
    // 获取碰撞世界（供外部访问）
    getCollisionWorld() {
        return this.collisionWorld;
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.LevelContent3D = LevelContent3D;
}

