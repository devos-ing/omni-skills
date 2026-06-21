#!/bin/sh
set -eu

cat <<'JSON'
{
  "systemMessage": "PonyTrail prehook: follow PonyTrail before and after file mutations.",
  "additionalContext": "PonyTrail prehook: before creating, editing, moving, deleting, generating, or formatting files, use $pony-trail. Record a pre-change snapshot with action, purpose, reason, files, expected outcome, verification, and rollback. After the mutation, record a post-change snapshot with summary, checks, and result."
}
JSON
