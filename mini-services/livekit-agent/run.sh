#!/bin/bash
# Agent watchdog - keeps the LiveKit agent running
cd "$(dirname "$0")"

while true; do
    echo "[$(date)] Starting agent..."
    python3 -u agent.py dev 2>&1
    EXIT_CODE=$?
    echo "[$(date)] Agent exited with code $EXIT_CODE, restarting in 5 seconds..."
    sleep 5
done
