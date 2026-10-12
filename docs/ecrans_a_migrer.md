# Écrans à migrer vers la charte graphique

État de la migration vers la charte (section « Charte graphique » de `CLAUDE.md`), relevé par analyse du code de `www/index.html` et mesure du style réel des écrans PC avec des données synthétiques (`tests/test_tableaux_pc.mjs`, `tests/test_tri_pc_charte.mjs`, `tests/test_charte_graphique.mjs`). Les efforts sont des estimations : XS moins d'une heure, S une demi-journée, M environ un jour, L plusieurs jours. Les écrans mobiles n'ont pas tous été revus un par un à l'écran : leur effort est estimé d'après le code (tableaux, couleurs en dur, formulaires).

## 1. Déjà à la charte

- **Socle global** : onglets `.tab-bar` / `.fiche-tabs` / pistes de barres / badges neutres en `#efe9da`, texte secondaire `#5e5b47`, rouge unique `#a33a31`, variables sémantiques alignées sur `--ch-*`, vert d'en-tête et bouton principal `#357f4b`.
- **Gabarit PC commun** : champs, boutons, lignes de tableau, titres de section, titre unique dans le bandeau, pleine largeur (24 px), exports « Export Excel » / « Export PDF », menu sur une ligne (`test_gabarit_pc`) ; **Accueil PC** refait d'après la maquette (`test_accueil_pc`).
- **Tableaux PC** (un seul bloc CSS pour `.pc-t`, `.table-desktop`, `.brd-t`, `.rs-t`, plus `.inv-table` et `.ep-table`) : en-tête vert `#357f4b` à texte blanc gras, lignes alternées blanc / `#f6f1e4`, 1re colonne en vert foncé gras, coins arrondis, survol vert pastel. 34 tableaux sur 19 écrans PC vérifiés : Tri des agnelles, Lots, Chantier de tri (étape 2, lot de reproduction), Mouvements d'animaux et Mouvements passés, Carnet sanitaire, Produits et délais, Ordonnances, Sous délai d'attente, Contrôle laitier, Registre, Inventaire, Échographies, Mise bas rapide, Bilan de campagne, Paramètres › Imports.
- **Chantier de tri PC** : onglets (Lots / Tri des agnelles, onglets de critères) en pastille blanche sur fond `#efe9da` ; bandeau d'étapes en pastilles de la charte ; puces de filtre blanches à contour `#d9cfb8`, actives en vert pastel `#e3f3e6` à texte `#24613a` (variantes ambre, rouge, bleu, gris aux tons pastel) ; tableaux en en-tête vert.
- **Police** : Roboto en premier dans la pile (corps, boutons, champs), sur toute l'application ; Roboto est déjà la police native d'Android. Roboto est embarquée dans le fichier (sous-ensemble latin 400, 500, 700 en woff2, 86 Ko en base64), donc identique sur PC sans réseau.
- **Bulles d'aide « ? »** : les 31 bulles sont supprimées, leurs textes conservés dans `docs/manuel_aides_ecrans.md` ; 7 lignes d'information courtes (`infoLigneHtml`, classe `.info`, 13 px, `#5e5b47`) et un texte sous le champ « Type de suivi laitier » là où elles évitent une erreur ou une perte de données.
- **Écrans entièrement migrés** : Production laitière (Tank, Qualité, Bilan économique), Paramètres, Déclaration annuelle, Calendrier, Inventaire (PC, mobile, PDF), Registre d'élevage (PC, mobile, PDF), Contrôle laitier (mobile et PC), Bilan de campagne mobile (Brebis à régulariser, Bilan de reproduction), Mouvements d'animaux (mobile : liste et « Nouveau mouvement »), Accueil mobile « Mon troupeau », listes mobiles Brebis / Béliers / Agneaux (Agnelles : couleurs seulement), fiches Brebis / Béliers / Agnelles / Agneaux (PC et mobile), écran PC « Échographies » (consultation), tous les PDF (forme).

## 2. Reste à faire, classé par effort

### XS — couleurs en dur : terminé (hors PDF)
Toutes les couleurs hexadécimales hors `:root` et constantes PDF ont été remplacées par les variables `--ch-*` (voir `test_charte_graphique`, section 4). Les graphiques `pcBarres` utilisent `var(--ch-vert-pastel)` / `var(--ch-ambre)`, l'Accueil PC dessine son contrôle laitier en SVG.

**PDF : terminé.** `PDF_COULEURS` et `PDF_PL_COUL` dérivent de `PDF_CHARTE` ; le filet d'en-tête est en `#357f4b`, les titres de section en vert foncé `#2f6e44` (texte et chiffres, comme dans la charte). Le Bilan de lactation PDF a les deux histogrammes mensuels de la page PC.

### S
- Puces et boutons de choix `.opt-btn` des formulaires mobiles, avec le même composant que les puces PC.

### M — tableaux mobiles à passer en cartes (aujourd'hui des tableaux coupés)
- Historique des échographies, Ordonnances, Sous délai d'attente, Mise bas rapide, Mise à jour d'inventaire.
- Carnet sanitaire et Produits et délais (les tableaux `.pc-t` s'affichent aussi sur mobile).

### L — refontes d'écrans mobiles
- Chantier de tri mobile : lots, détail d'un lot de reproduction, tri des agnelles, liste en série.
- Saisies : agnelage, saisie rapide d'échos, mise bas rapide, mouvement individuel et collectif.
- Carnet sanitaire mobile complet (formulaires de soin, traitements collectifs, soins sans bio, traitements 12 mois, contrôle de lot).
- Journal.
- Écrans techniques à faible priorité : Première configuration, connexion, Bluetooth.

## 3. Prochains chantiers proposés
1. Tableaux mobiles en cartes (M), puis refontes mobiles (L), dans l'ordre choisi par le propriétaire du projet.

## 4. Roboto embarquée : terminé
Sous-ensemble latin (400, 500, 700) en woff2 du paquet `@fontsource/roboto` 5.3.0 (licence SIL Open Font License 1.1), 86 Ko en base64 (limite fixée : 150 Ko), `@font-face` dans `www/index.html` ; vérifié par `test_tri_pc_charte` (section 4). Les glyphes hors latin (par exemple `→`, `✓`) restent rendus par la police de repli du système.
