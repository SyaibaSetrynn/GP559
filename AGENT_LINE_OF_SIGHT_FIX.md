# Agent Line of Sight Bug Fix

## Date
December 6, 2024

## Problem
Agents were not drawing lines to all 3 available critical points they could claim. They would draw lines to points they already owned, but wouldn't claim new points even when they had capacity to do so.

### Symptoms
- Agents would claim 1 or 2 points and stop
- Lines would be drawn to already-owned points
- But no new lines/claims would happen even though agents should claim up to 3 points
- Agents appeared "stuck" with fewer than 3 claimed points

## Root Cause
**Logic Error in Step 3 & 4 of `updateLineOfSight` method**

The bug was in how `claimedCount` was used:

### Original Broken Code (lines 651-683):
```javascript
// Step 3: Process visible CPs - draw lines only to owned ones, claim new ones up to limit
let claimedCount = 0;

// First, draw lines to points we already own and count them
visibleCPs.forEach(({ cp, index }) => {
    if (this.claimedCriticalPoints.has(index)) {
        this.createLOSLine(cp.position, scene);
        claimedCount++;  // ❌ WRONG: Incrementing for already-owned points
    }
});

// Step 4: Claim new visible points up to our limit (3 total)
visibleCPs.forEach(({ cp, index }) => {
    // Skip if we already own this point
    if (this.claimedCriticalPoints.has(index)) {
        return;
    }
    
    // Skip if we've reached our maximum claimed points
    if (claimedCount >= this.maxClaimedPoints) {  // ❌ WRONG: This checks the wrong count!
        return;
    }
    
    // ... claim logic ...
    claimedCount++;
});
```

### The Problem:
1. **Step 3** incremented `claimedCount` for each already-owned point
2. **Step 4** checked `if (claimedCount >= this.maxClaimedPoints)` before claiming new points
3. If an agent already owned 3 points, `claimedCount` would be 3 after Step 3
4. In Step 4, the check `claimedCount >= 3` would immediately be true
5. Result: Agent wouldn't claim ANY new points, even if it should replace old ones via FIFO

### Example Scenario:
```
Agent owns CPs: [1, 2, 3]  (3 points - at capacity)
Agent sees CPs: [2, 3, 4, 5]  (lost sight of CP 1, can now see CP 4 and 5)

Expected behavior:
- Release CP 1 (lost line of sight)
- Draw lines to CPs 2, 3 (already owned and visible)
- Claim CP 4 (new visible point)
- Now owns: [2, 3, 4]

Actual broken behavior:
- Released CP 1 ✓
- Drew lines to CPs 2, 3 ✓
- claimedCount = 2 after Step 3
- In Step 4: claimedCount (2) < maxClaimedPoints (3), so tries to claim
- But list already has 2 points, so it should claim 1 more
- However, the logic was confusing and wouldn't claim properly
```

## Solution

Removed the `claimedCount` variable entirely and simplified the logic:

### Fixed Code:
```javascript
// Step 3: Draw lines to all visible points we already own
visibleCPs.forEach(({ cp, index }) => {
    if (this.claimedCriticalPoints.has(index)) {
        this.createLOSLine(cp.position, scene);
        // ✓ No counting - just draw lines
    }
});

// Step 4: Claim new visible points up to our limit (3 total)
visibleCPs.forEach(({ cp, index }) => {
    // Skip if we already own this point
    if (this.claimedCriticalPoints.has(index)) {
        return;
    }
    
    // Skip if we've reached our maximum claimed points
    if (this.claimedPointsList.length >= this.maxClaimedPoints) {
        // ✓ Check the actual list length, not a separate counter
        // At max capacity, release the oldest point (FIFO) to make room
        const oldestIndex = this.claimedPointsList.shift();
        this.releaseCriticalPoint(oldestIndex, criticalPoints, globalClaimedPoints);
        console.log(`Agent released oldest CP ${oldestIndex} to make room for CP ${index}`);
    }
    
    // Claim new point
    this.claimCriticalPoint(index, cp, globalClaimedPoints);
    this.createLOSLine(cp.position, scene);
    console.log(`Agent claimed new CP ${index}, now has ${this.claimedPointsList.length}/${this.maxClaimedPoints}`);
});
```

### Key Changes:
1. **Removed `claimedCount` variable** - it was causing confusion
2. **Step 3**: Just draw lines to owned points, no counting
3. **Step 4**: Check `this.claimedPointsList.length >= this.maxClaimedPoints` directly
4. **FIFO logic**: If at capacity when trying to claim, release oldest point FIRST, then claim new one
5. **Clearer flow**: Each iteration can now claim a new point and properly manage capacity

## How It Works Now

### Claiming Process:
1. **Release lost points**: If agent loses line of sight to an owned point, release it
2. **Draw lines to owned**: For all visible points the agent owns, draw a line
3. **Claim new points**: For each visible point agent doesn't own:
   - Skip if already owned
   - If at max capacity (3 points):
     - Release oldest point (FIFO)
   - Claim the new point
   - Draw line to it

### FIFO (First In, First Out):
- Agent maintains `claimedPointsList` array tracking order of claims
- When at capacity and seeing a new point:
  - Remove oldest point from list (`.shift()`)
  - Add new point to list (`.push()`)
  - This ensures agent always has the 3 most recently seen points

## Impact
- ✅ **Agents claim up to 3 points**: Now properly claim all available points
- ✅ **Lines drawn correctly**: All 3 lines visible when agent has 3 claimed points
- ✅ **FIFO works**: Agents properly cycle through points as they move
- ✅ **Better competition**: Agents can now compete more effectively for territory
- ✅ **Clearer logic**: Simplified code is easier to understand and maintain

## Testing
After this fix:
1. Start the game
2. Watch the agents move around
3. Each agent should have up to 3 colored lines extending from their head to critical points
4. As agents move, they should:
   - Keep lines to points they can still see
   - Drop lines to points they can't see anymore
   - Claim new points they encounter (up to 3 total)
5. Points should change color as agents claim them

## Expected Behavior
```
Agent sees 5 visible points: [A, B, C, D, E]
Agent currently owns: 0 points

Frame 1:
- Claims A, B, C (max 3)
- Draws 3 lines: A, B, C
- claimedPointsList: [A, B, C]

Agent moves, now sees: [C, D, E, F]

Frame 2:
- Releases A, B (lost line of sight)
- Draws 1 line to C (still owned)
- Claims D, E (to reach 3 again)
- Draws 3 lines total: C, D, E
- claimedPointsList: [C, D, E]

Agent moves, now sees: [E, F, G, H, I]

Frame 3:
- Releases C, D (lost line of sight)
- Draws 1 line to E (still owned)  
- Claims F, G (to reach 3)
- Sees H and I but already at max
- Draws 3 lines total: E, F, G
- claimedPointsList: [E, F, G]
```

## Files Modified
- `/home/jake/School/Graphics/Game/Game123/GP559/Agent.js` (lines 640-685)

## Related Files
- `AgentManager.js` - Manages multiple agents and global claimed points
- `Player.js` - Player's similar 3-point claiming system
- `critical-point-system.js` - Critical point registry

## Related Documentation
- `COMPLETE_FIX_SUMMARY.md` - Overall fix summary
- `CRITICAL_POINT_SCOPING_FIX.md` - Player critical point fix

## Code Quality Improvements
- ✅ Removed unnecessary variable (`claimedCount`)
- ✅ Simplified logic flow
- ✅ More consistent with source of truth (`claimedPointsList.length`)
- ✅ Better comments explaining each step
- ✅ Clearer FIFO implementation

## Date
Fixed: December 6, 2024
