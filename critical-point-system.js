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
        
        // Centralized CP registry for tracking all critical points
        this.cpRegistry = new Map(); // Maps CP mesh ID to CP data
        this.cpsByOwner = new Map(); // Maps owner color to array of CP IDs
        this.nextCpId = 0;
    }

    /**
     * Add critical points to an object
     * @param {THREE.Mesh} targetObject - The object to add CPs to
     * @param {number} count - Number of critical points to add (default: 3)
     * @param {number} color - Color of the critical points in hex (default: 0xff0000)
     * @param {Object} options - Additional options { radius: 0.05, pulseSpeed: 3 }
     * @returns {Array} Array of created critical point meshes
     */
    addCriticalPoints(targetObject, count = 3, color = 0xff0000, options = {}) {
        const cps = [];
        const opts = {
            radius: options.radius || this.cpRadius,
            pulseSpeed: options.pulseSpeed || 3,
            ...options
        };
        
        // Skip outer boundary walls completely
        const isOuterBoundaryWall = Math.abs(targetObject.position.x) > 4.5 || Math.abs(targetObject.position.z) > 4.5;
        if (isOuterBoundaryWall) {
            return [];
        }
        
        // Get the bounding box of the target object
        const bbox = new THREE.Box3().setFromObject(targetObject);
        const size = bbox.getSize(new THREE.Vector3());
        
        for (let i = 0; i < count; i++) {
            const cp = this.createCriticalPoint(color, opts);
            
            // Place CP randomly on the object surface
            const position = this.getRandomSurfacePosition(targetObject, bbox, size, opts.radius);
            cp.position.copy(position);
            
            // Register CP in centralized registry
            const cpId = this.nextCpId++;
            cp.userData.cpId = cpId;
            
            const cpData = {
                id: cpId,
                mesh: cp,
                position: position.clone(),
                targetObject: targetObject,
                originalColor: color,
                currentColor: color,
                options: opts,
                // Ownership and status tracking
                ownedBy: null,          // Color hex of owner (null if neutral)
                isActivelyClaimed: false, // Is there currently a line drawn to it?
                claimedBy: null,        // Who is currently drawing a line to it?
                lastClaimedTime: 0,     // Timestamp of last claim
                isVisible: true,        // Can be seen by agents/players
                claimHistory: []        // History of claims for debugging
            };
            
            this.cpRegistry.set(cpId, cpData);
            
            // Trigger score display update if available
            if (window.updateScoreDisplay && this.cpRegistry.size === 1) {
                setTimeout(() => window.updateScoreDisplay(), 50);
            }
            
            // Add to scene and track
            this.scene.add(cp);
            cps.push(cp);
            this.criticalPoints.push({
                cp: cp,
                targetObject: targetObject,
                originalColor: color,
                options: opts
            });
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
        
        // Allow all vertical faces for inner objects (boundary walls already filtered out)
        faces.forEach(face => {
            accessibleFaces.push(face.id);
        });

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
                    // CP and light distance check
                }
                if (distance <= lightData.range) {
                    beingHitByLight = lightData;
                    // Debug: Log when light hits CP
                    if (!cp.userData.isBeingHit) {
                        // Light hitting critical point
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
                    
                    // Critical point flashing
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



    /**
     * Claim a critical point (draw line to it)
     * @param {number} cpId - The ID of the critical point
     * @param {number} claimerColor - Color hex of the claimer
     * @param {string} claimerName - Name/ID of the claimer (for debugging)
     */
    claimCriticalPoint(cpId, claimerColor, claimerName = 'Unknown') {
        const cpData = this.cpRegistry.get(cpId);
        if (!cpData) {
            console.warn(`CP with ID ${cpId} not found`);
            return false;
        }
        
        cpData.isActivelyClaimed = true;
        cpData.claimedBy = claimerName;
        cpData.lastClaimedTime = Date.now();
        cpData.claimHistory.push({
            claimer: claimerName,
            color: claimerColor,
            timestamp: Date.now(),
            action: 'claim'
        });
        
        return true;
    }
    
    /**
     * Release claim on a critical point (remove line)
     * @param {number} cpId - The ID of the critical point
     * @param {string} releaserName - Name/ID of the releaser
     */
    releaseCriticalPoint(cpId, releaserName = 'Unknown') {
        const cpData = this.cpRegistry.get(cpId);
        if (!cpData) {
            console.warn(`CP with ID ${cpId} not found`);
            return false;
        }
        
        cpData.isActivelyClaimed = false;
        cpData.claimedBy = null;
        cpData.claimHistory.push({
            claimer: releaserName,
            timestamp: Date.now(),
            action: 'release'
        });
        
        return true;
    }
    
    /**
     * Capture/own a critical point (change its color permanently)
     * @param {number} cpId - The ID of the critical point
     * @param {number} ownerColor - Color hex of the new owner
     * @param {string} ownerName - Name/ID of the owner
     */
    captureCriticalPoint(cpId, ownerColor, ownerName = 'Unknown') {
        const cpData = this.cpRegistry.get(cpId);
        if (!cpData) {
            console.warn(`CP with ID ${cpId} not found`);
            return false;
        }
        
        // Remove from old owner's list
        if (cpData.ownedBy !== null) {
            const oldOwnerCPs = this.cpsByOwner.get(cpData.ownedBy) || [];
            const index = oldOwnerCPs.indexOf(cpId);
            if (index > -1) {
                oldOwnerCPs.splice(index, 1);
            }
        }
        
        // Set new owner
        cpData.ownedBy = ownerColor;
        cpData.currentColor = ownerColor;
        cpData.claimHistory.push({
            claimer: ownerName,
            color: ownerColor,
            timestamp: Date.now(),
            action: 'capture'
        });
        
        // Add to new owner's list
        if (!this.cpsByOwner.has(ownerColor)) {
            this.cpsByOwner.set(ownerColor, []);
        }
        this.cpsByOwner.get(ownerColor).push(cpId);
        
        // Update visual appearance
        cpData.mesh.material.color.setHex(ownerColor);
        if (cpData.mesh.children[0]) {
            cpData.mesh.children[0].material.color.setHex(ownerColor);
        }
        
        return true;
    }
    
    /**
     * Get all critical points data (for agents/players to access)
     * @returns {Map} Map of CP ID to CP data
     */
    getAllCriticalPoints() {
        return new Map(this.cpRegistry);
    }
    
    /**
     * Get critical points owned by a specific color
     * @param {number} ownerColor - Color hex of the owner
     * @returns {Array} Array of CP IDs owned by this color
     */
    getCriticalPointsByOwner(ownerColor) {
        return this.cpsByOwner.get(ownerColor) || [];
    }
    
    /**
     * Get scoring information
     * @returns {Object} Scoring data with breakdown by color
     */
    getScoring() {
        // Create snapshot to avoid concurrent modification issues
        const registrySnapshot = new Map(this.cpRegistry);
        const ownerSnapshot = new Map(this.cpsByOwner);
        
        const scoring = {
            total: registrySnapshot.size,
            byOwner: {},
            neutral: 0,
            activelyClaimed: 0
        };
        

        
        // Initialize owner counts from snapshot
        for (const [ownerColor, cpIds] of ownerSnapshot) {
            scoring.byOwner[ownerColor.toString(16)] = {
                owned: cpIds.length,
                activelyClaimed: 0
            };
        }
        
        // Count neutral and actively claimed from snapshot
        for (const [cpId, cpData] of registrySnapshot) {
            if (cpData.ownedBy === null) {
                scoring.neutral++;
            }
            if (cpData.isActivelyClaimed) {
                scoring.activelyClaimed++;
                const ownerKey = cpData.ownedBy ? cpData.ownedBy.toString(16) : 'neutral';
                if (scoring.byOwner[ownerKey]) {
                    scoring.byOwner[ownerKey].activelyClaimed++;
                }
            }
        }
        

        
        return scoring;
    }
    
    /**
     * Get critical point by mesh (for interaction detection)
     * @param {THREE.Mesh} mesh - The CP mesh
     * @returns {Object|null} CP data or null if not found
     */
    getCriticalPointByMesh(mesh) {
        const cpId = mesh.userData.cpId;
        return cpId !== undefined ? this.cpRegistry.get(cpId) : null;
    }
    
    /**
     * Find nearest critical point to a position
     * @param {THREE.Vector3} position - Position to search from
     * @param {number} maxDistance - Maximum distance to search (optional)
     * @returns {Object|null} {cpData, distance} or null if none found
     */
    findNearestCriticalPoint(position, maxDistance = Infinity) {
        let nearest = null;
        let minDistance = maxDistance;
        
        for (const [cpId, cpData] of this.cpRegistry) {
            if (!cpData.isVisible) continue;
            
            const distance = position.distanceTo(cpData.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = { cpData, distance };
            }
        }
        
        return nearest;
    }

    // ...existing code...
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
