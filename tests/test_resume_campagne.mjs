/* Résumé de campagne (chiffres figés) : DB.resumesCampagne.
   1. construireResumeCampagne / bilanDepuisResume : aller-retour identique au calcul vivant (jeu
      synthétique du bilan du 23/09), taille raisonnable, aucun ratio stocké, aucune écriture.
   2. migrateData : champ toujours un objet ; synchro meta (faux backend) vers un 2e appareil.
   3. Bascule : résumé figé AVANT toute modification et après l'export visible, jamais écrasé,
      garde « 0 mise bas » (continuer sans résumé / interrompre, rien modifié).
   Faux backend + faux plugins natifs, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR } from './lib/config.mjs';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const backendProc = spawn('node', [LIB_DIR + '/fake_firebase_backend.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
backendProc.stderr.on('data', d => process.stderr.write('[backend] ' + d));
function cleanup() { try { backendProc.kill(); } catch (e) {} }
process.on('exit', cleanup);
process.on('uncaughtException', e => { console.error('UNCAUGHT:', e); cleanup(); process.exit(1); });
process.on('unhandledRejection', e => { console.error('UNHANDLED REJECTION:', e); cleanup(); process.exit(1); });
const fakePort = await new Promise((resolve, reject) => {
  let buf = '';
  backendProc.stdout.on('data', d => { buf += d.toString(); const m = buf.match(/FAKE_FIREBASE_PORT=(\d+)/); if (m) resolve(Number(m[1])); });
  backendProc.on('exit', code => reject(new Error('fake backend exited early, code ' + code)));
  setTimeout(() => reject(new Error('timeout')), 5000);
});
const BACKEND = 'http://127.0.0.1:' + fakePort;
const fakeBundleSrc = readFileSync(LIB_DIR + '/fake_firebase_bundle.mjs', 'utf8').replace('__FAKE_FIREBASE_PORT__', String(fakePort));
const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
let reponseConfirm = true;
async function newPage() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/vendor/firebase.bundle.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fakeBundleSrc }));
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => { if (d.type() === 'confirm') { window__confirms.push(d.message()); reponseConfirm ? d.accept() : d.dismiss(); } else d.accept(); });
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return page;
}
const window__confirms = [];
async function waitFor(fn, { timeout = 20000, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await fn()) return true; await new Promise(r => setTimeout(r, 200)); }
  throw new Error('TIMEOUT en attendant : ' + label);
}
async function installerFauxPlugins(page) {
  await page.evaluate(() => {
    const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    window.__fs = {}; window.__docs = {}; window.__saveAsCalls = [];
    window.Capacitor = { Plugins: {
      Filesystem: {
        checkPermissions: async () => ({ publicStorage: 'granted' }), requestPermissions: async () => ({}),
        writeFile: async ({ path, data, directory }) => { window.__fs[directory + '/' + path] = b64ToBytes(data); return {}; },
        readFile: async ({ path, directory }) => { const b = window.__fs[directory + '/' + path]; if (!b) throw new Error('File does not exist'); return { data: new TextDecoder().decode(b) }; },
        readdir: async ({ directory }) => ({ files: Object.keys(window.__fs).filter(k => k.startsWith(directory + '/')).map(k => ({ name: k.slice(directory.length + 1) })) }),
        deleteFile: async ({ path, directory }) => { delete window.__fs[directory + '/' + path]; },
        getUri: async ({ path, directory }) => ({ uri: 'file:///fake/' + directory + '/' + path })
      },
      FileSaver: {
        saveAs: async (args) => {
          window.__saveAsCalls.push({ resumes: JSON.stringify(DB.resumesCampagne), campagne: DB.campagneDebut });
          const src = window.__fs[args.directory + '/' + args.path];
          const uri = 'content://fake/' + args.fileName;
          window.__docs[uri] = src.slice();
          return { ok: true, uri, taille: src.length, nom: 'Sauvegarde choisie.json' };
        },
        readUri: async ({ uri, asText }) => { const doc = window.__docs[uri]; return { ok: true, taille: doc.length, texte: asText ? new TextDecoder().decode(doc) : undefined }; }
      },
      Share: { share: async () => ({}) }
    } };
  });
}
const email = 'resume-' + Date.now() + '@ovilog-audit-jetable.test', password = 'AuditTest12345!';
async function connecter(page, creer) {
  await page.evaluate(async ({ email, pw, creer }) => { if (creer) await window.OvilogSync.signup(email, pw); else await window.OvilogSync.login(email, pw); }, { email, pw: password, creer });
  await waitFor(() => page.evaluate(() => window.OvilogSync.getState().loggedIn), { label: 'connexion' });
  await page.waitForTimeout(3000);   // synchro initiale stabilisée (voir BACKLOG.md)
}
const uidDe = async () => (await (await fetch(BACKEND + '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })).json()).uid;
const metaCloud = async (uid) => (await (await fetch(BACKEND + '/getdoc?uid=' + uid + '&col=meta&id=main')).json()).data;

// Pose un jeu de données puis attend que le cloud l'ait reçu ET que l'appareil l'ait toujours (un écho d'un ancien
// instantané peut sinon écraser la campagne posée -- voir BACKLOG.md, synchro dans la seconde qui suit une écriture).
async function poser(pg, uid, campagne, fn) {
  await pg.evaluate(fn);
  await pg.evaluate(() => saveData(DB));
  await waitFor(async () => { const m = await metaCloud(uid); return m && m.campagneDebut === campagne && (await pg.evaluate((c) => DB.campagneDebut === c, campagne)); }, { label: 'campagne ' + campagne + ' posée localement et dans le cloud' });
  await pg.waitForTimeout(1500);
  if (!(await pg.evaluate((c) => DB.campagneDebut === c, campagne))) throw new Error('FAIL (infra test) : la campagne posée a été écrasée par un écho de la synchro');
}
const page = await newPage();
await installerFauxPlugins(page);
await connecter(page, true);
const uid = await uidDe();
await page.evaluate(() => {
  window.eid = (c, n) => '2500162999' + c + String(n).padStart(4, '0');
  window.fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  // Jeu du bilan du 23/09 (voir test_bilan_calculs) : 296 + 67 mises bas, 427 nés, 38 morts, dont 3 + 1 agneaux adoptés
  window.jeu = () => {
    const plans = {
      adultes: { n: 296, doubles: 59, mortNes: 8, femelles: 175, males: 172, mortsF: 13, mortsM: 12, vides: 30, chiffres: [3, 4], adoptes: 3, entree: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }] },
      antenaises: { n: 67, doubles: 5, mortNes: 6, femelles: 38, males: 28, mortsF: 7, mortsM: 6, vides: 8, chiffres: [5], adoptes: 1, entree: [{ type: 'Entrée', cause: 'Renouvellement (agnelle devenue brebis)', date: '2025-10-01' }] }
    };
    const brebis = []; let c = 0, ji = 0;
    for (const nom of ['adultes', 'antenaises']) {
      const p = plans[nom];
      const sexes = [].concat(Array(p.mortNes).fill('Mort-né'), Array(p.femelles).fill('Femelle'), Array(p.males).fill('Mâle'));
      let mF = p.mortsF, mM = p.mortsM, ad = p.adoptes;
      const lambs = sexes.map(s => { const l = { sexe: s }; if (s === 'Femelle' && mF > 0) { l.statutFinal = 'mort'; l.mouvements = [{ type: 'Mort', date: '2026-02-20' }]; mF--; } else if (s === 'Mâle' && mM > 0) { l.statutFinal = 'mort'; l.mouvements = [{ type: 'Mort', date: '2026-02-21' }]; mM--; } else if (s === 'Mâle' && ad > 0) { l.adopte = true; l.adoptiveEid = 'x'; ad--; } return l; });
      let k = 0;
      for (let i = 0; i < p.n; i++) { const nb = i < p.doubles ? 2 : 1; const d = new Date(Date.UTC(2026, 0, 5 + (ji++ % 63))).toISOString().slice(0, 10); brebis.push(fiche(eid(p.chiffres[i % p.chiffres.length], ++c), { mouvements: p.entree, agnelages: [{ date: d, campagne: 2025, lambs: lambs.slice(k, k + nb) }] })); k += nb; }
      for (let i = 0; i < p.vides; i++) brebis.push(fiche(eid(p.chiffres[i % p.chiffres.length], ++c), { mouvements: p.entree }));
    }
    DB.campagneDebut = 2025; DB.campagneDateDemarrage = '2025-10-01'; DB.campagneInitialisee = true;
    DB.brebis = brebis; DB.beliers = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    DB.agnelles = [1, 2].map(i => ({ id: 'ag' + i, eid: eid(6, 700 + i), motherEid: null, pere: '', mere: '', sanitaire: [], modesRepro: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-02-10' }] }));
    DB.resumesCampagne = {};
  };
});

// ================================================================ 1. aller-retour
await page.evaluate(() => { jeu(); window.__saves = 0; const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); }; });
let r = await page.evaluate(() => {
  const avant = JSON.stringify(DB);
  const vif = bilanReproductionCampagne(2025);
  const resume = construireResumeCampagne(2025, { type: 'calcul-ovilog', libelle: 'test' });
  const relu = bilanDepuisResume(JSON.parse(JSON.stringify(resume)));
  const json = JSON.stringify(resume);
  return {
    taille: json.length, ratios: /prolificite|mortalite|mortinatalite|fertilite|pctDoubles/.test(JSON.stringify(resume.groupes)), cles: Object.keys(resume).sort().join(),
    memes: JSON.stringify(vif.groupes) === JSON.stringify(relu.groupes), memesKpi: JSON.stringify(vif.kpis) === JSON.stringify(relu.kpis),
    memesMv: JSON.stringify(vif.mouvements) === JSON.stringify(relu.mouvements) && JSON.stringify(vif.actifs) === JSON.stringify(relu.actifs),
    memesSem: JSON.stringify(vif.semaines) === JSON.stringify(relu.semaines) && JSON.stringify(vif.parMillesime) === JSON.stringify(relu.parMillesime),
    titre: relu.periode.titre, adoptes: [vif.groupes.adultes.adoptes, vif.groupes.antenaises.adoptes, vif.groupes.total.adoptes],
    intact: JSON.stringify(DB) === avant, saves: window.__saves, depuis: relu.depuisResume, mis: relu.groupes.total.misesBas
  };
});
check(r.memes && r.memesKpi && r.memesMv && r.memesSem, 'aller-retour résumé -> bilan identique au calcul vivant (groupes, KPI, mouvements, actifs, courbe, millésimes) : ' + JSON.stringify(r));
check(r.taille < 12000 && !r.ratios, 'taille ' + r.taille + ' caractères (< 12 000), aucun ratio de groupe stocké (recalculés à la lecture)');
check(r.adoptes.join() === '3,1,4', 'adoptés comptés pour les campagnes futures : 3 / 1 / 4 : ' + r.adoptes);
check(r.titre === 'du 01/10/2025 au 30/09/2026' && r.depuis && r.mis === 363 && r.intact && r.saves === 0, 'titre « du 01/10/2025 au 30/09/2026 », 363 mises bas, aucune écriture');
console.log('OK 1 résumé : aller-retour identique au calcul vivant (' + r.taille + ' caractères, aucun ratio stocké), adoptés 3/1/4 calculés, aucune écriture.');

// ================================================================ 2. migrateData + synchro meta
r = await page.evaluate(() => ({ nul: migrateData({ resumesCampagne: null }).resumesCampagne, tab: migrateData({ resumesCampagne: [] }).resumesCampagne, absent: migrateData({}).resumesCampagne, garde: migrateData({ resumesCampagne: { 2025: { x: 1 } } }).resumesCampagne }));
check(JSON.stringify(r.nul) === '{}' && JSON.stringify(r.tab) === '{}' && JSON.stringify(r.absent) === '{}' && r.garde['2025'].x === 1, 'migrateData : resumesCampagne toujours un objet, valeur existante conservée : ' + JSON.stringify(r));
await page.evaluate(() => { DB.resumesCampagne = { 2025: construireResumeCampagne(2025, { type: 'calcul-ovilog', libelle: 'test' }) }; saveData(DB); });
await waitFor(async () => { const m = await metaCloud(uid); return m && m.resumesCampagne && m.resumesCampagne['2025'] && m.resumesCampagne['2025'].libelle === 2026; }, { label: 'résumé dans meta (cloud)' });
const page2 = await newPage();
await installerFauxPlugins(page2);
await connecter(page2, false);
await waitFor(() => page2.evaluate(() => !!(DB.resumesCampagne && DB.resumesCampagne['2025'])), { label: '2e appareil reçoit le résumé' });
check(await page2.evaluate(() => DB.resumesCampagne['2025'].groupes.adultes.misesBas) === 296, '2e appareil : résumé reçu (296 mises bas adultes)');
await page2.context().close();
console.log('OK 2 migrateData (objet garanti) ; le résumé est synchronisé dans meta et reçu par un 2e appareil.');

// ================================================================ 3. bascule
await poser(page, uid, 2025, () => jeu());
await page.evaluate(() => { window.__saveAsCalls = []; });
const bilanAvant = await page.evaluate(() => JSON.stringify(bilanReproductionCampagne(2025).groupes));
reponseConfirm = true; window__confirms.length = 0;
let res = await page.evaluate(async () => await executerChangementCampagne());
check(res.ok, 'bascule avec mises bas : ' + JSON.stringify(res));
let etat = await page.evaluate(() => ({ N: DB.campagneDebut, resume: DB.resumesCampagne['2025'], appels: window.__saveAsCalls }));
check(etat.N === 2026 && etat.resume && etat.resume.source.type === 'calcul-ovilog' && etat.resume.groupes.adultes.misesBas === 296 && etat.resume.groupes.antenaises.misesBas === 67, 'résumé figé à la bascule (campagne 2025 = « 2026 ») : 296 + 67 mises bas');
check(etat.appels.length === 1 && etat.appels[0].resumes === '{}' && etat.appels[0].campagne === 2025, 'l\'export visible a lieu AVANT la création du résumé et avant toute modification (au moment de l\'export : pas de résumé, campagne encore 2025)');
check(JSON.stringify(await page.evaluate(() => bilanDepuisResume(DB.resumesCampagne['2025']).groupes)) === bilanAvant, 'les chiffres figés sont ceux d\'AVANT la bascule');
check(window__confirms.length === 0, 'aucune alerte quand il y a des mises bas');
await waitFor(async () => { const m = await metaCloud(uid); return m && m.resumesCampagne && m.resumesCampagne['2025']; }, { label: 'résumé de bascule dans meta' });
// jamais écrasé : un résumé existant pour la campagne qui se termine reste identique
await page.evaluate(() => {
  DB.brebis.slice(0, 3).forEach(b => b.agnelages.push({ date: '2027-01-10', campagne: 2026, lambs: [{ sexe: 'Mâle' }] }));
  DB.resumesCampagne['2026'] = { campagne: 2026, libelle: 2027, periode: { debut: '2026-10-01', fin: '2027-09-30' }, source: { type: 'bilan-externe', libelle: 'saisi à la main' }, groupes: { adultes: { misesBas: 1 } } };
  window.__avant2026 = JSON.stringify(DB.resumesCampagne['2026']);
});
res = await page.evaluate(async () => await executerChangementCampagne());
check(res.ok && await page.evaluate(() => JSON.stringify(DB.resumesCampagne['2026']) === window.__avant2026 && DB.campagneDebut === 2027), 'un résumé existant n\'est jamais écrasé par la bascule');
console.log('OK 3a bascule : résumé figé après l\'export visible et avant toute modification (296 + 67), chiffres d\'avant la bascule, synchronisé ; un résumé existant n\'est jamais écrasé.');

// ---- garde « aucune mise bas »
await poser(page, uid, 2025, () => { jeu(); DB.brebis.forEach(b => b.agnelages = []); });
await page.evaluate(() => { window.__saveAsCalls = []; });
const dbAvant = await page.evaluate(() => JSON.stringify(DB));
reponseConfirm = false; window__confirms.length = 0;
res = await page.evaluate(async () => await executerChangementCampagne());
check(res.annule === true && res.ok === false && /aucune mise bas enregistrée pour la campagne 2026/.test(res.raison), 'garde 0 mise bas, Annuler : bascule interrompue : ' + JSON.stringify(res));
const apresAnnul = await page.evaluate(() => ({ db: JSON.stringify(DB), appels: window.__saveAsCalls.length, verrous: campagneChangeEnCours === false && operationGroupeeEnCours === false }));
let diffPos = apresAnnul.db === dbAvant ? -1 : [...apresAnnul.db].findIndex((c, i) => c !== dbAvant[i]);
check(apresAnnul.db === dbAvant && apresAnnul.appels === 0 && apresAnnul.verrous, 'Annuler : rien modifié, aucune sauvegarde demandée, verrous libérés : ' + JSON.stringify({ memeDB: apresAnnul.db === dbAvant, appels: apresAnnul.appels, verrous: apresAnnul.verrous, diff: diffPos >= 0 ? dbAvant.slice(Math.max(0, diffPos - 80), diffPos + 60) + ' => ' + apresAnnul.db.slice(Math.max(0, diffPos - 80), diffPos + 60) : null }));
check(window__confirms.length === 1 && /Aucune mise bas n'est enregistrée pour la campagne 2026/.test(window__confirms[0]) && /SANS résumé/.test(window__confirms[0]), 'alerte « 0 mise bas » : ' + window__confirms[0]);
reponseConfirm = true;
res = await page.evaluate(async () => await executerChangementCampagne());
check(res.ok && await page.evaluate(() => DB.campagneDebut === 2026 && !DB.resumesCampagne['2025']), 'garde 0 mise bas, OK : la bascule continue SANS résumé (aucun résumé vide créé)');
console.log('OK 3b garde « aucune mise bas » : Annuler = bascule interrompue, rien modifié, aucun export ; OK = bascule sans résumé.');

console.log('\nTOUS LES TESTS DU RÉSUMÉ DE CAMPAGNE SONT PASSÉS (faux backend, faux plugins, aucune donnée réelle)');
await browser.close();
process.exit(0);
