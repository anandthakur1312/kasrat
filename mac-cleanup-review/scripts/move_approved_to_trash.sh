#!/usr/bin/env bash
set -euo pipefail

APPLY=0
if [ "${1:-}" = "--apply" ]; then
  APPLY=1
  shift
fi

APPROVAL_FILE="${1:-}"
if [ -z "$APPROVAL_FILE" ] || [ ! -f "$APPROVAL_FILE" ]; then
  echo "Usage: $0 [--apply] /path/to/approved-paths.txt" >&2
  exit 2
fi

TRASH_DIR="$HOME/.Trash/Codex cleanup $(date +%Y%m%d-%H%M%S)"
LOG_DIR="/Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review/reports"
LOG_FILE="$LOG_DIR/move-approved-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOG_DIR"

echo "Approval file: $APPROVAL_FILE" | tee "$LOG_FILE"
if [ "$APPLY" -eq 1 ]; then
  echo "Mode: APPLY, moving approved paths to Trash" | tee -a "$LOG_FILE"
  mkdir -p "$TRASH_DIR"
  echo "Trash folder: $TRASH_DIR" | tee -a "$LOG_FILE"
else
  echo "Mode: DRY RUN, no files will be moved" | tee -a "$LOG_FILE"
fi

move_one() {
  local path="$1"
  local base dest

  if [ ! -e "$path" ]; then
    echo "SKIP missing: $path" | tee -a "$LOG_FILE"
    return
  fi

  case "$path" in
    "/"|"/System"|"/Library"|"/Applications"|"$HOME"|"$HOME/Library"|"$HOME/Documents"|"$HOME/Desktop"|"$HOME/Pictures"|"$HOME/Music"|"$HOME/Movies")
      echo "REFUSE broad/system path: $path" | tee -a "$LOG_FILE"
      return
      ;;
  esac

  echo "APPROVED: $path" | tee -a "$LOG_FILE"
  du -sh "$path" 2>/dev/null | tee -a "$LOG_FILE" || true

  if [ "$APPLY" -eq 1 ]; then
    base="$(basename "$path")"
    dest="$TRASH_DIR/$base"
    if [ -e "$dest" ]; then
      dest="$TRASH_DIR/${base}.$(date +%s)"
    fi
    mv "$path" "$dest"
    echo "MOVED: $path -> $dest" | tee -a "$LOG_FILE"
  fi
}

while IFS= read -r raw || [ -n "$raw" ]; do
  path="${raw#"${raw%%[![:space:]]*}"}"
  path="${path%"${path##*[![:space:]]}"}"
  [ -z "$path" ] && continue
  case "$path" in \#*) continue ;; esac
  move_one "$path"
done < "$APPROVAL_FILE"

if [ "$APPLY" -eq 1 ]; then
  echo "Finished. Items are in: $TRASH_DIR" | tee -a "$LOG_FILE"
else
  echo "Dry run finished. Re-run with --apply after reviewing output." | tee -a "$LOG_FILE"
fi

echo "Log: $LOG_FILE"

