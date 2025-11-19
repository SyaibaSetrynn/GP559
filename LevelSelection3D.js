// LevelSelection3D.js - 3D关卡选择相关功能

class LevelSelection3D {
    constructor(container, canvas) {
        this.container = container;
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        this.currentLevel = 1;
        
        // 模型相关
        this.currentModel = null;
        this.models = {}; // 缓存加载的模型
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.threeCanvas = null;
        
        // 等待 Three.js 加载完成
        this.initThree();
    }
    
    async initThree() {
        // 等待 Three.js 可用
        while (!window.THREE || !window.OBJLoader || !window.MTLLoader) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        const THREE = window.THREE;
        
        // 创建 Three.js 场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // 创建相机（透视相机，适合预览）
        const aspect = this.width / this.height;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 20, -50);
        this.camera.lookAt(0, 0, 0); // 相机看向原点
        
        // 创建渲染器（使用新的 canvas，避免与 UI canvas 冲突）
        this.threeCanvas = document.createElement('canvas');
        this.threeCanvas.width = this.width;
        this.threeCanvas.height = this.height;
        this.threeCanvas.style.position = 'absolute';
        this.threeCanvas.style.top = '0';
        this.threeCanvas.style.left = '0';
        this.threeCanvas.style.zIndex = '1'; // 3D canvas 在 UI canvas 下方
        this.threeCanvas.style.pointerEvents = 'none'; // 不拦截鼠标事件
        this.container.appendChild(this.threeCanvas);
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.threeCanvas,
            alpha: true,
            antialias: true 
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // 添加环境光（增强亮度）
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene.add(ambientLight);
        
        // 添加半球光（模拟天空和地面光照，类似 SkyDome）
        // 天空颜色（上方），地面颜色（下方），强度
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
        hemisphereLight.position.set(0, 1, 0); // 从上方照射
        this.scene.add(hemisphereLight);
        
        // 添加方向光作为补充（从侧面照射，增加立体感）
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);
        
        console.log('Three.js scene initialized with lights');
        
        // 加载 Level 1 模型
        this.loadModel(1).catch(error => {
            console.error('Failed to load initial model:', error);
        });
    }
    
    async loadModel(level) {
        // 如果 Three.js 还没加载完成，等待
        if (!window.THREE || !window.OBJLoader || !window.MTLLoader) {
            await this.initThree();
        }
        
        // 如果模型已加载，直接使用
        if (this.models[level]) {
            this.showModel(level);
            return;
        }
        
        try {
            const THREE = window.THREE;
            const OBJLoader = window.OBJLoader;
            const MTLLoader = window.MTLLoader;
            
            const modelName = `Terrain${level}Prev`;
            const objPath = `Objects/${modelName}.obj`;
            const mtlPath = `Objects/${modelName}.mtl`;
            
            console.log(`Loading model for level ${level}: ${objPath}`);
            
            // 加载 MTL 材质
            const mtlLoader = new MTLLoader();
            mtlLoader.setPath('Objects/'); // 设置材质路径
            const materials = await new Promise((resolve, reject) => {
                mtlLoader.load(
                    `${modelName}.mtl`,
                    (materials) => {
                        console.log(`MTL loaded for level ${level}`);
                        materials.preload();
                        resolve(materials);
                    },
                    (progress) => {
                        console.log(`MTL loading progress: ${progress.loaded}/${progress.total}`);
                    },
                    (error) => {
                        console.error(`MTL loading error for level ${level}:`, error);
                        reject(error);
                    }
                );
            });
            
            // 加载 OBJ 模型
            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath('Objects/'); // 设置模型路径
            const model = await new Promise((resolve, reject) => {
                objLoader.load(
                    `${modelName}.obj`,
                    (object) => {
                        console.log(`OBJ loaded for level ${level}`, object);
                        resolve(object);
                    },
                    (progress) => {
                        console.log(`OBJ loading progress: ${progress.loaded}/${progress.total}`);
                    },
                    (error) => {
                        console.error(`OBJ loading error for level ${level}:`, error);
                        reject(error);
                    }
                );
            });
            
            // 计算模型边界框，用于居中
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // 居中模型（在原点）
            model.position.x = -center.x;
            model.position.y = -center.y;
            model.position.z = -center.z;
            
            // 沿 y 轴顺时针旋转 30 度（注意：Three.js 中顺时针是负值）
            model.rotation.y = -Math.PI / 6; // -30度 = -π/6 弧度
            
            // 计算缩放，确保模型不会太大，并且不会遮挡 UI 元素
            // UI 元素位置：标题 y=40，箭头按钮 y≈330，levelLabel y=600
            // 模型应该显示在屏幕中央，大约 y=360 附近，高度限制在约 200-500 像素范围内
            const maxDimension = Math.max(size.x, size.y, size.z);
            console.log(`Model size for level ${level}:`, size, `maxDimension:`, maxDimension);
            
            // 调整缩放，使模型在屏幕中央显示，高度不超过约 300 像素
            // 相机距离为 5，视野角度 45 度，屏幕高度 720
            // 在距离 5 处，视野高度约为 5 * tan(22.5°) * 2 ≈ 4.14 单位
            // 屏幕 300 像素对应约 300/720 * 4.14 ≈ 1.73 单位
            const targetHeight = 2.0; // 增加目标高度，让模型更大更明显
            const scale = targetHeight / maxDimension;
            model.scale.set(scale, scale, scale);
            
            console.log(`Model scaled by ${scale}, final size:`, {
                x: size.x * scale,
                y: size.y * scale,
                z: size.z * scale
            });
            
            // 缓存模型（不克隆，直接使用）
            this.models[level] = model;
            
            console.log(`Model for level ${level} processed and cached`);
            
            // 显示模型
            this.showModel(level);
            
            // 立即渲染一次
            this.render();
        } catch (error) {
            console.error(`Failed to load model for level ${level}:`, error);
            // 如果加载失败，可以显示一个占位符或错误信息
        }
    }
    
    showModel(level) {
        if (!this.scene) {
            console.error('Scene not initialized');
            return;
        }
        
        // 移除当前模型
        if (this.currentModel) {
            // 检查模型是否在场景中
            if (this.currentModel.parent === this.scene) {
                this.scene.remove(this.currentModel);
            }
            this.currentModel = null;
        }
        
        // 添加新模型（直接使用，不克隆）
        if (this.models[level]) {
            const model = this.models[level];
            // 确保模型不在场景中
            if (model.parent) {
                model.parent.remove(model);
            }
            this.currentModel = model;
            this.scene.add(this.currentModel);
            this.currentLevel = level;
            console.log(`Model for level ${level} displayed`);
        } else {
            console.warn(`Model for level ${level} not found in cache`);
        }
    }
    
    updateLevel(level) {
        if (level !== this.currentLevel) {
            if (this.models[level]) {
                this.showModel(level);
            } else {
                this.loadModel(level);
            }
        }
    }
    
    render() {
        if (this.renderer && this.scene && this.camera) {
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
