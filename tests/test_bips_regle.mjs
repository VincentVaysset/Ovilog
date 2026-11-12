/* Règle des bips (MOBILE) : les bips de RECHERCHE (trouvé, pas trouvé, plusieurs, déjà trouvé) seulement sur les écrans où l'on cherche des
   animaux d'un lot (champ data-bips="recherche" : lot de recherche, mise à jour de l'inventaire…) ; partout ailleurs UN bip neutre « c'est
   bipé » par scan (Carnet, Créer une liste, Mises bas, Tri des agnelles), jamais deux. Inventaire : brebis inconnue = « pas trouvé » + message
   ambre, gardée. Faux AudioContext qui relève les fréquences jouées ; saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => d.accept());
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  window.__beeps = [];
  window.AudioContext = class {
    constructor() { this.currentTime = 0; this.destination = {}; this.state = 'running'; }
    createOscillator() { const o = { frequency: { value: 0 }, type: '', connect() {}, start() { window.__beeps.push(o.frequency.value); }, stop() {} }; return o; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  };
  playBeep.ctx = null;
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  const E = n => '2500000456' + n;
  const fiche = (n, id) => ({ id, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] });
  DB.brebis = [fiche('20101', 'b1'), fiche('20102', 'b2')];
  DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.lots = [{ id: 'L1', nom: 'Lot essai', type: 'recherche', membres: [E('20101')] }];
  DB.listeSerie = []; DB.listeSerieVerif = [];
});
const E = n => '2500000456' + n;
const A = [1046, 1568], B = [220], C = [440], NEUTRE = [880];
const scan = async (code, eid) => { await p.evaluate(c => { eval(c); }, code); await p.waitForTimeout(150); await p.evaluate(() => { window.__beeps = []; }); await p.evaluate(e => onEidScanned(e), eid); await p.waitForTimeout(300); return p.evaluate(() => window.__beeps); };

// 1. écrans où l'on bipe un animal sans le chercher dans un lot : UN bip neutre, quel que soit le résultat
eq(await scan("listeSerieVerif = false; render('liste-serie')", E('20101')), NEUTRE, 'Créer une liste : bip neutre');
eq(await scan("listeSerieVerif = false; render('liste-serie')", E('20101')), NEUTRE, 'Créer une liste, déjà dans la liste : bip neutre (message à l\'écran)');
eq(await scan("render('misebas-rapide')", E('20101')), NEUTRE, 'Mises bas : brebis trouvée = bip neutre seul');
eq(await scan("render('misebas-rapide')", E('99999')), NEUTRE, 'Mises bas : brebis inconnue = bip neutre seul');
eq(await scan("render('agnelles')", E('20101')), NEUTRE, 'Tri des agnelles : un seul bip neutre (plus de double bip)');
eq(await scan("render('list')", E('20101')), NEUTRE, 'Liste des brebis : bip neutre');
// 2. écrans de recherche : le bip du résultat, sans bip neutre en plus
eq(await scan("currentLotId = 'L1'; render('lot-search')", E('20101')), A, 'Lot de recherche : trouvée');
eq(await scan("currentLotId = 'L1'; render('lot-search')", E('20101')), C, 'Lot de recherche : déjà trouvée');
eq(await scan("currentLotId = 'L1'; render('lot-search')", E('20102')), B, 'Lot de recherche : pas dans le lot');
eq(await scan("render('maj-inventaire')", E('20101')), A, 'Mise à jour de l\'inventaire : brebis du troupeau = trouvée');
eq(await scan("render('maj-inventaire')", E('20101')), C, 'Mise à jour de l\'inventaire : déjà bipée');
eq(await scan("render('maj-inventaire')", E('88888')), B, 'Mise à jour de l\'inventaire : brebis inconnue = pas trouvée');
check(await p.evaluate(() => /inconnue du troupeau/.test(document.getElementById('scan-maj-feedback').textContent)), 'inventaire : message ambre pour la brebis inconnue');
check(await p.evaluate(() => (DB.majInventaireSession || {}).eids ? DB.majInventaireSession.eids.length === 2 : true), 'inventaire : la brebis inconnue est gardée dans le bipage');
eq(await scan("DB.listeSerie = [{ eid: '" + E('20101') + "', espece: 'Brebis' }]; listeSerieVerif = true; render('liste-serie')", E('20102')), B, 'Vérifier mères et agneaux : pas dans le groupe');
// 3. Carnet sanitaire (choix des animaux) : bip neutre, animal trouvé ou non
await p.evaluate(() => { DB.produits = { vaccins: [], antibiotiques: ['Produit A'], antiparasitaires: [], antiinflammatoires: [], autres: [] }; DB.produitsInfo = { 'Produit A': { delaiLait: 7, delaiViande: 28 } }; carnetSanitaireEtat = null; carnetOnglet = 'nouveau'; render('sanitaire'); });
await p.selectOption('#cs-produit', 'Produit A'); await p.fill('#cs-dose', '2'); await p.selectOption('#cs-voie', { index: 1 });
await p.click('#cs-suivant'); await p.waitForSelector('#cs-q');
eq(await scan("0", E('20101')), NEUTRE, 'Carnet : animal coché = bip neutre');
eq(await scan("0", E('77777')), NEUTRE, 'Carnet : n° inconnu = bip neutre (message ambre à l\'écran)');
await browser.close();
console.log('OK test_bips_regle');
