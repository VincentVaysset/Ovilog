/* Bilan de campagne — comptes saisis en cours de campagne (règle PMB) :
   - compte neuf : campagne démarrée, mises bas saisies, PUIS troupeau importé sans date d'entrée -> effectif juste, fertilité et taux de
     réussite cohérents, plus d'alerte « mises bas de brebis absentes de la population de départ » ;
   - vraie date d'entrée après le début des mises bas, sans mise bas -> hors effectif ; achetée en septembre (date saisie) avant les agnelages
     -> comptée ; date inconnue sortie avant le début -> hors effectif ;
   - à partir de maintenant : création ou import sans date d'entrée -> dateEntree vide, mouvement d'entrée daté du jour de saisie ET marqué
     dateInconnue ; registre « (date de saisie) » ; fiche « Date d'entrée : inconnue » ; données existantes reconnues par leur trace ;
   - aucun écran ne plante avec dateEntree vide.
   Jeu SYNTHÉTIQUE (indicatif 000456), aucune donnée réelle ; saveData REMPLACÉ. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.clock.setFixedTime(new Date('2026-11-18T09:00:00'));
const erreurs = []; p.on('pageerror', e => erreurs.push(e.message));
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);

const r = await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-09-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', nom: 'Exploitation exemple' });
  const jourImport = Date.parse('2026-11-15T10:00:00');   // troupeau saisi le 15/11, APRÈS les mises bas d'octobre
  // fiche comme le fait l'ancienne version (avant le marqueur) : import sans date -> dateEntree null, entrée datée du jour d'import
  const importee = (n, an, extra) => Object.assign({ id: 'b' + n, eid: '2500000456' + an + String(n).padStart(4, '0'), statut: 'active', createdAt: jourImport, dateEntree: null,
    mouvements: [{ type: 'Entrée', cause: 'Import Nouveaux animaux (Née)', date: '2026-11-15' }], echographies: [], agnelages: [], sanitaire: [], notes: [], modesRepro: [], controleLaitier: [] }, extra || {});
  const mb = d => ({ agnelages: [{ date: d, campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Femelle', eid: '' }, { sexe: 'Mâle', eid: '' }] }] });
  DB.brebis = [];
  for (let i = 1; i <= 8; i++) DB.brebis.push(importee(i, 0, mb('2026-10-1' + i)));     // 8 ont mis bas en octobre (saisies avant l'import)
  DB.brebis.push(importee(9, 0), importee(10, 0));                                      // 2 importées sans date, pas encore mis bas : en attente
  // vraie date d'entrée APRÈS le début des mises bas (11/10), sans mise bas : hors effectif
  DB.brebis.push(Object.assign(importee(11, 0), { dateEntree: '2026-11-01', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2026-11-01' }] }));
  // achetée en septembre (date saisie), avant les agnelages : comptée
  DB.brebis.push(Object.assign(importee(12, 0), { dateEntree: '2026-09-20', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2026-09-20' }] }));
  // date inconnue, morte avant le début des mises bas : hors effectif
  DB.brebis.push(Object.assign(importee(13, 0), { statut: 'morte', mouvements: [{ type: 'Entrée', cause: 'Import Nouveaux animaux (Née)', date: '2026-11-15' }, { type: 'Morte', date: '2026-10-01' }] }));
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  const b = bilanReproductionCampagne(2026);
  const t = tauxReussiteGlobal(campagneCohortPresente());
  return {
    presentes: b.groupes.total.presentes, misesBas: b.groupes.total.misesBas, fert: Math.round(b.groupes.total.fertilite * 1000) / 10,
    hors: b.horsBilan, taux: [t.misesBas, t.taux], cohort: campagneCohortPresente().map(s => s.id).sort((x, y) => Number(x.slice(1)) - Number(y.slice(1))),
    inconnues: DB.brebis.map(s => entreeDateInconnue(s) ? 1 : 0).join('')
  };
});
eq(r.inconnues, '1111111111001', 'trace des données existantes : import sans date = inconnue ; date saisie = connue');
eq([r.presentes, r.misesBas, r.fert], [11, 8, 72.7], 'compte saisi après les mises bas : 8 mises bas sur 11 présentes (2 en attente, l\'achetée de septembre)');
eq(r.cohort, ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b12'], 'hors effectif : arrivée réelle après le début (b11), morte avant le début (b13)');
eq([r.hors.misesBasHorsCohorte, r.hors.brebisAvecMiseBasHorsCohorte], [0, 0], 'plus de mises bas « absentes de la population de départ »');
eq(r.taux, [8, 100], 'taux de réussite sur la même population');

// écran mobile du bilan : pas d'alerte « population de départ », rien ne plante
await p.evaluate(() => { bilanCampagneOnglet = 'repro'; render('bilan-campagne'); }).catch(() => p.evaluate(() => render('bilan-campagne')));
await p.waitForTimeout(400);
check(!/absentes? de la population de départ/.test(await p.textContent('#app')), 'plus d\'alerte « population de départ » à l\'écran');

// à partir de maintenant : création à la main sans date -> dateEntree vide + marqueur, registre « (date de saisie) », fiche « inconnue »
const n = await p.evaluate(() => {
  render('add-sheep');
  document.getElementById('input-eid').value = '250000045600999';
  const form = document.querySelector('#btn-save, #btn-save-sheep, button.btn-primary');
  form.click();
  const s = DB.brebis.find(x => x.eid === '250000045600999');
  return s ? { dateEntree: s.dateEntree, mvt: s.mouvements[0] } : null;
});
check(n && !n.dateEntree && n.mvt.dateInconnue === true && n.mvt.date === '2026-11-18', 'création sans date : dateEntree vide, entrée datée du jour de saisie et marquée : ' + JSON.stringify(n));
const reg = await p.evaluate(() => {
  const rows = registreMouvementsRows().filter(r => r.type !== 'Naissance');
  const mine = rows.find(r => r.eid === '250000045600999'), old = rows.find(r => r.eid === DB.brebis[0].eid), achat = rows.find(r => r.eid === DB.brebis[11].eid);
  return [dateMouvementRegistreTexte(mine), dateMouvementRegistreTexte(old), dateMouvementRegistreTexte(achat)];
});
eq(reg, ['18\/11\/2026 (date de saisie)', '15\/11\/2026 (date de saisie)', '20\/09\/2026'], 'registre : date de saisie signalée (nouvelle et ancienne donnée), vraie date inchangée');
await p.evaluate(() => { currentSheepId = DB.brebis.find(x => x.eid === '250000045600999').id; render('detail'); }); await p.waitForTimeout(300);
check(/Date d'entrée : inconnue/.test(await p.textContent('#app')), 'fiche : « Date d\'entrée : inconnue »');

// aucun écran ne plante avec dateEntree vide (mobile)
for (const v of ['home', 'list', 'registre', 'bilan-campagne', 'inventaire', 'mouvements', 'lots', 'controle-laitier']) {
  await p.evaluate(v => { try { render(v); } catch (e) { window.__err = v + ' : ' + e.message; } }, v); await p.waitForTimeout(150);
}
eq(await p.evaluate(() => window.__err || null), null, 'aucun écran ne plante');
eq(erreurs, [], 'aucune erreur JavaScript');

await browser.close();
console.log('OK test_bilan_compte_en_cours');
