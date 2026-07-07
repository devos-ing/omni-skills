#!/usr/bin/env bash
set -euo pipefail

command_name="${1:-install}"
alias_name="${GETSUPERPOWER_DEV_ALIAS:-getsuperpower-dev}"
bin_dir="${GETSUPERPOWER_DEV_BIN_DIR:-${HOME}/.local/bin}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
target="${bin_dir}/${alias_name}"

usage() {
  cat <<USAGE
Usage: scripts/dev-cli-alias.sh <install|uninstall|status>

Environment:
  GETSUPERPOWER_DEV_ALIAS    Command name to create. Default: getsuperpower-dev
  GETSUPERPOWER_DEV_BIN_DIR  Bin directory to write into. Default: ~/.local/bin
USAGE
}

install_alias() {
  mkdir -p "${bin_dir}"
  cat >"${target}" <<WRAPPER
#!/usr/bin/env bash
exec bun "${repo_root}/src/cli.ts" "\$@"
WRAPPER
  chmod 0755 "${target}"
  echo "Installed ${alias_name} -> ${target}"
  if [[ ":${PATH}:" != *":${bin_dir}:"* ]]; then
    echo "Warning: ${bin_dir} is not on PATH"
  fi
}

uninstall_alias() {
  if [[ -e "${target}" ]]; then
    rm "${target}"
    echo "Removed ${target}"
  else
    echo "No alias found at ${target}"
  fi
}

status_alias() {
  if [[ -x "${target}" ]]; then
    echo "Installed: ${target}"
    "${target}" -v
  else
    echo "Not installed: ${target}"
  fi
}

case "${command_name}" in
  install)
    install_alias
    ;;
  uninstall | unalias | remove)
    uninstall_alias
    ;;
  status)
    status_alias
    ;;
  -h | --help | help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
