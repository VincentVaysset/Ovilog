# Ovilog — directives de développement

Application de gestion de troupeau ovin (Lacaune, lait), Android (téléphone + tablette), avec synchronisation cloud et mode hors-ligne.

## Contexte du projet

- `cahier_des_charges-1.md` : spécifications fonctionnelles détaillées (source de vérité pour le métier).
- `guide_demarrage.md` : guide d'installation pas à pas pour l'éleveur (non-développeur).
- `index-7.html` : maquette visuelle de référence (charte graphique, écrans).
- Utilisateur final : éleveur, débutant en développement — avancer étape par étape, pas tout d'un coup.

## Stack cible

- Android natif (Kotlin), interface pensée téléphone d'abord, tablette ensuite.
- Base de données cloud avec mode hors-ligne (Firebase ou Supabase), synchronisation automatique multi-appareils.
- Lecteur EID Allflex en mode clavier (HID) — le scan insère le numéro dans le champ actif, pas d'intégration Bluetooth complexe à prévoir.
- Export Excel natif en plus de la synchro cloud.

## Règles métier essentielles

- Campagne agricole : 1er octobre → 30 septembre (toutes les stats se basent sur la campagne, pas l'année civile).
- Numéro officiel brebis = 5 derniers chiffres de l'EID.
- Échographie, sanitaire, mouvements : toujours un **historique daté** (jamais un champ unique écrasé).
- Agnelles = inventaire séparé des brebis jusqu'au 1er octobre suivant.
- Listes modulables (produits sanitaires, causes de mortalité, observations d'échographie) : l'éleveur doit pouvoir en ajouter depuis l'appli, jamais figées en dur dans le code.
- Réforme (section 8) et TB/TP contrôle laitier : hors périmètre V1, ne pas implémenter.

## Directives de développement

- Avancer par petits modules fonctionnels testables (cf. ordre conseillé dans `guide_demarrage.md`), pas de gros bloc d'un coup.
- Après chaque module, il doit être testable réellement sur téléphone/émulateur avant de passer au suivant.
- Respecter la charte graphique et les libellés (français) de `index-7.html` pour toute UI.
- Concevoir le modèle de données en pensant au mode hors-ligne et à la synchro (pas de logique qui suppose une connexion permanente).
- Pas d'abstraction ni de champ superflu anticipant des fonctionnalités reportées (réforme, TB/TP, posologie ANMV) — rester au périmètre V1 décrit dans le cahier des charges.
