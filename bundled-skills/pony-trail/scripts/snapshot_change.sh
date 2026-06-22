#!/bin/sh
set -eu

DEFAULT_STORE=".pony-trail"
DEFAULT_COPY_LIMIT=1048576

usage() {
  cat <<'EOF'
usage: snapshot_change.sh [--root DIR] [--store DIR] [--copy-limit BYTES] [--session-id ID] [--instruction-context] {pre,post} ...

Record file-change rationale snapshots.

pre:
  snapshot_change.sh pre --files FILE... --action TEXT --purpose TEXT --reason TEXT \
    --expected TEXT --verify TEXT --rollback TEXT [--snapshot-id ID]

post:
  snapshot_change.sh post --snapshot-id ID --files FILE... --summary TEXT \
    [--checks TEXT] [--result TEXT]
EOF
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

json_escape() {
  awk '
    BEGIN { ORS = "" }
    {
      gsub(/\\/, "\\\\")
      gsub(/"/, "\\\"")
      gsub(/\t/, "\\t")
      gsub(/\r/, "\\r")
      if (NR > 1) {
        printf "\\n"
      }
      printf "%s", $0
    }
  '
}

json_string() {
  printf '"'
  printf '%s' "$1" | json_escape
  printf '"'
}

json_optional_string() {
  if [ -n "$1" ]; then
    json_string "$1"
  else
    printf 'null'
  fi
}

sanitize_session_id() {
  case "$1" in
    "" | *"/"* | *"\\"* | *".."*)
      fail "Session id must be non-empty and must not contain '/', '\\', or '..'."
      ;;
  esac
}

add_file_arg() {
  if [ -n "$files" ]; then
    files="${files}
$1"
  else
    files="$1"
  fi
}

random_hex() {
  if command -v od >/dev/null 2>&1; then
    od -An -N4 -tx1 /dev/urandom 2>/dev/null | tr -d ' \n'
  else
    printf '%s' "$$"
  fi
}

utc_compact() {
  date -u '+%Y%m%dT%H%M%SZ'
}

utc_iso() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

stat_size() {
  if stat -f '%z' "$1" >/dev/null 2>&1; then
    stat -f '%z' "$1"
  else
    stat -c '%s' "$1"
  fi
}

stat_mtime_ns() {
  if stat -f '%m' "$1" >/dev/null 2>&1; then
    printf '%s000000000' "$(stat -f '%m' "$1")"
  else
    printf '%s000000000' "$(stat -c '%Y' "$1")"
  fi
}

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    fail "Neither shasum nor sha256sum is available."
  fi
}

hash_string() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | awk '{print "sha256:" $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | awk '{print "sha256:" $1}'
  else
    fail "Neither shasum nor sha256sum is available."
  fi
}

dirname_of() {
  dirname "$1"
}

basename_of() {
  basename "$1"
}

resolve_file() {
  raw_path=$1
  case "$raw_path" in
    /*) candidate=$raw_path ;;
    *) candidate=$root/$raw_path ;;
  esac

  candidate_dir=$(dirname_of "$candidate")
  candidate_base=$(basename_of "$candidate")
  resolved_dir=$(cd "$candidate_dir" 2>/dev/null && pwd -P) ||
    fail "Refusing to snapshot path with missing parent: $raw_path"
  resolved_path=$resolved_dir/$candidate_base

  case "$resolved_path" in
    "$root") rel_path="." ;;
    "$root"/*) rel_path=${resolved_path#"$root"/} ;;
    *) fail "Refusing to snapshot path outside root: $raw_path" ;;
  esac
}

copy_file_if_small() {
  path=$1
  rel=$2
  size=$3

  if [ "$size" -gt "$copy_limit" ]; then
    stored_copy=""
    return
  fi

  stored_copy="files/$snapshot_id/$phase/$rel"
  destination=$store_path/$stored_copy
  mkdir -p "$(dirname_of "$destination")"
  cp -p "$path" "$destination"
}

file_state_json() {
  raw_path=$1
  resolve_file "$raw_path"

  if [ ! -e "$resolved_path" ]; then
    printf '{"path":'
    json_string "$rel_path"
    printf ',"exists":false}'
    return
  fi

  size=$(stat_size "$resolved_path")
  mtime_ns=$(stat_mtime_ns "$resolved_path")
  if [ -d "$resolved_path" ]; then
    type_value="directory"
  else
    type_value="file"
  fi

  printf '{"path":'
  json_string "$rel_path"
  printf ',"exists":true,"type":'
  json_string "$type_value"
  printf ',"size":%s,"mtime_ns":%s' "$size" "$mtime_ns"

  if [ -f "$resolved_path" ]; then
    digest=$(sha256_file "$resolved_path")
    copy_file_if_small "$resolved_path" "$rel_path" "$size"
    printf ',"sha256":'
    json_string "$digest"
    printf ',"stored_copy":'
    if [ -n "$stored_copy" ]; then
      json_string "$stored_copy"
    else
      printf 'null,"copy_note":'
      json_string "not copied because file is missing, not regular, or above copy limit"
    fi
  fi

  printf '}'
}

git_json() {
  if ! command -v git >/dev/null 2>&1; then
    printf '{"is_git_repo":false,"root":null,"branch":null,"head":null}'
    return
  fi

  git_root=$(git -C "$root" rev-parse --show-toplevel 2>/dev/null || true)
  if [ -z "$git_root" ]; then
    printf '{"is_git_repo":false,"root":null,"branch":null,"head":null}'
    return
  fi

  git_branch=$(git -C "$root" branch --show-current 2>/dev/null || true)
  git_head=$(git -C "$root" rev-parse --short HEAD 2>/dev/null || true)
  printf '{"is_git_repo":true,"root":'
  json_string "$git_root"
  printf ',"branch":'
  json_optional_string "$git_branch"
  printf ',"head":'
  json_optional_string "$git_head"
  printf '}'
}

instruction_git_json() {
  if ! command -v git >/dev/null 2>&1; then
    printf '{"branch":null,"commit":null,"dirty":null}'
    return
  fi

  git_root=$(git -C "$root" rev-parse --show-toplevel 2>/dev/null || true)
  if [ -z "$git_root" ]; then
    printf '{"branch":null,"commit":null,"dirty":null}'
    return
  fi

  git_branch=$(git -C "$root" branch --show-current 2>/dev/null || true)
  git_head=$(git -C "$root" rev-parse --short HEAD 2>/dev/null || true)
  git_dirty=$(git -C "$root" status --porcelain 2>/dev/null || true)
  printf '{"branch":'
  json_optional_string "$git_branch"
  printf ',"commit":'
  json_optional_string "$git_head"
  printf ',"dirty":'
  if [ -n "$git_dirty" ]; then
    printf 'true'
  else
    printf 'false'
  fi
  printf '}'
}

instruction_file_json() {
  rel=$1
  path=$root/$rel

  printf '{"path":'
  json_string "$rel"

  if [ ! -e "$path" ]; then
    printf ',"status":"missing"}'
    return
  fi

  if [ ! -f "$path" ] || [ ! -r "$path" ]; then
    printf ',"status":"unreadable"}'
    return
  fi

  size=$(stat_size "$path")
  digest=$(sha256_file "$path")
  printf ',"status":"captured","sha256":'
  json_string "sha256:$digest"
  printf ',"bytes":%s}' "$size"
}

instruction_skill_json() {
  skill_file=$skill_dir/SKILL.md

  printf '{"name":'
  json_string "$skill_name"

  if [ ! -e "$skill_file" ]; then
    printf ',"status":"missing"}'
    return
  fi

  if [ ! -f "$skill_file" ] || [ ! -r "$skill_file" ]; then
    printf ',"status":"unreadable"}'
    return
  fi

  digest=$(sha256_file "$skill_file")
  printf ',"status":"captured","version_or_sha256":'
  json_string "sha256:$digest"
  printf '}'
}

append_instruction_file_json() {
  file_json=$(instruction_file_json "$1")
  if [ -n "$instruction_files_json" ]; then
    instruction_files_json="$instruction_files_json,$file_json"
  else
    instruction_files_json="$file_json"
  fi
}

collect_instruction_context() {
  instruction_files_json=""

  if [ -d "$root/.cursor/rules" ]; then
    cursor_paths_file=$store_path/.instruction-context-files.$$
    find "$root/.cursor/rules" -type f | LC_ALL=C sort >"$cursor_paths_file"
    while IFS= read -r path; do
      [ -n "$path" ] || continue
      rel=${path#"$root"/}
      append_instruction_file_json "$rel"
    done <"$cursor_paths_file"
    rm -f "$cursor_paths_file"
  fi

  append_instruction_file_json ".github/copilot-instructions.md"
  append_instruction_file_json "AGENTS.md"
  append_instruction_file_json "CLAUDE.md"

  session_hash=$(hash_string "$session_id")
  skill_json=$(instruction_skill_json)
  printf '{"mode":"opt_in","captured_at":'
  json_string "$timestamp_utc"
  printf ',"session_id_hash":'
  json_string "$session_hash"
  printf ',"git":'
  instruction_git_json
  printf ',"files":[%s],"skills":[%s],"warnings":[]}' "$instruction_files_json" "$skill_json"
}

entry_json() {
  printf '{"snapshot_id":'
  json_string "$snapshot_id"
  printf ',"session_id":'
  json_string "$session_id"
  printf ',"phase":'
  json_string "$phase"
  printf ',"timestamp_utc":'
  json_string "$timestamp_utc"
  printf ',"cwd":'
  json_string "$root"
  printf ',"git":'
  git_json
  printf ',"action":'
  json_optional_string "$action"
  printf ',"purpose":'
  json_optional_string "$purpose"
  printf ',"reason":'
  json_optional_string "$reason"
  printf ',"expected":'
  json_optional_string "$expected"
  printf ',"verify":'
  json_optional_string "$verify"
  printf ',"rollback":'
  json_optional_string "$rollback"
  printf ',"summary":'
  json_optional_string "$summary"
  printf ',"checks":'
  json_optional_string "$checks"
  printf ',"result":'
  json_optional_string "$result"
  printf ',"files":[%s]' "$files_json"
  if [ -n "$instruction_context_json" ]; then
    printf ',"instruction_context":%s' "$instruction_context_json"
  fi
  printf '}'
}

ensure_session_tree() {
  mkdir -p "$session_dir"
  if [ ! -f "$session_tree_path" ]; then
    {
      printf '# Ponytrail Session Tree\n\n'
      printf 'Session: `%s`\n\n' "$session_id"
      printf 'Each commit records agent intent, changed files, stored copies, checks, and rollback context.\n'
    } >"$session_tree_path"
  fi
}

append_field_line() {
  label=$1
  value=$2
  if [ -n "$value" ]; then
    printf -- '- %s: %s\n' "$label" "$value"
  fi
}

tree_file_line() {
  raw_path=$1
  resolve_file "$raw_path"

  if [ ! -e "$resolved_path" ]; then
    printf '  - `%s` missing\n' "$rel_path"
    return
  fi

  size=$(stat_size "$resolved_path")
  if [ -d "$resolved_path" ]; then
    printf '  - `%s` directory size=%s\n' "$rel_path" "$size"
    return
  fi

  if [ -f "$resolved_path" ]; then
    digest=$(sha256_file "$resolved_path")
    stored_note=""
    if [ "$size" -le "$copy_limit" ]; then
      stored_note=" stored: \`files/$snapshot_id/$phase/$rel_path\`"
    fi
    printf '  - `%s` file sha256=`%s`%s\n' "$rel_path" "$digest" "$stored_note"
    return
  fi

  printf '  - `%s` other size=%s\n' "$rel_path" "$size"
}

append_session_tree_entry() {
  ensure_session_tree
  {
    printf '\n## commit %s\n\n' "$snapshot_id"
    printf -- '- phase: `%s`\n' "$phase"
    printf -- '- time: `%s`\n' "$timestamp_utc"
    append_field_line "action" "$action"
    append_field_line "purpose" "$purpose"
    append_field_line "reason" "$reason"
    append_field_line "expected" "$expected"
    append_field_line "verify" "$verify"
    append_field_line "rollback" "$rollback"
    append_field_line "summary" "$summary"
    append_field_line "checks" "$checks"
    append_field_line "result" "$result"
    printf -- '- files:\n'
    old_tree_ifs=$IFS
    IFS='
'
    for raw_file in $files; do
      tree_file_line "$raw_file"
    done
    IFS=$old_tree_ifs
  } >>"$session_tree_path"
}

root="."
store="$DEFAULT_STORE"
copy_limit="$DEFAULT_COPY_LIMIT"
session_id="${PONYTRAIL_SESSION_ID:-${Ponytrail_SESSION_ID:-default}}"
phase=""
snapshot_id=""
files=""
action=""
purpose=""
reason=""
expected=""
verify=""
rollback=""
summary=""
checks=""
result=""
instruction_context="${PONYTRAIL_INSTRUCTION_CONTEXT:-}"
instruction_context_json=""
script_dir=$(cd "$(dirname_of "$0")" 2>/dev/null && pwd -P || true)
skill_dir=$(dirname_of "$script_dir")
skill_name=$(basename_of "$skill_dir")

while [ "$#" -gt 0 ]; do
  case "$1" in
    --root)
      [ "$#" -ge 2 ] || fail "--root requires a value."
      root=$2
      shift 2
      ;;
    --store)
      [ "$#" -ge 2 ] || fail "--store requires a value."
      store=$2
      shift 2
      ;;
    --copy-limit)
      [ "$#" -ge 2 ] || fail "--copy-limit requires a value."
      copy_limit=$2
      shift 2
      ;;
    --session-id)
      [ "$#" -ge 2 ] || fail "--session-id requires a value."
      session_id=$2
      shift 2
      ;;
    --instruction-context)
      instruction_context=1
      shift
      ;;
    pre|post)
      phase=$1
      shift
      break
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option before phase: $1"
      ;;
  esac
done

[ -n "$phase" ] || fail "Missing phase: pre or post."
sanitize_session_id "$session_id"

root=$(cd "$root" && pwd -P)
store_path=$root/$store
session_dir=$store_path/sessions/$session_id
session_tree_path=$session_dir/tree.md
session_commits_path=$session_dir/commits.jsonl
mkdir -p "$store_path"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --snapshot-id)
      [ "$#" -ge 2 ] || fail "--snapshot-id requires a value."
      snapshot_id=$2
      shift 2
      ;;
    --files)
      shift
      while [ "$#" -gt 0 ]; do
        case "$1" in
          --*) break ;;
          *) add_file_arg "$1"; shift ;;
        esac
      done
      ;;
    --action)
      [ "$#" -ge 2 ] || fail "--action requires a value."
      action=$2
      shift 2
      ;;
    --purpose)
      [ "$#" -ge 2 ] || fail "--purpose requires a value."
      purpose=$2
      shift 2
      ;;
    --reason)
      [ "$#" -ge 2 ] || fail "--reason requires a value."
      reason=$2
      shift 2
      ;;
    --expected)
      [ "$#" -ge 2 ] || fail "--expected requires a value."
      expected=$2
      shift 2
      ;;
    --verify)
      [ "$#" -ge 2 ] || fail "--verify requires a value."
      verify=$2
      shift 2
      ;;
    --rollback)
      [ "$#" -ge 2 ] || fail "--rollback requires a value."
      rollback=$2
      shift 2
      ;;
    --summary)
      [ "$#" -ge 2 ] || fail "--summary requires a value."
      summary=$2
      shift 2
      ;;
    --checks)
      [ "$#" -ge 2 ] || fail "--checks requires a value."
      checks=$2
      shift 2
      ;;
    --result)
      [ "$#" -ge 2 ] || fail "--result requires a value."
      result=$2
      shift 2
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

[ -n "$files" ] || fail "--files is required."

if [ "$phase" = "pre" ]; then
  [ -n "$action" ] || fail "--action is required for pre."
  [ -n "$purpose" ] || fail "--purpose is required for pre."
  [ -n "$reason" ] || fail "--reason is required for pre."
  [ -n "$expected" ] || fail "--expected is required for pre."
  [ -n "$verify" ] || fail "--verify is required for pre."
  [ -n "$rollback" ] || fail "--rollback is required for pre."
else
  [ -n "$snapshot_id" ] || fail "--snapshot-id is required for post."
  [ -n "$summary" ] || fail "--summary is required for post."
fi

if [ -z "$snapshot_id" ]; then
  snapshot_id=$(utc_compact)-$(random_hex)
fi

files_json=""
files_count=0
old_ifs=$IFS
IFS='
'
for raw_file in $files; do
  file_json=$(file_state_json "$raw_file")
  if [ -n "$files_json" ]; then
    files_json="$files_json,$file_json"
  else
    files_json="$file_json"
  fi
  files_count=$((files_count + 1))
done
IFS=$old_ifs

log_path=$store_path/snapshots.jsonl
timestamp_utc=$(utc_iso)
if [ "$instruction_context" = "1" ] ||
  [ "$instruction_context" = "true" ] ||
  [ "$instruction_context" = "yes" ]; then
  instruction_context_json=$(collect_instruction_context)
fi
entry=$(entry_json)
printf '%s\n' "$entry" >>"$log_path"
ensure_session_tree
printf '%s\n' "$entry" >>"$session_commits_path"
append_session_tree_entry

printf '{"files":%s,"log":' "$files_count"
json_string "$log_path"
printf ',"session_id":'
json_string "$session_id"
printf ',"tree":'
json_string "$session_tree_path"
printf ',"snapshot_id":'
json_string "$snapshot_id"
printf '}\n'
