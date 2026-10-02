#!/bin/bash
# Lance toute la batterie contre www/ (servi sur le port 8998 si rien n'y répond).
# Usage : bash tests/run_all.sh [test_xxx ...]   (sans argument : tous les tests)
set -u
cd "$(dirname "$0")"
URL="${OVILOG_URL:-http://localhost:8998/index.html}"
SERVEUR=""
if ! curl -s -o /dev/null "$URL"; then
  (cd ../www && python3 -m http.server 8998 >/dev/null 2>&1 & echo $! > /tmp/ovilog_tests_server.pid)
  SERVEUR=$(cat /tmp/ovilog_tests_server.pid); sleep 1
fi
TESTS=("$@")
[ ${#TESTS[@]} -eq 0 ] && TESTS=($(ls test_*.mjs | sed 's/\.mjs$//'))
ECHEC=0
for t in "${TESTS[@]}"; do
  sortie=$(timeout 300 node "$t.mjs" 2>&1); rc=$?
  if [ $rc -eq 0 ] && echo "$sortie" | grep -q '^SKIP'; then echo "$t : SKIP (export absent)";
  elif [ $rc -eq 0 ]; then echo "$t : OK";
  else echo "$t : ECHEC (code $rc)"; echo "$sortie" | tail -8; ECHEC=1; fi
done
[ -n "$SERVEUR" ] && kill "$SERVEUR" 2>/dev/null
[ $ECHEC -eq 0 ] && echo "BATTERIE : TOUT VERT" || echo "BATTERIE : ECHEC"
exit $ECHEC
