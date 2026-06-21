#!/bin/sh
set -eu

cat <<'JSON'
{
  "systemMessage": "DevCourt prehook: follow the Pony Trail before and after file mutations.",
  "additionalContext": "DevCourt prehook: before creating, editing, moving, deleting, generating, or formatting files, use $pony-trail. Record a pre-change snapshot with action, purpose, reason, files, expected outcome, verification, and rollback. After the mutation, record a post-change snapshot with summary, checks, and result."
}
JSON
