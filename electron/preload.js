// Préchargement Electron -- volontairement vide pour la Phase 1 (aucune
// API native desktop nécessaire : pas de Bluetooth/RFID, pas de shim
// Capacitor). Ne PAS exposer ici un window.Capacitor.Plugins.App simulé :
// verifierMiseAJourAuDemarrage() dans www/index.html se déclenche dès que
// window.Capacitor.Plugins.App existe, quelle que soit la plateforme, et
// proposerait alors le popup de mise à jour Android (téléchargement d'APK
// via ApkInstaller, absent ici) -- laisser window.Capacitor entièrement
// indéfini fait retomber l'appli sur son propre repli déjà existant et
// déjà testé ("Mise à jour disponible uniquement sur l'application
// installée."), exactement comme dans un navigateur classique. La mise à
// jour desktop passe par electron-updater, entièrement côté process
// principal (voir main.js) -- aucun pont nécessaire avec la page.
//
// Point d'extension pour la Phase 2 (Bluetooth/RFID via port COM,
// `serialport`) : exposer ici un bridge contextBridge dédié (ex.
// window.ovilogSerial), jamais sous le nom window.Capacitor, pour ne pas
// réactiver par erreur le code Android au passage.
