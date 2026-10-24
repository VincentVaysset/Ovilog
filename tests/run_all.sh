#!/bin/bash
# Lance toute la batterie contre www/ (servi sur le port 8998 si rien n'y répond).
# Usage : bash tests/run_all.sh [test_xxx ...]   (sans argument : tous les tests, puis la passe « fuseaux »)
# Découpage pour GitHub Actions (plusieurs machines en parallèle, voir .github/workflows/tests.yml) :
#   OVILOG_PART=k/n          seulement la k-ième part sur n des tests (répartition alternée par ordre alphabétique), sans la passe « fuseaux »
#   OVILOG_FUSEAUX=<fuseau>  seulement la passe « fuseaux » pour ce fuseau (UTC ou Europe/Paris)
# Sans ces variables : comportement complet inchangé (batterie locale avant chaque push).
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
PART="${OVILOG_PART:-}"
FUSEAU_SEUL="${OVILOG_FUSEAUX:-}"
if [ -n "$PART" ]; then
  K="${PART%/*}"; N="${PART#*/}"
  SELECTION=(); i=0
  for t in "${TESTS[@]}"; do [ $(( i % N )) -eq $(( K - 1 )) ] && SELECTION+=("$t"); i=$(( i + 1 )); done
  TESTS=("${SELECTION[@]}")
  echo "Part $PART : ${#TESTS[@]} test(s)"
fi
[ -n "$FUSEAU_SEUL" ] && TESTS=()
ECHEC=0
# Sur GitHub Actions : chaque échec devient aussi une annotation (nom du test + message FAIL), lisible sans ouvrir le journal complet
annoter() {
  [ -n "${GITHUB_ACTIONS:-}" ] || return 0
  local msg; msg=$(printf '%s\n' "$2" | grep -m1 -E 'FAIL|Error|TIMEOUT|PAGEERROR' | cut -c1-900)
  [ -n "$msg" ] || msg=$(printf '%s\n' "$2" | tail -1 | cut -c1-900)
  msg=${msg//'%'/'%25'}
  echo "::error title=$1::$msg"
}
for t in "${TESTS[@]}"; do
  sortie=$(timeout 300 node "$t.mjs" 2>&1); rc=$?
  if [ $rc -eq 0 ] && echo "$sortie" | grep -q '^SKIP'; then echo "$t : SKIP (export absent)";
  elif [ $rc -eq 0 ]; then echo "$t : OK";
  else echo "$t : ECHEC (code $rc)"; echo "$sortie" | tail -8; ECHEC=1; annoter "$t" "$sortie"; fi
done
# Passe « fuseaux » : les tests sensibles aux dates rejoués en UTC ET en Europe/Paris (un décalage d'un jour autour de minuit
# ou au jour de référence ne doit pas dépendre du fuseau de la tablette ou du PC). Désactivable : OVILOG_SANS_FUSEAUX=1.
if [ ${#@} -eq 0 ] && [ "${OVILOG_SANS_FUSEAUX:-0}" != "1" ] && [ -z "$PART" ]; then
  FUSEAUX=(UTC Europe/Paris); [ -n "$FUSEAU_SEUL" ] && FUSEAUX=("$FUSEAU_SEUL")
  for tz in "${FUSEAUX[@]}"; do
    for t in test_bilan_calculs test_resume_campagne test_pc_lactation test_bilan_mobile_reference test_comparatif_resume test_pc_regulariser test_controle_laitier_manquant test_campagne_points_1_2_3 test_changement_campagne_correctifs test_pc_saisie_misebas test_echos_filtre test_pc_echos test_mobile_add_lot_echos test_echos_raccourci test_prod_laitiere_data test_exports_prod_laitiere test_prod_laitiere_mobile test_prod_laitiere_eco_mobile test_prod_laitiere_pc test_prod_laitiere_eco_pc test_parametres_structure test_parametres_exploitation test_parametres_campagne test_parametres_listes test_parametres_sauvegarde test_parametres_imports test_declaration_ecran test_declaration_pdf test_calendrier_ecran test_inventaire_ecran test_inventaire_pdf test_pdf_harmonises test_registre_mobile test_bilan_campagne_mobile test_mouvements_mobile test_listes_brebis_beliers_mobile test_agneaux_mobile test_recherche_brebis test_accueil_mobile test_libelles_mobile test_echographies_pc test_regle_echos test_regle_misebas test_pas_de_scan_pc test_gabarit_pc test_accueil_pc test_pdf_couleurs test_pdf_lactation test_pdf_coherence test_info_bulles test_tableaux_pc test_tri_pc_charte test_bilan_pdf; do
      sortie=$(TZ=$tz timeout 300 node "$t.mjs" 2>&1); rc=$?
      if [ $rc -eq 0 ]; then echo "$t [TZ=$tz] : OK"; else echo "$t [TZ=$tz] : ECHEC (code $rc)"; echo "$sortie" | tail -8; ECHEC=1; annoter "$t [TZ=$tz]" "$sortie"; fi
    done
  done
fi
[ -n "$SERVEUR" ] && kill "$SERVEUR" 2>/dev/null
[ $ECHEC -eq 0 ] && echo "BATTERIE : TOUT VERT" || echo "BATTERIE : ECHEC"
exit $ECHEC
