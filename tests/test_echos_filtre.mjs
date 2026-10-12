/* Chantier « Lots échographies », partie 1 : critères d'échographie COMMUNS au PC et au mobile (fonctions pures derniereEchoCampagne, echoCorrespond, echoResumeCampagne,
   echoAideCriteres, casParticuliersDisponibles). Jeu synthétique ; l'export réel, s'il est présent, est lu en LECTURE SEULE (section finale : comptes seulement). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_ORIGINAL, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext()).newPage();
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026;
  const e = (date, extra) => Object.assign({ type: 'stade', date, stade: null, agneaux: null, nombreAgneaux: null, special: null, parasitisme: false, campagne: 2026 }, extra);
  const b = (n, echos) => ({ id: 'b' + n, eid: '25001629910000' + String(n).padStart(2, '0'), statut: 'active', echographies: echos });
  DB.brebis = [
    b(1, [e('2026-09-01', { type: 'constat', stade: 'Pleine' })]),                                                  // Gestante, sans comptage
    b(2, [e('2026-09-01', { type: 'constat', stade: 'Vide' })]),                                                    // constat Vide
    b(3, [e('2026-09-01', { stade: 'Milieu', agneaux: 'Double' })]),
    b(4, [e('2026-09-01', { stade: 'Fin', nombreAgneaux: 3 })]),                                                    // 3 agneaux -> Double
    b(5, [e('2026-09-01', { stade: 'Début', nombreAgneaux: 1 })]),                                                  // 1 agneau -> Simple
    b(6, [e('2026-09-01', { stade: 'Milieu', agneaux: 'Simple' }), e('2026-08-01', { stade: 'Vide' })]),            // deux échos, la plus récente est insérée AVANT
    b(7, []),                                                                                                       // aucune écho
    b(8, [e('2026-10-02', { stade: 'Milieu', agneaux: 'Double', campagne: 2027 })]),                                // écho « à venir »
    b(9, [e('2026-09-02', { stade: 'Fin', campagne: undefined })]),                                                  // sans tag de campagne
    b(10, [e('2026-09-03', { special: 'Avortée', parasitisme: true })]),                                             // cas particulier + parasitisme
    b(11, [e('2026-09-03', { special: 'Boiterie' })]),                                                               // cas ajouté par l'éleveur, absent de la liste
    b(12, [e('2026-09-04', { type: 'constat', stade: 'Pleine', agneaux: 'Double' })]),                               // constat compté
    b(13, [e('2026-09-04', { type: 'stade_comptage', stade: 'Milieu', agneaux: 'Double' })]),                        // ancien type
    b(14, [e('2026-09-05', { stade: 'IA', agneaux: 'Simple' })]),
    b(15, [e('2025-09-05', { type: 'constat', stade: 'Vide', campagne: 2025 })]),                                    // campagne passée seulement
    b(17, [e('2026-09-06', {})]),                                                                                     // écho sans résultat (donnée incomplète) : « autres »
    { id: 'b16', eid: '2500162991000016', statut: 'vendu', echographies: [e('2026-09-01', { stade: 'Vide' })] }       // non active : jamais comptée par l'appelant
  ];
  window.__avant = JSON.stringify(DB);
});
const sel = (c) => page.evaluate((c0) => { const base = Object.assign(criteresEchoVides(), { campagne: 2026 }, c0); return DB.brebis.filter(s => s.statut === 'active' && echoCorrespond(s, base)).map(s => parseInt(s.eid.slice(-2), 10)); }, c);
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));

// 1. dernière écho de la campagne = la plus récente PAR DATE, quel que soit l'ordre d'insertion ; tag absent = aucune campagne
const r1 = await page.evaluate(() => ({ b6: derniereEchoCampagne(DB.brebis[5], 2026).stade, b7: derniereEchoCampagne(DB.brebis[6], 2026), b8: derniereEchoCampagne(DB.brebis[7], 2026), b8a: derniereEchoCampagne(DB.brebis[7], 2027).date, b9: derniereEchoCampagne(DB.brebis[8], 2026), b15: derniereEchoCampagne(DB.brebis[14], 2026) }));
check(r1.b6 === 'Milieu' && r1.b7 === null && r1.b8 === null && r1.b8a === '2026-10-02' && r1.b9 === null && r1.b15 === null, 'derniereEchoCampagne : ' + JSON.stringify(r1));
console.log('OK 1 dernière écho de la campagne : par date réelle, une écho « à venir » (2027) n\'entre pas en 2026, sans tag = aucune campagne, campagne passée ignorée.');

// 2. sans critère : toutes les brebis (avec ou sans écho) ; type
eq(await sel({}), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17], 'sans critère, la liste n\'est pas restreinte');
eq(await sel({ type: 'constat' }), [1, 2, 12], 'type Constat');
eq(await sel({ type: 'stades' }), [3, 4, 5, 6, 10, 11, 13, 14, 17], 'type Stades (stade_comptage ancien inclus, cas particuliers de type stade inclus)');
console.log('OK 2 type Constat / Stades.');

// 3. stades, agneaux, ou / et
eq(await sel({ stades: ['Milieu', 'Fin'], agneaux: ['Double'] }), [3, 4, 13], '(Milieu ou Fin) ET Double : comptage exact 3 = Double, ancien type inclus, Milieu Simple exclu');
eq(await sel({ stades: ['Milieu'] }), [3, 6, 13], 'Milieu : la dernière écho de la brebis 6 (Milieu) fait foi, pas le Vide plus ancien');
eq(await sel({ stades: ['Vide'] }), [2], 'Vide : constat Vide ; la brebis 6 n\'est plus vide (sa dernière écho est Milieu)');
eq(await sel({ stades: ['Gestante'] }), [1, 12], 'Gestante (constat)');
eq(await sel({ stades: ['Gestante'], agneaux: ['Double'] }), [12], 'Gestante ET Double : constat compté');
eq(await sel({ agneaux: ['Simple'] }), [5, 6, 14], 'Simple = agneaux Simple ou nombreAgneaux 1');
eq(await sel({ agneaux: ['Simple', 'Double'] }), [3, 4, 5, 6, 12, 13, 14], 'Simple ou Double');
eq(await sel({ stades: ['IA'] }), [14], 'stade IA');
console.log('OK 3 « ou » dans un groupe, « et » entre groupes ; comptage exact ; constat compté ; ancien type.');

// 4. Vide + comptage : rien n'est effacé, zéro résultat pour Vide, aide ; avec un autre stade, seuls les autres comptent
eq(await sel({ stades: ['Vide'], agneaux: ['Double'] }), [], 'Vide + Double : aucun résultat');
eq(await sel({ stades: ['Vide', 'Milieu'], agneaux: ['Double'] }), [3, 13], 'Vide ou Milieu, ET Double');
const aide = await page.evaluate(() => { const c = Object.assign(criteresEchoVides(), { stades: ['Vide'], agneaux: ['Double'] }); const m = echoAideCriteres(c); return { m, c: JSON.stringify(c), sans: echoAideCriteres(Object.assign(criteresEchoVides(), { stades: ['Milieu'], agneaux: ['Double'] })) }; });
check(/^Vide n'a pas d'agneaux/.test(aide.m) && aide.sans === '' && JSON.parse(aide.c).stades[0] === 'Vide' && JSON.parse(aide.c).agneaux[0] === 'Double', 'aide affichée, critères intacts : ' + JSON.stringify(aide));
console.log('OK 4 « Vide » avec comptage : aide, aucun critère modifié, zéro résultat pour Vide.');

// 5. cas particuliers : Parasitisme (fixe) ou liste, valeurs présentes sur les échos
eq(await sel({ cas: ['__parasitisme'] }), [10], 'Parasitisme');
eq(await sel({ cas: ['Avortée'] }), [10], 'Avortée');
eq(await sel({ cas: ['__parasitisme', 'Boiterie'] }), [10, 11], 'Parasitisme ou Boiterie (ajoutée par l\'éleveur)');
eq(await sel({ cas: ['Pseudogestation'] }), [], 'Pseudogestation : aucune');
eq(await sel({ cas: ['Avortée'], stades: ['Milieu'] }), [], 'cas particulier ET stade : une écho cas particulier n\'a pas de stade');
const dispo = await page.evaluate(() => casParticuliersDisponibles(DB.brebis, DB.casParticuliers));
eq(dispo, ['Pseudogestation', 'Avortée', 'Boiterie'], 'cas proposés : liste + valeurs présentes sur les échos');
console.log('OK 5 cas particuliers : chip Parasitisme + liste + cas de l\'éleveur ; liste lue dynamiquement.');

// 6. campagne et dates (la dernière écho de la campagne fait foi, pas une écho plus ancienne de la plage)
eq(await page.evaluate(() => { const c = Object.assign(criteresEchoVides(), { campagne: 2027, type: 'stades' }); return DB.brebis.filter(s => echoCorrespond(s, c)).map(s => s.id); }), ['b8'], 'campagne à venir (2027) : écho taguée à venir');
eq(await sel({ du: '2026-09-01', au: '2026-09-01' }), [1, 2, 3, 4, 5, 6], 'plage = 01/09 : écho du jour');
eq(await sel({ au: '2026-08-31' }), [], 'avant le 31/08 : la brebis 6 a bien un Vide du 01/08 mais sa dernière écho est du 01/09');
eq(await sel({ du: '2026-09-04' }), [12, 13, 14, 17], 'du 04/09');
console.log('OK 6 campagne en cours / à venir, dates de l\'écho de référence.');

// 7. résumé (ligne d'info) : catégories exclusives, somme = total, sans campagne à part
const res = await page.evaluate(() => echoResumeCampagne(DB.brebis.filter(s => s.statut === 'active'), 2026));
eq(res, { total: 16, vides: 1, simples: 3, doubles: 4, gestantesSansComptage: 1, casParticuliers: 2, autres: 1, sansEcho: 4, sansCampagne: 1 }, 'résumé 2026');
check(res.vides + res.simples + res.doubles + res.gestantesSansComptage + res.casParticuliers + res.autres + res.sansEcho === res.total, 'la somme des catégories = total');
console.log('OK 7 résumé : vides 1 · simples 3 · doubles 4 · gestantes sans comptage 1 · cas particuliers 2 · autres 1 · sans écho 4 dont 1 écho sans campagne.');

// 8. libellés
const lib = await page.evaluate(() => [echoTypeLibelle(DB.brebis[0].echographies[0]), echoTypeLibelle(DB.brebis[12].echographies[0]), echoAgneauxLibelle(DB.brebis[2].echographies[0]), echoAgneauxLibelle(DB.brebis[4].echographies[0]), echoAgneauxLibelle(DB.brebis[3].echographies[0]), echoAgneauxLibelle(DB.brebis[0].echographies[0]), echoCasLibelles(DB.brebis[9].echographies[0]).join('+')]);
eq(lib, ['Constat', 'Stades', '2+', '1', '2+', '', 'PARASIT.+Avortée'], 'libellés');
console.log('OK 8 libellés (type, 1 / 2+, pastilles).');

// 9. pureté
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'aucune écriture, aucune modification');
console.log('OK 9 fonctions pures : DB inchangée, aucun enregistrement.');

// 10. données réelles, LECTURE SEULE : comptes
if (exportPresent(EXPORT_ORIGINAL)) {
  const reel = lireExport(EXPORT_ORIGINAL);
  const out = await page.evaluate((d) => {
    DB = migrateData(d); window.__saves = 0; saveData = function () { window.__saves++; };
    const avant = JSON.stringify(DB);
    const actives = DB.brebis.filter(s => (s.statut || 'active') === 'active');
    const camps = {}; let sans = 0, total = 0;
    DB.brebis.forEach(s => (s.echographies || []).forEach(x => { total++; if (x.campagne === undefined || x.campagne === null) sans++; else camps[x.campagne] = (camps[x.campagne] || 0) + 1; }));
    const out = {}; Object.keys(camps).forEach(c => { out[c] = echoResumeCampagne(actives, Number(c)); });
    const cas = casParticuliersDisponibles(DB.brebis, DB.casParticuliers);
    return { total, sans, camps, resume: out, nbActives: actives.length, cas, intact: JSON.stringify(DB) === avant && window.__saves === 0 };
  }, reel);
  check(out.intact, 'données réelles : aucune écriture');
  check(out.sans === 0, 'données réelles : échos sans tag de campagne = ' + out.sans);
  Object.values(out.resume).forEach(r => check(r.vides + r.simples + r.doubles + r.gestantesSansComptage + r.casParticuliers + r.autres + r.sansEcho === r.total && r.total === out.nbActives, 'réel : somme = brebis actives'));
  console.log('OK 10 données réelles (lecture seule) : ' + out.total + ' échos, ' + out.sans + ' sans tag de campagne, par campagne ' + JSON.stringify(out.camps) + ' ; résumé ' + JSON.stringify(out.resume) + ' ; cas ' + JSON.stringify(out.cas));
}
await browser.close();
console.log('\nTOUS LES TESTS DES CRITÈRES D\'ÉCHOGRAPHIE SONT PASSÉS');
