// Point d'entrée Electron pour Ovilog Bureau. Charge exactement le même
// www/index.html que l'app Android/Capacitor -- aucune copie, aucune
// transformation. localStorage, Firebase Auth et la synchro Firestore
// (IndexedDB via persistentLocalCache) fonctionnent nativement dans le
// Chromium embarqué, sans code spécifique desktop pour ces aspects-là.
//
// Fenêtre + preload : socle minimal d'un chantier précédent, inchangé ici
// (juste de quoi lancer la fenêtre et exposer window.electronAPI). Ce
// chantier-ci ("Support Desktop Windows", packaging) y ajoute uniquement
// le bloc electron-updater plus bas -- voir electron-builder ("build" dans
// package.json, cible NSIS) et le nouveau job CI build-windows pour la
// partie publication.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const log = require('electron-log');

// Fichier de log consultable (par défaut sous Windows :
// %APPDATA%/Ovilog/logs/main.log) -- tant que l'auto-update n'est pas
// stabilisé, mieux vaut un résultat inspectable qu'un .catch(() => {})
// qui avale tout silencieusement (c'est exactement ce qui a masqué le
// bug de nommage d'artefact NSIS découvert sur ce chantier : la
// vérification "réussissait" en apparence alors que le téléchargement de
// l'installeur échouait en 404 en coulisses).
log.transports.file.level = 'info';

// require() différé et gardé par app.isPackaged : hors app packagée (npm
// start), il n'existe ni feed de mise à jour valide ni exécutable NSIS à
// remplacer -- charger electron-updater dans ce contexte lèverait une
// erreur de configuration sans aucun intérêt en développement.
let autoUpdater = null;
if (app.isPackaged) {
  ({ autoUpdater } = require('electron-updater'));
}

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

  if (autoUpdater) {
    // Branché AVANT tout appel : electron-updater journalise lui-même
    // chaque étape de son cycle de vie (recherche, version trouvée, URL de
    // téléchargement, erreurs...) dès que ce logger est renseigné (sinon il
    // se contente d'un `console` par défaut, invisible dans une appli
    // packagée sans terminal).
    autoUpdater.logger = log;

    // Toutes les Releases publiées jusqu'ici sont marquées "prerelease" sur
    // GitHub (voir build-apk.yml : prerelease tant que la branche n'est pas
    // main) -- electron-updater les ignore par défaut (allowPrerelease vaut
    // false tant que app.getVersion() n'a pas elle-même un suffixe du genre
    // "-beta", ce qui n'est pas notre cas). Sans ce réglage, la vérification
    // ne trouve donc jamais rien à installer, silencieusement. À revoir une
    // fois la branche mergée sur main (Releases non-prerelease).
    autoUpdater.allowPrerelease = true;

    // Vérification silencieuse une seule fois, ici, au démarrage -- comme
    // verifierMiseAJourAuDemarrage() côté Android (voir www/index.html) :
    // jamais d'erreur visible pour un simple défaut réseau ou l'absence de
    // release plus récente. En cas de mise à jour trouvée, electron-updater
    // la télécharge en tâche de fond, affiche sa propre notification
    // système, puis l'installe par-dessus l'existant au prochain
    // redémarrage de l'appli -- aucun code d'interface supplémentaire
    // nécessaire ici (contrairement à Android, où le téléchargement doit
    // passer par un plugin natif pour contourner l'absence d'en-têtes CORS
    // sur les assets de release -- ce problème ne se pose pas ici, tout se
    // passe côté process principal Node, jamais dans un contexte navigateur).
    //
    // Pas de re-vérification périodique (l'ancien setInterval toutes les
    // 4h a été retiré, sur demande explicite) : la détection doit se faire
    // au redémarrage de l'appli, pas au bout d'un délai arbitraire pendant
    // qu'elle tourne déjà.
    autoUpdater.checkForUpdatesAndNotify()
      .then(result => {
        // result vaut null quand la vérification tourne déjà (jamais le
        // cas ici, un seul appel par démarrage) -- sinon, contient la
        // version trouvée même si elle n'est pas plus récente.
        if (result && result.updateInfo) {
          log.info(`Vérification de mise à jour terminée -- version distante : ${result.updateInfo.version}`);
        } else {
          log.info('Vérification de mise à jour terminée -- aucun résultat exploitable');
        }
      })
      .catch(err => {
        // Jamais d'erreur visible pour l'utilisateur ici (simple défaut
        // réseau, absence de release plus récente...) -- mais désormais
        // tracée dans le fichier de log plutôt qu'avalée en silence.
        log.error(`Échec de la vérification de mise à jour : ${err && err.stack || err}`);
      });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
