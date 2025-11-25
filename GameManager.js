/**
 * Whitewasher Game Manager
 * 管理所有游戏机制的核心类
 * IMPORTANT: This class is not used.
 */

class GameManager {
    constructor() {
        // 游戏状态
        this.gameTime = 0; // 游戏时间（秒）
        this.gammaRayStartTime = 120; // 伽马射线开始时间
        this.gammaRayIntensity = 0; // 当前伽马射线强度
        this.gammaRayBaseRate = 0.1; // 伽马射线基础增长率
        
        // 玩家列表
        this.players = [];
        
        // 地形块列表
        this.terrainBlocks = [];
        
        // 道具列表
        this.props = [];
        
        // 核爆炸列表（用于视觉效果）
        this.nuclearExplosions = [];
        
        // 游戏配置
        this.config = {
            spotlightIntensity: 1.0, // 手电筒基础强度
            laserIntensity: 10.0, // 激光基础强度（手电筒的10倍）
            laserMaxDuration: 2.0, // 激光最大持续时间（秒）
            laserCooldown: 0.25, // 激光冷却时间（秒）
            criticalPointFillTime: 3.0, // 关键点填充时间（秒，在正常手电筒中心）
            invisibleShieldDuration: 5.0, // 隐形盾牌持续时间
            laserPackCharge: 0.5, // 激光包充能时间
            nuclearBombDuration: 1.0, // 核弹白光持续时间
            reactorGammaRate: 0.5, // 反应堆伽马射线产生率
        };
    }

    /**
     * 初始化游戏
     * @param {number} playerCount - 玩家数量
     * @param {Array} terrainBlocks - 地形块数组
     */
    initializeGame(playerCount, terrainBlocks = []) {
        this.players = [];
        this.terrainBlocks = terrainBlocks;
        this.gameTime = 0;
        this.gammaRayIntensity = 0;
        
        // 初始化玩家
        for (let i = 0; i < playerCount; i++) {
            this.players.push(this.createPlayer(i));
        }
    }

    /**
     * 创建玩家
     * @param {number} id - 玩家ID
     * @returns {Object} 玩家对象
     */
    createPlayer(id) {
        // 生成初始颜色：R+G+B=100，其中一个至少是其他两个之和的2倍
        const color = this.generateInitialColor();
        
        return {
            id: id,
            color: color,
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            isAlive: true,
            
            // 手电筒状态
            spotlight: {
                isOn: false,
                intensity: this.config.spotlightIntensity,
                direction: { x: 0, y: 0, z: 1 }
            },
            
            // 激光状态
            laser: {
                isOn: false,
                charge: 2.0, // 最大充能
                maxCharge: 2.0,
                intensity: this.config.laserIntensity,
                direction: { x: 0, y: 0, z: 1 },
                lastUseTime: 0
            },
            
            // 移动状态
            movement: {
                speed: 1.0,
                jumpHeight: 1.0,
                isGrounded: false
            },
            
            // 道具效果
            effects: {
                invisibleShield: {
                    active: false,
                    endTime: 0
                }
            },
            
            // 射线类型（根据颜色计算）
            rayType: this.calculateRayType(color),
            
            // 分数
            score: 0
        };
    }

    /**
     * 生成初始颜色
     * @returns {Object} RGB颜色对象
     */
    generateInitialColor() {
        // R+G+B=100，其中一个至少是其他两个之和的2倍
        const total = 100;
        let r, g, b;
        
        // 随机选择主色（R、G或B）
        const primaryColor = Math.floor(Math.random() * 3);
        
        if (primaryColor === 0) {
            // 红色为主
            r = Math.floor(Math.random() * 50) + 50; // 50-100
            const remaining = total - r;
            g = Math.floor(Math.random() * (remaining / 3));
            b = remaining - g;
        } else if (primaryColor === 1) {
            // 绿色为主
            g = Math.floor(Math.random() * 50) + 50;
            const remaining = total - g;
            r = Math.floor(Math.random() * (remaining / 3));
            b = remaining - r;
        } else {
            // 蓝色为主
            b = Math.floor(Math.random() * 50) + 50;
            const remaining = total - b;
            r = Math.floor(Math.random() * (remaining / 3));
            g = remaining - r;
        }
        
        return { r, g, b };
    }

    /**
     * 计算射线类型
     * @param {Object} color - RGB颜色对象
     * @returns {string} 射线类型：'red', 'green', 'blue', 'gamma', 'none'
     */
    calculateRayType(color) {
        const { r, g, b } = color;
        const sum = r + g + b;
        
        // 检查是否是彩色射线（R、G或B>=150，且大于其他两个之和）
        if (r >= 150 && r > g + b) {
            return 'red';
        }
        if (g >= 150 && g > r + b) {
            return 'green';
        }
        if (b >= 150 && b > r + g) {
            return 'blue';
        }
        
        return 'none';
    }

    /**
     * 更新游戏（每帧调用）
     * @param {number} deltaTime - 帧时间差（秒）
     */
    update(deltaTime) {
        this.gameTime += deltaTime;
        
        // 更新伽马射线
        this.updateGammaRays(deltaTime);
        
        // 更新所有玩家
        this.players.forEach(player => {
            if (player.isAlive) {
                this.updatePlayer(player, deltaTime);
            }
        });
        
        // 更新地形块
        this.terrainBlocks.forEach(block => {
            this.updateTerrainBlock(block, deltaTime);
        });
        
        // 更新道具
        this.updateProps(deltaTime);
        
        // 更新核爆炸效果
        this.updateNuclearExplosions(deltaTime);
        
        // 检查玩家死亡
        this.checkPlayerDeaths();
    }

    /**
     * 更新玩家
     * @param {Object} player - 玩家对象
     * @param {number} deltaTime - 帧时间差
     */
    updatePlayer(player, deltaTime) {
        // 更新射线类型（颜色可能已改变）
        player.rayType = this.calculateRayType(player.color);
        
        // 应用射线类型效果
        this.applyRayTypeEffects(player);
        
        // 更新激光充能
        if (!player.laser.isOn && player.laser.charge < player.laser.maxCharge) {
            player.laser.charge = Math.min(
                player.laser.charge + deltaTime,
                player.laser.maxCharge
            );
        }
        
        // 更新道具效果
        if (player.effects.invisibleShield.active) {
            if (this.gameTime >= player.effects.invisibleShield.endTime) {
                player.effects.invisibleShield.active = false;
            }
        }
        
        // 应用伽马射线效果
        this.applyGammaRayToPlayer(player, deltaTime);
    }

    /**
     * 应用射线类型效果
     * @param {Object} player - 玩家对象
     */
    applyRayTypeEffects(player) {
        const rayType = player.rayType;
        
        // 重置效果
        player.movement.speed = 1.0;
        player.movement.jumpHeight = 1.0;
        player.spotlight.intensity = this.config.spotlightIntensity;
        player.laser.intensity = this.config.laserIntensity;
        
        // 应用射线效果
        if (rayType === 'red') {
            // 红色射线：激光半径+2（需要在渲染层实现），手电筒强度+25%
            player.spotlight.intensity *= 1.25;
        } else if (rayType === 'green') {
            // 绿色射线：对R和B元素有25%抗性（在受到激光攻击时应用）
            // 这个效果在applyLaserToPlayer中处理
        } else if (rayType === 'blue') {
            // 蓝色射线：速度+20%，跳跃高度+20%
            player.movement.speed *= 1.2;
            player.movement.jumpHeight *= 1.2;
        }
    }

    /**
     * 应用伽马射线到玩家
     * @param {Object} player - 玩家对象
     * @param {number} deltaTime - 帧时间差
     */
    applyGammaRayToPlayer(player, deltaTime) {
        if (this.gameTime < this.gammaRayStartTime) {
            return;
        }
        
        // 计算伽马射线强度（随时间增加）
        const timeSinceStart = this.gameTime - this.gammaRayStartTime;
        this.gammaRayIntensity = this.gammaRayBaseRate * (1 + timeSinceStart / 100);
        
        // 增加所有玩家的RGB
        player.color.r = Math.min(255, player.color.r + this.gammaRayIntensity * deltaTime);
        player.color.g = Math.min(255, player.color.g + this.gammaRayIntensity * deltaTime);
        player.color.b = Math.min(255, player.color.b + this.gammaRayIntensity * deltaTime);
    }

    /**
     * 切换手电筒
     * @param {number} playerId - 玩家ID
     * @param {boolean} isOn - 是否开启
     */
    toggleSpotlight(playerId, isOn) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.isAlive) return;
        
        player.spotlight.isOn = isOn;
        
        if (isOn) {
            // 手电筒开启时，玩家会发光（更容易被发现）
            // 这个效果需要在渲染层实现
        }
    }

    /**
     * 切换激光
     * @param {number} playerId - 玩家ID
     * @param {boolean} isOn - 是否开启
     */
    toggleLaser(playerId, isOn) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.isAlive) return;
        
        if (isOn) {
            // 检查充能和冷却
            if (player.laser.charge <= 0) {
                return; // 没有充能
            }
            
            const timeSinceLastUse = this.gameTime - player.laser.lastUseTime;
            if (timeSinceLastUse < this.config.laserCooldown && player.laser.lastUseTime > 0) {
                return; // 还在冷却中
            }
            
            player.laser.isOn = true;
            // 激光开启时，玩家会发光更强（需要在渲染层实现）
        } else {
            player.laser.isOn = false;
            player.laser.lastUseTime = this.gameTime;
        }
    }

    /**
     * 更新激光（每帧调用，消耗充能）
     * @param {number} playerId - 玩家ID
     * @param {number} deltaTime - 帧时间差
     */
    updateLaser(playerId, deltaTime) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.isAlive || !player.laser.isOn) return;
        
        // 消耗充能
        player.laser.charge = Math.max(0, player.laser.charge - deltaTime);
        
        // 如果充能用完，自动关闭
        if (player.laser.charge <= 0) {
            this.toggleLaser(playerId, false);
        }
        
        // 检查是否超过最大持续时间
        const laserDuration = this.gameTime - (player.laser.lastUseTime || this.gameTime);
        if (laserDuration >= this.config.laserMaxDuration) {
            this.toggleLaser(playerId, false);
        }
    }

    /**
     * 应用手电筒到关键点
     * @param {number} playerId - 玩家ID
     * @param {Object} criticalPoint - 关键点对象
     * @param {number} deltaTime - 帧时间差
     * @param {number} distance - 距离（用于计算强度衰减）
     */
    applySpotlightToCriticalPoint(playerId, criticalPoint, deltaTime, distance = 0) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.isAlive || !player.spotlight.isOn) return;
        
        // 计算强度（考虑距离衰减，这里简化处理）
        const intensity = player.spotlight.intensity / (1 + distance * 0.1);
        
        // 填充关键点
        const fillAmount = intensity * deltaTime;
        this.fillCriticalPoint(criticalPoint, player.color, fillAmount);
    }

    /**
     * 应用激光到关键点
     * @param {number} playerId - 玩家ID
     * @param {Object} criticalPoint - 关键点对象
     */
    applyLaserToCriticalPoint(playerId, criticalPoint) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.isAlive || !player.laser.isOn) return;
        
        // 激光立即填充关键点
        this.fillCriticalPoint(criticalPoint, player.color, 999); // 立即填充
    }

    /**
     * 应用激光到玩家
     * @param {number} attackerId - 攻击者ID
     * @param {number} targetId - 目标玩家ID
     * @param {number} deltaTime - 帧时间差
     */
    applyLaserToPlayer(attackerId, targetId, deltaTime) {
        const attacker = this.players.find(p => p.id === attackerId);
        const target = this.players.find(p => p.id === targetId);
        
        if (!attacker || !attacker.isAlive || !attacker.laser.isOn) return;
        if (!target || !target.isAlive) return;
        
        // 检查目标是否有隐形盾牌
        if (target.effects.invisibleShield.active) {
            return; // 激光无效
        }
        
        // 计算激光颜色增量
        const laserUnitIntensity = attacker.laser.intensity;
        const laserR = attacker.color.r * deltaTime * laserUnitIntensity;
        const laserG = attacker.color.g * deltaTime * laserUnitIntensity;
        const laserB = attacker.color.b * deltaTime * laserUnitIntensity;
        
        // 应用绿色射线抗性
        let resistanceR = 1.0;
        let resistanceB = 1.0;
        if (target.rayType === 'green') {
            resistanceR = 0.75; // 25%抗性
            resistanceB = 0.75;
        }
        
        // 改变目标颜色
        target.color.r = Math.min(255, target.color.r + laserR * resistanceR);
        target.color.g = Math.min(255, target.color.g + laserG);
        target.color.b = Math.min(255, target.color.b + laserB * resistanceB);
        
        // 更新目标分数（按新颜色计算）
        this.updatePlayerScore(target);
    }

    /**
     * 填充关键点
     * @param {Object} criticalPoint - 关键点对象
     * @param {Object} color - RGB颜色对象
     * @param {number} fillAmount - 填充量
     */
    fillCriticalPoint(criticalPoint, color, fillAmount) {
        if (!criticalPoint.fillProgress) {
            criticalPoint.fillProgress = 0;
            criticalPoint.currentColor = { r: 0, g: 0, b: 0 };
        }
        
        // 计算需要的填充量（基于配置）
        const requiredFill = this.config.criticalPointFillTime * this.config.spotlightIntensity;
        
        // 增加填充进度
        criticalPoint.fillProgress += fillAmount;
        
        // 如果填充完成，改变颜色
        if (criticalPoint.fillProgress >= requiredFill) {
            criticalPoint.currentColor = { ...color };
            criticalPoint.fillProgress = requiredFill;
            criticalPoint.isFilled = true;
        } else {
            // 部分填充，颜色渐变
            const ratio = criticalPoint.fillProgress / requiredFill;
            criticalPoint.currentColor = {
                r: Math.floor(color.r * ratio),
                g: Math.floor(color.g * ratio),
                b: Math.floor(color.b * ratio)
            };
        }
    }

    /**
     * 更新地形块
     * @param {Object} block - 地形块对象
     * @param {number} deltaTime - 帧时间差
     */
    updateTerrainBlock(block, deltaTime) {
        if (!block.criticalPoints || block.criticalPoints.length === 0) {
            return;
        }
        
        // 统计每个颜色占据的关键点数量
        const colorCounts = {};
        block.criticalPoints.forEach(point => {
            if (point.isFilled && point.currentColor) {
                const colorKey = `${point.currentColor.r},${point.currentColor.g},${point.currentColor.b}`;
                colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
            }
        });
        
        // 找到占据最多关键点的颜色
        let dominantColor = null;
        let maxCount = 0;
        for (const [colorKey, count] of Object.entries(colorCounts)) {
            if (count > maxCount) {
                maxCount = count;
                const [r, g, b] = colorKey.split(',').map(Number);
                dominantColor = { r, g, b };
            }
        }
        
        // 检查是否占据至少1/2关键点
        const halfPoints = block.criticalPoints.length / 2;
        if (maxCount >= halfPoints && dominantColor) {
            block.dominantColor = dominantColor;
            block.glowIntensity = maxCount / block.criticalPoints.length;
            
            // 应用发光效果到玩家（如果玩家在块附近）
            this.applyBlockGlowToPlayers(block, deltaTime);
        } else {
            block.dominantColor = null;
            block.glowIntensity = 0;
        }
    }

    /**
     * 应用地形块发光效果到玩家
     * @param {Object} block - 地形块对象
     * @param {number} deltaTime - 帧时间差
     */
    applyBlockGlowToPlayers(block, deltaTime) {
        if (!block.dominantColor) return;
        
        const glowColor = block.dominantColor;
        const unitIntensity = block.glowIntensity * 5; // 5*UnitIntensity*deltaTime
        
        this.players.forEach(player => {
            if (!player.isAlive) return;
            
            // 检查玩家是否在块附近（这里简化处理，实际需要空间检测）
            // 如果所有关键点都是同一颜色，无论如何都会提升RGB
            const allSameColor = block.criticalPoints.every(point => 
                point.isFilled && 
                point.currentColor.r === glowColor.r &&
                point.currentColor.g === glowColor.g &&
                point.currentColor.b === glowColor.b
            );
            
            if (allSameColor) {
                // 所有关键点同色，无论如何都提升
                player.color.r = Math.min(255, player.color.r + unitIntensity * deltaTime);
                player.color.g = Math.min(255, player.color.g + unitIntensity * deltaTime);
                player.color.b = Math.min(255, player.color.b + unitIntensity * deltaTime);
            } else {
                // 只提升低于发光颜色的RGB分量
                if (player.color.r < glowColor.r) {
                    player.color.r = Math.min(glowColor.r, player.color.r + unitIntensity * deltaTime);
                }
                if (player.color.g < glowColor.g) {
                    player.color.g = Math.min(glowColor.g, player.color.g + unitIntensity * deltaTime);
                }
                if (player.color.b < glowColor.b) {
                    player.color.b = Math.min(glowColor.b, player.color.b + unitIntensity * deltaTime);
                }
            }
        });
    }

    /**
     * 检查玩家死亡
     */
    checkPlayerDeaths() {
        this.players.forEach(player => {
            if (!player.isAlive) return;
            
            // 如果颜色变成白色(255,255,255)，玩家死亡
            if (player.color.r >= 255 && player.color.g >= 255 && player.color.b >= 255) {
                this.killPlayer(player.id);
            }
        });
    }

    /**
     * 杀死玩家
     * @param {number} playerId - 玩家ID
     */
    killPlayer(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.isAlive) return;
        
        player.isAlive = false;
        
        // 创建核爆炸
        this.createNuclearExplosion(player.position);
    }

    /**
     * 创建核爆炸
     * @param {Object} position - 位置对象 {x, y, z}
     */
    createNuclearExplosion(position) {
        this.nuclearExplosions.push({
            position: { ...position },
            startTime: this.gameTime,
            duration: this.config.nuclearBombDuration,
            isActive: true
        });
        
        // 核爆炸会产生区域伽马射线
        // 这个效果在updateNuclearExplosions中处理
    }

    /**
     * 更新核爆炸效果
     * @param {number} deltaTime - 帧时间差
     */
    updateNuclearExplosions(deltaTime) {
        this.nuclearExplosions = this.nuclearExplosions.filter(explosion => {
            const elapsed = this.gameTime - explosion.startTime;
            
            if (elapsed >= explosion.duration) {
                explosion.isActive = false;
                return false; // 移除已结束的爆炸
            }
            
            // 核爆炸的白光可以给地形着色
            // 这里需要在渲染层实现
            
            // 产生区域伽马射线（影响附近玩家）
            this.applyRegionalGammaRay(explosion.position, deltaTime);
            
            return true;
        });
    }

    /**
     * 应用区域伽马射线
     * @param {Object} position - 位置对象
     * @param {number} deltaTime - 帧时间差
     */
    applyRegionalGammaRay(position, deltaTime) {
        const radius = 10; // 影响半径（需要根据实际调整）
        const intensity = 2.0; // 区域伽马射线强度
        
        this.players.forEach(player => {
            if (!player.isAlive) return;
            
            // 计算距离（简化处理）
            const distance = Math.sqrt(
                Math.pow(player.position.x - position.x, 2) +
                Math.pow(player.position.y - position.y, 2) +
                Math.pow(player.position.z - position.z, 2)
            );
            
            if (distance <= radius) {
                // 应用伽马射线效果
                player.color.r = Math.min(255, player.color.r + intensity * deltaTime);
                player.color.g = Math.min(255, player.color.g + intensity * deltaTime);
                player.color.b = Math.min(255, player.color.b + intensity * deltaTime);
            }
        });
    }

    /**
     * 更新道具
     * @param {number} deltaTime - 帧时间差
     */
    updateProps(deltaTime) {
        // 更新反应堆产生的伽马射线
        this.props.forEach(prop => {
            if (prop.type === 'reactor' && prop.isActive) {
                this.applyRegionalGammaRay(prop.position, deltaTime);
            }
        });
    }

    /**
     * 使用道具
     * @param {number} playerId - 玩家ID
     * @param {string} propType - 道具类型：'invisibleShield', 'laserPack', 'nuclearBomb', 'reactor'
     */
    useProp(playerId, propType) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.isAlive) return false;
        
        switch (propType) {
            case 'invisibleShield':
                player.effects.invisibleShield.active = true;
                player.effects.invisibleShield.endTime = this.gameTime + this.config.invisibleShieldDuration;
                return true;
                
            case 'laserPack':
                player.laser.charge = Math.min(
                    player.laser.maxCharge,
                    player.laser.charge + this.config.laserPackCharge
                );
                return true;
                
            case 'nuclearBomb':
                this.createNuclearExplosion(player.position);
                return true;
                
            case 'reactor':
                // 反应堆是持续效果，需要在场景中放置
                // 这里只是标记，实际需要在场景管理器中处理
                return true;
                
            default:
                return false;
        }
    }

    /**
     * 更新玩家分数
     * @param {Object} player - 玩家对象
     */
    updatePlayerScore(player) {
        // 根据玩家当前颜色计算分数
        // 这里简化处理，实际可能需要更复杂的计算
        player.score = player.color.r + player.color.g + player.color.b;
    }

    /**
     * 获取玩家信息
     * @param {number} playerId - 玩家ID
     * @returns {Object} 玩家信息对象
     */
    getPlayerInfo(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return null;
        
        return {
            id: player.id,
            color: { ...player.color },
            position: { ...player.position },
            isAlive: player.isAlive,
            rayType: player.rayType,
            score: player.score,
            spotlight: {
                isOn: player.spotlight.isOn,
                intensity: player.spotlight.intensity
            },
            laser: {
                isOn: player.laser.isOn,
                charge: player.laser.charge,
                maxCharge: player.laser.maxCharge
            },
            effects: {
                invisibleShield: player.effects.invisibleShield.active
            }
        };
    }

    /**
     * 获取所有玩家信息
     * @returns {Array} 玩家信息数组
     */
    getAllPlayersInfo() {
        return this.players.map(player => this.getPlayerInfo(player.id));
    }

    /**
     * 获取游戏状态
     * @returns {Object} 游戏状态对象
     */
    getGameState() {
        return {
            gameTime: this.gameTime,
            gammaRayActive: this.gameTime >= this.gammaRayStartTime,
            gammaRayIntensity: this.gammaRayIntensity,
            alivePlayers: this.players.filter(p => p.isAlive).length,
            totalPlayers: this.players.length
        };
    }

    /**
     * 设置玩家位置（由移动系统调用）
     * @param {number} playerId - 玩家ID
     * @param {Object} position - 位置对象 {x, y, z}
     */
    setPlayerPosition(playerId, position) {
        const player = this.players.find(p => p.id === playerId);
        if (player && player.isAlive) {
            player.position = { ...position };
        }
    }

    /**
     * 设置玩家速度（由移动系统调用）
     * @param {number} playerId - 玩家ID
     * @param {Object} velocity - 速度对象 {x, y, z}
     */
    setPlayerVelocity(playerId, velocity) {
        const player = this.players.find(p => p.id === playerId);
        if (player && player.isAlive) {
            player.velocity = { ...velocity };
        }
    }

    /**
     * 设置手电筒方向
     * @param {number} playerId - 玩家ID
     * @param {Object} direction - 方向对象 {x, y, z}
     */
    setSpotlightDirection(playerId, direction) {
        const player = this.players.find(p => p.id === playerId);
        if (player && player.isAlive) {
            player.spotlight.direction = { ...direction };
        }
    }

    /**
     * 设置激光方向
     * @param {number} playerId - 玩家ID
     * @param {Object} direction - 方向对象 {x, y, z}
     */
    setLaserDirection(playerId, direction) {
        const player = this.players.find(p => p.id === playerId);
        if (player && player.isAlive) {
            player.laser.direction = { ...direction };
        }
    }

    /**
     * 添加地形块
     * @param {Object} block - 地形块对象，需要包含criticalPoints数组
     */
    addTerrainBlock(block) {
        if (!block.criticalPoints) {
            block.criticalPoints = [];
        }
        this.terrainBlocks.push(block);
    }

    /**
     * 添加道具
     * @param {Object} prop - 道具对象 {type, position, isActive}
     */
    addProp(prop) {
        this.props.push(prop);
    }
}

// 导出GameManager类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameManager;
}

