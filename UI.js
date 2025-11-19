// UI.js - 用户界面管理

class UI {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Play按钮属性
        this.playButton = {
            x: this.width / 2 - 75,  // 居中，150宽度的一半
            y: this.height / 2 - 50,  // 居中，100高度的一半
            width: 150,
            height: 100,
            cornerRadius: 10,
            baseColor: '#000000',      // 黑色填充
            hoverColor: '#2a2a2a',     // hover时稍微变浅
            strokeColor: '#ffffff',    // 白色描边
            text: 'Play',
            fontSize: 32,
            baseFontSize: 32,
            clickFontSize: 28,
            isHovered: false,
            isClicked: false
        };
        
        // 动画相关
        this.currentColor = this.playButton.baseColor;
        this.currentFontSize = this.playButton.baseFontSize;
        this.animationFrame = null;
        this.lastPhase = -1;
        
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
            this.playButton.isHovered = false;
            this.render();
        });
        
        // 鼠标点击事件
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.isPointInButton(x, y)) {
                this.handleClick();
            }
        });
    }
    
    checkHover(x, y) {
        // 只在主界面时检查hover
        if (typeof StateManager !== 'undefined' && StateManager.getPhase() !== 0) {
            this.playButton.isHovered = false;
            return;
        }
        
        const wasHovered = this.playButton.isHovered;
        this.playButton.isHovered = this.isPointInButton(x, y);
        
        if (wasHovered !== this.playButton.isHovered) {
            // render会在循环中自动调用
        }
    }
    
    isPointInButton(x, y) {
        const btn = this.playButton;
        return x >= btn.x && x <= btn.x + btn.width &&
               y >= btn.y && y <= btn.y + btn.height;
    }
    
    handleClick() {
        if (this.playButton.isClicked) return;
        
        // 只在主界面时响应点击
        if (typeof StateManager !== 'undefined' && StateManager.getPhase() !== 0) {
            return;
        }
        
        this.playButton.isClicked = true;
        this.currentFontSize = this.playButton.clickFontSize;
        this.render();
        
        // 恢复字体大小
        setTimeout(() => {
            this.currentFontSize = this.playButton.baseFontSize;
            this.playButton.isClicked = false;
            
            // 进入关卡选择界面
            if (typeof StateManager !== 'undefined') {
                StateManager.setPhase(1);
            }
            this.render();
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
        
        // 清空画布
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 绘制背景
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 根据phase决定渲染内容
        if (currentPhase === 0) {
            // 主界面：显示Play按钮
            this.renderMainMenu();
        } else {
            // 关卡选择或其他阶段：黑屏
            // 已经绘制了黑色背景，不需要额外内容
        }
        
        // 检查phase是否变化
        if (currentPhase !== this.lastPhase) {
            this.lastPhase = currentPhase;
            // phase变化时重置hover状态
            if (currentPhase !== 0) {
                this.playButton.isHovered = false;
            }
        }
    }
    
    renderMainMenu() {
        // 只在主界面时检查hover
        if (this.playButton.isHovered) {
            const targetColor = this.playButton.hoverColor;
            this.currentColor = this.lerpColor(this.currentColor, targetColor, 0.2);
        } else {
            const targetColor = this.playButton.baseColor;
            this.currentColor = this.lerpColor(this.currentColor, targetColor, 0.2);
        }
        
        // 绘制Play按钮（黑色填充）
        this.drawRoundedRect(
            this.playButton.x,
            this.playButton.y,
            this.playButton.width,
            this.playButton.height,
            this.playButton.cornerRadius
        );
        this.ctx.fillStyle = this.currentColor;
        this.ctx.fill();
        
        // 绘制白色描边
        this.ctx.strokeStyle = this.playButton.strokeColor;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // 绘制文字
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${this.currentFontSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            this.playButton.text,
            this.playButton.x + this.playButton.width / 2,
            this.playButton.y + this.playButton.height / 2
        );
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
