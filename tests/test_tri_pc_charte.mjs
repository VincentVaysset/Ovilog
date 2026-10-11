/* Chantier de tri PC en charte (CLAUDE.md « Charte graphique ») : onglets en pastille blanche sur fond #efe9da (Lots / Tri des agnelles, onglets de critères), bandeau d'étapes en pastilles de la charte,
   puces de filtre blanches à contour #d9cfb8 (actives : vert pastel #e3f3e6, texte #24613a), tableaux à en-tête vert (voir test_tableaux_pc), police Roboto en premier. Structure et fonctions inchangées :
   les boutons gardent leurs ids, classes .opt-btn / .selected et leurs gestionnaires. Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune écriture. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuPcEcrans } from './lib/jeu_pc_ecrans.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const pc = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await pc.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await pc.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
pc.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
pc.on('dialog', d => d.accept());
await pc.goto(URL_APP, { waitUntil: 'load' }); await pc.waitForTimeout(300);
await pc.evaluate(jeuPcEcrans);
const BLANC = 'rgb(255, 255, 255)', ONGLETS = 'rgb(239, 233, 218)', TRANSP = 'rgba(0, 0, 0, 0)';
const ouvrir = (code) => pc.evaluate(code).then(() => pc.waitForTimeout(120));
// barre d'onglets : fond segmenté, bouton actif en pastille blanche, autres sans fond ni contour
const barre = (sel) => pc.evaluate(sel => { const b = document.querySelector(sel), cs = e => getComputedStyle(e);
  return { fond: cs(b).backgroundColor, rayon: parseFloat(cs(b).borderTopLeftRadius) >= 20, btns: [...b.querySelectorAll('.opt-btn')].map(x => ({ t: x.textContent.trim(), sel: x.classList.contains('selected'), bg: cs(x).backgroundColor, bord: cs(x).borderTopWidth, rayon: parseFloat(cs(x).borderTopLeftRadius) >= 20 })) }; }, sel);
const verifBarre = (B, nom) => {
  eq(B.fond, ONGLETS, nom + ' : fond segmenté #efe9da'); check(B.rayon, nom + ' : barre arrondie');
  check(B.btns.filter(b => b.sel).length === 1, nom + ' : un seul onglet actif');
  for (const b of B.btns) { eq([b.bg, b.bord, b.rayon], b.sel ? [BLANC, '0px', true] : [TRANSP, '0px', true], nom + ' : onglet « ' + b.t + ' » ' + (b.sel ? '(actif : pastille blanche)' : '(inactif : sans fond ni contour)')); }
};

// ================================================================ 1. onglets : Lots / Tri des agnelles et onglets de critères
await ouvrir('lotsPcEtat=null;render("lots")');
{ const B = await barre('.pc-onglets'); eq(B.btns.map(b => b.t), ['Lots', 'Tri des agnelles'], 'barre du haut (Lots)'); verifBarre(B, 'Lots / Tri des agnelles'); eq(B.btns.find(b => b.sel).t, 'Lots', 'onglet actif = Lots'); }
await ouvrir('render("agnelles")');
{ const B = await barre('.pc-onglets'); verifBarre(B, 'Tri des agnelles'); eq(B.btns.find(b => b.sel).t, 'Tri des agnelles', 'onglet actif = Tri des agnelles'); }
await ouvrir('lotsPcEtat=lotsPcEtatInitial();lotsPcEtat.lotId="L1";currentLotId="L1";render("edit-lot")');
{ const B = await barre('#lt-onglets'); eq(B.btns.map(b => b.t), ['Échographies', 'Contrôles', 'Lactations et classes', 'Réussite à l\'IA', 'Mises bas'], 'onglets de critères'); verifBarre(B, 'onglets de critères');
  // fonctions inchangées : un clic change d'onglet (même classe .selected, mêmes gestionnaires)
  await pc.click('#lt-onglets .opt-btn[data-val="echos"]'); await pc.waitForTimeout(120);
  const B2 = await barre('#lt-onglets'); eq(B2.btns.find(b => b.sel).t, 'Échographies', 'clic sur « Échographies » : onglet actif'); verifBarre(B2, 'onglets de critères après clic'); }
// bandeau d'étapes : pastilles de la charte
const etapes = await pc.evaluate(() => [...document.querySelectorAll('#app span.pc-pill')].filter(e => /^(✓ )?[12] · /.test(e.textContent.trim())).map(e => { const cs = getComputedStyle(e); return [e.textContent.trim(), cs.backgroundColor, cs.color, parseFloat(cs.borderTopLeftRadius) >= 16]; }));
eq(etapes, [['✓ 1 · Le lot', 'rgb(227, 243, 230)', 'rgb(36, 97, 58)', true], ['2 · Les brebis', 'rgb(53, 127, 75)', 'rgb(255, 255, 255)', true]], 'bandeau d\'étapes : fait = vert pastel #e3f3e6 / texte #24613a, en cours = vert plein texte blanc, pastilles arrondies');
check(await pc.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'partie 1 : aucune écriture');
console.log('OK 1 onglets : Lots / Tri des agnelles et onglets de critères en pastille blanche sur fond #efe9da ; bandeau d\'étapes à la charte ; fonctions inchangées.');

await browser.close();
console.log('\nTOUS LES TESTS « CHANTIER DE TRI PC EN CHARTE » SONT PASSÉS.');
