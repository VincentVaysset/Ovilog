/* Agneau adopté sur la fiche brebis (mobile) : plus dans l'onglet Identification ; chez la mère qui l'ÉLÈVE (onglet Repro & Écho), il est dans « Devenir des agneaux »
   (pastille « Adopté », « né de n°… », Vendu / Mort) et noté à part sous son agnelage (« Adopté : … · ne compte pas dans sa portée ») ; chez la vraie mère, son devenir
   ne se règle plus (sauf si la mère adoptive n'est plus active) et sa mise bas garde l'agneau (« Adopté par n°… »). Rien n'est déplacé : même fiche d'agneau.
   saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => d.accept());
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true; DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  const fiche = (n, id) => ({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2023-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  DB.brebis = [fiche('669002', 'b1'), fiche('670118', 'b2'), fiche('670193', 'b3')]; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  const ag = (eid, sexe, o) => Object.assign({ sexe, eid: '250000045' + eid, mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-05' }] }, o || {});
  DB.brebis[0].agnelages = [{ date: '2026-11-05', campagne: 2026, codeRepro: 'MN', lambs: [ag('671045', 'Mâle', { adopte: true, adoptiveEid: '250000045670118' }), ag('671046', 'Femelle'), ag('671048', 'Femelle', { adopte: true, adoptiveEid: '250000045670193' })] }];
  DB.brebis[1].agnelages = [{ date: '2026-11-06', campagne: 2026, codeRepro: 'MN', lambs: [ag('671047', 'Femelle')] }];
});
const ouvrir = async (id, onglet) => { await p.evaluate(id => { currentSheepId = id; render('detail', id); }, id); await p.evaluate(t => [...document.querySelectorAll('.tab-btn, [data-tab]')].find(x => x.textContent.trim().startsWith(t)).click(), onglet); await p.waitForTimeout(100); };
const texte = () => p.evaluate(() => document.getElementById('app').textContent.replace(/\s+/g, ' '));
const devenir = () => p.evaluate(() => { const c = [...document.querySelectorAll('.card')].find(x => /Devenir des agneaux/.test(x.textContent)); return c ? [...c.querySelectorAll('.btn-lamb-vendu, .btn-lamb-annuler-sortie')].length + ':' + c.textContent.replace(/\s+/g, ' ') : ''; });

// 1. Identification : plus de carte « Agneaux adoptés »
await ouvrir('b2', 'Ident');
check(!/Agneaux adoptés|Mère biologique/.test(await texte()), 'Identification de la mère adoptive : plus de carte « Agneaux adoptés »');

// 2. mère adoptive, Repro & Écho : devenir avec l'adopté, agnelage avec la ligne à part (portée inchangée)
await ouvrir('b2', 'Repro');
const d2 = await devenir();
check(/n°71047/.test(d2) && /n°71045/.test(d2) && /Adopté/.test(d2) && /né de n°69002/.test(d2) && d2.startsWith('2:'), 'mère adoptive : devenir de son agneau ET de l\'adopté (Adopté, né de n°69002, Vendu) : ' + d2);
const t2 = await texte();
check(/1 agneau\(x\)/.test(t2) && /Adopté : n°71045/.test(t2) && /né de n°69002 le 05-11-2026 · ne compte pas dans sa portée/.test(t2), 'agnelage : portée « 1 agneau », adopté noté à part');
// régler le devenir chez la mère adoptive : même fiche d'agneau (dans la mise bas de la vraie mère)
await p.evaluate(() => { const c = [...document.querySelectorAll('.card')].find(x => /Devenir des agneaux/.test(x.textContent)); [...c.querySelectorAll('.btn-lamb-vendu')].find(b => /71045/.test(b.closest('div[style*="justify-content:space-between"]').textContent)).click(); });
await p.waitForTimeout(150);
check(await p.evaluate(() => !!document.querySelector('.modal-overlay, .sheet, .overlay, [class*="modal"]')), 'Vendu : la fenêtre de sortie s\'ouvre');
await p.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[0]; l.statutFinal = 'vendu'; });   // la fenêtre de sortie elle-même est testée ailleurs
// lien « né de n°69002 » : ouvre la vraie mère
await p.evaluate(() => { document.querySelector('.overlay, .modal-overlay') && document.querySelector('.overlay, .modal-overlay').remove(); currentSheepId = 'b2'; render('detail', 'b2'); });
await p.evaluate(() => [...document.querySelectorAll('.tab-btn, [data-tab]')].find(x => x.textContent.trim().startsWith('Repro')).click());
await p.evaluate(() => document.querySelector('.btn-voir-mere-bio-adopte').click());
eq(await p.evaluate(() => currentSheepId), 'b1', 'lien « né de n°69002 » : fiche de la vraie mère');

// 3. vraie mère : devenir sans les adoptés, mise bas avec eux (« Adopté par »)
await ouvrir('b1', 'Repro');
const d3 = await devenir();
check(/n°71046/.test(d3) && !/n°71045/.test(d3) && !/n°71048/.test(d3), 'vraie mère : le devenir des adoptés ne se règle plus chez elle : ' + d3);
const t3 = await texte();
check(/3 agneau\(x\)/.test(t3) && /Adopté par n°70118/.test(t3) && /Adopté par n°70193/.test(t3), 'vraie mère : sa mise bas garde ses 3 agneaux, « Adopté par … »');

// 4. mère adoptive sans mise bas cette campagne : carte « Agneau adopté · campagne en cours »
await ouvrir('b3', 'Repro');
check(await p.evaluate(() => !!document.getElementById('carte-agneau-adopte') && /Agneau adopté · campagne en cours/.test(document.getElementById('carte-agneau-adopte').textContent) && /n°71048/.test(document.getElementById('carte-agneau-adopte').textContent)), 'sans mise bas : carte « Agneau adopté · campagne en cours »');
check(/n°71048/.test(await devenir()), 'sans mise bas : l\'adopté est dans son devenir');

// 5. mère adoptive sortie (vendue) : l'agneau revient dans le devenir de sa vraie mère
await p.evaluate(() => { DB.brebis[2].statut = 'vendue'; });
await ouvrir('b1', 'Repro');
check(/n°71048/.test(await devenir()), 'mère adoptive plus active : devenir réglé de nouveau chez la vraie mère');

// 6. rien n'a été déplacé : chaque agneau est toujours dans la mise bas de sa vraie mère, une seule fois
eq(await p.evaluate(() => [DB.brebis[0].agnelages[0].lambs.length, DB.brebis[1].agnelages[0].lambs.length, (DB.brebis[2].agnelages || []).length]), [3, 1, 0], 'données inchangées : aucun agneau déplacé ni recopié');
await browser.close();
console.log('\nTOUS LES TESTS « AGNEAU ADOPTÉ SUR LA FICHE » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
