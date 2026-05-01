#!/bin/bash
# Hook PreToolUse - bloquea comandos peligrosos
# Aborta si detecta Supabase de David en repo Binagre

INPUT=$(cat)

if echo "$INPUT" | grep -q "idclhnxttdbwayxeowrm"; then
  echo "ABORT: detectado Supabase de David en repo Binagre. Aislamiento violado." >&2
  exit 1
fi

if echo "$INPUT" | grep -qE "(#16355C|#F26B1F)"; then
  echo "ABORT: detectado token Marino+Fuego en repo Binagre. Aislamiento violado." >&2
  exit 1
fi

exit 0
