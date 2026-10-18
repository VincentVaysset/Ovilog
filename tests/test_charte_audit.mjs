/* Corrections de l'audit charte (mobile 390 px, PC 1500 px, PDF) : une section par cause (A, B, C…), dans l'ordre des commits.
   Jeu SYNTHÉTIQUE (lib/jeu_pc_ecrans.mjs), saveData REMPLACÉ, aucune écriture. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuPcEcrans } from './lib/jeu_pc_ecrans.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
async function ouvrir(pc) {
  const page = await (await browser.newContext({ viewport: pc ? { width: 1500, height: 950 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-14T09:00:00'));
  if (pc) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.dismiss());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  return page;
}
const pc = await ouvrir(true), mob = await ouvrir(false);
const ecran = async (page, code) => { await page.evaluate(jeuPcEcrans); await page.evaluate(() => { document.querySelectorAll('.modal-overlay, .sheet-overlay').forEach(o => o.remove()); currentSheepId = 'B1'; currentBelierId = 'bel1'; currentAgnelleId = 'ag1'; currentLotId = 'L1'; }); await page.evaluate(code); await page.waitForTimeout(150); };
const texteApp = (page) => page.evaluate(() => document.getElementById('app').innerText);

// ---------------------------------------------------------------- A. Carnet sanitaire PC : aucun texte de balise affiché
await ecran(pc, "render('sanitaire')");
check(!/div style=|<\/?(div|table)/.test(await texteApp(pc)), 'A. Carnet sanitaire (PC) : aucun morceau de balise affiché');
check(await pc.evaluate(() => !!document.querySelector('#cs-derniers > div > table#cs-table-derniers')), 'A. tableau « Derniers soins » dans son conteneur à défilement');
console.log('A OK');

// ---------------------------------------------------------------- B. Tons des tuiles : jamais de rouge pour un zéro ou un « — » (écran mobile, PC et PDF)
{
  const u = await pc.evaluate(() => [tonTuile(0, 'rouge'), tonTuile('0,0 %', 'ambre', true), tonTuile(3, 'rouge'), tonTuile('—', 'vert'), tonTuile('', 'bleu'), tonTuile(0, 'vert'), tonTuile('9,2 %', 'ambre', true),
    ...(() => { const f = (t, v) => JSON.stringify(pdfTuile(t, 'x', v).fond), n = f('neutre', 5); return [f('rouge', 0) === n, f('rouge', 2) === n, f('vert', '—') === n]; })()]);
  eq(u, ['neutre', 'neutre', 'rouge', 'neutre', 'neutre', 'vert', 'ambre', true, false, true], 'B. règle commune tonTuile / pdfTuile');
  const tuilesM = async (code, sel) => { await ecran(mob, code); return mob.evaluate(s => [...document.querySelectorAll(s)].map(t => (t.querySelector('.reg-tuile-l, .l') || t).textContent.trim() + '|' + t.textContent.replace(/\s+/g, ' ').trim() + '|' + t.className), sel); };
  const repro = await tuilesM("bilanCampagneTab = 'reproduction'; render('bilan-campagne')", '.bc-tuiles .reg-tuile');
  check(repro.length === 4 && !/rouge/.test(repro[3]) && /Mort\. après naissance/.test(repro[3]), 'B. Bilan de reproduction (mobile) : « Mort. après naissance » jamais rouge : ' + repro[3]);
  for (const v of ['agnelage', 'mouvements', 'sanitaire']) {
    const t = await tuilesM(`registreView = '${v}'; render('registre')`, '#registre-tuiles .reg-tuile');
    check(t.length === 4 && t.every(x => !/ rouge/.test(x)), 'B. Registre ' + v + ' (mobile) : aucune tuile rouge : ' + JSON.stringify(t));
  }
  const t12 = await tuilesM("DB.exploitation = Object.assign({}, DB.exploitation, { elevageBio: true }); render('traitements-12-mois')", '#m12 .tuile-charte');
  check(t12.length === 3 && t12.every(x => !/rouge/.test(x)), 'B. Traitements 12 mois (mobile) : 3 tuiles de la charte, pas de rouge à 0 : ' + JSON.stringify(t12));
  await ecran(pc, "render('echo-rapide')");
  const ep = await pc.evaluate(() => [...document.querySelectorAll('.ep-tuile')].map(t => t.className + '|' + t.querySelector('.reg-tuile-v').textContent));
  check(ep.slice(1, 3).every(x => /\|0$/.test(x) && / neutre /.test(x)), 'B. Échographies (PC) : « Vides » et « Vides définitives » à 0 en neutre : ' + JSON.stringify(ep));
  await ecran(pc, "render('home')");
  check(await pc.evaluate(() => ![...document.querySelectorAll('#app .t-rouge')].some(b => b.textContent.trim() === '0')), 'B. Accueil (PC) : aucun 0 en rouge');
}
console.log('B OK');

// ---------------------------------------------------------------- C. Boutons principaux toujours verts (plus de fond rouge, ambre, bleu ou marron en dur)
{
  const VERT = 'rgb(53, 127, 75)', BLANC = 'rgb(255, 255, 255)', ROUGE = 'rgb(163, 58, 49)';
  const fonds = (page) => page.evaluate(() => [...document.querySelectorAll('#app .btn-primary, .modal-overlay .btn-primary, .sheet-overlay .btn-primary')].filter(b => b.offsetParent).map(b => b.textContent.trim().slice(0, 30) + '|' + getComputedStyle(b).backgroundColor));
  await ecran(mob, "render('detail')");
  const vus = [];
  for (let i = 0; i < 8; i++) { await mob.evaluate(k => { const t = document.querySelectorAll('.fiche-tab-btn')[k]; if (t) t.click(); }, i); await mob.waitForTimeout(80); vus.push(...await fonds(mob)); }
  check(vus.some(x => /Carnet sanitaire/.test(x)) && vus.some(x => /\+ Mouvement/.test(x)) && vus.some(x => /\+ Note/.test(x)), 'C. fiche brebis : boutons d\'ajout trouvés : ' + JSON.stringify(vus));
  check(vus.every(x => x.endsWith(VERT)), 'C. fiche brebis (mobile) : tous les boutons principaux verts : ' + JSON.stringify(vus));
  await ecran(mob, "render('add-note')");
  check((await fonds(mob)).every(x => x.endsWith(VERT)), 'C. « Enregistrer la note » vert');
  await ecran(mob, "render('agneaux')");
  const ag = await mob.evaluate(() => ['.btn-agneau-vendu', '.btn-agneau-mort'].map(s => { const b = document.querySelector(s), c = getComputedStyle(b); return c.backgroundColor + '|' + c.color; }));
  eq(ag, [VERT + '|' + BLANC, BLANC + '|rgb(43, 38, 28)'], 'C. Agneaux (mobile) : « Vendu » vert plein, « Mort » secondaire');
  for (const page of [mob, pc]) {
    await ecran(page, "render('agnelles'); showVendreAgnelleModal(DB.agnelles[1], function () {})");
    check((await fonds(page)).some(x => /Valider la vente/.test(x) && x.endsWith(VERT)), 'C. « Valider la vente » vert');
    await ecran(page, "render('confirmation-nouvelle-campagne'); document.getElementById('btn-confirmer-nouvelle-campagne').disabled = false");
    check((await fonds(page)).some(x => /Valider le changement/.test(x) && x.endsWith(VERT)), 'C. « Valider le changement de campagne » vert');
  }
  await ecran(mob, "render('lots'); ouvrirModalRetraitLot(DB.lots[0], DB.lots[0].membres[0], function () {})");
  const r = await mob.evaluate(() => { const c = getComputedStyle(document.getElementById('retrait-confirm')); return [c.backgroundColor, c.borderTopColor, c.color]; });
  eq(r, [BLANC, ROUGE, ROUGE], 'C. « Retirer » (retrait d\'un lot) : secondaire rouge (contour et texte), jamais rouge plein');
  await ecran(pc, "lotsPcEtat = null; render('lots'); document.querySelector('#lt-type .opt-btn[data-val=\"reforme\"]').click()");
  check(await pc.evaluate(() => getComputedStyle(document.getElementById('lt-creer')).backgroundColor) === VERT, 'C. Chantier de tri (PC) : « Créer le lot » de réforme vert');
  check(!/background:var\(--(danger|coral-fg|ch-ambre|accent|blue-solid)\)/.test(await pc.evaluate(() => document.documentElement.outerHTML.match(/<button[^>]*btn-primary[^>]*>/g).join(''))), 'C. aucun bouton principal à fond coloré en dur');
}
console.log('C OK');

// ---------------------------------------------------------------- D. PC : aucun libellé de scan ni de bip (Mise à jour inventaire, Créer une liste, Chercher en bergerie) ; le mobile ne change pas
{
  const ECR = [['Mise à jour inventaire', "DB.majInventaireSession = { eids: [] }; render('maj-inventaire')", 'Saisir une brebis'], ['Créer une liste', "render('liste-serie')", 'Saisir un animal'], ['Chercher en bergerie', "render('lot-search')", 'Saisir une brebis']];
  for (const [nom, code, lib] of ECR) {
    await ecran(pc, code);
    const t = await pc.evaluate(() => document.getElementById('app').innerText + ' ' + [...document.querySelectorAll('#app input')].map(i => i.placeholder).join(' '));
    check(!/scann|\bbip|bipé|bipage/i.test(t) && t.includes(lib) && t.includes('Saisir un n° / EID'), 'D. ' + nom + ' (PC) : « ' + lib + ' », « Saisir un n° / EID », aucun scan ni bip : ' + t.slice(0, 200));
    await ecran(mob, code);
    check(/Scanner/.test(await mob.evaluate(() => document.getElementById('app').innerText)), 'D. ' + nom + ' (mobile) : « Scanner… » conservé');
  }
}
console.log('D OK');

await browser.close();
console.log('OK');
