#!/bin/bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port ${BACKEND_PORT:-8001} &
BACKEND_PID=$!
cd ..

export PORT=${PORT:-5173}
cd frontend
npm run dev -- --port $PORT &
FRONTEND_PID=$!
cd ..

wait $BACKEND_PID $FRONTEND_PID
