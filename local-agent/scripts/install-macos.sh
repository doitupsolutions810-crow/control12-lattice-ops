#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${CONTROL12_ROOT:-$HOME/.control12}"
APP="$ROOT/app"
BIN="$HOME/.local/bin"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/backups/install-$STAMP"

if ! command -v brew >/dev/null 2>&1; then
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  else
    echo "ERROR: Homebrew is required" >&2
    exit 1
  fi
fi

brew list node@22 >/dev/null 2>&1 || brew install node@22
brew list llama.cpp >/dev/null 2>&1 || brew install llama.cpp
brew list jq >/dev/null 2>&1 || brew install jq

NODE="$(brew --prefix node@22)/bin/node"

"$NODE" --check "$SOURCE_DIR/src/server.mjs"
"$NODE" --check "$SOURCE_DIR/src/cli.mjs"
bash -n "$SOURCE_DIR/scripts/control12-app"

mkdir -p "$APP" "$BIN" "$ROOT/state" "$ROOT/logs" "$ROOT/run" "$BACKUP"

for file in "$APP/server.mjs" "$APP/cli.mjs" "$BIN/control12-app"; do
  if [ -e "$file" ]; then
    cp -p "$file" "$BACKUP/"
  fi
done

install -m 0644 "$SOURCE_DIR/src/server.mjs" "$APP/server.mjs"
install -m 0644 "$SOURCE_DIR/src/cli.mjs" "$APP/cli.mjs"
install -m 0755 "$SOURCE_DIR/scripts/control12-app" "$BIN/control12-app"
ln -sf "$BIN/control12-app" "$BIN/control12"

PATH_LINE='export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"'
grep -Fq "$PATH_LINE" "$HOME/.zshrc" 2>/dev/null || printf '\n%s\n' "$PATH_LINE" >> "$HOME/.zshrc"

"$BIN/control12-app" restart
"$BIN/control12-app" doctor
"$BIN/control12-app" capabilities

echo "CONTROL12 v0.8.0 installed"
echo "Backup: $BACKUP"
