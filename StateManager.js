// StateManager.js - 游戏状态管理

class StateManager {
    // phase: 0 为主界面，正数对应关卡
    static phase = 0;

    /**
     * 获取当前阶段
     * @returns {number} 当前阶段值，0为主界面，正数为关卡
     */
    static getPhase() {
        return this.phase;
    }

    /**
     * 设置阶段
     * @param {number} newPhase - 新的阶段值，0为主界面，正数为关卡
     */
    static setPhase(newPhase) {
        if (typeof newPhase !== 'number' || newPhase < 0 || !Number.isInteger(newPhase)) {
            console.warn('StateManager: phase 必须是大于等于0的整数');
            return;
        }
        this.phase = newPhase;
    }

    /**
     * 判断是否在主界面
     * @returns {boolean} 是否在主界面
     */
    static isMainMenu() {
        return this.phase === 0;
    }

    /**
     * 判断是否在关卡中
     * @returns {boolean} 是否在关卡中
     */
    static isInLevel() {
        return this.phase > 0;
    }

    /**
     * 获取当前关卡编号（如果不在关卡中返回0）
     * @returns {number} 关卡编号
     */
    static getLevelNumber() {
        return this.phase > 0 ? this.phase : 0;
    }
}

