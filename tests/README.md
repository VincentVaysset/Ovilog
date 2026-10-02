# Tests d'intégration Ovilog

Tests navigateur (Playwright + Chromium) qui exécutent le **vrai** `www/index.html`.
La synchro cloud est testée contre un **faux backend Firestore local**
(`lib/fake_firebase_backend.mjs` + `lib/fake_firebase_bundle.mjs`) : aucun compte
ni donnée réels, aucun accès réseau externe. Les plugins natifs Android
(Filesystem, FileSaver, Share) sont simulés en mémoire dans les tests concernés.

## Lancer

```bash
cd tests
npm install                      # installe Playwright
npx playwright install chromium  # ou : export CHROMIUM_PATH=/chemin/vers/chrome
bash run_all.sh                  # tous les tests ; ou : bash run_all.sh test_lot_tableau
```

`run_all.sh` sert `www/` sur le port 8998 si rien n'y répond (`OVILOG_URL` pour
changer l'adresse). Code de sortie 0 = tout vert.

## Données réelles (jamais versionnées)

Certains tests relisent, **en lecture seule**, un export réel de l'élevage. Ces
fichiers ne sont **pas** dans le dépôt : `tests/data/` est ignoré par git. Sans eux,
ces tests affichent `SKIP` et sortent avec le code 0.

| Fichier à déposer dans `tests/data/` | Variable pour un autre chemin |
|---|---|
| `troupeau-sauvegarde-2026-09-29.json` (export original du 29/09) | `OVILOG_EXPORT_ORIGINAL` |
| `troupeau_corrige.json` (après réparation) | `OVILOG_EXPORT_CORRIGE` |

Le second se régénère depuis le premier :
`python3 tools/build_corrected_json.py data/troupeau-sauvegarde-2026-09-29.json data/troupeau_corrige.json`
(retire les 29 fiches brebis en doublon d'EID, les 29 clés parasites de
`registre.brebis`, pose `campagneDebut=2026` ; attendus : 433 fiches, 428 actives).

Tests qui utilisent un export : `test_migration_registre`, `test_etape2_archivage_registre`,
`test_brebis_a_regulariser`, `test_mouvements_affichage`.

## Comparaison avant / après

`test_mouvements_affichage` peut comparer deux versions de l'appli : servir la
version précédente sur un autre port (`git archive <commit> www | tar -x -C /tmp/avant`,
puis `python3 -m http.server 8997` dans `/tmp/avant/www`) et lancer
`URL_AVANT=http://localhost:8997/index.html node test_mouvements_affichage.mjs`.
Sans `URL_AVANT`, seuls les attendus de la version actuelle sont vérifiés.
`test_collisions_sieol` et `test_lot_sieol` acceptent `BASE_URL` pour la même raison.

## Contenu

| Test | Ce qu'il vérifie |
|---|---|
| `test_changement_campagne_correctifs` | Les correctifs de la bascule : année, verrou, anti-doublon d'EID, sauvegarde relue, écran de résultat |
| `test_campagne_points_1_2_3` | Point de restauration interne, confirmation avant le seuil (horloge simulée), partage à la demande |
| `test_sync_batching_reel` | Synchro par `writeBatch`, convergence de 2 appareils, modification concurrente pendant la bascule |
| `test_regression_manuelle_point6` | Non-régression : écho, mise bas, mouvement, traitement, import CSV, entre 2 appareils |
| `test_phase_f_ajustements` | Rejeu opération par opération, pastille de synchro, réconciliation au démarrage, « Tester la sauvegarde » et rotation |
| `test_reconciliation_edge_cases` | Hors-ligne, fusion champ par champ, instantanés distants périmés |
| `test_meta_concurrente` | Deux appareils modifient `meta` en même temps : aucun n'écrase l'autre |
| `test_migration_registre` | Migration du registre vers une collection dédiée (création seule, idempotente, 2e appareil) |
| `test_etape2_archivage_registre` | Archivage complet des sorties, ordre d'écriture, journal, bilans identiques, mouvements collectifs archivés |
| `test_nettoyage_date_ref` | Le nettoyage du registre prend `campagneDateDemarrage` comme référence |
| `test_brebis_a_regulariser` | Onglet « À régulariser » : écho seule apparaît, mise bas et vide définitive non |
| `test_export_saf` | Sauvegarde bloquante avec export visible (succès, annulation, échec, relecture fausse, activité recréée) |
| `test_export_fichiers_saf` | Exports PDF/xlsx et « Exporter mes données » via le sélecteur système |
| `test_import_saf` | Import JSON : export bloquant et voie de secours explicite |
| `test_bips_lots` | Bips A / B / C / ambigu dans les écrans de lot |
| `test_lot_tableau` | Lot en tableau : cases, tri, état en `localStorage`, remise à zéro |
| `test_lot_sieol` | Recherche par n° SIEOL court/long dans un lot |
| `test_collisions_sieol` | Non-régression du résolveur partagé (écho rapide, mise bas rapide, mouvement collectif) |
| `test_misebas_tableau` | Tableau des mises bas : nombres par sexe, totaux |
| `test_mouvements_affichage` | Écran « Mouvements d'animaux » : filtre d'affichage par campagne, aucune donnée modifiée |
| `test_regle_antenaise` | Antenaises = millésime le plus jeune de la campagne (registre compris), avertissement « pas de renouvellement » daté de `campagneDateDemarrage`, EID illisible, brebis qui met bas puis passe au registre, cohérence écran / lots / PDF, aucune écriture ; avant/après sur l'export (`URL_AVANT`) |
| `test_dedoublonnage_registre` | Fusion d'archivage par comptage d'occurrences ; analyse des doublons du registre en lecture seule ; écran (lignes cochées par défaut, « avant → après ») ; application : export visible avant, annulation / échec = rien modifié, garde « modifiée ailleurs », échec d'écriture d'une entrée, 2e appareil ; export réel (115 entrées / 230 éléments) |
| `test_bilan_calculs` | `bilanReproductionCampagne(N)` : jeu synthétique qui reproduit le bilan externe du 23/09 (363 mises bas, 299/64/0, 427 nés, 38 morts, 1,20/1,07/1,18, 9,30/26,39/12,18 %), courbe S1…, cas limites, hors cohorte, registre, campagne passée stable, mouvements, recoupement avec le tableau mobile, export réel en lecture seule |
| `test_bilan_pc` | Page PC du Bilan de reproduction (écran PC simulé) : 4 KPI, tableau par groupe du bilan du 23/09 lu dans le DOM, courbe SVG, portées, millésimes, mouvements, sélecteur de campagne, comparatif, lots IA/Éponge, alertes, campagne vide, bouton PDF par âge ; mobile inchangé |
| `test_bilan_pdf` | PDF « bilan de reproduction complet » A4 : structure valide (xref), chiffres du bilan du 23/09 relus dans le texte du PDF, campagne passée / vide / grosse campagne, nom de fichier et type MIME, bouton de la page PC, PDF « par âge » d'une campagne passée |
| `test_bilan_mobile_reference` | HTML mobile du bilan comparé octet pour octet à `ref/bilan_mobile.html` (jeu synthétique, référence prise après la règle antenaise ; `OVILOG_MAJ_REF=1` pour la régénérer volontairement) |

## Ce que ces tests ne couvrent pas

- Le code natif Android (`FileSaverPlugin.java`, `ApkInstallerPlugin.java`) : seule la CI le compile ;
  son comportement (sélecteur système, FileProvider, partage) ne se vérifie que sur un appareil.
- Le vrai Firestore : le faux backend simule `writeBatch`, `arrayUnion`, `onSnapshot` par polling.
- Electron / Windows.
