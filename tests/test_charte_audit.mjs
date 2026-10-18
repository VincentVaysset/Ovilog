/* Corrections de l'audit charte (mobile 390 px, PC 1500 px, PDF) : une section par cause (A, B, C…), dans l'ordre des commits.
   Jeu SYNTHÉTIQUE (lib/jeu_pc_ecrans.mjs), saveData REMPLACÉ, aucune écriture. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuPcEcrans } from './lib/jeu_pc_ecrans.mjs';
import { installerCasPdf } from './lib/jeux_pdf.mjs';
import { jeuRegistre } from './lib/jeu_registre_cl.mjs';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
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

// ---------------------------------------------------------------- E. Pastilles et icônes : rouge seulement pour une vraie alerte
{
  const ROUGES = ['rgb(163, 58, 49)', 'rgb(251, 227, 224)'], AMBRE_P = 'rgb(251, 238, 215)', NEUTRE = 'rgb(239, 233, 218)';
  const st = (page, sel) => page.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent).map(e => { const c = getComputedStyle(e); return e.textContent.trim().slice(0, 20) + '|' + c.backgroundColor + '|' + c.color; }), sel);
  await ecran(pc, "render('agneaux')");
  const fem = (await st(pc, '.badge')).filter(x => x.startsWith('Femelle'));
  check(fem.length > 0 && fem.every(x => x.includes(AMBRE_P)), 'E. Agneaux (PC) : « Femelle » en ambre : ' + JSON.stringify(fem));
  await ecran(mob, "render('lots')");
  const ref = (await st(mob, '.badge')).filter(x => x.startsWith('Réforme'));
  check(ref.length === 1 && !ROUGES.some(r => ref[0].includes(r)), 'E. Lots (mobile) : « Réforme » sans rouge : ' + ref);
  const ic = await st(mob, '.icon-circle.ic-coral');
  check(ic.length > 0 && ic.every(x => x.includes(NEUTRE)), 'E. icônes de catégorie (ic-coral) neutres : ' + ic[0]);
  await ecran(pc, "lotsPcEtat = null; render('lots')");
  const refPc = (await st(pc, '.pc-pill')).filter(x => x.startsWith('Réforme'));
  check(refPc.length > 0 && refPc.every(x => !ROUGES.some(r => x.includes(r))), 'E. Lots (PC) : « Réforme » sans rouge : ' + refPc);
  await ecran(pc, "render('produits-delais')");
  const inc = (await st(pc, '.pc-pill')).filter(x => x.startsWith('Incomplète'));
  check(inc.length > 0 && inc.every(x => x.includes(AMBRE_P)), 'E. Produits et délais (PC) : « Incomplète » en ambre : ' + inc);
  await ecran(mob, "render('detail')");
  const bdg = await st(mob, '.fiche-tab-badge');
  check(bdg.length > 0 && bdg.every(x => !ROUGES.some(r => x.includes(r))), 'E. fiche : compteur d\'onglet sans rouge : ' + bdg);
  await ecran(mob, "render('add-agnelage')");
  check((await st(mob, '.icon-circle.ic-alerte')).some(x => x.includes(ROUGES[1])), 'E. « Agnelage déjà enregistré » garde son icône rouge (.ic-alerte)');
  await ecran(mob, "render('controle-laitier')");
  const ano = await st(mob, '.cl-ano');
  check(ano.length > 0 && ano.every(x => x.includes(AMBRE_P)), 'E. Contrôle laitier (mobile) : anomalie en ambre : ' + ano);
  await ecran(pc, "render('controle-laitier')");
  check(!(await pc.evaluate(() => [...document.querySelectorAll('#app td span')].some(sp => getComputedStyle(sp).backgroundColor === 'rgb(251, 227, 224)'))), 'E. Contrôle laitier (PC) : anomalie du tableau sans rouge');
  await ecran(mob, "render('historique-echo')");
  const vide = (await st(mob, '.reg-pastille')).filter(x => x.startsWith('Vide'));
  check(vide.length > 0 && vide.every(x => x.includes(AMBRE_P)), 'E. Historique des échos : « Vide » en ambre : ' + vide);
}
console.log('E OK');

// ---------------------------------------------------------------- F. Puces PC (.pc-seg2) : sélection en vert pastel quelle que soit la variante, libellé jamais coupé
{
  await ecran(pc, "render('sanitaire')");
  await pc.click('.cs-type[data-val="Traitement"]'); await pc.waitForTimeout(100);
  const t = await pc.evaluate(() => [...document.querySelectorAll('.cs-type')].map(b => { const c = getComputedStyle(b); return b.textContent.trim() + '|' + (b.scrollWidth > b.clientWidth + 1 ? 'COUPE' : 'entier') + '|' + (b.classList.contains('selected') ? c.backgroundColor + '|' + c.color : ''); }));
  check(t.every(x => x.includes('|entier|')), 'F. Carnet sanitaire (PC) : « Vaccin », « Traitement », « Autre » entiers : ' + JSON.stringify(t));
  check(t.some(x => x.startsWith('Traitement') && x.endsWith('rgb(227, 243, 230)|rgb(36, 97, 58)')), 'F. « Traitement » sélectionné en vert pastel : ' + JSON.stringify(t));
  await ecran(pc, "DB.exploitation = Object.assign({}, DB.exploitation, { elevageBio: true }); render('traitements-12-mois')");
  const v = await pc.evaluate(() => { const b = document.querySelector('#s12-vue-animaux.selected, #s12-vue-interv.selected'), c = getComputedStyle(b); return c.backgroundColor + '|' + c.color; });
  eq(v, 'rgb(227, 243, 230)|rgb(36, 97, 58)', 'F. Traitements 12 mois (PC) : vue sélectionnée en vert pastel');
}
console.log('F OK');

// ---------------------------------------------------------------- G. Exports : « Export Excel » (blanc) puis « Export PDF » (vert), partout
{
  const VERT = 'rgb(53, 127, 75)', BLANC = 'rgb(255, 255, 255)';
  const exportsDe = (page) => page.evaluate(() => [...document.querySelectorAll('#app button')].filter(b => b.offsetParent && /excel|pdf|xlsx|export/i.test(b.textContent) && !/de ce lot|par âge|complet|mes données/i.test(b.textContent)).map(b => [b.textContent.trim(), getComputedStyle(b).backgroundColor]));
  const ECR = [['Mouvements', "render('inventaire')", 'm'], ['Carnet sanitaire', "render('sanitaire')", 'm'], ['Brebis à régulariser', "bilanCampagneTab = 'incoherences'; render('bilan-campagne')", 'mp'], ['Registre', "registreView = 'agnelage'; render('registre')", 'mp'],
    ['Contrôle laitier', "render('controle-laitier')", 'mp'], ['Inventaire', "render('inventaire-actifs')", 'mp'], ['Créer une liste', "render('liste-serie')", 'm'], ['Déclaration', "render('declaration-annuelle')", 'mp'],
    ['Sous délai', "render('sous-delai')", 'mp'], ['Bilan économique', "bilanCampagneTab = 'economique'; render('bilan-campagne')", 'mp'], ['Bilan de lactation', "bilanCampagneTab = 'lactation'; render('bilan-campagne')", 'mp'],
    ['Traitements 12 mois', "DB.exploitation = Object.assign({}, DB.exploitation, { elevageBio: true }); render('traitements-12-mois')", 'p']];
  for (const [nom, code, ou] of ECR) for (const [page, lieu] of [[mob, 'm'], [pc, 'p']]) {
    if (!ou.includes(lieu)) continue;
    await ecran(page, code); const e = await exportsDe(page);
    check(e.length > 0, 'G. ' + nom + ' (' + lieu + ') : des exports sont affichés');
    for (const [t, bg] of e) check((t === 'Export Excel' && bg === BLANC) || (t === 'Export PDF' && bg === VERT), 'G. ' + nom + ' (' + lieu + ') : « ' + t + ' » ' + bg + ' (attendu « Export Excel » blanc ou « Export PDF » vert)');
    const ix = e.findIndex(x => x[0] === 'Export Excel'), ip = e.findIndex(x => x[0] === 'Export PDF');
    if (ix >= 0 && ip >= 0) check(ix < ip, 'G. ' + nom + ' (' + lieu + ') : Excel avant PDF');
  }
  await ecran(pc, "lotsPcEtat = null; render('lots')");
  check(await pc.evaluate(() => [...document.querySelectorAll('.le-excel')].every(b => b.textContent.trim() === 'Export Excel')), 'G. Chantier de tri (PC) : « Export Excel » sur chaque lot');
}
console.log('G OK');

// ---------------------------------------------------------------- I. Rouge des boutons : seulement Supprimer / Suppr. / Retirer / Nettoyer le registre (secondaire), jamais pour les autres actions
{
  const ROUGE = 'rgb(163, 58, 49)', VERT = 'rgb(53, 127, 75)';
  const couleur = (page, sel) => page.evaluate(sel => [...document.querySelectorAll(sel)].filter(b => b.offsetParent).map(b => { const c = getComputedStyle(b); return b.textContent.trim().slice(0, 30) + '|' + c.color + '|' + c.borderTopColor + '|' + c.backgroundColor; }), sel);
  const pasRouge = (l, nom) => check(l.length > 0 && l.every(x => !x.includes(ROUGE)), 'I. ' + nom + ' : sans rouge : ' + JSON.stringify(l));
  await ecran(mob, "currentAgnelleId = 'ag1'; render('agnelle-detail')");
  pasRouge(await couleur(mob, '#btn-vendre-agnelle-fiche'), 'fiche agnelle « Vendre »');
  check((await couleur(mob, '#btn-delete-agnelle-fiche'))[0].includes(ROUGE), 'I. « Supprimer cette agnelle » garde le rouge (secondaire)');
  await ecran(pc, "render('agneaux')"); pasRouge(await couleur(pc, '.btn-agneau-vendu, .btn-agneau-mort'), 'Agneaux (PC) « Vendu » / « Mort »');
  await ecran(mob, "render('lots')"); pasRouge(await couleur(mob, '#btn-new-lot-reforme'), '« + Nouveau lot de réforme »');
  await ecran(mob, "render('sous-delai')"); pasRouge(await couleur(mob, '#btn-controle-lot-delai'), '« Contrôle de lot (scan) »');
  await ecran(mob, "render('inventaire-actifs')"); pasRouge(await couleur(mob, '#btn-maj-inventaire'), '« Mise à jour inventaire »');
  await ecran(pc, "render('misebas-rapide')"); pasRouge(await couleur(pc, '.btn-annuler-mb-campagne'), 'Mises bas (PC) « Annuler »');
  await ecran(pc, "mvPcEtat = null; render('inventaire')"); pasRouge(await couleur(pc, '.mv-annuler, .mv-annuler-lot'), 'Mouvements passés (PC) « Annuler »');
  for (const page of [mob, pc]) {
    await ecran(page, "parametresTab = 'campagne'; parametresRubrique = 'campagne'; render('parametres')");
    check((await couleur(page, '#btn-nouvelle-campagne'))[0].endsWith(VERT), 'I. « Démarrer la campagne » en vert');
  }
}
console.log('I OK');

// ---------------------------------------------------------------- K. PC : un seul titre (celui du bandeau), pas de titre d'onglet ni de nom de fiche répété
{
  const titresVisibles = () => pc.evaluate(() => [...document.querySelectorAll('#app h1, #app h2, #app .brd-title, #app .fiche-desktop-name')].filter(e => e.offsetParent).map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  const ECR = [["bilanCampagneTab = 'incoherences'; render('bilan-campagne')", 'Brebis à régulariser'], ["bilanCampagneTab = 'reproduction'; render('bilan-campagne')", 'Bilan de reproduction'], ["bilanCampagneTab = 'lactation'; render('bilan-campagne')", 'Bilan de lactation'],
    ["plOnglet = 'tank'; render('qualite')", 'Tank'], ...['exploitation', 'campagne', 'listes', 'imports', 'sauvegarde'].map(t => [`parametresTab = '${t}'; parametresRubrique = '${t}'; render('parametres')`, null])];
  for (const [code, titre] of ECR) {
    await ecran(pc, code); const t = await titresVisibles();
    check(t.length === 0, 'K. ' + (titre || code) + ' (PC) : aucun titre répété dans la page : ' + JSON.stringify(t));
  }
  for (const [code, nom] of [["render('detail')", 'Brebis n°'], ["render('belier-detail')", 'Bélier n°'], ["render('agnelle-detail')", 'Agnelle n°']]) {
    await ecran(pc, code); const t = await titresVisibles();
    check(t.length === 1 && /^EID \d+/.test(t[0]) && !t[0].includes(nom), 'K. fiche ' + nom + ' (PC) : la carte garde l\'EID sans répéter le nom du bandeau : ' + JSON.stringify(t));
  }
}
console.log('K OK');

// ---------------------------------------------------------------- L. Produits et délais (mobile) : tuiles de la charte (fond pastel, liseré), mêmes libellés et chiffres
{
  await ecran(mob, "render('produits-delais')");
  const t = await mob.evaluate(() => [...document.querySelectorAll('#pc-produits-delais .pc-kpis > *')].map(e => e.className + '|' + e.querySelector('.l, .brd-kpi-l').textContent + '|' + getComputedStyle(e).borderLeftWidth));
  check(t.length >= 4 && t.every(x => x.startsWith('tuile-charte') && x.endsWith('|5px')), 'L. Produits et délais (mobile) : tuiles de la charte : ' + JSON.stringify(t));
  await ecran(pc, "render('produits-delais')");
  check(await pc.evaluate(() => [...document.querySelectorAll('#pc-produits-delais .pc-kpis > *')].every(e => e.classList.contains('tuile-pc'))), 'L. Produits et délais (PC) : tuiles PC inchangées');
}
console.log('L OK');

// ---------------------------------------------------------------- M. Champs fichier (imports) : bouton au style de la charte (secondaire, pilule, contour #d9cfb8)
for (const page of [mob, pc]) {
  await ecran(page, "render('import-controle-laitier-sieol')");
  const f = await page.evaluate(() => [...document.querySelectorAll('input[type=file]')].map(i => { const c = getComputedStyle(i, '::file-selector-button'); return [c.backgroundColor, c.borderTopColor, parseFloat(c.borderTopLeftRadius) >= 18].join('|'); }));
  check(f.length > 0 && f.every(x => x === 'rgb(255, 255, 255)|rgb(217, 207, 184)|true'), 'M. import du contrôle laitier : bouton de fichier à la charte : ' + JSON.stringify(f));
}
console.log('M OK');

// ---------------------------------------------------------------- N. Texte des champs en #2b261c (charte), jamais en noir pur
for (const [page, code] of [[mob, "render('list')"], [mob, "render('sanitaire')"], [pc, "mvPcEtat = null; render('inventaire')"]]) {
  await ecran(page, code);
  const noirs = await page.evaluate(() => [...document.querySelectorAll('#app input:not([type=checkbox]):not([type=radio]):not([type=file]), #app select, #app textarea')].filter(e => e.offsetParent && !e.disabled && getComputedStyle(e).color === 'rgb(0, 0, 0)').map(e => e.id || e.className));
  check(noirs.length === 0, 'N. ' + code + ' : champs en noir pur : ' + JSON.stringify(noirs));
}
console.log('N OK');

// ---------------------------------------------------------------- O. Champs désactivés en gris de la charte (#8a8670), pas le gris du navigateur
{
  await ecran(pc, "mvPcEtat = null; render('inventaire')");
  const d = await pc.evaluate(() => [...document.querySelectorAll('#app select:disabled, #app input:disabled')].filter(e => e.offsetParent).map(e => e.id + '|' + getComputedStyle(e).color));
  check(d.length > 0 && d.every(x => x.endsWith('rgb(138, 134, 112)')), 'O. Mouvements (PC) : champs désactivés en #8a8670 : ' + JSON.stringify(d));
}
console.log('O OK');

// ---------------------------------------------------------------- P. Textes entiers : étiquettes du Calendrier (PC) et indication « 0 = aucune attente » (fiche produit, mobile)
{
  await ecran(pc, "DB.journal = [{ type: 'Autre', date: '2026-10-12', note: 'x' }]; render('journal')");
  const e = await pc.evaluate(() => [...document.querySelectorAll('.cal-etiq')].filter(x => x.offsetParent).map(x => x.textContent.trim() + '|' + (x.scrollWidth > x.clientWidth + 1 ? 'COUPE' : 'entier')));
  check(e.length > 0 && e.every(x => x.endsWith('|entier')), 'P. Calendrier (PC) : étiquettes entières : ' + JSON.stringify(e));
  await ecran(mob, "render('produits-delais'); ouvrirFicheProduitModal({ categorieKey: 'antibiotiques' })");
  const ph = await mob.evaluate(() => ['fp-viande', 'fp-lait'].map(id => { const i = document.getElementById(id), c = document.createElement('canvas').getContext('2d'), st = getComputedStyle(i, '::placeholder'); c.font = st.fontSize + ' ' + st.fontFamily; return c.measureText(i.placeholder).width <= i.clientWidth - parseFloat(getComputedStyle(i).paddingLeft) - parseFloat(getComputedStyle(i).paddingRight) + 1; }));
  eq(ph, [true, true], 'P. fiche produit (mobile) : « 0 = aucune attente » entier');
}
console.log('P OK');

// ---------------------------------------------------------------- Q. PDF Bilan complet et Bilan de lactation : barres en vert #357f4b, pic en vert foncé #2f6e44, plus de vert pâle #8fb89c
{
  const p = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  await p.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(`window.__jeuRegistre = ${jeuRegistre.toString()}`); await p.evaluate(installerCasPdf);
  const dir = mkdtempSync(path.join(tmpdir(), 'ovilog-q-'));
  for (const cas of ['bilan_complet', 'bilan_lactation']) {
    const b64 = await p.evaluate(async c => { const o = await window.CAS_PDF[c](); let t = ''; for (const v of o) t += String.fromCharCode(v); return btoa(t); }, cas);
    const f = path.join(dir, cas + '.pdf'); writeFileSync(f, Buffer.from(b64, 'base64'));
    const r = spawnSync('python3', ['-I', '-c', "import sys, json, pymupdf as m\nd = m.open(sys.argv[1]); s = set()\nfor pg in d:\n    for dr in pg.get_drawings():\n        if dr.get('fill'): s.add('%02x%02x%02x' % tuple(round(c * 255) for c in dr['fill'][:3]))\nprint(json.dumps(sorted(s)))", f], { encoding: 'utf8' });
    const fills = JSON.parse(r.stdout);
    const pres = hex => fills.some(x => [0, 2, 4].every(i => Math.abs(parseInt(x.slice(i, i + 2), 16) - parseInt(hex.slice(i, i + 2), 16)) <= 3));
    check(!pres('8fb89c') && pres('357f4b') && pres('2f6e44'), 'Q. PDF ' + cas + ' : barres vertes, pic vert foncé, plus de #8fb89c : ' + fills.join(' '));
  }
  await p.context().close();
}
console.log('Q OK');

await browser.close();
console.log('OK');
