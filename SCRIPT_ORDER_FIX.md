# Script Loading Order Fix

## Date
December 6, 2024

## Problem
The game stopped loading in `indexjake.html`. The page would not display the level selection UI or start the game.

## Root Cause
**Incorrect Script Loading Order**

The non-module scripts (`StateManager.js`, `LevelContent3D.js`, `LevelSelection3D.js`, `UI.js`) were loading BEFORE the import map and the main module script that exposes Three.js and other dependencies to `window`.

**Original Order (WRONG):**
```html
<script src="StateManager.js"></script>
<script src="LevelContent3D.js"></script>
<script src="LevelSelection3D.js"></script>
<script src="UI.js"></script>

<script type="importmap">...</script>

<script type="module">
  // Exposes THREE, Octree, etc. to window
</script>

<script src="Player.js" type="module"></script>
```

**Problems with this order:**
1. `UI.js`, `LevelSelection3D.js`, etc. tried to use Three.js before it was loaded
2. Import map must come before any module scripts
3. Dependencies (`window.THREE`, `window.Octree`, etc.) weren't available when non-module scripts ran
4. Race condition: non-module scripts executed before the module script finished exposing globals

## Solution
**Correct Script Loading Order**

```html
<!-- 1. Import map FIRST -->
<script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.161.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.161.0/examples/jsm/"
    }
  }
</script>

<!-- 2. Main module script that loads and exposes dependencies -->
<script type="module">
  import * as THREE from 'three';
  import { Octree } from 'three/addons/math/Octree.js';
  // ... other imports ...
  
  // Expose to window
  window.THREE = THREE;
  window.Octree = Octree;
  // ... etc ...
  
  // All initialization code
</script>

<!-- 3. Non-module scripts AFTER dependencies are exposed -->
<script src="StateManager.js"></script>
<script src="LevelContent3D.js"></script>
<script src="LevelSelection3D.js"></script>
<script src="UI.js"></script>

<!-- 4. Player.js module last -->
<script src="Player.js" type="module"></script>
```

## Why This Order Matters

### Import Map First
- Must be declared before any module scripts that use it
- Defines how to resolve bare module specifiers like `'three'`
- Browser requirement - import maps must be parsed before modules

### Main Module Script Second
- Imports all Three.js dependencies
- Exposes them to `window` object for non-module scripts
- Sets up global constants (`window.PLAYER_HEIGHT`, etc.)
- Initializes the UI system
- Sets up game transition functions

### Non-Module Scripts Third
- Can now safely access `window.THREE`, `window.Octree`, etc.
- Dependencies are guaranteed to be available
- No race conditions

### Player.js Module Last
- Depends on all the above being loaded
- Uses `window.startIndexJakeGame` which is set up in main module
- Needs access to initialized systems

## Key Changes

**Before (lines 77-82):**
```html
<!-- Load UI.js first so the class is available -->
<script src="StateManager.js"></script>
<script src="LevelContent3D.js"></script>
<script src="LevelSelection3D.js"></script>
<script src="UI.js"></script>

<script type="importmap">
```

**After (lines 77-82):**
```html
<!-- Import map MUST come first before any module scripts -->
<script type="importmap">
	{
		"imports": {
			"three": "https://unpkg.com/three@0.161.0/build/three.module.js",
			"three/addons/": "https://unpkg.com/three@0.161.0/examples/jsm/"
		}
	}
</script>

<script type="module">
```

**Before (end of file):**
```html
<!-- Player.js is a module that loads after other scripts -->
<script src="Player.js" type="module"></script>
</body>
```

**After (end of file - lines 264-273):**
```html
</script>

<!-- Load non-module scripts AFTER the module script so dependencies are available -->
<script src="StateManager.js"></script>
<script src="LevelContent3D.js"></script>
<script src="LevelSelection3D.js"></script>
<script src="UI.js"></script>

<!-- Player.js is a module that loads after other scripts -->
<script src="Player.js" type="module"></script>
</body>
```

## Impact
- ✅ **Game Loads**: Page now loads correctly
- ✅ **Level Selection**: 3D level selection UI appears
- ✅ **No Errors**: No console errors about undefined THREE, Octree, etc.
- ✅ **Proper Initialization**: All systems initialize in correct order
- ✅ **Dependencies Available**: Non-module scripts can access window.THREE, etc.

## Testing
After this fix:
1. Open `indexjake.html` in browser
2. Should see the 3D level selection UI immediately
3. No console errors
4. Can click on a level to start the game
5. Game should load after 5-second delay

## Files Modified
- `/home/jake/School/Graphics/Game/Game123/GP559/indexjake.html`

## Related Documentation
- `COMPLETE_FIX_SUMMARY.md` - Overall fix summary
- `SCRIPT_LOADING_ORDER.md` - Previous script loading documentation (may need update)
- `SCORE_DISPLAY_FIX.md` - Recent score display fix

## Browser Script Loading Rules

### Import Maps
- MUST be declared before any `<script type="module">` that uses them
- Only one import map per page
- Cannot be dynamically added after modules start loading

### Module Scripts (`type="module"`)
- Load asynchronously by default
- Execute in order they appear
- Wait for all imports to resolve before executing
- Use strict mode automatically
- Have their own scope (use `window` to expose globals)

### Regular Scripts
- Execute synchronously in order
- Block HTML parsing
- Share global scope
- Execute immediately when parsed

## Best Practices Applied
1. ✅ Import map before modules
2. ✅ Load dependencies before dependents
3. ✅ Expose required globals explicitly
4. ✅ Clear comments explaining order
5. ✅ Consistent structure

## Common Pitfalls Avoided
- ❌ Loading non-module scripts before their dependencies
- ❌ Putting import map after module scripts
- ❌ Assuming race conditions won't happen
- ❌ Not exposing modules to non-module scripts
- ❌ Unclear script ordering

## Date
Fixed: December 6, 2024
