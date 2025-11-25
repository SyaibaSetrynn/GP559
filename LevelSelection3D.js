// LevelSelection3D.js - 3D关卡选择相关功能

class LevelSelection3D {
    constructor(container, width, height) {
        this.container = container;
        this.width = width;
        this.height = height;
        this.currentLevel = 1;
        
        // 模型相关
        this.currentModel = null;
        this.models = {}; // 缓存加载的模型
        this.modelGroups = {}; // 每个模型的组（包含模型和灯光）
        this.modelLights = {}; // 每个模型的灯光引用（用于动画）
        this.modelCenters = {}; // 每个模型的原始中心位置（用于位置计算）
        this.modelScales = {}; // 每个模型的当前scale（用于动画）
        this.modelBaseScales = {}; // 每个模型的基础scale（第一次加载时的scale）
        this.modelScaleAnimations = {}; // 每个模型的scale动画状态
        this.hoveredModel = null; // 当前hover的模型level
        this.mazeBlocks = {}; // 每个level的迷宫障碍物 { level: [blocks...] }
        this.inLevelMode = false; // 是否在关卡模式
        this.currentLevelModel = null; // 当前进入的关卡模型
        this.previousCameraPosition = null; // 进入关卡前的相机位置
        this.previousCameraTarget = null; // 进入关卡前的相机lookAt目标
        this.levelLight = null; // 关卡灯（用于照亮关卡）
        this.player = null; // 玩家实例
        this.playerVisualization = null; // player可视化正方体（用于调试）
        this.playerKeydownHandler = null; // 键盘按下事件处理器
        this.playerKeyupHandler = null; // 键盘释放事件处理器
        this.pointerLockClickHandler = null; // PointerLockControls点击锁定处理器
        this.pointerLockUnlockHandler = null; // PointerLockControls解锁处理器
        this.collisionWorld = null; // 碰撞检测世界（Octree）
        this.playerMovementLocked = false; // 玩家移动是否锁定
        this.cameraAnimationState = null; // 相机动画状态
        this.emptyPositions = {}; // 每个level的空闲位置 { level: [{x, z}, ...] }
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.threeCanvas = null;
        this.controls = null; // OrbitControls
        
        // 圆盘配置（在 initThree 中初始化）
        this.diskCenter = null;
        this.diskRadius = 8;
        this.diskRotation = 0; // 当前圆盘旋转角度（弧度）
        this.targetDiskRotation = 0; // 目标圆盘旋转角度（弧度）
        this.diskRotationAnimation = {
            isAnimating: false,
            startTime: 0,
            duration: 500, // 0.5秒
            startRotation: 0,
            targetRotation: 0
        };
        
        // 光照动画
        this.lightAnimations = {}; // { level: { targetIntensity, currentIntensity, isAnimating, startTime, duration } }
        
        // 等待 Three.js 加载完成
        this.initThree();
    }
    
    async initThree() {
        // 等待 Three.js 可用
        while (!window.THREE) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        const THREE = window.THREE;
        
        // 创建 Three.js 场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // 创建相机（透视相机，适合预览）
        const aspect = this.width / this.height;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        // 相机位置（上移2个单位）
        this.camera.position.set(0, 4, -4); // y从6改为4（下移2个单位）
        this.camera.lookAt(0, 1.5, 0); // 相机看向(0, 1.5, 0)，y从3.5改为1.5（下移2个单位）
        
        // 初始化圆盘中心 - 圆心是(0, 0, 8)，三个模型都在半径为8的圆上
        // level1在(0, 0, 0)，在圆上的角度0位置
        this.diskCenter = new THREE.Vector3(0, 0, 8);
        
        // 创建渲染器（使用新的 canvas，避免与 UI canvas 冲突）
        this.threeCanvas = document.createElement('canvas');
        this.threeCanvas.width = this.width;
        this.threeCanvas.height = this.height;
        this.threeCanvas.style.position = 'absolute';
        this.threeCanvas.style.top = '0';
        this.threeCanvas.style.left = '0';
        this.threeCanvas.style.zIndex = '1'; // 3D canvas 在 UI canvas 下方
        this.threeCanvas.style.pointerEvents = 'auto'; // 允许鼠标事件（用于模型交互）
        this.container.appendChild(this.threeCanvas);
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.threeCanvas,
            alpha: true,
            antialias: true 
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // 只添加基础环境光（很弱，避免影响独立光照）
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
        this.scene.add(ambientLight);
        
        // 初始化 OrbitControls
        this.initOrbitControls();
        
        console.log('Three.js scene initialized');

        // Initialize Critical Point System (if available)
        if (typeof window.CriticalPointSystem !== 'undefined') {
            this.criticalPointSystem = new window.CriticalPointSystem(this.scene);
            this.criticalPointsEnabled = false;
        } else {
            this.criticalPointSystem = null;
            this.criticalPointsEnabled = false;
        } 
        
        // 设置鼠标事件
        this.setupMouseEvents();
        
        // 初始化时加载当前level及其相邻的level
        this.updateVisibleLevels();
    }
    
    // 初始化 OrbitControls
    async initOrbitControls() {
        const THREE = window.THREE;
        if (!THREE) return;
        
        // 尝试动态导入 OrbitControls
        try {
            // 使用动态导入加载 OrbitControls
            const { OrbitControls } = await import('https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js');
            
            this.controls = new OrbitControls(this.camera, this.threeCanvas);
            
            // 设置控制参数
            this.controls.target.set(0, 1.5, 0); // 看向中心点（与相机 lookAt 一致）
            this.controls.enableDamping = true; // 启用阻尼效果，让旋转更平滑
            this.controls.dampingFactor = 0.05;
            this.controls.update(); // 应用初始设置
            
            console.log('OrbitControls initialized');
        } catch (error) {
            console.warn('Failed to load OrbitControls:', error);
            // 如果加载失败，不影响其他功能
        }
    }
    
    async loadModel(level) {
        // 如果 Three.js 还没加载完成，等待
        if (!window.THREE) {
            await this.initThree();
        }
        
        // 如果模型已加载，直接返回
        if (this.models[level]) {
            return;
        }
        
        try {
            const THREE = window.THREE;
            
            // 根据level确定地图大小
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
                console.error(`Unknown level: ${level}`);
                return;
            }
            
            console.log(`Generating map for level ${level}: ${mapWidth}x${mapDepth}`);
            
            // 动态导入 MapGenerator
            const { createFloor, createWalls } = await import('./MapGenerator.js');
            
            // 创建一个临时场景用于生成地图（不添加到主场景）
            const tempScene = new THREE.Scene();
            
            // 生成地板（会添加到tempScene，我们需要手动移除并添加到model group）
            const floor = createFloor(tempScene, mapWidth, mapDepth, 0.2);
            tempScene.remove(floor);
            
            // 生成围墙（会添加到tempScene，我们需要手动移除并添加到model group）
            // 围墙高度统一为2，无论地图大小如何
            const walls = createWalls(tempScene, mapWidth, mapDepth, 2);
            walls.forEach(wall => tempScene.remove(wall));
            
            // 将所有元素组合到一个Group中
            const model = new THREE.Group();
            model.add(floor);
            walls.forEach(wall => model.add(wall));
            
            // 计算模型边界框，用于居中
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // 保存原始中心（在缩放和旋转之前）
            this.modelCenters[level] = center.clone();
            
            // 居中模型（在原点）
            // 这意味着模型的中心现在在 (0,0,0)
            model.position.x = -center.x;
            model.position.y = -center.y;
            model.position.z = -center.z;
            
            // 沿 y 轴顺时针旋转 30 度（注意：Three.js 中顺时针是负值）
            model.rotation.y = -Math.PI / 6; // -30度 = -π/6 弧度
            
            // 计算缩放 - 根据level设置不同的目标高度，使模型从小到大有区别
            const maxDimension = Math.max(size.x, size.y, size.z);
            console.log(`Model size for level ${level}:`, size, `maxDimension:`, maxDimension);
            
            // level 0 (10x10) 最小，level 1 (14x14) 中等，level 2 (18x18) 最大
            let targetHeight;
            if (level === 0) {
                targetHeight = 1.5;  // 最小
            } else if (level === 1) {
                targetHeight = 2.0;  // 中等
            } else if (level === 2) {
                targetHeight = 2.5;  // 最大
            }
            
            const baseScale = targetHeight / maxDimension;
            model.scale.set(baseScale, baseScale, baseScale);
            
            // 保存基础scale和当前scale（用于scale动画）
            this.modelBaseScales[level] = baseScale;
            if (!this.modelScales[level]) {
                this.modelScales[level] = 1.0;
            }
            
            console.log(`Model scaled by ${baseScale}, final size:`, {
                x: size.x * baseScale,
                y: size.y * baseScale,
                z: size.z * baseScale
            });
            
            // 计算模型位置：围绕圆盘中心 (0, 0, 8) 排列
            // level1 在圆盘中心 (0, 0, 0)
            // level0 在右边（+30°），level2 在左边（-30°）
            let baseAngle;
            let radius;
            // 所有模型都在半径为8的圆上，圆盘中心在(0, 0, 8)
            // level1在(0, 0, 0)，对应角度0（正前方）
            // level0在角度+30°位置，level2在角度-30°位置
            radius = 8;  // 所有模型都在半径为8的圆上
            
            if (level === 0) {
                baseAngle = 30 * Math.PI / 180; // 右边30度
            } else if (level === 1) {
                baseAngle = 0; // 角度0（正前方，对应位置(0, 0, 0)）
            } else if (level === 2) {
                baseAngle = -30 * Math.PI / 180; // 左边30度
            }
            
            // 应用圆盘旋转
            const angle = baseAngle + this.diskRotation;
            
            // 围绕圆盘中心 (0, 0, 8) 排列，所有模型都在半径为8的圆上
            // level1在角度0位置，对应(0, 0, 0)
            const diskCenterX = this.diskCenter.x;  // 0
            const diskCenterY = this.diskCenter.y;  // 0
            const diskCenterZ = this.diskCenter.z;  // 8
            const x = diskCenterX + radius * Math.sin(angle);   // 角度 -30° 时 x < 0，+30° 时 x > 0
            const z = diskCenterZ - radius * Math.cos(angle);   // z = 8 - 8*cos(angle)
            const y = diskCenterY;  // y = 0
            
            // 将模型移动到目标位置
            // 注意：model.position 已经在前面被设置为 -center（居中），
            // 这意味着模型的中心现在在 (0,0,0)
            // 要将模型的中心移动到目标位置 (x, y, z)，我们需要：
            // 因为模型已经居中（position = -center），要移动到 (x, y, z)，
            // 应该设置 position = -center + (x, y, z) = (x - center.x, y - center.y, z - center.z)
            // 但实际上，由于模型已经在 group 中，且 group 在原点，我们直接设置目标位置即可
            model.position.set(x, y, z);
            
            // 调试信息：打印每个level的位置（仅在首次加载时打印）
            if (!this.models[level]) {
                console.log(`Level ${level} initial position:`, {
                    level: level,
                    mapSize: `${mapWidth}x${mapDepth}`,
                    baseAngle: (baseAngle * 180 / Math.PI).toFixed(1) + '°',
                    targetPosition: { x: x.toFixed(2), y: y.toFixed(2), z: z.toFixed(2) },
                    modelPosition: { x: model.position.x.toFixed(2), y: model.position.y.toFixed(2), z: model.position.z.toFixed(2) },
                    modelCenter: { x: center.x.toFixed(2), y: center.y.toFixed(2), z: center.z.toFixed(2) },
                    modelSize: { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) },
                    scale: baseScale.toFixed(3)
                });
            }
            
            // 创建模型组（包含模型和独立灯光系统）
            const modelGroup = new THREE.Group();
            // 确保 modelGroup 在原点
            modelGroup.position.set(0, 0, 0);
            modelGroup.add(model);
            
            // 为每个模型创建独立的灯光系统（使用Spotlight）
            // 初始亮度为0，将通过动画平滑增加
            // 主选（当前level）亮度24.0，次选（相邻level）亮度6.0（加强20%）
            const baseLightIntensity = (level === this.currentLevel) ? 24.0 : 6.0;
            const initialIntensity = 0; // 初始为0，等待动画
            
            // 使用Spotlight从上方照射模型
            // 位置抬高20%：从 y+10 改为 y+12
            // 亮度加强20%：在设置baseLightIntensity时已处理
            const spotlight = new THREE.SpotLight(0xffffff, initialIntensity);
            spotlight.position.set(x, y + 12, z);  // 抬高20% (10 * 1.2 = 12)
            spotlight.target.position.set(x, y, z);
            spotlight.angle = (Math.PI / 12) * 1.2; // 18度锥角（增大20%，从15度到18度）
            spotlight.penumbra = 0.3; // 边缘柔和度（减小，使边缘更硬）
            spotlight.decay = 2; // 衰减
            spotlight.distance = 20; // 照射距离
            modelGroup.add(spotlight);
            modelGroup.add(spotlight.target);
            
            // 保存灯光引用和基础强度
            this.modelLights[level] = {
                spotlight: spotlight,
                baseIntensity: baseLightIntensity
            };
            
            // 初始化模型scale为1.0
            this.modelScales[level] = 1.0;
            this.modelScaleAnimations[level] = {
                isAnimating: false,
                startTime: 0,
                duration: 200, // 0.2秒
                startScale: 1.0,
                targetScale: 1.0
            };
            
            // 缓存模型和组
            this.models[level] = model;
            this.modelGroups[level] = modelGroup;
            
            // 添加到场景
            this.scene.add(modelGroup);
            
            // 初始化光照动画（从0平滑增加到目标值）
            // 主选亮度24.0，次选亮度6.0（加强20%）
            const targetIntensity = (level === this.currentLevel) ? 24.0 : 6.0;
            this.startLightAnimation(level, targetIntensity, true);
            
            console.log(`Model for level ${level} processed and positioned at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
            console.log(`  - baseAngle: ${(baseAngle * 180 / Math.PI).toFixed(1)}°, radius: ${radius}, angle: ${(angle * 180 / Math.PI).toFixed(1)}°`);
            console.log(`  - model.position after setting: (${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)})`);
            
            // 如果启用了关键点系统，添加关键点
            if (this.criticalPointsEnabled && this.criticalPointSystem) {
                const CP_COLORS = window.CP_COLORS;
                if (CP_COLORS) {
                    this.criticalPointSystem.addCriticalPoints(model, 3, window.CP_COLORS.WHITE);
                }
            }
            
            // 立即渲染一次
            this.render();
        } catch (error) {
            console.error(`Failed to load model for level ${level}:`, error);
            // 如果加载失败，可以显示一个占位符或错误信息
        }
    }
    
    // 获取应该显示的level列表（始终显示所有三个模型）
    getVisibleLevels() {
        // 始终返回所有三个level，让所有模型都可见
        return [0, 1, 2];
    }
    
    // 更新可见的level，加载需要的，卸载不需要的
    async updateVisibleLevels() {
        const visibleLevels = this.getVisibleLevels(); // 现在返回 [0, 1, 2]
        const allLevels = [0, 1, 2];
        
        // 对于每个level，确保都被加载和显示
        for (const level of allLevels) {
            const shouldBeVisible = visibleLevels.includes(level);
            const isLoaded = this.models[level] !== undefined;
            const isInScene = this.modelGroups[level] && this.scene.children.includes(this.modelGroups[level]);
            
            if (shouldBeVisible && !isLoaded) {
                // 需要加载
                await this.loadModel(level);
            } else if (shouldBeVisible && isLoaded && !isInScene) {
                // 已加载但不在场景中，重新添加
                this.scene.add(this.modelGroups[level]);
                // 平滑增加光照：主选24.0，次选6.0（加强20%）
                const baseIntensity = (level === this.currentLevel) ? 24.0 : 6.0;
                this.startLightAnimation(level, baseIntensity, true);
            } else if (shouldBeVisible && isLoaded && isInScene) {
                // 已经在场景中，只需更新光照强度（当前选中的更亮）
                const baseIntensity = (level === this.currentLevel) ? 24.0 : 6.0;
                if (this.modelLights[level] && this.modelLights[level].baseIntensity !== baseIntensity) {
                    this.modelLights[level].baseIntensity = baseIntensity;
                    this.startLightAnimation(level, baseIntensity, true);
                }
            }
            // 不再卸载模型，因为现在所有模型都应该始终可见
        }
    }
    
    // 启动光照动画
    startLightAnimation(level, targetIntensity, fadeIn = true, onComplete = null) {
        if (!this.modelLights[level]) {
            return;
        }
        
        // 获取当前实际的亮度（避免突然归0）
        // 如果已经有动画在进行，使用当前动画的currentIntensity
        // 否则，从spotlight的实际强度计算当前强度
        let currentIntensity = 0;
        if (this.lightAnimations[level] && this.lightAnimations[level].isAnimating) {
            currentIntensity = this.lightAnimations[level].currentIntensity;
        } else {
            // 从spotlight的实际强度反推currentIntensity
            const spotlight = this.modelLights[level].spotlight;
            const baseIntensity = this.modelLights[level].baseIntensity;
            if (spotlight && baseIntensity > 0) {
                currentIntensity = spotlight.intensity / baseIntensity;
            } else {
                currentIntensity = 0;
            }
        }
        
        this.lightAnimations[level] = {
            targetIntensity: targetIntensity,
            currentIntensity: currentIntensity,
            isAnimating: true,
            startTime: Date.now(),
            duration: 500, // 0.5秒
            fadeIn: fadeIn,
            onComplete: onComplete
        };
    }
    
    // 更新光照动画
    updateLightAnimations() {
        const THREE = window.THREE;
        if (!THREE) return;
        
        for (const level in this.lightAnimations) {
            const anim = this.lightAnimations[level];
            if (!anim.isAnimating || !this.modelLights[level]) continue;
            
            const elapsed = Date.now() - anim.startTime;
            const progress = Math.min(elapsed / anim.duration, 1);
            
            // 使用easeInOut缓动
            const easedProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // 插值到目标强度
            const startIntensity = anim.currentIntensity;
            anim.currentIntensity = startIntensity + (anim.targetIntensity - startIntensity) * easedProgress;
            
            // 更新所有灯光
            const lights = this.modelLights[level];
            const baseIntensity = lights.baseIntensity;
            const currentMultiplier = anim.currentIntensity;
            
            lights.spotlight.intensity = baseIntensity * currentMultiplier;
            
            if (progress >= 1) {
                anim.isAnimating = false;
                anim.currentIntensity = anim.targetIntensity;
                
                // 调用完成回调
                if (anim.onComplete) {
                    anim.onComplete();
                    anim.onComplete = null;
                }
            }
        }
    }
    
    showModel(level) {
        // 保留用于兼容性
        this.currentLevel = level;
    }
    
    updateLevel(level) {
        console.log(`updateLevel called: level=${level}, currentLevel=${this.currentLevel}, diskRotation=${(this.diskRotation * 180 / Math.PI).toFixed(1)}°`);
        
        if (level !== this.currentLevel) {
            // 计算圆盘旋转角度差
            // 每个level相差30度，从level1切换到level2需要逆时针旋转-30度（让level2到中心）
            const angleDiff = (level - this.currentLevel) * 30 * Math.PI / 180; // 每个level相差30度
            
            console.log(`Angle diff: ${(angleDiff * 180 / Math.PI).toFixed(1)}°, Current diskRotation: ${(this.diskRotation * 180 / Math.PI).toFixed(1)}°`);
            
            // 启动平滑旋转动画
            // 目标旋转 = 当前旋转 + 角度差（反向旋转）
            const targetRotation = this.diskRotation + angleDiff;
            console.log(`Target rotation: ${(targetRotation * 180 / Math.PI).toFixed(1)}°`);
            
            this.startDiskRotationAnimation(targetRotation);
            
            const oldLevel = this.currentLevel;
            this.currentLevel = level;
            
            console.log(`Starting rotation animation from ${(this.diskRotation * 180 / Math.PI).toFixed(1)}° to ${(targetRotation * 180 / Math.PI).toFixed(1)}°`);
            
            // 更新可见的level
            this.updateVisibleLevels();
            
            // 更新亮度：新的当前level应该是1.0，旧的当前level应该是0.5（如果还在可见列表中）
            const visibleLevels = this.getVisibleLevels();
            
            // 更新新当前level的亮度到24.0（主选，加强20%）
            if (this.modelLights[level] && visibleLevels.includes(level)) {
                this.modelLights[level].baseIntensity = 24.0;
                this.startLightAnimation(level, 24.0, true);
            }
            
            // 更新旧当前level的亮度到6.0（次选，加强20%，如果还在可见列表中）
            if (this.modelLights[oldLevel] && visibleLevels.includes(oldLevel) && oldLevel !== level) {
                this.modelLights[oldLevel].baseIntensity = 6.0;
                this.startLightAnimation(oldLevel, 6.0, true);
            }
            
            // 更新相邻level的亮度到6.0（次选，加强20%）
            for (const visibleLevel of visibleLevels) {
                if (visibleLevel !== level && this.modelLights[visibleLevel]) {
                    this.modelLights[visibleLevel].baseIntensity = 6.0;
                    this.startLightAnimation(visibleLevel, 6.0, true);
                }
            }
        }
    }

    // Toggle critical points on/off
    toggleCriticalPoints(enabled) {
        this.criticalPointsEnabled = enabled;
        
        if (!this.criticalPointSystem) return;
        
        if (enabled) {
            // Add critical points to all loaded models
            Object.values(this.models).forEach(model => {
                const CP_COLORS = window.CP_COLORS;
                this.criticalPointSystem.addCriticalPoints(model, 3, window.CP_COLORS.WHITE);
            });
        } else {
            // Remove all critical points
            this.criticalPointSystem.clearAllCriticalPoints();
        }
    }
    
    // 启动圆盘旋转动画
    startDiskRotationAnimation(targetRotation) {
        this.targetDiskRotation = targetRotation;
        this.diskRotationAnimation.startRotation = this.diskRotation;
        this.diskRotationAnimation.targetRotation = targetRotation;
        this.diskRotationAnimation.startTime = Date.now();
        this.diskRotationAnimation.isAnimating = true;
        
        console.log(`Disk rotation animation started:`, {
            startRotation: (this.diskRotationAnimation.startRotation * 180 / Math.PI).toFixed(1) + '°',
            targetRotation: (this.diskRotationAnimation.targetRotation * 180 / Math.PI).toFixed(1) + '°',
            isAnimating: this.diskRotationAnimation.isAnimating
        });
    }
    
    // 更新圆盘旋转动画
    updateDiskRotationAnimation() {
        if (!this.diskRotationAnimation.isAnimating) {
            return;
        }
        
        const elapsed = Date.now() - this.diskRotationAnimation.startTime;
        const progress = Math.min(elapsed / this.diskRotationAnimation.duration, 1);
        
        // 使用easeInOut缓动
        const easedProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        // 插值旋转角度
        const startRotation = this.diskRotationAnimation.startRotation;
        const targetRotation = this.diskRotationAnimation.targetRotation;
        const oldDiskRotation = this.diskRotation;
        this.diskRotation = startRotation + (targetRotation - startRotation) * easedProgress;
        
        // 更新所有模型位置（跟随 diskRotation 的变化）
        // 这是关键：每次 diskRotation 更新时，都要重新计算所有模型的位置
        // 模型位置依赖于 diskRotation，所以必须每次动画帧都更新
        // 只有在旋转角度确实变化时才更新（避免不必要的计算）
        if (Math.abs(this.diskRotation - oldDiskRotation) > 0.0001) {
            this.updateModelPositions();
        }
        
        if (progress >= 1) {
            this.diskRotation = targetRotation;
            this.diskRotationAnimation.isAnimating = false;
            // 动画结束后，确保位置更新到最终位置
            this.updateModelPositions();
            console.log(`Disk rotation animation completed. Final rotation: ${(this.diskRotation * 180 / Math.PI).toFixed(1)}°`);
        }
    }
    
    // 根据圆盘旋转角度更新所有模型的位置
    updateModelPositions() {
        if (!this.diskCenter) return;
        
        const THREE = window.THREE;
        if (!THREE) return;
        
        // 调试：记录函数调用
        if (this.diskRotationAnimation && this.diskRotationAnimation.isAnimating) {
            // 在动画过程中，每帧都会调用，只在前几次打印
            if (!this._updateModelPositionsCallCount) {
                this._updateModelPositionsCallCount = 0;
            }
            this._updateModelPositionsCallCount++;
            if (this._updateModelPositionsCallCount <= 3 || this._updateModelPositionsCallCount % 10 === 0) {
                console.log(`updateModelPositions called (count: ${this._updateModelPositionsCallCount}), diskRotation: ${(this.diskRotation * 180 / Math.PI).toFixed(1)}°`);
            }
        }
        
        for (const levelKey in this.models) {
            const level = parseInt(levelKey);  // 确保 level 是数字
            const model = this.models[level];
            if (!model) continue;
            
            // 获取模型组（包含模型和灯光）
            const modelGroup = this.modelGroups[level];
            if (!modelGroup) continue;
            
            // 计算位置：所有模型都在半径为8的圆上，圆盘中心在(0, 0, 8)
            // level1在(0, 0, 0)，对应角度0（正前方）
            let baseAngle;
            const radius = 8;  // 所有模型都在半径为8的圆上
            
            if (level === 0) {
                baseAngle = 30 * Math.PI / 180; // 右边30度
            } else if (level === 1) {
                baseAngle = 0; // 角度0（正前方，对应位置(0, 0, 0)）
            } else if (level === 2) {
                baseAngle = -30 * Math.PI / 180; // 左边30度
            }
            
            // 应用圆盘旋转
            const angle = baseAngle + this.diskRotation;
            
            // 围绕圆盘中心 (0, 0, 8) 排列，所有模型都在半径为8的圆上
            // level1在角度0位置，对应(0, 0, 0)
            const diskCenterX = this.diskCenter.x;  // 0
            const diskCenterY = this.diskCenter.y;  // 0
            const diskCenterZ = this.diskCenter.z;  // 8
            const x = diskCenterX + radius * Math.sin(angle);   // 角度 -30° 时 x < 0，+30° 时 x > 0
            const z = diskCenterZ - radius * Math.cos(angle);   // z = 8 - 8*cos(angle)
            const y = diskCenterY;  // y = 0
            
            // 将模型移动到目标位置
            // 重要：在 loadModel 时，model.position 被设置为 -center（居中），然后再加上初始位置 (x, y, z)
            // 但是在 updateModelPositions 中，我们需要重新计算位置，因为 diskRotation 已经改变
            // 
            // 模型在 modelGroup 中，modelGroup 在场景中的位置是 (0,0,0)
            // 所以 model.position 就是模型在世界坐标系中的位置（因为 group 在原点）
            // 
            // 但是，在初始化时，model.position 包含了 -center，这意味着模型的中心已经在 (0,0,0)
            // 然后在 loadModel 中，我们又设置了 model.position.set(x, y, z)，这意味着模型的中心在 (x, y, z)
            // 
            // 所以在 updateModelPositions 中，直接设置 model.position = (x, y, z)
            // 因为模型已经居中（在初始化时设置了 -center），现在直接设置目标位置即可
            const oldModelPos = { x: model.position.x, y: model.position.y, z: model.position.z };
            model.position.set(x, y, z);
            
            // 确保 modelGroup 的位置在原点
            if (modelGroup) {
                modelGroup.position.set(0, 0, 0);
                modelGroup.updateMatrixWorld(true);
            }
            
            // 更新模型的矩阵，确保位置变化立即生效
            model.updateMatrixWorld(true);
            
            // 调试：在动画过程中打印位置变化（限制频率避免日志过多）
            if (this.diskRotationAnimation && this.diskRotationAnimation.isAnimating) {
                const posChanged = Math.abs(oldModelPos.x - x) > 0.01 || Math.abs(oldModelPos.z - z) > 0.01;
                if (posChanged) {
                    console.log(`Level ${level} position updated:`, {
                        level: level,
                        diskRotation: (this.diskRotation * 180 / Math.PI).toFixed(1) + '°',
                        baseAngle: (baseAngle * 180 / Math.PI).toFixed(1) + '°',
                        finalAngle: (angle * 180 / Math.PI).toFixed(1) + '°',
                        oldPos: { x: oldModelPos.x.toFixed(2), y: oldModelPos.y.toFixed(2), z: oldModelPos.z.toFixed(2) },
                        newPos: { x: x.toFixed(2), y: y.toFixed(2), z: z.toFixed(2) },
                        actualPos: { x: model.position.x.toFixed(2), y: model.position.y.toFixed(2), z: model.position.z.toFixed(2) },
                        radius: radius.toFixed(2)
                    });
                }
            }
            
            // 更新灯光位置（确保跟随模型移动）
            if (this.modelLights[level] && this.modelLights[level].spotlight) {
                const spotlight = this.modelLights[level].spotlight;
                // 计算模型的实际世界位置
                const modelWorldX = x;
                const modelWorldY = y;
                const modelWorldZ = z;
                
                // 更新spotlight位置（在模型上方12单位，抬高20%）
                spotlight.position.set(modelWorldX, modelWorldY + 12, modelWorldZ);
                // 更新spotlight目标位置（指向模型中心）
                spotlight.target.position.set(modelWorldX, modelWorldY, modelWorldZ);
                // 需要更新spotlight的矩阵
                spotlight.target.updateMatrixWorld();
            }
            
            // 更新调试红球位置（跟随模型位置）
        }
    }
    
    // 设置鼠标事件监听
    setupMouseEvents() {
        if (!this.threeCanvas) return;
        
        const raycaster = new window.THREE.Raycaster();
        const mouse = new window.THREE.Vector2();
        
        // 鼠标移动事件
        this.threeCanvas.addEventListener('mousemove', (e) => {
            // 如果已经在关卡模式中，禁用hover
            if (this.inLevelMode) {
                // 清除hover状态
                if (this.hoveredModel !== null) {
                    const oldHovered = this.hoveredModel;
                    this.hoveredModel = null;
                    this.startScaleAnimation(oldHovered, 1.0); // 恢复原大小
                }
                return;
            }
            
            // 检查当前phase是否在1或10-15之间
            const currentPhase = (typeof StateManager !== 'undefined') ? StateManager.getPhase() : 0;
            if (currentPhase !== 1 && (currentPhase < 10 || currentPhase > 15)) {
                return; // 不在level selection或主界面，不响应hover
            }
            
            // 检查是否在暂停状态
            if (this.uiInstance && this.uiInstance.isPaused) {
                // 暂停状态下，不响应模型hover
                if (this.hoveredModel !== null) {
                    const oldHovered = this.hoveredModel;
                    this.hoveredModel = null;
                    this.startScaleAnimation(oldHovered, 1.0); // 恢复原大小
                }
                return;
            }
            
            const rect = this.threeCanvas.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            raycaster.setFromCamera(mouse, this.camera);
            
            // 检查与哪个模型相交
            let newHoveredModel = null;
            for (const level in this.models) {
                const model = this.models[level];
                if (!model || !this.modelGroups[level]) continue;
                
                const intersects = raycaster.intersectObject(model, true);
                if (intersects.length > 0) {
                    // 只响应主选模型（当前level）
                    if (parseInt(level) === this.currentLevel) {
                        newHoveredModel = parseInt(level);
                        break;
                    }
                }
            }
            
            // 更新hover状态
            if (newHoveredModel !== this.hoveredModel) {
                const oldHovered = this.hoveredModel;
                this.hoveredModel = newHoveredModel;
                
                // 更新scale动画
                if (oldHovered !== null) {
                    this.startScaleAnimation(oldHovered, 1.0); // 恢复原大小
                }
                if (this.hoveredModel !== null) {
                    this.startScaleAnimation(this.hoveredModel, 1.05); // hover放大
                }
            }
        });
        
        // 鼠标点击事件
        this.threeCanvas.addEventListener('click', (e) => {
            // 检查当前phase是否在1或10-15之间
            const currentPhase = (typeof StateManager !== 'undefined') ? StateManager.getPhase() : 0;
            if (currentPhase !== 1 && (currentPhase < 10 || currentPhase > 15)) {
                return; // 不在level selection或主界面，不响应点击
            }
            
            const rect = this.threeCanvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // Phase 1: Level Selection - 检查UI按钮点击
            if (currentPhase === 1) {
                // 检查是否点击了Back按钮（左上角）
                if (this.uiInstance && this.uiInstance.backButton) {
                    const backBtn = this.uiInstance.backButton;
                    if (clickX >= backBtn.x && clickX <= backBtn.x + backBtn.width &&
                        clickY >= backBtn.y && clickY <= backBtn.y + backBtn.height) {
                        // 触发Back按钮点击
                        if (typeof StateManager !== 'undefined') {
                            StateManager.setPhase(0);
                        }
                        return;
                    }
                }
                
                // 检查是否点击了左箭头按钮
                if (this.uiInstance && this.uiInstance.leftArrowButton) {
                    const leftBtn = this.uiInstance.leftArrowButton;
                    console.log('Checking left arrow button:', {
                        clickX, clickY,
                        buttonX: leftBtn.x,
                        buttonY: leftBtn.y,
                        buttonWidth: leftBtn.width,
                        buttonHeight: leftBtn.height,
                        inBounds: clickX >= leftBtn.x && clickX <= leftBtn.x + leftBtn.width &&
                                  clickY >= leftBtn.y && clickY <= leftBtn.y + leftBtn.height
                    });
                    
                    if (clickX >= leftBtn.x && clickX <= leftBtn.x + leftBtn.width &&
                        clickY >= leftBtn.y && clickY <= leftBtn.y + leftBtn.height) {
                        // 触发左箭头点击：同时更新 UI 的 level、文本动画和 3D 模型
                        console.log('Left arrow clicked!', {
                            currentUILevel: this.uiInstance.level,
                            current3DLevel: this.currentLevel,
                            animationAnimating: this.uiInstance.levelAnimation.isAnimating
                        });
                        
                        if (this.uiInstance && !this.uiInstance.levelAnimation.isAnimating) {
                            if (this.uiInstance.level > 0) {
                                // 更新 UI 的 level
                                this.uiInstance.level--;
                                console.log(`UI level changed to ${this.uiInstance.level}`);
                                
                                // 更新 UI 的 label 动画
                                this.uiInstance.updateLevelLabel();
                                
                                // 更新 3D 模型的 level（会触发旋转动画）
                                console.log(`Calling updateLevel(${this.uiInstance.level})`);
                                this.updateLevel(this.uiInstance.level);
                            } else {
                                console.log('Cannot go left: already at level 0');
                            }
                        } else {
                            console.log('Cannot go left: animation is animating or no UI instance');
                        }
                        return;
                    }
                }
                
                // 检查是否点击了右箭头按钮
                if (this.uiInstance && this.uiInstance.rightArrowButton) {
                    const rightBtn = this.uiInstance.rightArrowButton;
                    console.log('Checking right arrow button:', {
                        clickX, clickY,
                        buttonX: rightBtn.x,
                        buttonY: rightBtn.y,
                        buttonWidth: rightBtn.width,
                        buttonHeight: rightBtn.height,
                        inBounds: clickX >= rightBtn.x && clickX <= rightBtn.x + rightBtn.width &&
                                  clickY >= rightBtn.y && clickY <= rightBtn.y + rightBtn.height
                    });
                    
                    if (clickX >= rightBtn.x && clickX <= rightBtn.x + rightBtn.width &&
                        clickY >= rightBtn.y && clickY <= rightBtn.y + rightBtn.height) {
                        // 触发右箭头点击：同时更新 UI 的 level、文本动画和 3D 模型
                        console.log('Right arrow clicked!', {
                            currentUILevel: this.uiInstance.level,
                            current3DLevel: this.currentLevel,
                            animationAnimating: this.uiInstance.levelAnimation.isAnimating
                        });
                        
                        if (this.uiInstance && !this.uiInstance.levelAnimation.isAnimating) {
                            if (this.uiInstance.level < 2) {
                                // 更新 UI 的 level
                                this.uiInstance.level++;
                                console.log(`UI level changed to ${this.uiInstance.level}`);
                                
                                // 更新 UI 的 label 动画
                                this.uiInstance.updateLevelLabel();
                                
                                // 更新 3D 模型的 level（会触发旋转动画）
                                console.log(`Calling updateLevel(${this.uiInstance.level})`);
                                this.updateLevel(this.uiInstance.level);
                            } else {
                                console.log('Cannot go right: already at level 2');
                            }
                        } else {
                            console.log('Cannot go right: animation is animating or no UI instance');
                        }
                        return;
                    }
                }
                
                // 检查是否点击了Help按钮（右下角）
                if (this.uiInstance && this.uiInstance.helpButtonPhase1) {
                    const helpBtn = this.uiInstance.helpButtonPhase1;
                    if (clickX >= helpBtn.x && clickX <= helpBtn.x + helpBtn.width &&
                        clickY >= helpBtn.y && clickY <= helpBtn.y + helpBtn.height) {
                        // 触发Help按钮点击
                        if (typeof StateManager !== 'undefined') {
                            StateManager.setPhase(2);
                        }
                        return;
                    }
                }
                
                // 检查是否点击了Tutorial按钮（右下角）
                if (this.uiInstance && this.uiInstance.tutorialButtonPhase1) {
                    const tutorialBtn = this.uiInstance.tutorialButtonPhase1;
                    if (clickX >= tutorialBtn.x && clickX <= tutorialBtn.x + tutorialBtn.width &&
                        clickY >= tutorialBtn.y && clickY <= tutorialBtn.y + tutorialBtn.height) {
                        // 触发Tutorial按钮点击
                        if (typeof StateManager !== 'undefined') {
                            StateManager.setPhase(10);
                        }
                        return;
                    }
                }
            }
            
            // Phase 10-15: 主界面 - 检查暂停按钮
            if (currentPhase >= 10 && currentPhase <= 15) {
                // 检查是否点击了暂停按钮区域（右上角）
                // 暂停按钮位置：x = width - 60 - 40, y = 20 + 20, 宽度60, 高度60
                const pauseButtonX = this.width - 60 - 40;
                const pauseButtonY = 20 + 20;
                const pauseButtonWidth = 60;
                const pauseButtonHeight = 60;
                
                if (clickX >= pauseButtonX && clickX <= pauseButtonX + pauseButtonWidth &&
                    clickY >= pauseButtonY && clickY <= pauseButtonY + pauseButtonHeight) {
                    // 点击了暂停按钮区域，通知UI处理
                    if (this.uiInstance && !this.uiInstance.isPaused) {
                        this.uiInstance.handlePauseClick();
                    }
                    return;
                }
                
                // 检查是否在暂停状态
                if (this.uiInstance && this.uiInstance.isPaused) {
                    // 如果暂停，检查是否点击了Resume或Quit按钮
                    const resumeButton = this.uiInstance.resumeButton;
                    const quitButton = this.uiInstance.quitButton;
                    
                    // 检查Resume按钮（使用currentX作为实际位置）
                    if (clickX >= resumeButton.currentX && clickX <= resumeButton.currentX + resumeButton.width &&
                        clickY >= resumeButton.y && clickY <= resumeButton.y + resumeButton.height) {
                        this.uiInstance.handleResumeClick();
                        return;
                    }
                    
                    // 检查Quit按钮
                    if (clickX >= quitButton.currentX && clickX <= quitButton.currentX + quitButton.width &&
                        clickY >= quitButton.y && clickY <= quitButton.y + quitButton.height) {
                        this.uiInstance.handleQuitClick();
                        return;
                    }
                    
                    // 暂停状态下，不响应模型点击
                    return;
                }
            }
            
            // 处理模型点击（phase 1和phase 10-15都支持）
            // 如果已经在关卡模式中，禁用点击
            if (this.inLevelMode) {
                return; // 进入关卡后，不允许点击模型
            }
            
            mouse.x = (clickX / this.width) * 2 - 1;
            mouse.y = -(clickY / this.height) * 2 + 1;
            
            raycaster.setFromCamera(mouse, this.camera);
            
            // 检查点击了哪个模型
            for (const level in this.models) {
                const model = this.models[level];
                if (!model || !this.modelGroups[level]) continue;
                
                const intersects = raycaster.intersectObject(model, true);
                if (intersects.length > 0) {
                    // 只响应主选模型（当前level）
                    if (parseInt(level) === this.currentLevel) {
                        console.log(`Clicked model level ${level}, phase: ${currentPhase}`);
                        
                        // 点击动画：scale降到0.95
                        this.startScaleAnimation(parseInt(level), 0.95);
                        
                        // 延迟后恢复并跳转
                        setTimeout(() => {
                            this.startScaleAnimation(parseInt(level), 1.0);
                            
                            // 跳转到对应phase并进入关卡模式
                            if (typeof StateManager !== 'undefined') {
                                if (currentPhase === 1) {
                                    // Phase 1: Level Selection界面，点击模型进入关卡
                                    const clickedLevel = parseInt(level);
                                    this.enterLevel(clickedLevel);
                                    
                                    // 跳转到对应phase
                                    if (clickedLevel === 0) {
                                        StateManager.setPhase(10); // Tutorial
                                    } else if (clickedLevel === 1) {
                                        StateManager.setPhase(11); // Level 1
                                    } else if (clickedLevel === 2) {
                                        StateManager.setPhase(12); // Level 2
                                    }
                                } else if (currentPhase >= 10 && currentPhase <= 15) {
                                    // Phase 10-15: 主界面，点击模型进入关卡
                                    const clickedLevel = parseInt(level);
                                    this.enterLevel(clickedLevel);
                                    
                                    // 跳转到对应关卡
                                    if (clickedLevel === 1) {
                                        StateManager.setPhase(11);
                                    } else if (clickedLevel === 2) {
                                        StateManager.setPhase(12);
                                    }
                                }
                            }
                        }, 150);
                        break;
                    }
                }
            }
        });
        
        // 鼠标离开canvas
        this.threeCanvas.addEventListener('mouseleave', () => {
            if (this.hoveredModel !== null) {
                const oldHovered = this.hoveredModel;
                this.hoveredModel = null;
                this.startScaleAnimation(oldHovered, 1.0); // 恢复原大小
            }
        });
    }
    
    // 启动scale动画
    startScaleAnimation(level, targetScale) {
        if (!this.modelScales[level] || !this.modelGroups[level]) return;
        
        const anim = this.modelScaleAnimations[level];
        anim.startScale = this.modelScales[level];
        anim.targetScale = targetScale;
        anim.startTime = Date.now();
        anim.isAnimating = true;
    }
    
    // 更新scale动画
    updateScaleAnimations() {
        const THREE = window.THREE;
        if (!THREE) return;
        
        for (const level in this.modelScaleAnimations) {
            const anim = this.modelScaleAnimations[level];
            if (!anim.isAnimating || !this.modelGroups[level]) continue;
            
            const elapsed = Date.now() - anim.startTime;
            const progress = Math.min(elapsed / anim.duration, 1);
            
            // 使用easeInOut缓动
            const easedProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // 插值scale
            const startScale = anim.startScale;
            this.modelScales[level] = startScale + (anim.targetScale - startScale) * easedProgress;
            
            // 更新模型scale
            const model = this.models[level];
            if (model && this.modelBaseScales[level]) {
                const baseScale = this.modelBaseScales[level];
                const currentScale = this.modelScales[level] || 1.0;
                
                // 应用动画scale
                model.scale.set(
                    baseScale * currentScale,
                    baseScale * currentScale,
                    baseScale * currentScale
                );
            }
            
            if (progress >= 1) {
                this.modelScales[level] = anim.targetScale;
                anim.isAnimating = false;
            }
        }
    }
    
    // 进入关卡模式：隐藏其他模型，聚焦相机，生成迷宫
    async enterLevel(level) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        console.log(`Entering level ${level}`);
        
        // 保存进入关卡前的相机状态
        if (!this.inLevelMode) {
            this.previousCameraPosition = this.camera.position.clone();
            if (this.controls) {
                this.previousCameraTarget = this.controls.target.clone();
            } else {
                // 如果没有controls，计算lookAt目标
                const direction = new THREE.Vector3();
                this.camera.getWorldDirection(direction);
                this.previousCameraTarget = this.camera.position.clone().add(direction.multiplyScalar(5));
            }
        }
        
        // 隐藏其他模型
        for (const levelKey in this.modelGroups) {
            const modelLevel = parseInt(levelKey);
            if (modelLevel !== level) {
                const modelGroup = this.modelGroups[modelLevel];
                if (modelGroup) {
                    modelGroup.visible = false;
                }
            }
        }
        
        // 显示当前关卡模型
        const currentModelGroup = this.modelGroups[level];
        if (currentModelGroup) {
            currentModelGroup.visible = true;
            this.currentLevelModel = this.models[level];
        }
        
        // 聚焦相机到当前模型
        this.focusCameraOnModel(level);
        
        // 生成迷宫（清除旧的，重新生成）
        await this.generateMaze(level);
        
        // 添加关卡灯，位置和spotlight相同，用来照亮关卡
        this.addLevelLight(level);
        
        // 创建碰撞检测世界
        await this.setupCollisionWorld(level);
        
        // 创建玩家并放置在空闲位置
        await this.createPlayer(level);
        
        this.inLevelMode = true;
    }
    
    // 聚焦相机到模型
    focusCameraOnModel(level) {
        const model = this.models[level];
        if (!model) return;
        
        // 计算模型的边界框（考虑世界变换）
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // 计算相机位置：在模型上方和前方
        const maxSize = Math.max(size.x, size.y, size.z);
        const distance = maxSize * 1.5; // 距离模型1.5倍大小
        
        // 相机位置：在模型中心上方和前方
        const cameraPos = new THREE.Vector3(
            center.x,
            center.y + maxSize * 0.5,
            center.z + distance
        );
        
        this.camera.position.copy(cameraPos);
        
        // 更新controls的target
        if (this.controls) {
            this.controls.target.copy(center);
            this.controls.update();
        } else {
            this.camera.lookAt(center);
        }
    }
    
    // 添加关卡灯：位置和spotlight相同，用来照亮关卡
    addLevelLight(level) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        // 先移除旧的关卡灯（如果存在）
        if (this.levelLight) {
            this.scene.remove(this.levelLight);
            if (this.levelLightTarget) {
                this.scene.remove(this.levelLightTarget);
            }
            this.levelLight = null;
            this.levelLightTarget = null;
        }
        
        // 获取模型的世界位置（spotlight的位置）
        const model = this.models[level];
        if (!model) return;
        
        // 计算模型的世界位置（考虑模型组的变换）
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        
        // 关卡灯位置和spotlight相同：(x, y + 12, z)，其中(x, y, z)是模型中心
        const lightPosition = new THREE.Vector3(
            center.x,
            center.y + 12,
            center.z
        );
        
        // 创建Spotlight来照亮关卡
        const spotlight = new THREE.SpotLight(0xffffff, 1.0); // 强度1.0，用来照亮关卡
        spotlight.position.copy(lightPosition);
        
        // 创建目标对象，指向模型中心
        const target = new THREE.Object3D();
        target.position.copy(center);
        spotlight.target = target;
        
        // 设置spotlight参数（和模型选择时的spotlight类似，但角度更大以照亮整个关卡）
        spotlight.angle = Math.PI / 3; // 60度锥角（更大的角度以照亮整个关卡）
        spotlight.penumbra = 0.5; // 边缘柔和度
        spotlight.decay = 2; // 衰减
        spotlight.distance = 50; // 更大的照射距离以覆盖整个关卡
        
        // 添加到场景
        this.scene.add(spotlight);
        this.scene.add(target);
        
        // 保存引用
        this.levelLight = spotlight;
        this.levelLightTarget = target;
        
        console.log(`Added level light at position (${lightPosition.x.toFixed(2)}, ${lightPosition.y.toFixed(2)}, ${lightPosition.z.toFixed(2)})`);
    }
    
    // 设置碰撞检测世界（Octree）
    async setupCollisionWorld(level) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        // 动态导入Octree
        const { Octree } = await import('https://unpkg.com/three@0.165.0/examples/jsm/math/Octree.js');
        
        // 创建新的Octree
        this.collisionWorld = new Octree();
        
        // 获取当前关卡的模型
        const model = this.models[level];
        if (!model) return;
        
        // 将模型和所有障碍物添加到Octree
        model.updateMatrixWorld(true);
        model.traverse((child) => {
            if (child.isMesh) {
                child.updateWorldMatrix(true, false);
                this.collisionWorld.fromGraphNode(child);
            }
        });
        
        console.log('Collision world set up for level', level);
    }
    
    // 创建玩家并放置在空闲位置
    async createPlayer(level) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        // 先清除旧的player
        if (this.player) {
            this.scene.remove(this.player.object);
            this.player = null;
        }
        
        // Player类应该在全局作用域中可用（通过Player.js加载）
        // 注意：Player.js在模块级别执行了很多代码（为indextestsetrynn.html设计），
        // 但我们只需要Player类，不需要执行那些模块级代码
        // Player类会在Player.js模块加载时导出到window.Player
        
        // 等待Player.js模块加载完成
        let PlayerClass = null;
        let waitCount = 0;
        const maxWait = 200; // 最多等待10秒 (200 * 50ms)
        
        // 检查Player类是否已经可用
        // 注意：Player.js在模块级别执行了很多代码（为indextestsetrynn.html设计），
        // 包括appendChild等DOM操作，但我们只需要Player类
        while ((typeof window.Player === 'undefined' || window.Player === null) && 
               waitCount < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 50));
            waitCount++;
            // 每20次检查打印一次日志
            if (waitCount % 20 === 0) {
                console.log(`Waiting for Player class... (${waitCount * 50}ms)`);
            }
        }
        
        // 获取Player类（优先使用window.Player）
        // 注意：不要直接检查 Player 变量，因为它可能在模块作用域中不存在
        PlayerClass = window.Player || null;
        
        if (!PlayerClass) {
            console.error('Player class not found after waiting. Please ensure Player.js is loaded.');
            console.error('Current window.Player:', typeof window.Player, window.Player);
            console.error('Make sure Player.js is loaded before LevelSelection3D.js in the HTML file.');
            return;
        }
        
        // 验证PlayerClass确实是构造函数
        if (typeof PlayerClass !== 'function') {
            console.error('window.Player is not a function:', typeof PlayerClass, PlayerClass);
            return;
        }
        
        console.log('Player class successfully found and ready to use:', PlayerClass);
        
        // 获取空闲位置
        const emptyPositions = this.emptyPositions[level];
        if (!emptyPositions || emptyPositions.length === 0) {
            console.error(`No empty positions available for level ${level}`);
            return;
        }
        
        // 随机选择一个空闲位置
        const randomPos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
        
        // 计算模型的世界位置
        const model = this.models[level];
        if (!model) return;
        
        // 计算模型的世界变换
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const modelCenter = box.getCenter(new THREE.Vector3());
        
        // 计算player的实际世界位置
        // 简化方式：直接在模型坐标系中设置位置，然后应用世界变换
        const PLAYER_HEIGHT = 0.5;
        const startY = 10.0; // 初始高度，让player从上方掉落
        
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
        }
        
        // 简化：直接在模型坐标系中设置player位置
        // randomPos是迷宫网格坐标，需要转换为模型坐标系
        // 迷宫坐标从(1,1)开始，所以需要偏移
        const localX = randomPos.x;
        const localZ = randomPos.z;
        const localY = startY;
        
        // 创建一个局部位置向量
        const localPos = new THREE.Vector3(localX, localY, localZ);
        
        // 应用模型的世界变换矩阵（包括位置、旋转、缩放）
        localPos.applyMatrix4(model.matrixWorld);
        
        const playerWorldX = localPos.x;
        const playerWorldY = localPos.y;
        const playerWorldZ = localPos.z;
        
        // 创建player（使用Player类）
        // Player构造函数: (isFirstPerson, renderer, collisionWorld)
        if (!PlayerClass) {
            console.error('Player class still not available after all checks');
            return;
        }
        this.player = new PlayerClass(0, this.renderer, this.collisionWorld);
        
        // 初始化player的速度
        if (this.player.speedY === undefined) {
            this.player.speedY = 0;
        }
        
        // 设置player初始位置（在世界坐标系中）
        // Player的collider是一个Capsule，从start到end
        // 根据Player.js，collider初始化为从y=PLAYER_HEIGHT/2到y=PLAYER_HEIGHT*3/4
        // 所以collider的中心应该在y=playerWorldY，底部在y=playerWorldY - PLAYER_HEIGHT/2
        // 顶部在y=playerWorldY + PLAYER_HEIGHT/2
        
        // 设置collider位置
        // 根据Player.js，collider初始化为：
        // start: (0, PLAYER_HEIGHT/2, 0) = (0, 0.25, 0)
        // end: (0, PLAYER_HEIGHT - PLAYER_HEIGHT/4, 0) = (0, 0.375, 0)
        // 所以collider从y=0.25到y=0.375，高度是0.125
        // 为了让player站在地面上，collider底部应该在y=地面高度+0.25
        // 但为了简化，我们让collider底部在地面（y=0），顶部在y=PLAYER_HEIGHT*3/4=0.375
        // 实际上，应该让collider底部在地面，顶部在playerWorldY
        
        // 设置collider位置
        // 根据Player.js，collider初始化为从y=PLAYER_HEIGHT/2到y=PLAYER_HEIGHT*3/4
        // 但playerWorldY是从上方掉落的位置（y=10），collider应该从地面开始
        // 需要计算地面的实际世界坐标（模型的地面y值）
        // 模型中心是modelCenter，地面应该在模型底部
        // 使用之前已经计算的box
        const groundWorldY = box.min.y; // 模型的最低y值（地面）
        // 地板厚度是0.2，地板中心在y=thickness/2=0.1，所以地板上表面在y=0.2（相对于模型坐标系）
        // 地板上表面的世界坐标
        const floorSurfaceY = groundWorldY + 0.2;
        
        // 保存地板上表面y值，用于后续检查
        this.floorSurfaceY = floorSurfaceY;
        
        // 设置collider大小以匹配红色方块（0.012大小）
        // 红色方块大小：0.8 * 0.05 * 0.3 = 0.012
        const PLAYER_VISUAL_SIZE = 0.8 * 0.05 * 0.3; // 0.012
        const COLLIDER_RADIUS = PLAYER_VISUAL_SIZE / 2; // 0.006 (胶囊体半径是正方体边长的一半)
        const COLLIDER_HEIGHT = PLAYER_VISUAL_SIZE; // 0.012 (高度等于正方体边长)
        
        // 重新创建collider以匹配红色方块的大小
        // 动态导入Capsule类并创建新的collider
        try {
            const capsuleModule = await import("https://unpkg.com/three@0.165.0/examples/jsm/math/Capsule.js");
            const Capsule = capsuleModule.Capsule;
            // THREE已经在函数开始时声明了
            this.player.collider = new Capsule(
                new THREE.Vector3(playerWorldX, groundWorldY, playerWorldZ),
                new THREE.Vector3(playerWorldX, groundWorldY + COLLIDER_HEIGHT, playerWorldZ),
                COLLIDER_RADIUS
            );
            console.log('Collider resized to match red cube size:', COLLIDER_RADIUS, 'radius,', COLLIDER_HEIGHT, 'height');
        } catch (e) {
            console.warn('Failed to import Capsule, adjusting collider position only:', e);
            // 如果导入失败，至少调整位置和大小（通过设置start/end）
            // 但radius无法修改，所以只能调整位置
            this.player.collider.start.set(playerWorldX, groundWorldY, playerWorldZ);
            this.player.collider.end.set(playerWorldX, groundWorldY + COLLIDER_HEIGHT, playerWorldZ);
        }
        
        // 设置camera位置（在player头部，即collider顶部）
        this.player.camera.position.set(playerWorldX, this.player.collider.end.y, playerWorldZ);
        
        // player.mesh位置（在collider底部，根据Player.js的逻辑）
        const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
        this.player.mesh.position.set(center.x, this.player.collider.start.y, center.z);
        this.player.object.position.set(0, 0, 0); // object应该在(0,0,0)，mesh在object内的相对位置
        
        // 隐藏player的原始mesh（粉色方块），只使用我们创建的可视化方块
        // 因为Player类创建了一个粉色的mesh，而我们要用红色的可视化方块代替
        if (this.player && this.player.mesh) {
            this.player.mesh.visible = false;
            this.player.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.visible = false; // 隐藏原始粉色mesh
                }
            });
        }
        
        // object保留可见（包含camera等必要组件）
        this.player.object.visible = true;
        
        // 确保player camera可见（虽然camera不需要visible属性，但确保它存在）
        this.player.camera.visible = true;
        
        // 将player添加到场景
        if (!this.scene.children.includes(this.player.object)) {
            this.scene.add(this.player.object);
        }
        
        // 锁定移动
        this.playerMovementLocked = true;
        
        // 初始化player的onGround状态
        this.player.onGround = false;
        
        // 设置camera初始位置（使用关卡选择时的camera位置）
        // camera会在player落地后动画移动到player后方
        
        // 添加键盘事件监听器（如果Player.js中的事件监听器没有添加）
        // 检查函数是否存在
        if (typeof this.setupPlayerKeyboardControls === 'function') {
            this.setupPlayerKeyboardControls();
        } else {
            console.warn('setupPlayerKeyboardControls is not a function, setting up keyboard controls inline');
            // 直接内联设置键盘控制
            if (this.player) {
                // 移除旧的监听器（如果存在）
                if (this.playerKeydownHandler) {
                    document.removeEventListener('keydown', this.playerKeydownHandler);
                }
                if (this.playerKeyupHandler) {
                    document.removeEventListener('keyup', this.playerKeyupHandler);
                }
                
                // 添加键盘事件监听器
                this.playerKeydownHandler = (event) => {
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
                
                console.log('Player keyboard controls set up inline (WASD + Space)');
            }
        }
        
        console.log(`Player created at position (${playerWorldX.toFixed(2)}, ${playerWorldY.toFixed(2)}, ${playerWorldZ.toFixed(2)})`);
        console.log(`Player mesh visible: ${this.player.mesh.visible}, object visible: ${this.player.object.visible}`);
        console.log(`Player object in scene:`, this.scene.children.includes(this.player.object));
        console.log(`Player mesh position:`, this.player.mesh.position);
        console.log(`Player camera position:`, this.player.camera.position);
        console.log(`Player mesh children:`, this.player.mesh.children.length);
        
        // 创建一个明显的player可视化正方体（红色，大尺寸）
        this.createPlayerVisualization(playerWorldX, playerWorldY, playerWorldZ);
        
        // 设置PointerLockControls的点击锁定事件（用户点击canvas时锁定）
        if (this.player && this.player.controls) {
            // 移除旧的点击事件监听器（如果存在）
            if (this.pointerLockClickHandler) {
                this.renderer.domElement.removeEventListener('click', this.pointerLockClickHandler);
            }
            
            // 添加点击事件来锁定PointerLockControls
            this.pointerLockClickHandler = () => {
                if (this.player && this.player.controls && !this.player.controls.isLocked) {
                    this.player.controls.lock();
                    console.log('PointerLockControls locked via click');
                }
            };
            
            this.renderer.domElement.addEventListener('click', this.pointerLockClickHandler);
            
            // 添加解锁事件监听器
            if (!this.pointerLockUnlockHandler) {
                this.pointerLockUnlockHandler = () => {
                    console.log('PointerLockControls unlocked');
                };
                this.player.controls.addEventListener('unlock', this.pointerLockUnlockHandler);
            }
        }
    }
    
    // 创建player可视化正方体（用于调试和确保可见性）
    createPlayerVisualization(x, y, z) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        // 先清除旧的visualization
        if (this.playerVisualization) {
            this.scene.remove(this.playerVisualization);
        }
        
        // 创建一个小的红色正方体来代表player（缩小到原来的5%，然后再缩小到30%）
        const size = 0.8 * 0.05 * 0.3; // 原始5%再缩小到30% (0.04 * 0.3 = 0.012)
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xff0000, // 红色
            emissive: 0x660000, // 更明显的发光
            metalness: 0.3,
            roughness: 0.7
        });
        
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(x, y, z);
        cube.name = 'PlayerVisualization';
        
        // 添加边缘线框以便更明显
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        cube.add(wireframe);
        
        // 添加到场景
        this.scene.add(cube);
        this.playerVisualization = cube;
        
        console.log(`Player visualization cube created at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
    }
    
    // 同步更新player visualization位置
    updatePlayerVisualization(centerX, centerY, centerZ) {
        if (this.playerVisualization) {
            this.playerVisualization.position.set(centerX, centerY, centerZ);
        }
    }
    
    // 设置player键盘控制（WASD移动）
    setupPlayerKeyboardControls() {
        if (!this.player) return;
        
        // 移除旧的监听器（如果存在）
        if (this.playerKeydownHandler) {
            document.removeEventListener('keydown', this.playerKeydownHandler);
        }
        if (this.playerKeyupHandler) {
            document.removeEventListener('keyup', this.playerKeyupHandler);
        }
        
        // 添加键盘事件监听器
        this.playerKeydownHandler = (event) => {
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
                            this.player.speedY = 0.03; // PLAYER_JUMP_SPEED
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
        
        console.log('Player keyboard controls set up (WASD + Space)');
    }
    
    // 更新player（掉落和碰撞检测）
    updatePlayer(deltaTime) {
        if (!this.player || !this.collisionWorld) {
            return;
        }
        
        // 确保deltaTime有效
        if (!deltaTime || deltaTime <= 0) {
            deltaTime = 0.016; // 默认60fps
        }
        
        const PLAYER_HEIGHT = 0.5;
        const GRAVITY = 9.8; // 重力加速度（m/s²）
        const PLAYER_VISUAL_SIZE = 0.8 * 0.05 * 0.3;
        const COLLIDER_HEIGHT = PLAYER_VISUAL_SIZE;
        
        // 获取地板上表面y值（如果未设置则使用默认值）
        const floorSurfaceY = this.floorSurfaceY !== undefined ? this.floorSurfaceY : 0.2;
        
        // 初始化speedY（如果未初始化）
        if (this.player.speedY === undefined) {
            this.player.speedY = 0;
        }
        
        // 保存player的初始位置（用于重置）
        if (!this.playerInitialPosition) {
            const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
            this.playerInitialPosition = {
                x: center.x,
                y: center.y,
                z: center.z,
                groundY: this.player.collider.start.y
            };
        }
        
        // 首先检查y<地板上表面，如果是则固定y=地板上表面并停止重力（在所有更新之前）
        
        // 强制检查：无论任何情况，只要y<地板上表面就固定为地板上表面
        if (this.player.collider.start.y < floorSurfaceY || this.player.collider.end.y < floorSurfaceY) {
            console.log('Player y<floorSurface detected, fixing to y=floorSurface. Current y:', this.player.collider.start.y, this.player.collider.end.y, 'floorSurfaceY:', floorSurfaceY);
            this.player.collider.start.y = floorSurfaceY;
            this.player.collider.end.y = floorSurfaceY + COLLIDER_HEIGHT;
            this.player.speedY = 0;
            this.player.onGround = true;
            
            const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
            const halfHeight = PLAYER_HEIGHT / 2;
            this.player.mesh.position.set(center.x, center.y - halfHeight, center.z);
            this.player.camera.position.set(center.x, center.y + halfHeight, center.z);
            this.updatePlayerVisualization(center.x, center.y, center.z);
            
            // Player落地，启动camera动画（只启动一次）
            if (!this.cameraAnimationState || (!this.cameraAnimationState.isAnimating && !this.cameraAnimationState.completed)) {
                console.log('Player reached y=0, starting camera animation');
                this.startCameraAnimation();
            }
            return; // 如果y<0，直接返回，不执行后续的重力和碰撞检测
        }
        
        // 如果移动被锁定，只更新物理（掉落）
        if (this.playerMovementLocked) {
            // 检查player是否掉到y<地板上表面，如果是则固定y=地板上表面并停止重力
            if (this.player.collider.start.y < floorSurfaceY) {
                // 设置y=地板上表面，停止重力计算
                const PLAYER_VISUAL_SIZE = 0.8 * 0.05 * 0.3;
                const COLLIDER_HEIGHT = PLAYER_VISUAL_SIZE;
                this.player.collider.start.y = floorSurfaceY;
                this.player.collider.end.y = floorSurfaceY + COLLIDER_HEIGHT;
                this.player.speedY = 0;
                this.player.onGround = true;
                
                // 更新mesh和camera位置
                const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                const halfHeight = PLAYER_HEIGHT / 2;
                this.player.mesh.position.set(center.x, center.y - halfHeight, center.z);
                this.player.camera.position.set(center.x, center.y + halfHeight, center.z);
                
                // 同步更新visualization位置
                this.updatePlayerVisualization(center.x, center.y, center.z);
                
                // Player落地，启动camera动画（只启动一次）
                if (!this.cameraAnimationState || (!this.cameraAnimationState.isAnimating && !this.cameraAnimationState.completed)) {
                    console.log('Player reached y=0, starting camera animation');
                    this.startCameraAnimation();
                }
            } else if (!this.player.onGround) {
                // 只有当y>=地板上表面时才应用重力
                if (this.player.collider.start.y < floorSurfaceY) {
                    // 如果已经<地板上表面，不应用重力
                    return;
                }
                // 应用重力（重力加速度，单位/秒²）
                this.player.speedY -= GRAVITY * deltaTime;
                // 应用速度（位置变化 = 速度 * 时间）
                this.player.collider.start.y += this.player.speedY * deltaTime;
                this.player.collider.end.y += this.player.speedY * deltaTime;
                
                // 检查应用重力后是否<地板上表面，如果是则固定到地板上表面
                if (this.player.collider.start.y < floorSurfaceY) {
                    const PLAYER_VISUAL_SIZE = 0.8 * 0.05 * 0.3;
                    const COLLIDER_HEIGHT = PLAYER_VISUAL_SIZE;
                    this.player.collider.start.y = floorSurfaceY;
                    this.player.collider.end.y = floorSurfaceY + COLLIDER_HEIGHT;
                    this.player.speedY = 0;
                    this.player.onGround = true;
                }
                
                // 更新mesh和camera位置
                const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                const halfHeight = PLAYER_HEIGHT / 2;
                this.player.mesh.position.set(center.x, center.y - halfHeight, center.z);
                this.player.camera.position.set(center.x, center.y + halfHeight, center.z);
                
                // 同步更新visualization位置
                this.updatePlayerVisualization(center.x, center.y, center.z);
            }
            
            // 碰撞检测
            const result = this.collisionWorld.capsuleIntersect(this.player.collider);
            this.player.onGround = false;
            
            // 检查y<地板上表面，如果是则固定y=地板上表面并停止重力（优先于碰撞检测）
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
                
                // 同步更新visualization位置
                this.updatePlayerVisualization(center.x, center.y, center.z);
                
                // Player落地，启动camera动画（只启动一次）
                if (!this.cameraAnimationState || (!this.cameraAnimationState.isAnimating && !this.cameraAnimationState.completed)) {
                    console.log('Player reached y=0, starting camera animation');
                    this.startCameraAnimation();
                }
            } else if (result) {
                this.player.onGround = result.normal.y > 0.5;
                
                if (result.depth >= 1e-5) {
                    this.player.collider.translate(result.normal.multiplyScalar(result.depth));
                }
                
                if (this.player.onGround) {
                    this.player.speedY = 0;
                    
                    // Player落地，启动camera动画（只启动一次）
                    if (!this.cameraAnimationState || (!this.cameraAnimationState.isAnimating && !this.cameraAnimationState.completed)) {
                        console.log('Player landed, starting camera animation');
                        this.startCameraAnimation();
                    }
                }
                
                const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                const halfHeight = PLAYER_HEIGHT / 2;
                this.player.mesh.position.set(center.x, this.player.collider.start.y, center.z);
                this.player.camera.position.set(center.x, this.player.collider.end.y, center.z);
                
                // 同步更新visualization位置
                this.updatePlayerVisualization(center.x, center.y, center.z);
            } else {
                // 如果没有碰撞结果，至少更新visualization位置
                const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                this.updatePlayerVisualization(center.x, center.y, center.z);
            }
        } else {
            // 移动未锁定，正常更新player（调用player的update方法来处理移动和物理）
            // player.update()会处理移动输入、跳跃、碰撞等
            if (this.player && this.player.update && this.player.controls) {
                // 调用player的update方法，这会处理移动和物理
                // update方法内部会检查movement.w/a/s/d并调用controls.moveForward/moveRight
                this.player.update();
                
                // 检查y<地板上表面，如果是则固定y=地板上表面并停止重力（在player.update()之后检查）
                if (this.player.collider.start.y < floorSurfaceY || this.player.collider.end.y < floorSurfaceY) {
                    console.log('Player y<floorSurface after update(), fixing to y=floorSurface. Current y:', this.player.collider.start.y, this.player.collider.end.y, 'floorSurfaceY:', floorSurfaceY);
                    const PLAYER_VISUAL_SIZE = 0.8 * 0.05 * 0.3;
                    const COLLIDER_HEIGHT = PLAYER_VISUAL_SIZE;
                    this.player.collider.start.y = floorSurfaceY;
                    this.player.collider.end.y = floorSurfaceY + COLLIDER_HEIGHT;
                    this.player.speedY = 0;
                    this.player.onGround = true;
                    
                    // 更新mesh和camera位置
                    const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                    const PLAYER_HEIGHT = 0.5;
                    const halfHeight = PLAYER_HEIGHT / 2;
                    this.player.mesh.position.set(center.x, center.y - halfHeight, center.z);
                    this.player.camera.position.set(center.x, center.y + halfHeight, center.z);
                }
                
                // 同步更新visualization位置
                const center = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
                this.updatePlayerVisualization(center.x, center.y, center.z);
            } else if (this.player && !this.player.controls) {
                console.warn('Player controls not available, cannot move');
            }
        }
    }
    
    // 启动camera动画：从当前位置移动到player的第一人称视角
    startCameraAnimation() {
        if (!this.player) return;
        
        const THREE = window.THREE;
        if (!THREE) return;
        
        // 保存起始位置和目标位置
        const startPos = this.camera.position.clone();
        
        // 获取player的实际位置（使用collider的中心）
        const playerCenter = this.player.collider.start.clone().add(this.player.collider.end).multiplyScalar(0.5);
        const PLAYER_HEIGHT = 0.5;
        const halfHeight = PLAYER_HEIGHT / 2;
        
        // 获取player可视化方块的位置（这是我们要lookAt的目标）
        let visualizationPos = playerCenter.clone();
        if (this.playerVisualization) {
            visualizationPos = this.playerVisualization.position.clone();
        }
        
        // 获取player camera的方向（使用PointerLockControls的方向）
        let playerDirection = new THREE.Vector3(0, 0, -1); // 默认向前
        if (this.player && this.player.camera && this.player.controls) {
            try {
                // 使用player camera的getWorldDirection获取当前朝向
                this.player.camera.getWorldDirection(playerDirection);
                playerDirection.normalize();
            } catch (e) {
                playerDirection = new THREE.Vector3(0, 0, -1);
            }
        }
        
        // 目标位置：红方块上方1的位置
        const offsetHeight = 1.0;
        const targetPos = new THREE.Vector3(
            visualizationPos.x,
            visualizationPos.y + offsetHeight,
            visualizationPos.z
        );
        
        // lookAt方向：看向player的可视化方块
        const targetLookAt = visualizationPos.clone();
        
        // 启动动画
        this.cameraAnimationState = {
            isAnimating: true,
            completed: false,
            startTime: Date.now(),
            duration: 600, // 0.6秒
            startPos: startPos,
            targetPos: targetPos,
            startLookAt: this.controls ? this.controls.target.clone() : startPos.clone().add(new THREE.Vector3(0, 0, -5)),
            targetLookAt: targetLookAt
        };
        
        console.log('Camera animation started from', startPos, 'to', targetPos, 'looking at', targetLookAt);
    }
    
    // 更新camera动画
    updateCameraAnimation() {
        if (!this.cameraAnimationState || !this.cameraAnimationState.isAnimating) return;
        
        const elapsed = Date.now() - this.cameraAnimationState.startTime;
        const progress = Math.min(elapsed / this.cameraAnimationState.duration, 1);
        
        // 使用easeInOut缓动
        const easedProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        // 插值位置
        const startPos = this.cameraAnimationState.startPos;
        const targetPos = this.cameraAnimationState.targetPos;
        const currentPos = startPos.clone().lerp(targetPos, easedProgress);
        this.camera.position.copy(currentPos);
        
        // 插值lookAt目标
        if (this.controls) {
            const startLookAt = this.cameraAnimationState.startLookAt;
            const targetLookAt = this.cameraAnimationState.targetLookAt;
            const currentLookAt = startLookAt.clone().lerp(targetLookAt, easedProgress);
            this.controls.target.copy(currentLookAt);
            this.controls.update();
        } else {
            const startLookAt = this.cameraAnimationState.startLookAt;
            const targetLookAt = this.cameraAnimationState.targetLookAt;
            const currentLookAt = startLookAt.clone().lerp(targetLookAt, easedProgress);
            this.camera.lookAt(currentLookAt);
        }
        
        // 动画结束
        if (progress >= 1) {
            this.cameraAnimationState.isAnimating = false;
            this.cameraAnimationState.completed = true;
            
            // 动画结束后，解锁移动并设置键盘监听器
            this.playerMovementLocked = false;
            
            // 锁定PointerLockControls以启用鼠标视角控制
            if (this.player && this.player.controls) {
                try {
                    this.player.controls.lock();
                    console.log('PointerLockControls locked, mouse movement enabled');
                } catch (e) {
                    console.warn('Failed to lock PointerLockControls:', e);
                }
            }
            
            // 设置键盘事件监听器（如果还没有设置）
            // 检查函数是否存在，或者检查监听器是否已经设置
            if (!this.playerKeydownHandler) {
                if (typeof this.setupPlayerKeyboardControls === 'function') {
                    this.setupPlayerKeyboardControls();
                } else {
                    // 如果函数不存在且监听器还没有设置，直接内联设置
                    console.warn('setupPlayerKeyboardControls not found in updateCameraAnimation, setting up inline');
                    if (this.player) {
                        // 移除旧的监听器（如果存在）
                        if (this.playerKeydownHandler) {
                            document.removeEventListener('keydown', this.playerKeydownHandler);
                        }
                        if (this.playerKeyupHandler) {
                            document.removeEventListener('keyup', this.playerKeyupHandler);
                        }
                        
                        // 添加键盘事件监听器
                        this.playerKeydownHandler = (event) => {
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
                        
                        console.log('Player keyboard controls set up inline in updateCameraAnimation (WASD + Space)');
                    }
                    }
                }
            
            // 动画完成后，camera应该使用player的camera（第一人称视角）
            // 但为了能看到player方块，我们使用关卡camera，位置在方块后方0.05，上方0.03
            // 这样可以从近距离看到player方块
            if (this.player && this.playerVisualization) {
                const visualizationPos = this.playerVisualization.position.clone();
                
                // 获取player camera的方向
                let playerDirection = new THREE.Vector3(0, 0, -1);
                if (this.player.camera && this.player.controls) {
                    try {
                        this.player.camera.getWorldDirection(playerDirection);
                        playerDirection.normalize();
                    } catch (e) {
                        playerDirection = new THREE.Vector3(0, 0, -1);
                    }
                }
                
                // 设置camera位置：红方块上方1的位置
                const offsetHeight = 1.0;
                this.camera.position.set(
                    visualizationPos.x,
                    visualizationPos.y + offsetHeight,
                    visualizationPos.z
                );
                
                // lookAt红方块
                this.camera.lookAt(visualizationPos);
                if (this.controls) {
                    this.controls.target.copy(visualizationPos);
                    this.controls.update();
                }
            }
            
            console.log('Camera animation completed, movement unlocked. Using player camera for first-person view.');
            console.log('Player position:', this.player ? this.player.camera.position : 'null');
        }
    }
    
    // 生成迷宫：使用递归回溯算法生成连通迷宫，50%空，50%墙
    async generateMaze(level) {
        const THREE = window.THREE;
        if (!THREE) return;
        
        // 清除旧的迷宫
        if (this.mazeBlocks[level]) {
            this.mazeBlocks[level].forEach(block => {
                if (block.parent) {
                    block.parent.remove(block);
                }
                // 清理资源
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
        const { createBlock } = await import('./MapGenerator.js');
        
        // 内部空间大小（排除围墙）
        const innerWidth = mapWidth - 2;  // x从1到mapWidth-2
        const innerDepth = mapDepth - 2;  // z从1到mapDepth-2
        const totalCells = innerWidth * innerDepth;
        const targetWallCount = Math.floor(totalCells * 0.5);  // 50%墙
        
        // 使用递归回溯算法生成连通迷宫
        const maze = this.generateConnectedMaze(innerWidth, innerDepth, targetWallCount);
        
        // 根据生成的迷宫放置障碍物
        const mazeBlocks = [];
        const model = this.models[level];
        if (!model) return;
        
        for (let x = 0; x < innerWidth; x++) {
            for (let z = 0; z < innerDepth; z++) {
                // maze[x][z] === 1 表示墙，0 表示空
                if (maze[x][z] === 1) {
                    // 将内部坐标转换为实际坐标（内部是0-based，实际是1-based）
                    const actualX = x + 1;
                    const actualZ = z + 1;
                    
                    // 创建一个临时场景来生成block，然后移除并添加到模型
                    const tempScene = new THREE.Scene();
                    const block = createBlock(tempScene, actualX, actualZ, 2);
                    tempScene.remove(block);
                    
                    // 将障碍添加到模型组中，这样它会跟随模型移动和缩放
                    model.add(block);
                    mazeBlocks.push(block);
                }
            }
        }
        
        this.mazeBlocks[level] = mazeBlocks;
        const wallCount = mazeBlocks.length;
        const emptyCount = totalCells - wallCount;
        
        // 保存空闲位置（用于放置player）
        const emptyPositions = [];
        for (let x = 0; x < innerWidth; x++) {
            for (let z = 0; z < innerDepth; z++) {
                if (maze[x][z] === 0) {
                    const actualX = x + 1;
                    const actualZ = z + 1;
                    emptyPositions.push({ x: actualX, z: actualZ });
                }
            }
        }
        this.emptyPositions[level] = emptyPositions;
        
        console.log(`Generated connected maze for level ${level} (${mapWidth}x${mapDepth}): ${wallCount} walls (${(wallCount/totalCells*100).toFixed(1)}%), ${emptyCount} empty (${(emptyCount/totalCells*100).toFixed(1)}%)`);
        console.log(`Saved ${emptyPositions.length} empty positions for player placement`);
    }
    
    // 使用递归回溯算法生成连通迷宫
    // 返回一个二维数组：1表示墙，0表示空（路径）
    // 保证所有空地都是连通的
    generateConnectedMaze(width, depth, targetWallCount) {
        // 初始化：全部设为墙（1）
        const maze = Array(width).fill(null).map(() => Array(depth).fill(1));
        const visited = Array(width).fill(null).map(() => Array(depth).fill(false));
        
        // 方向：上、右、下、左（相对于(x,z)坐标系）
        const directions = [
            { dx: 0, dz: -1 },  // 上（-z）
            { dx: 1, dz: 0 },   // 右（+x）
            { dx: 0, dz: 1 },   // 下（+z）
            { dx: -1, dz: 0 }   // 左（-x）
        ];
        
        // 从随机起点开始生成路径
        const startX = Math.floor(Math.random() * width);
        const startZ = Math.floor(Math.random() * depth);
        
        // 递归回溯算法生成路径
        const stack = [[startX, startZ]];
        let pathCells = 0;
        
        // 先将起点设为空地
        maze[startX][startZ] = 0;
        visited[startX][startZ] = true;
        pathCells++;
        
        while (stack.length > 0 && pathCells < (width * depth - targetWallCount)) {
            const [currentX, currentZ] = stack[stack.length - 1];
            
            // 获取未访问的相邻单元格
            const neighbors = [];
            for (const dir of directions) {
                const nextX = currentX + dir.dx * 2;  // 跳过中间的一格
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
                // 随机选择一个邻居
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                
                // 打通路径：当前->中间->邻居
                maze[next.midX][next.midZ] = 0;  // 中间格设为空
                maze[next.x][next.z] = 0;        // 邻居格设为空
                visited[next.x][next.z] = true;
                pathCells++;
                
                stack.push([next.x, next.z]);
            } else {
                // 没有未访问的邻居，回溯
                stack.pop();
            }
        }
        
        // 如果路径不够（还没达到目标空地数），继续从已访问的路径点扩展
        // 但这次只打通相邻的一格（不跳过）
        const allPathCells = [];
        for (let x = 0; x < width; x++) {
            for (let z = 0; z < depth; z++) {
                if (maze[x][z] === 0) {
                    allPathCells.push([x, z]);
                }
            }
        }
        
        // 从路径点随机扩展，直到达到目标空地数
        while (pathCells < (width * depth - targetWallCount) && allPathCells.length > 0) {
            const randomIndex = Math.floor(Math.random() * allPathCells.length);
            const [currentX, currentZ] = allPathCells[randomIndex];
            
            // 随机选择一个相邻的墙
            const shuffledDirs = [...directions].sort(() => Math.random() - 0.5);
            let expanded = false;
            
            for (const dir of shuffledDirs) {
                const nextX = currentX + dir.dx;
                const nextZ = currentZ + dir.dz;
                
                if (nextX >= 0 && nextX < width && 
                    nextZ >= 0 && nextZ < depth && 
                    maze[nextX][nextZ] === 1) {  // 如果是墙
                    maze[nextX][nextZ] = 0;  // 打通
                    allPathCells.push([nextX, nextZ]);
                    pathCells++;
                    expanded = true;
                    break;
                }
            }
            
            if (!expanded) {
                // 这个点无法扩展了，移除
                allPathCells.splice(randomIndex, 1);
            }
        }
        
        return maze;
    }
    
    // 退出关卡模式：恢复所有模型显示，恢复相机位置，清除迷宫障碍物
    exitLevel() {
        // 清除所有关卡的迷宫障碍物（无论是否在关卡模式中，都清除以确保重置）
        for (const levelKey in this.mazeBlocks) {
            const level = parseInt(levelKey);
            const blocks = this.mazeBlocks[level];
            if (blocks && blocks.length > 0) {
                blocks.forEach(block => {
                    // 从模型组中移除障碍物
                    if (block.parent) {
                        block.parent.remove(block);
                    }
                    // 清理资源
                    if (block.geometry) block.geometry.dispose();
                    if (block.material) {
                        if (Array.isArray(block.material)) {
                            block.material.forEach(m => m.dispose());
                        } else {
                            block.material.dispose();
                        }
                    }
                });
                // 清空数组
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
            console.log('Removed level light');
        }
        
        // 清除player
        if (this.player) {
            this.scene.remove(this.player.object);
            this.player = null;
        }
        
        // 清除player visualization和调试方块
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
        
        // 如果不在关卡模式中，直接返回（避免重复操作）
        if (!this.inLevelMode) {
            console.log('Exited level mode (was not in level mode), cleared all maze blocks');
            return;
        }
        
        // 显示所有模型
        for (const levelKey in this.modelGroups) {
            const modelGroup = this.modelGroups[levelKey];
            if (modelGroup) {
                modelGroup.visible = true;
            }
        }
        
        // 重置相机位置到初始状态（而不是恢复到进入关卡前的位置）
        // 这样可以确保退出后再进入时相机位置正确
        this.camera.position.set(0, 4, -4); // 初始相机位置
            if (this.controls) {
            this.controls.target.set(0, 1.5, 0); // 初始目标位置
                this.controls.update();
            } else {
            this.camera.lookAt(0, 1.5, 0);
        }
        
        // 清除保存的相机位置，以便下次进入时重新保存
        this.previousCameraPosition = null;
        this.previousCameraTarget = null;
        
        this.inLevelMode = false;
        this.currentLevelModel = null;
        
        console.log('Exited level mode, cleared all maze blocks and reset camera position');
    }
    
    render() {
        if (this.renderer && this.scene && this.camera) {
            // 如果不在关卡模式，更新圆盘旋转动画
            if (!this.inLevelMode) {
                // 更新圆盘旋转动画（这个函数内部会在动画进行时调用 updateModelPositions）
                this.updateDiskRotationAnimation();
                
                // 即使没有动画，也要确保模型位置是最新的
                // 这样可以确保在动画结束后或初始加载时位置正确
                // 注意：updateDiskRotationAnimation 在动画进行时已经调用了 updateModelPositions
                // 所以这里只需要在没有动画时更新一次即可
                if (!this.diskRotationAnimation.isAnimating) {
                    this.updateModelPositions();
                }
            }
            
            // 更新光照动画
            this.updateLightAnimations();
            
            // 更新scale动画
            this.updateScaleAnimations();
            
            // 在关卡模式下，更新player和camera动画
            if (this.inLevelMode) {
                // 计算deltaTime（使用时间戳）
                const currentTime = Date.now();
                if (!this.lastUpdateTime) {
                    this.lastUpdateTime = currentTime;
                }
                const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // 转换为秒
                this.lastUpdateTime = currentTime;
                
                // 更新player（掉落和碰撞）
                this.updatePlayer(deltaTime);
                
                // 更新camera动画
                this.updateCameraAnimation();
            } else {
                this.lastUpdateTime = null;
            }

            // Update critical points (if enabled)
            if (this.criticalPointSystem) {
                this.criticalPointSystem.updateCriticalPoints();
            }
            
            // 更新 OrbitControls（必须在渲染前调用）
            // 在关卡模式下且camera动画进行中时，不使用OrbitControls
            if (this.controls && (!this.inLevelMode || !this.cameraAnimationState || !this.cameraAnimationState.isAnimating)) {
                this.controls.update();
            }
            
            // 渲染场景
            // 在关卡模式下，根据camera动画状态选择使用哪个camera
            if (this.inLevelMode && this.player) {
                // 持续更新camera位置以跟随player方块（无论动画是否完成）
                if (this.playerVisualization) {
                    const visualizationPos = this.playerVisualization.position.clone();
                    
                    // 更新camera位置：红方块上方1的位置
                    const offsetHeight = 1.0;
                    this.camera.position.set(
                        visualizationPos.x,
                        visualizationPos.y + offsetHeight,
                        visualizationPos.z
                    );
                    
                    // lookAt红方块
                    this.camera.lookAt(visualizationPos);
                    if (this.controls) {
                        this.controls.target.copy(visualizationPos);
                        this.controls.update();
                    }
                }
                
                // 如果camera动画已完成，使用关卡camera（在红方块上方1的位置，lookAt红方块）
                if (this.cameraAnimationState && this.cameraAnimationState.completed) {
                    // camera位置在render循环中会持续更新以跟随player方块
                    this.renderer.render(this.scene, this.camera);
                } else {
                    // 动画进行中或还没开始，使用关卡camera
            this.renderer.render(this.scene, this.camera);
                }
            } else {
                // 不在关卡模式，使用关卡选择camera
                this.renderer.render(this.scene, this.camera);
            }
        }
    }
    
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    dispose() {
        // 清理资源
        if (this.renderer) {
            this.renderer.dispose();
        }
        // 清理模型
        Object.values(this.models).forEach(model => {
            model.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });
    }
}

// 暴露到全局以便其他脚本使用
if (typeof window !== 'undefined') {
    window.LevelSelection3D = LevelSelection3D;
}
