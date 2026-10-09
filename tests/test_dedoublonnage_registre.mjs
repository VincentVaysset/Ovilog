/* Dédoublonnage du registre (Paramètres > Campagne > « Doublons du registre »)
   et fusion d'archivage par comptage d'occurrences.
   1. Fusion de l'archivage (fusionnerElementsRegistre / archiverDansRegistre) :
      [a] + [a,a] -> [a,a] ; [a,a] + [a,a] -> inchangé ; rejeu = idempotent ;
      égalité exacte indépendante de l'ordre des clés, null == absent.
   2. Analyse en lecture seule (aucun saveData, aucune écriture cloud).
   3. Écran : lignes cochées par défaut (exactement 2 occurrences, mouvements /
      agnelages), le reste listé à part et décoché, « avant -> après » (4 -> 2).
   4. Application : annulation / échec de l'export visible = rien de modifié ;
      succès = doublons retirés, ordre conservé, fiches intactes, cloud = local,
      journal, 2e appareil convergent ; cases « à vérifier » cochées ; garde
      « modifiée ailleurs » ; échec d'écriture d'une entrée sans bloquer les autres.
   5. Export réel (SKIP si absent) : 115 entrées / 230 éléments dans registre.agnelles,
      bilans, effectif et fiches identiques avant/après.
   Faux backend Firestore + faux plugins natifs -- aucune donnée réelle écrite. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_CORRIGE, EXPORT_ORIGINAL, exportPresent } from './lib/config.mjs';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const backendProc = spawn('node', [LIB_DIR + '/fake_firebase_backend.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
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
const BACKEND = 'http://127.0.0.1:' + fakePort;
const fakeBundleSrc = readFileSync(LIB_DIR + '/fake_firebase_bundle.mjs', 'utf8').replace('__FAKE_FIREBASE_PORT__', String(fakePort));
const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : (v && typeof v === 'object') ? '{' + Object.keys(v).filter(k => v[k] !== undefined && v[k] !== null).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v);
const CHAMPS = ['sanitaire', 'agnelages', 'mouvements', 'echographies', 'controleLaitier', 'modesRepro'];

async function newPage() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/vendor/firebase.bundle.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fakeBundleSrc }));
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return page;
}
async function waitFor(fn, { timeout = 20000, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await fn()) return true; await new Promise(r => setTimeout(r, 200)); }
  throw new Error('TIMEOUT en attendant : ' + label);
}
async function installerFauxPlugins(page) {
  await page.evaluate(() => {
    const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    window.__fs = {}; window.__docs = {}; window.__mode = 'ok'; window.__saveAsCalls = [];
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
          window.__saveAsCalls.push({ args, registreJson: JSON.stringify(DB.registre) });
          if (window.__mode === 'cancel') return { ok: false, cancelled: true };
          if (window.__mode === 'fail') return { ok: false, raison: "l'écriture dans l'emplacement choisi a échoué (simulé)" };
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
async function connecter(page, email, password, creer) {
  await page.evaluate(async ({ email, pw, creer }) => { if (creer) await window.OvilogSync.signup(email, pw); else await window.OvilogSync.login(email, pw); }, { email, pw: password, creer });
  await waitFor(() => page.evaluate(() => window.OvilogSync.getState().loggedIn), { label: 'connexion' });
  // Laisse la synchro initiale (abonnements, migration du registre, premiers instantanés du faux backend) se stabiliser :
  // un instantané « vide » reçu juste APRÈS une première écriture locale est traité comme une suppression distante
  // (journal du faux backend : delete des documents du registre, réécrits ~1,7 s plus tard).
  await page.waitForTimeout(3000);
}
const email = 'dedoublonnage-' + Date.now() + '@ovilog-audit-jetable.test';
const password = 'AuditTest12345!';
let uid = null;
const cloudDocs = async () => (await (await fetch(BACKEND + '/snapshot?uid=' + uid + '&col=registre')).json()).docs;
const cloudVersion = async () => (await (await fetch(BACKEND + '/snapshot?uid=' + uid + '&col=registre')).json()).version;
const idDoc = (cat, eid) => cat + '_' + eid.replace(/\s+/g, '');
async function cloudEgalLocal(page, nAttendu) {
  const local = await page.evaluate(() => JSON.parse(JSON.stringify(DB.registre)));
  const docs = await cloudDocs();
  let n = 0;
  for (const cat of ['brebis', 'beliers', 'agnelles']) for (const eid of Object.keys(local[cat] || {})) {
    n++;
    const d = docs[idDoc(cat, eid)];
    if (!d) return false;
    if (!CHAMPS.every(c => canon(d[c] || []) === canon(local[cat][eid][c] || []))) return false;
  }
  return n === Object.keys(docs).length && (nAttendu === undefined || n === nAttendu);
}

// ---------------------------------------------------------------- données synthétiques
const SYNTH = () => {
  const m1 = { type: 'Entrée', cause: 'Naissance', date: '2026-01-10' };
  const m1b = { date: '2026-01-10', cause: 'Naissance', type: 'Entrée' };                 // même élément, clés dans un autre ordre
  const m2 = { type: 'Vente', cause: null, acheteur: 'X', date: '2026-05-02', collectifId: null };
  const m3 = { type: 'Vente', cause: null, acheteur: 'Y', date: '2026-06-01' };
  const m4 = { type: 'Morte', cause: 'Maladie', date: '2026-03-03' };
  const m5 = { type: 'Perte', cause: 'Accident', date: '2026-03-04' };
  const m6 = { type: 'Vente', cause: null, acheteur: 'Z', date: '2026-04-04' };
  const ag1 = { date: '2026-02-01', campagne: 2025, lambs: [{ sexe: 'Mâle' }, { sexe: 'Femelle' }] };
  const s1 = { produit: 'Vermifuge', date: '2026-02-15' };
  const ec = { date: '2025-12-01', resultat: 'gestante' };
  return { registre: {
    brebis: {
      '250016299930001': { eid: '250016299930001', mouvements: [m3, m3, m3, m3], agnelages: [ag1, ag1], sanitaire: [s1, s1], echographies: [ec, ec], controleLaitier: [], modesRepro: [], derniereMiseAJour: 1700000000000 },
      '250016299930002': { eid: '250016299930002', mouvements: [m4, m5, m4, m4], agnelages: [], sanitaire: [], echographies: [], controleLaitier: [], modesRepro: [] },
      '250016299930003': { eid: '250016299930003', mouvements: [m1, { type: 'Vente', cause: 'x', date: '2026-07-07' }, { type: 'Vente', cause: 'y', date: '2026-07-07' }], agnelages: [], sanitaire: [], echographies: [], controleLaitier: [], modesRepro: [] }
    },
    beliers: { '250016299930090': { eid: '250016299930090', mouvements: [m6, m6], sanitaire: [], agnelages: [], echographies: [], controleLaitier: [], modesRepro: [] } },
    agnelles: {
      '250016299930011': { eid: '250016299930011', mouvements: [m1, m2, m1b, m2], sanitaire: [], agnelages: [], echographies: [], controleLaitier: [], modesRepro: [] },
      '250016299930012': { eid: '250016299930012', mouvements: [m1], sanitaire: [], agnelages: [], echographies: [], controleLaitier: [], modesRepro: [] }
    }
  } };
};
const FICHES = () => ({
  brebis: [{ id: 's1', eid: '250016299930001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2026-01-01' }], controleLaitier: [], modesRepro: [] }],
  beliers: [], agnelles: [{ id: 'a1', eid: '250016299930099', motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [], modesRepro: [] }]
});

// ================================================================ 1. fusion de l'archivage
const page = await newPage();
await installerFauxPlugins(page);
await connecter(page, email, password, true);
uid = (await (await fetch(BACKEND + '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })).json()).uid;

let r = await page.evaluate(() => {
  const a = { t: 'a', d: '1' }, b = { t: 'b', d: '2' };
  const f = fusionnerElementsRegistre;
  const out = {
    un: f([a], [a, a]).length, deux: f([a, a], [a, a]).length, zero: f([], [a, a]).length,
    ordre: f([b], [a, b, a]).map(x => x.t).join(''),            // b déjà là -> a, a ajoutés après
    egal: canonJson({ x: 1, y: { p: 1, q: [1, 2] } }) === canonJson({ y: { q: [1, 2], p: 1 }, x: 1 }),
    nullAbsent: canonJson({ x: 1, z: null }) === canonJson({ x: 1 }) && canonJson({ x: 1, z: undefined }) === canonJson({ x: 1 }),
    diff: canonJson({ x: 1 }) !== canonJson({ x: 2 })
  };
  // archivage rejoué : 2 fois les mêmes données = 1 fois ; nouvelles données ajoutées ; répétition interne conservée
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  const mv = [{ type: 'Entrée', date: '2026-01-01' }, { type: 'Vente', date: '2026-02-02' }];
  archiverDansRegistre('agnelles', 'E1', { mouvements: mv });
  archiverDansRegistre('agnelles', 'E1', { mouvements: mv });
  out.rejeu = DB.registre.agnelles.E1.mouvements.length;
  archiverDansRegistre('agnelles', 'E1', { mouvements: mv.concat([{ type: 'Perte', date: '2026-03-03' }]) });
  out.nouveau = DB.registre.agnelles.E1.mouvements.length;
  archiverDansRegistre('brebis', 'E2', { sanitaire: [{ p: 'v', d: '1' }, { p: 'v', d: '1' }] });
  out.interne = DB.registre.brebis.E2.sanitaire.length;
  archiverDansRegistre('brebis', 'E2', { sanitaire: [{ p: 'v', d: '1' }, { p: 'v', d: '1' }] });
  out.interneRejeu = DB.registre.brebis.E2.sanitaire.length;
  return out;
});
check(r.un === 2 && r.deux === 2 && r.zero === 2, 'comptage : [a]+[a,a] -> 2 (1 ajouté), [a,a]+[a,a] -> 2 (0 ajouté), []+[a,a] -> 2 ; obtenu ' + JSON.stringify(r));
check(r.ordre === 'baa', 'ordre existant préservé, ajouts à la suite : ' + r.ordre);
check(r.egal && r.nullAbsent && r.diff, 'égalité exacte : indépendante de l\'ordre des clés, null == absent, valeurs différentes distinctes');
check(r.rejeu === 2 && r.nouveau === 3 && r.interne === 2 && r.interneRejeu === 2, 'archivage rejoué idempotent, nouveauté ajoutée, répétition interne conservée : ' + JSON.stringify(r));
console.log('OK 1 fusion par comptage : [a]+[a,a] ajoute 1 ; [a,a]+[a,a] ajoute 0 ; []+[a,a] ajoute 2 ; archivage rejoué = idempotent ; clés dans un autre ordre / null == absent reconnus ; répétition interne conservée.');

// ================================================================ 2. analyse en lecture seule
await page.evaluate(({ s, f }) => { Object.assign(DB, f); DB.registre = s.registre; DB.campagneDebut = 2026; DB.campagneInitialisee = true; saveData(DB); window.__saves = 0; const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); }; }, { s: SYNTH(), f: FICHES() });
await waitFor(() => cloudEgalLocal(page, 6), { label: 'registre synthétique dans le cloud' });
await page.waitForTimeout(800); // laisse retomber les écritures de synchro déclenchées par la mise en place du jeu de test
await page.evaluate(() => { window.__saves = 0; });
const dbAvant = await page.evaluate(() => JSON.stringify(DB));
const versionAvant = await cloudVersion();
const analyse = await page.evaluate(() => analyserDoublonsRegistre());
const L = (cat, champ) => analyse.lignes.filter(l => l.categorie === cat && l.champ === champ);
check(analyse.nbEntrees === 4 && analyse.lignes.length === 8, '4 entrées / 8 lignes attendues, obtenu ' + analyse.nbEntrees + ' / ' + analyse.lignes.length);
const defauts = analyse.lignes.filter(l => l.parDefaut);
check(defauts.length === 4 && defauts.every(l => l.avant === 2 && l.apres === 1 && ['mouvements', 'agnelages'].includes(l.champ)), 'cochées par défaut = 4 lignes à exactement 2 occurrences (mouvements/agnelages) : ' + JSON.stringify(defauts.map(l => [l.categorie, l.champ, l.avant])));
check(L('agnelles', 'mouvements').length === 2, 'clés dans un autre ordre reconnues comme identiques (agnelle : 2 éléments distincts x2)');
const quatre = analyse.lignes.find(l => l.champ === 'mouvements' && l.avant === 4);
const trois = analyse.lignes.find(l => l.champ === 'mouvements' && l.avant === 3);
check(quatre && quatre.apres === 2 && !quatre.parDefaut && /4 occurrences/.test(quatre.motif), '4 occurrences -> 2 (pas 1), décochée : ' + JSON.stringify(quatre));
check(trois && trois.apres === 2 && !trois.parDefaut, '3 occurrences -> 2, décochée');
check(L('brebis', 'sanitaire').length === 1 && !L('brebis', 'sanitaire')[0].parDefaut && /sanitaire/.test(L('brebis', 'sanitaire')[0].motif), 'carnet sanitaire : listé à part, décoché');
check(L('brebis', 'echographies').length === 1 && !L('brebis', 'echographies')[0].parDefaut, 'autre champ (échographies) : listé à part, décoché');
check(!analyse.lignes.some(l => l.eid === '250016299930003' || l.eid === '250016299930012'), 'aucun faux positif : mêmes dates mais causes différentes ; même élément dans deux entrées différentes');
const dbApres = await page.evaluate(() => JSON.stringify(DB)), savesApres = await page.evaluate(() => window.__saves), vApres = await cloudVersion();
check(dbApres === dbAvant && savesApres === 0 && vApres === versionAvant, 'analyse en lecture seule : DB identique (' + (dbApres === dbAvant) + '), 0 saveData (' + savesApres + '), 0 écriture cloud (' + versionAvant + ' -> ' + vApres + ')');
console.log('OK 2 analyse : 4 entrées / 8 lignes ; 4 cochées (2 occurrences, mouvements/agnelages) ; 4 -> 2 et 3 -> 2 décochées ; sanitaire et échographies à part ; aucun faux positif ; lecture seule (DB, saveData, cloud).');

// ================================================================ 3. écran
async function ouvrirCarte() {
  await page.evaluate(() => { parametresTab = 'campagne'; parametresRubrique = 'campagne'; render('parametres'); });
  await page.waitForSelector('#dd-registre-zone', { state: 'attached' });
}
async function etatEcran() {
  return await page.evaluate(() => ({
    lignes: document.querySelectorAll('.dd-check').length,
    cochees: [...document.querySelectorAll('.dd-check')].filter(c => c.checked).length,
    bouton: document.getElementById('btn-dd-appliquer') ? document.getElementById('btn-dd-appliquer').textContent : null,
    boutonDisabled: document.getElementById('btn-dd-appliquer') ? document.getElementById('btn-dd-appliquer').disabled : null,
    statut: document.getElementById('dd-registre-status') ? document.getElementById('dd-registre-status').textContent : null,
    texte: document.getElementById('dd-registre-zone').textContent
  }));
}
await ouvrirCarte();
let e = await etatEcran();
check(e.lignes === 0 && await page.$('#btn-dd-analyser'), 'avant analyse : seul le bouton « Rechercher » est affiché');
await page.click('#btn-dd-analyser');
e = await etatEcran();
check(e.lignes === 8 && e.cochees === 4 && /Dédoublonner \(4 éléments à retirer\)/.test(e.bouton) && /4 → 2/.test(e.texte), 'écran : 8 lignes, 4 cochées, bouton « 4 éléments à retirer », ligne « 4 → 2 » : ' + JSON.stringify({ l: e.lignes, c: e.cochees, b: e.bouton }));
check(/Doublons exacts/.test(e.texte) && /À vérifier/.test(e.texte), 'deux sections (exacts / à vérifier)');
await page.click('.dd-tout[data-section="verifier"][data-val="1"]');
e = await etatEcran();
check(e.cochees === 8 && /9 éléments à retirer/.test(e.bouton), 'cocher la section « à vérifier » : 8 cochées, 4 + 5 = 9 éléments à retirer : ' + e.bouton);
await page.click('.dd-tout[data-section="verifier"][data-val="0"]');
await page.click('.dd-tout[data-section="exacts"][data-val="0"]');
e = await etatEcran();
check(e.cochees === 0 && e.boutonDisabled === true && /Aucune ligne cochée/.test(e.bouton), 'tout décocher : bouton désactivé');
await page.click('.dd-tout[data-section="exacts"][data-val="1"]');
e = await etatEcran();
check(e.cochees === 4 && !e.boutonDisabled, 'recocher les exacts : 4 cochées');
console.log('OK 3 écran : 8 lignes, 4 cochées par défaut, compteur du bouton (4, puis 9 avec « à vérifier », puis désactivé à 0), lignes « 4 → 2 », deux sections.');

// ================================================================ 4. annulation / échec : rien n'est modifié
async function instantane() { return { db: await page.evaluate(() => JSON.stringify(DB)), v: await cloudVersion(), docs: JSON.stringify(await cloudDocs()) }; }
let avant = await instantane();
for (const [mode, motif] of [['cancel', /annulé/], ['fail', /sauvegarde a échoué/]]) {
  await page.evaluate((m) => { window.__mode = m; window.__saveAsCalls = []; }, mode);
  await page.click('#btn-dd-appliquer');
  await waitFor(() => page.evaluate(() => !dedoublonRegistreEnCours), { label: 'verrou libéré (' + mode + ')' });
  await page.waitForTimeout(150);
  e = await etatEcran();
  const apres = await instantane();
  check(motif.test(e.statut) && /Rien n'a été modifié/.test(e.statut), mode + ' : message clair, rien modifié : ' + e.statut);
  check(apres.db === avant.db && apres.v === avant.v && apres.docs === avant.docs, mode + ' : DB et cloud strictement identiques');
  check(!e.boutonDisabled && await page.evaluate(() => dedoublonRegistreEnCours === false), mode + ' : verrou libéré, bouton de nouveau actif');
}
console.log('OK 4 annulation et échec de l\'export visible : message clair, DB et cloud strictement identiques, verrou libéré.');

// ================================================================ 5. succès (cases par défaut)
await page.evaluate(() => { window.__mode = 'ok'; window.__saveAsCalls = []; });
const registreAvant = await page.evaluate(() => JSON.parse(JSON.stringify(DB.registre)));
const fichesAvant = await page.evaluate(() => JSON.stringify([DB.brebis, DB.beliers, DB.agnelles]));
await page.click('#btn-dd-appliquer');
await waitFor(() => page.evaluate(() => !dedoublonRegistreEnCours && /✅|⚠️/.test(doublonsRegistreEtat.message)), { label: 'dédoublonnage terminé' });
e = await etatEcran();
check(/✅ 4 élément\(s\) retiré\(s\) dans 3 entrée\(s\)/.test(e.statut), 'message de réussite : ' + e.statut);
const saves = await page.evaluate(() => window.__saveAsCalls);
check(saves.length === 1 && saves[0].registreJson === JSON.stringify(registreAvant), 'l\'export visible a été demandé UNE fois, AVANT toute modification (registre intact au moment de l\'appel)');
const reg = await page.evaluate(() => JSON.parse(JSON.stringify(DB.registre)));
const seq = (a) => JSON.stringify(a);
check(reg.agnelles['250016299930011'].mouvements.length === 2 && reg.agnelles['250016299930011'].mouvements[0].type === 'Entrée' && reg.agnelles['250016299930011'].mouvements[1].type === 'Vente', 'agnelle : 4 -> 2 mouvements, première occurrence gardée, ordre conservé');
check(reg.brebis['250016299930001'].agnelages.length === 1 && reg.beliers['250016299930090'].mouvements.length === 1, 'brebis agnelages 2 -> 1 ; bélier 2 -> 1');
check(reg.brebis['250016299930001'].mouvements.length === 4 && reg.brebis['250016299930001'].sanitaire.length === 2 && reg.brebis['250016299930001'].echographies.length === 2 && reg.brebis['250016299930002'].mouvements.length === 4, 'lignes décochées (4 occurrences, sanitaire, échographies, 3 occurrences) : intactes');
check(reg.agnelles['250016299930012'].mouvements.length === 1 && reg.brebis['250016299930003'].mouvements.length === 3, 'entrées sans doublon : intactes');
check(reg.brebis['250016299930001'].derniereMiseAJour === 1700000000000, 'derniereMiseAJour inchangée');
for (const cat of ['brebis', 'beliers', 'agnelles']) for (const eid of Object.keys(reg[cat])) for (const c of CHAMPS) {
  const distAvant = new Set((registreAvant[cat][eid][c] || []).map(canon)), distApres = new Set((reg[cat][eid][c] || []).map(canon));
  check(seq([...distAvant].sort()) === seq([...distApres].sort()), 'ensemble des éléments distincts inchangé : ' + cat + ' ' + eid + ' ' + c);
}
check(await page.evaluate(() => JSON.stringify([DB.brebis, DB.beliers, DB.agnelles])) === fichesAvant, 'fiches brebis / béliers / agnelles identiques octet pour octet');
const j = await page.evaluate(() => DB.journalRegistre[0]);
check(j.action === 'dedoublonnage_registre' && j.elementsRetires === 4 && j.eidsArchives.length === 3 && j.echecs.length === 0, 'journal : ' + JSON.stringify(j));
await waitFor(() => cloudEgalLocal(page, 6), { label: 'cloud = local après dédoublonnage' });
check(e.lignes === 4 && e.cochees === 0, 'analyse relancée : ne restent que les 4 lignes à vérifier (décochées) : ' + e.lignes + '/' + e.cochees);
// 2e appareil
const page2 = await newPage();
await installerFauxPlugins(page2);
await connecter(page2, email, password, false);
await waitFor(() => page2.evaluate((n) => DB.registre && DB.registre.agnelles && DB.registre.agnelles['250016299930011'] && DB.registre.agnelles['250016299930011'].mouvements.length === n, 2), { label: '2e appareil converge' });
check(await page2.evaluate(() => JSON.stringify(DB.registre)) === await page.evaluate(() => JSON.stringify(DB.registre)), '2e appareil : registre identique');
await page2.context().close();
console.log('OK 5 succès : 4 éléments retirés dans 3 entrées, export visible AVANT toute modification, ordre et premières occurrences conservés, lignes décochées et entrées sans doublon intactes, éléments distincts identiques, fiches identiques, journal, cloud = local, 2e appareil convergent.');

// deuxième passage : « Aucun doublon » une fois tout traité
await page.evaluate(() => { for (const l of doublonsRegistreEtat.analyse.lignes) doublonsRegistreEtat.coches[l.id] = true; });
await ouvrirCarte();
e = await etatEcran();
check(e.cochees === 4, 'après re-rendu, l\'état (lignes à vérifier) est conservé');
await page.click('.dd-tout[data-section="verifier"][data-val="1"]');
await page.click('#btn-dd-appliquer');
await waitFor(() => page.evaluate(() => !dedoublonRegistreEnCours && /retiré/.test(doublonsRegistreEtat.message)), { label: 'passage 2' });
const reg2 = await page.evaluate(() => JSON.parse(JSON.stringify(DB.registre)));
check(reg2.brebis['250016299930001'].mouvements.length === 2 && reg2.brebis['250016299930001'].sanitaire.length === 1 && reg2.brebis['250016299930001'].echographies.length === 1, 'cases « à vérifier » cochées : 4 occurrences -> 2 (pas 1), sanitaire 2 -> 1, échographies 2 -> 1');
check(reg2.brebis['250016299930002'].mouvements.length === 3 && reg2.brebis['250016299930002'].mouvements.map(m => m.type).join() === 'Morte,Perte,Morte', '3 occurrences -> 2, ordre conservé (Morte, Perte, Morte)');
e = await etatEcran();
check(/retiré/.test(e.statut), e.statut);
await page.click('#btn-dd-analyser');
e = await etatEcran();
check(e.lignes === 2 && !/Aucun doublon/.test(e.texte), 'reste 2 lignes à 2 occurrences issues des « 4 -> 2 » et « 3 -> 2 » (conformes à la règle ⌈n/2⌉)');
console.log('OK 5b cases « à vérifier » : 4 -> 2 (pas 1), 3 -> 2, sanitaire 2 -> 1, échographies 2 -> 1 ; l\'état de l\'écran survit à un re-rendu.');

// ================================================================ 6. garde « modifiée ailleurs » + échec d'écriture
// Re-pose l'état synthétique en ÉCRIVANT DANS LE CLOUD (comme un autre appareil) puis attend que cet appareil le reçoive :
// poser DB.registre en local puis saveData serait en course avec l'écho d'un ancien instantané.
async function reposerRegistre() {
  await fetch(BACKEND + '/batch', { method: 'POST', body: JSON.stringify({ uid, ops: Object.entries(SYNTH().registre).flatMap(([cat, m]) => Object.entries(m).map(([eid, ent]) => ({ type: 'set', path: 'users/' + uid + '/registre/' + idDoc(cat, eid), data: Object.assign({ id: idDoc(cat, eid), categorie: cat, eid }, ent) }))) }) });
  await waitFor(() => page.evaluate(() => DB.registre.agnelles['250016299930011'].mouvements.length === 4 && !!DB.registre.beliers['250016299930090'] && DB.registre.brebis['250016299930001'].agnelages.length === 2 && DB.registre.brebis['250016299930001'].mouvements.length === 4), { label: 'registre synthétique re-posé (reçu du cloud)' });
  await waitFor(() => cloudEgalLocal(page, 6), { label: 'cloud = local' });
}
await reposerRegistre();
await ouvrirCarte();
await page.click('#btn-dd-analyser');
// l'écho du cloud est coupé : cet appareil ne voit pas les modifications faites ailleurs
await page.route('**/snapshot?*', route => route.abort());
const docs0 = await cloudDocs();
const idA1 = idDoc('agnelles', '250016299930011'), idBel = idDoc('beliers', '250016299930090'), idB1 = idDoc('brebis', '250016299930001');
const modifie = JSON.parse(JSON.stringify(docs0[idA1]));
modifie.mouvements.push({ type: 'Perte', cause: 'ajouté ailleurs', date: '2026-08-08' });
await fetch(BACKEND + '/batch', { method: 'POST', body: JSON.stringify({ uid, ops: [
  { type: 'set', path: 'users/' + uid + '/registre/' + idA1, data: modifie },
  { type: 'delete', path: 'users/' + uid + '/registre/' + idBel }
] }) });
await page.evaluate(() => { window.__mode = 'ok'; });
const localA1 = await page.evaluate(() => JSON.stringify(DB.registre.agnelles['250016299930011']));
await page.click('#btn-dd-appliquer');
await waitFor(() => page.evaluate(() => !dedoublonRegistreEnCours && /✅|⚠️/.test(doublonsRegistreEtat.message)), { label: 'passage garde' });
e = await etatEcran();
check(/⚠️/.test(e.statut) && (e.statut.match(/modifiée ailleurs/g) || []).length === 2 && /1 élément\(s\) retiré\(s\) dans 1 entrée\(s\)/.test(e.statut), 'garde : 2 entrées refusées « modifiée ailleurs », 1 traitée : ' + e.statut);
check(await page.evaluate(() => JSON.stringify(DB.registre.agnelles['250016299930011'])) === localA1, 'entrée refusée : copie locale intacte');
const docs1 = await cloudDocs();
check(canon(docs1[idA1].mouvements) === canon(modifie.mouvements) && !docs1[idBel], 'cloud : la modification faite ailleurs n\'a PAS été écrasée, le document supprimé ailleurs n\'a pas été recréé');
check(docs1[idB1].agnelages.length === 1, 'l\'entrée non touchée ailleurs a bien été dédoublonnée dans le cloud');
await page.unroute('**/snapshot?*');
console.log('OK 6a garde concurrente : modification ailleurs et suppression ailleurs refusées (« modifiée ailleurs »), rien écrasé ni recréé, l\'entrée intacte ailleurs est traitée.');

// reposer l'état synthétique (écho rétabli), puis échec d'écriture réseau sur une seule entrée
await reposerRegistre();
await ouvrirCarte();
await page.click('#btn-dd-analyser');
await page.route('**/batch', async (route, request) => {
  const body = request.postDataJSON();
  if ((body.ops || []).some(op => op.path && op.path.endsWith('/registre/' + idA1))) { await route.abort(); return; }
  await route.continue();
});
await page.click('#btn-dd-appliquer');
await waitFor(() => page.evaluate(() => !dedoublonRegistreEnCours && /✅|⚠️/.test(doublonsRegistreEtat.message)), { label: 'passage échec écriture' });
await page.unroute('**/batch');
e = await etatEcran();
const regE = await page.evaluate(() => JSON.parse(JSON.stringify(DB.registre)));
check(/⚠️/.test(e.statut) && /l'écriture du document registre a échoué/.test(e.statut), 'échec d\'écriture signalé avec sa raison : ' + e.statut);
check(regE.agnelles['250016299930011'].mouvements.length === 4 && regE.brebis['250016299930001'].agnelages.length === 1 && regE.beliers['250016299930090'].mouvements.length === 1, 'l\'entrée en échec reste intacte (4 mouvements), les deux autres sont traitées');
console.log('OK 6b échec d\'écriture sur une entrée : signalé avec sa raison, entrée intacte, les autres traitées.');
await page.context().close();

// ================================================================ 7. export réel (lecture seule, copie en mémoire)
for (const [nom, chemin] of [['corrigé', EXPORT_CORRIGE], ['original', EXPORT_ORIGINAL]]) {
  if (!exportPresent(chemin)) { console.log('SKIP : export ' + nom + ' absent'); continue; }
  const data = JSON.parse(readFileSync(chemin, 'utf8'));
  if (nom !== 'corrigé') {
    // export original : analyse seule (aucune connexion cloud, donc rapide) -- mêmes 115 entrées / 230 éléments
    const q = await newPage();
    const an0 = await q.evaluate((d) => { DB = migrateData(JSON.parse(JSON.stringify(d))); const a = analyserDoublonsRegistre(); return { n: a.lignes.length, entrees: a.nbEntrees, defaut: a.lignes.filter(l => l.parDefaut).length, cats: [...new Set(a.lignes.map(l => l.categorie + '.' + l.champ))] }; }, data);
    check(an0.entrees === 115 && an0.n === 230 && an0.defaut === 230 && an0.cats.join() === 'agnelles.mouvements', nom + ' : 115 entrées / 230 lignes exactes, uniquement registre.agnelles.mouvements : ' + JSON.stringify(an0));
    console.log('OK 7 export (' + nom + ') : analyse seule, 115 entrées / 230 lignes cochées par défaut, uniquement registre.agnelles.mouvements.');
    await q.context().close();
    continue;
  }
  const p = await newPage();
  await installerFauxPlugins(p);
  const mail = 'dedoublonnage-' + nom + '-' + Date.now() + '@ovilog-audit-jetable.test';
  await connecter(p, mail, password, true);
  uid = (await (await fetch(BACKEND + '/auth/login', { method: 'POST', body: JSON.stringify({ email: mail, password }) })).json()).uid;
  await p.evaluate((d) => { DB = migrateData(JSON.parse(JSON.stringify(d))); saveData(DB); }, data);
  const attendus = ['brebis', 'beliers', 'agnelles'].reduce((n, c) => n + Object.keys((data.registre && data.registre[c]) || {}).length, 0);
  const nLocal = () => p.evaluate(() => ['brebis', 'beliers', 'agnelles'].reduce((n, c) => n + Object.keys(DB.registre[c] || {}).length, 0));
  await waitFor(async () => Object.keys(await cloudDocs()).length === attendus, { timeout: 90000, label: 'registre de l\'export dans le cloud' });
  // l'écho de la synchro peut remplacer brièvement la mémoire par un instantané partiel : on attend la convergence complète
  try {
    await waitFor(async () => (await nLocal()) === attendus && await cloudEgalLocal(p, attendus), { timeout: 90000, label: 'mémoire = cloud = ' + attendus + ' entrées' });
  } catch (e) {
    throw new Error(e.message + ' -- état au moment du délai : mémoire ' + await nLocal() + ' entrées, cloud ' + Object.keys(await cloudDocs()).length + ' documents');
  }
  await p.waitForTimeout(1500);
  check(await nLocal() === attendus, nom + ' : registre complet en mémoire (' + attendus + ' entrées)');
  const mesure = () => p.evaluate(() => {
    const dates = ['2025-01-01', '2025-10-01', '2026-01-01', '2026-09-28', '2026-10-15'];
    return {
      eff: JSON.stringify(dates.map(d => [effectifADate('brebis', d), effectifADate('belier', d), effectifADate('agnelle', d)])),
      entrees: JSON.stringify(['brebis', 'beliers', 'agnelles'].map(c => effectifEntriesFor(c).map(x => [x.eid, animalDateEntree(x) && animalDateEntree(x).toISOString(), animalDateSortie(x) && animalDateSortie(x).toISOString()]))),
      bilan: bilanReproductionHtml(), fiches: JSON.stringify([DB.brebis, DB.beliers, DB.agnelles]),
      lignesAgnelles: registreEntriesFor('agnelles').reduce((n, x) => n + x.mouvements.length, 0),
      lignesBrebis: registreEntriesFor('brebis').reduce((n, x) => n + x.mouvements.length, 0)
    };
  });
  const m0 = await mesure();
  const an = await p.evaluate(() => { const a = analyserDoublonsRegistre(); return { n: a.lignes.length, entrees: a.nbEntrees, defaut: a.lignes.filter(l => l.parDefaut).length, enTrop: a.lignes.reduce((t, l) => t + l.avant - l.apres, 0), cats: [...new Set(a.lignes.map(l => l.categorie + '.' + l.champ))] }; });
  console.log('[' + nom + '] analyse : ' + an.n + ' lignes dans ' + an.entrees + ' entrées (' + an.defaut + ' cochées par défaut), ' + an.enTrop + ' éléments en trop, dans ' + an.cats.join(','));
  check(an.entrees === 115 && an.n === 230 && an.defaut === 230 && an.enTrop === 230 && an.cats.join() === 'agnelles.mouvements', nom + ' : 115 entrées / 230 lignes exactes à 2 occurrences, uniquement registre.agnelles.mouvements');
  if (nom === 'corrigé') {
    await p.evaluate(() => { window.__mode = 'ok'; parametresTab = 'campagne'; parametresRubrique = 'campagne'; render('parametres'); });
    await p.waitForSelector('#btn-dd-analyser', { state: 'attached' });
    await p.click('#btn-dd-analyser');
    await p.click('#btn-dd-appliquer');
    await waitFor(() => p.evaluate(() => !dedoublonRegistreEnCours && /✅|⚠️/.test(doublonsRegistreEtat.message)), { timeout: 90000, label: 'dédoublonnage de l\'export' });
    const msg = await p.evaluate(() => doublonsRegistreEtat.message);
    check(/✅ 230 élément\(s\) retiré\(s\) dans 115 entrée\(s\)/.test(msg), 'message : ' + msg);
    const m1 = await mesure();
    check(m0.lignesAgnelles === 460 && m1.lignesAgnelles === 230, 'lignes de mouvements du registre agnelles : 460 -> 230, obtenu ' + m0.lignesAgnelles + ' -> ' + m1.lignesAgnelles);
    check(m1.lignesBrebis === m0.lignesBrebis, 'registre brebis inchangé');
    check(m1.eff === m0.eff && m1.entrees === m0.entrees, 'effectif PAC (5 dates) et dates d\'entrée / sortie identiques avant/après');
    check(m1.bilan === m0.bilan && m1.fiches === m0.fiches, 'bilan de reproduction et fiches identiques octet pour octet');
    await waitFor(() => cloudEgalLocal(p, attendus), { timeout: 60000, label: 'cloud = local' });
    const re = await p.evaluate(() => analyserDoublonsRegistre().lignes.length);
    check(re === 0, 'deuxième analyse : plus aucun doublon');
    console.log('OK 7 export (' + nom + ') : 230 éléments retirés dans 115 entrées, mouvements du registre agnelles 460 -> 230, effectif PAC / bilan / fiches identiques, cloud = local, 2e analyse = 0.');
  }
  await p.context().close();
}

console.log('\nTOUS LES TESTS DU DÉDOUBLONNAGE DU REGISTRE SONT PASSÉS (faux backend, faux plugins, aucune donnée réelle écrite)');
await browser.close();
process.exit(0);
