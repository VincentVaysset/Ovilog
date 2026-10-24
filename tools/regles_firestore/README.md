# Contrôle des règles Firestore dans l'émulateur officiel

Vérifie `firestore.rules` (bulle de contact `feedback` / `admins`, et données d'élevage `users/<uid>` inchangées) avec le VRAI moteur de règles,
sans toucher au projet réel. Lancé à la main, hors batterie (il faut Java et l'émulateur Firebase) ; `firestore.rules` n'est jamais déployé depuis le dépôt.

```
cd tools/regles_firestore
npm init -y && npm i firebase-tools@13 @firebase/rules-unit-testing@3 firebase@10
npx firebase emulators:exec --project demo-ovilog --only firestore "node regles.test.mjs"
```

Résultat attendu : `TOUT OK : 34 contrôles`. Ne pas commiter `node_modules`, `package.json` ni les journaux créés par ces commandes.
