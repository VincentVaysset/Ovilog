/* Import JSON : même sauvegarde bloquante (copie interne + export visible
   relu) AVANT remplacement des données, avec voie de secours explicite
   "continuer sans export visible" propre à l'import. Faux plugins natifs en
   mémoire, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
const dialogs = []; let reponseSecondConfirm = true;
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => {
  dialogs.push(d.message());
  if (d.type() === 'confirm' && /SANS export visible/.test(d.message())) { reponseSecondConfirm ? d.accept() : d.dismiss(); }
  else d.accept();
});
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
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

const fichierImport = { name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
  brebis: [{ id: 'imp1', eid: '250016299930077', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }], beliers: [], agnelles: [] })) };
async function preparer() {
  await installerFauxPlugins(page);
  await page.evaluate(() => {
    DB.brebis = [{ id: 'orig1', eid: '250016299930001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }];
    DB.beliers = []; DB.agnelles = []; saveData(DB);
    parametresTab = 'sauvegarde'; parametresRubrique = 'sauvegarde'; render('parametres');
  });
  await page.waitForSelector('#import-file', { state: 'attached' });
  dialogs.length = 0;
}
const ids = () => page.evaluate(() => DB.brebis.map(s => s.id));
const internes = () => page.evaluate(() => Object.keys(window.__fs).filter(k => k.startsWith('EXTERNAL/ovilog_backup_')));
async function lancerImport() { await page.setInputFiles('#import-file', fichierImport); await page.waitForTimeout(700); }

// 1. succès SAF
await preparer();
await lancerImport();
check(JSON.stringify(await ids()) === '["imp1"]', 'import réussi attendu, obtenu ' + JSON.stringify(await ids()));
check((await internes()).length === 1, 'copie interne attendue');
const alerteOk = dialogs.find(d => /Import réussi/.test(d));
check(alerteOk && /emplacement que tu as choisi/.test(alerteOk) && /copie interne/.test(alerteOk), 'message de succès honnête attendu, obtenu ' + alerteOk);
const dbQuandSaveAs = await page.evaluate(() => window.__saveAsCalls[0].dbJson);
check(JSON.parse(dbQuandSaveAs).brebis[0].id === 'orig1', 'saveAs doit être appelé AVANT le remplacement (DB encore d\'origine)');
console.log('OK 1: succès -- export visible relu, copie interne écrite, message honnête, export demandé AVANT le remplacement.');

// 2. annulation du sélecteur + l'éleveur REFUSE de continuer sans export visible
await preparer();
await page.evaluate(() => { window.__mode = 'cancel'; });
reponseSecondConfirm = false;
await lancerImport();
check(JSON.stringify(await ids()) === '["orig1"]', 'refus : aucune donnée ne doit être remplacée, obtenu ' + JSON.stringify(await ids()));
check(dialogs.some(d => /SANS export visible/.test(d) && /INTERNE/.test(d)), 'le choix explicite doit être proposé');
check((await internes()).length === 1, 'le filet interne reste écrit même si l\'import est refusé');
check(/Import annulé/.test(await page.evaluate(() => document.getElementById('app-toast').textContent)), 'toast "Import annulé" attendu');
console.log('OK 2: export annulé + refus de continuer -> données intactes, filet interne écrit, toast "Import annulé".');

// 3. annulation + l'éleveur ACCEPTE "continuer sans export visible"
await preparer();
await page.evaluate(() => { window.__mode = 'cancel'; });
reponseSecondConfirm = true;
await lancerImport();
check(JSON.stringify(await ids()) === '["imp1"]', 'accord : import attendu, obtenu ' + JSON.stringify(await ids()));
check((await internes()).length === 1, 'filet interne écrit dans tous les cas');
const alerteSecours = dialogs.find(d => /Import réussi/.test(d));
check(alerteSecours && /copie interne uniquement/.test(alerteSecours) && /invisible depuis le gestionnaire de fichiers/.test(alerteSecours), 'message de secours honnête attendu, obtenu ' + alerteSecours);
console.log('OK 3: export annulé + "continuer sans export visible" -> import effectué, message "copie interne uniquement ... invisible".');

// 4. échec natif (fail) : même voie de secours, raison affichée
await preparer();
await page.evaluate(() => { window.__mode = 'fail'; });
reponseSecondConfirm = false;
await lancerImport();
check(JSON.stringify(await ids()) === '["orig1"]' && dialogs.some(d => /a échoué/.test(d) && /simulé/.test(d)), 'échec natif : raison affichée, données intactes');
console.log('OK 4: échec natif -> raison affichée, données intactes (refus).');

// 5. copie interne impossible : aucune voie de secours, jamais de remplacement
await preparer();
await page.evaluate(() => { window.__fsEchec = true; });
await lancerImport();
check(JSON.stringify(await ids()) === '["orig1"]', 'copie interne KO : données intactes');
check(!dialogs.some(d => /SANS export visible/.test(d)), 'aucune voie de secours ne doit être proposée sans filet interne');
check(dialogs.some(d => /Import annulé/.test(d) && /Rien n'a été modifié/.test(d)), 'message de blocage attendu');
console.log('OK 5: copie interne impossible -> import bloqué sans voie de secours, données intactes.');

// 6. verrou libéré : un import normal réussit ensuite
await preparer();
await lancerImport();
check(JSON.stringify(await ids()) === '["imp1"]' && (await page.evaluate(() => importJsonEnCours)) === false, 'verrou libéré, import suivant OK');
console.log('OK 6: verrou libéré après chaque cas, import suivant fonctionnel.');

console.log('\nTOUS LES TESTS DE L\'IMPORT JSON SONT PASSÉS (faux plugins natifs en mémoire, aucune donnée réelle)');
await browser.close();
