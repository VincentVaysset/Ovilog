/* Contrôle laitier MOBILE (maquette mobile mise à jour) : ligne « 3 contrôles par campagne · import des résultats : Paramètres › Imports », 4 tuiles 2×2 (Brebis contrôlées, Moyennes C1, C2, C3 =
   mêmes chiffres que la page PC), bande ambre « Mises bas sans contrôle laitier » qui ouvre la liste de ces brebis (même carte que sur PC, « Ouvrir la fiche », « Voir dans Brebis à régulariser »),
   filtres dans une carte (C1/C2/C3, < >, seuil, mise bas après le, codes d'anomalie, Réinitialiser), liste en CARTES (N° court, mise bas, C1/C2/C3, pastille du code d'anomalie, « Pas encore de contrôle »)
   = mêmes lignes et même tri que le tableau PC, plus de tableau coupé, pas de distribution du C3 (PC seulement), « Tout cocher » / « Créer un lot de recherche », Excel en contour et PDF en vert plein sur la
   liste filtrée. Mêmes calculs que la page PC. saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuControleLaitier } from './lib/jeu_registre_cl.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1500, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-01-25T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeuControleLaitier, true);
  await page.evaluate(() => {
    window.__saves = 0; saveData = function () { window.__saves++; return true; }; window.__avant = JSON.stringify(DB);
    window.__sorties = []; saveOrShareBinaryFile = async function (nom, bytes, mime) { window.__sorties.push({ nom, mime }); };
    window.__pdf = []; const o = buildPdfTableCharte; buildPdfTableCharte = function (a) { window.__pdf.push(a.rows.map(r => r[0])); return o(a); };
    window.__xlsx = []; const ox = buildXlsxWorkbook; buildXlsxWorkbook = async function (f) { window.__xlsx.push(f[0].rows.length); return ox(f); };
    render('controle-laitier');
  });
  return page;
}
const mob = await ouvrir(true).then(async pc => {
  // chiffres de référence : la page PC
  const ref = await pc.evaluate(() => [...document.querySelectorAll('.brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent.trim(), k.querySelector('.brd-kpi-v').textContent.trim(), (k.querySelector('.brd-kpi-s') || {}).textContent]));
  const lignesPc = await pc.evaluate(() => [...document.querySelectorAll('#cl-table tr')].slice(1).map(tr => [...tr.children].slice(1).map(td => td.textContent.replace(/\s+/g, ' ').trim())));
  await pc.context().close();
  const m = await ouvrir(false); m.__ref = ref; m.__lignesPc = lignesPc; return m;
});
const ref = mob.__ref;
const cartes = () => mob.evaluate(() => [...document.querySelectorAll('.cl-carte')].map(c => ({ num: c.querySelector('.cl-num').textContent, mab: c.querySelector('.cl-mab').textContent, vals: [...c.querySelectorAll('.cl-val-v')].map(v => (v.childNodes[0].textContent + (v.querySelector('.cl-ano') ? ' ' + v.querySelector('.cl-ano').textContent : '')).replace(/\s+/g, ' ').trim()), aucun: !!c.querySelector('.cl-aucun'), ano: [...c.querySelectorAll('.cl-ano')].map(a => a.textContent) })));

// ---- 1. structure et chiffres = page PC
check(await mob.evaluate(() => /3 contrôles par campagne · import des résultats : Paramètres › Imports/.test(document.getElementById('cl-ligne-imports').textContent)), 'ligne sous le titre');
check(await mob.evaluate(() => ![...document.querySelectorAll('#app button')].some(b => /Importer/.test(b.textContent)) && !document.getElementById('cl-distrib') && !document.querySelector('table')), 'aucun import, pas de distribution du C3, plus de tableau');
const tuiles = await mob.evaluate(() => [...document.querySelectorAll('#cl-tuiles .reg-tuile')].map(t => { const r = t.getBoundingClientRect(); return [t.querySelector('.reg-tuile-l').textContent, t.querySelector('.reg-tuile-v').textContent.replace(/\s+/g, ' '), t.querySelector('.reg-tuile-s').textContent, Math.round(r.x), Math.round(r.y), t.classList[1]]; }));
eq(tuiles.map(t => t.slice(0, 3)), [['Brebis contrôlées', '7', 'sur 10 présentes'], ['Moyenne C1', '1 494 mL', '7 brebis'], ['Moyenne C2', '1 380 mL', '7 brebis'], ['Moyenne C3', '1 060 mL', '6 brebis']], 'tuiles');
eq(tuiles.map(t => t[5]), ['vert', 'bleu', 'bleu', 'bleu'], 'couleurs des tuiles');
check(new Set(tuiles.map(t => t[3])).size === 2 && new Set(tuiles.map(t => t[4])).size === 2, 'tuiles en 2 × 2');
const norm = s => String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const kpiPc = Object.fromEntries(ref.map(k => [k[0].toUpperCase(), norm(k[1])]));
eq([kpiPc['BREBIS CONTRÔLÉES'], kpiPc['MOYENNE C1'], kpiPc['MOYENNE C2'], kpiPc['MOYENNE C3']], ['7', '1 494 mL', '1 380 mL', '1 060 mL'], 'chiffres de la page PC');
eq(await mob.evaluate(() => [document.querySelector('.cl-bande-n').textContent, document.querySelector('.cl-bande-t b').textContent, document.querySelector('.cl-bande-t span').textContent]), ['2', 'Mises bas sans contrôle laitier', '1 attendue à la traite · à vérifier'], 'bande ambre = tuile PC (2, 1 attendue à la traite)');
eq(norm(kpiPc['MISES BAS SANS CONTRÔLE LAITIER']), '2', 'même nombre que sur PC');
console.log('OK 1 structure : ligne d\'imports, tuiles 2×2 (chiffres de la page PC), bande ambre, ni import ni distribution ni tableau.');

// ---- 2. bande ambre : ouvre la liste des brebis sans contrôle
check(await mob.evaluate(() => document.getElementById('cl-liste-sans').classList.contains('hidden')), 'liste fermée au départ');
await mob.click('#btn-cl-bande-sans');
check(await mob.evaluate(() => !document.getElementById('cl-liste-sans').classList.contains('hidden') && document.getElementById('btn-cl-bande-sans').getAttribute('aria-expanded') === 'true'), 'clic : la liste s\'ouvre');
const sans = await mob.evaluate(() => [...document.querySelectorAll('#cl-liste-sans .sans-controle-ligne')].map(l => l.textContent.replace(/\s+/g, ' ').trim()));
check(sans.length === 2 && /n°00200/.test(sans[0]) && /attendue à la traite/.test(sans[0]) && /n°00201/.test(sans[1]) && /pas encore attendue/.test(sans[1]), 'mêmes brebis que sur PC : ' + JSON.stringify(sans));
check(await mob.evaluate(() => !!document.getElementById('btn-cl-voir-regulariser')), '« Voir dans Brebis à régulariser »');
await mob.click('#cl-liste-sans .bilan-eid-link');
eq(await mob.evaluate(() => [currentView, pageTitle.textContent]), ['detail', 'Brebis n°00200'], 'clic sur une brebis : sa fiche');
await mob.evaluate(() => render('controle-laitier'));
await mob.click('#btn-cl-bande-sans'); await mob.click('#btn-cl-voir-regulariser');
eq(await mob.evaluate(() => [currentView, bilanCampagneTab]), ['bilan-campagne', 'incoherences'], '« Voir dans Brebis à régulariser »');
await mob.evaluate(() => render('controle-laitier'));
await mob.click('#btn-cl-bande-sans'); await mob.click('#btn-cl-bande-sans');
check(await mob.evaluate(() => document.getElementById('cl-liste-sans').classList.contains('hidden')), 'second clic : la liste se referme');
console.log('OK 2 bande ambre : ouvre / referme la liste, mêmes brebis que PC, fiche et Brebis à régulariser.');

// ---- 3. liste en cartes = lignes du tableau PC
const cs = await cartes();
eq(cs.map(c => [c.num, c.mab]), mob.__lignesPc.map(l => [l[0], 'Mise bas ' + (l[1] || '—')]), 'cartes = lignes PC (N° court et mise bas), même tri');
eq(cs.slice(0, 3).map(c => c.vals), mob.__lignesPc.slice(0, 3).map(l => [l[2], l[3], l[4]].map(v => norm(v || '—'))), 'C1 / C2 / C3 = valeurs du tableau PC');
check(cs[1].ano.join() === '2', 'pastille du code d\'anomalie sur le C2 de la brebis 951 : ' + JSON.stringify(cs[1]));
check(cs.slice(7).every(c => c.aucun), '« Pas encore de contrôle » pour les brebis sans valeur');
eq(await mob.evaluate(() => [document.getElementById('cl-count').textContent, document.getElementById('cl-filtre-actif').textContent]), ['10 brebis sur 10', 'Aucun filtre actif · tri : N° court'], 'compteur');
check(await mob.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && [...document.querySelectorAll('.cl-carte')].every(c => c.scrollWidth <= c.clientWidth + 1)), 'aucun défilement horizontal, aucune carte coupée');
console.log('OK 3 liste en cartes = lignes de la page PC, pastille d\'anomalie, rien de coupé.');

// ---- 4. filtres (frappe réelle) et sélection
await mob.click('.ctrl-filtre-opt[data-val="2"]'); await mob.click('.op-filtre-opt[data-val="<"]');
await mob.click('#f-seuil'); await mob.keyboard.type('1000', { delay: 15 });
const f1 = await cartes();
eq(f1.map(c => c.num), ['951', '953', '955'], 'C2 < 1000 mL : 951, 953, 955');
eq(await mob.evaluate(() => document.getElementById('cl-count').textContent), '3 brebis sur 10', 'compteur filtré');
check(await mob.evaluate(() => /C2 < 1000 mL/.test(document.getElementById('cl-filtre-actif').textContent) && document.querySelectorAll('.cl-val-signale').length === 3), 'filtre actif affiché, valeurs sous le seuil signalées');
await mob.click('.chip-anomalie-opt[data-val="2"]');
eq((await cartes()).map(c => c.num), ['951'], 'code 2 : la brebis 951');
await mob.click('#btn-cl-reset');
eq(await mob.evaluate(() => [document.getElementById('cl-count').textContent, document.getElementById('f-seuil').value, document.querySelectorAll('.cl-pill.selected').length]), ['10 brebis sur 10', '', 1], 'Réinitialiser : filtres remis à zéro (seule « Toutes » reste choisie)');
await mob.fill('#f-date-apres', '2026-11-14'); await mob.dispatchEvent('#f-date-apres', 'input');
eq((await cartes()).map(c => c.num), ['955', '956', '8133', '8134'], 'mise bas après le 14/11/2026');
await mob.click('#btn-cl-reset');
// sélection, lot de recherche
check(await mob.evaluate(() => document.getElementById('btn-cl-create-lot').disabled), '« Créer un lot de recherche » grisé sans sélection');
await mob.click('.cl-carte[data-eid] .cl-check >> nth=0'); await mob.click('.cl-carte[data-eid] .cl-check >> nth=2');
eq(await mob.evaluate(() => [document.getElementById('btn-cl-create-lot').disabled, document.getElementById('btn-cl-create-lot').textContent]), [false, 'Créer un lot de recherche (2)'], 'lot : 2 sélectionnées');
await mob.click('#btn-cl-toggle-all');
eq(await mob.evaluate(() => [document.getElementById('btn-cl-toggle-all').textContent, document.querySelectorAll('.cl-check:checked').length]), ['Tout décocher', 10], 'Tout cocher');
await mob.click('#btn-cl-toggle-all');
eq(await mob.evaluate(() => document.querySelectorAll('.cl-check:checked').length), 0, 'Tout décocher');
console.log('OK 4 filtres au clavier (seuil, date, code d\'anomalie), Réinitialiser, sélection, lot.');

// ---- 5. exports : liste filtrée affichée ; style des boutons
eq(await mob.evaluate(() => [document.getElementById('btn-cl-export-xlsx').className, document.getElementById('btn-cl-export-pdf').className, document.getElementById('btn-cl-export-xlsx').textContent, document.getElementById('btn-cl-export-pdf').textContent]), ['btn btn-secondary', 'btn btn-primary', 'Excel (.xlsx)', 'Export PDF'], 'Excel en contour, PDF en vert plein');
await mob.click('.ctrl-filtre-opt[data-val="3"]'); await mob.click('.op-filtre-opt[data-val=">"]'); await mob.click('#f-seuil'); await mob.keyboard.type('1300', { delay: 15 });
const attendu = (await cartes()).map(c => c.num);
await mob.evaluate(() => { window.__sorties = []; window.__pdf = []; window.__xlsx = []; });
await mob.click('#btn-cl-export-pdf'); await mob.waitForFunction(() => window.__sorties.length === 1);
await mob.click('#btn-cl-export-xlsx'); await mob.waitForFunction(() => window.__sorties.length === 2);
const ex = await mob.evaluate(() => ({ pdf: window.__pdf[0], xlsx: window.__xlsx[0], noms: window.__sorties.map(s => s.nom) }));
eq(ex.pdf, attendu, 'le PDF contient les brebis affichées (filtrées) : ' + attendu.join(', '));
eq(ex.xlsx, attendu.length + 1, 'l\'Excel contient les mêmes lignes (+ l\'en-tête)');
check(ex.noms.every((n, i) => /^controle-laitier_2027-01-25\.(pdf|xlsx)$/.test(n)), 'noms de fichier inchangés : ' + ex.noms.join(', '));
check(await mob.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), 'aucune écriture de données');
console.log('OK 5 exports : Excel en contour, PDF en vert plein, liste filtrée, noms inchangés.');
await browser.close();
console.log('\nTOUS LES TESTS DU CONTRÔLE LAITIER MOBILE SONT PASSÉS');
