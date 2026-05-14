#!/bin/bash

# Start HICode development servers

echo "Starting HICode Development Environment..."
echo ""

# Check for OpenAI API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Warning: OPENAI_API_KEY not set. Backend API calls will fail."
    echo "Set it with: export OPENAI_API_KEY=your_key_here"
    echo ""
fi

# Start backend (FastAPI)
echo "Starting Backend (FastAPI) on http://localhost:8002..."
cd hicode-api
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi
PORT=8002 python main.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Start frontend (Next.js)
echo "Starting Frontend (Next.js) on http://localhost:3002..."
cd hicode-interface
PORT=3002 npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "=========================================="
echo "HICode is running!"
echo "  Frontend: http://localhost:3002"
echo "  Backend:  http://localhost:8002"
echo "=========================================="
echo ""
echo "Press Ctrl+C to stop all servers"

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for processes
wait
