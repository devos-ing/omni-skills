#!/usr/bin/env python3
"""Record rationale snapshots before and after file mutations."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_STORE = ".pony-trail"
DEFAULT_COPY_LIMIT = 1024 * 1024


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def run_git(root: Path, *args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None
    return result.stdout.strip()


def git_info(root: Path) -> dict[str, str | bool | None]:
    git_root = run_git(root, "rev-parse", "--show-toplevel")
    if not git_root:
        return {"is_git_repo": False, "root": None, "branch": None, "head": None}
    return {
        "is_git_repo": True,
        "root": git_root,
        "branch": run_git(root, "branch", "--show-current"),
        "head": run_git(root, "rev-parse", "--short", "HEAD"),
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hash_string(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def instruction_git_info(root: Path) -> dict[str, str | bool | None]:
    status = run_git(root, "status", "--porcelain")
    return {
        "branch": run_git(root, "branch", "--show-current"),
        "commit": run_git(root, "rev-parse", "--short", "HEAD"),
        "dirty": None if status is None else bool(status),
    }


def instruction_file(root: Path, rel: str) -> dict[str, object]:
    path = root / rel
    if not path.exists():
        return {"path": rel, "status": "missing"}
    if not path.is_file():
        return {"path": rel, "status": "unreadable"}

    content = path.read_bytes()
    return {
        "path": rel,
        "status": "captured",
        "sha256": "sha256:" + hashlib.sha256(content).hexdigest(),
        "bytes": len(content),
    }


def discover_cursor_rules(root: Path) -> list[str]:
    rules = root / ".cursor" / "rules"
    if not rules.exists():
        return []
    return sorted(path.relative_to(root).as_posix() for path in rules.rglob("*") if path.is_file())


def installed_skill_metadata() -> dict[str, object]:
    skill_dir = Path(__file__).resolve().parent.parent
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.exists():
        return {"name": skill_dir.name, "status": "missing"}
    if not skill_file.is_file():
        return {"name": skill_dir.name, "status": "unreadable"}

    return {
        "name": skill_dir.name,
        "status": "captured",
        "version_or_sha256": "sha256:" + sha256(skill_file),
    }


def instruction_context(root: Path, session_id: str, timestamp_utc: str) -> dict[str, object]:
    files = [instruction_file(root, rel) for rel in discover_cursor_rules(root)]
    files.extend(
        [
            instruction_file(root, ".github/copilot-instructions.md"),
            instruction_file(root, "AGENTS.md"),
            instruction_file(root, "CLAUDE.md"),
        ]
    )

    return {
        "mode": "opt_in",
        "captured_at": timestamp_utc,
        "session_id_hash": hash_string(session_id),
        "git": instruction_git_info(root),
        "files": files,
        "skills": [installed_skill_metadata()],
        "warnings": [],
    }


def resolve_file(root: Path, raw_path: str) -> tuple[Path, str]:
    path = Path(raw_path).expanduser()
    if not path.is_absolute():
        path = root / path
    path = path.resolve()
    try:
        rel = path.relative_to(root).as_posix()
    except ValueError as exc:
        raise SystemExit(f"Refusing to snapshot path outside root: {raw_path}") from exc
    return path, rel


def copy_file(path: Path, rel: str, store: Path, snapshot_id: str, phase: str, limit: int) -> str | None:
    if not path.is_file() or path.stat().st_size > limit:
        return None
    destination = store / "files" / snapshot_id / phase / rel
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)
    return destination.relative_to(store).as_posix()


def file_state(root: Path, raw_path: str, store: Path, snapshot_id: str, phase: str, limit: int) -> dict[str, object]:
    path, rel = resolve_file(root, raw_path)
    if not path.exists():
        return {"path": rel, "exists": False}
    stat = path.stat()
    state: dict[str, object] = {
        "path": rel,
        "exists": True,
        "type": "directory" if path.is_dir() else "file",
        "size": stat.st_size,
        "mtime_ns": stat.st_mtime_ns,
    }
    if path.is_file():
        state["sha256"] = sha256(path)
        copied = copy_file(path, rel, store, snapshot_id, phase, limit)
        if copied:
            state["stored_copy"] = copied
        else:
            state["stored_copy"] = None
            state["copy_note"] = "not copied because file is missing, not regular, or above copy limit"
    return state


def write_entry(args: argparse.Namespace) -> dict[str, object]:
    root = Path(args.root).expanduser().resolve()
    store = (root / args.store).resolve()
    store.mkdir(parents=True, exist_ok=True)
    snapshot_id = args.snapshot_id or f"{utc_now()}-{secrets.token_hex(4)}"
    timestamp_utc = datetime.now(timezone.utc).isoformat()
    files = [
        file_state(root, raw_path, store, snapshot_id, args.phase, args.copy_limit)
        for raw_path in args.files
    ]

    entry = {
        "snapshot_id": snapshot_id,
        "session_id": args.session_id,
        "phase": args.phase,
        "timestamp_utc": timestamp_utc,
        "cwd": str(root),
        "git": git_info(root),
        "action": getattr(args, "action", None),
        "purpose": getattr(args, "purpose", None),
        "reason": getattr(args, "reason", None),
        "expected": getattr(args, "expected", None),
        "verify": getattr(args, "verify", None),
        "rollback": getattr(args, "rollback", None),
        "summary": getattr(args, "summary", None),
        "checks": getattr(args, "checks", None),
        "result": getattr(args, "result", None),
        "files": files,
    }

    if args.instruction_context:
        entry["instruction_context"] = instruction_context(root, args.session_id, timestamp_utc)

    log_path = store / "snapshots.jsonl"
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, sort_keys=True) + "\n")
    return {"snapshot_id": snapshot_id, "log": str(log_path), "files": len(files)}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Record file-change rationale snapshots.")
    parser.add_argument("--root", default=".", help="Workspace root to snapshot. Defaults to current directory.")
    parser.add_argument("--store", default=DEFAULT_STORE, help="Snapshot directory relative to root.")
    parser.add_argument("--copy-limit", type=int, default=DEFAULT_COPY_LIMIT, help="Maximum bytes to copy per file.")
    parser.add_argument("--session-id", default=os.environ.get("PONYTRAIL_SESSION_ID", "default"))
    parser.add_argument(
        "--instruction-context",
        action="store_true",
        default=(os.environ.get("PONYTRAIL_INSTRUCTION_CONTEXT") or "").lower() in {"1", "true", "yes"},
    )

    subparsers = parser.add_subparsers(dest="phase", required=True)
    pre = subparsers.add_parser("pre", help="Record intent and original file state before a mutation.")
    pre.add_argument("--snapshot-id", help="Optional explicit snapshot id.")
    pre.add_argument("--files", nargs="+", required=True)
    pre.add_argument("--action", required=True)
    pre.add_argument("--purpose", required=True)
    pre.add_argument("--reason", required=True)
    pre.add_argument("--expected", required=True)
    pre.add_argument("--verify", required=True)
    pre.add_argument("--rollback", required=True)

    post = subparsers.add_parser("post", help="Record result and final file state after a mutation.")
    post.add_argument("--snapshot-id", required=True)
    post.add_argument("--files", nargs="+", required=True)
    post.add_argument("--summary", required=True)
    post.add_argument("--checks", default="")
    post.add_argument("--result", default="")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    result = write_entry(args)
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
