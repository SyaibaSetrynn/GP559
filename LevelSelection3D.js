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
        // 关卡内容管理（使用 LevelContent3D）
        this.levelContent = null; // LevelContent3D 实例
        this.lastPlayerCamY = null; // 用于调试：记录上一次 player.camera 的 y 坐标
        this.lastCameraY = null; // 用于调试：记录上一次关卡相机的 y 坐标
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
        
        // 初始化 LevelContent3D（在 Three.js 初始化后）
        this.initLevelContent();
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
        
        // 初始化 LevelContent3D
        this.initLevelContent();
    }
    
    // 初始化 LevelContent3D
    async initLevelContent() {
        // 等待 LevelContent3D 类可用（最多等待5秒）
        let waitCount = 0;
        const maxWait = 100; // 最多等待5秒 (100 * 50ms)
        
        while (typeof window.LevelContent3D === 'undefined' && waitCount < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 50));
            waitCount++;
            if (waitCount % 20 === 0) {
                console.log(`Waiting for LevelContent3D... (${waitCount * 50}ms)`);
            }
        }
        
        if (typeof window.LevelContent3D === 'undefined') {
            console.error('LevelContent3D not found after waiting. Please ensure LevelContent3D.js is loaded before LevelSelection3D.js in the HTML file.');
            return;
        }
        
        // 确保 Three.js 和 controls 已经初始化
        if (!this.scene || !this.camera || !this.renderer) {
            console.warn('LevelContent3D: Scene, camera, or renderer not ready, retrying...');
            setTimeout(() => this.initLevelContent(), 100);
            return;
        }
        
        // 等待 controls 初始化（如果没有则使用 null）
        let controlsToUse = this.controls;
        if (!controlsToUse) {
            // 如果 controls 还没初始化，等待一下
            await new Promise(resolve => setTimeout(resolve, 100));
            controlsToUse = this.controls || null;
        }
        
        this.levelContent = new window.LevelContent3D(
            this.scene,
            this.camera,
            this.renderer,
            controlsToUse
        );
        
        // 设置模型引用
        this.levelContent.setModels(this.models, this.modelGroups);
        
        // 设置 UI 实例引用（用于暂停功能）
        if (this.uiInstance) {
            this.levelContent.setUIInstance(this.uiInstance);
        }
        
        console.log('LevelContent3D initialized successfully');
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
        
        // 使用 LevelContent3D 管理关卡内容
        if (this.levelContent) {
            await this.levelContent.enterLevel(level);
        } else {
            console.error('LevelContent3D not initialized');
        }
        
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
    
    // 以下方法已转移到 LevelContent3D.js:
    // addLevelLight, setupCollisionWorld, createPlayer, createPlayerVisualization, 
    // updatePlayerVisualization, setupPlayerKeyboardControls, updatePlayer,
    // startCameraAnimation, updateCameraAnimation, generateMaze, generateConnectedMaze
    
    // 保留 focusCameraOnModel 方法（关卡选择相关）
    
    // 注意：所有关卡内部构建相关的方法已转移到 LevelContent3D.js
    // 如需修改关卡内容，请编辑 LevelContent3D.js
    
    // ========== 以下方法已删除，请参考 LevelContent3D.js ==========
    // 删除的方法列表（这些方法已转移到 LevelContent3D.js）：
    // - setupCollisionWorld() 
    // - createPlayer() 
    // - createPlayerVisualization() 
    // - updatePlayerVisualization() 
    // - setupPlayerKeyboardControls() 
    // - updatePlayer() 
    // - startCameraAnimation() 
    // - updateCameraAnimation() 
    // - generateMaze() 
    // - generateConnectedMaze() 
    // - 旧的 exitLevel() 实现（保留接口，内部调用 LevelContent3D）
    // ============================================================
    // 退出关卡模式：恢复所有模型显示，恢复相机位置，清除迷宫障碍物
    exitLevel() {
        // 使用 LevelContent3D 清理关卡内容
        if (this.levelContent) {
            this.levelContent.exitLevel();
        }
        
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
        
        // 确保所有模型都可见（在 exitLevel 之后）
        // 由于 updateVisibleLevels 可能会在后续被调用，我们需要确保它不会隐藏模型
        // 所以这里我们显式地恢复所有模型的可见性
        for (const levelKey in this.modelGroups) {
            const modelGroup = this.modelGroups[levelKey];
            if (modelGroup) {
                modelGroup.visible = true;
            }
        }
        
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
            
            // 在关卡模式下，更新关卡内容
            if (this.inLevelMode && this.levelContent) {
                this.levelContent.update();
            }

            // Update critical points (if enabled)
            if (this.criticalPointSystem) {
                this.criticalPointSystem.updateCriticalPoints();
            }
            
            // 渲染场景
            // 在关卡模式下，根据camera动画状态选择使用哪个camera
            if (this.inLevelMode && this.levelContent) {
                const player = this.levelContent.getPlayer();
                const playerVisualization = this.levelContent.getPlayerVisualization();
                const cameraAnimationState = this.levelContent.getCameraAnimationState();
                
                // 检查 PointerLockControls 是否已锁定
                const isPointerLocked = player && player.controls && player.controls.isLocked;
                
                // 如果PointerLockControls已锁定，使用player.camera渲染（完全不更新关卡相机）
                if (isPointerLocked) {
                    // PointerLockControls已锁定，使用player.camera，不更新关卡相机
                    // 调试：打印 player.camera 位置
                    const playerCamPos = player.camera.position;
                    if (!this.lastPlayerCamY || Math.abs(this.lastPlayerCamY - playerCamPos.y) > 0.01) {
                        console.log(`[Player Camera] Y: ${playerCamPos.y.toFixed(4)} | Pos: (${playerCamPos.x.toFixed(3)}, ${playerCamPos.y.toFixed(3)}, ${playerCamPos.z.toFixed(3)})`);
                        this.lastPlayerCamY = playerCamPos.y;
                    }
                    this.renderer.render(this.scene, player.camera);
                } else {
                    // PointerLockControls未锁定时的逻辑
                    // 只在动画完成后且未锁定时更新关卡相机位置跟随player
                    // 注意：动画进行中时，由 updateCameraAnimation 处理，这里不更新
                    if (cameraAnimationState && cameraAnimationState.completed && !cameraAnimationState.isAnimating && player && playerVisualization) {
                        const visualizationPos = playerVisualization.position.clone();
                        const offsetHeight = 1.0;
                        
                        // 计算目标相机位置
                        const targetCameraPos = new THREE.Vector3(
                            visualizationPos.x,
                            visualizationPos.y + offsetHeight,
                            visualizationPos.z
                        );
                        
                        // 只在位置有明显变化时才更新（避免每帧都更新导致的闪动）
                        const currentCameraPos = this.camera.position;
                        const distanceThreshold = 0.1; // 10cm 阈值（进一步提高阈值，大幅减少更新频率）
                        
                        // 检查相机位置是否需要更新（特别是 y 坐标）
                        const needsPositionUpdate = currentCameraPos.distanceTo(targetCameraPos) > distanceThreshold;
                        
                        // 调试：每次检查都打印相机位置和 PlayerVis 位置（限制频率）
                        if (!this.lastCameraY || Math.abs(this.lastCameraY - currentCameraPos.y) > 0.05) {
                            console.log(`[Camera Check] Camera Y: ${currentCameraPos.y.toFixed(4)} | Target Y: ${targetCameraPos.y.toFixed(4)} | PlayerVis Y: ${visualizationPos.y.toFixed(4)} | Distance: ${currentCameraPos.distanceTo(targetCameraPos).toFixed(4)} | Update: ${needsPositionUpdate}`);
                            this.lastCameraY = currentCameraPos.y;
                        }
                        
                        // 检查 lookAt 目标是否需要更新
                        let needsLookAtUpdate = false;
                        if (this.controls) {
                            const currentTarget = this.controls.target;
                            const targetDistance = currentTarget.distanceTo(visualizationPos);
                            needsLookAtUpdate = targetDistance > distanceThreshold;
                        }
                        
                        // 只在需要时才更新（避免频繁更新导致闪动）
                        if (needsPositionUpdate || needsLookAtUpdate) {
                            // 调试：打印相机位置变化（特别是 y 坐标）
                            if (needsPositionUpdate) {
                                const oldY = this.camera.position.y;
                                const newY = targetCameraPos.y;
                                const yDelta = newY - oldY;
                                console.log(`[Camera UPDATE] Y: ${oldY.toFixed(4)} -> ${newY.toFixed(4)} (delta: ${yDelta.toFixed(4)}) | PlayerVis Y: ${visualizationPos.y.toFixed(4)} | Pos: (${this.camera.position.x.toFixed(2)}, ${oldY.toFixed(2)}, ${this.camera.position.z.toFixed(2)}) -> (${targetCameraPos.x.toFixed(2)}, ${newY.toFixed(2)}, ${targetCameraPos.z.toFixed(2)})`);
                                this.camera.position.copy(targetCameraPos);
                                this.lastCameraY = newY;
                            }
                            // 只在需要时更新 lookAt（避免重复调用）
                            if (needsLookAtUpdate || needsPositionUpdate) {
                                if (this.controls) {
                                    this.controls.target.copy(visualizationPos);
                                } else {
                                    this.camera.lookAt(visualizationPos);
                                }
                            }
                        }
                    }
                    
                    // 更新 OrbitControls（仅在动画未进行时，且只更新一次）
                    if (this.controls && (!cameraAnimationState || !cameraAnimationState.isAnimating)) {
                        this.controls.update();
                    }
                    
                    // 使用关卡camera渲染
                    this.renderer.render(this.scene, this.camera);
                }
            } else {
                // 不在关卡模式，更新 OrbitControls 并使用关卡选择camera
                if (this.controls) {
                    this.controls.update();
                }
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
