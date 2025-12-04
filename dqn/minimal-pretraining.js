/**
 * Minimal Pretraining Test
 * Simple test to debug why pretraining completes instantly
 */

export class MinimalPretraining {
    constructor() {
        this.isActive = false;
    }

    async startTest() {
        console.log('🔍 Starting minimal pretraining test...');
        this.isActive = true;
        
        try {
            // Test basic async/await
            console.log('Step 1: Basic async test');
            await this.delay(100);
            console.log('Step 1 completed');
            
            // Test episode loop
            console.log('Step 2: Episode loop test');
            for (let i = 0; i < 3; i++) {
                console.log(`Episode ${i + 1} starting...`);
                await this.delay(50);
                console.log(`Episode ${i + 1} completed`);
                
                if (!this.isActive) {
                    console.log('Test stopped by user');
                    break;
                }
            }
            
            console.log('✅ Minimal test completed successfully');
            
        } catch (error) {
            console.error('❌ Minimal test error:', error);
        } finally {
            this.isActive = false;
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stop() {
        this.isActive = false;
        console.log('⏹️ Minimal test stopped');
    }
}

// Export for testing
export const minimalPretraining = new MinimalPretraining();
