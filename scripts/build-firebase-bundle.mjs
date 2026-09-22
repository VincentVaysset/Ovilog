#!/usr/bin/env node
/* Régénère www/vendor/firebase.bundle.js -- le SDK Firebase (app/auth/
   firestore) empaqueté localement en un seul fichier ES module, pour que
   l'appli fonctionne offline-safe sans dépendre d'un CDN (voir chantier
   "Empaqueter le SDK Firebase en local").

   N'exporte QUE les symboles réellement utilisés par www/index.html
   (script type="module" de synchronisation cloud) -- à mettre à jour ici
   en même temps que dans index.html si un nouvel appel Firebase est
   ajouté un jour, plutôt que de deviner ce qui manque a posteriori.

   Usage : node scripts/build-firebase-bundle.mjs
   Prérequis : `npm install` (firebase + esbuild sont en devDependencies). */
import { build } from 'esbuild';
import { writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const entryContent = `
export {
  initializeApp
} from 'firebase/app';
export {
  getAuth, setPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  onAuthStateChanged, signOut
} from 'firebase/auth';
export {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  collection, doc, setDoc, updateDoc, deleteDoc, getDoc, onSnapshot, arrayUnion
} from 'firebase/firestore';
`;

// Écrit l'entrée temporaire DANS le dépôt (pas dans /tmp) : esbuild résout
// les imports nus ("firebase/app") en remontant depuis le dossier du
// fichier d'entrée vers node_modules -- hors du dépôt, cette résolution
// échoue.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const entryPath = join(scriptDir, '.firebase-bundle-entry.tmp.js');
writeFileSync(entryPath, entryContent);

try {
  await build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    outfile: 'www/vendor/firebase.bundle.js',
    minify: true,
    logLevel: 'info'
  });
} finally {
  unlinkSync(entryPath);
}

console.log('OK : www/vendor/firebase.bundle.js régénéré.');
