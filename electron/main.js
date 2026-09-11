// Point d'entrée Electron pour Ovilog Bureau (Windows). Charge exactement
// le même www/index.html que l'app Android/Capacitor -- aucune copie, aucune
// transformation : voir "extraResources" dans package.json qui recopie le
// dossier www/ tel quel à côté de l'exécutable packagé. localStorage,
// Firebase Auth et la synchro Firestore (IndexedDB via persistentLocalCache)
// fonctionnent nativement dans le Chromium embarqué, sans code spécifique
// desktop -- voir le chantier "Support Desktop Windows" pour le détail.
//
// Phase 1 (actuelle) : pas de Bluetooth/RFID (window.Capacitor reste
// simplement absent, exactement comme dans un navigateur classique --
// tous les points d'accès aux plugins Capacitor dans www/index.html sont
// déjà défensifs et se dégradent proprement). Le Bluetooth Classic/SPP
// (lecteur RFID) est reporté à une Phase 2, après validation sur une
// machine Windows réelle avec le lecteur physique (voir le plan validé).
//
// Mise à jour : PAS le mécanisme in-app Android (ApkInstaller, spécifique
// APK/CORS) -- electron-updater, branché sur les mêmes GitHub Releases,
// gère le check+téléchargement+installation silencieuse du prochain
// installeur .exe (voir electron-builder "publish" dans package.json).
const { app, BrowserWindow } = require('electron');
const path = require('path');

// autoUpdater ne doit jamais tourner en dev (npm start) : hors app
// packagée, il n'y a ni feed de mise à jour valide ni exécutable à
// remplacer, et il lèverait une erreur de configuration sans intérêt.
let autoUpdater = null;
if (app.isPackaged) {
  ({ autoUpdater } = require('electron-updater'));
}

function cheminIndexHtml() {
  // Packagé : www/ est copié à côté de l'exécutable via extraResources
  // (process.resourcesPath). En dev (npm start depuis electron/) : www/
  // est le dossier frère du dossier electron/ à la racine du dépôt.
  return app.isPackaged
    ? path.join(process.resourcesPath, 'www', 'index.html')
    : path.join(__dirname, '..', 'www', 'index.html');
}

function creerFenetrePrincipale() {
  const fenetre = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      // Aucune API Node nécessaire côté page (app 100% web, comme sous
      // Capacitor) -- on garde les réglages de sécurité par défaut
      // d'Electron plutôt que de les affaiblir sans raison.
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  fenetre.loadFile(cheminIndexHtml());
  return fenetre;
}

app.whenReady().then(() => {
  creerFenetrePrincipale();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetrePrincipale();
  });

  if (autoUpdater) {
    // Vérification silencieuse au démarrage puis toutes les 4h -- comme
    // le check Android, jamais bloquant pour l'utilisateur : en cas de
    // mise à jour trouvée et téléchargée, electron-updater affiche sa
    // propre notification système et installe au prochain redémarrage
    // de l'appli (aucun code supplémentaire nécessaire ici).
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Silencieux par conception, comme verifierMiseAJourAuDemarrage()
      // côté Android : pas de réseau ou pas encore de release publiée ne
      // doit jamais gêner l'utilisation de l'appli.
    });
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 4 * 60 * 60 * 1000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
