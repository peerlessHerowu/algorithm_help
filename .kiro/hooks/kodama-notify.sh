#!/bin/sh
# Kodama Spirit Hook for Kiro
KODAMA_STATE="/Users/peerlesswu/IdeaProjects/osdev/algorithm_help/.kodama/agent-state.json"
write_state() {
  echo "{\"status\":\"$1\",\"timestamp\":$(date +%s)000}" > "$KODAMA_STATE" 2>/dev/null
}
case "$KIRO_HOOK_EVENT" in
  thinking)   write_state "thinking" ;;
  writing)    write_state "writing" ;;
  reviewing)  write_state "waiting" ;;
  complete)   write_state "complete" ;;
  *)          write_state "active" ;;
esac
