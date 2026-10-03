/* Référence « mobile identique » des écrans du Bilan de campagne (Brebis à régulariser, Bilan économique,
   Bilan de lactation) et de la Saisie de mises bas : le HTML mobile (jeu SYNTHÉTIQUE, horloge figée,
   aucun EID réel) est comparé octet pour octet à tests/ref/ecrans_mobile.json, pris AVANT les pages PC
   et la règle « sans contrôle laitier ». Cas « Brebis à régulariser » :
     - aucun contrôle laitier importé dans la campagne (la règle n'apparaît pas) ;
     - toutes les brebis ayant mis bas ont un contrôle (liste vide : rien à signaler).
   Les écrans ne doivent changer que par ce qui est demandé : la règle elle-même est testée dans
   test_controle_laitier_manquant. Régénérer volontairement : OVILOG_MAJ_REF=1 node test_mobile_ecrans_reference.mjs */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LAUNCH, URL_APP } from './lib/config.mjs';
const REF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ref', 'ecrans_mobile.json');
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
  const eid = (c, n) => '2500162999' + c + String(n).padStart(4, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const mb = (d, l) => ({ date: d, campagne: 2026, lambs: l.map(s => ({ sexe: s })) });
  const cl = (n, camp) => ({ controle: n, quantite: 1.2, anomalie: null, date: '2027-01-15', campagne: camp });
  const jeu = (avecControles) => {
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.brebis = [
      fiche(eid(6, 1), { agnelages: [mb('2026-11-20', ['Mâle'])], controleLaitier: avecControles ? [cl(1, 2026)] : [] }),
      fiche(eid(6, 2)),
      fiche(eid(5, 1), { agnelages: [mb('2026-12-02', ['Femelle', 'Mâle'])], controleLaitier: avecControles ? [cl(1, 2026), cl(2, 2026)] : [] }),
      fiche(eid(5, 2), { agnelages: [mb('2026-12-10', ['Mort-né'])], controleLaitier: avecControles ? [cl(1, 2026)] : [] }),
      fiche(eid(3, 1), { echographies: [{ date: '2026-12-01', resultat: 'Vide', campagne: 2026 }] }),
      fiche(eid(3, 2), { controleLaitier: [cl(1, 2025)] })
    ];
    DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    DB.laitTank = [{ id: 't1', date: '2026-12-15', quantite: 1500 }, { id: 't2', date: '2027-01-15', quantite: 2500 }];
  };
  const app = () => document.getElementById('app').innerHTML;
  const sortie = {};
  jeu(false);
  bilanCampagneTab = 'incoherences'; render('bilan-campagne'); sortie.incoherences_sans_controle = app();
  jeu(true);
  bilanCampagneTab = 'incoherences'; render('bilan-campagne'); sortie.incoherences_tous_controles = app();
  bilanCampagneTab = 'lactation'; bilanLactationCampagneAffichee = 2026; render('bilan-campagne'); sortie.lactation = app();
  bilanCampagneTab = 'economique'; render('bilan-campagne'); sortie.economique = app();
  render('misebas-rapide'); sortie.saisie_mises_bas = app();
  return sortie;
});
await browser.close();
if (process.env.OVILOG_MAJ_REF === '1' || !existsSync(REF)) {
  writeFileSync(REF, JSON.stringify(res, null, 1));
  console.log('Référence écrite : ' + REF + ' (' + Object.entries(res).map(([k, v]) => k + ' ' + v.length).join(', ') + ')');
  process.exit(0);
}
const attendu = JSON.parse(readFileSync(REF, 'utf8'));
let ko = false;
for (const k of Object.keys(attendu)) {
  const a = attendu[k], h = res[k];
  if (a !== h) {
    ko = true;
    const i = [...h].findIndex((c, n) => c !== a[n]);
    console.log('FAIL: écran mobile « ' + k + ' » modifié (1re différence au caractère ' + i + ')\n  attendu : …' + a.slice(Math.max(0, i - 60), i + 100).replace(/\n/g, ' ') + '\n  obtenu  : …' + h.slice(Math.max(0, i - 60), i + 100).replace(/\n/g, ' '));
  }
}
if (ko) process.exit(1);
console.log('OK : ' + Object.keys(attendu).length + ' écrans mobiles identiques à la référence (' + Object.entries(attendu).map(([k, v]) => k + ' ' + v.length).join(', ') + ').');
