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
| `test_resume_campagne` | Résumé de campagne figé (`DB.resumesCampagne`) : aller-retour identique au calcul vivant, adoptés, migrateData, synchro meta vers un 2e appareil, création à la bascule après l'export visible et avant toute modification, jamais écrasé, garde « aucune mise bas » |
| `test_saisie_resume` | Saisie guidée du résumé 2026 (bilan externe du 23/09) : écran prérempli, valeurs dérivées, taux imprimés retrouvés, incohérences signalées sans correction, rien d'écrit sans confirmation ni export visible, remplacement sur confirmation |
| `test_comparatif_resume` | Page PC et PDF « bilan complet » : comparaison « 2027 vs 2026 » (écarts des KPI et du tableau comparatif, couleurs), campagne 2026 lue dans son résumé (source, KPI, adoptés 3/1/4, courbe et millésimes « non disponibles », pas d'« allaitement artificiel »), données vivantes prioritaires dès qu'il y a des mises bas, 0 écriture |
| `test_controle_laitier_manquant` | Règle « mise bas sans contrôle laitier » : fonction pure (contrôlée / jamais contrôlée / vendue / archivée / autre campagne / contrôle au registre / aucun contrôle importé), « attendue à la traite » au sens de l'appli, cohérence avec « brebis passées à la traite » du bilan de lactation, carte mobile et PC, « Ouvrir la fiche », 0 écriture |
| `test_mobile_ecrans_reference` | HTML mobile de Brebis à régulariser (sans contrôle importé / tous contrôlés), Bilan économique, Bilan de lactation et Saisie de mises bas comparé octet pour octet à `ref/ecrans_mobile.json` (horloge figée ; `OVILOG_MAJ_REF=1` pour régénérer volontairement) |
| `test_pc_regulariser` | Page PC « Brebis à régulariser » : indicateurs, avancement, listes n° + âge, recherche par n° saisi et filtre par âge, « Voir les N autres », carte « sans contrôle laitier » après le 1er contrôle, incohérences signalées, millésimes, export Excel, cohérence avec l'écran mobile et la règle |
| `test_pc_lactation` | Page PC « Bilan de lactation » : indicateurs identiques à l'écran mobile, litrage et effectif par mois (somme = tank, moyenne = calcul de l'appli), valeurs modifiables (badge « Valeur corrigée », « Recalculer »), indicateur et carte « mises bas sans contrôle laitier » cohérents avec la règle et avec Brebis à régulariser, valeurs de la maquette (108 178 L, 351, 308,2 L, 285,4 L, 96,7 % avec le résumé de campagne), comparaison avec la campagne précédente, exports |
| `test_pc_economique` | Page PC « Bilan économique » : montants et prix = bilanCampagneQualite, gain = grades + Super A − pénalités, prix moyen × volume = montant, litrage = somme mensuelle du tank = bilan de lactation, mois sans MSU signalés hors gain, détail du mois cliquable, coefficient MSU modifiable, rapport PDF, campagne vide, 0 écriture |
| `test_pc_saisie_misebas` | Page PC « Saisie de mises bas » : indicateurs, saisie du n° (aucune mention de bip), compteurs Mâles / Femelles / Mort-nés, Repro déduite et modifiable, date future à confirmer, blocages (déjà une mise bas, brebis inconnue), vide définitive → incohérence signalée jamais corrigée, restantes attendues = calcul du bilan de campagne, annulations, avancement |
| `test_pc_controle_laitier` | Page PC « Contrôle laitier » : indicateurs (contrôlées, moyennes C1/C2/C3, sans contrôle), filtres en barre + Réinitialiser, tableau sans colonne « Moyenne » avec valeurs sous le seuil surlignées, distribution du contrôle choisi (seuil en pointillé, tranches orange), cases à cocher et action existante « Créer un lot de recherche », carte « sans contrôle laitier » = même fonction que Brebis à régulariser, exports qui suivent les filtres, tirets avant le 1er contrôle |
| `test_pc_registre` | Page PC « Registre d'élevage » : indicateurs (soins, traitements, vaccins, autres, animaux au registre actifs + sortis), filtres sur une seule ligne, tableau pleine largeur sans défilement horizontal (colonne Campagne visible), 3 onglets, clic sur un n° sans effet, lecture seule (DB identique, 0 saveData), exports Excel et PDF identiques à ceux de l'écran mobile (sans filtre et avec filtres posés depuis la page PC, comparés à `ref/cl_registre_mobile.json`) |
| `test_cl_registre_reference` | HTML mobile de Contrôle laitier et du Registre d'élevage (3 onglets) et exports du registre (xlsx : feuilles, PDF : octets des 3 onglets, sans filtre et avec filtres) comparés à `ref/cl_registre_mobile.json`, pris avant les pages PC (`OVILOG_MAJ_REF=1` pour régénérer volontairement) |
| `test_pc_produits_delais` | Fiche produit « Produits et délais » (PC) : modèle (délais lait / viande, ordonnance, réservé vétérinaire), anciennes valeurs à confirmer ou corriger (delaiAttente = lait, clés ANMV jamais lues), délais obligatoires 0 autorisé, écritures de l'écran mobile fusionnées, soins déjà enregistrés inchangés ; `saveData` remplacé par un compteur |
| `test_carnet_mobile_reference` | HTML des écrans mobiles du carnet sanitaire (Sanitaire, Gérer les produits, Sous délai, Traitement collectif et historique, Ordonnances, saisie d'un soin, fiche brebis) comparé à `ref/carnet_mobile.json`, pris avant le chantier Carnet sanitaire PC |
| `test_pc_carnet_sanitaire` | Carnet sanitaire PC en 2 écrans : champs obligatoires et conditionnels (ordonnance, réservé vétérinaire, fiche à confirmer, soin « Autre »), délais repris de la fiche et modifiables sans la changer, dates calculées en direct, filtres multi-choix / recherche / millésime / lot, Tout cocher sur le filtré, seuls les animaux actifs (ni vendue ni agneau), UN soin par animal, annulation du lot avec confirmation, mobile inchangé. saveData remplacé par un compteur. |
| `test_pc_carnet_dates` | Carnet sanitaire PC : calculs de dates en jours entiers (20/09 + durée 1 + délai 3 → 24/09, durée multiple, délai 0, mois, année, fin février 2027 et 2028 bissextile, soin ancien « — »), frontière (le jour de la reprise l'animal est libre), tableaux « En délai d'attente aujourd'hui » (cohérents avec la pastille de l'écran 2) et « Derniers soins » (lot regroupé, ancien soin sans erreur), dates jamais stockées. |
| `test_pc_carnet_alertes` | Alertes du carnet sanitaire (PC, information seulement, jamais bloquantes ni corrigées) : vente / autoconsommation / « Vendu » d'un animal sous délai viande (pas Vente reproduction / Morte / Perte), frontière le jour de la reprise, mouvement individuel, collectif, agneau, agnelle ; Séléphérol (sans fiche : « — » + alerte pour créer la fiche, délais obligatoires, copie des délais sur le soin à la naissance) ; import contrôle laitier (SIEOL et modèle Ovilog, fichiers réels chargés) : contrôles tombant pendant un délai d'attente du lait, rien modifié ; mobile : rien ajouté. |
| `test_alertes_mobile_reference` | HTML des écrans mobiles touchés par les alertes (mouvement individuel et collectif, fenêtres de vente d'un agneau et d'une agnelle, écrans d'import du contrôle laitier) comparé à `ref/alertes_mobile.json`, pris AVANT les alertes (jeu synthétique). |
| `test_export_sanitaire` | Exports du Sanitaire (Excel et PDF) : les 8 colonnes d'origine comparées à `ref/export_sanitaire_avant.json` (prise AVANT les nouvelles colonnes), sans filtre et avec filtres ; colonnes ajoutées (voie, durée, date de fin, fait par, reprise du lait, vente dès le ; PDF : date de fin, voie, fait par en priorité, les deux dernières si la place le permet) ; anciens soins « — » ; mise en page PDF sans chevauchement ; bouton « Exporter le carnet (Excel) ». `test_cl_registre_reference` et `test_pc_registre` comparent désormais les autres feuilles / PDF octet pour octet et seulement le nom de fichier du Sanitaire. |
| `test_dates_fuseaux` | Dates identiques en UTC et en Europe/Paris (un contexte navigateur par fuseau, horloge à 23 h 30 UTC = 01 h 30 à Paris) : « aujourd'hui » en jour local (formulaires, Sous délai d'attente), présence à la date de référence (entrée / sortie datées du jour de référence), date de bascule, rappel « Vide définitive », garde-fou : plus aucun `new Date().toISOString().slice(0, 10)`. `run_all.sh` rejoue aussi les tests sensibles aux dates avec `TZ=UTC` et `TZ=Europe/Paris`. |
| `test_pc_bio` | Élevage bio : délais légaux saisis, doublés dans les calculs (7 → 14, 28 → 56 ; maquette 20/09 → reprise 05/10, vente 16/11), délai légal 0 : minimum 48 h selon l'option du produit (oui / non / à confirmer, mention visible), délais appliqués + indicateur bio figés dans le soin (réglage ou fiche modifiés : soins inchangés), options « minimum 48 h bio » et « compte dans les 3 traitements » (défauts par catégorie, colonnes de Produits et délais), carte Paramètres, mobile « Sous délai d'attente » et fiche brebis en bio, Séléphérol, alerte de vente. |
| `test_pc_bio_soins_existants` | Soins enregistrés avec la 1.0.198 sans indicateur bio : bandeau et liste (anciens soins et soins déjà bio exclus ; registre et Séléphérol d'agneau inclus), aperçu avant / après, « identique à la fiche » coché / « différent » décoché, rien écrit à l'affichage, application uniquement sur clic avec sauvegarde exportée AVANT (confirmation refusée, sauvegarde en échec ou annulée : rien modifié), soins non cochés strictement inchangés, annulation exacte. |
| `test_pc_traitements_12_mois` | Suivi bio « Traitements sur 12 mois » (PC et mobile, une seule fonction pure) : fenêtre glissante (Au − 1 an + 1 jour, 29/02 compris), bornes, cure = 1 traitement, soin collectif = 1 par animal, option « compte » par produit (oui / non / à confirmer non compté et signalé), numérotation chronologique, niveaux et seuil réglable, tri (traitements décroissants, âge décroissant, n° croissant), 6 KPI, filtres, vue par intervention, exports Excel / PDF suivant les filtres, lecture seule, mobile (filtres rapides, ligne dépliable), bouton seulement si bio. |
| `test_pc_mouvements` | Page PC « Mouvements d'animaux » : saisie d'un mouvement collectif (catégorie avec effectif actif, aucun bip en série, types par catégorie inchangés, champs selon le type, tableau des animaux actifs triés âge décroissant puis n° croissant, filtre, Tout cocher sur le filtré, pastille et carte de délai viande non bloquantes, validation, confirmation récapitulative, écriture identique à l'écran mobile pour chaque catégorie, répertoires, routes) ; mouvements passés (tableau unique, colonnes, période par défaut, filtres catégories/type/acheteur/n°/période, pagination à 50, libellé de lot « Lot du JJ/MM · N · acheteur ou cause », Annuler / Annuler le lot toujours confirmés avec nombre restauré, lots système « Mise à jour inventaire », agnelles et animaux archivés sans bouton, lot partiellement archivé conservé, Modifier, export Excel) ; section 17 sur l'export réel (`OVILOG_EXPORT_CORRIGE`, lecture seule, saveData remplacé) : comptage indépendant du JSON, lots réels, vente puis annulation du lot = base identique à l'octet près. |
| `test_mouvements_mobile_reference` | HTML des écrans mobiles de « Mouvements d'animaux » (4 onglets, choix de catégorie, formulaire collectif, Gérer / annuler) comparé à `ref/mouvements_mobile.json`, pris AVANT la refonte PC (jeu synthétique). |
| `test_lots_journal` | Chantier de tri, partie a : journal d'affectations des lots de reproduction (collection `evenementsLots`, un événement groupé = `eids[]`, rejeu déterministe, retrait puis ré-ajout, horodatage croissant), migration des lots existants (événement initial à id déterministe, idempotente, `campagneMisesBas` déduite, recherche/réforme intacts), écart « appareil non à jour » détecté puis intégré/rejeté, règle Repro (attente S et S+1, échec S seulement, bascule de campagne), résultat IA par campagne (code inscrit sur la mise bas, en attente +171 j, deux échecs de suite), sorties avant mise bas exclues des taux, garde-fou « Mettre à jour l'application », lot vide, seuil dans Paramètres ; section 7 sur l'export réel (lecture seule). |
| `test_lots_concurrence` | Concurrence PC / mobile sur un même lot de reproduction avec le VRAI code de synchro (faux backend Firestore local, compte jetable) : retraits et ajouts croisés simultanés, conflit sur une même brebis, affectation groupée de 100 brebis = 1 document, appareil non à jour détecté, suppression d'un lot et de son journal. |
| `test_pc_lots` | Page PC « Chantier de tri » > Lots (parties b et c) : étape 1 (type, cible, mode, campagne des mises bas à venir par défaut, nom par défaut, lot créé VIDE, éponge pose + 16 j, recherche, réforme), étape 2 (4 onglets de critères avec filtres et colonnes, tri, sélection conservée, Tout cocher sur le filtré, filtres rapides qui ne cochent rien, Affecter avec confirmation = 1 événement groupé + modesRepro, Retirer avec confirmation et refus si mise bas rattachée), lot cible Agnelles, exports Excel, écarts de classe entre sources, redirections PC ; section réelle en lecture seule. |
| `test_bilan_mobile_reference` | HTML mobile du bilan comparé octet pour octet à `ref/bilan_mobile.html` (jeu synthétique, référence prise après la règle antenaise ; `OVILOG_MAJ_REF=1` pour la régénérer volontairement) |

## Ce que ces tests ne couvrent pas

- Le code natif Android (`FileSaverPlugin.java`, `ApkInstallerPlugin.java`) : seule la CI le compile ;
  son comportement (sélecteur système, FileProvider, partage) ne se vérifie que sur un appareil.
- Le vrai Firestore : le faux backend simule `writeBatch`, `arrayUnion`, `onSnapshot` par polling.
- Electron / Windows.
