#!/bin/bash
b="$1"
export PATH="$HOME/.local/bin:$PATH"
mkdir -p "/tmp/llmbatch/wd_$b" && cd "/tmp/llmbatch/wd_$b"
body=$(cat "/tmp/llmbatch/batch_$b.txt")
timeout 110 devin -p --respect-workspace-trust false --model claude-sonnet-5-medium -- "Score each numbered podcast transcript window 0-10 for short-form viral clip potential. Rubric: hook opening 0-2, viral pattern family 0-2 (hidden danger, secret/insider reveal, contrarian myth-bust, bold prediction, actionable how-to, controversy), standalone completeness 0-2, emotional charge or surprise 0-2, quotability 0-1, natural 30-90s clip fit 0-1. Reply with ONLY lines in the exact format 'N: score' (one per window, no prose).

$body" 2>/dev/null > "/tmp/llmbatch/out_$b.txt"
