import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";
export class MapLighting {
    constructor(scene) {
        this.color = new T.Color(0xFFFFFF);
        this.pulseColor = new T.Color(0xFF4F4F);

        this.ambientLight = new T.AmbientLight(this.color, 0.8);
        this.light = new T.DirectionalLight(this.color, 1);
        this.light.position.set(0, 10, 0);
        this.time = 0;
        this.scene = scene;
        this.scene.add(this.ambientLight);
        this.scene.add(this.light);
        
        this.light.target.position.set(0, 0, 0);
        this.scene.add(this.light.target);
    }

    pulsing(delta) {
        this.ambientLight.intensity = 0.5;
        this.time += delta;
        const pulse = (Math.sin(this.time * Math.PI * 2) + 1) / 2;
        this.ambientLight.color.r = this.color.r + (this.pulseColor.r - this.color.r) * pulse;
        this.ambientLight.color.g = this.color.g + (this.pulseColor.g - this.color.g) * pulse;
        this.ambientLight.color.b = this.color.b + (this.pulseColor.b - this.color.b) * pulse;
    }   

    stopPulsing() {
        this.ambientLight.intensity = 3;
        this.ambientLight.color = this.color;
    }
}