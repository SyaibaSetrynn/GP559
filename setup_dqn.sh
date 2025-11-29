#!/bin/bash

# DQN Training Environment Setup Script
# Run this to install all required dependencies for training

echo "Setting up DQN training environment..."

# Create virtual environment if it doesn't exist
if [ ! -d "dqn_env" ]; then
    echo "Creating virtual environment..."
    python3 -m venv dqn_env
fi

# Activate virtual environment
source dqn_env/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install PyTorch (CPU version - change to GPU version if you have CUDA)
echo "Installing PyTorch..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install other ML/DL dependencies
echo "Installing ML dependencies..."
pip install numpy scipy matplotlib seaborn pandas

# Install web automation dependencies
echo "Installing browser automation dependencies..."
pip install selenium webdriver-manager

# Install async/websocket dependencies (optional, for advanced bridge)
echo "Installing networking dependencies..."
pip install websockets aiohttp

# Install Jupyter for analysis (optional)
echo "Installing analysis tools..."
pip install jupyter ipython

# Install Chrome WebDriver
echo "Setting up Chrome WebDriver..."
python -c "
from selenium import webdriver
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

service = Service(ChromeDriverManager().install())
print('Chrome WebDriver installed successfully')
"

echo ""
echo "Setup complete! To use the DQN training environment:"
echo "1. Activate the virtual environment: source dqn_env/bin/activate"
echo "2. Run training: python dqn_training.py"
echo "3. Or run with browser bridge: python game_bridge.py"
echo ""

# Create requirements.txt for future reference
cat > requirements.txt << EOF
torch>=2.0.0
torchvision>=0.15.0
torchaudio>=2.0.0
numpy>=1.21.0
scipy>=1.7.0
matplotlib>=3.5.0
seaborn>=0.11.0
pandas>=1.3.0
selenium>=4.0.0
webdriver-manager>=3.8.0
websockets>=10.0
aiohttp>=3.8.0
jupyter>=1.0.0
ipython>=8.0.0
EOF

echo "Dependencies list saved to requirements.txt"
