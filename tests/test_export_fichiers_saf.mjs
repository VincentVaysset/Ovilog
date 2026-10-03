/* Teste la migration de saveOrShareBinaryFile / "Exporter mes données" vers
   l'export visible (SAF) avec de FAUX plugins natifs en mémoire : succès,
   annulation, échec, relecture incorrecte, plugin absent, écriture
   temporaire impossible, fichier temporaire toujours supprimé, aucun
   contenu dans l'appel natif, plus aucune mention du dossier Documents,
   repli navigateur inchangé. Aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
const dialogs = []; let downloads = 0;
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
page.on('download', d => { downloads++; d.cancel().catch(() => {}); });
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

const exporter = (nom, mime) => page.evaluate(async ({ nom, mime }) => {
  const bytes = new TextEncoder().encode('%PDF-contenu-de-test-' + nom);
  return await saveOrShareBinaryFile(nom, bytes, mime);
}, { nom, mime });
const modale = () => page.evaluate(() => { const m = document.querySelector('.modal-card'); return m ? m.textContent : null; });
const fermerModale = () => page.evaluate(() => { const b = document.getElementById('file-saved-close'); if (b) b.click(); });

// ---- Navigateur/Bureau (aucun pont natif) : repli inchangé ----
await page.evaluate(() => { delete window.Capacitor; });
let r = await exporter('registre.pdf', 'application/pdf');
await page.waitForTimeout(300);
check(r.ok === true && downloads === 1 && !(await modale()), 'sans pont natif : téléchargement navigateur inchangé, sans modale');
console.log('OK navigateur/Bureau : repli téléchargement inchangé (1 téléchargement, aucune modale).');

await installerFauxPlugins(page);
// ---- Succès ----
r = await exporter('Registre d\'élevage 2026.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
check(r.ok === true, 'succès attendu, obtenu ' + JSON.stringify(r));
let m = await modale();
check(m && /Fichier enregistré/.test(m) && /emplacement que tu as choisi/.test(m) && /relu pour vérifier/.test(m), 'modale honnête attendue, obtenu ' + m);
check(!/Documents/.test(m), 'la modale ne doit plus jamais prétendre "dossier Documents"');
const calls = await page.evaluate(() => window.__saveAsCalls.map(c => c.args));
check(calls.length === 1 && calls[0].directory === 'CACHE' && /^export_tmp_.*\.xlsx$/.test(calls[0].path) && calls[0].fileName === 'Registre d\'élevage 2026.xlsx' && calls[0].deleteSource === true && !('data' in calls[0]), 'saveAs : CACHE + nom temporaire ASCII + deleteSource, sans contenu ; obtenu ' + JSON.stringify(calls));
check((await page.evaluate(() => Object.keys(window.__fs).filter(k => k.startsWith('CACHE/')).length)) === 0, 'le fichier temporaire du cache doit être supprimé après l\'export');
await fermerModale();
console.log('OK succès : modale honnête (aucune mention de "Documents"), saveAs reçoit CACHE + nom temporaire sans contenu, temporaire supprimé.');

// ---- Annulation : toast, pas de modale, pas d'alerte ----
await page.evaluate(() => { window.__mode = 'cancel'; });
dialogs.length = 0;
r = await exporter('inventaire.pdf', 'application/pdf');
check(r.cancelled === true && !(await modale()) && dialogs.length === 0, 'annulation : ni modale ni alerte');
check(/Export annulé : aucun fichier enregistré/.test(await page.evaluate(() => document.getElementById('app-toast').textContent)), 'toast d\'annulation attendu');
check((await page.evaluate(() => Object.keys(window.__fs).filter(k => k.startsWith('CACHE/')).length)) === 0, 'temporaire supprimé aussi après annulation');
console.log('OK annulation : toast "Export annulé : aucun fichier enregistré.", pas de fausse confirmation, temporaire supprimé.');

// ---- Échecs : alerte avec la vraie raison ----
for (const [mode, motif] of [['fail', /simulé/], ['throw', /boom natif/], ['sizeMismatch', /taille relue/], ['readFail', /relecture/]]) {
  await page.evaluate(x => { window.__mode = x; }, mode);
  dialogs.length = 0;
  r = await exporter('sous-delai.pdf', 'application/pdf');
  check(r.ok === false && !(await modale()) && dialogs.length === 1 && /Export non validé/.test(dialogs[0]) && motif.test(dialogs[0]), mode + ' : alerte avec raison attendue, obtenu ' + JSON.stringify(dialogs));
  check((await page.evaluate(() => Object.keys(window.__fs).filter(k => k.startsWith('CACHE/')).length)) === 0, mode + ' : temporaire supprimé');
  console.log('OK échec (' + mode + ') : alerte "' + dialogs[0].split('\n')[0] + '", aucune modale de succès.');
}
// ---- Écriture temporaire impossible / plugin absent ----
await page.evaluate(() => { window.__mode = 'ok'; window.__fsEchec = true; });
dialogs.length = 0;
r = await exporter('x.pdf', 'application/pdf');
check(r.ok === false && /fichier temporaire/.test(dialogs[0]) && (await page.evaluate(() => window.__saveAsCalls.length)) === 6, 'écriture temporaire KO : alerte, saveAs non appelé');
await page.evaluate(() => { window.__fsEchec = false; delete window.Capacitor.Plugins.FileSaver; });
dialogs.length = 0;
r = await exporter('x.pdf', 'application/pdf');
check(r.ok === false && /module d'export est absent/.test(dialogs[0]), 'plugin absent : alerte explicite');
console.log('OK écriture temporaire impossible / plugin FileSaver absent : alertes explicites, jamais de fausse confirmation.');

// ---- "Exporter mes données" : compteurs vérifiés ----
await installerFauxPlugins(page);
await page.evaluate(() => { DB.brebis = [{ id: 'e1', eid: '250016299930001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }]; DB.beliers = []; DB.agnelles = []; saveData(DB); });
await page.evaluate(async () => { await exportBackupFile(DB, 'troupeau-sauvegarde'); });
m = await modale();
check(m && /Fichier enregistré/.test(m), '"Exporter mes données" : modale honnête attendue');
await fermerModale();
const argsExport = await page.evaluate(() => window.__saveAsCalls[0].args);
check(argsExport.mimeType === 'application/json' && /^troupeau-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/.test(argsExport.fileName), 'nom du fichier exporté inattendu : ' + JSON.stringify(argsExport));
await page.evaluate(() => { window.__mode = 'countMismatch'; });
dialogs.length = 0;
await page.evaluate(async () => { await exportBackupFile(DB, 'troupeau-sauvegarde'); });
check(dialogs.length === 1 && /Export non validé/.test(dialogs[0]) && /compteurs/.test(dialogs[0]), '"Exporter mes données" : compteurs relus faux -> alerte, obtenu ' + JSON.stringify(dialogs));
console.log('OK "Exporter mes données" : export visible relu, compteurs brebis/béliers/agnelles vérifiés (écart -> alerte, rien de faussement confirmé).');

console.log('\nTOUS LES TESTS DES EXPORTS (saveOrShareBinaryFile) SONT PASSÉS (faux plugins natifs en mémoire, aucune donnée réelle)');
await browser.close();
