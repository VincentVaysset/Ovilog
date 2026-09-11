// Préchargement Electron -- expose UNIQUEMENT window.electronAPI (jamais
// window.Capacitor : verifierMiseAJourAuDemarrage() dans www/index.html se
// déclenche dès que window.Capacitor.Plugins.App existe, quelle que soit
// la plateforme, et proposerait alors le popup de mise à jour Android
// spécifique APK, absent ici -- voir le chantier "Support Desktop
// Windows" pour le détail de ce piège).
//
// Pour l'instant, window.electronAPI ne sert qu'à un usage : permettre à
// www/index.html de détecter le contexte desktop (`if (window.electronAPI)`)
// pour basculer certains écrans (accueil, fiche brebis...) sur une mise en
// page grand écran -- voir le chantier "Refonte écran d'accueil desktop".
// Rien d'autre n'est exposé tant qu'aucun besoin réel ne l'exige (pas de
// Bluetooth/RFID en Phase 1, pas de shim de mise à jour -- voir ci-dessus).
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
});
