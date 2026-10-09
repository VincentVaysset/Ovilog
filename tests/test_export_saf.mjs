/* Teste la logique JS de l'export visible (SAF) avec de FAUX plugins natifs
   (Filesystem, FileSaver, Share en mémoire) -- aucun appareil, aucune donnée
   réelle. Couvre : succès, annulation, échec, exception, relecture incorrecte
   (taille, compteurs, lecture KO, vide), blocage de la bascule et du
   nettoyage AVANT toute mutation, verrous libérés (finally), aucun contenu
   dans l'appel natif, activité recréée (rechargement), "Tester la
   sauvegarde" (messages honnêtes + bouton Partager persistant). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const scratchDir = LIB_DIR;
const backendProc = spawn('node', [scratchDir + '/fake_firebase_backend.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
backendProc.stderr.on('data', d => process.stderr.write('[backend] ' + d));
let cleanedUp = false;
function cleanup() { if (cleanedUp) return; cleanedUp = true; try { backendProc.kill(); } catch (e) {} }
process.on('exit', cleanup);
process.on('uncaughtException', e => { console.error('UNCAUGHT:', e); cleanup(); process.exit(1); });
process.on('unhandledRejection', e => { console.error('UNHANDLED REJECTION:', e); cleanup(); process.exit(1); });
const fakePort = await new Promise((resolve, reject) => {
  let buf = '';
  backendProc.stdout.on('data', d => { buf += d.toString(); const m = buf.match(/FAKE_FIREBASE_PORT=(\d+)/); if (m) resolve(Number(m[1])); });
  backendProc.on('exit', code => reject(new Error('fake backend exited early, code ' + code)));
  setTimeout(() => reject(new Error('timeout')), 5000);
});
const fakeBundleSrc = readFileSync(scratchDir + '/fake_firebase_bundle.mjs', 'utf8').replace('__FAKE_FIREBASE_PORT__', String(fakePort));

const browser = await chromium.launch(LAUNCH);
async function newPage() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/vendor/firebase.bundle.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fakeBundleSrc }));
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  page.on('download', d => d.cancel().catch(() => {}));
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return page;
}
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

// Installe les faux plugins natifs dans la page (lus à l'appel par l'appli).
async function installerFauxPlugins(page) {
  await page.evaluate(() => {
    const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    window.__fs = {};
    window.__docs = {};
    window.__mode = 'ok';
    window.__fsEchec = false;
    window.__shareMode = 'ok';
    window.__saveAsCalls = [];
    window.__shareCalls = [];
    window.Capacitor = { Plugins: {
      Filesystem: {
        checkPermissions: async () => ({ publicStorage: 'granted' }),
        requestPermissions: async () => ({}),
        writeFile: async ({ path, data, directory }) => {
          if (window.__fsEchec) throw new Error('disque plein simulé');
          window.__fs[directory + '/' + path] = b64ToBytes(data);
          return {};
        },
        readFile: async ({ path, directory }) => {
          const b = window.__fs[directory + '/' + path];
          if (!b) throw new Error('File does not exist');
          return { data: new TextDecoder().decode(b) };
        },
        readdir: async ({ directory }) => ({ files: Object.keys(window.__fs).filter(k => k.startsWith(directory + '/')).map(k => ({ name: k.slice(directory.length + 1) })) }),
        deleteFile: async ({ path, directory }) => { delete window.__fs[directory + '/' + path]; },
        getUri: async ({ path, directory }) => ({ uri: 'file:///fake/' + directory + '/' + path })
      },
      FileSaver: {
        saveAs: async (args) => {
          window.__saveAsCalls.push({ args, dbJson: JSON.stringify(DB), tailleArgs: JSON.stringify(args).length });
          const m = window.__mode;
          if (m === 'cancel') return { ok: false, cancelled: true };
          if (m === 'fail') return { ok: false, raison: "l'écriture dans l'emplacement choisi a échoué (simulé)" };
          if (m === 'throw') throw new Error('boom natif');
          if (m === 'never') return new Promise(() => {});
          const src = window.__fs[args.directory + '/' + args.path];
          if (!src) return { ok: false, raison: 'le fichier source est introuvable ou vide' };
          const uri = 'content://fake/' + args.fileName;
          window.__docs[uri] = src.slice();
          return { ok: true, uri, taille: src.length, nom: 'Sauvegarde choisie.json' };
        },
        readUri: async ({ uri, asText }) => {
          const m = window.__mode;
          const doc = window.__docs[uri];
          if (m === 'readFail') return { ok: false, raison: 'lecture simulée KO' };
          if (m === 'emptyRead') return { ok: true, taille: 0, texte: '' };
          if (m === 'sizeMismatch') return { ok: true, taille: doc.length + 1, texte: asText ? new TextDecoder().decode(doc) : undefined };
          if (m === 'countMismatch') {
            const p = JSON.parse(new TextDecoder().decode(doc));
            p.brebis = [];
            return { ok: true, taille: doc.length, texte: JSON.stringify(p) };
          }
          return { ok: true, taille: doc.length, texte: asText ? new TextDecoder().decode(doc) : undefined };
        }
      },
      Share: {
        share: async (opts) => {
          window.__shareCalls.push(opts);
          if (window.__shareMode === 'cancel') throw new Error('Share canceled');
          if (window.__shareMode === 'fail') throw new Error('Failed to find configured root that contains /storage/x');
          return { activityType: '' };
        }
      }
    } };
  });
}
const baseDb = () => ({
  campagneDebut: 2026, campagneDateDemarrage: '2025-10-01', campagneInitialisee: true,
  brebis: [{ id: 's1', eid: '250016299930001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2025-10-02' }], controleLaitier: [], modesRepro: [] }],
  beliers: [{ id: 'b1', eid: '250016299930090', statut: 'actif', createdAt: 1, sanitaire: [], mouvements: [] }],
  agnelles: [{ id: 'a1', eid: '250016299930002', motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [], modesRepro: [] }],
  registre: { brebis: {}, beliers: {}, agnelles: {} }
});

// ================= Page 1 : sans connexion cloud =================
const page = await newPage();
await installerFauxPlugins(page);
await page.evaluate((db) => { Object.assign(DB, db); saveData(DB); }, baseDb());

// ---- A. sauvegardeVisibleAvantMutation : succès ----
let r = await page.evaluate(async () => await sauvegardeVisibleAvantMutation('ovilog_backup_test.json', DB));
check(r.ok && r.mode === 'saf' && r.visible.taille > 0 && r.visible.nom === 'Sauvegarde choisie.json', 'succès SAF attendu, obtenu ' + JSON.stringify(r));
let calls = await page.evaluate(() => window.__saveAsCalls);
check(calls.length === 1 && calls[0].args.directory === 'EXTERNAL' && calls[0].args.path === 'ovilog_backup_test.json', 'saveAs doit désigner le fichier interne EXTERNAL');
check(!('data' in calls[0].args) && calls[0].tailleArgs < 400, 'AUCUN contenu ne doit transiter par l\'appel natif (taille des options ' + calls[0].tailleArgs + ')');
check(await page.evaluate(() => localStorage.getItem('ovilog_export_en_cours')) === null, 'marqueur d\'export effacé après succès');
console.log('OK A: succès -- export visible relu (taille + compteurs), saveAs ne reçoit que le nom du fichier (' + calls[0].tailleArgs + ' octets d\'options), marqueur effacé.');

// ---- B-G. cas d'échec de sauvegardeVisibleAvantMutation ----
const cas = [
  ['cancel', r => r.cancelled === true && r.interneOk === true, 'annulation'],
  ['fail', r => !r.cancelled && /simulé/.test(r.raison), 'échec natif'],
  ['throw', r => !r.cancelled && /boom natif/.test(r.raison), 'exception native'],
  ['readFail', r => /relecture/.test(r.raison), 'relecture KO'],
  ['emptyRead', r => /vide/.test(r.raison), 'relecture vide'],
  ['sizeMismatch', r => /taille relue/.test(r.raison), 'taille relue différente'],
  ['countMismatch', r => /compteurs/.test(r.raison), 'compteurs relus différents']
];
for (const [mode, verif, label] of cas) {
  await page.evaluate(m => { window.__mode = m; }, mode);
  r = await page.evaluate(async () => await sauvegardeVisibleAvantMutation('ovilog_backup_test.json', DB));
  check(r.ok === false && verif(r), label + ' : résultat inattendu ' + JSON.stringify(r));
  check(await page.evaluate(() => localStorage.getItem('ovilog_export_en_cours')) === null, label + ' : marqueur non effacé');
  console.log('OK B-G (' + label + ') : ok=false, raison "' + r.raison + '", marqueur effacé.');
}
// écriture interne impossible
await page.evaluate(() => { window.__mode = 'ok'; window.__fsEchec = true; });
r = await page.evaluate(async () => await sauvegardeVisibleAvantMutation('ovilog_backup_test.json', DB));
check(r.ok === false && r.interneOk === false && /disque plein/.test(r.raison), 'échec d\'écriture interne attendu, obtenu ' + JSON.stringify(r));
const nbAvant = await page.evaluate(() => window.__saveAsCalls.length);
await page.evaluate(() => { window.__fsEchec = false; });
console.log('OK H: échec de la copie interne -> ok=false, interneOk=false (pas d\'export visible tenté).');

// ---- I. Bascule : bloquée AVANT toute mutation, verrous libérés ----
for (const mode of ['cancel', 'fail', 'throw', 'sizeMismatch', 'countMismatch', 'readFail']) {
  await page.evaluate((db) => { Object.assign(DB, db); saveData(DB); localStorage.removeItem('ovilog_pre_campagne_snapshot'); window.__saveAsCalls = []; }, baseDb());
  const dbAvant = await page.evaluate(() => JSON.stringify(DB));
  await page.evaluate(m => { window.__mode = m; }, mode);
  const res = await page.evaluate(async () => await executerChangementCampagne());
  check(res.ok === false, 'bascule doit être bloquée (' + mode + '), obtenu ' + JSON.stringify(res));
  if (mode === 'cancel') check(res.annule === true && /annulé/.test(res.raison), 'annulation : annule=true attendu');
  const apres = await page.evaluate(() => ({ db: JSON.stringify(DB), verrou: campagneChangeEnCours, groupee: operationGroupeeEnCours,
    snap: localStorage.getItem('ovilog_pre_campagne_snapshot'), dbSaveAs: window.__saveAsCalls.map(c => c.dbJson) }));
  check(apres.db === dbAvant, 'DB modifiée malgré le blocage (' + mode + ')');
  check(apres.verrou === false && apres.groupee === false, 'verrous non libérés (' + mode + ')');
  check(apres.snap === null, 'point de restauration écrit malgré le blocage (' + mode + ')');
  check(apres.dbSaveAs.length === 1 && apres.dbSaveAs[0] === dbAvant, 'saveAs doit être appelé AVANT toute mutation (DB identique à ce moment-là) (' + mode + ')');
  console.log('OK I (' + mode + ') : bascule bloquée, DB strictement inchangée, verrous libérés, aucun point de restauration écrit, export demandé AVANT mutation.');
}
// puis succès : prouve que le verrou est bien libre et que la bascule va au bout
await page.evaluate((db) => { Object.assign(DB, db); saveData(DB); window.__mode = 'ok'; window.__saveAsCalls = []; }, baseDb());
const okBascule = await page.evaluate(async () => await executerChangementCampagne());
check(okBascule.ok === true, 'bascule doit réussir quand l\'export visible réussit, obtenu ' + JSON.stringify(okBascule));
const apresOk = await page.evaluate(() => ({ actives: DB.brebis.filter(s => (s.statut || 'active') === 'active').length, camp: DB.campagneDebut, verrou: campagneChangeEnCours }));
check(apresOk.actives === 2 && apresOk.camp === 2027 && apresOk.verrou === false, 'bascule réussie attendue, obtenu ' + JSON.stringify(apresOk));
console.log('OK I (succès) : après les blocages, la bascule réussit (verrou bien libéré à chaque fois).');

// ---- K. "Tester la sauvegarde" : messages honnêtes + bouton Partager persistant ----
async function ouvrirSauvegarde() {
  await page.evaluate(() => { parametresTab = 'sauvegarde'; parametresRubrique = 'sauvegarde'; render('parametres'); });
  await page.waitForTimeout(150);
}
async function texteStatutTest() { return await page.evaluate(() => document.getElementById('test-sauvegarde-status').textContent); }
async function partageVisible() { return await page.evaluate(() => !document.getElementById('btn-partager-test').classList.contains('hidden')); }
await ouvrirSauvegarde();
check(!(await partageVisible()), 'le bouton Partager ne doit pas être affiché avant tout test');
await page.evaluate((db) => { Object.assign(DB, db); window.__mode = 'ok'; }, baseDb());
await page.click('#btn-test-sauvegarde');
await page.waitForFunction(() => /Test réussi|annulé|échoué/.test(document.getElementById('test-sauvegarde-status').textContent), null, { timeout: 8000 });
let t = await texteStatutTest();
check(/Test réussi/.test(t) && /emplacement que tu as choisi/.test(t) && /Sauvegarde choisie\.json/.test(t) && /compteurs identiques/.test(t), 'message de succès honnête attendu, obtenu : ' + t);
check(!/gestionnaire de fichiers/.test(t), 'le message de succès ne doit jamais renvoyer au gestionnaire de fichiers');
check(await partageVisible(), 'le bouton Partager doit être affiché après un test réussi');
// persistance à travers un re-rendu
await ouvrirSauvegarde();
check((await texteStatutTest()) === t && (await partageVisible()), 'message et bouton doivent survivre à un re-rendu');
console.log('OK K (succès) : "' + t + '" -- bouton Partager affiché, persiste après re-rendu.');
// partage réussi / annulé / en échec : message exact
await page.click('#btn-partager-test');
await page.waitForFunction(() => /Feuille de partage ouverte/.test(document.getElementById('test-sauvegarde-status').textContent), null, { timeout: 5000 });
check((await page.evaluate(() => window.__shareCalls.length)) === 1, 'Share.share doit être appelé une fois');
await page.evaluate(() => { window.__shareMode = 'fail'; });
await page.click('#btn-partager-test');
await page.waitForFunction(() => /Partage impossible/.test(document.getElementById('test-sauvegarde-status').textContent), null, { timeout: 5000 });
t = await texteStatutTest();
check(/Failed to find configured root/.test(t), 'l\'échec de partage doit afficher la vraie raison, obtenu : ' + t);
await page.evaluate(() => { window.__shareMode = 'cancel'; });
await page.click('#btn-partager-test');
await page.waitForFunction(() => /Partage annulé/.test(document.getElementById('test-sauvegarde-status').textContent), null, { timeout: 5000 });
await page.evaluate(() => { window.__shareMode = 'ok'; });
console.log('OK K (partage) : succès / échec (raison réelle affichée, plus de silence) / annulation -- messages distincts.');
// annulation du sélecteur : honnête, bouton Partager disponible
await page.evaluate(() => { window.__mode = 'cancel'; });
await page.click('#btn-test-sauvegarde');
await page.waitForFunction(() => /annulé/.test(document.getElementById('test-sauvegarde-status').textContent), null, { timeout: 8000 });
t = await texteStatutTest();
check(/Export annulé/.test(t) && /Aucun fichier n'a été enregistré à un emplacement visible/.test(t) && /invisible depuis le gestionnaire de fichiers/.test(t), 'message d\'annulation honnête attendu, obtenu : ' + t);
check(await partageVisible(), 'le bouton Partager doit rester disponible après une annulation (copie interne vérifiée)');
console.log('OK K (annulation) : message honnête, pas de fausse promesse, bouton Partager disponible.');
// échec natif
await page.evaluate(() => { window.__mode = 'fail'; });
await page.click('#btn-test-sauvegarde');
await page.waitForFunction(() => /Test échoué/.test(document.getElementById('test-sauvegarde-status').textContent), null, { timeout: 8000 });
t = await texteStatutTest();
check(/Test échoué/.test(t) && /simulé/.test(t), 'message d\'échec avec raison réelle attendu, obtenu : ' + t);
console.log('OK K (échec) : raison réelle affichée.');
// test ne modifie aucune donnée
await page.evaluate((db) => { Object.assign(DB, db); saveData(DB); window.__mode = 'ok'; }, baseDb());
const dbAvantTest = await page.evaluate(() => JSON.stringify(DB));
await ouvrirSauvegarde();
await page.click('#btn-test-sauvegarde');
await page.waitForFunction(() => /Test réussi/.test(document.getElementById('test-sauvegarde-status').textContent), null, { timeout: 8000 });
check((await page.evaluate(() => JSON.stringify(DB))) === dbAvantTest, '"Tester la sauvegarde" ne doit modifier aucune donnée');
console.log('OK K : "Tester la sauvegarde" ne modifie aucune donnée.');

// ---- L. Activité recréée pendant le sélecteur ----
await page.evaluate((db) => { Object.assign(DB, db); saveData(DB); window.__mode = 'never'; window.__saveAsCalls = []; localStorage.removeItem('ovilog_pre_campagne_snapshot'); }, baseDb());
const dbStockeAvant = await page.evaluate(() => localStorage.getItem(DB_KEY));
// la bascule démarre et reste suspendue dans le sélecteur ; on recharge la page (état JS perdu)
await page.evaluate(() => { window.__pendingBascule = executerChangementCampagne(); });
await page.waitForFunction(() => window.__saveAsCalls.length === 1 && localStorage.getItem('ovilog_export_en_cours') !== null, null, { timeout: 5000 });
check(await page.evaluate(() => campagneChangeEnCours === true), 'pendant le sélecteur, le verrou doit être pris');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);
const apresReload = await page.evaluate(() => ({
  verrou: campagneChangeEnCours, groupee: operationGroupeeEnCours, marqueur: localStorage.getItem('ovilog_export_en_cours'),
  db: localStorage.getItem(DB_KEY), snap: localStorage.getItem('ovilog_pre_campagne_snapshot'),
  toast: (document.getElementById('app-toast') || {}).textContent || ''
}));
check(apresReload.verrou === false && apresReload.groupee === false, 'aucun verrou ne doit survivre au rechargement');
check(apresReload.marqueur === null, 'le marqueur d\'export interrompu doit être consommé au rechargement');
check(apresReload.db === dbStockeAvant, 'les données stockées doivent être identiques à celles d\'avant (rien modifié)');
check(apresReload.snap === null, 'aucun point de restauration écrit');
check(/interrompu/.test(apresReload.toast) && /Aucune donnée n'a été modifiée/.test(apresReload.toast), 'message clair attendu après rechargement, obtenu : ' + apresReload.toast);
console.log('OK L: activité recréée pendant le sélecteur -> aucun verrou bloqué, données stockées strictement identiques, marqueur consommé, message "' + apresReload.toast + '".');
await installerFauxPlugins(page);
const reprise = await page.evaluate(async () => { Object.assign(DB, { campagneDebut: 2026, campagneInitialisee: true }); return (await executerChangementCampagne()).ok; });
check(reprise === true, 'une bascule doit pouvoir être relancée normalement après le rechargement');
console.log('OK L: la bascule se relance normalement après le rechargement.');

// ================= Page 2 : avec connexion (nettoyage -> archivage cloud) =================
const page2 = await newPage();
const email = 'export-saf-' + Date.now() + '@ovilog-audit-jetable.test';
await page2.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email, pw: 'AuditTest12345!' });
for (let i = 0; i < 100 && !(await page2.evaluate(() => window.OvilogSync.getState().loggedIn)); i++) await page2.waitForTimeout(200);
await installerFauxPlugins(page2);
await page2.evaluate(() => {
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-09-29'; DB.campagneInitialisee = true;
  DB.brebis = [{ id: 'avant-ref', eid: '250016210000001', statut: 'vendue', createdAt: 1, dateEntree: '2020-01-01', echographies: [], agnelages: [], sanitaire: [], controleLaitier: [], modesRepro: [], mouvements: [{ type: 'Vente', date: '2026-09-15', acheteur: 'Test' }] }];
  DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  saveData(DB);
  parametresTab = 'sauvegarde'; parametresRubrique = 'sauvegarde'; prmMaintenanceOuvert = true; render('parametres');
});
await page2.waitForTimeout(500);
async function ouvrirCampagne() { await page2.evaluate(() => { parametresTab = 'sauvegarde'; parametresRubrique = 'sauvegarde'; prmMaintenanceOuvert = true; render('parametres'); }); await page2.waitForSelector('#btn-nettoyer-registre', { timeout: 5000 }); }
async function statutNettoyage() { return await page2.evaluate(() => (document.getElementById('nettoyage-registre-status') || {}).textContent || ''); }
// J1. annulation : rien n'est modifié, bouton non bloqué, verrou libéré
await page2.evaluate(() => { window.__mode = 'cancel'; });
await ouvrirCampagne();
await page2.click('#btn-nettoyer-registre');
await page2.waitForFunction(() => /annulé/.test((document.getElementById('nettoyage-registre-status') || {}).textContent || ''), null, { timeout: 10000 });
let etat = await page2.evaluate(() => ({ restantes: DB.brebis.map(s => s.id), registre: Object.keys(DB.registre.brebis), verrou: nettoyageRegistreEnCours, desactive: document.getElementById('btn-nettoyer-registre').disabled }));
check(etat.restantes.length === 1 && etat.registre.length === 0, 'nettoyage annulé : aucune fiche ne doit être archivée/retirée, obtenu ' + JSON.stringify(etat));
check(etat.verrou === false && etat.desactive === false, 'nettoyage annulé : verrou libéré et bouton réactivé, obtenu ' + JSON.stringify(etat));
check(/Rien n'a été modifié/.test(await statutNettoyage()), 'message clair attendu');
console.log('OK J1: nettoyage annulé -> fiches intactes, registre intact, verrou libéré, bouton réactivé, message "' + (await statutNettoyage()) + '".');
// J2. échec de relecture : idem
await page2.evaluate(() => { window.__mode = 'sizeMismatch'; });
await ouvrirCampagne();
await page2.click('#btn-nettoyer-registre');
await page2.waitForFunction(() => /annulé/.test((document.getElementById('nettoyage-registre-status') || {}).textContent || '') && /taille relue/.test(document.getElementById('nettoyage-registre-status').textContent), null, { timeout: 10000 });
etat = await page2.evaluate(() => ({ restantes: DB.brebis.length, verrou: nettoyageRegistreEnCours }));
check(etat.restantes === 1 && etat.verrou === false, 'nettoyage : relecture incorrecte doit bloquer sans rien modifier');
console.log('OK J2: relecture incorrecte -> nettoyage bloqué, rien modifié, verrou libéré.');
// J3. succès : va au bout
await page2.evaluate(() => { window.__mode = 'ok'; window.__saveAsCalls = []; });
await ouvrirCampagne();
await page2.click('#btn-nettoyer-registre');
await page2.waitForFunction(() => /archivée/.test((document.getElementById('nettoyage-registre-status') || {}).textContent || ''), null, { timeout: 15000 });
etat = await page2.evaluate(() => ({ restantes: DB.brebis.length, registre: Object.keys(DB.registre.brebis).length, appels: window.__saveAsCalls.length, verrou: nettoyageRegistreEnCours }));
check(etat.restantes === 0 && etat.registre === 1 && etat.appels === 1 && etat.verrou === false, 'nettoyage réussi attendu, obtenu ' + JSON.stringify(etat));
console.log('OK J3: export visible réussi -> le nettoyage archive la fiche, verrou libéré.');

cleanup();
console.log('\nTOUS LES TESTS DE L\'EXPORT VISIBLE SONT PASSÉS (faux plugins natifs en mémoire, compte jetable, faux backend local, aucune donnée réelle)');
await browser.close();
