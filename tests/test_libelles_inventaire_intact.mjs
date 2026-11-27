/* Conversion des anciens libellés (« Morte » → « Mort ») : AUCUN inventaire ne bouge. Troupeau fictif avec des sorties à l'ancien libellé
   (brebis, agnelle archivée au registre, mouvement collectif) et toutes les autres sortes de mouvements ; avant et après la conversion, on compare :
   statut de chaque animal (champ enregistré ET libellé affiché), effectifs de l'inventaire (brebis, béliers, agnelles actifs), Accueil
   (dashboardStatsData), mortalité, indicateurs du registre (entrées, ventes, morts et pertes), lignes du registre, nombre de mouvements, et chaque
   mouvement champ par champ hors le seul type. Aucun mouvement à refaire. Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' :\n  ' + JSON.stringify(a) + '\nattendu\n  ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
await page.clock.setFixedTime(new Date('2026-11-26T09:00:00'));
const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);

const r = await page.evaluate(async () => {
  try { localStorage.clear(); } catch (e) { /* ignoré */ }
  DB = migrateData({});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-09-29'; DB.campagneInitialisee = true;
  const ancien = Object.keys(CONVERSION_TYPES_MOUVEMENT).find(k => CONVERSION_TYPES_MOUVEMENT[k] === TYPE_MVT.MORT);
  const eid = n => '2500000129' + String(60000 + n);
  const fiche = (n, sortie, statut) => ({ id: 'b' + n, eid: eid(n), statut: statut || 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], controleLaitier: [], modesRepro: [],
    mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }].concat(sortie ? [sortie] : []),
    agnelages: n === 1 ? [{ id: 'mb1', date: '2026-11-05', campagne: 2026, lambs: [{ id: 'l1', sexe: 'Mâle', eid: '250000045670001', statutFinal: 'mort', mouvements: [{ type: 'Mort', cause: 'Diarrhée', date: '2026-11-12' }] }, { id: 'l2', sexe: 'Femelle', eid: '250000045670002', statutFinal: 'vendu', mouvements: [{ type: 'Vendu', acheteur: 'Acheteur C', date: '2026-11-20' }] }] }] : [] });
  DB.brebis = [];
  for (let n = 1; n <= 30; n++) {
    const s = n % 6;
    DB.brebis.push(s === 1 ? fiche(n, { type: ancien, cause: 'Mammite', date: '2026-10-1' + (n % 9) }, 'morte')
      : s === 2 ? fiche(n, { type: 'Vente', acheteur: 'Acheteur C', date: '2026-10-15' }, 'vendue')
      : s === 3 ? fiche(n, { type: 'Perte', date: '2026-10-16' }, 'perdue')
      : s === 4 ? fiche(n, { type: ancien, cause: 'Mise à jour inventaire', date: '2026-10-20', collectifId: 'MC1' }, 'morte')
      : fiche(n));
  }
  DB.mouvementsCollectifs = [{ id: 'MC1', categorie: 'brebis', type: ancien, cause: 'Mise à jour inventaire', date: '2026-10-20', membres: DB.brebis.filter(b => b.mouvements.some(m => m.collectifId === 'MC1')).map(b => b.eid), createdAt: 1 }];
  DB.beliers = [{ id: 'r1', eid: eid(90), statut: 'actif', createdAt: 1, mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], sanitaire: [], notes: [] }];
  DB.agnelles = [{ id: 'a1', eid: eid(91), statut: 'active', origine: 'née', mouvements: [{ type: 'Naissance', date: '2026-01-10' }, { type: 'Entrée', cause: 'Tri (renouvellement)', date: '2026-09-01' }], sanitaire: [], notes: [] }];
  DB.registre = { brebis: {}, beliers: {}, agnelles: { [eid(92)]: { eid: eid(92), mouvements: [{ type: 'Naissance', date: '2026-01-12' }, { type: 'Entrée', cause: 'Tri (renouvellement)', date: '2026-09-01' }, { type: ancien, cause: 'Pneumonie', date: '2026-10-05' }] } } };
  DB.lots = [];
  saveData(DB);
  const photo = () => ({
    statuts: [...DB.brebis, ...DB.beliers, ...DB.agnelles].map(a => [a.eid, a.statut || 'active', a.statut ? (LIBELLE_STATUT_SORTIE[a.statut] || a.statut) : '']),
    agneaux: DB.brebis.flatMap(b => (b.agnelages || []).flatMap(a => a.lambs.map(l => [l.eid, l.statutFinal || '']))),
    effectifs: ['brebis', 'beliers', 'agnelles'].map(k => inventaireActifsItems(k).length),
    accueil: (s => [s.total, s.misesBasActives, s.troupeauAMettreBas])(dashboardStatsData()),
    mortalite: (m => [m.brebisMortesCount, m.causesCount])(mortaliteSanitaireData()),
    registre: registreIndicateursPc(),
    lignesRegistre: registreMouvementsRows().map(x => [x.eid, x.categorie, x.type, x.detail, x.date]),
    mouvements: compterMouvementsBase(DB),
    horsType: JSON.stringify([DB.brebis, DB.beliers, DB.agnelles, DB.registre, DB.mouvementsCollectifs], (k, v) => k === 'type' ? undefined : v)
  });
  const avant = photo();
  sauvegardeVisibleAvantMutation = async () => ({ ok: true });
  const p = convertirLibellesMouvements();
  await new Promise(res => setTimeout(res, 50));
  document.querySelector('#question-charte .btn-primary').click();
  const res = await p;
  const apres = photo();
  return { res, avant, apres, reste: texteContientAncienLibelle(localStorage.getItem(DB_KEY)) };
});
check(r.res.fait && r.res.n > 0 && !r.reste, 'conversion faite : ' + JSON.stringify(r.res));
for (const k of ['statuts', 'agneaux', 'effectifs', 'accueil', 'mortalite', 'registre', 'lignesRegistre', 'mouvements', 'horsType']) eq(r.apres[k], r.avant[k], k + ' identique avant / après la conversion');
check(r.avant.effectifs[0] === 10 && r.avant.mortalite[0] === 10, 'jeu : 10 brebis actives, 10 mortes à l\'ancien libellé : ' + JSON.stringify([r.avant.effectifs, r.avant.mortalite]));
check(!erreurs.length, 'erreurs JS : ' + erreurs.slice(0, 3).join(' | '));
console.log('OK ' + r.res.n + ' mouvements convertis : statuts, effectifs, Accueil, mortalité, registre (indicateurs et lignes), nombre de mouvements et tous les champs hors type : identiques.');
await browser.close();
console.log('TOUS LES TESTS « LIBELLÉS : INVENTAIRE INTACT » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
