/* Tri des agnelles par critères (PC). Moteur : règle « Refuser » = conditions en ET, exceptions RATTACHÉES à la règle (une exception ne lève
   jamais une autre règle), valeur inconnue jamais remplie (sauf « sans … »), règles par campagne, décisions forcées. Noms et n° fictifs. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
await page.evaluate(() => { DB = migrateData({}); saveData = function () { return true; }; DB.campagneDebut = 2026; DB.campagneInitialisee = true; });

// ---- 1. moteur
const r = await page.evaluate(() => {
  const C = (critere, op, valeur, valeur2) => Object.assign({ critere, op }, valeur !== undefined ? { valeur } : {}, valeur2 !== undefined ? { valeur2 } : {});
  const regles = [
    { id: 'r1', conditions: [C('classe', 'egale', '4')], exceptions: [{ id: 'e1', conditions: [C('lactation', 'auMoins', '300')] }] },
    { id: 'r2', conditions: [C('naissance', 'apres', '2026-11-15')], exceptions: [] }
  ];
  const ag = (classeMere, lactMere, date, origineNaissance, porteeNb) => ({ classeMere, lactMere, date, origineNaissance, porteeNb });
  return {
    exemple: evaluerAgnelleTri(ag(4, 318, '2026-11-19', 'IA', 1), regles),          // classe 4 à 318 L née le 19/11 : refusée (l'exception ne lève pas la règle de date)
    repechee: evaluerAgnelleTri(ag(4, 318, '2026-11-10', 'IA', 1), regles),
    classe4: evaluerAgnelleTri(ag(4, 262, '2026-11-05', 'IA', 1), regles),
    acceptee: evaluerAgnelleTri(ag(1, 412, '2026-11-02', 'IA', 2), regles),
    inconnue: evaluerAgnelleTri(ag(null, null, '2026-11-02', null, null), regles),
    et: evaluerAgnelleTri(ag(3, 250, '2026-11-02', 'MN', 2), [{ id: 'r', conditions: [C('repro', 'egal', 'MN'), C('portee', 'egal', '2')], exceptions: [] }]),
    etNon: evaluerAgnelleTri(ag(3, 250, '2026-11-02', 'MN', 1), [{ id: 'r', conditions: [C('repro', 'egal', 'MN'), C('portee', 'egal', '2')], exceptions: [] }]),
    sans: [conditionTriRemplie(C('classe', 'sans'), ag(null, 1)), conditionTriRemplie(C('lactation', 'sans'), ag(2, null)), conditionTriRemplie(C('repro', 'egal', 'aucun'), ag(2, 1, '', null)), conditionTriRemplie(C('classe', 'sans'), ag(2))],
    entre: [conditionTriRemplie(C('naissance', 'entre', '2026-11-01', '2026-11-10'), ag(1, 1, '2026-11-10')), conditionTriRemplie(C('naissance', 'entre', '2026-11-01', '2026-11-10'), ag(1, 1, '2026-11-11'))],
    triple: [conditionTriRemplie(C('portee', 'egal', '3'), ag(1, 1, '', '', 4)), conditionTriRemplie(C('portee', 'egal', '3'), ag(1, 1, '', '', 2))],
    reproCodes: ['IA', 'EP', 'RE', 'MN'].map(k => conditionTriRemplie(C('repro', 'egal', k), ag(1, 1, '', 'RE', 1))),
    incomplete: [conditionTriComplete(C('lactation', 'moinsDe', '')), conditionTriComplete(C('naissance', 'entre', '2026-11-01')), conditionTriComplete(C('classe', 'egale', '5'))],
    libelles: [libelleConditionsTri(regles[0].conditions), libelleConditionsTri(regles[0].exceptions[0].conditions), libelleConditionsTri([C('naissance', 'entre', '2026-11-01', '2026-11-10'), C('portee', 'egal', '2')])]
  };
});
eq(r.exemple, { refusee: true, motifs: ['Née après le 15-11-2026'], repechages: ['Classe de la mère = 4 · repêchée (Lactation de la mère au moins 300 L)'] }, 'exemple : classe 4 à 318 L née le 19/11 = refusée par la règle de date');
eq([r.repechee.refusee, r.classe4.refusee, r.classe4.motifs, r.acceptee.refusee], [false, true, ['Classe de la mère = 4'], false], 'classe 4 repêchée par sa propre exception, sinon refusée ; classe 1 acceptée');
eq(r.inconnue.refusee, false, 'valeurs inconnues : aucune condition remplie');
eq([r.et.refusee, r.etNon.refusee], [true, false], 'conditions liées par ET');
eq(r.sans, [true, true, true, false], '« sans classe », « sans lactation connue », « sans code »');
eq([r.entre, r.triple, r.reproCodes], [[true, false], [true, false], [false, false, true, false]], 'entre (bornes comprises), triple et plus, 4 codes repro séparés');
eq(r.incomplete, [false, false, false], 'conditions incomplètes jamais remplies');
eq(r.libelles, ['Classe de la mère = 4', 'Lactation de la mère au moins 300 L', 'Née entre le 01-11-2026 et le 10-11-2026 et Portée double'], 'libellés en mots');

// ---- 2. règles par campagne, décisions forcées, sur les agnelles à trier
const d = await page.evaluate(() => {
  DB.brebis = [{ id: 'm1', eid: '250000004510001', statut: 'active', agnelages: [{ id: 'a1', date: '2026-11-02', campagne: 2026, codeRepro: 'IA', lambs: [{ id: 'l1', eid: '250000004571001', sexe: 'Femelle' }, { id: 'l2', eid: '250000004571002', sexe: 'Mâle' }] }], mouvements: [], sanitaire: [] },
    { id: 'm2', eid: '250000004510002', statut: 'active', agnelages: [{ id: 'a2', date: '2026-11-19', campagne: 2026, codeRepro: 'MN', lambs: [{ id: 'l3', eid: '250000004571003', sexe: 'Femelle' }] }], mouvements: [], sanitaire: [] }];
  DB.lactationModele = [{ eid: '250000004510001', campagne: 2025, lactationTotale: 318, classeParQuart: 4 }, { eid: '250000004510002', campagne: 2025, lactationTotale: 410, classeParQuart: 1 }];
  ecrireCriteresTri(2026, { regles: [{ id: 'r1', conditions: [{ critere: 'naissance', op: 'apres', valeur: '2026-11-15' }], exceptions: [] }], decisions: { '250000004571001': 'ecarter' } });
  const t = triCriteresDonnees();
  const autre = criteresTriCampagne(2027);
  return { lignes: t.lignes.map(l => [l.numero, l.refusee, l.proposee, l.decision, l.forcee]), comptes: [t.acceptees, t.refusees, t.forcees], autre: autre.regles.length };
});
eq(d.lignes, [['71001', false, 'garder', 'ecarter', true], ['71003', true, 'ecarter', 'ecarter', false]], 'femelles à trier seulement ; proposition et décision forcée');
eq([d.comptes, d.autre], [[1, 1, 1], 0], 'compteurs ; règles propres à la campagne');
check(!erreurs.length, 'aucune erreur JS ' + erreurs.join(' | '));
console.log('OK 1-2 moteur des critères');

// ---- 3. écran PC : règles, exceptions, colonnes, sélection, décisions, Valider, exports, lot de recherche
{
  const pc = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  pc.on('pageerror', e => erreurs.push(e.message));
  const dialogues = []; pc.on('dialog', d => { dialogues.push(d.type()); d.accept(); });
  await pc.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  await pc.goto(URL_APP, { waitUntil: 'load' }); await pc.waitForTimeout(300);
  await pc.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; }; DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    const mere = (i, date, code, nb) => ({ id: 'm' + i, eid: '25000000451' + String(1000 + i), numeroCourtTravailSieol: String(600 + i), statut: 'active', mouvements: [], sanitaire: [],
      agnelages: [{ id: 'a' + i, date, campagne: 2026, codeRepro: code, lambs: Array.from({ length: nb }, (_, k) => ({ id: 'l' + i + k, eid: '2500000045' + String(71000 + i * 3 + k), sexe: k === 0 ? 'Femelle' : 'Mâle' })) }] });
    DB.brebis = [mere(1, '2026-11-02', 'IA', 2), mere(2, '2026-11-04', 'MN', 1), mere(3, '2026-11-19', 'IA', 1)];
    DB.lactationModele = [{ eid: DB.brebis[0].eid, campagne: 2025, lactationTotale: 412, classeParQuart: 1 }, { eid: DB.brebis[1].eid, campagne: 2025, lactationTotale: 318, classeParQuart: 4 }, { eid: DB.brebis[2].eid, campagne: 2025, lactationTotale: 318, classeParQuart: 4 }];
    DB.agnelles = []; DB.lots = [];
    window.__xl = []; window.__f = [];
    buildXlsxWorkbook = async (f) => { window.__xl.push(JSON.parse(JSON.stringify(f))); return new Uint8Array([1]); };
    saveOrShareBinaryFile = async (n, b) => { window.__f.push({ n, b: Array.from(b) }); };
    triPcEtat = null; render('agnelles');
  });
  const res = () => pc.evaluate(() => [...document.querySelectorAll('#ta-table-atrier tr[data-eid]')].map(r => [r.children[1].textContent, r.className.includes('tc-refusee') ? 'R' : 'A']));
  eq(await res(), [['71003', 'A'], ['71006', 'A'], ['71009', 'A']], 'sans règle : toutes acceptées');
  eq(await pc.evaluate(() => DB.criteresTriAgnelles === undefined), true, 'aucun seuil préréglé, rien d\'écrit');
  // règle « classe = 4 » par l'éditeur
  await pc.selectOption('.tc-crit[data-i="0"]', 'classe'); await pc.selectOption('.tc-op[data-i="0"]', 'egale');
  await pc.click('#tc-enregistrer');
  check(await pc.isVisible('#tc-editeur-err'), 'condition incomplète : message, rien d\'ajouté');
  await pc.selectOption('.tc-val[data-i="0"]', '4'); await pc.click('#tc-enregistrer');
  eq([await res(), await pc.evaluate(() => criteresTriCampagne(2026).regles.length)], [[['71003', 'A'], ['71006', 'R'], ['71009', 'R']], 1], 'règle ajoutée : classe 4 refusées');
  // exception de CETTE règle : lactation au moins 300 L ; puis règle de date sans exception
  await pc.click('.tc-ajout-exc');
  await pc.selectOption('.tc-crit[data-i="0"]', 'lactation'); await pc.selectOption('.tc-op[data-i="0"]', 'auMoins'); await pc.fill('.tc-val[data-i="0"]', '300'); await pc.click('#tc-enregistrer');
  eq(await res(), [['71003', 'A'], ['71006', 'A'], ['71009', 'A']], 'exception : classe 4 à 318 L repêchée');
  await pc.selectOption('.tc-crit[data-i="0"]', 'naissance'); await pc.selectOption('.tc-op[data-i="0"]', 'apres'); await pc.fill('.tc-val[data-i="0"]', '2026-11-15'); await pc.click('#tc-enregistrer');
  eq(await res(), [['71003', 'A'], ['71006', 'A'], ['71009', 'R']], 'règle de date : l\'exception de la 1re règle ne la lève pas (classe 4, 318 L, née le 19/11 = refusée)');
  eq(await pc.evaluate(() => [...document.querySelectorAll('.tc-tuiles .tuile-pc')].map(t => t.innerText.replace(/\s+/g, ' ').trim())), ['Femelles nées à trier 3', 'Acceptées 2', 'Refusées 1', 'Décisions forcées 0'], 'tuiles');
  // supprimer puis Annuler
  await pc.click('.tc-suppr >> nth=1'); eq((await res())[2][1], 'A', 'règle supprimée');
  await pc.click('#sup-snack-annuler'); eq((await res())[2][1], 'R', 'Annuler : règle remise');
  // colonnes : Motif masquée au départ, affichée au clic
  check(await pc.evaluate(() => ![...document.querySelectorAll('#ta-table-atrier th')].some(t => t.textContent === 'Motif')), 'Motif masquée au départ');
  await pc.click('.tc-chip[data-col="motif"]');
  check(/Née après le 15-11-2026/.test(await pc.evaluate(() => document.querySelector('#ta-table-atrier tr[data-eid="' + DB.brebis[2].agnelages[0].lambs[0].eid + '"]').textContent)), 'Motif affiché : la règle qui refuse');
  // tri par en-tête (composant commun)
  await pc.click('#ta-table-atrier .tt-tete[data-col="res"]');
  eq((await res()).map(r => r[1]), ['A', 'A', 'R'], 'tri par Résultat');
  // décision forcée (bleu), sans rien écrire sur les agnelles
  await pc.click('.tc-dec[data-eid="' + await pc.evaluate(() => DB.brebis[0].agnelages[0].lambs[0].eid) + '"] button[data-val="ecarter"]');
  check(await pc.evaluate(() => document.querySelectorAll('.tc-force').length === 1 && getComputedStyle(document.querySelector('.tc-force')).color === getComputedStyle(document.body).getPropertyValue('--ch-bleu').trim().replace(/^#(..)(..)(..)$/, (m, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`) && DB.agnelles.length === 0 && !DB.brebis[0].agnelages[0].lambs[0].triStatut), 'décision forcée affichée en bleu, rien d\'écrit sur l\'agnelle');
  // sélection : 2 cochées, impression « Sélectionnées (2) », exports
  await pc.click('.tc-sel >> nth=0'); await pc.click('.tc-sel >> nth=1');
  check(/Sélectionnées \(2\)/.test(await pc.textContent('.tc-imprimer')), 'Sélectionnées (2)');
  await pc.click('.tc-imprimer button[data-val="sel"]');
  await pc.click('#tc-export'); await pc.click('#tc-export-pdf'); await pc.waitForTimeout(150);
  const xl = await pc.evaluate(() => window.__xl[0][0]);
  eq([xl.rows[0], xl.rows.length], [['Agnelle', 'Née le', 'Portée', 'Repro', 'Mère', 'Classe', 'Lact. mère', 'Résultat', 'Motif', 'Décision'], 3], 'Excel : colonnes affichées, les 2 sélectionnées');
  const pdf = await pc.evaluate(() => { const f = window.__f.find(x => /\.pdf$/.test(x.n)); return { n: f.n, t: new TextDecoder('latin1').decode(new Uint8Array(f.b)) }; });
  check(/tri-agnelles-criteres_.*\.pdf/.test(pdf.n) && /MediaBox \[0 0 595/.test(pdf.t), 'PDF en portrait A4 : ' + pdf.n);
  check(await pc.evaluate(() => [...document.querySelectorAll('.tc-actions .btn')].map(b => b.textContent + ':' + (b.classList.contains('btn-primary') ? 'vert' : 'blanc')).join('|')) === 'Export Excel:blanc|Export PDF:blanc|Créer un lot de recherche:blanc|Valider le tri:vert', 'boutons : Export Excel puis Export PDF (blancs), Valider le tri seul bouton vert');
  // lot de recherche à partir des cochées
  await pc.click('#tc-lot'); check(await pc.isVisible('#creer-lot-recherche'), 'fenêtre « Créer un lot de recherche »');
  await pc.click('#lr-ok');
  eq(await pc.evaluate(() => DB.lots.map(l => [l.nom, l.membres.length])), [['Agnelles du tri ' + await pc.evaluate(() => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }), 2]], 'lot créé avec les 2 agnelles cochées (décisions mêlées : nom daté)');
  await pc.click('#sup-snack-annuler'); eq(await pc.evaluate(() => DB.lots.length), 0, 'Annuler : lot retiré');
  // Valider le tri : message de la charte, puis Annuler = état exact d'avant
  const avant = await pc.evaluate(() => JSON.stringify(DB.brebis));
  await pc.click('#tc-valider');
  check(/1 agnelle gardée, 2 écartées/.test(await pc.textContent('#question-charte')), 'Valider : 1 gardée (71006), 2 écartées (71003 forcée, 71009 refusée)');
  await pc.click('#qc-oui');
  eq(await pc.evaluate(() => [DB.agnelles.map(a => a.eid.slice(-5)), DB.brebis.flatMap(b => b.agnelages[0].lambs).filter(l => l.sexe === 'Femelle').map(l => l.triStatut)]), [['71006'], ['écartée', 'gardée', 'écartée']], 'tri appliqué');
  await pc.click('#sup-snack-annuler');
  eq(await pc.evaluate(a => [DB.agnelles.length, JSON.stringify(DB.brebis) === a], avant), [0, true], 'Annuler : état exact d\'avant');
  eq(dialogues, [], 'aucune boîte native (confirm / alert)');
}
console.log('OK 3 écran PC : règles et exceptions, colonnes, tri, sélection, décisions forcées, exports, lot, Valider');
await browser.close();
console.log('test_tri_criteres : OK');
