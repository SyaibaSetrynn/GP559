"""
Game Bridge - Interface between DQN Training and JavaScript Game
Handles communication between Python DQN agents and the browser-based game
"""

import json
import time
import asyncio
import websockets
from typing import Dict, List, Tuple
import numpy as np
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import threading

class GameBridge:
    """Bridge between Python DQN training and JavaScript game."""
    
    def __init__(self, game_url: str = "file:///home/jake/School/Graphics/Game/Game123/GP559/indexagent.html"):
        self.game_url = game_url
        self.driver = None
        self.websocket = None
        self.game_state = None
        self.action_queue = []
        
    def start_browser(self):
        """Start browser and load the game."""
        options = webdriver.ChromeOptions()
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-web-security')
        options.add_argument('--allow-running-insecure-content')
        
        self.driver = webdriver.Chrome(options=options)
        self.driver.get(self.game_url)
        
        # Wait for game to load
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.ID, "div1"))
        )
        
        # Inject bridge code into the game
        self.inject_bridge_code()
        
        print("Browser started and game loaded")
    
    def inject_bridge_code(self):
        """Inject JavaScript code to enable Python-JS communication."""
        bridge_js = """
        // Python-JavaScript Bridge for DQN Training
        window.dqnBridge = {
            state: null,
            actionQueue: [],
            
            // Get current game state for DQN
            getGameState: function() {
                const state = {
                    agents: [],
                    critical_points: [],
                    time_remaining: 1.0,
                    map_size: 10
                };
                
                // Get agent information
                if (window.agentManager && window.agentManager.agents) {
                    window.agentManager.agents.forEach((agent, idx) => {
                        const position = agent.object.position;
                        const ownedPoints = agent.getScore();
                        
                        state.agents.push({
                            id: idx,
                            position: [position.x, position.y, position.z],
                            owned_points: ownedPoints,
                            color: agent.agentColor
                        });
                    });
                }
                
                // Get critical points information
                if (window.globalCPSystem && window.globalCPSystem.cpRegistry) {
                    for (const [cpId, cpData] of window.globalCPSystem.cpRegistry) {
                        const cp = {
                            id: cpId,
                            position: [
                                cpData.position.x, 
                                cpData.position.y, 
                                cpData.position.z
                            ],
                            color: cpData.ownedBy,
                            available: !cpData.isActivelyClaimed,
                            locked: cpData.isActivelyClaimed
                        };
                        state.critical_points.push(cp);
                    }
                }
                
                return state;
            },
            
            // Execute agent action
            executeAction: function(agentId, action) {
                if (!window.agentManager || !window.agentManager.agents[agentId]) {
                    return false;
                }
                
                const agent = window.agentManager.agents[agentId];
                const currentPos = agent.object.position.clone();
                const moveSpeed = 0.05;
                
                switch(action) {
                    case 'strafe_left':
                        agent.object.position.x -= moveSpeed;
                        break;
                    case 'strafe_right':
                        agent.object.position.x += moveSpeed;
                        break;
                    case 'move_forward':
                        agent.object.position.z -= moveSpeed;
                        break;
                    case 'move_backward':
                        agent.object.position.z += moveSpeed;
                        break;
                    case 'stay':
                        // Do nothing
                        break;
                    default:
                        return false;
                }
                
                // Check collision and revert if needed
                if (!this.isValidPosition(agent.object.position)) {
                    agent.object.position.copy(currentPos);
                }
                
                return true;
            },
            
            // Check if position is valid (not in walls)
            isValidPosition: function(position) {
                if (!window.MapPathfinding) return true;
                return window.MapPathfinding.isWalkable(position.x, position.z);
            },
            
            // Reset episode
            resetEpisode: function(agentPositions) {
                if (!window.agentManager) return false;
                
                // Reset agent positions
                window.agentManager.agents.forEach((agent, idx) => {
                    if (agentPositions[idx]) {
                        agent.object.position.set(
                            agentPositions[idx][0],
                            agentPositions[idx][1],
                            agentPositions[idx][2]
                        );
                    }
                });
                
                // Reset critical points
                if (window.globalCPSystem) {
                    for (const [cpId, cpData] of window.globalCPSystem.cpRegistry) {
                        cpData.ownedBy = null;
                        cpData.isActivelyClaimed = false;
                        cpData.claimedBy = null;
                        cpData.currentColor = cpData.originalColor;
                        
                        // Reset visual appearance
                        if (cpData.mesh && cpData.mesh.material) {
                            cpData.mesh.material.color.setHex(cpData.originalColor);
                        }
                    }
                    
                    // Clear ownership tracking
                    window.globalCPSystem.cpsByOwner.clear();
                }
                
                return true;
            },
            
            // Get navigation grid around agent
            getNavigationGrid: function(agentId, gridSize = 15) {
                if (!window.agentManager || !window.agentManager.agents[agentId]) {
                    return new Array(gridSize * gridSize).fill(0);
                }
                
                const agent = window.agentManager.agents[agentId];
                const pos = agent.object.position;
                const grid = [];
                const halfGrid = Math.floor(gridSize / 2);
                
                for (let z = -halfGrid; z <= halfGrid; z++) {
                    for (let x = -halfGrid; x <= halfGrid; x++) {
                        const worldX = pos.x + x;
                        const worldZ = pos.z + z;
                        
                        const isWalkable = window.MapPathfinding ? 
                            window.MapPathfinding.isWalkable(worldX, worldZ) : true;
                        
                        grid.push(isWalkable ? 0 : 1);  // 0 = walkable, 1 = wall
                    }
                }
                
                return grid;
            },
            
            // Calculate distance to nearest unclaimed/enemy points
            getDistanceToObjectives: function(agentId) {
                if (!window.agentManager || !window.agentManager.agents[agentId] || !window.globalCPSystem) {
                    return { nearest_unclaimed: 1.0, nearest_enemy: 1.0 };
                }
                
                const agent = window.agentManager.agents[agentId];
                const pos = agent.object.position;
                let minUnclaimedDist = Infinity;
                let minEnemyDist = Infinity;
                
                for (const [cpId, cpData] of window.globalCPSystem.cpRegistry) {
                    const cpPos = cpData.position;
                    const dist = pos.distanceTo(cpPos);
                    
                    if (cpData.ownedBy === null) {
                        minUnclaimedDist = Math.min(minUnclaimedDist, dist);
                    } else if (cpData.ownedBy !== agent.agentColor) {
                        minEnemyDist = Math.min(minEnemyDist, dist);
                    }
                }
                
                return {
                    nearest_unclaimed: minUnclaimedDist === Infinity ? 1.0 : Math.min(minUnclaimedDist / 10, 1.0),
                    nearest_enemy: minEnemyDist === Infinity ? 1.0 : Math.min(minEnemyDist / 10, 1.0)
                };
            }
        };
        
        // Expose to Python
        window.pythonReady = true;
        console.log('DQN Bridge injected successfully');
        """
        
        self.driver.execute_script(bridge_js)
        
        # Wait for bridge to be ready
        WebDriverWait(self.driver, 5).until(
            lambda driver: driver.execute_script("return window.pythonReady === true")
        )
    
    def get_game_state(self, agent_id: int = 0) -> Dict:
        """Get current game state from JavaScript."""
        if not self.driver:
            raise RuntimeError("Browser not started")
        
        # Get basic state
        js_state = self.driver.execute_script("return window.dqnBridge.getGameState()")
        
        # Add agent-specific information
        if js_state['agents'] and len(js_state['agents']) > agent_id:
            agent_info = js_state['agents'][agent_id]
            
            # Get navigation grid
            nav_grid = self.driver.execute_script(f"return window.dqnBridge.getNavigationGrid({agent_id})")
            
            # Get distance to objectives  
            distances = self.driver.execute_script(f"return window.dqnBridge.getDistanceToObjectives({agent_id})")
            
            # Format state for DQN
            formatted_state = {
                'agent_position': agent_info['position'],
                'critical_points': js_state['critical_points'],
                'agent_owned_points': {str(agent['id']): agent['owned_points'] for agent in js_state['agents']},
                'time_remaining': js_state.get('time_remaining', 1.0),
                'navigation_grid': nav_grid,
                'nearest_unclaimed_distance': distances['nearest_unclaimed'],
                'nearest_enemy_distance': distances['nearest_enemy'],
                'map_size': js_state.get('map_size', 10)
            }
            
            return formatted_state
        
        return self.get_empty_state()
    
    def execute_action(self, agent_id: int, action: str) -> bool:
        """Execute action for specified agent."""
        if not self.driver:
            raise RuntimeError("Browser not started")
        
        result = self.driver.execute_script(
            f"return window.dqnBridge.executeAction({agent_id}, '{action}')"
        )
        
        # Small delay to let action take effect
        time.sleep(0.016)  # ~60 FPS
        
        return result
    
    def reset_episode(self, agent_positions: List[List[float]]) -> Dict:
        """Reset game episode with specified agent positions."""
        if not self.driver:
            raise RuntimeError("Browser not started")
        
        # Reset in JavaScript
        success = self.driver.execute_script(
            f"return window.dqnBridge.resetEpisode({json.dumps(agent_positions)})"
        )
        
        if not success:
            print("Warning: Episode reset failed")
        
        # Small delay for reset to complete
        time.sleep(0.1)
        
        # Return initial state
        return self.get_game_state()
    
    def get_empty_state(self) -> Dict:
        """Return empty/default state."""
        return {
            'agent_position': [0.0, 1.0, 0.0],
            'critical_points': [],
            'agent_owned_points': {'0': 0, '1': 0, '2': 0},
            'time_remaining': 1.0,
            'navigation_grid': [0] * (15 * 15),
            'nearest_unclaimed_distance': 1.0,
            'nearest_enemy_distance': 1.0,
            'map_size': 10
        }
    
    def close(self):
        """Clean up resources."""
        if self.driver:
            self.driver.quit()
            self.driver = None

class BridgedGameEnvironment:
    """Game environment that uses the browser bridge."""
    
    def __init__(self, game_url: str = None):
        self.bridge = GameBridge(game_url) if game_url else GameBridge()
        self.processor = None  # Will be set from dqn_training.py
        self.current_step = 0
        self.max_episode_steps = 3000
        self.previous_states = {}
        
        # Action mapping
        self.actions = {
            0: "strafe_left",
            1: "strafe_right", 
            2: "move_forward",
            3: "move_backward",
            4: "stay"
        }
        
    def start(self):
        """Start the browser and game."""
        self.bridge.start_browser()
        print("Bridged environment ready")
    
    def reset(self) -> Dict:
        """Reset environment for new episode."""
        self.current_step = 0
        self.previous_states = {}
        
        # Default agent positions (corners)
        agent_positions = [
            [3.5, 1, 3.5],   # Agent 0: top-right
            [-3.5, 1, 3.5],  # Agent 1: top-left  
            [3.5, 1, -3.5]   # Agent 2: bottom-right
        ]
        
        # Reset game
        initial_state = self.bridge.reset_episode(agent_positions)
        
        # Store initial state for all agents
        for i in range(3):  # Assuming 3 agents
            self.previous_states[i] = {
                'owned_points': initial_state.get('agent_owned_points', {}).get(str(i), 0),
                'position': agent_positions[i].copy()
            }
        
        return initial_state
    
    def step(self, action: int, agent_id: int = 0) -> Tuple[Dict, float, bool, Dict]:
        """Execute action and return results."""
        self.current_step += 1
        
        # Execute action
        action_str = self.actions[action]
        success = self.bridge.execute_action(agent_id, action_str)
        
        # Get new state
        new_state = self.bridge.get_game_state(agent_id)
        
        # Calculate reward
        reward = self.calculate_reward(new_state, agent_id)
        
        # Check if done
        done = (self.current_step >= self.max_episode_steps or 
                new_state.get('time_remaining', 1.0) <= 0.01)
        
        info = {
            'step': self.current_step,
            'action_success': success,
            'owned_points': new_state.get('agent_owned_points', {}).get(str(agent_id), 0),
            'total_points': len(new_state.get('critical_points', []))
        }
        
        return new_state, reward, done, info
    
    def calculate_reward(self, state: Dict, agent_id: int) -> float:
        """Calculate reward based on state changes."""
        reward = 0.0
        
        # Get previous state for this agent
        if agent_id not in self.previous_states:
            self.previous_states[agent_id] = {
                'owned_points': 0,
                'position': [0, 1, 0]
            }
        
        prev_state = self.previous_states[agent_id]
        
        # Current owned points
        current_owned = state.get('agent_owned_points', {}).get(str(agent_id), 0)
        
        # Point capture/loss reward
        point_change = current_owned - prev_state['owned_points']
        if point_change > 0:
            reward += 1.0 * point_change  # +1 per point gained
        elif point_change < 0:
            reward += -1.0 * abs(point_change)  # -1 per point lost
        
        # Movement rewards
        current_pos = state['agent_position']
        prev_pos = prev_state['position']
        
        # Reward for moving closer to unclaimed points
        unclaimed_reward = self.get_proximity_reward(
            current_pos, prev_pos, state['critical_points'], 'unclaimed', 0.1
        )
        
        # Reward for moving closer to enemy points  
        enemy_reward = self.get_proximity_reward(
            current_pos, prev_pos, state['critical_points'], 'enemy', 0.2, agent_id
        )
        
        reward += unclaimed_reward + enemy_reward
        
        # Time penalty
        reward -= 0.01
        
        # Update previous state
        self.previous_states[agent_id] = {
            'owned_points': current_owned,
            'position': current_pos.copy()
        }
        
        return np.clip(reward, -5.0, 5.0)
    
    def get_proximity_reward(self, current_pos, prev_pos, critical_points, 
                           target_type: str, reward_scale: float, agent_id: int = None) -> float:
        """Calculate reward for moving closer to target points."""
        if not critical_points:
            return 0.0
        
        target_points = []
        for cp in critical_points:
            if target_type == 'unclaimed' and cp['color'] is None:
                target_points.append(cp['position'])
            elif (target_type == 'enemy' and cp['color'] is not None and 
                  cp['color'] != (agent_id if agent_id is not None else -1)):
                target_points.append(cp['position'])
        
        if not target_points:
            return 0.0
        
        # Find closest target point
        def distance_3d(p1, p2):
            return sum((a - b) ** 2 for a, b in zip(p1, p2)) ** 0.5
        
        min_prev_dist = min(distance_3d(prev_pos, tp) for tp in target_points)
        min_curr_dist = min(distance_3d(current_pos, tp) for tp in target_points)
        
        # Reward for getting closer
        distance_improvement = min_prev_dist - min_curr_dist
        return reward_scale * distance_improvement
    
    def close(self):
        """Clean up resources."""
        self.bridge.close()

# Example usage
if __name__ == "__main__":
    # Test the bridge
    env = BridgedGameEnvironment()
    
    try:
        env.start()
        
        # Test episode
        initial_state = env.reset()
        print("Initial state keys:", initial_state.keys())
        
        # Take some random actions
        for step in range(10):
            action = np.random.randint(0, 5)
            state, reward, done, info = env.step(action, agent_id=0)
            
            print(f"Step {step}: Action {action}, Reward {reward:.3f}, Done {done}")
            
            if done:
                break
                
    finally:
        env.close()
