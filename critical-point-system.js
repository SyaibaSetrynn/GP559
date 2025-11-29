/**
 * Critical Point System Template
 * 
 * Easy-to-use system for adding critical points (CPs) to 3D objects.
 * CPs are fixed-size, glowing circles that can be placed randomly on object surfaces.
 */

import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export class CriticalPointSystem {
    constructor(scene) {
        this.scene = scene;
        this.criticalPoints = [];
        this.cpRadius = 0.05; // Fixed size for all CPs
        this.glowIntensity = 0.8;
        this.coloredLights = []; // Track colored lights in the scene
    }

    /**
     * Add critical points to an object
     * @param {THREE.Mesh} targetObject - The object to add CPs to
     * @<3param {number} count - Number of critical points to add (default: 3)
     * @param {number} color - Color of the critical points in hex (default: 0xff0000)
     * @param {Object} options - Additional options { radius: 0.05, pulseSpeed: 3, minCPs: 1, maxCPs: 5, minDistance: 0.3 }
     * @returns {Array} Array of created critical point meshes
     */
    addCriticalPoints(targetObject, count = 3, color = 0xff0000, options = {}) {
        const opts = {
            radius: options.radius || this.cpRadius,
            pulseSpeed: options.pulseSpeed || 3,
            minCPs: options.minCPs || 1,
            maxCPs: options.maxCPs || 5,
            minDistance: options.minDistance || 0.3, // Minimum distance between CPs
            ...options
        };
        
        // Get accessible faces and determine optimal CP count
        const accessibleFaces = this.getAccessibleFaces(targetObject);
        if (accessibleFaces.length === 0) {
            console.warn('No accessible faces found for critical points');
            return [];
        }
        
        // Calculate actual count based on available faces and constraints
        const maxPossible = Math.min(accessibleFaces.length * 2, opts.maxCPs); // Max 2 CPs per face
        const actualCount = Math.max(opts.minCPs, Math.min(count, maxPossible));
        
        const cps = [];
        const placedPositions = []; // Track positions to ensure minimum distance
        
        // Get the bounding box of the target object
        const bbox = new THREE.Box3().setFromObject(targetObject);
        const size = bbox.getSize(new THREE.Vector3());
        
        let attempts = 0;
        const maxAttempts = actualCount * 10; // Prevent infinite loops
        
        while (cps.length < actualCount && attempts < maxAttempts) {
            attempts++;
            
            const cp = this.createCriticalPoint(color, opts);
            
            // Get a distributed position (spread across different faces)
            const position = this.getDistributedSurfacePosition(
                targetObject, 
                bbox, 
                size, 
                opts.radius, 
                cps.length, 
                actualCount, 
                accessibleFaces
            );
            
            // Check minimum distance from existing CPs
            if (this.isValidPosition(position, placedPositions, opts.minDistance)) {
                cp.position.copy(position);
                placedPositions.push(position.clone());
                
                // Add to scene and track
                this.scene.add(cp);
                cps.push(cp);
                this.criticalPoints.push({
                    cp: cp,
                    targetObject: targetObject,
                    originalColor: color,
                    options: opts
                });
            } else {
                // Remove the CP we created but couldn't place
                cp.geometry.dispose();
                cp.material.dispose();
            }
        }
        
        // If we couldn't place the minimum required, try with relaxed distance constraints
        if (cps.length < opts.minCPs) {
            const relaxedDistance = opts.minDistance * 0.5;
            while (cps.length < opts.minCPs && attempts < maxAttempts * 2) {
                attempts++;
                
                const cp = this.createCriticalPoint(color, opts);
                const position = this.getRandomSurfacePosition(targetObject, bbox, size, opts.radius);
                
                if (this.isValidPosition(position, placedPositions, relaxedDistance)) {
                    cp.position.copy(position);
                    placedPositions.push(position.clone());
                    
                    this.scene.add(cp);
                    cps.push(cp);
                    this.criticalPoints.push({
                        cp: cp,
                        targetObject: targetObject,
                        originalColor: color,
                        options: opts
                    });
                }
            }
        }
        
        return cps;
    }

    /**
     * Create a single critical point with glow effect
     */
    createCriticalPoint(color = 0xff0000, options = {}) {
        const radius = options.radius || this.cpRadius;
        
        // Main CP geometry (circle/sphere)
        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        
        // Create glowing material
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        
        const cp = new THREE.Mesh(geometry, material);
        
        // Add glow effect (larger, more transparent sphere)
        const glowGeometry = new THREE.SphereGeometry(radius * 2, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        cp.add(glow);
        
        // Add pulsing animation data
        cp.userData = {
            isCriticalPoint: true,
            pulsePhase: Math.random() * Math.PI * 2,
            originalScale: 1,
            color: color,
            pulseSpeed: options.pulseSpeed || 3,
            lightHitInfo: null, // { lightColor, startTime, duration }
            isBeingHit: false
        };
        
        return cp;
    }

    /**
     * Get a random position on the object's surface where the entire CP circle is visible
     */
    getRandomSurfacePosition(targetObject, bbox, size, cpRadius) {
        const geometry = targetObject.geometry;
        const position = new THREE.Vector3();
        
        // Ensure CP doesn't go outside object bounds
        const margin = cpRadius;
        
        // Generate position based on geometry type
        if (geometry.type === 'BoxGeometry') {
            // Get accessible faces (not blocked by other objects)
            const accessibleFaces = this.getAccessibleFaces(targetObject);
            
            if (accessibleFaces.length === 0) {
                // Fallback to top face if no faces are accessible
                accessibleFaces.push(2);
            }
            
            // Choose random accessible face
            const faceIndex = Math.floor(Math.random() * accessibleFaces.length);
            const face = accessibleFaces[faceIndex];
            
            const halfWidth = geometry.parameters.width / 2;
            const halfHeight = geometry.parameters.height / 2;
            const halfDepth = geometry.parameters.depth / 2;
            
            // Random position within face bounds (with margin)
            const x = (Math.random() - 0.5) * (geometry.parameters.width - 2 * margin);
            const y = (Math.random() - 0.5) * (geometry.parameters.height - 2 * margin);
            const z = (Math.random() - 0.5) * (geometry.parameters.depth - 2 * margin);
            
            switch (face) {
                case 0: position.set(halfWidth, y, z); break; // right face
                case 1: position.set(-halfWidth, y, z); break; // left face
                case 2: position.set(x, halfHeight, z); break; // top face
                case 3: position.set(x, -halfHeight, z); break; // bottom face
                case 4: position.set(x, y, halfDepth); break; // front face
                case 5: position.set(x, y, -halfDepth); break; // back face
            }
            
            // Add the cube's world position
            position.add(targetObject.position);
        } else if (geometry.type === 'SphereGeometry') {
            // Place on sphere surface
            const radius = geometry.parameters.radius - margin;
            // Generate random point on sphere surface
            const theta = Math.random() * Math.PI * 2; // azimuth
            const phi = Math.acos(2 * Math.random() - 1); // elevation (uniform distribution)
            
            position.set(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.cos(phi),
                radius * Math.sin(phi) * Math.sin(theta)
            );
            
            // Add the sphere's world position
            position.add(targetObject.position);
        } else {
            // Default: random position on bounding box surface
            const x = bbox.min.x + margin + Math.random() * (size.x - 2 * margin);
            const y = bbox.min.y + margin + Math.random() * (size.y - 2 * margin);
            const z = bbox.min.z + margin + Math.random() * (size.z - 2 * margin);
            position.set(x, y, z);
        }
        
        return position;
    }

    /**
     * Get a position that's distributed across different faces for better spread
     */
    getDistributedSurfacePosition(targetObject, bbox, size, cpRadius, currentIndex, totalCount, accessibleFaces) {
        const geometry = targetObject.geometry;
        
        if (geometry.type === 'BoxGeometry') {
            // Distribute CPs across different faces
            const faceIndex = currentIndex % accessibleFaces.length;
            const face = accessibleFaces[faceIndex];
            
            const halfWidth = geometry.parameters.width / 2;
            const halfHeight = geometry.parameters.height / 2;
            const halfDepth = geometry.parameters.depth / 2;
            const margin = cpRadius;
            
            // Add some randomness within the face, but bias towards different areas
            const subIndex = Math.floor(currentIndex / accessibleFaces.length);
            const bias = subIndex / Math.max(1, Math.floor(totalCount / accessibleFaces.length) - 1);
            
            let x, y, z;
            
            switch (face) {
                case 0: // right face (+X)
                    x = halfWidth;
                    y = (Math.random() - 0.5) * (geometry.parameters.height - 2 * margin);
                    z = (bias - 0.5) * (geometry.parameters.depth - 2 * margin) + (Math.random() - 0.5) * 0.2;
                    break;
                case 1: // left face (-X)
                    x = -halfWidth;
                    y = (Math.random() - 0.5) * (geometry.parameters.height - 2 * margin);
                    z = (bias - 0.5) * (geometry.parameters.depth - 2 * margin) + (Math.random() - 0.5) * 0.2;
                    break;
                case 4: // front face (+Z)
                    x = (bias - 0.5) * (geometry.parameters.width - 2 * margin) + (Math.random() - 0.5) * 0.2;
                    y = (Math.random() - 0.5) * (geometry.parameters.height - 2 * margin);
                    z = halfDepth;
                    break;
                case 5: // back face (-Z)
                    x = (bias - 0.5) * (geometry.parameters.width - 2 * margin) + (Math.random() - 0.5) * 0.2;
                    y = (Math.random() - 0.5) * (geometry.parameters.height - 2 * margin);
                    z = -halfDepth;
                    break;
                default:
                    // Fallback to random position
                    const randX = (Math.random() - 0.5) * (geometry.parameters.width - 2 * margin);
                    const randY = (Math.random() - 0.5) * (geometry.parameters.height - 2 * margin);
                    const randZ = (Math.random() - 0.5) * (geometry.parameters.depth - 2 * margin);
                    
                    switch (face) {
                        case 2: x = randX; y = halfHeight; z = randZ; break; // top face
                        case 3: x = randX; y = -halfHeight; z = randZ; break; // bottom face
                        default: x = randX; y = randY; z = randZ; break;
                    }
            }
            
            const position = new THREE.Vector3(x, y, z);
            position.add(targetObject.position);
            return position;
        }
        
        // Fallback to random position for non-box geometry
        return this.getRandomSurfacePosition(targetObject, bbox, size, cpRadius);
    }

    /**
     * Check if a position is valid (minimum distance from existing CPs)
     */
    isValidPosition(newPosition, existingPositions, minDistance) {
        for (const existingPos of existingPositions) {
            if (newPosition.distanceTo(existingPos) < minDistance) {
                return false;
            }
        }
        return true;
    }

    /**
     * Update all critical points (call this in your animation loop)
     */
    updateCriticalPoints() {
        const time = Date.now() * 0.001;
        
        // Update light interactions first
        this.updateLightInteractions();
        
        this.criticalPoints.forEach(cpData => {
            const cp = cpData.cp;
            if (cp.userData.isCriticalPoint) {
                // Static appearance - no pulsing
                cp.scale.setScalar(cp.userData.originalScale);
                
                // Fixed material opacity
                cp.material.opacity = 0.9;
                
                // Fixed glow child opacity
                if (cp.children[0]) {
                    cp.children[0].material.opacity = 0.3;
                }
            }
        });
    }

    /**
     * Remove all critical points from a specific object
     */
    removeCriticalPoints(targetObject) {
        this.criticalPoints = this.criticalPoints.filter(cpData => {
            if (cpData.targetObject === targetObject) {
                this.scene.remove(cpData.cp);
                return false;
            }
            return true;
        });
    }

    /**
     * Remove all critical points from the scene
     */
    clearAllCriticalPoints() {
        this.criticalPoints.forEach(cpData => {
            this.scene.remove(cpData.cp);
        });
        this.criticalPoints = [];
    }

    /**
     * Change the color of critical points on a specific object
     */
    changeCriticalPointColor(targetObject, newColor) {
        this.criticalPoints.forEach(cpData => {
            if (cpData.targetObject === targetObject) {
                cpData.cp.material.color.setHex(newColor);
                if (cpData.cp.children[0]) {
                    cpData.cp.children[0].material.color.setHex(newColor);
                }
                cpData.originalColor = newColor;
            }
        });
    }

    /**
     * Get accessible faces for a box geometry (faces not blocked by other objects)
     * @private
     */
    getAccessibleFaces(targetObject) {
        if (targetObject.geometry.type !== 'BoxGeometry') {
            return [];
        }

        const geometry = targetObject.geometry;
        const halfWidth = geometry.parameters.width / 2;
        const halfHeight = geometry.parameters.height / 2;
        const halfDepth = geometry.parameters.depth / 2;
        const objPos = targetObject.position;
        
        // Define face centers and normals for raycasting
        // EXCLUDE top (id: 2) and bottom (id: 3) faces - no critical points on horizontal surfaces
        const faces = [
            { id: 0, center: new THREE.Vector3(objPos.x + halfWidth, objPos.y, objPos.z), normal: new THREE.Vector3(1, 0, 0) },   // right
            { id: 1, center: new THREE.Vector3(objPos.x - halfWidth, objPos.y, objPos.z), normal: new THREE.Vector3(-1, 0, 0) },  // left
            // REMOVED: top and bottom faces
            { id: 4, center: new THREE.Vector3(objPos.x, objPos.y, objPos.z + halfDepth), normal: new THREE.Vector3(0, 0, 1) },   // front
            { id: 5, center: new THREE.Vector3(objPos.x, objPos.y, objPos.z - halfDepth), normal: new THREE.Vector3(0, 0, -1) }   // back
        ];

        const accessibleFaces = [];
        
        // Use face classification for boundary walls
        if (targetObject.userData && targetObject.userData.faceClassification && targetObject.userData.faceClassification.isBoundaryWall) {
            // Boundary wall - only allow inward-facing faces
            targetObject.userData.faceClassification.inwardFaces.forEach(faceId => {
                accessibleFaces.push(faceId);
            });
        } else {
            // No classification (inner maze blocks) - allow all vertical faces
            faces.forEach(face => {
                accessibleFaces.push(face.id);
            });
        }

        return accessibleFaces;
    }



    /**
     * Register a colored light that can interact with critical points
     * @param {THREE.Light} light - The light object
     * @param {number} color - The color of the light in hex
     * @param {number} range - The range of the light effect (default: 2)
     */
    addColoredLight(light, color, range = 2) {
        this.coloredLights.push({
            light: light,
            color: color,
            range: range,
            position: light.position
        });
    }

    /**
     * Remove a colored light from the system
     * @param {THREE.Light} light - The light to remove
     */
    removeColoredLight(light) {
        this.coloredLights = this.coloredLights.filter(lightData => lightData.light !== light);
    }



    /**
     * Check light interactions with critical points and update their state
     * @private
     */
    updateLightInteractions() {
        const currentTime = Date.now();
        
        this.criticalPoints.forEach((cpData, cpIndex) => {
            const cp = cpData.cp;
            if (!cp.userData.isCriticalPoint) return;
            
            // Check if any colored lights are hitting this CP
            let beingHitByLight = null;
            
            this.coloredLights.forEach(lightData => {
                const distance = cp.position.distanceTo(lightData.position);
                // Debug: Log distance checks occasionally
                if (Math.random() < 0.001) { // 0.1% chance per frame
                    console.log(`CP at (${cp.position.x.toFixed(2)}, ${cp.position.y.toFixed(2)}, ${cp.position.z.toFixed(2)}) - Light at (${lightData.position.x.toFixed(2)}, ${lightData.position.y.toFixed(2)}, ${lightData.position.z.toFixed(2)}) - Distance: ${distance.toFixed(2)}, Range: ${lightData.range}`);
                }
                if (distance <= lightData.range) {
                    beingHitByLight = lightData;
                    // Debug: Log when light hits CP
                    if (!cp.userData.isBeingHit) {
                        console.log(`🔴 Light hitting CP! Distance: ${distance.toFixed(2)}, Range: ${lightData.range}`);
                    }
                }
            });
            
            if (beingHitByLight) {
                if (!cp.userData.isBeingHit) {
                    // Start being hit by light
                    cp.userData.isBeingHit = true;
                    cp.userData.lightHitInfo = {
                        lightColor: beingHitByLight.color,
                        startTime: currentTime
                    };
                    
                    console.log(`🔴 Light hitting CP! Flashing ${beingHitByLight.color.toString(16)}`);
                }
                
                // Visual feedback - make CP flash with light color
                cp.material.color.setHex(beingHitByLight.color);
                if (cp.children[0]) {
                    cp.children[0].material.color.setHex(beingHitByLight.color);
                }
            } else if (cp.userData.isBeingHit) {
                // No longer being hit - reset CP to original color
                cp.userData.isBeingHit = false;
                cp.userData.lightHitInfo = null;
                
                // Restore original color
                cp.material.color.setHex(cpData.originalColor);
                if (cp.children[0]) {
                    cp.children[0].material.color.setHex(cpData.originalColor);
                }
            }
        });
    }



}

// Color presets for easy use
export const CP_COLORS = {
    RED: 0xff0000,
    GREEN: 0x00ff00,
    BLUE: 0x0000ff,
    CYAN: 0x00ffff,
    MAGENTA: 0xff00ff,
    YELLOW: 0xffff00,
    ORANGE: 0xff8800,
    PURPLE: 0x8800ff,
    WHITE: 0xffffff
};
