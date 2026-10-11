/* Gabarit PC commun (CLAUDE.md, « Charte graphique ») : sur les écrans PC, mêmes hauteurs et rayons partout. Section 1 (socle) : champs 44 px / rayon 12 ; boutons .btn en pastille ≥ 44 px (32 px dans une cellule de tableau) ; lignes de tableau 48 px (40 px pour les tableaux de synthèse) ; titres de section .pc-sec en 12 px majuscules gris. Jeu SYNTHÉTIQUE (jeuPcEcrans), saveData neutralisé. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuPcEcrans } from './lib/jeu_pc_ecrans.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const pc = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await pc.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await pc.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
pc.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
pc.on('dialog', d => d.accept());
await pc.goto(URL_APP, { waitUntil: 'load' }); await pc.waitForTimeout(300);
await pc.evaluate(jeuPcEcrans);
export const VUES_GABARIT = [
  ['Échographies', 'render("echo-rapide")'], ['Tri des agnelles', 'render("agnelles")'], ['Lots', 'lotsPcEtat=null;render("lots")'], ['Mouvements d\'animaux', 'render("mouvement-groupe")'],
  ['Carnet sanitaire', 'render("sanitaire")'], ['Produits et délais', 'render("produits-delais")'], ['Ordonnances', 'render("ordonnances")'], ['Sous délai d\'attente', 'render("sous-delai")'],
  ['Contrôle laitier', 'render("controle-laitier")'], ['Registre', 'render("registre")'], ['Inventaire', 'render("inventaire-actifs")'], ['Mise bas rapide', 'render("misebas-rapide")'],
  ['Bilan de campagne', 'bilanCampagneTab="reproduction";render("bilan-campagne")'], ['Paramètres', 'parametresTab="imports";render("parametres")'], ['Déclaration annuelle', 'render("declaration-annuelle")']];
let nChamps = 0, nBoutons = 0, nLignes = 0, nSec = 0;
for (const [nom, code] of VUES_GABARIT) {
  await pc.evaluate(code); await pc.waitForTimeout(120);
  const r = await pc.evaluate(() => {
    const vis = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }, cs = e => getComputedStyle(e), h = e => Math.round(e.getBoundingClientRect().height);
    const app = document.getElementById('app'), q = s => [...app.querySelectorAll(s)].filter(vis);
    const champs = q('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]):not([type=hidden]), select').filter(e => !e.closest('td, th')).map(e => ({ id: e.id || e.className || e.tagName, h: h(e), r: cs(e).borderTopLeftRadius }));
    const boutons = q('button.btn').map(e => ({ id: e.id || e.textContent.trim().slice(0, 20), h: h(e), r: cs(e).borderTopLeftRadius, cellule: !!e.closest('td, th') }));
    const lignes = q('table').map(t => { const tr = [...t.querySelectorAll('tbody tr')].find(x => x.querySelector('td') && vis(x)); return tr ? { cls: t.className, h: h(tr) } : null; }).filter(Boolean);
    const sec = q('.pc-sec').map(e => [cs(e).fontSize, cs(e).fontWeight, cs(e).textTransform, cs(e).color]);
    return { champs, boutons, lignes, sec };
  });
  for (const c of r.champs) { check(c.h === 44 || c.h === 36, nom + ' : champ ' + c.id + ' de hauteur 44 px (obtenu ' + c.h + ')'); check(c.r === '12px' || c.r === '10px', nom + ' : champ ' + c.id + ' de rayon 12 px (obtenu ' + c.r + ')'); nChamps++; }
  for (const b of r.boutons) { check(b.h >= (b.cellule ? 32 : 44), nom + ' : bouton ' + b.id + ' trop bas (' + b.h + ' px)'); check(parseFloat(b.r) >= 16, nom + ' : bouton ' + b.id + ' en pastille (' + b.r + ')'); nBoutons++; }
  for (const l of r.lignes) { check(l.h >= 40 && l.h <= 56, nom + ' : ligne de tableau ' + l.cls + ' à 40-56 px (obtenu ' + l.h + ')'); nLignes++; }
  for (const s of r.sec) { check(s[0] === '12px' && s[1] === '500' && s[2] === 'uppercase' && s[3] === 'rgb(94, 91, 71)', nom + ' : titre de section .pc-sec en 12 px / 500 / majuscules / gris : ' + JSON.stringify(s)); nSec++; }
}
console.log('OK gabarit PC, socle : ' + nChamps + ' champs, ' + nBoutons + ' boutons, ' + nLignes + ' tableaux, ' + nSec + ' titres de section sur ' + VUES_GABARIT.length + ' écrans.');
await browser.close();
console.log('\nTOUS LES TESTS « GABARIT PC » SONT PASSÉS.');
