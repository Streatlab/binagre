#!/bin/bash
# Hook PostToolUse - escanea hex hardcoded tras cada cambio

CHANGED_FILES=$(git diff --name-only --cached)

for FILE in $CHANGED_FILES; do
  if [[ "$FILE" =~ \.(tsx?|jsx?|css)$ ]] && [[ "$FILE" != *"tokens.ts"* ]] && [[ "$FILE" != *"design-tokens.css"* ]]; then
    HEX_FOUND=$(grep -E "#[0-9a-fA-F]{3,6}" "$FILE" | grep -vE "(rgba|hsla|var\()")
    if [ -n "$HEX_FOUND" ]; then
      echo "WARNING: hex hardcoded en $FILE. Mover a tokens.ts." >&2
    fi
  fi
done

exit 0
