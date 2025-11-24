/*jshint esversion: 6 */
// @ts-check

// @ts-ignore - URL import is handled by importmap in HTML
import * as T from "https://unpkg.com/three@0.161.0/build/three.module.js";

// 颜色定义
const FLOOR_COLOR = 0x888888; // 地板颜色（灰色）
const MAZE_COLOR = 0x4a4a4a;  // 迷宫颜色（深灰色）

/**
 * 生成巨大的地板
 * @param {T.Scene} scene - Three.js场景对象
 * @param {number} width - 地板宽度（x方向）
 * @param {number} depth - 地板深度（z方向）
 * @param {number} [thickness=0.2] - 地板厚度（默认0.2）
 * @returns {T.Mesh} 返回创建的地板网格对象
 */
export function createFloor(scene, width, depth, thickness = 0.2) {
  // 创建地板几何体
  const floorGeometry = new T.BoxGeometry(width, thickness, depth);
  
  // 创建地板材质（使用地板颜色）
  const floorMaterial = new T.MeshStandardMaterial({ 
    color: FLOOR_COLOR,
    roughness: 0.8,
    metalness: 0.2
  });
  
  // 创建地板网格
  const floorMesh = new T.Mesh(floorGeometry, floorMaterial);
  
  // 设置地板位置：地板顶部在y=-0.8，所以地板中心在y=-0.8-thickness/2
  // 地板中心应该在围墙中心：(width-1)/2, -0.8-thickness/2, (depth-1)/2
  floorMesh.position.set((width - 1) / 2, -0.8 - thickness / 2, (depth - 1) / 2);
  
  // 将地板添加到场景
  scene.add(floorMesh);
  
  return floorMesh;
}

/**
 * 生成一个1*1*高度2的方块
 * @param {T.Scene} scene - Three.js场景对象
 * @param {number} x - 方块的x坐标
 * @param {number} z - 方块的z坐标
 * @param {number} [height=2] - 方块高度（默认2）
 * @returns {T.Mesh} 返回创建的方块网格对象
 */
export function createBlock(scene, x, z, height = 2) {
  // 创建方块几何体：1*1*height
  const blockGeometry = new T.BoxGeometry(1, height, 1);
  
  // 创建方块材质（使用迷宫颜色）
  const blockMaterial = new T.MeshStandardMaterial({ 
    color: MAZE_COLOR,
    roughness: 0.7,
    metalness: 0.3
  });
  
  // 创建方块网格
  const blockMesh = new T.Mesh(blockGeometry, blockMaterial);
  
  // 设置方块位置：y=0表示方块底部在y=0，所以方块中心在y=height/2
  blockMesh.position.set(x, height / 2, z);
  
  // 将方块添加到场景
  scene.add(blockMesh);
  
  return blockMesh;
}

/**
 * 生成围墙
 * @param {T.Scene} scene - Three.js场景对象
 * @param {number} width - 围墙宽度（x方向网格数）
 * @param {number} depth - 围墙深度（z方向网格数）
 * @param {number} [wallHeight=2] - 围墙高度（默认2）
 * @returns {Array<T.Mesh>} 返回创建的围墙方块数组
 */
export function createWalls(scene, width, depth, wallHeight = 2) {
  const walls = [];
  
  // 围墙使用1*1的方块，高度为wallHeight
  // 围墙围住的区域是从(0, 0)到(width-1, depth-1)
  
  // 西墙：x=0, z从0到depth-1
  for (let z = 0; z < depth; z++) {
    const wallBlock = createBlock(scene, 0, z, wallHeight);
    walls.push(wallBlock);
  }
  
  // 东墙：x=width-1, z从0到depth-1
  for (let z = 0; z < depth; z++) {
    const wallBlock = createBlock(scene, width - 1, z, wallHeight);
    walls.push(wallBlock);
  }
  
  // 北墙：z=0, x从1到width-2（避免与东西墙重复）
  for (let x = 1; x < width - 1; x++) {
    const wallBlock = createBlock(scene, x, 0, wallHeight);
    walls.push(wallBlock);
  }
  
  // 南墙：z=depth-1, x从1到width-2（避免与东西墙重复）
  for (let x = 1; x < width - 1; x++) {
    const wallBlock = createBlock(scene, x, depth - 1, wallHeight);
    walls.push(wallBlock);
  }
  
  return walls;
}

// 导出颜色常量供外部使用
export { FLOOR_COLOR, MAZE_COLOR };
