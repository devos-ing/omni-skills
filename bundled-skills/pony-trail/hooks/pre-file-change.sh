#!/bin/sh
set -eu

cat <<'JSON'
{
  "systemMessage": "Ponytrail prehook: follow Ponytrail before and after file mutations.",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "Ponytrail prehook: before creating, editing, moving, deleting, generating, or formatting files, use $pony-trail. Record a pre-change snapshot with action, purpose, reason, files, expected outcome, verification, and rollback. After the mutation, record a post-change snapshot with summary, checks, and result."
  }
}
JSON
