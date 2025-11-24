// LevelSelection3D.js - 3D关卡选择相关功能

// @ts-ignore - URL import is handled by importmap in HTML
import { createFloor, createWalls } from './MapGenerator.js';

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
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.threeCanvas = null;
        
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
        // 相机位置
        this.camera.position.set(0, 2, -4);
        this.camera.lookAt(0, -0.5, 0); // 相机看向(0, -0.5, 0)
        
        // 初始化圆盘中心 - 圆心是(0, 0, 8)
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
        
        console.log('Three.js scene initialized');

        // Initialize Critical Point System
        this.criticalPointSystem = new CriticalPointSystem(this.scene);
        this.criticalPointsEnabled = false; 
        
        // 设置鼠标事件
        this.setupMouseEvents();
        
        // 初始化时加载当前level及其相邻的level
        this.updateVisibleLevels();
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
                mapWidth = 6;
                mapDepth = 6;
            } else if (level === 1) {
                mapWidth = 10;
                mapDepth = 10;
            } else if (level === 2) {
                mapWidth = 14;
                mapDepth = 14;
            } else {
                console.error(`Unknown level: ${level}`);
                return;
            }
            

            console.log(`Loading model for level ${level}: ${objPath}`);

            if (this.criticalPointsEnabled && this.criticalPointSystem) {
                const CP_COLORS = window.CP_COLORS;
                this.criticalPointSystem.addCriticalPoints(model, 3, CP_COLORS.RED);
            }
            
            // 创建一个临时场景用于生成地图（不添加到主场景）
            const tempScene = new THREE.Scene();
            
            // 生成地板（会添加到tempScene，我们需要手动移除并添加到model group）
            const floor = createFloor(tempScene, mapWidth, mapDepth, 0.2);
            tempScene.remove(floor);
            
            // 生成围墙（会添加到tempScene，我们需要手动移除并添加到model group）
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
            model.position.x = -center.x;
            model.position.y = -center.y;
            model.position.z = -center.z;
            
            // 沿 y 轴顺时针旋转 30 度（注意：Three.js 中顺时针是负值）
            model.rotation.y = -Math.PI / 6; // -30度 = -π/6 弧度
            
            // 计算缩放
            const maxDimension = Math.max(size.x, size.y, size.z);
            console.log(`Model size for level ${level}:`, size, `maxDimension:`, maxDimension);
            
            const targetHeight = 2.0;
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
            
            // 计算圆盘上的位置（考虑当前圆盘旋转）
            // 圆心是(0, 0, 8)，半径8
            // level1 在(0, 0, 0) - 从圆心向下（-z方向，角度0）
            // level0 在左边 30 度 - 从圆心向左下30度
            // level2 在右边 30 度 - 从圆心向右下30度
            // 在xz平面上，标准方向是-z（向下），左边是-x方向
            let baseAngle;
            if (level === 0) {
                baseAngle = -30 * Math.PI / 180; // 左边30度
            } else if (level === 1) {
                baseAngle = 0; // 中间（向下）
            } else if (level === 2) {
                baseAngle = 30 * Math.PI / 180; // 右边30度
            }
            
            // 应用圆盘旋转
            const angle = baseAngle + this.diskRotation;
            
            // 在xz平面上，从圆心出发，标准方向是-z（向下）
            // 角度0是-z方向，正角度是逆时针（向左），负角度是顺时针（向右）
            // 所以：x = -radius * sin(angle), z = center.z - radius * cos(angle)
            const x = this.diskCenter.x - this.diskRadius * Math.sin(angle);
            const z = this.diskCenter.z - this.diskRadius * Math.cos(angle);
            const y = this.diskCenter.y;
            
            // 将模型移动到圆盘上的位置
            // 注意：model.position 已经包含了 -center，所以直接加上目标位置即可
            model.position.x += x;
            model.position.y += y;
            model.position.z += z;
            
            // 创建模型组（包含模型和独立灯光系统）
            const modelGroup = new THREE.Group();
            modelGroup.add(model);
            
            // 为每个模型创建独立的灯光系统（使用Spotlight）
            // 初始亮度为0，将通过动画平滑增加
            // 主选（当前level）亮度20.0，次选（相邻level）亮度5.0
            const baseLightIntensity = (level === this.currentLevel) ? 20.0 : 5.0;
            const initialIntensity = 0; // 初始为0，等待动画
            
            // 使用Spotlight从上方照射模型
            const spotlight = new THREE.SpotLight(0xffffff, initialIntensity);
            spotlight.position.set(x, y + 10, z);
            spotlight.target.position.set(x, y, z);
            spotlight.angle = Math.PI / 12; // 15度锥角（收窄，只照到选中的object）
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
            // 主选亮度20.0，次选亮度5.0
            const targetIntensity = (level === this.currentLevel) ? 20.0 : 5.0;
            this.startLightAnimation(level, targetIntensity, true);
            
            console.log(`Model for level ${level} processed and positioned at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
            
            // 立即渲染一次
            this.render();
        } catch (error) {
            console.error(`Failed to load model for level ${level}:`, error);
            // 如果加载失败，可以显示一个占位符或错误信息
        }
    }
    
    
    // 获取应该显示的level列表（当前、上一个、下一个）
    getVisibleLevels() {
        const levels = [];
        if (this.currentLevel > 0) {
            levels.push(this.currentLevel - 1);
        }
        levels.push(this.currentLevel);
        if (this.currentLevel < 2) {
            levels.push(this.currentLevel + 1);
        }
        return levels;
    }
    
    // 更新可见的level，加载需要的，卸载不需要的
    async updateVisibleLevels() {
        const visibleLevels = this.getVisibleLevels();
        const allLevels = [0, 1, 2];
        
        // 对于每个level
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
                // 平滑增加光照：主选20.0，次选5.0
                const baseIntensity = (level === this.currentLevel) ? 20.0 : 5.0;
                this.startLightAnimation(level, baseIntensity, true);
            } else if (!shouldBeVisible && isInScene) {
                // 需要卸载，先平滑降低光照
                this.startLightAnimation(level, 0, false, () => {
                    // 光照降到0后，从场景中移除
                    if (this.modelGroups[level]) {
                        this.scene.remove(this.modelGroups[level]);
                    }
                });
            }
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
        if (level !== this.currentLevel) {
            // 计算圆盘旋转角度差
            const angleDiff = (level - this.currentLevel) * 30 * Math.PI / 180; // 每个level相差30度
            
            // 启动平滑旋转动画
            this.startDiskRotationAnimation(this.diskRotation - angleDiff);
            
            const oldLevel = this.currentLevel;
            this.currentLevel = level;
            
            // 更新可见的level
            this.updateVisibleLevels();
            
            // 更新亮度：新的当前level应该是1.0，旧的当前level应该是0.5（如果还在可见列表中）
            const visibleLevels = this.getVisibleLevels();
            
            // 更新新当前level的亮度到20.0（主选）
            if (this.modelLights[level] && visibleLevels.includes(level)) {
                this.modelLights[level].baseIntensity = 20.0;
                this.startLightAnimation(level, 20.0, true);
            }
            
            // 更新旧当前level的亮度到5.0（次选，如果还在可见列表中）
            if (this.modelLights[oldLevel] && visibleLevels.includes(oldLevel) && oldLevel !== level) {
                this.modelLights[oldLevel].baseIntensity = 5.0;
                this.startLightAnimation(oldLevel, 5.0, true);
            }
            
            // 更新相邻level的亮度到5.0（次选）
            for (const visibleLevel of visibleLevels) {
                if (visibleLevel !== level && this.modelLights[visibleLevel]) {
                    this.modelLights[visibleLevel].baseIntensity = 5.0;
                    this.startLightAnimation(visibleLevel, 5.0, true);
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
                this.criticalPointSystem.addCriticalPoints(model, 3, CP_COLORS.RED);
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
        this.diskRotation = startRotation + (targetRotation - startRotation) * easedProgress;
        
        // 更新所有模型位置
        this.updateModelPositions();
        
        if (progress >= 1) {
            this.diskRotation = targetRotation;
            this.diskRotationAnimation.isAnimating = false;
        }
    }
    
    // 根据圆盘旋转角度更新所有模型的位置
    updateModelPositions() {
        if (!this.diskCenter) return;
        
        const THREE = window.THREE;
        if (!THREE) return;
        
        for (const level in this.models) {
            const model = this.models[level];
            if (!model) continue;
            
            // 计算位置（所有level都在圆盘上，包括level1）
            let baseAngle;
            if (level == 0) {
                baseAngle = -30 * Math.PI / 180; // 左边30度
            } else if (level == 1) {
                baseAngle = 0; // 中间（向下）
            } else if (level == 2) {
                baseAngle = 30 * Math.PI / 180; // 右边30度
            }
            
            // 应用圆盘旋转
            const angle = baseAngle + this.diskRotation;
            
            // 在xz平面上，从圆心出发
            const x = this.diskCenter.x - this.diskRadius * Math.sin(angle);
            const z = this.diskCenter.z - this.diskRadius * Math.cos(angle);
            const y = this.diskCenter.y;
            
            // 获取模型的原始中心（在缩放和旋转之前保存的）
            const originalCenter = this.modelCenters[level];
            if (!originalCenter) continue;
            
            // 计算模型应该在世界坐标系中的位置
            // 模型已经居中（position = -center），现在需要移动到新位置
            // 新位置 = 目标位置 - 原始中心
            model.position.x = x - originalCenter.x;
            model.position.y = y - originalCenter.y;
            model.position.z = z - originalCenter.z;
            
            // 更新灯光位置（确保跟随模型移动）
            if (this.modelLights[level] && this.modelLights[level].spotlight) {
                const spotlight = this.modelLights[level].spotlight;
                // 计算模型的实际世界位置（考虑原始中心偏移）
                const modelWorldX = x;
                const modelWorldY = y;
                const modelWorldZ = z;
                
                // 更新spotlight位置（在模型上方10单位）
                spotlight.position.set(modelWorldX, modelWorldY + 10, modelWorldZ);
                // 更新spotlight目标位置（指向模型中心）
                spotlight.target.position.set(modelWorldX, modelWorldY, modelWorldZ);
                // 需要更新spotlight的矩阵
                spotlight.target.updateMatrixWorld();
            }
        }
    }
    
    // 设置鼠标事件监听
    setupMouseEvents() {
        if (!this.threeCanvas) return;
        
        const raycaster = new window.THREE.Raycaster();
        const mouse = new window.THREE.Vector2();
        
        // 鼠标移动事件
        this.threeCanvas.addEventListener('mousemove', (e) => {
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
                    if (clickX >= leftBtn.x && clickX <= leftBtn.x + leftBtn.width &&
                        clickY >= leftBtn.y && clickY <= leftBtn.y + leftBtn.height) {
                        // 触发左箭头点击
                        if (this.uiInstance && !this.uiInstance.levelAnimation.isAnimating) {
                            if (this.uiInstance.level > 0) {
                                this.uiInstance.level--;
                                this.uiInstance.updateLevelLabel();
                                this.updateLevel(this.uiInstance.level);
                            }
                        }
                        return;
                    }
                }
                
                // 检查是否点击了右箭头按钮
                if (this.uiInstance && this.uiInstance.rightArrowButton) {
                    const rightBtn = this.uiInstance.rightArrowButton;
                    if (clickX >= rightBtn.x && clickX <= rightBtn.x + rightBtn.width &&
                        clickY >= rightBtn.y && clickY <= rightBtn.y + rightBtn.height) {
                        // 触发右箭头点击
                        if (this.uiInstance && !this.uiInstance.levelAnimation.isAnimating) {
                            if (this.uiInstance.level < 2) {
                                this.uiInstance.level++;
                                this.uiInstance.updateLevelLabel();
                                this.updateLevel(this.uiInstance.level);
                            }
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
                            
                            // 跳转到对应phase
                            if (typeof StateManager !== 'undefined') {
                                if (currentPhase === 1) {
                                    // Phase 1: Level Selection界面，点击模型跳转到对应关卡
                                    if (parseInt(level) === 0) {
                                        StateManager.setPhase(10); // Tutorial
                                    } else if (parseInt(level) === 1) {
                                        StateManager.setPhase(11); // Level 1
                                    } else if (parseInt(level) === 2) {
                                        StateManager.setPhase(12); // Level 2
                                    }
                                } else if (currentPhase >= 10 && currentPhase <= 15) {
                                    // Phase 10-15: 主界面，点击模型跳转到对应关卡
                                    if (parseInt(level) === 1) {
                                        StateManager.setPhase(11);
                                    } else if (parseInt(level) === 2) {
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
    
    render() {
        if (this.renderer && this.scene && this.camera) {
            // 更新圆盘旋转动画
            this.updateDiskRotationAnimation();
            
            // 更新光照动画
            this.updateLightAnimations();
            
            // 更新scale动画
            this.updateScaleAnimations();

            // Update critical points (if enabled)
            if (this.criticalPointSystem) {
                this.criticalPointSystem.updateCriticalPoints();
}
            
            // 渲染场景
            this.renderer.render(this.scene, this.camera);
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
