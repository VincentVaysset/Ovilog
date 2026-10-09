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
# Passe « fuseaux » : les tests sensibles aux dates rejoués en UTC ET en Europe/Paris (un décalage d'un jour autour de minuit
# ou au jour de référence ne doit pas dépendre du fuseau de la tablette ou du PC). Désactivable : OVILOG_SANS_FUSEAUX=1.
if [ ${#@} -eq 0 ] && [ "${OVILOG_SANS_FUSEAUX:-0}" != "1" ]; then
  for tz in UTC Europe/Paris; do
    for t in test_bilan_calculs test_resume_campagne test_pc_lactation test_bilan_mobile_reference test_comparatif_resume test_pc_regulariser test_controle_laitier_manquant test_campagne_points_1_2_3 test_changement_campagne_correctifs test_pc_saisie_misebas test_echos_filtre test_pc_echos test_mobile_add_lot_echos test_echos_raccourci test_prod_laitiere_data test_exports_prod_laitiere test_prod_laitiere_mobile test_prod_laitiere_eco_mobile test_prod_laitiere_pc test_prod_laitiere_eco_pc test_parametres_structure test_parametres_exploitation test_parametres_campagne test_parametres_listes test_parametres_sauvegarde test_parametres_imports test_declaration_ecran test_declaration_pdf test_calendrier_ecran; do
      sortie=$(TZ=$tz timeout 300 node "$t.mjs" 2>&1); rc=$?
      if [ $rc -eq 0 ]; then echo "$t [TZ=$tz] : OK"; else echo "$t [TZ=$tz] : ECHEC (code $rc)"; echo "$sortie" | tail -8; ECHEC=1; fi
    done
  done
fi
[ -n "$SERVEUR" ] && kill "$SERVEUR" 2>/dev/null
[ $ECHEC -eq 0 ] && echo "BATTERIE : TOUT VERT" || echo "BATTERIE : ECHEC"
exit $ECHEC
