#!/usr/bin/env bash
set -u

ROOT="/Users/anand.thakur1312/workspace/2026/fitness-club/mac-cleanup-review"
REPORT_DIR="$ROOT/reports"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$REPORT_DIR/scan-$STAMP.txt"
HOME_DIR="${HOME:-/Users/anand.thakur1312}"

mkdir -p "$REPORT_DIR"

section() {
  printf '\n\n===== %s =====\n' "$1" | tee -a "$OUT"
}

run() {
  printf '\n$ %s\n' "$*" | tee -a "$OUT"
  "$@" 2>&1 | tee -a "$OUT"
}

{
  printf 'Mac cleanup read-only scan\n'
  printf 'Generated: %s\n' "$(date)"
  printf 'User: %s\n' "${USER:-unknown}"
  printf 'Home: %s\n' "$HOME_DIR"
} > "$OUT"

section "System And Disk"
run sw_vers
run df -h / /System/Volumes/Data
diskutil apfs list 2>/dev/null | sed -n '1,220p' | tee -a "$OUT"

section "Home And Users Sizes"
du -sh /Users/* 2>/dev/null | sort -hr | tee -a "$OUT"
printf '\nHome top-level:\n' | tee -a "$OUT"
du -sh "$HOME_DIR"/* "$HOME_DIR"/.[!.]* 2>/dev/null | sort -hr | sed -n '1,180p' | tee -a "$OUT"

section "Applications By Size"
find /Applications "$HOME_DIR/Applications" -maxdepth 1 -name '*.app' -print0 2>/dev/null |
  xargs -0 du -sh 2>/dev/null |
  sort -hr |
  sed -n '1,240p' |
  tee -a "$OUT"

section "Library Hotspots"
du -sh "$HOME_DIR/Library"/* 2>/dev/null | sort -hr | sed -n '1,160p' | tee -a "$OUT"
printf '\nApplication Support:\n' | tee -a "$OUT"
du -sh "$HOME_DIR/Library/Application Support"/* 2>/dev/null | sort -hr | sed -n '1,140p' | tee -a "$OUT"
printf '\nCaches:\n' | tee -a "$OUT"
du -sh "$HOME_DIR/Library/Caches"/* 2>/dev/null | sort -hr | sed -n '1,140p' | tee -a "$OUT"
printf '\nContainers:\n' | tee -a "$OUT"
du -sh "$HOME_DIR/Library/Containers"/* 2>/dev/null | sort -hr | sed -n '1,140p' | tee -a "$OUT"

section "Developer And Package Caches"
du -sh "$HOME_DIR/.gradle" "$HOME_DIR/.m2" "$HOME_DIR/.npm" "$HOME_DIR/.cache" "$HOME_DIR/.sbt" "$HOME_DIR/.nvm/.cache" "$HOME_DIR/.minikube" "$HOME_DIR/.docker" "$HOME_DIR/.kube" 2>/dev/null | sort -hr | tee -a "$OUT"
printf '\nBuild/cache directories under home:\n' | tee -a "$OUT"
find "$HOME_DIR" \
  -path "$HOME_DIR/Library" -prune -o \
  -path "$HOME_DIR/Pictures/Photos Library.photoslibrary" -prune -o \
  -type d \( -name node_modules -o -name target -o -name build -o -name dist -o -name .next -o -name .turbo -o -name .parcel-cache -o -name __pycache__ -o -name venv -o -name .venv \) \
  -prune -print0 2>/dev/null |
  xargs -0 du -sh 2>/dev/null |
  sort -hr |
  sed -n '1,220p' |
  tee -a "$OUT"

section "Docker Minikube Xcode Homebrew"
du -sh "$HOME_DIR/.minikube" "$HOME_DIR/Library/Containers/com.docker.docker" "$HOME_DIR/Library/Application Support/Docker Desktop" "$HOME_DIR/Library/Developer" /Library/Developer /Applications/Xcode.app 2>/dev/null | tee -a "$OUT"
printf '\nDocker system df:\n' | tee -a "$OUT"
docker system df 2>/dev/null | tee -a "$OUT" || true
printf '\nHomebrew cleanup dry-run:\n' | tee -a "$OUT"
if command -v brew >/dev/null 2>&1; then
  brew cleanup -n 2>&1 | sed -n '1,200p' | tee -a "$OUT"
else
  printf 'brew not found\n' | tee -a "$OUT"
fi

section "Large Files"
find "$HOME_DIR" \
  -path "$HOME_DIR/Library" -prune -o \
  -path "$HOME_DIR/Pictures/Photos Library.photoslibrary" -prune -o \
  -type f -size +500M -print0 2>/dev/null |
  xargs -0 ls -lh 2>/dev/null |
  sed -n '1,200p' |
  tee -a "$OUT"

section "Installers And Archives"
find "$HOME_DIR/Downloads" "$HOME_DIR/Desktop" "$HOME_DIR/Documents" "$HOME_DIR/workspace" "$HOME_DIR/Applications" /Applications/workspace \
  -type f \( -iname '*.dmg' -o -iname '*.pkg' -o -iname '*.zip' -o -iname '*.tar' -o -iname '*.tar.gz' -o -iname '*.tgz' -o -iname '*.rar' -o -iname '*.7z' -o -iname '*.iso' \) \
  -print0 2>/dev/null |
  xargs -0 ls -lh 2>/dev/null |
  sed -n '1,260p' |
  tee -a "$OUT"

section "Old IDE And App Leftovers"
find "$HOME_DIR/Library/Application Support" "$HOME_DIR/Library/Preferences" "$HOME_DIR/Library/Caches" "$HOME_DIR/Library/Saved Application State" \
  -maxdepth 2 \( -iname '*eclipse*' -o -iname '*sts*' -o -iname '*webstorm*' -o -iname '*intellijidea2019*' -o -iname '*intellijidea2022*' -o -iname '*oracle*' -o -iname '*java-updater*' \) \
  -print0 2>/dev/null |
  xargs -0 du -sh 2>/dev/null |
  sort -hr |
  sed -n '1,180p' |
  tee -a "$OUT"

section "Logs And Trash"
du -sh "$HOME_DIR/Library/Logs"/* 2>/dev/null | sort -hr | sed -n '1,120p' | tee -a "$OUT"
printf '\nTrash/review folders:\n' | tee -a "$OUT"
du -sh "$HOME_DIR/.Trash" "$HOME_DIR/Desktop/Trash" "$HOME_DIR/Desktop/Cleanup Trash Review" 2>/dev/null | tee -a "$OUT"

section "Workspace Mirrors"
for p in "$HOME_DIR/workspace" /Applications/workspace "$HOME_DIR/Public/Coding" "$HOME_DIR/workspace/Coding" /Applications/workspace/Coding; do
  [ -e "$p" ] && du -sh "$p"
done 2>/dev/null | tee -a "$OUT"
printf '\nFile counts:\n' | tee -a "$OUT"
for p in "$HOME_DIR/workspace" /Applications/workspace; do
  if [ -d "$p" ]; then
    printf '%s files: ' "$p" | tee -a "$OUT"
    find "$p" -type f 2>/dev/null | wc -l | tee -a "$OUT"
  fi
done

section "Done"
printf 'Report written to: %s\n' "$OUT" | tee -a "$OUT"

