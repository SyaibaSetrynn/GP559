/**
 * Test Pretraining System
 * Simple test to validate pretraining phases and integration
 */

import { pretrainingSystem } from './dqn/pretraining-system.js';
import { dqnIntegration } from './dqn/dqn-integration.js';

// Test pretraining phases info
function testPretrainingInfo() {
    console.log('=== Testing Pretraining System Info ===');
    
    // Get all phases
    const phases = pretrainingSystem.getAllPhases();
    console.log('Available phases:', phases.length);
    
    phases.forEach((phase, index) => {
        console.log(`Phase ${index + 1}: ${phase.name}`);
        console.log(`  Description: ${phase.description}`);
        console.log(`  Episodes: ${phase.episodes}, Max Steps: ${phase.maxSteps}`);
        console.log('');
    });
    
    // Test phase info retrieval
    const phase1Info = pretrainingSystem.getPhaseInfo(0);
    if (phase1Info) {
        console.log('Phase 1 detailed info:');
        console.log('  Reward config:', phase1Info.rewardConfig);
        console.log('  Success criteria:', phase1Info.successCriteria);
        console.log('  Environment config:', phase1Info.environmentConfig);
    }
}

// Test pretraining stats
function testPretrainingStats() {
    console.log('=== Testing Pretraining Stats ===');
    
    const stats = pretrainingSystem.getPretrainingStats();
    console.log('Current stats:', stats);
    
    // Test DQN integration stats
    if (typeof dqnIntegration !== 'undefined') {
        const integrationStats = dqnIntegration.getPretrainingStats();
        console.log('Integration stats:', integrationStats);
    }
}

// Test reward calculations
function testRewardCalculations() {
    console.log('=== Testing Reward Calculations ===');
    
    // Mock agent and environment for testing
    const mockAgent = {
        x: 10,
        y: 0,
        z: 10,
        startingPosition: { x: 0, y: 0, z: 0 }
    };
    
    const mockGameEnvironment = {
        criticalPointSystem: {
            criticalPoints: [
                {
                    cp: {
                        position: { x: 15, y: 0, z: 15 }
                    }
                }
            ]
        }
    };
    
    const mockPhase = {
        name: "Basic Movement",
        rewardConfig: {
            movement: 1.0,
            exploration: 2.0,
            stuck: -5.0,
            cpProximity: 5.0
        }
    };
    
    const mockEpisodeStats = {
        cpVisited: 0,
        cpCaptured: 0,
        stuck: false
    };
    
    const prevPosition = { x: 8, y: 0, z: 8 };
    const action = 0; // Forward movement
    
    const reward = pretrainingSystem.calculatePhaseReward(
        mockAgent, prevPosition, action, mockPhase, null, mockGameEnvironment, mockEpisodeStats
    );
    
    console.log('Test reward calculation:', reward);
    console.log('Episode stats after reward calc:', mockEpisodeStats);
}

// Test environment configuration
function testEnvironmentConfiguration() {
    console.log('=== Testing Environment Configuration ===');
    
    const phase = pretrainingSystem.getPhaseInfo(0);
    if (phase) {
        console.log('Phase 0 environment config:');
        console.log('  Enable enemies:', phase.environmentConfig.enableEnemies);
        console.log('  Enable critical points:', phase.environmentConfig.enableCriticalPoints);
        console.log('  Simplified map:', phase.environmentConfig.simplifiedMap);
    }
    
    // Test different phases
    const phases = [1, 2, 3, 4];
    phases.forEach(phaseIndex => {
        const phaseInfo = pretrainingSystem.getPhaseInfo(phaseIndex);
        if (phaseInfo) {
            console.log(`\nPhase ${phaseIndex + 1} (${phaseInfo.name}) config:`);
            console.log('  Environment:', phaseInfo.environmentConfig);
            console.log('  Success criteria:', phaseInfo.successCriteria);
        }
    });
}

// Test episode success evaluation
function testEpisodeEvaluation() {
    console.log('=== Testing Episode Evaluation ===');
    
    const phases = pretrainingSystem.getAllPhases();
    
    phases.forEach((phase, index) => {
        const mockEpisodeResult = {
            totalReward: phase.successCriteria?.minAvgReward || 20,
            cpVisited: phase.successCriteria?.minCpVisited || 1,
            won: false,
            stuck: false,
            steps: phase.maxSteps / 2
        };
        
        const phaseInfo = pretrainingSystem.getPhaseInfo(index);
        const success = pretrainingSystem.evaluateEpisodeSuccess(mockEpisodeResult, phaseInfo);
        
        console.log(`Phase ${index + 1} (${phase.name}): Episode success = ${success}`);
        console.log(`  Mock result: reward=${mockEpisodeResult.totalReward}, cpVisited=${mockEpisodeResult.cpVisited}`);
    });
}

// Run all tests
function runAllTests() {
    console.log('Starting Pretraining System Tests...\n');
    
    try {
        testPretrainingInfo();
        testPretrainingStats();
        testRewardCalculations();
        testEnvironmentConfiguration();
        testEpisodeEvaluation();
        
        console.log('=== All Tests Completed ===');
        console.log('✅ Pretraining system appears to be working correctly!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    }
}

// Auto-run tests when script loads
if (typeof window !== 'undefined') {
    // Browser environment
    window.addEventListener('load', () => {
        setTimeout(runAllTests, 1000); // Wait for other systems to load
    });
} else {
    // Node.js environment
    runAllTests();
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.testPretraining = {
        runAllTests,
        testPretrainingInfo,
        testPretrainingStats,
        testRewardCalculations,
        testEnvironmentConfiguration,
        testEpisodeEvaluation
    };
}
