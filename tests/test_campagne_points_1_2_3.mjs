import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());

// Horloge simulée (installée AVANT tout chargement de page, via
// addInitScript) : ce test dépendait de la date système réelle (point 3a
// supposait "aujourd'hui avant le 1er octobre", faux dès que la vraie date
// dépasse ce seuil -- repéré exactement par cette panne). Seul l'appel
// SANS argument (new Date() / Date.now(), utilisé par estAvantSeuilCampagne
// via renderConfirmationNouvelleCampagne) est figé ; new Date(chaîne) garde
// le vrai parsing, pour ne rien casser ailleurs dans l'appli. Le 15/09 est
// choisi pour satisfaire les DEUX scénarios déjà couverts par ce test sans
// réinstaller l'horloge entre les deux : avant le seuil "1er octobre" par
// défaut (point 3a) ET après le seuil "1er janvier" simulé (point 3b).
const DATE_SIMULEE = '2026-09-15T12:00:00Z';
await page.addInitScript((isoFixe) => {
  const RealDate = Date;
  const fixedMs = new RealDate(isoFixe).getTime();
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixedMs);
      else super(...args);
    }
    static now() { return fixedMs; }
  }
  window.Date = FakeDate;
}, DATE_SIMULEE);

await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

function baseDb() {
  return {
    campagneDebut: 2026, campagneDateDemarrage: '2025-10-01', campagneInitialisee: true,
    brebis: [
      { id: 's1', eid: '250016299930001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }
    ],
    agnelles: [
      { id: 'a1', eid: '250016299930002', motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [], modesRepro: [] }
    ],
    registre: { brebis: {}, beliers: {}, agnelles: {} }
  };
}

// ============================================================
// Point 3a -- AVANT le seuil configuré ("aujourd'hui" simulé au 15/09,
// avant le 1er octobre par défaut) : le bouton Valider doit être désactivé
// par défaut, une case de confirmation explicite doit le débloquer.
// ============================================================
await page.evaluate((db) => {
  Object.assign(DB, db);
  DB.exploitation.campagneMoisDebut = 10;
  DB.exploitation.campagneJourDebut = 1;
  saveData(DB);
  render('confirmation-nouvelle-campagne');
}, baseDb());
await page.waitForTimeout(150);

const etatAvantSeuil = await page.evaluate(() => ({
  caseExiste: !!document.getElementById('f-avant-seuil-confirm'),
  boutonDisabled: document.getElementById('btn-confirmer-nouvelle-campagne').disabled
}));
if (!etatAvantSeuil.caseExiste) throw new Error('FAIL: la case de confirmation "avant le seuil" doit apparaître (nous sommes avant le 1er octobre configuré).');
if (!etatAvantSeuil.boutonDisabled) throw new Error('FAIL: le bouton Valider doit être désactivé tant que la case n\'est pas cochée.');
console.log('OK point 3: avant le seuil configuré, le bouton Valider est désactivé par défaut, avec une case de confirmation explicite affichée.');

await page.check('#f-avant-seuil-confirm');
const boutonApresCoche = await page.evaluate(() => document.getElementById('btn-confirmer-nouvelle-campagne').disabled);
if (boutonApresCoche) throw new Error('FAIL: cocher la case doit débloquer le bouton Valider.');
console.log('OK point 3: cocher la case débloque bien le bouton Valider.');

// Décoche -> re-bloque (pas un débloquage définitif au premier clic).
await page.uncheck('#f-avant-seuil-confirm');
const boutonApresDecoche = await page.evaluate(() => document.getElementById('btn-confirmer-nouvelle-campagne').disabled);
if (!boutonApresDecoche) throw new Error('FAIL: décocher la case doit re-bloquer le bouton Valider.');
console.log('OK point 3: décocher la case re-bloque le bouton (pas un simple clic \"one-shot\").');

// ============================================================
// Point 3b -- APRÈS le seuil configuré : aucune case, bouton actif d'emblée.
// Simulé en configurant un seuil déjà passé par rapport au 15/09 simulé
// ci-dessus (1er janvier).
// ============================================================
await page.evaluate((db) => {
  Object.assign(DB, db);
  DB.exploitation.campagneMoisDebut = 1;
  DB.exploitation.campagneJourDebut = 1;
  saveData(DB);
  render('confirmation-nouvelle-campagne');
}, baseDb());
await page.waitForTimeout(150);
const etatApresSeuil = await page.evaluate(() => ({
  caseExiste: !!document.getElementById('f-avant-seuil-confirm'),
  boutonDisabled: document.getElementById('btn-confirmer-nouvelle-campagne').disabled
}));
if (etatApresSeuil.caseExiste) throw new Error('FAIL: aucune case de confirmation supplémentaire ne doit apparaître après le seuil configuré.');
if (etatApresSeuil.boutonDisabled) throw new Error('FAIL: le bouton Valider doit être actif d\'emblée après le seuil configuré.');
console.log('OK point 3: après le seuil configuré, pas de confirmation supplémentaire, bouton actif d\'emblée.');

// ============================================================
// Point 2 -- Point de restauration interne : posé avant la bascule, bouton
// affiché dans Paramètres > Campagne, restauration effective + case effacée
// après usage.
// ============================================================
await page.evaluate((db) => {
  Object.assign(DB, db);
  saveData(DB);
});
await page.evaluate(() => localStorage.removeItem('ovilog_pre_campagne_snapshot'));

let snapshotAvant = await page.evaluate(() => localStorage.getItem('ovilog_pre_campagne_snapshot'));
if (snapshotAvant !== null) throw new Error('FAIL: aucun point de restauration ne doit exister avant la première bascule de ce test.');

const resultBascule2 = await page.evaluate(async () => await executerChangementCampagne());
if (!resultBascule2.ok) throw new Error('FAIL: la bascule devrait réussir, obtenu ' + JSON.stringify(resultBascule2));

const snapshotApres = await page.evaluate(() => {
  const raw = localStorage.getItem('ovilog_pre_campagne_snapshot');
  return raw ? JSON.parse(raw) : null;
});
if (!snapshotApres) throw new Error('FAIL: un point de restauration interne doit être posé avant la bascule.');
if (snapshotApres.data.brebis.length !== 1 || snapshotApres.data.agnelles.length !== 1) {
  throw new Error('FAIL: le point de restauration doit contenir l\'état D\'AVANT la bascule (1 brebis, 1 agnelle), obtenu ' + JSON.stringify({ brebis: snapshotApres.data.brebis.length, agnelles: snapshotApres.data.agnelles.length }));
}
console.log('OK point 2: un point de restauration interne (localStorage, jamais synchronisé) est posé avant chaque bascule, avec l\'état exact d\'avant.');

await page.evaluate(() => render('parametres-campagne-onglet-test')); // no-op si la route n'existe pas, on force juste le re-render ci-dessous
await page.evaluate(() => { parametresTab = 'campagne'; render('parametres'); });
await page.waitForTimeout(150);
if (!(await page.$('#btn-restaurer-pre-campagne'))) {
  throw new Error('FAIL: le bouton "Restaurer l\'état d\'avant bascule" doit apparaître dans Paramètres > Campagne quand un point de restauration existe.');
}
console.log('OK point 2: le bouton "Restaurer l\'état d\'avant bascule" apparaît bien dans Paramètres > Campagne.');

const activesApresBascule = await page.evaluate(() => DB.brebis.filter(s => (s.statut||'active')==='active').length);
if (activesApresBascule !== 2) throw new Error('FAIL: attendu 2 actives après la bascule (1+1), obtenu ' + activesApresBascule);

await page.click('#btn-restaurer-pre-campagne');
await page.waitForTimeout(200);
const etatRestaure = await page.evaluate(() => ({
  actives: DB.brebis.filter(s => (s.statut||'active')==='active').length,
  agnelles: (DB.agnelles||[]).length,
  campagneDebut: DB.campagneDebut,
  snapshotEncorePresent: localStorage.getItem('ovilog_pre_campagne_snapshot') !== null
}));
if (etatRestaure.actives !== 1 || etatRestaure.agnelles !== 1 || etatRestaure.campagneDebut !== 2026) {
  throw new Error('FAIL: la restauration doit ramener EXACTEMENT l\'état d\'avant bascule (1 active, 1 agnelle, campagne 2026), obtenu ' + JSON.stringify(etatRestaure));
}
if (etatRestaure.snapshotEncorePresent) throw new Error('FAIL: le point de restauration doit être effacé après usage (ne se restaure qu\'une fois).');
console.log('OK point 2: "Restaurer l\'état d\'avant bascule" ramène exactement l\'état antérieur et efface le point de restauration après usage.');

const boutonDisparu = await page.evaluate(() => { parametresTab = 'campagne'; render('parametres'); return !document.getElementById('btn-restaurer-pre-campagne'); });
if (!boutonDisparu) throw new Error('FAIL: le bouton de restauration ne doit plus apparaître une fois le point de restauration consommé.');
console.log('OK point 2: le bouton de restauration disparaît bien une fois consommé.');

// ============================================================
// Point 1 -- Feuille de partage native proposée après une sauvegarde
// réussie sur les déclenchements explicites (changement de campagne),
// jamais sur la vérification périodique silencieuse. Plugins Capacitor
// simulés (aucun natif disponible dans ce test navigateur).
// ============================================================
await page.evaluate(() => {
  window.__shareArgs = null;
  window.Capacitor = {
    Plugins: {
      Filesystem: {
        checkPermissions: async () => ({ publicStorage: 'granted' }),
        requestPermissions: async () => ({}),
        writeFile: async () => ({}),
        readFile: async ({ path }) => ({ data: window.__lastWrittenContent }),
        getUri: async ({ path, directory }) => ({ uri: 'file:///fake/' + directory + '/' + path })
      },
      Share: {
        share: async (opts) => { window.__shareArgs = opts; return { activityType: '' }; }
      }
    }
  };
  // Piège l'écriture pour fournir exactement ce que la relecture doit renvoyer.
  const origWriteFile = window.Capacitor.Plugins.Filesystem.writeFile;
  window.Capacitor.Plugins.Filesystem.writeFile = async ({ data }) => {
    window.__lastWrittenContent = atob(data);
    return {};
  };
});

// Plan "Export SAF" : plus aucun partage automatique en tâche de fond -- writeAutoBackupFile
// n'écrit que la copie interne ; le partage se fait à la demande (partagerFichierExistant),
// avec un retour { ok, cancelled, raison } affiché par l'écran, jamais d'erreur avalée.
const r1 = await page.evaluate(async () => {
  DB.brebis = [{ id: 'sp1', eid: '250016299930010', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }];
  DB.agnelles = [];
  DB.campagneDebut = 2030;
  const r = await writeAutoBackupFile('test-partage.json', DB);
  await new Promise(res => setTimeout(res, 50));
  return { r, shareArgs: window.__shareArgs };
});
if (!r1.r.ok) throw new Error('FAIL: writeAutoBackupFile doit réussir avec les plugins simulés, obtenu ' + JSON.stringify(r1.r));
if (r1.shareArgs !== null) throw new Error('FAIL: writeAutoBackupFile ne doit plus jamais ouvrir de feuille de partage en tâche de fond, obtenu ' + JSON.stringify(r1.shareArgs));
console.log('OK point 1: la sauvegarde interne n\'ouvre plus aucune feuille de partage en tâche de fond.');

const r2 = await page.evaluate(async () => { window.__shareArgs = null; const r = await partagerFichierExistant('test-partage.json'); return { r, shareArgs: window.__shareArgs }; });
if (!r2.r.ok || !r2.shareArgs || !r2.shareArgs.url) throw new Error('FAIL: partagerFichierExistant doit appeler Share.share() avec une URL, obtenu ' + JSON.stringify(r2));
console.log('OK point 1: le partage à la demande invoque bien Share.share() avec le fichier écrit.');

const r3 = await page.evaluate(async () => { window.Capacitor.Plugins.Share.share = async () => { throw new Error('Share canceled'); }; return await partagerFichierExistant('test-partage.json'); });
if (r3.ok || !r3.cancelled) throw new Error('FAIL: un partage annulé doit être signalé comme tel, obtenu ' + JSON.stringify(r3));
const r4 = await page.evaluate(async () => { window.Capacitor.Plugins.Share.share = async () => { throw new Error('Failed to find configured root'); }; return await partagerFichierExistant('test-partage.json'); });
if (r4.ok || r4.cancelled || !/configured root/.test(r4.raison)) throw new Error('FAIL: un échec de partage doit remonter sa vraie raison, obtenu ' + JSON.stringify(r4));
console.log('OK point 1: partage annulé et partage en échec sont distingués, avec la vraie raison -- plus rien n\'est avalé.');

console.log('TOUS LES TESTS SONT PASSÉS');
await browser.close();
