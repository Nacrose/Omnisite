#!/bin/bash
# Start dev server and capture errors
cd /home/z/my-project/workspace/Omnisite
pkill -f "next dev" 2>/dev/null
sleep 2

# Start in background, redirect output
bun run dev > /tmp/dev-log.txt 2>&1 &
DEV_PID=$!
echo "Dev PID: $DEV_PID"

# Wait for server to be ready
for i in {1..30}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard 2>/dev/null)
  if [ "$CODE" = "200" ] || [ "$CODE" = "307" ]; then
    echo "Server ready (HTTP $CODE) after ${i}s"
    break
  fi
  sleep 1
done

# Keep server alive
echo "Server running. Use 'kill $DEV_PID' to stop."
wait $DEV_PID
