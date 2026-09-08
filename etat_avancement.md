# État d'avancement — Ovilog (document de passation)

*Dernière mise à jour : chantier "Module reproduction" (IA/Éponge/Retour IA/Monte naturelle) livré, remplace l'ancien écran Lutte — aucun test terrain réel effectué à ce jour, priorité avant clôture. Plusieurs correctifs annexes livrés le même jour (Registre agneaux, Séléphérol, renommage statut, litrage accueil). Multi-grilles qualité lait mis en pause. Ce fichier + cahier_des_charges.md doivent être donnés à Claude Code ET au prochain chat Claude pour une reprise à froid sans perte d'information.*

---

## 1. Cahier des charges & Architecture

**Application** : Ovilog — gestion de troupeau ovin laitier (race Lacaune), pour un éleveur en remplacement d'un ancien système Psion/Vénus (Unotec/Ovitest).

**Stack technique réelle** :
- Le cœur de l'appli a été écrit en HTML/CSS/JS pur (un seul fichier `index.html`, ~2600+ lignes à l'origine), stockage `localStorage`
- **Empaqueté en vraie appli Android native via Capacitor** (pas une PWA/webview ouverte, une vraie appli installée avec sa propre icône)
- **Build automatique via GitHub Actions** (le dépôt GitHub s'appelle **Ovilog**, compte GitHub `VincentVaysset`) — pas besoin d'Android Studio local, tout se compile dans le cloud
- **Signature stable (keystore) configurée** via secrets GitHub — les mises à jour s'installent par-dessus l'ancienne version sans perdre les données locales
- **Développement piloté via Claude Code sur le web** (claude.ai/code), connecté au dépôt GitHub — c'est LUI qui a la version la plus à jour du code réel, pas moi (l'assistant du chat classique)
- **Synchronisation cloud Firebase Firestore** récemment mise en place (voir section 2) — édition **Standard** (pas Enterprise), région europe-west9 (Paris), authentification par email/mot de passe (un seul compte, utilisé sur téléphone + tablette)
- **Scan matériel** : bâton Allflex LPR en Bluetooth Serial (SPP) — un callback global `onEidScanned(eid)` avec un système `activeScanTarget` gère toutes les cibles de scan à travers les écrans, en extrayant les 15 derniers chiffres de chaque trame SPP. **Confirmé fonctionnel en conditions réelles.**

**Logo** : créé et validé — fichier `ovilog_logo_1024.png` (brebis souriante, style bio/jovial, vert/orange/crème). Donné à Claude Code pour intégration comme icône de l'appli.

**Fichiers de référence à toujours donner en contexte** :
- `cahier_des_charges.md` (mis à jour, fichier séparé)
- Ce fichier `etat_avancement.md`

**Important** : je (l'assistant du chat) ne dois **plus jamais donner mon propre fichier `index.html` local à uploader sur GitHub** — il est obsolète par rapport à ce que Claude Code a construit directement dans le dépôt (ANMV, synchro Firebase, refonte navigation, etc.). Toute modification de code passe désormais **exclusivement par Claude Code**, sur instruction rédigée ici en chat classique.

---

## 2. Bilan des tâches

### ✅ Terminé et confirmé fonctionnel
- Fiche brebis (EID, âge calculé, numéro officiel = 5 derniers chiffres)
- Échographie avec 3 types (Constat / Stades / Stades + comptage), cas particuliers modulables, parasitisme
- Agnelage (adoption, mort-nés, Sélépérol 2cc automatique à la naissance transmis jusqu'à la future fiche brebis)
- Carnet sanitaire (Vaccin/Traitement/Autre, produits modulables) + traitement collectif
- Mouvements (Morte/Vendue/Vendue reproduction) + mouvement groupé (scan en continu)
- Agnelles : tri réversible (Garder/Écarter/Reconsidérer), généalogie (lien vers fiche mère), inventaire séparé des brebis
- Béliers : fiche, carnet sanitaire, mouvements dédiés
- Lutte (dates communes brebis/agnelles)
- Contrôle laitier (par n° de contrôle 1/2/3, moyennes séparées)
- Production laitière tank (quotidienne, totaux mois/année) — corrigé pour raisonner en campagne agricole (octobre–septembre) plutôt qu'année civile ; protection anti-doublon de date (ouvre la fiche existante en édition au lieu d'en créer une seconde)
- Journal (événements ponctuels, types modulables)
- Lots de recherche + bip différencié (trouvé/pas trouvé/déjà trouvé) en bergerie
- Import CSV inventaire + échographies (format `"EID";"COMMENT"`, testé avec un vrai fichier de 316 lignes, 100% de réussite)
- Profil exploitation (nom, n° cheptel, indicatif marquage, adresse, téléphone)
- Campagne : affichage (format "Campagne 2026" = année de fin) + changement de campagne (bascule agnelles→brebis, reset agnelages/mouvements des actives) ; `campagneDateDemarrage` stocke la date réelle de clic du bouton "changement de campagne"
- Sauvegarde/restauration JSON
- Intégration ANMV (délais d'attente lait/viande par produit)
- Refonte de navigation : menu hamburger, écran d'accueil = ancien tableau de bord avec cadres visuels, en-tête avec logo/nom exploitation/campagne
- Modules de saisie en série dédiés : Échographies, Mises-bas (renommés, distincts du mouvement groupé/traitement collectif)
- Registre d'élevage (conditionnalité PAC) : existe, structure revue plusieurs fois
- Synchronisation Firebase Firestore multi-appareils : opérationnelle
- **Chantier "Vide définitive" — CLOS** :
  - Statut "vide définitive" par campagne (réversible, avec règles de priorité dans la chaîne de statuts de reproduction)
  - Déclenché via case à cocher "Ceci est la dernière échographie de la campagne" dans le module de saisie en série Échographies, + bouton individuel de secours sur la fiche brebis
  - Formules corrigées : Troupeau à mettre bas = actives − vides définitives ; Mises bas restantes attendues = troupeau à mettre bas − mises bas réalisées
  - Écran "Bilan de campagne" restructuré en deux sous-onglets cliquables : "Incohérences fin de campagne" (Non suivies / Ont mis bas / Vides définitives + alerte séparée pour le cas contradictoire vide définitive+mise bas, jamais corrigé automatiquement) et "Bilan de reproduction" (taux de réussite global, tableau transposé prolificité/taux de mises bas par groupe Agnelles 1 an / Brebis 2 ans et plus, mises bas restantes attendues, nombre de vides définitives)
  - Les 4 statuts transitoires (Gestante, Vide confirmée, Avortée, Pseudogestation) ont été volontairement retirés du Bilan de campagne — ils restent visibles sur la fiche individuelle de chaque brebis et dans l'onglet Brebis
  - Population de référence pour "Bilan de reproduction" : "brebis présentes depuis le début de la campagne"
  - Validé avec de vrais chiffres

### 🔧 En cours / à reconfirmer
- **Module reproduction (remplace l'écran Lutte)** — commit 3488c1a, poussé, CI passé (104/104 régression) :
  - Lots IA / Éponge créés via 3e bouton "Chantier de tri" (scan/liste), écrivent modesRepro[] sur chaque animal
  - Fenêtre de gestation réglable (144–152j par défaut, Paramètres), utilisée pour déduire le code Repro à la saisie de mise bas
  - Retour IA (code 3) et Monte naturelle (code 7) toujours déduits, jamais saisis manuellement
  - Champ "Repro" (4 boutons IA/EP/RE/MN) sur l'écran Saisie mise bas, déduit automatiquement mais corrigeable manuellement par l'éleveur avant validation — c'est cette valeur corrigée qui alimente les stats
  - Badge discret (IA/EP/RE/MN) sur fiche brebis/agnelle, intégré aux cartes existantes
  - Bilan de reproduction étendu : vue par lot en temps réel, récap global par code, taux/prolificité par mode
  - Taux de réussite global du Bilan de reproduction recalculé (mises bas ÷ (mises bas + vides définitives), remplace l'ancien calcul basé écho) — fait rapidement, **à reprendre/affiner** une fois de vrais chiffres de campagne disponibles
  - **Bug connu et corrigé (en attente confirmation code) : décalage de campagne** — un lot créé avant le changement de campagne (ex: IA en juin pour mise bas en novembre) n'était pas retrouvé par deduireCodeRepro/codeReproActuel après la bascule, faute de tag "campagne à venir" explicite (même problème déjà résolu côté échographies). Fix : sélecteur "Campagne en cours / à venir" à la création du lot, repris sur le modèle campagneEchoOptionsHtml
  - **Édition des lots** : bouton "Modifier" sur tout lot (Chantier de tri) — nom/date/membres/campagne modifiables, mode/cible verrouillés après création ; ajout/retrait de membre synchronise modesRepro[], sauf si une mise bas y est déjà rattachée (blocage avec message plutôt que correction silencieuse)
  - **Fenêtre Éponge corrigée** : référence de calcul = date de pose + 16 jours (introduction des béliers), pas la date de pose elle-même
  - **AUCUN TEST TERRAIN RÉEL À CE JOUR** — priorité avant de déclarer ce chantier clos : créer un vrai lot IA et un vrai lot Éponge, saisir des mises bas dans/hors fenêtre, vérifier badges + récap + cas de correction manuelle du code Repro, et simuler explicitement une bascule de campagne (lot créé avant / mise bas saisie après clic "Démarrer une nouvelle campagne")

- **Registre d'élevage — agneaux/agnelles gardés dans l'onglet Sanitaire** : lambSanitaireRows() calqué sur lambMouvementsRows() (déjà en place côté Mouvements), inclut tous les animaux bouclés y compris les agnelles gardées (doublon assumé avec la catégorie "Agnelle", cohérent avec l'existant côté Mouvements) — codé, à reconfirmer

- **Correction Séléphérol** : faute de frappe corrigée ("Séléphérol" partout) ; injection automatique de 2cc à l'agnelage vérifiée/corrigée pour apparaître dans le Registre d'élevage comme un traitement standard — codé, à reconfirmer

- **Renommage statut "Non suivie" → "Aucune info repro"** : appliqué à la source (statutReproductionCampagne(), les 3 comparaisons dépendantes, fiche brebis, Bilan de campagne > Incohérences, tuile accueil) — codé, à reconfirmer

- **Litrage contrôle laitier accueil** : mL → L, 2 décimales sur les cadres moyenne/cumul de l'écran d'accueil — codé, à reconfirmer

- **Suppression carte "Lutte" de l'Agenda/Journal** — codé, à reconfirmer (donnée toujours utilisée côté reproduction, seule l'entrée agenda disparaît)

- **Audit complet de robustesse (PRIORITÉ avant campagne 2027, début octobre 2026)** :
  - Objectif : vérifier systématiquement, sur toute l'appli, que les principes déjà posés (confirmation avant suppression, réversibilité, pas de correction automatique) sont bien appliqués partout — pas seulement sur les chantiers récents
  - Déclenché suite à la découverte de trous de validation sur l'EID et la mère adoptive (voir chantier "Adoption et agnelage" ci-dessous)
  - Étape 1 (en cours) : rapport d'inspection par Claude Code — liste de toutes les actions destructrices/irréversibles et de tous les points de saisie critique, avec pour chacun l'état de validation existant et un niveau de risque (faible/moyen/critique). Aucun code à ce stade.
  - Étape 2 (à venir) : tri des résultats en chat classique, priorisation, puis lancement des corrections retenues
  - À boucler avant début octobre 2026 (mise en production réelle)
- **Adoption et agnelage — fiabilisation (prompt envoyé à Claude Code, en attente de confirmation)** :
  - Unicité de l'EID vérifiée sur toute la base (brebis, béliers, agnelles, agneaux actifs + registre), branchée sur 8 points de saisie identifiés (agnelage individuel, import CSV, entrée agnelle achetée, ajout brebis/bélier manuel, écho rapide et mise bas rapide en mode "créer inconnue") — blocage + message identifiant l'animal existant en cas de doublon, jamais de fusion automatique
  - Mère adoptive (`adoptiveEid`) transformée en sélection contrôlée : scan/recherche restreint aux brebis actives uniquement, blocage si aucune correspondance — tolérance sur les agnelages historiques déjà enregistrés en texte libre (revalidation seulement si le champ est modifié)
  - Correction du calcul "attendue à la traite" (`isAttendueTraite`) pour intégrer l'adoption : une brebis ayant donné un agneau en adoption n'est plus bloquée par lui ; une brebis adoptante est bloquée par l'agneau adopté jusqu'à sa vente/mort/renouvellement — sans jamais dupliquer le comptage dans les statistiques globales de natalité/prolificité (toujours basées sur `agnelages` brut, rattachées à la mère biologique)
  - Bug corrigé au passage : un appel de `isAttendueTraite` sans passage explicite du troupeau (`actives.filter(isAttendueTraite)`)
  - À reconfirmer avec de vrais cas de test avant de clore ce chantier
- Export Excel du registre d'élevage — demandé mais pas encore confirmé fonctionnel
- Correction : agnelle vendue/morte doit disparaître du tri "à trier" (bug identifié, corrigé par Claude Code, pas encore reconfirmé)
- Changement de comportement : scanner une agnelle dans "à trier" doit la sélectionner/mettre en évidence (pas la valider automatiquement "gardée") pour choisir ensuite Garder/Écarter
- Onglet "Brebis" du menu doit être un inventaire pur (sans les cadres de stats au-dessus, qui vivent maintenant sur l'écran d'accueil)
- Traçabilité complète des agneaux : clic Vendu/Mort doit demander date (+ acheteur si vente), apparaître dans Mouvements et le registre, être annulable
- Onglet "Agneaux" du menu hamburger : les agneaux bouclés doivent y apparaître comme un vrai inventaire à part entière
- Nettoyage UI : retirer les onglets Brebis/Béliers/Agneaux redondants au-dessus du bouton "Mouvement groupé" dans Inventaire (le choix se fait déjà à l'intérieur)
- Polish lecteur Allflex : indicateur visuel de connexion, reconnexion automatique, comportement au redémarrage de l'app — déprioritisé car le scan fonctionne de façon fiable

### 📋 À venir / en attente volontaire
- **"Bilan de lactation" (sous-onglet de Bilan de campagne)** : structure esquissée (deux blocs — contrôle laitier avec 3 contrôles/campagne, et cumul production tank) mais reporté tant que le fichier SIEOL réel n'est pas reçu
- **Module qualité du lait et tarification** : documenté au cahier des charges (section 11 — devenue section 11bis avec l'ajout PAC) comme fonctionnalité future ; nécessite que l'éleveur fournisse les vraies formules de la grille de paiement coopérative avant tout développement
- **Multi-grilles qualité lait** (généraliser au-delà de la grille Coulet, critères modulables incluant primes/bio) — spécifié, prompt rédigé mais volontairement mis en pause, pas utilisé actuellement
- **Audit complet "Changement de campagne"** : spécifié mais reporté à une session future
- **Bugs/fonctionnalités liés aux agnelles** : cf. section "En cours" ci-dessus
- **Refactor onglet Brebis** : inventaire pur, sans panneaux de stats
- **Registre PAC — Recensement annuel au 1er janvier (NOUVEAU CHANTIER, pas encore commencé)** :
  - Obligation légale réelle et distincte de la campagne agricole : raisonnée en année civile (1er janvier)
  - Doit permettre de sortir instantanément, pour un contrôle EDE/PAC :
    1. Effectifs de brebis et béliers présents au 1er janvier de l'année N (+ agnelles >6 mois si nécessaire, à confirmer)
    2. Nombre total d'agneaux nés sur l'année civile N-1
    3. Nombre d'agneaux vendus sur l'année civile N-1 (pour le ratio de productivité PAC, seuil ≈ 0,5 agneau vendu/brebis/an)
  - Contrainte technique : l'effectif "au 1er janvier" est une photo à une date passée, à reconstituer depuis l'historique des mouvements (dates d'entrée/sortie de chaque animal) — nécessite de vérifier que ces dates sont fiables à 100% depuis le début du projet
  - Piste retenue : calcul dynamique à la demande pour une date quelconque + snapshot automatique chaque 1er janvier une fois l'app en usage depuis un an complet, pour figer une valeur légale opposable
  - Écran envisagé : "Déclaration annuelle" avec sélecteur d'année civile, affichant les 3 chiffres + export PDF/Excel à joindre au registre d'élevage
  - Non prioritaire tant que Bilan de lactation et audit changement de campagne ne sont pas traités, mais chantier utile à ne pas oublier (risque de sanction en cas de contrôle)
  - Voir cahier_des_charges.md, section 11, pour le détail complet

---

## 3. Consignes d'intégration (pour la suite avec Claude Code)

- **Toujours passer par Claude Code pour toute modification de code** — le chat classique (moi) sert à cadrer/rédiger les instructions et vérifier la cohérence, jamais à donner un fichier `index.html` à uploader
- **Toute suppression dans l'appli doit demander confirmation**, sans exception (règle générale posée par l'utilisateur, à rappeler si un nouvel écran l'oublie)
- **Toute action réversible doit le rester** (annulable) — c'est un principe déjà appliqué partout (tri agnelles, mouvements, statuts d'agneaux, vide définitive) à respecter pour toute nouvelle fonctionnalité
- **Ne jamais corriger automatiquement une incohérence de données** (ex: vide définitive + mise bas simultanées) — toujours la faire remonter à l'éleveur pour qu'il tranche lui-même
- **Tri des listes d'animaux** : toujours par âge (plus vieux en premier), puis par numéro croissant à âge égal (ex: 90059, 90060, 90061, puis 02001, 02002 — pas un tri numérique global)
- **Demander à Claude Code de vraiment tester chaque correction avant de la déclarer faite** — plusieurs allers-retours ont eu lieu où un bouton "corrigé" ne l'était pas réellement (exports notamment)
- **Demander un plan avant tout chantier conséquent**, avant que Claude Code ne code quoi que ce soit — habitude prise tout au long du projet, à maintenir
- **Aucune fonctionnalité n'est déclarée terminée sans test réel et vérification avec de vrais chiffres**
- L'utilisateur utilise à la fois un téléphone et une tablette pour coder/tester — toujours garder à l'esprit la synchro Firebase quand on parle de test multi-appareils

---

## 4. Prompt d'amorce à copier-coller au début du prochain chat

```
Salut ! Je reprends un projet en cours : Ovilog, une appli de gestion de troupeau ovin laitier (race Lacaune), développée avec toi (Claude, chat classique) pour la conception/instructions, et Claude Code pour le vrai développement (dépôt GitHub "Ovilog", compte VincentVaysset, build automatique via GitHub Actions, appli Android native via Capacitor).

Je te donne deux fichiers en pièce jointe :
- cahier_des_charges.md : toute la logique métier, les décisions fonctionnelles prises au fil du projet, l'architecture technique
- etat_avancement.md : bilan précis de ce qui est terminé, en cours, et à venir, plus les consignes d'intégration à respecter

Lis les deux fichiers en entier avant de me répondre quoi que ce soit. Une fois fait, dis-moi juste que tu es prêt et rappelle-moi en 3-4 lignes où on en est et quelle est la prochaine action concrète à faire (voir section "En cours"/"À venir" de etat_avancement.md), sans redémarrer une conversation de zéro.

Important : je ne dois plus jamais te voir proposer de fichier index.html à uploader sur GitHub à la place de celui de Claude Code — toute modification de code passe exclusivement par des instructions que je transmets moi-même à Claude Code. Ton rôle est de m'aider à cadrer ces instructions, vérifier leur cohérence avec ce qui existe déjà, et m'aider à interpréter ce que Claude Code me répond (captures d'écran comprises).
```

---

**Fichiers à joindre au nouveau chat** : `cahier_des_charges.md` + ce fichier `etat_avancement.md`.
