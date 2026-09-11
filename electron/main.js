// Point d'entrée Electron pour Ovilog Bureau. Charge exactement le même
// www/index.html que l'app Android/Capacitor -- aucune copie, aucune
// transformation. localStorage, Firebase Auth et la synchro Firestore
// (IndexedDB via persistentLocalCache) fonctionnent nativement dans le
// Chromium embarqué, sans code spécifique desktop pour ces aspects-là.
//
// Socle MINIMAL pour l'instant (voir chantier "Refonte écran d'accueil
// desktop") : juste de quoi lancer la fenêtre et exposer window.electronAPI
// (via preload.js) pour que les écrans puissent détecter le contexte
// desktop et basculer sur une mise en page grand écran. Pas encore de
// packaging (electron-builder), pas de job CI Windows, pas de mécanisme
// de mise à jour (electron-updater) -- ces sujets reviendront dans un
// chantier ultérieur, à la demande explicite de l'utilisateur.
const { app, BrowserWindow } = require('electron');
const path = require('path');

function cheminIndexHtml() {
  // Packagé plus tard : www/ sera copié à côté de l'exécutable (voir
  // futur chantier packaging). En dev (npm start depuis electron/) : www/
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
