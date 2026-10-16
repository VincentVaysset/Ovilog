# Ovilog — règles du projet

## Exports PDF
(Voir aussi la section « Charte graphique » ci-dessous : elle fait foi pour la forme de tous les PDF.)
Tout PDF généré par Ovilog doit être beau, coloré et jovial, avec une charte unique : bandeau vert Ovilog, tuiles et pastilles colorées, mêmes couleurs et même mise en page partout. Un export disponible sur PC et sur mobile produit exactement le même PDF des deux côtés. Pas de PDF en noir et blanc sobre. Références : maquettes "Export PDF" Qualité, Rapport de campagne, Déclaration annuelle. Il n'y a plus d'export PDF « Tank » : seul le Calendrier du tank existe (« Export PDF » vert et « Export Excel » blanc, sur PC comme sur mobile).

Décisions communes à tous les PDF :
- Pied de page unique : « Ovilog — [export] · [campagne] » à gauche, « Page X/Y » à droite (`pdfPied`) ; « Année » à la place de la campagne pour la Déclaration.
- Le nom de l'exploitation est lu par une seule fonction, `pdfExploitationNom` (repli « Ovilog » si vide) : aucun PDF ne le lit autrement.
- En-têtes de tableau jamais coupés : la police diminue avant toute coupure.
- Contrôle laitier (PDF et Excel, comme l'écran) : colonnes N° court, Date de mise bas, C1, C2, C3, dans cet ordre, sans colonne cumul (le champ `cumul` reste dans le modèle).

## Charte graphique
Référence unique pour tout nouvel écran et tout PDF. PC, mobile et PDF ont le même style. Interdiction de revenir à l'ancien style gris. Aucune couleur n'est écrite en dur hors des variables CSS (`--ch-*` dans le `:root`) et des constantes PDF (`PDF_CHARTE`, `PDF_COULEURS`) : on utilise la variable, on n'écrit pas la valeur. Chaque refonte la respecte, sans réinventer.

### Couleurs
- Fond de page : #fbf8f1 (crème). Cartes : blanc #ffffff, bord #e6ddc9, rayon 18 px (14 px sur PC).
- Texte : #2b261c. Texte secondaire : #5e5b47. Icônes/chevrons : #8a8670.
- Vert Ovilog (en-tête, bouton principal) : #357f4b. Vert foncé (texte, chiffres, 1re colonne) : #2f6e44. Vert pastel : #e3f3e6 (texte #24613a).
- Bleu : #1f5a8a, pastel #e6f0fa. Ambre : #b5701c, pastel #fbeed7 (texte des pastilles ambre #8a5413, variable `--ch-ambre-texte`). Rouge : #a33a31, pastel #fbe3e0.
- Fond segmenté/onglets : #efe9da. Ligne alternée de tableau : #f6f1e4. Séparateur : #efe9da. Bord de champ : #d9cfb8.

### Composants
- Police Roboto, chiffres tabulaires.
- En-tête d'écran : bandeau vert #357f4b, OVILOG centré, nom de l'éleveur à gauche, campagne à droite, titre de l'écran dessous.
- Onglets : pastille blanche sur fond #efe9da, arrondie.
- Tuiles d'effectifs (mobile) : fond pastel, liseré gauche épais coloré (5-6 px), libellé gris, grand chiffre coloré. Vert, bleu, ambre, rouge selon le sens.
- Tuile PC unique (`.tuile-pc`, même composant sur tous les écrans PC, Accueil compris) : liseré gauche 5 px, fond pastel, libellé gris 13 px en minuscules, chiffre 24 px gras. On n'invente pas de variante de tuile.
- Tons des tuiles, par sens : vert = bon ou neutre positif, bleu = information, ambre = à surveiller, rouge = SEULEMENT une alerte avérée (jamais pour un simple zéro), neutre (gris) pour un résultat vide ou « — ».
- Tableaux : en-tête vert #357f4b texte blanc gras, lignes alternées blanc / #f6f1e4, 1re colonne en vert foncé gras, coins arrondis.
- Boutons : principal = pastille verte pleine, texte blanc ; secondaire = pastille blanche à contour #d9cfb8. Hauteur 44-48 px.
- Pastilles d'état : arrondies, pastel + texte foncé (Entrée vert, Morte rouge, Vendue bleu).
- Focus : cadre vert charte partout (champs : bord vert + halo pastel ; boutons, liens, cases : contour vert 2 px). Jamais d'orange ni de cadre par défaut du navigateur.
- Un seul titre par écran PC : celui du bandeau vert. On ne le répète pas dans le contenu, ni en sous-titre d'une carte qui porte déjà ce titre.
- Libellés d'export identiques partout : « Export Excel » (bouton blanc) puis « Export PDF » (bouton vert).
- Pas de scan sur PC : aucun libellé « Scanner » ni « bip » (champs « Saisir un n° » / « Saisir un n° / EID », saisie clavier de l'EID) ; le scan reste sur mobile.
- Lecteur Bluetooth (mobile) : état jamais rouge (vert = connecté, ambre = reconnexion ou absent), pastille (36 px) présente sur TOUS les écrans mobiles à bandeau vert, en haut à droite sur la ligne du logo, symétrique du bouton menu (absente sur PC, sans plugin Bluetooth et sur Paramètres › Lecteur) : libellés courts « Lecteur » (vert), « Connecter » (ambre), « Choisir » (ambre), « Connexion… » / « Reconnexion… » (ambre) ; toucher sur « Connecter » = connexion immédiate sans quitter l'écran ; toucher sur la verte, sur « Choisir » ou appui long = écran Lecteur ouvert PAR-DESSUS l'écran courant (la saisie en cours n'est jamais perdue) ; la saisie manuelle reste toujours possible. Réglages du lecteur (reconnexion automatique, bip) propres à l'appareil, jamais synchronisés ; le bip coupe tous les bips et les quatre bips (trouvé, ambigu, introuvable, déjà trouvé) restent distincts. PC : une seule ligne « Lecteur : mobile uniquement » dans Paramètres.
- Saisies (mise bas, échos, mouvements…) : annuler une saisie se fait en UN geste, sans `confirm()` ; les contrôles sont discrets (aucun encart permanent, un message seulement quand une règle se déclenche : bloquer l'erreur certaine, alerter le doute). Sur mobile : tuiles de la charte (`.tuile-charte`), barre fixe « Annuler | Enregistrer et suivante ».
- Pas de "?" d'aide : l'information passe en une ligne sous le titre ou les filtres.
- Puces de choix mobiles (`.opt-btn`, une seule règle CSS, `body:not(.desktop-shell)`) : pilule de 44 px minimum, fond blanc, bordure #d9cfb8, texte #2b261c ; sélectionnée = fond vert pastel, bordure verte (`--ch-vert`), texte vert foncé, gras. Une seule couleur pour toutes les variantes (`.warn`, `.blue`, `.coral`, `.gray` ne changent plus rien : ambre, bleu et rouge supprimés, le rouge reste réservé aux alertes). Libellés, grilles et logique de sélection inchangés ; un libellé long peut passer sur 2 lignes (rien de coupé). Le PC garde ses puces (`.pc-seg2`, `.pc-onglets`) ; les fenêtres Qualité, Pénalité et Nouveau produit ouvertes sur PC aussi gardent l'ancien style (la règle est mobile seul). `.chip` et `.cl-pill` ne sont pas concernés.
- Production laitière et Bilan économique : « Export Excel » puis « Export PDF » en Qualité du lait (`exportQualiteXlsx`) ; exception à la règle des libellés d'export : en Qualité du lait PC les deux sont blancs, car le vert est réservé à l'action principale « + Nouveau prélèvement » ; sur mobile, Excel blanc et PDF vert ; « Export PDF » (plus de « Rapport de campagne (PDF) ») en Qualité du lait et en Bilan économique (vert sur PC, seule action principale de l'écran) ; « Non obtenu » (Super A) en gris, jamais rouge ; un seul titre sur PC (Qualité du lait et Bilan économique n'en répètent pas) ; un échec d'export s'affiche en message de charte (`afficherErreurExport`), jamais en `alert()`.
- Chantier de tri des agnelles (mobile et PC) : tuiles À trier (ambre), Gardées (vert, « dont X achetées »), Écartées (gris), une ligne « N triées sur M femelles nées actives », trois onglets segmentés À trier | Gardées | Écartées ; mobile en cartes `.carte-liste` (Garder plein vert et Écarter en contour, 48 px), PC en tableau charte à lignes de 48 px (N°, Naissance, Portée, Mère, Origine, État, Action, puis Classe mère et Lactation N-1). Garder, Écarter et Reconsidérer se font en UN geste, sans `confirm()`, avec un bandeau sombre « n°… gardée · Annuler » (`.tri-snack`, 6 s). Reconsidérer une gardée : « Annuler » remet la fiche EXACTE (soins, notes, mouvements ; `revenirSurTriAgnelle` / `restaurerAgnelleGardeeTri`, jamais une fiche recréée) et la confirmation ne reste que si la fiche porte des saisies (`ficheAgnelleASaisies`). Le scan (mobile) ou le n° tapé (PC, touche Entrée) SÉLECTIONNE l'agnelle sans jamais la valider ; plusieurs candidats = liste de choix. Origine de naissance = mode de reproduction renseigné sur la mise bas de la mère (`origineNaissanceAgnelle`, lue à l'affichage, jamais stockée), affichée par le seul code de 2 lettres IA, RE, EP, MN dans une petite pastille neutre (`.tri-origine`) ; libellé complet en `aria-label` seulement, jamais de légende, d'infobulle ni de pictogramme ; « — » si la mère est inconnue ou vendue, ou si la mise bas n'a pas de code. Rang de lactation seulement si le cahier SIEOL est importé ; la moyenne laitière estimée (`lactMoyen`) ne s'affiche pas. Export Excel (blanc) puis Export PDF (vert) suivent l'onglet affiché (PC).
- Mobile : liste en cartes (jamais de tableau coupé ni défilant), exports en bas. PC : même style, plus large. Une seule carte de liste, `.carte-liste` (`carteListeHtml`) : n° en vert foncé gras à gauche, pastille d'état à droite (pastel + texte foncé, rouge seulement pour une vraie alerte), infos secondaires en gris 13 px, pastilles complémentaires, chevron seulement si la carte s'ouvre, 56 px minimum. Seuls restent en tableau, sur mobile, les tableaux de chiffres compacts à largeur fixe sans défilement (Bilan de reproduction par âge, Production laitière et Bilan économique par mois, Déclaration).

### PDF
Logo OVILOG, titre, filet vert, tuiles à liseré (`pdfTuile`), tableau charte (`doc.tableauCharte`), pied de page "Page X/Y". Même PDF sur PC et mobile. Contenu officiel jamais modifié (Registre PAC), seule la forme change.

### Maquettes de référence
Canvas Ovilog (Production laitière, Bilan économique, Paramètres, Déclaration, Calendrier, exports PDF), maquettes Registre mobile et Inventaire PC.

### Écrans restant à migrer
Liste tenue dans `docs/ecrans_a_migrer.md`.

