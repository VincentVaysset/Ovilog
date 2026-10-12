/* Saisie guidée du résumé de la campagne 2026 (bilan externe du 23/09/2026) : écran prérempli,
   valeurs dérivées calculées, contrôle des taux imprimés, incohérences signalées sans correction,
   et RIEN d'écrit sans validation : confirmation, puis export visible bloquant (annulation / échec =
   rien d'écrit), écriture seulement après l'export, remplacement d'un résumé existant sur
   confirmation. Faux backend + faux plugins natifs, aucune donnée réelle. */
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
let reponseConfirm = true; const confirms = [];
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
await page.route('**/vendor/firebase.bundle.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fakeBundleSrc }));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponseConfirm ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
async function waitFor(fn, { timeout = 20000, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await fn()) return true; await new Promise(r => setTimeout(r, 200)); }
  throw new Error('TIMEOUT en attendant : ' + label);
}
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
        window.__saveAsCalls.push({ resumes: JSON.stringify(DB.resumesCampagne) });
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
const email = 'saisie-' + Date.now() + '@ovilog-audit-jetable.test', password = 'AuditTest12345!';
await page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email, pw: password });
await waitFor(() => page.evaluate(() => window.OvilogSync.getState().loggedIn), { label: 'connexion' });
await page.waitForTimeout(3000);   // synchro initiale stabilisée (voir BACKLOG.md)
const uid = (await (await fetch(BACKEND + '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })).json()).uid;
const metaCloud = async () => (await (await fetch(BACKEND + '/getdoc?uid=' + uid + '&col=meta&id=main')).json()).data;

// état de l'utilisateur après la bascule du 29/09 : campagne 2027 en cours (interne 2026), campagne 2026 (interne 2025) sans données
await page.evaluate(() => { DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-09-29'; DB.campagneInitialisee = true; DB.brebis = []; DB.beliers = []; DB.agnelles = []; DB.resumesCampagne = {}; saveData(DB); window.__saves = 0; const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); }; });
await waitFor(async () => { const m = await metaCloud(); return m && m.campagneDebut === 2026; }, { label: 'campagne posée dans le cloud' });
await page.waitForTimeout(1500);
const ouvrir = async () => {
  await page.evaluate(() => { saisieResumeEtat = null; bilanCampagneTab = 'reproduction'; bilanReproductionCampagneAffichee = 2025; render('bilan-campagne'); });
  await page.waitForSelector('#btn-saisie-resume');
  await page.click('#btn-saisie-resume');
  await page.waitForSelector('#rs-valider');
};
const val = (chemin) => page.evaluate((c) => document.querySelector('.rs-in[data-p="' + c + '"]').value, chemin);
const txt = (id) => page.evaluate((id) => document.getElementById('rs-' + id).textContent.trim(), id);
const poser = async (chemin, v) => { await page.fill('.rs-in[data-p="' + chemin + '"]', String(v)); };

// ================================================================ 1. écran prérempli et valeurs dérivées
await ouvrir();
check(await page.evaluate(() => document.querySelector('.brd-title').textContent) === 'Résumé de la campagne 2026', 'titre de l\'écran');
check(/préremplies depuis ton bilan externe du 23\/09\/2026/.test(await page.evaluate(() => document.querySelector('.brd-alert.info').textContent)) && /non disponible/.test(await page.evaluate(() => document.querySelector('.brd-alert.info').textContent)), 'bandeau : source du bilan externe + courbe non disponible');
const pre = { 'g.adultes.misesBas': '296', 'g.antenaises.misesBas': '67', 'g.adultes.p1': '237', 'g.adultes.p2': '59', 'g.antenaises.p1': '62', 'g.antenaises.p2': '5', 'g.adultes.nesF': '177', 'g.adultes.nesM': '170', 'g.antenaises.nesF': '36', 'g.antenaises.nesM': '30', 'g.adultes.mortNes': '8', 'g.antenaises.mortNes': '6', 'g.adultes.mortsF': '13', 'g.adultes.mortsM': '12', 'g.antenaises.mortsF': '7', 'g.antenaises.mortsM': '6', 'g.adultes.adoptes': '3', 'g.antenaises.adoptes': '1',
  'b.agnelles.renouvelees': '96', 'b.agnelles.autres': '1', 'b.adultes.mortes': '16', 'b.adultes.vendues': '85', 'b.adultes.autresSorties': '2', 'b.antenaises.mortes': '6', 'b.antenaises.vendues': '5', 'b.adultes.actifs': '220', 'b.antenaises.actifs': '99', 'b.agnelles.actifs': '97',
  'a.adultes.f.vendus': '67', 'a.adultes.m.vendus': '157', 'a.adultes.f.renouveles': '96', 'a.antenaises.f.vendus': '29', 'a.antenaises.m.vendus': '23', 'a.adultes.f.actifs': '1', 'a.adultes.m.actifs': '1', 'a.antenaises.f.actifs': '0', 'a.antenaises.m.actifs': '1' };
for (const [c, v] of Object.entries(pre)) check(await val(c) === v, 'prérempli ' + c + ' = ' + v + ', obtenu ' + await val(c));
const der = { mb: '363', p1: '299', p2: '64', p3: '0', nf: '213', nm: '200', mn: '14', ad: '4', 'nes-a': '355', 'nes-t': '72', 'nes-tot': '427', 'ma-a': '25', 'ma-t': '13', 'ma-tot': '38', 'pro-a': '1,20', 'pro-t': '1,07', 'pro-tot': '1,18', 'mort-a': '9,30 %', 'mort-t': '26,39 %', 'mort-tot': '12,18 %', 'mapn-tot': '9,20 %', 'mnat-tot': '3,28 %', 'be-tot': '97', 'bs-a': '103', 'bs-t': '13', 'bs-tot': '116', 'b-ct': '416', 'nv-tot': '413', 'so-tot': '410', 'a-mo': '38', 'a-ve': '276', 'a-re': '96', 'a-ct': '3' };
for (const [id, v] of Object.entries(der)) check(await txt(id) === v, 'dérivé ' + id + ' = ' + v + ', obtenu ' + await txt(id));
const ctl = await page.evaluate(() => document.getElementById('rs-controles').textContent.replace(/\s+/g, ' '));
check((ctl.match(/✓/g) || []).length === 4 && /Aucune incohérence/.test(ctl) && !/⚠/.test(ctl), 'contrôle : taux imprimés retrouvés (1,20 / 1,07 / 1,18 ; 9,30 / 26,39 / 12,18 %), aucune incohérence : ' + ctl);
check(await page.evaluate(() => document.querySelectorAll('.rs-tag').length) >= 14, 'cases dérivées marquées « dérivé »');
console.log('OK 1 écran prérempli depuis le bilan externe : 363 mises bas, 427 nés, 38 morts, 416 actifs, 413 nés vivants, etc. calculés ; taux imprimés retrouvés ; cases « dérivé » marquées.');

// ---- incohérence signalée, jamais corrigée
await poser('g.adultes.p2', 60);
let ctl2 = await page.evaluate(() => document.getElementById('rs-controles').textContent.replace(/\s+/g, ' '));
check(/Incohérences constatées \(rien n'est corrigé\)/.test(ctl2) && /Adultes : mises bas \(296\) ≠ somme des portées \(297\)/.test(ctl2) && await val('g.adultes.p2') === '60', 'incohérence signalée, valeur saisie conservée : ' + ctl2);
await poser('g.adultes.p2', 59);
check(!/⚠/.test(await page.evaluate(() => document.getElementById('rs-controles').textContent)), 'remise à 59 : plus d\'incohérence');
await page.fill('.rs-in[data-p="g.adultes.nesF"]', '');
check(/1 case à renseigner/.test(await page.evaluate(() => document.getElementById('rs-controles').textContent)), 'case vide : signalée');
await page.click('#rs-valider');
check((await page.evaluate(() => document.getElementById('rs-status').textContent)).includes('1 case(s) à renseigner') && confirms.length === 0 && await page.evaluate(() => window.__saveAsCalls.length) === 0 && JSON.stringify(await page.evaluate(() => DB.resumesCampagne)) === '{}', 'validation refusée tant qu\'une case est vide : rien demandé, rien écrit');
await poser('g.adultes.nesF', 177);
console.log('OK 1b incohérence signalée sans correction ; case vide : validation refusée, rien écrit.');

// ================================================================ 2. rien n'est écrit sans confirmation ni export
reponseConfirm = false; confirms.length = 0;
await page.click('#rs-valider');
await page.waitForTimeout(300);
check(confirms.length === 1 && /Enregistrer le résumé de la campagne 2026/.test(confirms[0]) && /363 mises bas \(296 adultes \+ 67 antenaises\), 427 agneaux nés/.test(confirms[0]), 'confirmation avant écriture : ' + confirms[0]);
check(await page.evaluate(() => window.__saveAsCalls.length) === 0 && JSON.stringify(await page.evaluate(() => DB.resumesCampagne)) === '{}' && await page.evaluate(() => window.__saves) === 0, 'confirmation refusée : aucun export demandé, rien écrit, 0 saveData');
reponseConfirm = true;
for (const [mode, motif] of [['cancel', /annulé/], ['fail', /sauvegarde a échoué/]]) {
  await page.evaluate((m) => { window.__mode = m; window.__saveAsCalls = []; }, mode);
  await page.click('#rs-valider');
  await waitFor(() => page.evaluate(() => saisieResumeEtat && saisieResumeEtat.enCours === false && /Enregistrement annulé/.test(saisieResumeEtat.message)), { label: 'message ' + mode });
  const st = await page.evaluate(() => ({ msg: saisieResumeEtat.message, res: JSON.stringify(DB.resumesCampagne), saves: window.__saves, appels: window.__saveAsCalls.length, btn: document.getElementById('rs-valider').disabled }));
  check(motif.test(st.msg) && /Rien n'a été écrit/.test(st.msg) && st.res === '{}' && st.saves === 0 && st.appels === 1 && !st.btn, mode + ' : rien écrit, message clair, bouton de nouveau actif : ' + JSON.stringify(st));
}
await page.evaluate(() => { window.__mode = 'ok'; });
console.log('OK 2 aucune écriture sans confirmation ; annulation ou échec de l\'export visible : rien d\'écrit, 0 saveData, bouton réactivé.');

// ================================================================ 3. validation
await page.evaluate(() => { window.__saveAsCalls = []; });
await page.click('#rs-valider');
await waitFor(() => page.evaluate(() => !!(DB.resumesCampagne && DB.resumesCampagne['2025'])), { label: 'résumé écrit' });
const appels = await page.evaluate(() => window.__saveAsCalls);
check(appels.length === 1 && appels[0].resumes === '{}', 'l\'export visible a lieu AVANT l\'écriture (au moment de l\'export : aucun résumé)');
const R = await page.evaluate(() => JSON.parse(JSON.stringify(DB.resumesCampagne['2025'])));
check(R.libelle === 2026 && R.periode.debut === '2025-10-01' && R.periode.fin === '2026-09-30' && R.source.type === 'bilan-externe' && R.source.edite === '2026-09-23' && R.source.periodeSource.debut === '2025-09-01' && R.source.periodeSource.fin === '2026-09-01', 'résumé : période nominale + source (bilan externe, période source du 01/09/2025 au 01/09/2026) : ' + JSON.stringify([R.periode, R.source.edite]));
check(R.semaines === null && R.parMillesime === null && R.groupes.adultes.presentes === null, 'courbe et millésimes non disponibles, présentes inconnues');
const B = await page.evaluate(() => { const b = bilanDepuisResume(DB.resumesCampagne['2025']), t = b.groupes.total; return { mb: t.misesBas, p: [t.portees.simples, t.portees.doubles, t.portees.triples], nes: [t.nes.total, t.nes.femelles, t.nes.males, t.nes.mortNes], morts: t.mortsApres, ad: [b.groupes.adultes.adoptes, b.groupes.antenaises.adoptes, t.adoptes], pro: Math.round(t.prolificite * 100) / 100, mort: Math.round(t.mortaliteTotale * 10000) / 100, actifs: b.actifs.total, fert: t.fertilite, titre: b.periode.titre, mv: b.mouvements.agnelles.entrees }; });
check(B.mb === 363 && B.p.join() === '299,64,0' && B.nes.join() === '427,213,200,14' && B.morts === 38 && B.ad.join() === '3,1,4' && B.pro === 1.18 && B.mort === 12.18 && B.actifs === 416 && B.fert === null && B.titre === 'du 01/10/2025 au 30/09/2026' && B.mv.naissance === 96 && B.mv.total === 97, 'résumé relu : ' + JSON.stringify(B));
await waitFor(async () => { const m = await metaCloud(); return m && m.resumesCampagne && m.resumesCampagne['2025'] && m.resumesCampagne['2025'].source.type === 'bilan-externe'; }, { label: 'résumé dans le cloud' });
check(await page.evaluate(() => currentView === 'bilan-campagne' && bilanReproductionCampagneAffichee === 2025), 'retour sur le Bilan de reproduction, campagne 2026 affichée');
console.log('OK 3 validation : export visible puis écriture ; résumé 2026 : 363 / 299-64-0 / 427 (213 F, 200 M, 14 MN) / 38 morts / adoptés 3-1-4 / 1,18 / 12,18 % / 416 actifs ; période nominale + source ; synchronisé.');

// ================================================================ 4. remplacement sur confirmation
await ouvrir();
check(/Un résumé existe déjà/.test(await page.evaluate(() => document.querySelector('.brd-alert.warn').textContent)), 'avertissement : un résumé existe déjà');
await poser('g.adultes.adoptes', 5);
reponseConfirm = false; confirms.length = 0;
await page.click('#rs-valider');
await page.waitForTimeout(300);
check(/REMPLACÉ/.test(confirms[0]) && await page.evaluate(() => DB.resumesCampagne['2025'].groupes.adultes.adoptes) === 3, 'remplacement : confirmation explicite ; refusée = résumé existant intact');
reponseConfirm = true;
await page.click('#rs-valider');
await waitFor(() => page.evaluate(() => DB.resumesCampagne['2025'].groupes.adultes.adoptes === 5), { label: 'résumé remplacé' });
console.log('OK 4 un résumé existant n\'est remplacé qu\'après confirmation explicite (refus = intact).');

// ================================================================ 5. Annuler, autre campagne
await ouvrir();
await page.click('#rs-annuler');
await page.waitForSelector('.brd');
check(await page.evaluate(() => saisieResumeEtat === null && DB.resumesCampagne['2025'].groupes.adultes.adoptes === 5), 'Annuler : retour au bilan, rien modifié');
await page.evaluate(() => { ouvrirSaisieResume(2024); });
await page.waitForSelector('#rs-valider');
check(await val('g.adultes.misesBas') === '' && /Saisie manuelle/.test(await page.evaluate(() => document.querySelector('.brd-alert.info').textContent)), 'autre campagne (2025) : cases vides, saisie manuelle, aucun préremplissage');
console.log('OK 5 Annuler = rien modifié ; une autre campagne n\'est pas préremplie.');

console.log('\nTOUS LES TESTS DE LA SAISIE GUIDÉE DU RÉSUMÉ SONT PASSÉS (faux backend, faux plugins, aucune donnée réelle)');
await browser.close();
process.exit(0);
