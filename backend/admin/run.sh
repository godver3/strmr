#!/bin/bash
# NovaStream Admin Panel Startup Script
# Supports hot reloading for development

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default configuration
export STRMR_CONFIG="${STRMR_CONFIG:-${NOVASTREAM_CONFIG:-$SCRIPT_DIR/../cache/settings.json}}"
export NOVASTREAM_BACKEND_HOST="${NOVASTREAM_BACKEND_HOST:-localhost}"
export NOVASTREAM_BACKEND_PORT="${NOVASTREAM_BACKEND_PORT:-7777}"
export NOVASTREAM_ADMIN_PORT="${NOVASTREAM_ADMIN_PORT:-7778}"

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not installed."
    exit 1
fi

# Set up virtual environment if it doesn't exist
VENV_DIR="$SCRIPT_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Install dependencies if needed
if ! python3 -c "import flask" &> /dev/null 2>&1; then
    echo "Installing dependencies..."
    pip install -q -r requirements.txt
fi

echo "=================================="
echo "NovaStream Admin Panel"
echo "=================================="
echo "Admin URL:   http://0.0.0.0:$NOVASTREAM_ADMIN_PORT"
echo "Backend:     http://$NOVASTREAM_BACKEND_HOST:$NOVASTREAM_BACKEND_PORT"
echo "Config:      $NOVASTREAM_CONFIG"
echo "=================================="
echo "Hot reloading is ENABLED"
echo "=================================="

# Run with Flask's development server (hot reloading enabled)
python3 app.py
