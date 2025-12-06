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
            text: 'Help >>>',
            fontSize: this.arrowButtonStyle.fontSize,
            baseFontSize: this.arrowButtonStyle.baseFontSize,
            clickFontSize: this.arrowButtonStyle.clickFontSize,
            isHovered: false,
            isClicked: false,
            targetPhase: 2,
            align: 'right'
        };
        
        // Phase 2 (Help界面) 元素
        this.backButtonPhase2 = {
            x: 20,  // 左下角
            y: this.height - 60,
            width: 150,
            height: 40,
            text: '<<< Back',
            fontSize: this.arrowButtonStyle.fontSize,
            baseFontSize: this.arrowButtonStyle.baseFontSize,
            clickFontSize: this.arrowButtonStyle.clickFontSize,
            isHovered: false,
            isClicked: false,
            targetPhase: 0,  // 跳转到phase0
            align: 'left'
        };
        
        // tutorialButton 已删除（Help 界面不再需要）
        
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
        
        // 主界面（phase 10-15）暂停功能
        this.pauseButton = {
            x: this.width - 60 - 40,  // 右上角，向左移40格
            y: 20 + 20,  // 下移20格
            width: 60,
            height: 60,
            barWidth: 20,
            barHeight: 60,
            barSpacing: 20,
            isHovered: false,
            isClicked: false
        };
        
        this.isPaused = false;  // 暂停状态
        this.enteringTutorialLevel = false;  // 标记是否正在进入 tutorial level（Level Selection 界面）
        this.directEnterTutorial = false;  // 标记是否从 Help 界面直接进入 tutorial（不需要转盘旋转）
        this.pauseOverlay = {
            alpha: 0,  // 黑幕透明度
            isAnimating: false,
            startTime: 0,
            duration: 300,  // 0.3秒
            startAlpha: 0,
            targetAlpha: 0
        };
        
        this.resumeButton = {
            x: this.width / 2 - 100,  // 居中，200宽度的一半
            y: 270 - 50,  // 中心高度270，按钮高度100的一半
            width: 200,
            height: 100,
            cornerRadius: 10,
            baseColor: '#000000',
            hoverColor: '#2a2a2a',
            strokeColor: '#ffffff',
            strokeWidth: 6,
            text: 'Resume',
            fontSize: 32,
            baseFontSize: 32,
            clickFontSize: 28,
            isHovered: false,
            isClicked: false,
            startX: -250,  // 从左边开始（屏幕外）
            targetX: this.width / 2 - 100,
            currentX: -250,
            isAnimating: false,
            animationStartTime: 0,
            animationDuration: 300
        };
        
        this.quitButton = {
            x: this.width / 2 - 100,
            y: 450 - 50,  // 中心高度450
            width: 200,
            height: 100,
            cornerRadius: 10,
            baseColor: '#000000',
            hoverColor: '#2a2a2a',
            strokeColor: '#ffffff',
            strokeWidth: 6,
            text: 'Quit',
            fontSize: 32,
            baseFontSize: 32,
            clickFontSize: 28,
            isHovered: false,
            isClicked: false,
            startX: this.width + 50,  // 从右边开始（屏幕外）
            targetX: this.width / 2 - 100,
            currentX: this.width + 50,
            isAnimating: false,
            animationStartTime: 0,
            animationDuration: 300
        };
        
        this.resumeButtonColor = this.resumeButton.baseColor;
        this.quitButtonColor = this.quitButton.baseColor;
        this.resumeButtonFontSize = this.resumeButton.baseFontSize;
        this.quitButtonFontSize = this.quitButton.baseFontSize;
        // tutorialButton 已删除
        this.backButtonFontSize = this.backButton.baseFontSize;
        this.leftArrowButtonFontSize = this.leftArrowButton.baseFontSize;
        this.rightArrowButtonFontSize = this.rightArrowButton.baseFontSize;
        this.helpButtonPhase1FontSize = this.helpButtonPhase1.baseFontSize;
        // tutorialButtonPhase1 已删除
        
        // Hover字体大小（用于平滑放大效果）
        this.backButtonHoverFontSize = this.backButton.baseFontSize;
        this.leftArrowButtonHoverFontSize = this.leftArrowButton.baseFontSize;
        this.rightArrowButtonHoverFontSize = this.rightArrowButton.baseFontSize;
        this.helpButtonPhase1HoverFontSize = this.helpButtonPhase1.baseFontSize;
        // tutorialButtonPhase1 已删除
        this.backButtonPhase2FontSize = this.backButtonPhase2.baseFontSize;
        this.backButtonPhase2HoverFontSize = this.backButtonPhase2.baseFontSize;
        // tutorialButton 已删除
        
        // Level选择相关
        this.level = 1;  // 默认level为1（Level1），可以在1,2,3,4,5之间变化
        this.levelLabel = {
            x: this.width / 2,  // 水平居中
            y: 650,  // 高度650位置（下移50格）
            fontSize: 36,
            text: 'Level 1'  // 默认文本（level 1）
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
            // tutorialButton 已删除
            this.backButton.isHovered = false;
            this.backButtonPhase2.isHovered = false;
            this.leftArrowButton.isHovered = false;
            this.rightArrowButton.isHovered = false;
            this.helpButtonPhase1.isHovered = false;
            // tutorialButtonPhase1 已删除
            
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
                }
                // tutorialButtonPhase1 已删除
            } else if (currentPhase === 2) {
                if (this.isPointInButton(x, y, this.backButtonPhase2)) {
                    this.handleArrowButtonClick(this.backButtonPhase2, 'backButtonPhase2FontSize');
                // tutorialButton 已删除
                }
            } else if (currentPhase >= 10 && currentPhase <= 15) {
                // 主界面：检查暂停按钮和暂停菜单按钮
                // 注意：当canvas的pointer-events是none时，这个事件可能不会触发
                // 我们需要在3D canvas上添加点击监听，或者使用其他方法
                if (!this.isPaused) {
                    // 未暂停时，检查暂停按钮
                    // 由于canvas的pointer-events可能是none，我们需要在LevelSelection3D中处理暂停按钮点击
                    if (this.isPointInPauseButton(x, y)) {
                        this.handlePauseClick();
                    }
                } else {
                    // 暂停时，检查Resume和Quit按钮
                    if (this.isPointInButton(x, y, this.resumeButton)) {
                        this.handleResumeClick();
                    } else if (this.isPointInButton(x, y, this.quitButton)) {
                        this.handleQuitClick();
                    }
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
        // tutorialButton 已删除
        this.backButton.isHovered = false;
        this.leftArrowButton.isHovered = false;
        this.rightArrowButton.isHovered = false;
        this.helpButtonPhase1.isHovered = false;
        // tutorialButtonPhase1 已删除
        
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
            // tutorialButtonPhase1 已删除
        } else if (currentPhase === 2) {
            // Help界面：检查Back和Tutorial按钮
            this.backButtonPhase2.isHovered = this.isPointInButton(x, y, this.backButtonPhase2);
            // tutorialButton 已删除
        } else if (currentPhase >= 10 && currentPhase <= 15) {
            // 主界面：检查暂停按钮和暂停菜单按钮
            if (!this.isPaused) {
                // 未暂停时，检查暂停按钮
                this.pauseButton.isHovered = this.isPointInPauseButton(x, y);
            } else {
                // 暂停时，检查Resume和Quit按钮
                this.resumeButton.isHovered = this.isPointInButton(x, y, this.resumeButton);
                this.quitButton.isHovered = this.isPointInButton(x, y, this.quitButton);
            }
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
        
        // tutorialButtonPhase1 已删除
        
        // 处理左右箭头按钮的level变化（只在phase=1时）
        if (currentPhase === 1) {
            // 动画期间禁止点击
            if (this.levelAnimation.isAnimating) {
                return;
            }
            
            if (button === this.leftArrowButton) {
                // 减小level（只有在可用时才响应）
                if (this.level > 1) {
                    this.level--;
                    this.updateLevelLabel();
                } else {
                    // 不可用时，不执行后续点击动画
                    return;
                }
            } else if (button === this.rightArrowButton) {
                // 增大level（只有在可用时才响应）
                if (this.level < 5) {
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
            // tutorialButtonPhase1 已删除
            // tutorialButton 已删除
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
        
        // 获取新的文本 - 所有关卡都显示为Level 1~5
        const newText = `Level ${this.level}`;
        
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
    
    // handleTutorialClick 已删除（Help 界面不再需要 tutorial 按钮）
    
    isPointInPauseButton(x, y) {
        const btn = this.pauseButton;
        // 检查是否在第一个竖条内
        const bar1X = btn.x;
        const bar1InBounds = x >= bar1X && x <= bar1X + btn.barWidth &&
                            y >= btn.y && y <= btn.y + btn.barHeight;
        // 检查是否在第二个竖条内
        const bar2X = btn.x + btn.barWidth + btn.barSpacing;
        const bar2InBounds = x >= bar2X && x <= bar2X + btn.barWidth &&
                            y >= btn.y && y <= btn.y + btn.barHeight;
        return bar1InBounds || bar2InBounds;
    }
    
    handlePauseClick() {
        console.log('UI.js: handlePauseClick called');
        console.log('UI.js: pauseButton.isClicked?', this.pauseButton.isClicked);
        console.log('UI.js: isPaused before?', this.isPaused);
        
        if (this.pauseButton.isClicked || this.isPaused) {
            console.log('UI.js: handlePauseClick early return');
            return;
        }
        
        this.pauseButton.isClicked = true;
        this.isPaused = true;
        console.log('UI.js: isPaused set to true');
        
        // 启动黑幕淡入动画
        this.startOverlayAnimation(0.5);
        console.log('UI.js: startOverlayAnimation called');
        
        // 启动按钮淡入动画
        this.startButtonSlideAnimation('resume', true);
        this.startButtonSlideAnimation('quit', true);
        console.log('UI.js: startButtonSlideAnimation called for resume and quit');
        
        setTimeout(() => {
            this.pauseButton.isClicked = false;
        }, 150);
    }
    
    handleResumeClick() {
        if (this.resumeButton.isClicked || !this.isPaused) return;
        
        this.resumeButton.isClicked = true;
        this.resumeButtonFontSize = this.resumeButton.clickFontSize;
        
        setTimeout(() => {
            this.resumeButtonFontSize = this.resumeButton.baseFontSize;
            this.resumeButton.isClicked = false;
            
            // 启动黑幕淡出动画
            this.startOverlayAnimation(0);
            
            // 启动按钮淡出动画（原路返回）
            this.startButtonSlideAnimation('resume', false);
            this.startButtonSlideAnimation('quit', false);
            
            // 动画结束后取消暂停
            setTimeout(() => {
                this.isPaused = false;
            }, 300);
        }, 150);
    }
    
    handleQuitClick() {
        if (this.quitButton.isClicked || !this.isPaused) return;
        
        this.quitButton.isClicked = true;
        this.quitButtonFontSize = this.quitButton.clickFontSize;
        
        setTimeout(() => {
            this.quitButtonFontSize = this.quitButton.baseFontSize;
            this.quitButton.isClicked = false;
            
            // 跳转到phase0
            if (typeof StateManager !== 'undefined') {
                StateManager.setPhase(0);
            }
            
            // 重置暂停状态
            this.isPaused = false;
            this.pauseOverlay.alpha = 0;
            this.resumeButton.currentX = this.resumeButton.startX;
            this.quitButton.currentX = this.quitButton.startX;
        }, 150);
    }
    
    startOverlayAnimation(targetAlpha) {
        this.pauseOverlay.startAlpha = this.pauseOverlay.alpha;
        this.pauseOverlay.targetAlpha = targetAlpha;
        this.pauseOverlay.startTime = Date.now();
        this.pauseOverlay.isAnimating = true;
    }
    
    updateOverlayAnimation() {
        if (!this.pauseOverlay.isAnimating) return;
        
        const elapsed = Date.now() - this.pauseOverlay.startTime;
        const progress = Math.min(elapsed / this.pauseOverlay.duration, 1);
        
        // 使用easeInOut缓动
        const easedProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        this.pauseOverlay.alpha = this.pauseOverlay.startAlpha + 
            (this.pauseOverlay.targetAlpha - this.pauseOverlay.startAlpha) * easedProgress;
        
        if (progress >= 1) {
            this.pauseOverlay.alpha = this.pauseOverlay.targetAlpha;
            this.pauseOverlay.isAnimating = false;
        }
    }
    
    startButtonSlideAnimation(buttonType, slideIn) {
        const button = buttonType === 'resume' ? this.resumeButton : this.quitButton;
        button.isAnimating = true;
        button.animationStartTime = Date.now();
        
        // 记录动画方向
        button.animationSlideIn = slideIn;
        
        if (slideIn) {
            // 淡入：从startX开始
            button.currentX = button.startX;
        } else {
            // 淡出：从targetX开始
            button.currentX = button.targetX;
        }
    }
    
    updateButtonSlideAnimations() {
        // 更新Resume按钮
        if (this.resumeButton.isAnimating) {
            const elapsed = Date.now() - this.resumeButton.animationStartTime;
            const progress = Math.min(elapsed / this.resumeButton.animationDuration, 1);
            
            const easedProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            if (this.resumeButton.animationSlideIn) {
                // 淡入：从startX到targetX
                this.resumeButton.currentX = this.resumeButton.startX + 
                    (this.resumeButton.targetX - this.resumeButton.startX) * easedProgress;
            } else {
                // 淡出：从targetX回到startX
                this.resumeButton.currentX = this.resumeButton.targetX - 
                    (this.resumeButton.targetX - this.resumeButton.startX) * easedProgress;
            }
            
            if (progress >= 1) {
                this.resumeButton.isAnimating = false;
                if (this.resumeButton.animationSlideIn) {
                    this.resumeButton.currentX = this.resumeButton.targetX;
                } else {
                    this.resumeButton.currentX = this.resumeButton.startX;
                }
            }
        }
        
        // 更新Quit按钮
        if (this.quitButton.isAnimating) {
            const elapsed = Date.now() - this.quitButton.animationStartTime;
            const progress = Math.min(elapsed / this.quitButton.animationDuration, 1);
            
            const easedProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            if (this.quitButton.animationSlideIn) {
                // 淡入：从startX到targetX
                this.quitButton.currentX = this.quitButton.startX + 
                    (this.quitButton.targetX - this.quitButton.startX) * easedProgress;
            } else {
                // 淡出：从targetX回到startX
                this.quitButton.currentX = this.quitButton.targetX - 
                    (this.quitButton.targetX - this.quitButton.startX) * easedProgress;
            }
            
            if (progress >= 1) {
                this.quitButton.isAnimating = false;
                if (this.quitButton.animationSlideIn) {
                    this.quitButton.currentX = this.quitButton.targetX;
                } else {
                    this.quitButton.currentX = this.quitButton.startX;
                }
            }
        }
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
        } else if (currentPhase >= 10 && currentPhase <= 15) {
            // Phase 10-15：主界面
            this.renderMainGameScreen();
        } else {
            // 关卡选择或其他阶段：黑屏
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        
        // 检查phase是否变化
        if (currentPhase !== this.lastPhase) {
            // 保存旧的phase值（用于退出检测）
            const oldPhase = this.lastPhase;
            this.lastPhase = currentPhase;
            // phase变化时重置hover状态
            this.playButton.isHovered = false;
            this.helpButton.isHovered = false;
            // tutorialButton 已删除
            this.backButton.isHovered = false;
            this.backButtonPhase2.isHovered = false;
            this.leftArrowButton.isHovered = false;
            this.rightArrowButton.isHovered = false;
            this.helpButtonPhase1.isHovered = false;
            // tutorialButtonPhase1 已删除
            
            // 重置phase0按钮的填充进度（避免回来时显示填充白色）
            if (currentPhase === 0) {
                this.playButtonFillProgress = 0;
                this.helpButtonFillProgress = 0;
                this.playButtonFillAnimation.isAnimating = false;
                this.helpButtonFillAnimation.isAnimating = false;
            }
            
            // 离开phase 10-15时，重置暂停状态并退出关卡模式
            if (oldPhase >= 10 && oldPhase <= 15 && currentPhase < 10) {
                // 退出关卡模式：清除迷宫障碍物和重置位置
                if (this.levelSelection3D) {
                    this.levelSelection3D.exitLevel();
                }
            }
            
            // 在phase 1或phase 10-15时，根据状态决定是否拦截鼠标事件
            if (currentPhase === 1) {
                // Phase 1: Level Selection，不拦截鼠标事件（让3D模型可以接收点击）
                // UI按钮的点击通过LevelSelection3D转发处理
                this.canvas.style.pointerEvents = 'none';
            } else if (currentPhase >= 10 && currentPhase <= 15) {
                // Phase 10-15: 主界面
                // 如果暂停，需要拦截鼠标事件（用于暂停菜单）
                // 如果未暂停，不拦截鼠标事件（让3D模型可以接收点击）
                this.canvas.style.pointerEvents = this.isPaused ? 'auto' : 'none';
            } else {
                this.canvas.style.pointerEvents = 'auto';
                if (this.isPaused) {
                    this.isPaused = false;
                    this.pauseOverlay.alpha = 0;
                    this.resumeButton.currentX = this.resumeButton.startX;
                    this.quitButton.currentX = this.quitButton.startX;
                    this.resumeButton.isAnimating = false;
                    this.quitButton.isAnimating = false;
                }
            }
            
            // 进入phase1或phase10-15时，重置level并初始化3D场景
            if (currentPhase === 1 || (currentPhase >= 10 && currentPhase <= 15)) {
                // Phase 1: Level Selection界面
                if (currentPhase === 1) {
                    // Phase 1: Level Selection界面
                    // 如果有最后退出的关卡，自动切换到那个关卡；否则默认level为1
                    if (this.levelSelection3D && this.levelSelection3D.lastExitedLevel) {
                        this.level = this.levelSelection3D.lastExitedLevel;
                        // console.log(`UI: Restoring to last exited level: ${this.level}`);
                    } else {
                        this.level = 1;
                    }
                    this.levelAnimation.newLevel = this.level;
                    this.levelAnimation.oldLevel = this.level;
                    
                    // 更新3D场景的level（如果已经初始化）
                    if (this.levelSelection3D) {
                        this.levelSelection3D.currentLevel = this.level;
                        this.levelSelection3D.updateLevel(this.level);
                    }
                } else {
                    // Phase 10-15: 主界面，如果不是 tutorial，保持之前的level或设为1
                    if (this.level === undefined || this.level === null) {
                        this.level = 1;
                    }
                    this.levelAnimation.newLevel = this.level;
                    this.levelAnimation.oldLevel = this.level;
                }
                
                // 更新label文本（不触发动画）
                // 更新关卡标签文本
                this.levelLabel.text = `Level ${this.level}`;
                
                // 初始化3D场景（如果还没有初始化）
                if (!this.levelSelection3D) {
                    const container = this.canvas.parentElement;
                    if (container) {
                        this.levelSelection3D = new LevelSelection3D(container, this.width, this.height);
                        // 将UI实例传递给LevelSelection3D，以便它可以访问暂停状态
                        this.levelSelection3D.uiInstance = this;
                    }
                }
                
                // 更新3D场景的level
                if (this.levelSelection3D) {
                    // 正常情况下的更新
                    this.levelSelection3D.updateLevel(this.level);
                    
                    // 确保 UI 实例被传递给 LevelContent3D（用于暂停功能）
                    if (this.levelSelection3D.levelContent && !this.levelSelection3D.levelContent.uiInstance) {
                        this.levelSelection3D.levelContent.setUIInstance(this);
                    }
                }
            } else {
                // 离开phase1时，可以清理3D场景（可选）
                // if (this.levelSelection3D) {
                //     this.levelSelection3D.dispose();
                //     this.levelSelection3D = null;
                // }
            }
        }
        
        // 在phase1或phase10-15时，渲染3D模型
        // 注意：level 的更新由 LevelSelection3D 在点击箭头时直接控制，这里只负责渲染
        if ((currentPhase === 1 || (currentPhase >= 10 && currentPhase <= 15)) && this.levelSelection3D) {
            // 只在 phase 变化时同步 level，避免每帧都调用 updateLevel
            // LevelSelection3D 自己会在点击箭头时调用 updateLevel
            this.levelSelection3D.render();
        }
    }
    
    renderMainMenu() {
        // 绘制标题 "Cubers" 在顶部居中
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold 120px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('Cubers', this.width / 2, 50);
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
    
    renderButton(button, currentColor, currentFontSize, customX = null) {
        const isPlay = (button === this.playButton);
        const fillProgress = isPlay ? this.playButtonFillProgress : this.helpButtonFillProgress;
        const x = customX !== null ? customX : button.x;
        
        // 绘制按钮（黑色填充）
        this.drawRoundedRect(
            x,
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
                x,
                button.y,
                button.width,
                button.height,
                button.cornerRadius
            );
            this.ctx.clip();
            
            // 绘制从左到右的白色填充
            const fillWidth = button.width * fillProgress;
            this.drawRoundedRect(
                x,
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
            x,
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
            x + button.width / 2,
            button.y + button.height / 2
        );
    }
    
    renderButtonAtPosition(button, currentColor, currentFontSize, x) {
        // 暂停菜单按钮不使用填充效果
        const fillProgress = 0;
        
        // 绘制按钮（黑色填充）
        this.drawRoundedRect(
            x,
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
                x,
                button.y,
                button.width,
                button.height,
                button.cornerRadius
            );
            this.ctx.clip();
            
            // 绘制从左到右的白色填充
            const fillWidth = button.width * fillProgress;
            this.drawRoundedRect(
                x,
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
            x,
            button.y,
            button.width,
            button.height,
            button.cornerRadius
        );
        this.ctx.stroke();
        
        // 绘制文字（暂停菜单按钮文字始终白色）
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${currentFontSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            button.text,
            x + button.width / 2,
            button.y + button.height / 2
        );
    }
    
    renderLevelSelection() {
        // 更新hover字体大小（平滑过渡）
        this.updateButtonHoverSize(this.backButton, 'backButtonHoverFontSize');
        this.updateButtonHoverSize(this.leftArrowButton, 'leftArrowButtonHoverFontSize');
        this.updateButtonHoverSize(this.rightArrowButton, 'rightArrowButtonHoverFontSize');
        this.updateButtonHoverSize(this.helpButtonPhase1, 'helpButtonPhase1HoverFontSize');
        // tutorialButtonPhase1 已删除
        
        // 顶部居中标题
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('Level Selection', this.width / 2, 40);
        
        // 渲染箭头按钮（统一样式，使用hover字体大小）
        // 判断左右箭头按钮是否可用
        const leftArrowEnabled = this.level > 1;
        const rightArrowEnabled = this.level < 5;
        
        this.renderArrowButton(this.backButton, this.backButtonHoverFontSize);
        this.renderArrowButton(this.leftArrowButton, this.leftArrowButtonHoverFontSize, leftArrowEnabled);
        this.renderArrowButton(this.rightArrowButton, this.rightArrowButtonHoverFontSize, rightArrowEnabled);
        this.renderArrowButton(this.helpButtonPhase1, this.helpButtonPhase1HoverFontSize);
        // tutorialButtonPhase1 已删除
        
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
    
    renderMainGameScreen() {
        // 更新暂停菜单动画
        this.updateOverlayAnimation();
        this.updateButtonSlideAnimations();
        
        // 更新按钮颜色和字体大小
        if (this.isPaused) {
            this.updateButtonColor(this.resumeButton, 'resumeButtonColor');
            this.updateButtonColor(this.quitButton, 'quitButtonColor');
        }
        
        // 绘制暂停按钮（右上角两个白色竖条）
        if (!this.isPaused) {
            this.ctx.fillStyle = '#ffffff';
            const btn = this.pauseButton;
            const hoverAlpha = this.pauseButton.isHovered ? 0.8 : 1.0;
            this.ctx.globalAlpha = hoverAlpha;
            
            // 第一个竖条
            this.ctx.fillRect(btn.x, btn.y, btn.barWidth, btn.barHeight);
            // 第二个竖条
            this.ctx.fillRect(btn.x + btn.barWidth + btn.barSpacing, btn.y, btn.barWidth, btn.barHeight);
            
            this.ctx.globalAlpha = 1.0;
        }
        
        // 如果暂停，绘制黑幕和按钮
        if (this.isPaused) {
            // 绘制黑幕（透明度50%）
            this.ctx.fillStyle = `rgba(0, 0, 0, ${this.pauseOverlay.alpha * 0.5})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
            
            // 绘制Resume按钮（从左边滑入）
            // 使用currentX作为按钮的x坐标
            const resumeX = this.resumeButton.currentX;
            this.renderButtonAtPosition(
                this.resumeButton, 
                this.resumeButtonColor, 
                this.resumeButtonFontSize,
                resumeX
            );
            
            // 绘制Quit按钮（从右边滑入）
            const quitX = this.quitButton.currentX;
            this.renderButtonAtPosition(
                this.quitButton, 
                this.quitButtonColor, 
                this.quitButtonFontSize,
                quitX
            );
        }
    }
    
    renderHelpScreen() {
        // 更新hover字体大小（平滑过渡）
        this.updateButtonHoverSize(this.backButtonPhase2, 'backButtonPhase2HoverFontSize');
        // tutorialButton 已删除
        
        // 左上角标题（边距扩大）
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('Title', 60, 40);  // 左边距扩大3倍：20->60，上边距扩大2倍：20->40
        
        // 左上角正文（在标题下方，间距扩大2倍）
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Empty', 60, 140);  // 与标题间距从60扩大2倍到100，所以是40+100=140
        
        // 左下角Back按钮（使用统一箭头按钮样式，使用hover字体大小）
        this.renderArrowButton(this.backButtonPhase2, this.backButtonPhase2HoverFontSize);
        
        // tutorialButton 已删除
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
