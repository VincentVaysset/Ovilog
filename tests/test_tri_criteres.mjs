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
  const autre = criteresTriCampagne(2027), plusTard = criteresTriCampagne(2029), avantLui = criteresTriCampagne(2025);
  return { lignes: t.lignes.map(l => [l.numero, l.refusee, l.proposee, l.decision, l.forcee]), comptes: [t.acceptees, t.refusees, t.forcees],
    autre: [autre.regles.map(r => r.conditions[0].valeur), autre.reprise, autre.decisions, Object.keys(DB.criteresTriAgnelles), plusTard.regles[0].conditions[0].valeur, avantLui.regles.length, criteresTriCampagne(2026).reprise] };
});
eq(d.lignes, [['71001', false, 'garder', 'ecarter', true], ['71003', true, 'ecarter', 'ecarter', false]], 'femelles à trier seulement ; proposition et décision forcée');
eq(d.comptes, [1, 1, 1], 'compteurs');
eq(d.autre, [['2027-11-15'], 2026, {}, ['2026'], '2029-11-15', 0, null], 'campagne suivante sans règles : celles de 2026 reprises, dates décalées d\'un an (de trois en 2029), sans décisions, rien d\'écrit ; aucune reprise vers le passé');
// décalage : 29/02 → 28/02, « entre » = les deux dates ; exceptions aussi ; valeurs multiples (repro, portée) ; ancienne règle à une valeur lue telle quelle
const m = await page.evaluate(() => {
  const ag = (classeMere, lactMere, date, origineNaissance, porteeNb) => ({ classeMere, lactMere, date, origineNaissance, porteeNb });
  const dec = decalerReglesTri([{ id: 'r', conditions: [{ critere: 'naissance', op: 'entre', valeur: '2028-02-29', valeur2: '2028-03-10' }], exceptions: [{ id: 'e', conditions: [{ critere: 'naissance', op: 'avant', valeur: '2027-12-01' }, { critere: 'lactation', op: 'auMoins', valeur: '412.5' }] }] }], 1);
  const multi = { critere: 'repro', op: 'egal', valeurs: ['RE', 'MN'] }, portee = { critere: 'portee', op: 'egal', valeurs: ['2', '3'] };
  return { dec: [dec[0].conditions[0].valeur, dec[0].conditions[0].valeur2, dec[0].exceptions[0].conditions.map(c => c.valeur)],
    multi: ['IA', 'EP', 'RE', 'MN', null].map(k => conditionTriRemplie(multi, ag(1, 1, '', k, 1))), portee: [1, 2, 3, 5].map(n => conditionTriRemplie(portee, ag(1, 1, '', 'IA', n))),
    libs: [libelleConditionTri(multi), libelleConditionTri(portee), libelleConditionTri({ critere: 'repro', op: 'egal', valeurs: ['aucun'] })],
    vide: conditionTriComplete({ critere: 'repro', op: 'egal', valeurs: [] }), ancienne: [conditionTriComplete({ critere: 'repro', op: 'egal', valeur: 'EP' }), conditionTriRemplie({ critere: 'repro', op: 'egal', valeur: 'EP' }, ag(1, 1, '', 'EP', 1)), libelleConditionTri({ critere: 'portee', op: 'egal', valeur: '1' })] };
});
eq(m.dec, ['2029-02-28', '2029-03-10', ['2028-12-01', '412.5']], 'décalage d\'un an : 29/02 → 28/02, les deux dates de « entre », exceptions comprises, litrage inchangé');
eq([m.multi, m.portee], [[false, false, true, true, false], [false, true, true, true]], 'choix multiples : une des valeurs cochées suffit');
eq(m.libs, ['Repro RE ou MN', 'Portée double ou triple et plus', 'Repro sans code'], 'libellés des choix multiples');
eq([m.vide, m.ancienne], [false, [true, true, 'Portée simple']], 'aucune valeur cochée = incomplet ; ancienne règle à une valeur lue telle quelle');
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
  // choix multiples à l'éditeur : repro RE ou MN (puces), puis retirée
  await pc.selectOption('.tc-crit[data-i="0"]', 'repro'); await pc.selectOption('.tc-op[data-i="0"]', 'egal');
  check(await pc.evaluate(() => [...document.querySelectorAll('.tc-multi .tc-mv')].map(b => b.textContent).join() === 'IA,EP,RE,MN,sans code'), 'repro : 5 puces');
  await pc.click('.tc-mv[data-v="MN"]'); await pc.click('.tc-mv[data-v="RE"]'); await pc.click('.tc-mv[data-v="IA"]'); await pc.click('.tc-mv[data-v="IA"]');
  await pc.click('#tc-enregistrer');
  eq([await res(), await pc.evaluate(() => criteresTriCampagne(2026).regles[2].conditions)], [[['71003', 'A'], ['71006', 'R'], ['71009', 'R']], [{ critere: 'repro', op: 'egal', valeurs: ['MN', 'RE'] }]], 'règle à choix multiples : MN ou RE refusée');
  check(/Repro MN ou RE/.test(await pc.textContent('#tc-regles')), 'libellé de la règle');
  await pc.click('.tc-suppr >> nth=2');
  // Modifier une exception : même éditeur, pré-rempli ; valeur changée (300 → 320 L) puis Annuler du bandeau
  check(await pc.evaluate(() => document.querySelectorAll('.tc-exc .tc-modifier-exc').length === 1 && document.querySelector('.tc-exc .tc-modifier-exc').nextElementSibling.classList.contains('tc-suppr-exc')), 'exception : Modifier avant Suppr.');
  await pc.click('.tc-modifier-exc');
  eq(await pc.evaluate(() => [document.querySelector('.tc-editeur-titre').textContent.startsWith('Modifier l\'exception'), document.querySelector('.tc-val[data-i="0"]').value, document.getElementById('tc-enregistrer').textContent]), [true, '300', 'Enregistrer'], 'éditeur de l\'exception pré-rempli');
  await pc.fill('.tc-val[data-i="0"]', '320'); await pc.click('#tc-enregistrer');
  eq([await res(), await pc.evaluate(() => criteresTriCampagne(2026).regles[0].exceptions.map(e => e.conditions[0].valeur))], [[['71003', 'A'], ['71006', 'R'], ['71009', 'R']], ['320']], 'exception modifiée (au moins 320 L : 318 L plus repêchée), toujours rattachée à sa règle');
  await pc.click('#sup-snack-annuler');
  eq(await pc.evaluate(() => criteresTriCampagne(2026).regles[0].exceptions.map(e => e.conditions[0].valeur)), ['300'], 'Annuler : exception d\'avant');
  // repli du panneau (écran sous 1800 px) : une ligne « 2 règles · 1 exception · Déplier »
  await pc.click('#tc-replier');
  eq(await pc.evaluate(() => [document.getElementById('tc-panneau-corps').offsetHeight, document.getElementById('tc-resume').textContent, document.getElementById('tc-replier').textContent]), [0, '2 règles · 1 exception', 'Déplier'], 'panneau replié');
  await pc.click('#tc-replier'); check(await pc.isVisible('#tc-editeur'), 'panneau déplié');
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
  // campagne suivante : règles reprises (ligne grise), écrites au 1er geste seulement ; Annuler = campagne de nouveau « sans règles »
  await pc.evaluate(() => { DB.campagneDebut = 2027; triPcEtat = null; render('agnelles'); });
  eq(await pc.evaluate(() => [document.getElementById('tc-reprise').textContent, document.getElementById('tc-regles').textContent.includes('Née après le 15-11-2027'), Object.keys(DB.criteresTriAgnelles)]),
    ['Règles reprises de la campagne 2027 : modifiez-les au besoin.', true, ['2026']], 'reprise affichée, date décalée, rien d\'écrit');
  await pc.click('.tc-modifier >> nth=1'); await pc.fill('.tc-val[data-i="0"]', '2027-11-14'); await pc.click('#tc-enregistrer');
  eq(await pc.evaluate(() => [Object.keys(DB.criteresTriAgnelles), DB.criteresTriAgnelles[2027].regles[1].conditions[0].valeur, DB.criteresTriAgnelles[2026].regles[1].conditions[0].valeur, !!document.getElementById('tc-reprise')]),
    [['2026', '2027'], '2027-11-14', '2026-11-15', false], '1er geste : règles écrites pour 2027 (modifiables), 2026 intacte');
  await pc.click('#sup-snack-annuler');
  eq(await pc.evaluate(() => [Object.keys(DB.criteresTriAgnelles), !!document.getElementById('tc-reprise')]), [['2026'], true], 'Annuler : 2027 de nouveau sans règles, reprise proposée');
  await pc.click('#tc-valider'); await pc.click('#qc-oui');
  eq(await pc.evaluate(() => Object.keys(DB.criteresTriAgnelles)), ['2026', '2027'], 'Valider le tri pendant une reprise : règles écrites pour 2027');
  await pc.click('#sup-snack-annuler');
  eq(await pc.evaluate(() => Object.keys(DB.criteresTriAgnelles)), ['2026'], 'Annuler la validation : 2027 de nouveau sans règles');
}
console.log('OK 3 écran PC : règles et exceptions, colonnes, tri, sélection, décisions forcées, exports, lot, Valider');

// ---- 4. lot de recherche d'agnelles à trier : mobile (bip = trouvée, hors du lot = message), PC (tableau charte triable)
for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 950 } : { width: 400, height: 860 } })).newPage();
  p.on('pageerror', e => erreurs.push(e.message));
  if (bureau) await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(() => {
    DB = migrateData({}); saveData = function () { return true; }; DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    const mere = (i, date, nb) => ({ id: 'm' + i, eid: '25000000451' + String(1000 + i), numeroCourtTravailSieol: String(600 + i), statut: 'active', mouvements: [], sanitaire: [],
      agnelages: [{ id: 'a' + i, date, campagne: 2026, codeRepro: 'IA', lambs: Array.from({ length: nb }, (_, k) => ({ id: 'l' + i + k, eid: '2500000045' + String(71000 + i * 3 + k), sexe: 'Femelle' })) }] });
    DB.brebis = [mere(1, '2026-11-02', 1), mere(2, '2026-11-04', 1), mere(3, '2026-11-19', 1)]; DB.agnelles = []; DB.lots = [];
    const lot = creerLotJournalise({ id: 'L1', nom: 'Agnelles à écarter', dateCreation: '2026-11-25' }, ['250000004571006', '250000004571009']);
    effacerTrouveesLot(lot.id); currentLotId = 'L1'; render('lot-search');
  });
  eq(await p.evaluate(() => [...document.querySelectorAll('#lot-tuiles .tuile-pc')].map(t => t.innerText.replace(/\s+/g, ' ').trim().toLowerCase())), ['trouvées 0', 'à trouver 2'], nom + ' : compteurs Trouvées / À trouver');
  if (!bureau) {
    check(/Née le 04-11-2026 · mère 602/.test(await p.textContent('#lot-cartes')), nom + ' : carte de l\'agnelle : née le, mère');
    eq(await p.evaluate(() => [...document.querySelectorAll('.tt-trier-par[data-tt="lot-recherche"] option')].map(o => o.textContent)), ["Comme à l'écran", 'N°', 'Née le', 'Mère', 'Trouvée'], nom + ' : « Trier par »');
  } else {
    eq(await p.evaluate(() => [document.getElementById('lot-table').className, [...document.querySelectorAll('#lot-table th')].map(t => [t.textContent, !!t.querySelector('.tt-tete')])]), ['pc-t', [['Trouvée', false], ['N°', true], ['Née le', true], ['Mère', true]]], nom + ' : tableau de la charte, triable');
  }
  await p.fill('#scan-lot', '71006'); await p.press('#scan-lot', 'Enter');
  check(/trouvée/.test(await p.textContent('#scan-feedback')) && /trouvées 1/.test(await p.evaluate(() => document.getElementById('lot-tuiles').innerText.replace(/\s+/g, ' ').toLowerCase())), nom + ' : n° d\'une agnelle du lot = trouvée');
  await p.fill('#scan-lot', '71003'); await p.press('#scan-lot', 'Enter');
  check(/pas dans ce lot/.test(await p.textContent('#scan-feedback')), nom + ' : agnelle hors du lot = « pas dans ce lot » : ' + await p.textContent('#scan-feedback'));
  await p.context().close();
}
console.log('OK 4 lot de recherche d\'agnelles : compteurs, bip trouvé / hors du lot, carte et tableau triables');
await browser.close();
console.log('test_tri_criteres : OK');
