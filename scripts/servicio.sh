#!/usr/bin/env bash
# Prospector como servicio de macOS (launchd): arranca al iniciar sesión y se reinicia si se cae.
#   npm run servicio -- instalar     compila y deja el servicio corriendo en http://127.0.0.1:4321
#   npm run servicio -- actualizar   recompila (después de git pull) y reinicia
#   npm run servicio -- reiniciar
#   npm run servicio -- estado
#   npm run servicio -- logs
#   npm run servicio -- desinstalar
set -euo pipefail

LABEL="com.prospector.app"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="$HOME/.prospector/logs"
PORT="${PROSPECTOR_PORT:-4321}"
NODE_BIN="$(command -v node || true)"
DOMAIN="gui/$(id -u)"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Este script es para macOS. En Windows o Linux usa: npm run build && npm start" >&2
  exit 1
fi

compilar() {
  echo "Compilando…"
  (cd "$DIR" && npm run build >/dev/null)
}

escribir_plist() {
  [[ -n "$NODE_BIN" ]] || { echo "No encuentro node en el PATH." >&2; exit 1; }
  mkdir -p "$LOGDIR" "$(dirname "$PLIST")"
  cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>--disable-warning=ExperimentalWarning</string>
    <string>$DIR/node_modules/next/dist/bin/next</string>
    <string>start</string>
    <string>-H</string><string>127.0.0.1</string>
    <string>-p</string><string>$PORT</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key><string>production</string>
    <key>PATH</key><string>$(dirname "$NODE_BIN"):/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOGDIR/servidor.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/servidor.log</string>
</dict>
</plist>
EOF
}

detener() { launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true; }
arrancar() { launchctl bootstrap "$DOMAIN" "$PLIST"; }

puerto_ocupado() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; }

case "${1:-estado}" in
  instalar)
    detener
    if puerto_ocupado; then
      echo "El puerto $PORT está ocupado (¿npm run dev abierto?). Ciérralo y vuelve a intentar." >&2
      exit 1
    fi
    compilar
    escribir_plist
    arrancar
    sleep 3
    echo "Listo: http://127.0.0.1:$PORT  (arranca solo al iniciar sesión; registros en $LOGDIR/servidor.log)"
    ;;
  actualizar)
    compilar
    detener
    escribir_plist
    arrancar
    echo "Actualizado y reiniciado."
    ;;
  reiniciar)
    launchctl kickstart -k "$DOMAIN/$LABEL" && echo "Reiniciado."
    ;;
  estado)
    if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
      launchctl print "$DOMAIN/$LABEL" | grep -E "state =|pid =|last exit" | sed 's/^[[:space:]]*/  /'
      curl -s -o /dev/null -w "  http://127.0.0.1:$PORT responde %{http_code}\n" "http://127.0.0.1:$PORT/ajustes" || echo "  No responde todavía."
    else
      echo "No está instalado. Usa: npm run servicio -- instalar"
    fi
    ;;
  logs)
    tail -n 80 -f "$LOGDIR/servidor.log"
    ;;
  desinstalar)
    detener
    rm -f "$PLIST"
    echo "Servicio quitado. Tus datos en ~/.prospector siguen intactos."
    ;;
  *)
    echo "Uso: npm run servicio -- instalar|actualizar|reiniciar|estado|logs|desinstalar" >&2
    exit 1
    ;;
esac
