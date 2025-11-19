// UI.js - 用户界面管理

class UI {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // 按钮间距
        const buttonSpacing = 20;
        
        // Play按钮属性
        this.playButton = {
            x: this.width / 2 - 125,  // 居中，250宽度的一半
            y: this.height / 2 - 100,  // 居中偏上
            width: 250,
            height: 100,
            cornerRadius: 10,
            baseColor: '#000000',      // 黑色填充
            hoverColor: '#2a2a2a',     // hover时稍微变浅
            strokeColor: '#ffffff',    // 白色描边
            strokeWidth: 6,            // 边框宽度（3倍）
            text: 'Play',
            fontSize: 32,
            baseFontSize: 32,
            clickFontSize: 28,
            isHovered: false,
            isClicked: false,
            targetPhase: 1
        };
        
        // Help按钮属性
        this.helpButton = {
            x: this.width / 2 - 125,  // 居中，250宽度的一半
            y: this.height / 2 + buttonSpacing + 50,  // Play按钮下方，下移50
            width: 250,
            height: 100,
            cornerRadius: 10,
            baseColor: '#000000',      // 黑色填充
            hoverColor: '#2a2a2a',     // hover时稍微变浅
            strokeColor: '#ffffff',    // 白色描边
            strokeWidth: 6,            // 边框宽度（3倍）
            text: 'Help',
            fontSize: 32,
            baseFontSize: 32,
            clickFontSize: 28,
            isHovered: false,
            isClicked: false,
            targetPhase: 2
        };
        
        // 统一箭头按钮样式配置
        this.arrowButtonStyle = {
            fontSize: 40,  // 扩大2倍：20 -> 40
            baseFontSize: 40,
            clickFontSize: 36,  // 扩大2倍：18 -> 36
            hoverScale: 1.05,  // hover时放大1.05倍（减小50%）
            color: '#ffffff',
            align: 'left'  // 'left', 'center', 'right'
        };
        
        // Phase 1 (Level Selection界面) 元素
        this.backButton = {
            x: 20,
            y: 44,  // 与Level Selection标题居中对齐（标题y=40，字体48px，中心在64，按钮文字40px，中心在y+20，所以y=44）
            width: 150,
            height: 40,
            text: '<<< Back',
            fontSize: this.arrowButtonStyle.fontSize,
            baseFontSize: this.arrowButtonStyle.baseFontSize,
            clickFontSize: this.arrowButtonStyle.clickFontSize,
            isHovered: false,
            isClicked: false,
            targetPhase: 0,
            align: 'left'
        };
        
        this.leftArrowButton = {
            x: 100,  // 向中间靠拢80格：20 + 80 = 100
            y: this.height / 2 - 30,  // 垂直居中
            width: 60,
            height: 60,
            text: '<',
            fontSize: 36,
            baseFontSize: 36,
            clickFontSize: 32,
            isHovered: false,
            isClicked: false,
            align: 'center'
        };
        
        this.rightArrowButton = {
            x: this.width - 160,  // 向中间靠拢80格：width - 80 - 80 = width - 160
            y: this.height / 2 - 30,  // 垂直居中
            width: 60,
            height: 60,
            text: '>',
            fontSize: 36,
            baseFontSize: 36,
            clickFontSize: 32,
            isHovered: false,
            isClicked: false,
            align: 'center'
        };
        
        this.helpButtonPhase1 = {
            x: this.width - 200,
            y: this.height - 100,
            width: 180,
            height: 40,
            text: '>>> Help',
            fontSize: this.arrowButtonStyle.fontSize,
            baseFontSize: this.arrowButtonStyle.baseFontSize,
            clickFontSize: this.arrowButtonStyle.clickFontSize,
            isHovered: false,
            isClicked: false,
            targetPhase: 2,
            align: 'right'
        };
        
        this.tutorialButtonPhase1 = {
            x: this.width - 200,
            y: this.height - 50,
            width: 180,
            height: 40,
            text: '>>> Play Tutorial',
            fontSize: this.arrowButtonStyle.fontSize,
            baseFontSize: this.arrowButtonStyle.baseFontSize,
            clickFontSize: this.arrowButtonStyle.clickFontSize,
            isHovered: false,
            isClicked: false,
            targetPhase: 0,  // 可根据需要修改
            align: 'right'
        };
        
        // Phase 2 (Help界面) 元素
        this.tutorialButton = {
            x: this.width - 200,  // 右下角
            y: this.height - 60,
            width: 180,
            height: 40,
            text: '>>> Play Tutorial',
            fontSize: this.arrowButtonStyle.fontSize,
            baseFontSize: this.arrowButtonStyle.baseFontSize,
            clickFontSize: this.arrowButtonStyle.clickFontSize,
            isHovered: false,
            isClicked: false,
            targetPhase: 0,  // 暂时设为0，可根据需要修改
            align: 'right'
        };
        
        // 动画相关
        this.playButtonColor = this.playButton.baseColor;
        this.helpButtonColor = this.helpButton.baseColor;
        this.playButtonFontSize = this.playButton.baseFontSize;
        this.helpButtonFontSize = this.helpButton.baseFontSize;
        
        // 主界面按钮从左到右变白动画
        this.playButtonFillProgress = 0;  // 0-1，填充进度
        this.helpButtonFillProgress = 0;
        this.playButtonFillAnimation = {
            isAnimating: false,
            startTime: 0,
            duration: 100,  // 0.1秒
            targetProgress: 0,
            startProgress: 0
        };
        this.helpButtonFillAnimation = {
            isAnimating: false,
            startTime: 0,
            duration: 100,  // 0.1秒
            targetProgress: 0,
            startProgress: 0
        };
        this.tutorialButtonFontSize = this.tutorialButton.baseFontSize;
        this.backButtonFontSize = this.backButton.baseFontSize;
        this.leftArrowButtonFontSize = this.leftArrowButton.baseFontSize;
        this.rightArrowButtonFontSize = this.rightArrowButton.baseFontSize;
        this.helpButtonPhase1FontSize = this.helpButtonPhase1.baseFontSize;
        this.tutorialButtonPhase1FontSize = this.tutorialButtonPhase1.baseFontSize;
        
        // Hover字体大小（用于平滑放大效果）
        this.backButtonHoverFontSize = this.backButton.baseFontSize;
        this.leftArrowButtonHoverFontSize = this.leftArrowButton.baseFontSize;
        this.rightArrowButtonHoverFontSize = this.rightArrowButton.baseFontSize;
        this.helpButtonPhase1HoverFontSize = this.helpButtonPhase1.baseFontSize;
        this.tutorialButtonPhase1HoverFontSize = this.tutorialButtonPhase1.baseFontSize;
        this.tutorialButtonHoverFontSize = this.tutorialButton.baseFontSize;
        
        // Level选择相关
        this.level = 1;  // 默认level为1，可以在0,1,2之间变化
        this.levelLabel = {
            x: this.width / 2,  // 水平居中
            y: 650,  // 高度650位置（下移50格）
            fontSize: 36,
            text: 'Level 1'  // 默认文本
        };
        
        // Level切换动画相关
        this.levelAnimation = {
            isAnimating: false,
            startTime: 0,
            duration: 500,  // 0.5秒
            direction: 0,  // -1向左，1向右
            oldText: '',
            newText: '',
            oldLevel: 1,
            newLevel: 1
        };
        
        this.animationFrame = null;
        this.lastPhase = -1;
        
        // 初始化 3D 场景（仅在 phase=1 时使用）
        this.levelSelection3D = null;
        
        this.setupEventListeners();
        this.startRenderLoop();
    }
    
    setupEventListeners() {
        // 鼠标移动事件
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.checkHover(x, y);
        });
        
        // 鼠标离开canvas
        this.canvas.addEventListener('mouseleave', () => {
            const prevPlayHovered = this.playButton.isHovered;
            const prevHelpHovered = this.helpButton.isHovered;
            this.playButton.isHovered = false;
            this.helpButton.isHovered = false;
            this.tutorialButton.isHovered = false;
            this.backButton.isHovered = false;
            this.leftArrowButton.isHovered = false;
            this.rightArrowButton.isHovered = false;
            this.helpButtonPhase1.isHovered = false;
            this.tutorialButtonPhase1.isHovered = false;
            
            // 如果hover状态改变，启动填充动画
            const currentPhase = (typeof StateManager !== 'undefined') ? StateManager.getPhase() : 0;
            if (currentPhase === 0) {
                if (prevPlayHovered !== this.playButton.isHovered) {
                    this.startFillAnimation('play');
                }
                if (prevHelpHovered !== this.helpButton.isHovered) {
                    this.startFillAnimation('help');
                }
            }
        });
        
        // 鼠标点击事件
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const currentPhase = (typeof StateManager !== 'undefined') ? StateManager.getPhase() : 0;
            
            if (currentPhase === 0) {
                if (this.isPointInButton(x, y, this.playButton)) {
                    this.handleClick(this.playButton);
                } else if (this.isPointInButton(x, y, this.helpButton)) {
                    this.handleClick(this.helpButton);
                }
            } else if (currentPhase === 1) {
                if (this.isPointInButton(x, y, this.backButton)) {
                    this.handleArrowButtonClick(this.backButton, 'backButtonFontSize');
                } else if (this.isPointInButton(x, y, this.leftArrowButton)) {
                    this.handleArrowButtonClick(this.leftArrowButton, 'leftArrowButtonFontSize');
                } else if (this.isPointInButton(x, y, this.rightArrowButton)) {
                    this.handleArrowButtonClick(this.rightArrowButton, 'rightArrowButtonFontSize');
                } else if (this.isPointInButton(x, y, this.helpButtonPhase1)) {
                    this.handleArrowButtonClick(this.helpButtonPhase1, 'helpButtonPhase1FontSize');
                } else if (this.isPointInButton(x, y, this.tutorialButtonPhase1)) {
                    this.handleArrowButtonClick(this.tutorialButtonPhase1, 'tutorialButtonPhase1FontSize');
                }
            } else if (currentPhase === 2) {
                if (this.isPointInButton(x, y, this.tutorialButton)) {
                    this.handleTutorialClick();
                }
            }
        });
    }
    
    checkHover(x, y) {
        const currentPhase = (typeof StateManager !== 'undefined') ? StateManager.getPhase() : 0;
        
        // 重置所有hover状态
        const prevPlayHovered = this.playButton.isHovered;
        const prevHelpHovered = this.helpButton.isHovered;
        this.playButton.isHovered = false;
        this.helpButton.isHovered = false;
        this.tutorialButton.isHovered = false;
        this.backButton.isHovered = false;
        this.leftArrowButton.isHovered = false;
        this.rightArrowButton.isHovered = false;
        this.helpButtonPhase1.isHovered = false;
        this.tutorialButtonPhase1.isHovered = false;
        
        if (currentPhase === 0) {
            // 主界面：检查Play和Help按钮
            this.playButton.isHovered = this.isPointInButton(x, y, this.playButton);
            this.helpButton.isHovered = this.isPointInButton(x, y, this.helpButton);
            
            // 如果hover状态改变，启动填充动画
            if (this.playButton.isHovered !== prevPlayHovered) {
                this.startFillAnimation('play');
            }
            if (this.helpButton.isHovered !== prevHelpHovered) {
                this.startFillAnimation('help');
            }
        } else if (currentPhase === 1) {
            // Level Selection界面：检查所有按钮
            this.backButton.isHovered = this.isPointInButton(x, y, this.backButton);
            this.leftArrowButton.isHovered = this.isPointInButton(x, y, this.leftArrowButton);
            this.rightArrowButton.isHovered = this.isPointInButton(x, y, this.rightArrowButton);
            this.helpButtonPhase1.isHovered = this.isPointInButton(x, y, this.helpButtonPhase1);
            this.tutorialButtonPhase1.isHovered = this.isPointInButton(x, y, this.tutorialButtonPhase1);
        } else if (currentPhase === 2) {
            // Help界面：检查Tutorial按钮
            this.tutorialButton.isHovered = this.isPointInButton(x, y, this.tutorialButton);
        }
    }
    
    isPointInButton(x, y, button) {
        return x >= button.x && x <= button.x + button.width &&
               y >= button.y && y <= button.y + button.height;
    }
    
    handleClick(button) {
        if (button.isClicked) return;
        
        // 只在主界面时响应点击
        if (typeof StateManager !== 'undefined' && StateManager.getPhase() !== 0) {
            return;
        }
        
        button.isClicked = true;
        
        // 根据按钮类型设置字体大小
        if (button === this.playButton) {
            this.playButtonFontSize = button.clickFontSize;
        } else if (button === this.helpButton) {
            this.helpButtonFontSize = button.clickFontSize;
        }
        
        // 恢复字体大小并切换phase
        setTimeout(() => {
            if (button === this.playButton) {
                this.playButtonFontSize = button.baseFontSize;
            } else if (button === this.helpButton) {
                this.helpButtonFontSize = button.baseFontSize;
            }
            button.isClicked = false;
            
            // 切换phase
            if (typeof StateManager !== 'undefined') {
                StateManager.setPhase(button.targetPhase);
            }
        }, 150);
    }
    
    handleArrowButtonClick(button, fontSizeProperty) {
        if (button.isClicked) return;
        
        const currentPhase = (typeof StateManager !== 'undefined') ? StateManager.getPhase() : 0;
        
        // 根据phase判断是否响应点击
        if (currentPhase !== 1 && currentPhase !== 2) {
            return;
        }
        
        // 处理左右箭头按钮的level变化（只在phase=1时）
        if (currentPhase === 1) {
            // 动画期间禁止点击
            if (this.levelAnimation.isAnimating) {
                return;
            }
            
            if (button === this.leftArrowButton) {
                // 减小level（只有在可用时才响应）
                if (this.level > 0) {
                    this.level--;
                    this.updateLevelLabel();
                } else {
                    // 不可用时，不执行后续点击动画
                    return;
                }
            } else if (button === this.rightArrowButton) {
                // 增大level（只有在可用时才响应）
                if (this.level < 2) {
                    this.level++;
                    this.updateLevelLabel();
                } else {
                    // 不可用时，不执行后续点击动画
                    return;
                }
            }
        }
        
        button.isClicked = true;
        
        // 找到对应的hover字体大小属性
        const hoverPropertyMap = {
            'backButtonFontSize': 'backButtonHoverFontSize',
            'leftArrowButtonFontSize': 'leftArrowButtonHoverFontSize',
            'rightArrowButtonFontSize': 'rightArrowButtonHoverFontSize',
            'helpButtonPhase1FontSize': 'helpButtonPhase1HoverFontSize',
            'tutorialButtonPhase1FontSize': 'tutorialButtonPhase1HoverFontSize',
            'tutorialButtonFontSize': 'tutorialButtonHoverFontSize'
        };
        
        const hoverProperty = hoverPropertyMap[fontSizeProperty] || fontSizeProperty.replace('FontSize', 'HoverFontSize');
        if (this[hoverProperty] !== undefined) {
            this[hoverProperty] = button.clickFontSize;
        }
        
        // 恢复字体大小并切换phase（如果有targetPhase）
        setTimeout(() => {
            if (this[hoverProperty] !== undefined) {
                this[hoverProperty] = button.baseFontSize;
            }
            button.isClicked = false;
            
            // 切换phase（如果有targetPhase，且不是左右箭头按钮）
            if (button.targetPhase !== undefined && typeof StateManager !== 'undefined' && 
                button !== this.leftArrowButton && button !== this.rightArrowButton) {
                StateManager.setPhase(button.targetPhase);
            }
        }, 150);
    }
    
    updateLevelLabel() {
        // 保存旧的level用于方向判断
        const oldLevel = this.levelAnimation.newLevel;
        
        // 获取新的文本
        let newText;
        if (this.level === 0) {
            newText = 'Tutorial';
        } else {
            newText = `Level ${this.level}`;
        }
        
        // 如果文本没有变化，不触发动画
        if (this.levelLabel.text === newText) {
            return;
        }
        
        // 判断动画方向（根据level变化）
        const direction = this.level > oldLevel ? 1 : -1;
        
        // 启动动画
        this.levelAnimation.isAnimating = true;
        this.levelAnimation.startTime = Date.now();
        this.levelAnimation.direction = direction;
        this.levelAnimation.oldText = this.levelLabel.text;
        this.levelAnimation.newText = newText;
        this.levelAnimation.oldLevel = oldLevel;
        this.levelAnimation.newLevel = this.level;
        
        // 更新文本（动画结束后会显示）
        this.levelLabel.text = newText;
    }
    
    // 缓动函数：加速（ease-in）
    easeIn(t) {
        return t * t;
    }
    
    // 缓动函数：减速（ease-out）
    easeOut(t) {
        return 1 - (1 - t) * (1 - t);
    }
    
    handleTutorialClick() {
        if (this.tutorialButton.isClicked) return;
        
        // 只在phase=2时响应点击
        if (typeof StateManager !== 'undefined' && StateManager.getPhase() !== 2) {
            return;
        }
        
        this.tutorialButton.isClicked = true;
        this.tutorialButtonHoverFontSize = this.tutorialButton.clickFontSize;
        
        // 恢复字体大小并切换phase
        setTimeout(() => {
            this.tutorialButtonHoverFontSize = this.tutorialButton.baseFontSize;
            this.tutorialButton.isClicked = false;
            
            // 切换phase（可根据需要修改）
            if (typeof StateManager !== 'undefined') {
                StateManager.setPhase(this.tutorialButton.targetPhase);
            }
        }, 150);
    }
    
    drawRoundedRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }
    
    startRenderLoop() {
        const render = () => {
            this.render();
            this.animationFrame = requestAnimationFrame(render);
        };
        render();
    }
    
    render() {
        // 获取当前phase
        const currentPhase = (typeof StateManager !== 'undefined') ? StateManager.getPhase() : 0;
        
        // 清空画布（使用透明清除，保留 alpha 通道）
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 根据phase决定渲染内容
        if (currentPhase === 0) {
            // 主界面：显示Play和Help按钮，绘制黑色背景
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.renderMainMenu();
        } else if (currentPhase === 1) {
            // Level Selection界面：不绘制背景，让3D模型显示
            // 背景由3D场景提供
            this.renderLevelSelection();
        } else if (currentPhase === 2) {
            // Help界面：显示标题、正文和Tutorial按钮，绘制黑色背景
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.renderHelpScreen();
        } else {
            // 关卡选择或其他阶段：黑屏
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        
        // 检查phase是否变化
        if (currentPhase !== this.lastPhase) {
            this.lastPhase = currentPhase;
            // phase变化时重置hover状态
            this.playButton.isHovered = false;
            this.helpButton.isHovered = false;
            this.tutorialButton.isHovered = false;
            this.backButton.isHovered = false;
            this.leftArrowButton.isHovered = false;
            this.rightArrowButton.isHovered = false;
            this.helpButtonPhase1.isHovered = false;
            this.tutorialButtonPhase1.isHovered = false;
            
            // 进入phase1时，重置level为1并初始化3D场景
            if (currentPhase === 1) {
                this.level = 1;
                // 重置动画状态
                this.levelAnimation.newLevel = 1;
                this.levelAnimation.oldLevel = 1;
                // 更新label文本（不触发动画）
                if (this.level === 0) {
                    this.levelLabel.text = 'Tutorial';
                } else {
                    this.levelLabel.text = `Level ${this.level}`;
                }
                
                // 初始化3D场景
                if (!this.levelSelection3D) {
                    const container = this.canvas.parentElement;
                    this.levelSelection3D = new LevelSelection3D(container, this.canvas);
                }
            } else {
                // 离开phase1时，可以清理3D场景（可选）
                // if (this.levelSelection3D) {
                //     this.levelSelection3D.dispose();
                //     this.levelSelection3D = null;
                // }
            }
        }
        
        // 在phase1时，更新3D模型并渲染
        if (currentPhase === 1 && this.levelSelection3D) {
            this.levelSelection3D.updateLevel(this.level);
            this.levelSelection3D.render();
        }
    }
    
    renderMainMenu() {
        // 更新填充进度
        this.updateFillProgress();
        
        // 更新颜色（平滑过渡）
        this.updateButtonColor(this.playButton, 'playButtonColor');
        this.updateButtonColor(this.helpButton, 'helpButtonColor');
        
        // 渲染Play按钮
        this.renderButton(this.playButton, this.playButtonColor, this.playButtonFontSize);
        
        // 渲染Help按钮
        this.renderButton(this.helpButton, this.helpButtonColor, this.helpButtonFontSize);
    }
    
    startFillAnimation(buttonType) {
        const isPlay = buttonType === 'play';
        const button = isPlay ? this.playButton : this.helpButton;
        const animation = isPlay ? this.playButtonFillAnimation : this.helpButtonFillAnimation;
        const progressProperty = isPlay ? 'playButtonFillProgress' : 'helpButtonFillProgress';
        
        // 设置动画目标
        animation.startProgress = this[progressProperty];
        animation.targetProgress = button.isHovered ? 1 : 0;
        animation.startTime = Date.now();
        animation.isAnimating = true;
    }
    
    updateFillProgress() {
        const currentPhase = (typeof StateManager !== 'undefined') ? StateManager.getPhase() : 0;
        
        // 只在 phase=0 时更新填充动画
        if (currentPhase !== 0) {
            return;
        }
        
        // 更新 Play 按钮填充进度
        if (this.playButtonFillAnimation.isAnimating) {
            const elapsed = Date.now() - this.playButtonFillAnimation.startTime;
            const progress = Math.min(elapsed / this.playButtonFillAnimation.duration, 1);
            
            if (progress >= 1) {
                this.playButtonFillProgress = this.playButtonFillAnimation.targetProgress;
                this.playButtonFillAnimation.isAnimating = false;
            } else {
                // 线性插值
                const start = this.playButtonFillAnimation.startProgress;
                const target = this.playButtonFillAnimation.targetProgress;
                this.playButtonFillProgress = start + (target - start) * progress;
            }
        }
        
        // 更新 Help 按钮填充进度
        if (this.helpButtonFillAnimation.isAnimating) {
            const elapsed = Date.now() - this.helpButtonFillAnimation.startTime;
            const progress = Math.min(elapsed / this.helpButtonFillAnimation.duration, 1);
            
            if (progress >= 1) {
                this.helpButtonFillProgress = this.helpButtonFillAnimation.targetProgress;
                this.helpButtonFillAnimation.isAnimating = false;
            } else {
                // 线性插值
                const start = this.helpButtonFillAnimation.startProgress;
                const target = this.helpButtonFillAnimation.targetProgress;
                this.helpButtonFillProgress = start + (target - start) * progress;
            }
        }
    }
    
    updateButtonColor(button, colorProperty) {
        if (button.isHovered) {
            const targetColor = button.hoverColor;
            this[colorProperty] = this.lerpColor(this[colorProperty], targetColor, 0.2);
        } else {
            const targetColor = button.baseColor;
            this[colorProperty] = this.lerpColor(this[colorProperty], targetColor, 0.2);
        }
    }
    
    renderButton(button, currentColor, currentFontSize) {
        const isPlay = (button === this.playButton);
        const fillProgress = isPlay ? this.playButtonFillProgress : this.helpButtonFillProgress;
        
        // 绘制按钮（黑色填充）
        this.drawRoundedRect(
            button.x,
            button.y,
            button.width,
            button.height,
            button.cornerRadius
        );
        this.ctx.fillStyle = currentColor;
        this.ctx.fill();
        
        // 如果填充进度 > 0，绘制从左到右的白色填充
        if (fillProgress > 0) {
            this.ctx.save();
            // 创建裁剪路径（只绘制按钮区域内的内容）
            this.drawRoundedRect(
                button.x,
                button.y,
                button.width,
                button.height,
                button.cornerRadius
            );
            this.ctx.clip();
            
            // 绘制从左到右的白色填充
            const fillWidth = button.width * fillProgress;
            this.drawRoundedRect(
                button.x,
                button.y,
                fillWidth,
                button.height,
                button.cornerRadius
            );
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fill();
            this.ctx.restore();
        }
        
        // 绘制白色描边
        this.ctx.strokeStyle = button.strokeColor;
        this.ctx.lineWidth = button.strokeWidth;
        this.drawRoundedRect(
            button.x,
            button.y,
            button.width,
            button.height,
            button.cornerRadius
        );
        this.ctx.stroke();
        
        // 绘制文字（根据填充进度从白色平滑变黑）
        const textColor = this.lerpColor('#ffffff', '#000000', fillProgress);
        this.ctx.fillStyle = textColor;
        this.ctx.font = `bold ${currentFontSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            button.text,
            button.x + button.width / 2,
            button.y + button.height / 2
        );
    }
    
    renderLevelSelection() {
        // 更新hover字体大小（平滑过渡）
        this.updateButtonHoverSize(this.backButton, 'backButtonHoverFontSize');
        this.updateButtonHoverSize(this.leftArrowButton, 'leftArrowButtonHoverFontSize');
        this.updateButtonHoverSize(this.rightArrowButton, 'rightArrowButtonHoverFontSize');
        this.updateButtonHoverSize(this.helpButtonPhase1, 'helpButtonPhase1HoverFontSize');
        this.updateButtonHoverSize(this.tutorialButtonPhase1, 'tutorialButtonPhase1HoverFontSize');
        
        // 顶部居中标题
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('Level Selection', this.width / 2, 40);
        
        // 渲染箭头按钮（统一样式，使用hover字体大小）
        // 判断左右箭头按钮是否可用
        const leftArrowEnabled = this.level > 0;
        const rightArrowEnabled = this.level < 2;
        
        this.renderArrowButton(this.backButton, this.backButtonHoverFontSize);
        this.renderArrowButton(this.leftArrowButton, this.leftArrowButtonHoverFontSize, leftArrowEnabled);
        this.renderArrowButton(this.rightArrowButton, this.rightArrowButtonHoverFontSize, rightArrowEnabled);
        this.renderArrowButton(this.helpButtonPhase1, this.helpButtonPhase1HoverFontSize);
        this.renderArrowButton(this.tutorialButtonPhase1, this.tutorialButtonPhase1HoverFontSize);
        
        // 渲染levelLabel（高度600位置居中）
        this.renderLevelLabel();
    }
    
    renderLevelLabel() {
        const centerX = this.levelLabel.x;
        const centerY = this.levelLabel.y;
        const fontSize = this.levelLabel.fontSize;
        const slideDistance = 200;  // 滑动距离
        
        // 检查动画状态
        if (this.levelAnimation.isAnimating) {
            const elapsed = Date.now() - this.levelAnimation.startTime;
            const progress = Math.min(elapsed / this.levelAnimation.duration, 1);
            
            if (progress >= 1) {
                // 动画结束
                this.levelAnimation.isAnimating = false;
                // 只渲染新文本
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = `bold ${fontSize}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.globalAlpha = 1.0;
                this.ctx.fillText(this.levelAnimation.newText, centerX, centerY);
            } else {
                // 动画进行中：渲染旧文本（加速滑动淡出）和新文本（减速滑动淡入）
                const direction = this.levelAnimation.direction;
                
                // 旧文本：加速滑动并淡出
                // direction = 1（向右切换，level增加）：旧文本向左滑出（因为新标签在右边）
                // direction = -1（向左切换，level减少）：旧文本向右滑出（因为新标签在左边）
                const oldProgress = this.easeIn(progress);
                const oldX = centerX - direction * slideDistance * oldProgress;
                const oldAlpha = 1.0 - oldProgress;
                
                this.ctx.save();
                this.ctx.globalAlpha = oldAlpha;
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = `bold ${fontSize}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(this.levelAnimation.oldText, oldX, centerY);
                this.ctx.restore();
                
                // 新文本：减速滑动并淡入
                // direction = 1（向右切换，level增加）：新文本从右边滑入
                // direction = -1（向左切换，level减少）：新文本从左边滑入
                const newProgress = this.easeOut(progress);
                const newX = centerX + direction * slideDistance * (1 - newProgress);
                const newAlpha = newProgress;
                
                this.ctx.save();
                this.ctx.globalAlpha = newAlpha;
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = `bold ${fontSize}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(this.levelAnimation.newText, newX, centerY);
                this.ctx.restore();
            }
        } else {
            // 无动画：正常渲染
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `bold ${fontSize}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.globalAlpha = 1.0;
            this.ctx.fillText(this.levelLabel.text, centerX, centerY);
        }
    }
    
    updateButtonHoverSize(button, hoverFontSizeProperty) {
        let targetSize;
        
        if (button.isClicked) {
            // 点击时使用clickFontSize
            targetSize = button.clickFontSize;
        } else if (button.isHovered) {
            // hover时放大
            targetSize = button.baseFontSize * this.arrowButtonStyle.hoverScale;
        } else {
            // 默认大小
            targetSize = button.baseFontSize;
        }
        
        // 平滑过渡
        this[hoverFontSizeProperty] += (targetSize - this[hoverFontSizeProperty]) * 0.2;
    }
    
    renderArrowButton(button, currentFontSize, enabled = true) {
        // 设置透明度：不可用时30%，否则不透明
        const opacity = enabled ? 1.0 : 0.3;
        this.ctx.globalAlpha = opacity;
        
        this.ctx.fillStyle = this.arrowButtonStyle.color;
        this.ctx.font = `bold ${currentFontSize}px Arial`;
        
        // 根据对齐方式设置textAlign和textBaseline
        if (button.align === 'left') {
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            this.ctx.fillText(button.text, button.x, button.y);
        } else if (button.align === 'center') {
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                button.text,
                button.x + button.width / 2,
                button.y + button.height / 2
            );
        } else if (button.align === 'right') {
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(
                button.text,
                button.x + button.width,
                button.y + button.height
            );
        }
        
        // 恢复透明度
        this.ctx.globalAlpha = 1.0;
    }
    
    renderHelpScreen() {
        // 更新hover字体大小（平滑过渡）
        this.updateButtonHoverSize(this.tutorialButton, 'tutorialButtonHoverFontSize');
        
        // 左上角标题（边距扩大）
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('Title', 60, 40);  // 左边距扩大3倍：20->60，上边距扩大2倍：20->40
        
        // 左上角正文（在标题下方，间距扩大2倍）
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Empty', 60, 140);  // 与标题间距从60扩大2倍到100，所以是40+100=140
        
        // 右下角Tutorial按钮（使用统一箭头按钮样式，使用hover字体大小）
        this.renderArrowButton(this.tutorialButton, this.tutorialButtonHoverFontSize);
    }
    
    // 颜色插值函数（用于平滑过渡）
    lerpColor(color1, color2, t) {
        // 处理rgb格式
        if (color1.startsWith('rgb')) {
            const c1 = this.parseRgb(color1);
            const c2 = this.hexToRgb(color2);
            if (!c1 || !c2) return color1;
            
            const r = Math.round(c1.r + (c2.r - c1.r) * t);
            const g = Math.round(c1.g + (c2.g - c1.g) * t);
            const b = Math.round(c1.b + (c2.b - c1.b) * t);
            
            return `rgb(${r}, ${g}, ${b})`;
        }
        
        // 处理hex格式
        const c1 = this.hexToRgb(color1);
        const c2 = this.hexToRgb(color2);
        
        if (!c1 || !c2) return color1;
        
        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const b = Math.round(c1.b + (c2.b - c1.b) * t);
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    parseRgb(rgb) {
        const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        return match ? {
            r: parseInt(match[1], 10),
            g: parseInt(match[2], 10),
            b: parseInt(match[3], 10)
        } : null;
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
}

// 初始化UI
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        new UI(canvas);
    }
});
