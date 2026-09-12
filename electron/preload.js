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

// BUG CORRIGÉ (chantier précédent) : la version était lue ici via
// require(path.join(__dirname, 'package.json')) en supposant à tort que le
// préchargement s'exécute en contexte Node complet même avec
// contextIsolation. En réalité, Electron active le bac à sable (sandbox)
// par défaut sur tout BrowserWindow depuis la version 20 -- notre fenêtre
// ne désactive jamais ce sandbox (webPreferences n'a pas sandbox:false) --
// et un préchargement sandboxé n'a PAS d'accès garanti à require('path') ni
// à la lecture d'un fichier arbitraire. Ce require plantait donc
// silencieusement AVANT contextBridge.exposeInMainWorld ci-dessous, qui ne
// s'exécutait alors jamais : window.electronAPI restait indéfini dans
// toute l'appli, isDesktopMode() renvoyait false partout (mauvais format
// de version ET ancien écran d'accueil -- exactement le symptôme rapporté).
//
// Corrigé en transmettant la version depuis le process principal (qui, lui,
// n'est jamais sandboxé) via webPreferences.additionalArguments (voir
// creerFenetrePrincipale dans main.js) : process.argv est un global
// toujours fourni par Electron en préchargement, sandbox ou non --
// contrairement à require() d'un module/fichier arbitraire.
const PREFIXE_VERSION = '--ovilog-version=';
const argVersion = process.argv.find(a => a.startsWith(PREFIXE_VERSION));
const version = argVersion ? argVersion.slice(PREFIXE_VERSION.length) : null;

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  version,
});
