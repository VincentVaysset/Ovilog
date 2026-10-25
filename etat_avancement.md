# État d'avancement — Ovilog (document de passation)

*Mis à jour le 23/10/2026. Ce fichier sert de mémoire d'une session à l'autre : où en est le projet, ce qui attend une décision, comment on travaille. Les règles détaillées de l'appli sont dans `CLAUDE.md` (relu à chaque session) ; le rôle de chaque test dans `tests/README.md` ; les écrans restant à migrer vers la charte dans `docs/ecrans_a_migrer.md`. Le dépôt est PUBLIC : n'y écrire aucune adresse e-mail, aucun mot de passe ni aucune donnée d'élevage réelle.*

---

## 1. L'application

- **Ovilog** : gestion de troupeau ovin laitier (Lacaune), remplace l'ancien Psion/Vénus (Unotec/Ovitest).
- **Code** : un seul fichier `www/index.html` (HTML/CSS/JS), empaqueté en appli Android (Capacitor) et en appli Windows (Electron). Même code, même rendu ; le PC est la même appli en plus large (`isDesktopMode()`).
- **Données** : base locale sur chaque appareil + synchro cloud Firebase Firestore (projet `ovilog-15ef6`, édition Standard, région europe-west9 Paris), connexion par e-mail / mot de passe. Chaque compte n'écrit que dans `users/<son uid>/…`.
- **Lecteur** : bâton Allflex LPR en Bluetooth (mobile seulement) ; sur PC on tape le n° ou l'EID.
- **Logisol** : autre appli du propriétaire qui partage le même projet Firebase (collections dédiées). Son code n'est JAMAIS modifié depuis ce dépôt.
- **Build et versions** : GitHub Actions (`.github/workflows/build-apk.yml`), dépôt `VincentVaysset/Ovilog`. Un push sur `main` crée une release (APK + installeur Windows) en pré-version ; elle n'est proposée aux appareils qu'une fois promue à la main (GitHub › Releases). Une branche ou un lancement manuel ne produit qu'un artefact. Le n° de run = n° de version (v267 = 1.0.267). Clé de signature et mots de passe : secrets GitHub, jamais dans le code.
- **Tests** : `tests/run_all.sh` (batterie complète, passe de fuseaux UTC / Europe/Paris), faux serveur Firebase local pour la synchro ; exports réels de l'élevage seulement dans `tests/data/` (ignoré par git).

## 2. Comptes et utilisateurs

- **Deux éleveurs depuis le 23/10/2026** : le propriétaire (compte d'origine, téléphone + tablette + PC) et un ami éleveur (compte préparé par le propriétaire, inventaire de brebis déjà chargé, béliers à ajouter par lui ; il a choisi son propre mot de passe par « Mot de passe oublié ? »).
- On lui a envoyé : un mémo d'installation (1 page, QR code vers `…/releases/latest/download/app-release.apk`), un guide rapide de 4 pages (repris du « Manuel v1 » de 17 pages, corrigé d'après l'audit) et le modèle Excel « Nouveaux animaux ». Ces PDF ont été générés hors dépôt : à refaire si l'interface change beaucoup.
- Les e-mails Firebase (vérification, mot de passe) partent de `noreply@ovilog-15ef6.firebaseapp.com` et arrivent souvent dans les spams.
- **Sécurité, état au 23/10** : règles Firestore actives vérifiées par le propriétaire (`request.auth.uid == uid`) ; protection contre l'énumération des e-mails activée ; stockage largement suffisant pour deux élevages. Pas de double authentification : décision de ne pas la faire (offre payante + SMS + écrans reCAPTCHA) ; conseil donné : validation en deux étapes sur les comptes Gmail, mot de passe propre à Ovilog, « Exporter mes données » régulier.

## 3. Où on en est (23/10/2026)

- **`main` = v267, promue** (« latest ») : c'est la version installée par l'ami et par le propriétaire. Elle contient la vérification de l'adresse e-mail, la fin du Séléphérol automatique et les correctifs de saisie (chiffre d'année par campagne, synchro sans effacer le formulaire, focus PC).
- **Branche `claude/sheep-herd-android-app-7tlcq1`, en avance sur main, NON fusionnée (volontaire, l'ami reste sur la v267)** : Chantier de tri PC — cocher une brebis ne fait plus remonter la liste ; n° tapé + Entrée coche la brebis (test `test_lots_pc_selection`). À fusionner quand le propriétaire le demandera.
- **Bulle de contact (branche, non fusionnée)** : bouton vert pour écrire au concepteur (Bug / Question / Idée), « Messages reçus » dans Paramètres pour l'administrateur. AVANT toute fusion dans `main`, le propriétaire publie les nouvelles règles (`feedback`, `admins`) dans la console et crée le document `admins/<son uid>` ; sans cela les messages restent « Non envoyé ». Puis test réel sur les deux comptes.
- **Canal de test (branche, non fusionné)** : chaque push sur la branche de travail publie une pre-release « [test] » (les 3 dernières gardées) ; le propriétaire la reçoit dans l'appli en activant « Recevoir les versions de test » (Paramètres › Sauvegarde, sur chaque appareil voulu, compte administrateur seulement). L'ami ne voit jamais que les versions promues. Le premier APK contenant ce réglage s'installe à la main (page du build ou version promue).
- **Mise bas en lot IA / éponge (branche, non fusionné)** : hors des fenêtres réglées, le code Repro est demandé à la saisie (IA ou MN avant, IA / RE / MN entre les fenêtres, RE après) ; les bilans des lots suivent le code fixé à la saisie.
- **Intégration continue (branche, non fusionné)** : la batterie tourne sur GitHub à chaque push et bloque toute construction / Release si un test échoue ; Dependabot mensuel. Réglé par le propriétaire : protection de `main` (pull request, check « tests / Tests OK », ni force push ni suppression), alertes Dependabot. À la PREMIÈRE pull request : remplacer dans la règle « tests / Tests OK » par « Tests OK » (nom du check lancé par la pull request elle-même, seul présent sur les pull requests de Dependabot).
- **Taille du document meta (étape 3 A, branche, non fusionné)** : mesure (Paramètres › Sauvegarde, administrateur), message ambre à 70 % et rouge à 90 % pour tous, refus de Firestore signalé à l'écran. En attente : les chiffres réels du propriétaire, avant de décider B (retrait de la copie du registre, quand tous les appareils seront à jour ; l'ami reste en v267 pendant les mises bas) et C (sortie d'autres rubriques).
- **Audit « Ovilog pro » (24/10/2026)** : étape 1 faite (règles nettoyées, adresse vérifiée exigée ; Spark conservé, donc pas de sauvegarde Google ; App Check à étudier) ; étape 2 faite (intégration continue) ; étape 3 A faite (mesure du document meta), B et C en attente des chiffres réels ; ensuite : séparation Logisol, échappement des textes, rapports d'erreurs, découpage en modules, RGPD.
- **À faire par le propriétaire** : publier `firestore.rules` (exigence `email_verified`) dans la console Firebase QUAND l'ami aura vérifié son adresse (le propriétaire a vérifié la sienne). Pas avant : un compte non vérifié ne pourrait plus rien enregistrer.
- **Séléphérol** : plus aucun soin d'office à la naissance, pour aucun compte. Le propriétaire doit recréer « Séléphérol » comme produit (Paramètres › Listes › Produits sanitaires + délais dans Carnet sanitaire › Produits et délais) et le saisir en soin collectif sur les agneaux. Ses anciens soins sont gardés.

## 4. En attente d'une décision du propriétaire

- **Début de campagne réglable : FAIT sur la branche (non fusionné)** — les mois de la production laitière suivent le début réglé (`moisCampagne`, test `test_campagne_debut_mois`). L'ami trait de décembre à fin juillet : non concerné en pratique.
- **Anonymisation (fait sur la branche)** : tests et documentation n'ont plus que des indicatifs, noms, adresses et numéros fictifs ; `index-7.html` (ancienne copie) supprimé. Restent identifiants, à traiter PLUS TARD et seulement sur demande : le nom du compte GitHub `VincentVaysset` (lien de téléchargement donné à l'ami : renommer seulement avec une version de transition qui pointe vers le nouveau nom, cf. `UPDATE_REPO_OWNER`, publish d'Electron, `test_canal_stable`) et l'adresse e-mail d'auteur dans l'historique des commits (réglage GitHub › Settings › Emails à faire par le propriétaire ; réécriture de l'historique non faite).
- **Test terrain du module reproduction** jamais fait en conditions réelles : vrai lot IA et vrai lot Éponge, mises bas dans / hors fenêtre, correction manuelle du code Repro, lot créé avant une bascule de campagne et mise bas saisie après.

## 5. Ce qui existe (résumé ; détail des règles dans `CLAUDE.md`)

- Troupeau : brebis, béliers, agnelles, agneaux (listes en cartes sur mobile, tableaux charte sur PC), fiches en onglets (Ident., Repro & Écho, Sanitaire, Contrôles, Mouv., Carrière, Index, Notes), Inventaire (bipage complet), recherche par n° court / SIEOL / EID.
- Reproduction : lots IA / Éponge (créés sur PC, ajustés sur mobile), codes IA / EP / RE / MN déduits et modifiables, échographies (saisie mobile, consultation et exports PC), vide définitive, mises bas (saisie rapide mobile et PC, n° d'agneau tapé court, mort-né, adoption), chantier de tri (lots de recherche / réforme / reproduction, tri des agnelles).
- Santé : carnet sanitaire (produits et délais saisis par l'éleveur, soins individuels et collectifs, ordonnances, sous délai d'attente, élevage bio, traitements sur 12 mois), mouvements d'animaux (Morte, Vente, Vente reproduction, Perte, Autoconsommation ; collectifs ; annulables).
- Lait : contrôle laitier (imports SIEOL sur PC), production laitière (tank, qualité), bilan économique (réglage de compte, désactivé et non proposé sur un compte neuf).
- Bilans et obligations : bilan de campagne (à régulariser, reproduction, lactation), registre d'élevage, déclaration annuelle PAC (année civile), calendrier.
- Réglages : Paramètres (Exploitation, Campagne, Listes, Imports sur PC, Sauvegarde ; Lecteur sur mobile), première configuration en assistant, changement de campagne avec sauvegarde automatique, comptes séparés par appareil (« Se déconnecter » sauvegarde puis vide la base locale), vérification de l'adresse e-mail.
- Charte graphique unique PC / mobile / PDF (voir `CLAUDE.md`), tous les PDF à la charte colorée.
- Hors appli : `docs/manuel_aides_ecrans.md` (textes d'aide retirés des écrans, base d'un futur manuel).

## 6. Pistes pour plus tard

- Multi-grilles de paiement du lait (au-delà de la grille actuelle) : spécifié, en pause.
- Audit complet du changement de campagne : partiellement couvert par les tests, à reprendre si un problème apparaît en vraie bascule.
- Écrans restant à migrer vers la charte : `docs/ecrans_a_migrer.md`.

## 7. Méthode de travail (consignes du propriétaire)

Reprises aussi dans `CLAUDE.md`, section « Méthode de travail ».
- Un plan d'abord, validé, avant tout code ; inspection ou audit = rapport sans code.
- Un commit par cause ; batterie complète en UTC puis Europe/Paris ; une seule push sur la branche ; workflow_dispatch en plus ; donner les deux n° de run.
- Captures avant / après des écrans modifiés, envoyées, puis `docs/captures/` supprimé (jamais commité).
- Jamais de fusion dans `main` sans demande explicite ; jamais de push avant une batterie verte (les rappels automatiques de push ne valent pas autorisation).
- Ne jamais modifier un EID ni un numéro existant ; ne pas toucher au code de Logisol ; `firestore.rules` n'est jamais déployé depuis le dépôt (le propriétaire le publie dans la console).
- En cas de doute : ne rien changer et le signaler.
- Réponses en français, concrètes ; l'éleveur n'est pas développeur.
