"""
DQN Training System for Critical Point Capture Game
Multi-agent competitive environment with line-of-sight mechanics
"""

import tensorflow as tf
import numpy as np
import random
import collections
from typing import List, Tuple, Dict, Optional
import json
import os
from datetime import datetime

# TensorFlow configuration
physical_devices = tf.config.list_physical_devices('GPU')
if physical_devices:
    tf.config.experimental.set_memory_growth(physical_devices[0], True)
    print(f"Using GPU: {physical_devices[0]}")
else:
    print("Using CPU")

tf.random.set_seed(42)
np.random.seed(42)
random.seed(42)

class DQNNetwork(tf.keras.Model):
    """Deep Q-Network for the critical point capture game."""
    
    def __init__(self, state_dim: int, action_dim: int, hidden_dims: List[int] = [512, 256, 128]):
        super(DQNNetwork, self).__init__()
        
        self.layers_list = []
        
        # Build hidden layers
        for i, hidden_dim in enumerate(hidden_dims):
            self.layers_list.extend([
                tf.keras.layers.Dense(
                    hidden_dim, 
                    activation='relu',
                    kernel_initializer='glorot_uniform',
                    name=f'dense_{i}'
                ),
                tf.keras.layers.Dropout(0.2, name=f'dropout_{i}')
            ])
        
        # Output layer
        self.layers_list.append(
            tf.keras.layers.Dense(
                action_dim,
                activation='linear',
                kernel_initializer='glorot_uniform',
                name='output'
            )
        )
    
    def call(self, x, training=None):
        """Forward pass."""
        for layer in self.layers_list:
            if isinstance(layer, tf.keras.layers.Dropout):
                x = layer(x, training=training)
            else:
                x = layer(x)
        return x

class ReplayBuffer:
    """Experience replay buffer for DQN training."""
    
    def __init__(self, capacity: int = 100000):
        self.buffer = collections.deque(maxlen=capacity)
    
    def push(self, state, action, reward, next_state, done):
        """Add experience to buffer."""
        self.buffer.append((state, action, reward, next_state, done))
    
    def sample(self, batch_size: int):
        """Sample random batch from buffer."""
        batch = random.sample(self.buffer, batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        
        return (
            tf.constant(states, dtype=tf.float32),
            tf.constant(actions, dtype=tf.int32),
            tf.constant(rewards, dtype=tf.float32),
            tf.constant(next_states, dtype=tf.float32),
            tf.constant(dones, dtype=tf.bool)
        )
    
    def __len__(self):
        return len(self.buffer)

class GameStateProcessor:
    """Processes game state into DQN-compatible format."""
    
    def __init__(self, max_critical_points: int = 50, grid_size: int = 15):
        self.max_cps = max_critical_points
        self.grid_size = grid_size
        self.cp_feature_dim = 7  # x, y, z, color_onehot(4), available
        
    def compute_state_dim(self) -> int:
        """Calculate total state dimension."""
        agent_pos = 3  # x, y, z (or x, z if 2D)
        cp_features = self.max_cps * self.cp_feature_dim
        nav_grid = self.grid_size * self.grid_size
        time_remaining = 1
        distances = 2  # nearest_unclaimed, nearest_enemy
        
        return agent_pos + cp_features + nav_grid + time_remaining + distances
    
    def process_state(self, game_state: Dict) -> np.ndarray:
        """Convert game state to DQN input vector."""
        state = []
        
        # Agent position (normalized to [0,1])
        agent_pos = game_state['agent_position']
        map_size = game_state.get('map_size', 10)
        normalized_pos = [
            (agent_pos[0] + map_size/2) / map_size,  # x
            agent_pos[1] / 5,                        # y (height)
            (agent_pos[2] + map_size/2) / map_size   # z
        ]
        state.extend(normalized_pos)
        
        # Critical points features
        critical_points = game_state['critical_points']
        cp_features = []
        
        for i in range(self.max_cps):
            if i < len(critical_points):
                cp = critical_points[i]
                
                # Position (normalized)
                cp_pos = [
                    (cp['position'][0] + map_size/2) / map_size,
                    cp['position'][1] / 5,
                    (cp['position'][2] + map_size/2) / map_size
                ]
                
                # Color (one-hot: neutral, agent1, agent2, agent3)
                color_onehot = [0, 0, 0, 0]
                if cp['color'] is not None:
                    color_idx = min(int(cp['color']) + 1, 3)  # Map colors to 1,2,3
                    color_onehot[color_idx] = 1
                else:
                    color_onehot[0] = 1  # Neutral
                
                # Availability
                available = 1.0 if cp['available'] else 0.0
                
                cp_features.extend(cp_pos + color_onehot + [available])
            else:
                # Pad with zeros for missing CPs
                cp_features.extend([0.0] * self.cp_feature_dim)
        
        state.extend(cp_features)
        
        # Navigation grid (walls around agent)
        nav_grid = game_state.get('navigation_grid', [0] * (self.grid_size * self.grid_size))
        state.extend(nav_grid)
        
        # Time remaining (normalized)
        time_remaining = game_state.get('time_remaining', 1.0)
        state.append(time_remaining)
        
        # Distance to objectives
        nearest_unclaimed = game_state.get('nearest_unclaimed_distance', 1.0)
        nearest_enemy = game_state.get('nearest_enemy_distance', 1.0)
        state.extend([nearest_unclaimed, nearest_enemy])
        
        return np.array(state, dtype=np.float32)

class DQNAgent:
    """DQN Agent for critical point capture game."""
    
    def __init__(self, 
                 state_dim: int, 
                 action_dim: int = 5,
                 learning_rate: float = 1e-4,
                 epsilon_start: float = 1.0,
                 epsilon_end: float = 0.05,
                 epsilon_decay: float = 0.995,
                 gamma: float = 0.99,
                 target_update_freq: int = 1000,
                 batch_size: int = 64):
        
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.epsilon = epsilon_start
        self.epsilon_end = epsilon_end
        self.epsilon_decay = epsilon_decay
        self.gamma = gamma
        self.batch_size = batch_size
        self.target_update_freq = target_update_freq
        
        # Networks
        self.q_network = DQNNetwork(state_dim, action_dim)
        self.target_network = DQNNetwork(state_dim, action_dim)
        self.optimizer = tf.keras.optimizers.Adam(learning_rate=learning_rate)
        
        # Copy weights to target network
        self.update_target_network()
        
        # Replay buffer
        self.memory = ReplayBuffer()
        
        # Training metrics
        self.step_count = 0
        self.loss_history = []
        
    def update_target_network(self):
        """Copy weights from main network to target network."""
        self.target_network.set_weights(self.q_network.get_weights())
    
    def select_action(self, state: np.ndarray, training: bool = True) -> int:
        """Select action using epsilon-greedy policy."""
        if training and random.random() < self.epsilon:
            return random.randint(0, self.action_dim - 1)
        
        state_tensor = tf.expand_dims(tf.constant(state, dtype=tf.float32), 0)
        q_values = self.q_network(state_tensor, training=False)
        return int(tf.argmax(q_values, axis=1).numpy()[0])
    
    def store_experience(self, state, action, reward, next_state, done):
        """Store experience in replay buffer."""
        self.memory.push(state, action, reward, next_state, done)
    
    def train_step(self) -> Optional[float]:
        """Perform one training step."""
        if len(self.memory) < self.batch_size:
            return None
        
        # Sample batch
        states, actions, rewards, next_states, dones = self.memory.sample(self.batch_size)
        
        with tf.GradientTape() as tape:
            # Current Q values
            current_q_values = self.q_network(states, training=True)
            # Gather the Q-values for the actions taken
            batch_indices = tf.range(tf.shape(actions)[0])
            indices = tf.stack([batch_indices, actions], axis=1)
            current_q_values = tf.gather_nd(current_q_values, indices)
            
            # Target Q values
            next_q_values = self.target_network(next_states, training=False)
            next_q_values = tf.reduce_max(next_q_values, axis=1)
            target_q_values = rewards + (self.gamma * next_q_values * tf.cast(~dones, tf.float32))
            
            # Compute loss (Huber loss)
            loss = tf.keras.losses.huber(target_q_values, current_q_values)
        
        # Optimize
        gradients = tape.gradient(loss, self.q_network.trainable_variables)
        gradients = [tf.clip_by_norm(g, 1.0) for g in gradients]  # Gradient clipping
        self.optimizer.apply_gradients(zip(gradients, self.q_network.trainable_variables))
        
        # Update epsilon
        self.epsilon = max(self.epsilon_end, self.epsilon * self.epsilon_decay)
        
        # Update target network
        self.step_count += 1
        if self.step_count % self.target_update_freq == 0:
            self.update_target_network()
        
        loss_value = float(loss.numpy())
        self.loss_history.append(loss_value)
        return loss_value
    
    def save(self, filepath: str):
        """Save agent state."""
        checkpoint = {
            'epsilon': self.epsilon,
            'step_count': self.step_count,
            'loss_history': self.loss_history
        }
        
        # Save networks
        self.q_network.save_weights(filepath + '_q_network')
        self.target_network.save_weights(filepath + '_target_network')
        
        # Save other state
        with open(filepath + '_state.json', 'w') as f:
            json.dump(checkpoint, f)
    
    def load(self, filepath: str):
        """Load agent state."""
        # Load networks
        self.q_network.load_weights(filepath + '_q_network')
        self.target_network.load_weights(filepath + '_target_network')
        
        # Load other state
        with open(filepath + '_state.json', 'r') as f:
            checkpoint = json.load(f)
        
        self.epsilon = checkpoint['epsilon']
        self.step_count = checkpoint['step_count']
        self.loss_history = checkpoint['loss_history']

class GameEnvironment:
    """Interface between DQN and the JavaScript game."""
    
    def __init__(self, max_episode_steps: int = 3000):  # 5 minutes at 60fps = 18000 steps
        self.max_episode_steps = max_episode_steps
        self.current_step = 0
        self.processor = GameStateProcessor()
        self.previous_owned_points = 0
        self.previous_position = None
        
        # Action mapping
        self.actions = {
            0: "strafe_left",
            1: "strafe_right", 
            2: "move_forward",
            3: "move_backward",
            4: "stay"
        }
    
    def reset(self) -> np.ndarray:
        """Reset environment for new episode."""
        self.current_step = 0
        self.previous_owned_points = 0
        self.previous_position = None
        
        # This would trigger a reset in your JavaScript game
        reset_command = {
            "type": "reset_episode",
            "agents_positions": [
                [3.5, 1, 3.5],   # Agent 1: top-right
                [-3.5, 1, 3.5],  # Agent 2: top-left  
                [3.5, 1, -3.5]   # Agent 3: bottom-right
            ]
        }
        
        # Send reset command to game (you'll implement this bridge)
        initial_state = self.send_command_to_game(reset_command)
        return self.processor.process_state(initial_state)
    
    def step(self, action: int, agent_id: int = 0) -> Tuple[np.ndarray, float, bool, Dict]:
        """Execute action and return results."""
        self.current_step += 1
        
        # Send action to game
        action_command = {
            "type": "agent_action",
            "agent_id": agent_id,
            "action": self.actions[action]
        }
        
        # Get new state from game
        new_state = self.send_command_to_game(action_command)
        processed_state = self.processor.process_state(new_state)
        
        # Calculate reward
        reward = self.calculate_reward(new_state, agent_id)
        
        # Check if episode is done
        done = (self.current_step >= self.max_episode_steps or 
                new_state.get('time_remaining', 1.0) <= 0)
        
        info = {
            'step': self.current_step,
            'owned_points': new_state.get('agent_owned_points', {}).get(str(agent_id), 0),
            'total_points': len(new_state.get('critical_points', [])),
            'epsilon': getattr(self, 'current_epsilon', 0.1)
        }
        
        return processed_state, reward, done, info
    
    def calculate_reward(self, state: Dict, agent_id: int) -> float:
        """Calculate reward based on state changes."""
        reward = 0.0
        
        # Get current owned points
        current_owned = state.get('agent_owned_points', {}).get(str(agent_id), 0)
        
        # Point capture/loss reward
        point_change = current_owned - self.previous_owned_points
        if point_change > 0:
            reward += 1.0 * point_change  # +1 per point gained
        elif point_change < 0:
            reward += -1.0 * abs(point_change)  # -1 per point lost
        
        self.previous_owned_points = current_owned
        
        # Movement rewards (proximity to objectives)
        current_position = state['agent_position']
        
        if self.previous_position is not None:
            # Reward for moving closer to unclaimed points
            unclaimed_reward = self.get_proximity_reward(
                current_position, self.previous_position, 
                state['critical_points'], 'unclaimed', 0.1
            )
            
            # Higher reward for moving closer to enemy points
            enemy_reward = self.get_proximity_reward(
                current_position, self.previous_position,
                state['critical_points'], 'enemy', 0.2, agent_id
            )
            
            reward += unclaimed_reward + enemy_reward
        
        self.previous_position = current_position
        
        # Small time penalty to encourage urgency
        reward -= 0.01
        
        # Clip reward to reasonable range
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
            elif target_type == 'enemy' and cp['color'] is not None and cp['color'] != agent_id:
                target_points.append(cp['position'])
        
        if not target_points:
            return 0.0
        
        # Find closest target point
        def distance(p1, p2):
            return sum((a - b) ** 2 for a, b in zip(p1, p2)) ** 0.5
        
        min_prev_dist = min(distance(prev_pos, tp) for tp in target_points)
        min_curr_dist = min(distance(current_pos, tp) for tp in target_points)
        
        # Reward for getting closer, penalty for getting farther
        distance_change = min_prev_dist - min_curr_dist
        return reward_scale * distance_change
    
    def send_command_to_game(self, command: Dict) -> Dict:
        """Send command to JavaScript game and receive state.
        
        This is where you'll implement the bridge between Python and your JS game.
        Options:
        1. WebSocket communication
        2. HTTP API
        3. File-based communication
        4. Embedded JavaScript engine
        
        For now, returning mock data structure.
        """
        # Mock response - replace with actual game communication
        mock_state = {
            'agent_position': [0.0, 1.0, 0.0],
            'critical_points': [
                {
                    'position': [1.0, 1.0, 1.0],
                    'color': None,
                    'available': True
                },
                {
                    'position': [-1.0, 1.0, -1.0], 
                    'color': 1,
                    'available': False
                }
            ],
            'agent_owned_points': {'0': 0, '1': 1, '2': 0},
            'time_remaining': 0.8,
            'navigation_grid': [0] * (15 * 15),
            'nearest_unclaimed_distance': 0.5,
            'nearest_enemy_distance': 0.7,
            'map_size': 10
        }
        
        return mock_state

class TrainingManager:
    """Manages the overall training process."""
    
    def __init__(self, num_agents: int = 3, save_dir: str = "dqn_models"):
        self.num_agents = num_agents
        self.save_dir = save_dir
        os.makedirs(save_dir, exist_ok=True)
        
        # Initialize environment and agents
        self.env = GameEnvironment()
        state_dim = self.env.processor.compute_state_dim()
        
        self.agents = []
        for i in range(num_agents):
            agent = DQNAgent(state_dim=state_dim)
            self.agents.append(agent)
        
        # Training metrics
        self.episode_rewards = {i: [] for i in range(num_agents)}
        self.episode_lengths = []
        self.win_rates = {i: [] for i in range(num_agents)}
        
    def train(self, num_episodes: int = 1000, save_interval: int = 100, 
              eval_interval: int = 50):
        """Main training loop."""
        print(f"Starting training for {num_episodes} episodes...")
        print(f"State dimension: {self.env.processor.compute_state_dim()}")
        print(f"Number of agents: {self.num_agents}")
        
        for episode in range(num_episodes):
            episode_rewards = self.run_episode(training=True)
            
            # Log progress
            if episode % 10 == 0:
                avg_rewards = [np.mean(episode_rewards[i][-10:]) if len(episode_rewards[i]) >= 10 
                              else 0 for i in range(self.num_agents)]
                epsilons = [agent.epsilon for agent in self.agents]
                
                print(f"Episode {episode}")
                print(f"  Avg Rewards: {[f'{r:.2f}' for r in avg_rewards]}")
                print(f"  Epsilons: {[f'{e:.3f}' for e in epsilons]}")
            
            # Evaluation
            if episode % eval_interval == 0 and episode > 0:
                self.evaluate(num_episodes=5)
            
            # Save models
            if episode % save_interval == 0 and episode > 0:
                self.save_models(episode)
        
        print("Training completed!")
        self.save_models("final")
    
    def run_episode(self, training: bool = True) -> Dict[int, List[float]]:
        """Run a single episode."""
        states = {}
        episode_rewards = {i: [] for i in range(self.num_agents)}
        
        # Reset environment
        initial_state = self.env.reset()
        for agent_id in range(self.num_agents):
            states[agent_id] = initial_state.copy()
        
        done = False
        step = 0
        
        while not done and step < 1000:  # Max steps per episode
            # Each agent takes an action
            actions = {}
            for agent_id in range(self.num_agents):
                action = self.agents[agent_id].select_action(states[agent_id], training)
                actions[agent_id] = action
            
            # Execute actions (in your actual implementation, you'd send all actions at once)
            next_states = {}
            rewards = {}
            
            for agent_id in range(self.num_agents):
                next_state, reward, done, info = self.env.step(actions[agent_id], agent_id)
                next_states[agent_id] = next_state
                rewards[agent_id] = reward
                episode_rewards[agent_id].append(reward)
                
                # Store experience and train
                if training:
                    self.agents[agent_id].store_experience(
                        states[agent_id], actions[agent_id], reward, 
                        next_state, done
                    )
                    
                    # Train after some initial experiences
                    if len(self.agents[agent_id].memory) > 1000:
                        self.agents[agent_id].train_step()
            
            states = next_states
            step += 1
        
        # Store episode metrics
        for agent_id in range(self.num_agents):
            total_reward = sum(episode_rewards[agent_id])
            self.episode_rewards[agent_id].append(total_reward)
        
        self.episode_lengths.append(step)
        
        return episode_rewards
    
    def evaluate(self, num_episodes: int = 10):
        """Evaluate agents without training."""
        print(f"\n--- Evaluation over {num_episodes} episodes ---")
        
        eval_rewards = {i: [] for i in range(self.num_agents)}
        
        for episode in range(num_episodes):
            episode_rewards = self.run_episode(training=False)
            for agent_id in range(self.num_agents):
                eval_rewards[agent_id].append(sum(episode_rewards[agent_id]))
        
        # Print results
        for agent_id in range(self.num_agents):
            avg_reward = np.mean(eval_rewards[agent_id])
            std_reward = np.std(eval_rewards[agent_id])
            print(f"  Agent {agent_id}: {avg_reward:.2f} ± {std_reward:.2f}")
        
        print("--- End Evaluation ---\n")
    
    def save_models(self, episode_id):
        """Save all agent models."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        for agent_id, agent in enumerate(self.agents):
            filename = f"agent_{agent_id}_episode_{episode_id}_{timestamp}.pth"
            filepath = os.path.join(self.save_dir, filename)
            agent.save(filepath)
        
        # Save training metrics
        metrics = {
            'episode_rewards': self.episode_rewards,
            'episode_lengths': self.episode_lengths,
            'win_rates': self.win_rates
        }
        
        metrics_file = os.path.join(self.save_dir, f"metrics_{episode_id}_{timestamp}.json")
        with open(metrics_file, 'w') as f:
            json.dump(metrics, f, indent=2)
        
        print(f"Models and metrics saved for episode {episode_id}")

def main():
    """Main training script."""
    # Create training manager
    trainer = TrainingManager(num_agents=3)
    
    # Start training
    trainer.train(
        num_episodes=2000,
        save_interval=200,
        eval_interval=100
    )

if __name__ == "__main__":
    main()
