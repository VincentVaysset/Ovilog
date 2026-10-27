/* « Pas traite cette campagne » et situation de traite de chaque brebis présente (mobile et PC).
   Règle (situationTraiteCampagne, une seule fonction) : traite dès qu'un contrôle de la campagne porte une quantité, même cotée « Tarie »
   (code 9) à un contrôle suivant ; pas traite si marquée par l'éleveur (sheep.nonTraite, motif facultatif de DB.motifsNonTraite) ou si
   cotée Tarie sans aucune quantité ; sinon attendue à la traite (agneaux réglés) ou allaitante. Brebis à régulariser en six groupes qui ne
   se recoupent jamais (somme = brebis présentes), avancement = informations complètes. Action en un geste, sans boîte native, bandeau
   6 s avec motif et « Annuler ». Sortie d'une brebis sans situation de traite : message ambre, jamais un blocage ; après la sortie elle
   quitte Brebis à régulariser. Motifs : Paramètres › Listes (valeurs de départ, modifiables). saveData REMPLACÉ ; jeu synthétique
   (EID d'exemple, indicatif 000456). */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-03-20T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => { throw new Error('boîte native inattendue : ' + d.message()); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    const E = n => '250000004569' + String(n).padStart(3, '0');
    const fiche = (n, x) => Object.assign({ id: 'b' + n, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, x || {});
    const mb = (lambs) => [{ date: '2026-10-12', campagne: 2026, codeRepro: 'MN', lambs }];
    const mortNe = { sexe: 'Mort-né', adopte: false };
    const vivant = (n) => ({ sexe: 'Mâle', adopte: false, eid: '250000004561' + String(n).padStart(3, '0'), sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-10-12' }] });
    DB.brebis = [
      fiche(1, { agnelages: mb([mortNe, mortNe]) }),                                                                          // attendue
      fiche(2, { agnelages: mb([vivant(2)]) }),                                                                               // allaitante
      fiche(3, { agnelages: mb([mortNe]), controleLaitier: [{ controle: 1, quantite: 1.8, campagne: 2026 }, { controle: 2, quantite: null, anomalie: 9, campagne: 2026 }] }), // traite, tarie au 2e
      fiche(4, { agnelages: mb([mortNe]), controleLaitier: [{ controle: 1, quantite: null, anomalie: 9, campagne: 2026 }] }), // pas traite (contrôleur)
      fiche(5, { agnelages: mb([mortNe]), nonTraite: [{ campagne: 2026, date: '2026-10-20', motif: 'Mammite' }] }),          // pas traite (éleveur)
      fiche(6, { videesDefinitives: [{ campagne: 2026, date: '2026-09-01' }] }),                                              // vide définitive
      fiche(7),                                                                                                               // à régulariser
      fiche(8, { agnelages: mb([mortNe]), nonTraite: [{ campagne: 2026, date: '2026-10-20', motif: '' }], controleLaitier: [{ controle: 2, quantite: 1.1, campagne: 2026 }] }), // marquée mais traite : écart
      fiche(9, { agnelages: [{ date: '2025-10-12', campagne: 2025, codeRepro: 'MN', lambs: [mortNe] }], nonTraite: [{ campagne: 2025, date: '2025-10-20', motif: 'Mammite' }] }) // marque d'une autre campagne
    ];
    DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  });
  return page;
}
const situations = (p) => p.evaluate(() => Object.fromEntries(DB.brebis.map(s => { const S = situationTraiteCampagne(s); return [s.id, S.code + (S.tarieAu ? '@' + S.tarieAu : '') + (S.ecart ? '!' : '') + (S.source ? '/' + S.source : '') + (S.motif ? ':' + S.motif : '')]; })));
const ouvrirRegulariser = (p) => p.evaluate(() => { bilanCampagneTab = 'incoherences'; render('bilan-campagne'); });

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await ouvrir(bureau);
  // ================================================================ 1. règle
  eq(await situations(p), { b1: 'attendue', b2: 'allaitante', b3: 'traite@2', b4: 'pasTraite/controleur:Tarie (contrôleur)', b5: 'pasTraite/eleveur:Mammite', b6: 'videDefinitive', b7: 'aRegulariser', b8: 'traite!', b9: 'aRegulariser' },
    nom + ' : situations (traite même tarie au 2e contrôle, Tarie seul = pas traite, marque de l\'éleveur, écart marque/contrôle, marque d\'une autre campagne ignorée)');
  // accueil : agneaux réglés de la campagne en cours seulement (b9 : agneaux de 2025 seulement), ni pas traites (b4, b5) ni traites (b3, b8 : contrôlées avec une quantité)
  eq(await p.evaluate(() => [attendueTraiteListe().map(b => b.id), dashboardStatsData().attendueTraiteCount]), [['b1'], 1], nom + ' : Attendues à la traite (accueil) = groupe « attendues » de Brebis à régulariser (traites, pas traites et autre campagne exclues)');
  // un agneau de la campagne précédente oublié (sans devenir) ne la rend plus « allaitante » ; une adoption d'une autre campagne ne compte pas non plus
  eq(await p.evaluate(() => {
    const oublie = { sexe: 'Mâle', adopte: false, eid: '250000004561099', mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2025-10-12' }] };
    const x = { id: 'x', eid: '250000004569099', statut: 'active', agnelages: [{ date: '2025-10-12', campagne: 2025, lambs: [oublie] }, { date: '2026-10-12', campagne: 2026, lambs: [{ sexe: 'Mort-né', adopte: false }] }], controleLaitier: [], videesDefinitives: [] };
    const bio = { id: 'y', eid: '250000004569098', statut: 'active', agnelages: [{ date: '2025-10-14', campagne: 2025, lambs: [{ sexe: 'Mâle', adopte: true, adoptiveEid: x.eid, eid: '250000004561098' }] }] };
    return [isAttendueTraite(x, [x, bio]), getLambsUnderSheep(x, [x, bio]).length, getLambsUnderSheep(x, [x, bio], 2025).length, situationTraiteCampagne(x).code];
  }), [true, 1, 2, 'attendue'], nom + ' : agneaux de la campagne en cours seulement (oubli et adoption de 2025 ignorés)');
  console.log('OK 1 ' + nom + ' : règle de traite (code 9, marque, écart, campagne).');

  // ================================================================ 2. Brebis à régulariser : six groupes exclusifs
  const d = await p.evaluate(() => { const d = bilanARegulariserData(); const G = d.groupes; return { g: ['aRegulariser', 'allaitantes', 'attendues', 'traites', 'pasTraites', 'videsDefinitives'].map(k => G[k].map(b => b.id)), actives: d.actives, informees: d.informees, rows: brebisARegulariserRows(d).slice(1).map(r => r[2] + (r[3] ? ' (' + r[3] + ')' : '')) }; });
  eq(d.g, [['b7', 'b9'], ['b2'], ['b1'], ['b3', 'b8'], ['b4', 'b5'], ['b6']], nom + ' : six groupes');
  eq([d.g.flat().length, new Set(d.g.flat()).size, d.actives, d.informees], [9, 9, 9, 5], nom + ' : chaque brebis dans un seul groupe, somme = présentes, renseignées = traites + pas traites + vides déf.');
  check(d.rows.includes('Traite (tarie au 2e contrôle)') && d.rows.includes('Pas traite cette campagne (Mammite)') && d.rows.includes('Traite (marquée pas traite mais contrôlée)'), nom + ' : export Excel par groupe avec détail : ' + d.rows);
  await ouvrirRegulariser(p);
  const ecran = await p.evaluate(() => ({ boutons: [...document.querySelectorAll('.btn-pas-traite')].map(b => b.dataset.id), ontMisBas: /Ont mis bas, sans contrôle/.test(document.getElementById('app').textContent), texte: document.getElementById('app').innerText }));
  eq(ecran.boutons, ['b1'], nom + ' : bouton « Pas traite cette campagne » sur les attendues seulement');
  check(!ecran.ontMisBas && /5 (brebis )?sur 9/.test(ecran.texte), nom + ' : plus de liste « Ont mis bas, sans contrôle laitier » en doublon ; avancement 5 sur 9');
  console.log('OK 2 ' + nom + ' : Brebis à régulariser en six groupes sans doublons, avancement, Excel.');

  // ================================================================ 3. action en un geste, bandeau, motif, Ajouter…, Annuler
  const s0 = await p.evaluate(() => window.__saves);
  await p.click('.btn-pas-traite[data-id="b1"]');
  eq(await p.evaluate(() => [situationTraiteCampagne(DB.brebis[0]).code, !!document.querySelector('.pt-snack'), /n°69001 · pas traite cette campagne/.test(document.querySelector('.pt-snack').textContent), window.__saves > 0]), ['pasTraite', true, true, true], nom + ' : un geste : marquée, enregistrée, bandeau');
  check(s0 >= 0 && await p.evaluate(() => !document.querySelector('.btn-pas-traite[data-id="b1"]')), nom + ' : la brebis quitte les attendues');
  eq(await p.evaluate(() => [...document.querySelectorAll('#pt-snack-motif option')].map(o => o.textContent)), ['Motif (facultatif)', 'Agneaux morts', 'Mammite', 'Réforme prévue', 'Ajouter…'], nom + ' : motifs de départ dans le bandeau');
  await p.selectOption('#pt-snack-motif', '__ajouter__'); await p.fill('#liste-ajout-input', 'Brebis trop maigre'); await p.click('#liste-ajout-ok');
  eq(await p.evaluate(() => [DB.motifsNonTraite.includes('Brebis trop maigre'), marqueNonTraite(DB.brebis[0]).motif]), [true, 'Brebis trop maigre'], nom + ' : « Ajouter… » crée le motif et l\'applique');
  await p.click('#pt-snack-annuler');
  eq(await p.evaluate(() => [situationTraiteCampagne(DB.brebis[0]).code, (DB.brebis[0].nonTraite || []).length, !!document.querySelector('.pt-snack')]), ['attendue', 0, false], nom + ' : « Annuler » retire la marque');
  console.log('OK 3 ' + nom + ' : action en un geste, bandeau, motif, Ajouter…, Annuler.');

  // ================================================================ 4. fiche brebis (onglet Contrôles)
  const fiche = (id) => p.evaluate(id => { ficheBrebisTabSheepId = id; ficheBrebisTab = 'ctrl'; currentSheepId = id; render('detail', id); }, id);
  await fiche('b1');
  check(await p.evaluate(() => /Attendue à la traite/.test(document.getElementById('pt-bloc-fiche').textContent) && !!document.querySelector('#pt-bloc-fiche .btn-pas-traite')), nom + ' : fiche, attendue : bouton');
  await p.click('#pt-bloc-fiche .btn-pas-traite');
  await p.selectOption('#pt-fiche-motif', 'Agneaux morts');
  eq(await p.evaluate(() => [marqueNonTraite(DB.brebis[0]).motif, /Pas traite 2027/.test(document.getElementById('pt-bloc-fiche').textContent)]), ['Agneaux morts', true], nom + ' : fiche : pastille « Pas traite 2027 », motif modifiable');
  await p.click('#pt-fiche-annuler');
  eq(await p.evaluate(() => situationTraiteCampagne(DB.brebis[0]).code), 'attendue', nom + ' : fiche : Annuler');
  await fiche('b8');
  check(await p.evaluate(() => /Marquée pas traite, mais contrôlée/.test(document.getElementById('pt-bloc-fiche').textContent)), nom + ' : fiche : écart signalé en ambre');
  await p.click('#pt-retirer-marque');
  eq(await p.evaluate(() => [situationTraiteCampagne(DB.brebis[7]).code, !!document.getElementById('pt-ecart')]), ['traite', false], nom + ' : fiche : marque retirée à la main, rien de corrigé seul avant');
  await fiche('b3');
  check(await p.evaluate(() => /Traite 2027/.test(document.getElementById('pt-bloc-fiche').textContent) && /tarie au 2/.test(document.getElementById('pt-bloc-fiche').textContent)), nom + ' : fiche : traite, tarie au 2e contrôle');
  console.log('OK 4 ' + nom + ' : fiche (action, motif, Annuler, écart, tarie).');

  // ================================================================ 5. sortie : message ambre, jamais de blocage ; après la sortie, plus dans Brebis à régulariser
  await p.evaluate(() => { currentSheepId = 'b1'; editContext = null; render('add-mouvement', 'b1'); });
  await p.click('.type-opt[data-val="Vente"]');
  check(await p.evaluate(() => /n°69001 : attendue à la traite en 2027\. La sortie reste possible/.test((document.getElementById('pt-alerte-mvt') || {}).textContent || '')), nom + ' : fiche, sortie : message ambre');
  await p.evaluate(() => { currentSheepId = 'b3'; editContext = null; render('add-mouvement', 'b3'); });
  await p.click('.type-opt[data-val="Vente"]');
  check(await p.evaluate(() => !(document.getElementById('pt-alerte-mvt') || {}).textContent), nom + ' : fiche, brebis traite : aucun message');
  if (bureau) {
    await p.evaluate(() => { mvPcEtat = null; render('inventaire'); }); await p.waitForSelector('#mv-table');
    await p.click('.mv-type[data-val="Vente"]'); await p.click('#mv-table tr.clic[data-id="b1"]'); await p.click('#mv-table tr.clic[data-id="b2"]'); await p.click('#mv-table tr.clic[data-id="b3"]');
    check(await p.evaluate(() => /n°69001, n°69002 : allaitantes ou attendues à la traite en 2027/.test((document.getElementById('pt-alerte-mv') || {}).textContent || '') && !document.getElementById('mv-valider').disabled), 'PC mouvement collectif : un seul message pour les brebis concernées, validation possible');
  } else {
    await p.evaluate(() => { mvMobNouveau = mvMobNouveauInitial('brebis'); renderNouveauMouvementMobile(); });
    await p.click('#mn-types .mn-chip[data-val="Vente"]');
    await p.check('#mn-liste .mn-it[data-id="b1"] input');
    check(await p.evaluate(() => /n°69001 : attendue à la traite en 2027/.test((document.getElementById('pt-alerte-mv') || {}).textContent || '')), 'mobile mouvement collectif : message ambre');
  }
  await p.evaluate(() => { CATEGORIE_ANIMAL_CONFIG.brebis.applySortie(DB.brebis[0], 'Vente', null, 'Acheteur C', '2027-03-19', null); });
  eq(await p.evaluate(() => [(DB.brebis[0].statut || 'active') !== 'active', Object.values(bilanARegulariserData().groupes).some(g => g.some(b => b.id === 'b1')), attendueTraiteListe().some(b => b.id === 'b1')]), [true, false, false], nom + ' : après la vente, la brebis quitte Brebis à régulariser et les attendues');
  console.log('OK 5 ' + nom + ' : sortie avec message ambre, jamais bloquée ; puis hors de Brebis à régulariser.');

  // ================================================================ 6. Paramètres › Listes, compte neuf, synchro
  eq(await p.evaluate(() => [compterUsageMotifNonTraite('Mammite'), renommerValeurListe('motifsNonTraite', 'Mammite', 'Mammite chronique').modifies, DB.brebis[4].nonTraite[0].motif, DB.brebis[8].nonTraite[0].motif]), [2, 2, 'Mammite chronique', 'Mammite chronique'], nom + ' : motifs : compteur et renommage sur les marques');
  eq(await p.evaluate(() => migrateData({}).motifsNonTraite), ['Agneaux morts', 'Mammite', 'Réforme prévue'], nom + ' : compte neuf : motifs de départ');
  eq(await p.evaluate(() => migrateData({ motifsNonTraite: [] }).motifsNonTraite), [], nom + ' : liste vidée par l\'éleveur : jamais re-remplie');
  console.log('OK 6 ' + nom + ' : motifs dans Paramètres › Listes, compte neuf.');
}
check(/'motifsNonTraite'/.test(readFileSync(new URL('../www/index.html', import.meta.url), 'utf8').match(/const META_FIELDS = \[[\s\S]*?\];/)[0]), 'motifs synchronisés (META_FIELDS)');
await browser.close();
console.log('TOUT OK test_pas_traite');
