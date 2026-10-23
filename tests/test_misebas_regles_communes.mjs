/* Règles COMMUNES de la saisie des mises bas (mobile ET PC : une seule fonction métier) : controlesMiseBas (bloquer : déjà mis bas ; alerter : date future, vide définitive ; rien d'autre),
   chercherBrebisMiseBas (trouvée, ambiguë, inconnue, EID pris ailleurs), construireAgnelageMiseBas (au moins un agneau, sexe obligatoire, doublon d'EID, EID déjà utilisé, mort-né sans EID mais avec
   sexe facultatif sexeMortNe, adoption vers une brebis ACTIVE seulement, aucun soin ajouté d'office, ni sur un agneau vivant ni sur un mort-né), annulation en un geste, résumé « 1 mâle, 1 femelle mort-née »,
   statistiques des tuiles (Mâles + Femelles vivants + Morts-nés = Agneaux nés ; attendues = présentes − vides définitives présentes). Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext()).newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  window.E = eid;
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = [fiche(eid(3, 101)), fiche(eid(3, 102)), fiche(eid(3, 103)),
    fiche(eid(3, 200), { agnelages: [{ date: '2026-11-10', campagne: 2026, lambs: [{ sexe: 'Mâle' }, { sexe: 'Femelle' }] }] }),
    fiche(eid(3, 300), { videesDefinitives: [{ date: '2026-12-05', campagne: 2026 }] }),
    fiche(eid(3, 400), { statut: 'vendue' })];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
});
const ev = (fn, arg) => page.evaluate(fn, arg);

// ---- controlesMiseBas
const c1 = await ev(() => { const s = n => DB.brebis.find(b => b.eid === E(3, n)); const dej = controlesMiseBas(s(200), '2026-10-01'), ok = controlesMiseBas(s(101), '2026-10-01'), fut = controlesMiseBas(s(101), '2099-01-01'), vide = controlesMiseBas(s(300), '2026-10-01'), nul = controlesMiseBas(null, ''); return { dej, ok, fut, vide, nul }; });
eq(c1.dej.bloquants.map(b => [b.code, b.agnelageIdx, b.date, b.nbAgneaux]), [['deja-mis-bas', 0, '2026-11-10', 2]], 'déjà mis bas : blocage');
eq([c1.ok.bloquants.length, c1.ok.alertes.length], [0, 0], 'brebis à régulariser, date passée : aucun message (contrôles discrets)');
eq(c1.fut.alertes.map(a => a.code), ['date-future'], 'date future : alerte seulement'); check(/postérieure à aujourd'hui/.test(c1.fut.alertes[0].message) && c1.fut.bloquants.length === 0, 'date future : ne bloque pas');
eq(c1.vide.alertes.map(a => a.code), ['vide-definitive'], 'vide définitive : alerte'); eq(c1.vide.bloquants.length, 0, 'vide définitive : ne bloque pas');
eq([c1.nul.bloquants.length, c1.nul.alertes.length], [0, 0], 'sans brebis : rien');

// ---- chercherBrebisMiseBas
const r = await ev(() => ({ t: chercherBrebisMiseBas(E(3, 101)).statut, a: chercherBrebisMiseBas('99999999999').statut, i: chercherBrebisMiseBas(E(3, 101).slice(0, 9) + '7' + '00000').statut }));
check(r.t === 'trouvee' && r.a === 'inconnue', 'recherche : trouvée / inconnue : ' + JSON.stringify(r));

// ---- construireAgnelageMiseBas
const b1 = await ev(() => {
  const s = DB.brebis.find(b => b.eid === E(3, 101));
  const sans = construireAgnelageMiseBas(s, { date: '2026-10-05', codeRepro: 'MN', lambs: [] });
  const nosexe = construireAgnelageMiseBas(s, { date: '2026-10-05', codeRepro: 'MN', lambs: [{ sexe: null }] });
  const dbl = construireAgnelageMiseBas(s, { date: '2026-10-05', codeRepro: 'MN', lambs: [{ sexe: 'Mâle', eid: E(4, 1) }, { sexe: 'Femelle', eid: E(4, 1) }] });
  const pris = construireAgnelageMiseBas(s, { date: '2026-10-05', codeRepro: 'MN', lambs: [{ sexe: 'Mâle', eid: E(3, 102) }] });
  const adoptVendue = construireAgnelageMiseBas(s, { date: '2026-10-05', codeRepro: 'MN', lambs: [{ sexe: 'Mâle', eid: E(4, 1), adopte: true, adoptNum: E(3, 400) }] });
  const adoptInconnue = construireAgnelageMiseBas(s, { date: '2026-10-05', codeRepro: 'MN', lambs: [{ sexe: 'Mâle', eid: E(4, 1), adopte: true, adoptNum: '99999999999' }] });
  const ok = construireAgnelageMiseBas(s, { date: '2026-10-05', codeRepro: 'MN', lambs: [{ sexe: 'Mâle', eid: E(4, 1), adopte: true, adoptNum: E(3, 102) }, { sexe: 'Mort-né', sexeMortNe: 'Femelle', eid: E(4, 9) }, { sexe: 'Mort-né' }, { sexe: 'Femelle', eid: '' }] });
  return { sans: sans.erreur, nosexe: nosexe.erreur, dbl: dbl.erreur, pris: pris.erreur, adoptVendue: adoptVendue.erreur, adoptInconnue: adoptInconnue.erreur, ok };
});
check(/au moins un agneau/.test(b1.sans), 'au moins un agneau'); check(/sexe de chaque agneau/.test(b1.nosexe), 'sexe obligatoire');
check(/même EID/.test(b1.dbl), 'doublon d\'EID dans la portée'); check(!!b1.pris, 'EID déjà utilisé par une brebis : refusé : ' + b1.pris);
check(/Aucune brebis active/.test(b1.adoptVendue), 'adoption vers une brebis non active refusée : ' + b1.adoptVendue); check(/Aucune brebis active/.test(b1.adoptInconnue), 'adoption vers une brebis inconnue refusée');
const ag = b1.ok.agnelage; check(!!ag && !b1.ok.erreur, 'portée valide acceptée : ' + b1.ok.erreur);
eq(ag.lambs.map(l => l.sexe), ['Mâle', 'Mort-né', 'Mort-né', 'Femelle'], 'sexes');
check(ag.lambs[0].adopte === true && !!ag.lambs[0].adoptiveEid, 'adoption : mère adoptive enregistrée');
eq([ag.lambs[1].sexeMortNe, ag.lambs[2].sexeMortNe], ['Femelle', undefined], 'sexe du mort-né : champ facultatif');
check(ag.lambs[1].eid === undefined && !(ag.lambs[1].sanitaire || []).length && !(ag.lambs[2].sanitaire || []).length, 'mort-né : jamais d\'EID ni de soin');
check([0, 3].every(i => Array.isArray(ag.lambs[i].sanitaire) && ag.lambs[i].sanitaire.length === 0), 'agneau vivant : aucun soin ajouté d\'office (plus de Séléphérol automatique), un soin se saisit par le Carnet sanitaire');
eq([ag.campagne, ag.codeRepro], [2026, 'MN'], 'campagne et repro');
eq(await ev(a => resumeAgnelage(a), ag), '1 mâle, 1 femelle, 1 femelle mort-née, 1 mort-né', 'résumé');
eq(await ev(() => resumeAgnelage({ lambs: [{ sexe: 'Mâle' }, { sexe: 'Mort-né', sexeMortNe: 'Femelle' }] })), '1 mâle, 1 femelle mort-née', 'résumé de la maquette');

// ---- enregistrement et annulation en un geste (aucune confirmation)
const e = await ev(() => {
  const s = DB.brebis.find(b => b.eid === E(3, 101)); const avant = window.__saves;
  const r = construireAgnelageMiseBas(s, { date: '2026-10-05', codeRepro: 'MN', lambs: [{ sexe: 'Mâle', eid: E(4, 1) }] });
  const idx = enregistrerMiseBas(s, r.agnelage);
  const apres = { n: s.agnelages.length, saves: window.__saves - avant, bloque: controlesMiseBas(s, '2026-10-05').bloquants.length };
  window.confirm = () => { throw new Error('confirm interdit'); };
  const ok = annulerMiseBas(s.id, idx);
  return { idx, apres, ok, n: s.agnelages.length, saves: window.__saves - avant, bloqueApres: controlesMiseBas(s, '2026-10-05').bloquants.length, absent: annulerMiseBas(s.id, 5) };
});
eq([e.idx, e.apres.n, e.apres.saves, e.apres.bloque], [0, 1, 1, 1], 'enregistrement : une mise bas, un seul enregistrement, la brebis est ensuite bloquée');
eq([e.ok, e.n, e.saves, e.bloqueApres, e.absent], [true, 0, 2, 0, false], 'annulation sans confirmation : mise bas retirée, brebis de nouveau saisissable, index inconnu sans effet');

// ---- statistiques des tuiles : actives = 3 à régulariser + 1 mise bas + 1 vide définitive = 5 (la vendue ne compte pas) ; à mettre bas = 5 − 1 = 4 ; restantes = 4 − 1 = 3
const st = await ev(() => { const rows = misebasCampagneRows(); const x = miseBasRapideStats(rows); return { misesBas: x.misesBas, nes: x.nes, m: x.males, f: x.femelles, mn: x.mortNes, rest: x.cb.misesBasRestantes, att: x.cb.troupeauAMettreBas, coh: campagneBilanChiffres(DB.brebis.filter(s => (s.statut || 'active') === 'active')).misesBasRestantes }; });
eq([st.misesBas, st.nes, st.m, st.f, st.mn], [1, 2, 1, 1, 0], 'tuiles : mises bas, agneaux nés, mâles, femelles, morts-nés');
check(st.m + st.f + st.mn === st.nes, 'Mâles + Femelles (vivants) + Morts-nés = Agneaux nés');
eq([st.att, st.rest, st.coh], [4, 3, 3], 'attendues = présentes − vides définitives présentes (même calcul que l\'Accueil PC et le Bilan)');
console.log('OK : règles communes de la saisie des mises bas (contrôles, constructeur, mort-né, adoption, aucun soin d\'office, annulation en un geste, tuiles).');
await browser.close();
