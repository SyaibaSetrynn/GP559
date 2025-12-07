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
        this.cameraMoveToMazeAnimation = null; // 相机移动到迷宫随机位置的动画
        
        // 关卡灯
        this.levelLight = null;
        this.levelLightTarget = null;
        
        // 迷宫相关
        this.mazeBlocks = {}; // 每个level的迷宫障碍物 { level: [blocks...] }
        this.emptyPositions = {}; // 每个level的空闲位置 { level: [{x, z}, ...] }
        this.blockAnimations = {}; // 方块生长动画 { level: { isAnimating, startTime, duration, blocks: [{ block, startHeight, targetHeight }, ...] } }
        
        // 时间管理
        this.lastUpdateTime = null;
        
        // 模型引用（从外部传入）
        this.models = {};
        this.modelGroups = {};
        
        // UI 实例引用（用于暂停功能）
        this.uiInstance = null;
        
        // 调试变量
        this.lastCenterY = null;
        
        // 缓存applyUV函数
        this._applyUV = null;
        this._applyUVPromise = null;
    }
    
    // 重新应用UV映射到block（异步加载applyUV如果还没有加载）
    async _reapplyUVToBlock(block) {
        try {
            // 如果还没有加载applyUV，先加载
            if (!this._applyUV) {
                if (!this._applyUVPromise) {
                    this._applyUVPromise = import('./MapTextures.js').then(module => {
                        this._applyUV = module.applyUV;
                        return this._applyUV;
                    });
                }
                await this._applyUVPromise;
            }
            // 应用UV映射
            if (this._applyUV && block.geometry) {
                this._applyUV(block.geometry);
            }
        } catch (error) {
            console.warn(`LevelContent3D: Failed to reapply UV to block:`, error);
        }
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
        
        // 设置全局ESC键监听（不依赖玩家是否创建）
        this.setupGlobalKeyboardControls();
        
        // 检查迷宫是否已经生成
        const mazeAlreadyGenerated = this.mazeBlocks[level] && this.mazeBlocks[level].length > 0;
        
        if (!mazeAlreadyGenerated) {
            // 生成迷宫
            await this.generateMaze(level);
            
            // 不添加关卡灯（已移除）
        } else {
            console.log(`LevelContent3D: Maze already generated for level ${level}, skipping generation`);
        }
        
        // 注意：不创建碰撞检测世界和玩家，相机动画不依赖这些
        // await this.setupCollisionWorld(level);
        // await this.createPlayer(level);
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
        
        // 移除全局ESC键监听器
        if (this.globalKeydownHandler) {
            document.removeEventListener('keydown', this.globalKeydownHandler);
            this.globalKeydownHandler = null;
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
        this.cameraMoveToMazeAnimation = null;
        this.playerMovementLocked = false;
        this.lastUpdateTime = null;
        this.floorSurfaceY = null;
        this.playerInitialPosition = null;
        
        // 清除方块动画
        this.blockAnimations = {};
        
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
        
        // 获取地图大小 - 所有关卡都是10x10（和Level0一样大）
        let mapWidth, mapDepth;
        if (level >= 1 && level <= 5) {
            mapWidth = 10;
            mapDepth = 10;
        } else {
            console.error(`LevelContent3D: Unknown level: ${level}`);
            return;
        }
        
        // 动态导入 MapGenerator
        const { createBlock } = await import('./MapGenerator.js');
        
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
                    // 方块中心应该在每个格子的中心，所以：
                    // actualX = -halfWidth + x + 0.5
                    // actualZ = -halfDepth + z + 0.5
                    const actualX = -halfWidth + x + 0.5;
                    const actualZ = -halfDepth + z + 0.5;
                    
                    // Skip block generation at (0, 0) to keep spawn point clear
                    if (Math.abs(actualX) < 0.6 && Math.abs(actualZ) < 0.6) {
                        console.log(`Skipping block at (${actualX.toFixed(2)}, ${actualZ.toFixed(2)}) - spawn point reserved`);
                        continue;
                    }
                    
                    // 直接创建高度为2的block，初始位置在地板下方（y=-2，完全看不见）
                    const tempScene = new THREE.Scene();
                    const block = createBlock(tempScene, actualX, actualZ, 2); // 高度为2
                    tempScene.remove(block);
                    
                    // 设置初始位置在地板下方（y=-2，block中心在-2，底部在-3，完全在地板下方）
                    block.position.set(actualX, -2, actualZ);
                    block.visible = true;
                    
                    model.add(block);
                    mazeBlocks.push(block);
                    
                    // 减少日志输出以提高性能
                    // console.log(`Created block at (${actualX.toFixed(2)}, ${actualZ.toFixed(2)}) with height 2, initial y=-2 (below floor)`);
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
                    // 使用与方块相同的坐标计算方式
                    const actualX = -halfWidth + x + 0.5;
                    const actualZ = -halfDepth + z + 0.5;
                    emptyPositions.push({ x: actualX, z: actualZ });
                }
            }
        }
        this.emptyPositions[level] = emptyPositions;
        
        // 减少日志输出以提高性能
        // console.log(`LevelContent3D: Generated maze for level ${level} (${mapWidth}x${mapDepth}): ${wallCount} walls, ${emptyCount} empty`);
        
        // 保存texture信息，以便在动画过程中重新应用
        const mapMode = level; // Level1->mode1, Level2->mode2, etc.
        this.blockTextureInfo = this.blockTextureInfo || {};
        this.blockTextureInfo[level] = {
            mapMode: mapMode,
            walls: [],
            floor: null,
            mapWidth: mapWidth,
            mapDepth: mapDepth
        };
        
        // 获取walls和floor（从model中查找）
        const walls = [];
        const floor = model.children.find(child => child.userData && child.userData.isFloor) || 
                     model.children.find(child => child.geometry && child.geometry.type === 'PlaneGeometry');
        
        // 查找walls（BoxGeometry且不是blocks）
        model.children.forEach(child => {
            if (child.geometry && child.geometry.type === 'BoxGeometry' && 
                !mazeBlocks.includes(child) && child !== floor) {
                walls.push(child);
            }
        });
        
        // 保存walls和floor引用
        this.blockTextureInfo[level].walls = walls;
        this.blockTextureInfo[level].floor = floor;
        
        // 应用texture到blocks, walls, floor（blocks已经创建，高度为2）
        try {
            const { setMapTexture, applyUV } = await import('./MapTextures.js');
            setMapTexture(mapMode, mazeBlocks, walls, mapWidth, mapDepth, floor);
            console.log(`LevelContent3D: Applied texture mode ${mapMode} to level ${level} (blocks, walls, floor)`);
        } catch (error) {
            console.warn(`LevelContent3D: Failed to apply texture to level ${level}:`, error);
        }
        
        // 启动方块生长动画（从地板下方冒出来）
        this.startBlockGrowthAnimation(level);
    }
    
    // 启动方块生长动画
    startBlockGrowthAnimation(level) {
        const blocks = this.mazeBlocks[level];
        if (!blocks || blocks.length === 0) {
            console.warn(`LevelContent3D: No blocks found for level ${level}, cannot start animation`);
            return;
        }
        
        const THREE = window.THREE;
        if (!THREE) {
            console.error('LevelContent3D: THREE is not available');
            return;
        }
        
        // 为每个方块保存动画信息
        // block已经创建，高度为2，位置在地板下方（y=-2）
        // 动画将把block从y=-2移动到y=1（高度2的block，底部在地面，中心在y=1）
        const animatedBlocks = blocks.map(block => {
            // 保存方块的原始位置（x, z）
            const x = block.position.x;
            const z = block.position.z;
            // block已经在y=-2位置（地板下方），geometry已经是高度2
            // 不需要修改geometry，只需要改变y位置
            
            return {
                block: block,
                startY: -2, // 起始位置（地板下方）
                targetY: 1,  // 目标位置（高度2的block，中心在y=1，底部在地面y=0）
                x: x,
                z: z
            };
        });
        
        // 动画时序：等待0.5秒，然后花1秒从地板下方冒出来
        // startTime设置为0.5秒后（延迟开始）
        this.blockAnimations[level] = {
            isAnimating: true,
            startTime: Date.now() + 500, // 延迟0.5秒开始
            duration: 1000, // 1秒（从y=-2移动到y=1）
            blocks: animatedBlocks,
            lastFrameTime: null // 用于等待下一帧渲染
        };
        
        // 减少日志输出以提高性能
        // console.log(`LevelContent3D: Started block growth animation for level ${level} with ${animatedBlocks.length} blocks`);
    }
    
    // 更新方块生长动画（移除async，因为不再需要异步操作）
    updateBlockGrowthAnimation() {
        const THREE = window.THREE;
        if (!THREE) {
            console.warn('LevelContent3D: updateBlockGrowthAnimation called but THREE is not available');
            return;
        }
        
        // 移除调试日志以减少性能开销
        // const animCount = Object.keys(this.blockAnimations).length;
        
        // 检查是否有方块需要强制设置为高度2（如果动画已经过期或没有启动）
        for (const levelKey in this.mazeBlocks) {
            const level = parseInt(levelKey);
            const blocks = this.mazeBlocks[level];
            if (!blocks || blocks.length === 0) continue;
            
            // 检查是否有动画，如果没有或已过期，强制设置高度为2
            const anim = this.blockAnimations[level];
            if (!anim || !anim.isAnimating) {
                // 检查动画是否已过期（超过开始时间+持续时间）
                if (anim && anim.startTime) {
                    const elapsed = Math.max(0, Date.now() - anim.startTime);
                    if (elapsed > anim.duration) {
                        // 动画已过期，强制设置所有方块到最终位置y=1
                        for (const block of blocks) {
                            // block的geometry已经是高度2，只需要设置位置
                            block.position.y = 1; // 高度2的block，中心在y=1
                            block.visible = true;
                        }
                        // 清除过期的动画
                        delete this.blockAnimations[level];
                        console.log(`LevelContent3D: Force set all blocks to height 2 for level ${level} (animation expired)`);
                    }
                } else if (!anim) {
                    // 没有动画，直接设置所有方块到最终位置y=1
                    for (const block of blocks) {
                        // block的geometry已经是高度2，只需要设置位置
                        block.position.y = 1; // 高度2的block，中心在y=1
                        block.visible = true;
                    }
                }
            }
        }
        
        for (const levelKey in this.blockAnimations) {
            const anim = this.blockAnimations[levelKey];
            if (!anim.isAnimating) {
                continue; // 跳过非活动动画
            }
            
            // 计算经过的时间（考虑延迟开始）
            const currentTime = Date.now();
            const elapsed = Math.max(0, currentTime - anim.startTime); // 如果还没到开始时间，elapsed为0
            
            // 如果还没到开始时间，不更新block（保持在地板下方y=-2）
            if (elapsed <= 0) {
                continue; // 跳过这个动画，等待开始时间
            }
            
            // 计算进度，但允许实际时间超过duration（等待下一帧渲染）
            const progress = Math.min(elapsed / anim.duration, 1);
            
            // 使用easeOut缓动（从快到慢，更自然的生长效果）
            const easedProgress = 1 - Math.pow(1 - progress, 3); // cubic ease-out
            
            // 更新每个方块的y位置（从地板下方冒出来）
            // 不再改变geometry，只改变位置
            // 优化：计算一次currentY，然后批量更新所有block
            const startY = -2;
            const targetY = 1;
            const currentY = startY + (targetY - startY) * easedProgress;
            
            // 批量更新所有block的y位置（避免在循环中重复计算）
            for (let i = 0; i < anim.blocks.length; i++) {
                anim.blocks[i].block.position.y = currentY;
            }
            
            // 如果进度达到1，等待下一帧渲染后再完成动画
            if (progress >= 1) {
                // 如果还没有标记为等待下一帧，则等待
                if (!anim.waitingForFrame) {
                    anim.waitingForFrame = true;
                    // 使用requestAnimationFrame等待下一帧渲染
                    requestAnimationFrame(() => {
                        // 强制设置所有方块到最终位置y=1
                        for (const blockInfo of anim.blocks) {
                            const block = blockInfo.block;
                            block.position.set(blockInfo.x, blockInfo.targetY, blockInfo.z);
                            block.visible = true;
                        }
                        
                        anim.isAnimating = false;
                        anim.waitingForFrame = false;
                        // console.log(`LevelContent3D: Block growth animation completed for level ${levelKey}, all blocks moved to y=1`);
                        
                        // 方块动画完成后，等待0.5秒，然后启动相机移动到随机位置的动画
                        // 总时序：0-0.5秒等待，0.5-1.5秒block动画，1.5-2秒等待，2-3秒相机动画
                        setTimeout(() => {
                            this.startCameraMoveToRandomMazePosition(parseInt(levelKey));
                        }, 500); // 等待0.5秒
                    });
                }
            }
        }
    }
    
    // 启动相机移动到迷宫随机位置的动画
    startCameraMoveToRandomMazePosition(level) {
        const THREE = window.THREE;
        if (!THREE || !this.camera) {
            console.warn('LevelContent3D: Camera not available for move animation');
            return;
        }
        
        // 获取非障碍位置列表
        const emptyPositions = this.emptyPositions[level];
        if (!emptyPositions || emptyPositions.length === 0) {
            console.warn(`LevelContent3D: No empty positions available for level ${level}, cannot move camera`);
            return;
        }
        
        // Always spawn at position (0, 0) instead of random position
        const randomPos = { x: 0, z: 0 };
        
        // 获取模型，用于计算世界坐标
        const model = this.models[level];
        if (!model) {
            console.warn(`LevelContent3D: Model not found for level ${level}, cannot move camera`);
            return;
        }
        
        // 计算目标位置
        // 注意：emptyPositions 中的坐标是相对于模型中心的局部坐标
        // 需要转换为世界坐标
        const localPos = new THREE.Vector3(randomPos.x, 0, randomPos.z);
        model.updateMatrixWorld(true);
        localPos.applyMatrix4(model.matrixWorld);
        
        // 获取所有block的位置列表
        const blocks = this.mazeBlocks[level] || [];
        const blockPositions = blocks.map(block => ({
            x: block.position.x.toFixed(2),
            y: block.position.y.toFixed(2),
            z: block.position.z.toFixed(2)
        }));
        
        console.log(`LevelContent3D: All block positions for level ${level} (${blocks.length} blocks):`, blockPositions);
        
        // Note: Using fixed position (0, 0) for spawning
        
        // 验证世界坐标位置不会与方块重叠（更严格的检查）
        let isOverlapping = false;
        let closestBlockDistance = Infinity;
        let closestBlockPos = null;
        
        for (const block of blocks) {
            const blockPos = block.position;
            const distance = Math.sqrt(
                Math.pow(localPos.x - blockPos.x, 2) + 
                Math.pow(localPos.z - blockPos.z, 2)
            );
            
            if (distance < closestBlockDistance) {
                closestBlockDistance = distance;
                closestBlockPos = blockPos;
            }
            
            // 方块大小是1x1，所以距离小于0.6就认为重叠（留一些安全边距）
            if (distance < 0.6) {
                isOverlapping = true;
                console.warn(`LevelContent3D: Selected position (${localPos.x.toFixed(2)}, ${localPos.z.toFixed(2)}) is too close to a block at (${blockPos.x.toFixed(2)}, ${blockPos.y.toFixed(2)}, ${blockPos.z.toFixed(2)}), distance: ${distance.toFixed(2)}`);
            }
        }
        
        // 如果位置与block重叠，重新选择一个位置
        if (isOverlapping) {
            console.warn(`LevelContent3D: Selected position overlaps with a block, finding a new position...`);
            // 尝试找到距离所有block都足够远的位置
            let attempts = 0;
            let foundSafePosition = false;
            while (attempts < 10 && !foundSafePosition) {
                const newRandomPos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
                const newLocalPos = new THREE.Vector3(newRandomPos.x, 0, newRandomPos.z);
                newLocalPos.applyMatrix4(model.matrixWorld);
                
                let safe = true;
                for (const block of blocks) {
                    const blockPos = block.position;
                    const distance = Math.sqrt(
                        Math.pow(newLocalPos.x - blockPos.x, 2) + 
                        Math.pow(newLocalPos.z - blockPos.z, 2)
                    );
                    if (distance < 0.6) {
                        safe = false;
                        break;
                    }
                }
                
                if (safe) {
                    randomPos.x = newRandomPos.x;
                    randomPos.z = newRandomPos.z;
                    localPos.copy(newLocalPos);
                    foundSafePosition = true;
                    console.log(`LevelContent3D: Found safe position at (${localPos.x.toFixed(2)}, ${localPos.z.toFixed(2)}) after ${attempts + 1} attempts`);
                }
                attempts++;
            }
            
            if (!foundSafePosition) {
                console.error(`LevelContent3D: Could not find a safe position after ${attempts} attempts, using original position`);
            }
        }
        
        if (closestBlockPos) {
            console.log(`LevelContent3D: Closest block to selected position: (${closestBlockPos.x.toFixed(2)}, ${closestBlockPos.y.toFixed(2)}, ${closestBlockPos.z.toFixed(2)}), distance: ${closestBlockDistance.toFixed(2)}`);
        }
        
        // 相机高度设置为0.12（在地面上方）
        const cameraY = 0.12;
        const targetPos = new THREE.Vector3(
            localPos.x,
            cameraY,
            localPos.z
        );
        
        // 计算lookAt目标（x轴正方向，相对于模型）
        const localLookAt = new THREE.Vector3(randomPos.x + 5, 0, randomPos.z);
        localLookAt.applyMatrix4(model.matrixWorld);
        const lookAtTarget = new THREE.Vector3(
            localLookAt.x,
            cameraY,
            localLookAt.z
        );
        
        // 获取当前相机位置和目标
        const startPos = this.camera.position.clone();
        const startLookAt = this.controls ? this.controls.target.clone() : 
                           startPos.clone().add(new THREE.Vector3(0, 0, -5));
        
        console.log(`LevelContent3D: Starting camera move animation to fixed maze position (0, 0):`, {
            fixedLocalPos: { x: randomPos.x.toFixed(2), z: randomPos.z.toFixed(2) },
            worldPos: { x: localPos.x.toFixed(2), y: localPos.y.toFixed(2), z: localPos.z.toFixed(2) },
            targetPos: { x: targetPos.x.toFixed(2), y: targetPos.y.toFixed(2), z: targetPos.z.toFixed(2) },
            lookAtTarget: { x: lookAtTarget.x.toFixed(2), y: lookAtTarget.y.toFixed(2), z: lookAtTarget.z.toFixed(2) },
            startPos: { x: startPos.x.toFixed(2), y: startPos.y.toFixed(2), z: startPos.z.toFixed(2) },
            isOverlapping: isOverlapping,
            totalEmptyPositions: emptyPositions.length
        });
        
        this.cameraMoveToMazeAnimation = {
            isAnimating: true,
            completed: false,
            startTime: null, // 将在第一次update时设置，确保从第一次更新开始计时
            duration: 1000, // 1秒
            startPos: startPos,
            targetPos: targetPos,
            startLookAt: startLookAt,
            targetLookAt: lookAtTarget
        };
    }
    
    // 更新相机移动到迷宫位置的动画
    updateCameraMoveToMazeAnimation() {
        if (!this.cameraMoveToMazeAnimation || !this.cameraMoveToMazeAnimation.isAnimating) {
            return;
        }
        
        const THREE = window.THREE;
        if (!THREE || !this.camera) {
            console.warn('LevelContent3D: updateCameraMoveToMazeAnimation - THREE or camera not available');
            return;
        }
        
        const anim = this.cameraMoveToMazeAnimation;
        
        // 如果startTime还没有设置，现在设置它（确保从第一次update开始计时）
        // 同时重新获取当前相机位置，确保使用最新的相机位置作为起始位置
        if (anim.startTime === null) {
            anim.startTime = Date.now();
            // 重新获取当前相机位置和目标，确保与用户更改后的位置同步
            anim.startPos = this.camera.position.clone();
            if (this.controls) {
                anim.startLookAt = this.controls.target.clone();
            } else {
                // 如果没有controls，使用相机当前朝向计算lookAt
                const direction = new THREE.Vector3();
                this.camera.getWorldDirection(direction);
                anim.startLookAt = anim.startPos.clone().add(direction.multiplyScalar(5));
            }
            console.log(`LevelContent3D: Camera move animation started at ${anim.startTime}, startPos: (${anim.startPos.x.toFixed(2)}, ${anim.startPos.y.toFixed(2)}, ${anim.startPos.z.toFixed(2)})`);
        }
        
        const elapsed = Date.now() - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);
        
        // 使用easeInOut缓动
        const easedProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        // 插值位置
        const currentPos = anim.startPos.clone().lerp(anim.targetPos, easedProgress);
        
        // 记录更新前的相机位置（用于调试）
        const prevPos = this.camera.position.clone();
        
        // 更新相机位置
        this.camera.position.copy(currentPos);
        
        // 插值lookAt目标
        const currentLookAt = anim.startLookAt.clone().lerp(anim.targetLookAt, easedProgress);
        if (this.controls) {
            this.controls.target.copy(currentLookAt);
            this.controls.update();
        } else {
            this.camera.lookAt(currentLookAt);
        }
        
        // 计算lookAt方向向量
        const lookAtDirection = new THREE.Vector3();
        lookAtDirection.subVectors(currentLookAt, currentPos).normalize();
        
        // 检查位置是否真的更新了
        const posChanged = prevPos.distanceTo(currentPos) > 0.001;
        
        // 每10%进度输出一次日志（避免日志过多）
        const progressPercent = Math.floor(progress * 10);
        if (!this._lastCameraMoveProgressPercent) {
            this._lastCameraMoveProgressPercent = {};
        }
        const lastProgressPercent = this._lastCameraMoveProgressPercent[anim.startTime] || -1;
        
        if (progressPercent !== lastProgressPercent) {
            this._lastCameraMoveProgressPercent[anim.startTime] = progressPercent;
            console.log(`LevelContent3D: Camera update - position: (${currentPos.x.toFixed(3)}, ${currentPos.y.toFixed(3)}, ${currentPos.z.toFixed(3)}), lookAt: (${currentLookAt.x.toFixed(3)}, ${currentLookAt.y.toFixed(3)}, ${currentLookAt.z.toFixed(3)}), direction: (${lookAtDirection.x.toFixed(3)}, ${lookAtDirection.y.toFixed(3)}, ${lookAtDirection.z.toFixed(3)}), progress: ${(progress * 100).toFixed(1)}%, elapsed: ${elapsed}ms, posChanged: ${posChanged}`);
        }
        
        if (progress >= 1) {
            // 动画完成
            this.camera.position.copy(anim.targetPos);
            if (this.controls) {
                this.controls.target.copy(anim.targetLookAt);
                this.controls.update();
            } else {
                this.camera.lookAt(anim.targetLookAt);
            }
            
            anim.isAnimating = false;
            anim.completed = true;
            console.log(`LevelContent3D: Camera move animation completed, camera at (${anim.targetPos.x.toFixed(2)}, ${anim.targetPos.y.toFixed(2)}, ${anim.targetPos.z.toFixed(2)}), looking at x+ direction`);
        }
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
        
        // Always spawn at position (0, 0) instead of random position
        const randomPos = { x: 0, z: 0 };
        
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
                    
                    // If game is not over, immediately re-lock to prevent "Click to Start" screen
                    if (!window.gameOver) {
                        console.log('LevelContent3D: Game is active, re-locking pointer immediately');
                        setTimeout(() => {
                            if (this.player && this.player.controls && !this.player.controls.isLocked) {
                                this.player.controls.lock();
                            }
                        }, 10); // Small delay to allow unlock event to complete
                    }
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
            // ESC 键处理：Only works on game over screen
            if (event.key === 'Escape' || event.key === 'Esc') {
                // Only allow ESC to work when game is over
                if (window.gameOver) {
                    console.log(`LevelContent3D: ESC key pressed on game over screen`);
                    location.reload(); // Reload page to restart
                    event.preventDefault();
                    return;
                }
                // During active gameplay, do nothing
                console.log('LevelContent3D: ESC key pressed during gameplay - ignored');
                event.preventDefault();
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
        
        // 更新方块生长动画
        this.updateBlockGrowthAnimation();
        
        // 更新相机移动到迷宫位置的动画
        this.updateCameraMoveToMazeAnimation();
        
        if (this.player) {
            this.updatePlayer(deltaTime);
            this.updateCameraAnimation();
        }
    }
    
    // 添加全局ESC键监听（不依赖玩家是否创建）
    setupGlobalKeyboardControls() {
        // 如果已经有全局监听器，先移除
        if (this.globalKeydownHandler) {
            document.removeEventListener('keydown', this.globalKeydownHandler);
        }
        
        this.globalKeydownHandler = (event) => {
            // ESC 键处理：Only works on game over screen
            if (event.key === 'Escape' || event.key === 'Esc') {
                // Only allow ESC to work when game is over
                if (window.gameOver) {
                    console.log(`LevelContent3D: ESC key pressed on game over screen (global handler)`);
                    location.reload(); // Reload page to restart
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                // During active gameplay, do nothing
                console.log('LevelContent3D: ESC key pressed during gameplay (global handler) - ignored');
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        };
        
        document.addEventListener('keydown', this.globalKeydownHandler);
        console.log('LevelContent3D: Global keyboard controls set up (ESC key)');
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
// 使用立即执行函数确保在脚本加载时立即执行
(function() {
    if (typeof window !== 'undefined') {
        window.LevelContent3D = LevelContent3D;
        console.log('LevelContent3D.js: Class exported to window.LevelContent3D at', new Date().toISOString());
    } else {
        console.error('LevelContent3D.js: window is not defined, cannot export class');
    }
})();

