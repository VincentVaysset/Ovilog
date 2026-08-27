# Guide de démarrage — De zéro à la première version de l'appli

Ce guide t'accompagne pas à pas, dans l'ordre, pour installer tout ce qu'il faut et lancer le développement avec Claude Code. Prends ton temps, une étape à la fois — pas besoin de tout faire le même jour.

---

## Étape 1 — Installer Android Studio

C'est l'outil qui transforme le code en vraie appli installable sur ton téléphone.

1. Va sur **developer.android.com/studio**
2. Télécharge la version pour Windows (ou Mac, selon ton ordinateur)
3. Installe-le en laissant les options par défaut (ça peut prendre 15-20 minutes et plusieurs Go d'espace disque)
4. Au premier lancement, laisse-le télécharger les composants qu'il propose ("Android SDK" etc.)

**Comment savoir que ça a marché** : Android Studio s'ouvre sur un écran d'accueil avec "New Project".

---

## Étape 2 — Installer Claude Code

1. Va sur **claude.com/claude-code** (ou cherche "Claude Code" dans la documentation Anthropic)
2. Suis les instructions d'installation pour ton système — il existe une version terminal et une version intégrée à l'app Claude Desktop
3. **Pour un débutant** : privilégie la version dans l'app **Claude Desktop** si elle est disponible — c'est plus visuel qu'un terminal pur

**Comment savoir que ça a marché** : tu arrives à ouvrir une session Claude Code et lui poser une première question.

---

## Étape 3 — Créer un compte Firebase (base de données cloud)

1. Va sur **firebase.google.com**
2. Connecte-toi avec un compte Google (ou crées-en un)
3. Clique sur "Créer un projet", donne-lui un nom (ex: "troupeau-app")
4. Laisse les options par défaut, termine la création

**Comment savoir que ça a marché** : tu arrives sur le tableau de bord de ton projet Firebase, vide pour l'instant — c'est normal, Claude Code le configurera avec toi.

*(Pas besoin de rien configurer de plus ici pour l'instant — Claude Code te guidera pour créer la base de données au bon endroit une fois le projet démarré.)*

---

## Étape 4 — Préparer le dossier du projet

1. Crée un nouveau dossier sur ton ordinateur, par exemple `troupeau-app`
2. Copie le fichier `cahier_des_charges.md` (celui que je t'ai donné) à l'intérieur
3. C'est ce dossier que tu ouvriras dans Claude Code pour démarrer

---

## Étape 5 — Premier lancement avec Claude Code

Ouvre Claude Code dans le dossier `troupeau-app`, et donne-lui un message d'ouverture du type :

> "Je veux créer une application Android (Kotlin) pour gérer un troupeau ovin. Voici le cahier des charges complet en pièce jointe. On va commencer petit : je veux d'abord juste un premier module fonctionnel avec la fiche brebis et la saisie d'échographie, avec une synchronisation Firebase. Guide-moi étape par étape, je suis débutant en développement."

Laisse Claude Code te poser des questions et avancer petit à petit — ne lui demande pas tout d'un coup.

---

## Ordre de développement conseillé (petit à petit)

1. **Squelette de l'appli** + connexion Firebase (juste pour vérifier que ça communique)
2. **Fiche brebis** — créer, consulter une brebis (avec le calcul d'âge depuis l'EID)
3. **Scan Bluetooth du LPR en mode HID** — vérifier que bipper une boucle remplit bien le bon champ
4. **Échographie** — formulaire + historique (celui qu'on a maquetté ensemble)
5. **Agnelage** — avec adoption, mort-né, inventaire agnelles séparé
6. **Carnet sanitaire** — avec produits modulables
7. **Mouvements**
8. **Contrôle laitier** (une fois que tu auras trouvé un exemple de fichier d'export)
9. **Tableau de bord**
10. **Version tablette** — une fois que tout marche bien sur téléphone

À chaque étape : teste en vrai sur ton téléphone (ou l'émulateur Android Studio) avant de passer à la suivante.

---

## Si tu bloques

Reviens me voir ici avec :
- Le message d'erreur exact (capture d'écran si besoin)
- Ce que tu essayais de faire

Je pourrai t'aider à comprendre le problème, même si le vrai travail de code se fait avec Claude Code.
