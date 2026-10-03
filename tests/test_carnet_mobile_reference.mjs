/* Référence « mobile identique » du Carnet sanitaire (écrans mobiles : Sanitaire -- devenu le même parcours unifié que le
   PC, chantier « Carnet sanitaire mobile/PC unifié » --, Gérer les produits, Sous délai d'attente, historique des
   traitements collectifs, Ordonnances, carnet ouvert depuis la fiche d'une brebis avec cet animal présélectionné, fiche
   brebis) : HTML comparé octet pour octet à tests/ref/carnet_mobile.json (jeu SYNTHÉTIQUE, horloge figée). Les anciens
   écrans « Traitement collectif (nouveau) » et « Ajout carnet sanitaire » individuel (routes 'traitement-collectif' /
   'add-sanitaire') ont été retirés de cette référence : supprimés par ce même chantier, remplacés par le parcours unifié
   capturé ci-dessous sous 'sanitaire' et 'carnet_depuis_fiche'. Régénérer volontairement :
   OVILOG_MAJ_REF=1 node test_carnet_mobile_reference.mjs */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LAUNCH, URL_APP } from './lib/config.mjs';
const REF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ref', 'carnet_mobile.json');
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const res = await page.evaluate(() => {
  DB = migrateData({});
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.produits = { vaccins: ['Bravoxin 10'], antibiotiques: ['Intramicine', 'Cefalex'], antiparasitaires: ['Ivomec'], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = { Intramicine: { posologie: '8 cc', delaiAttente: 7 }, Ivomec: { posologie: null, delaiAttente: 3 }, Cefalex: { lait: 4, viande: 20, anmvNom: 'CEFALEX', posologie: 'texte RCP', declined: false } };
  DB.intervenants = ['Éleveur', 'Dr Martin'];
  DB.ordonnances = [{ id: 'o1', numero: 'ORD-1', date: '2026-09-01', veterinaire: 'Dr Martin', produits: [{ nom: 'Intramicine', quantite: '1' }] }];
  const soin = (type, sousType, produit, date, q, interv, ord) => ({ type, sousType, produit, date, quantiteCc: q, intervenant: interv, commentaire: '', numeroOrdonnance: ord || null });
  DB.brebis = [
    fiche(eid(1, 17), { sanitaire: [soin('Traitement', 'Antibiotique', 'Intramicine', '2026-09-30', 8, 'Éleveur', 'ORD-1'), soin('Vaccin', null, 'Bravoxin 10', '2026-01-12', 2, 'Éleveur')] }),
    fiche(eid(2, 18), { sanitaire: [soin('Traitement', 'Antiparasitaire', 'Ivomec', '2026-10-01', 4, 'Dr Martin')] })
  ];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  const app = () => document.getElementById('app').innerHTML;
  const R = {};
  render('sanitaire'); R.sanitaire = app();
  render('gerer-produits'); R.gerer_produits = app();
  render('sous-delai'); R.sous_delai = app();
  render('traitements-collectifs'); R.traitements_collectifs = app();
  render('ordonnances'); R.ordonnances = app();
  carnetSanitaireEtat = Object.assign(carnetEtatInitial({ preselectEid: DB.brebis[0].eid }), { produit: 'Intramicine', dose: '8', voie: 'Intramusculaire', delaiViande: '28', delaiLait: '7', ecran: 2 });
  render('sanitaire'); R.carnet_depuis_fiche = app();
  render('detail', DB.brebis[0].id); R.fiche_brebis = app();
  return R;
});
await browser.close();
if (process.env.OVILOG_MAJ_REF === '1' || !existsSync(REF)) { writeFileSync(REF, JSON.stringify(res)); console.log('Référence écrite : ' + REF + ' (' + Object.entries(res).map(([k, v]) => k + ' ' + v.length).join(', ') + ')'); process.exit(0); }
const attendu = JSON.parse(readFileSync(REF, 'utf8'));
let ko = false;
for (const k of Object.keys(attendu)) if (attendu[k] !== res[k]) { ko = true; const i = [...res[k]].findIndex((c, n) => c !== attendu[k][n]); console.log('FAIL: écran mobile « ' + k + ' » modifié (caractère ' + i + ')\n  attendu : …' + attendu[k].slice(Math.max(0, i - 60), i + 100).replace(/\n/g, ' ') + '\n  obtenu  : …' + res[k].slice(Math.max(0, i - 60), i + 100).replace(/\n/g, ' ')); }
if (ko) process.exit(1);
console.log('OK : ' + Object.keys(attendu).length + ' écrans mobiles du carnet sanitaire identiques à la référence (' + Object.entries(attendu).map(([k, v]) => k + ' ' + v.length).join(', ') + ').');
