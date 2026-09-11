// Préchargement Electron -- expose UNIQUEMENT window.electronAPI (jamais
// window.Capacitor : verifierMiseAJourAuDemarrage() dans www/index.html se
// déclenche dès que window.Capacitor.Plugins.App existe, quelle que soit
// la plateforme, et proposerait alors le popup de mise à jour Android
// spécifique APK, absent ici -- voir le chantier "Support Desktop
// Windows" pour le détail de ce piège).
//
// window.electronAPI sert à deux usages : permettre à www/index.html de
// détecter le contexte desktop (`if (window.electronAPI)`) pour basculer
// certains écrans (accueil, fiche brebis...) sur une mise en page grand
// écran (voir le chantier "Refonte écran d'accueil desktop"), et afficher
// un vrai numéro de version (voir "version" ci-dessous). Rien d'autre
// n'est exposé tant qu'aucun besoin réel ne l'exige (pas de Bluetooth/RFID
// en Phase 1).
const { contextBridge } = require('electron');
const path = require('path');

// Lu directement dans package.json (préchargement = contexte Node complet,
// même avec contextIsolation) plutôt que par IPC vers le process principal :
// c'est exactement le même fichier que celui packagé par electron-builder
// ("files" dans package.json), donc la même version que app.getVersion()
// et que l'installeur NSIS -- jamais le sentinelle BUILD_VERSION (date +
// hash de commit) utilisé côté Android, qui n'a pas de sens ici.
const { version } = require(path.join(__dirname, 'package.json'));

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  version,
});
