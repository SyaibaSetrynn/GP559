// Quick test for reward system validation
import { rewardSystem } from './dqn/reward-system.js';

console.log('Testing enhanced reward system...');

const validation = rewardSystem.validateRewards();
console.log('Validation result:', validation);

const config = rewardSystem.getRewardConfig();
console.log('Reward configuration:', config);

console.log('Reward breakdown:');
for (const [name, value] of Object.entries(config.rewards)) {
    console.log(`  ${name}: ${value}`);
}
