# Écrans à migrer vers la charte graphique

Relevé en lecture seule (aucun écran modifié) des endroits qui utilisent encore l'ancien style gris, un tableau « tableur » de l'ancien gabarit, une bulle d'aide « ? » ou des couleurs écrites en dur hors de la charte (voir la section « Charte graphique » de `CLAUDE.md`). Méthode : analyse de chaque fonction de rendu de `www/index.html` (couleurs `#rrggbb` absentes de la charte, gabarits `REGISTRE_TH/TD` et `table-desktop`, `infoBulleHtml`, fonds gris `#f0efe9`, `#f7f5ee`, `#f6f3ea`, `--gray-bg`).

Les écrans déjà conformes (non listés) : Production laitière (Tank, Qualité, Bilan économique), Paramètres, Déclaration annuelle, Calendrier, Inventaire (PC, mobile, PDF), Registre d'élevage (PC, mobile, PDF), Contrôle laitier (mobile), Bilan de campagne mobile (Brebis à régulariser, Bilan de reproduction), Mouvements d'animaux (mobile : liste et « Nouveau mouvement ») et tous les PDF.

## 1. Styles globaux (CSS)
Socle aligné sur la charte (chantier « listes Brebis / Béliers / Agneaux / Agnelles ») : fond des onglets (`.tab-bar`, `.fiche-tabs`, pistes de barres, `.badge-muted`, `.pc-pill.neutral`) en `#efe9da` ; lignes alternées / survol en `#f6f1e4` ; `--gray-bg` / `--gray-fg`, `--text-muted` (`#5e5b47`), `--danger` et `--coral-*` (rouge unique `#a33a31`), `--green-*`, `--amber-*`, `--blue-*`, `--indigo-*` (= bleu charte) pointent vers les variables `--ch-*`. Plus aucun ancien gris (`#f0efe9`, `#f0eee6`, `#f7f5ee`, `#f6f3ea`, `#eceae3`) dans le code (vérifié par `test_charte_graphique`).
Reste à faire : `.table-desktop` (en-tête gris-beige `#efe9da` au lieu du vert `#357f4b` avec texte blanc) pour Mouvements passés, Mise bas rapide, Ordonnances, Sous délai d'attente, tableaux des fiches.

## 2. Écrans avec couleurs écrites en dur hors charte
| Écran (fonction) | Couleurs hors charte | Remarque |
|---|---|---|
| Accueil PC (`accueilDesktopHtml`), tuiles du tableau de bord (`dashboardKpiHtml`) | `#c7dcea`, `#eee` | |
| Bilan de lactation PC (`bilanLactationDesktopHtml`) | `#cfe3d5` | |
| Bilan économique PC, ancienne version (`bilanEconomiqueDesktopHtml`) | `#a9cdb8`, `#f0efe9` | remplacé par la page Production laitière |
| Barres des pages PC (`pcBarres`) | `#cfe3d5`, `#eb6834` | |
| Brebis à régulariser PC (`bilanARegulariserDesktopHtml`) | `#6c8ebf`, `#e8b38f`, `#eb6834` | |
| Contrôle laitier (`renderControleLaitier`), carte « sans contrôle » (`carteSansControleLaitierHtml`) | `#a9cdb8`, `#eb6834`, `#e8c88a`, `#f4f4f4`, `#fbe3df` | |
| Tank (carte de tableau de bord, `plTankHtml`) | `#b9d4ea` | |
| Ajout d'échographie (`renderAddEcho`) | `#add` | |

## 3. Écrans avec tableau de l'ancien gabarit (à passer en cartes sur mobile, tableau charte sur PC)
`REGISTRE_TH` / `REGISTRE_TD` et `table-desktop` : Historique des échographies (8 usages), Ordonnances, Sous délai d'attente, Mise bas rapide (PC), Mouvements passés / traitements collectifs (historiques), tableau du carnet sanitaire.

## 4. Bulles d'aide « ? » (`infoBulleHtml`) à remplacer par une ligne d'information
Ajout d'agnelage, Échographie rapide, Historique des échos, Mise bas rapide, Liste en série, Agnelles, Lot de recherche, Lot de réforme, critères d'échographies mobile, Mises à jour d'inventaire (bipage), Contrôle de lot (délai), Gérer les produits, Ordonnances, Sous délai d'attente, Mouvements collectifs (historique, 2), Traitements collectifs (historique, 2), Première configuration, Changer de lecteur, Diagnostic Bluetooth (2), Bilan de lactation mobile, Import contrôle laitier SIEOL (4), Import correspondance SIEOL, Import nouveaux animaux, Import lactation modèle, Import contrôle laitier modèle, Import bilan lactation, options de campagne des échographies.

## 5. En-tête et PDF
- Le vert de l'en-tête et du bouton principal (`--primary`) est aligné sur la charte (`#357f4b`) ; l'ancienne valeur était `#3c8a55`.
- Dans les PDF, le filet vert et les titres de section (`PDF_COULEURS.vert`, `PDF_PL_COUL.vertTitre`) gardent l'ancienne teinte `#3c8a55` / `#2f6e44` : à aligner avec la prochaine passe PDF (les en-têtes de tableau et les tuiles utilisent déjà la charte via `PDF_CHARTE`).
- Les anciennes variables sémantiques (`--text`, `--text-muted`, `--green-bg`, `--coral-fg`…) sont alignées sur les variables `--ch-*` (voir section 1).
- Listes mobiles migrées : Brebis, Béliers (lignes compactes dans une carte), Agneaux (segmenté + cartes) ; Agnelles : couleurs et styles de la charte seulement (cartes inchangées) ; fiches Brebis / Béliers / Agnelles / Agneaux (PC et mobile) à la charte, structure inchangée ; en-têtes verts des tableaux Brebis / Béliers PC et de l'en-tête « campagne » de Carrière.
