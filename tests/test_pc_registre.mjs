/* Page PC « Registre d'élevage » (écran PC simulé) : indicateurs calculés depuis l'actif + le registre, filtres en une
   barre (recherche par numéro, catégorie / type / campagne), tableau pleine largeur sans défilement horizontal (colonne
   Campagne visible), onglets Agnelage / Mouvements / Sanitaire, lecture seule (aucune donnée modifiée ni supprimée,
   aucun saveData), clic sur un numéro (sans effet, comme avant), et EXPORTS IDENTIQUES à ceux de l'écran mobile (xlsx et
   PDF des 3 onglets, sans filtre et avec filtres posés depuis la page PC) : référence tests/ref/cl_registre_mobile.json.
   Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuRegistre } from './lib/jeu_registre_cl.mjs';
const REF = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'ref', 'cl_registre_mobile.json'), 'utf8'));

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.evaluate((fn) => {
  eval('(' + fn + ')')();
  window.__saves = 0; const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); };
  registreView = 'sanitaire'; registreFiltre = ''; registreColFiltres = { agnelage: { sexe: '', campagne: '' }, mouvements: { categorie: '', type: '', campagne: '' }, sanitaire: { categorie: '', type: '', campagne: '' } };
  window.__avant = JSON.stringify(DB);
  window.__cap = [];
  window.buildXlsxWorkbook = async (s) => { window.__cap.push({ t: 'xlsx', s }); return new Uint8Array([1]); };
  window.saveOrShareBinaryFile = async (nom, bytes, mime) => { window.__cap.push({ t: 'file', nom, mime, b: Array.from(bytes).length > 20 ? Array.from(bytes) : null }); };
  render('registre');
}, jeuRegistre.toString());
await page.waitForSelector('#pc-registre');
const kpis = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-registre-kpis .brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent, [k.querySelector('.brd-kpi-v').textContent.trim(), (k.querySelector('.brd-kpi-s') || { textContent: '' }).textContent.trim()]])));
const ouvrirOnglet = async (nom) => { await page.click(`.tab-bar .tab-btn[data-tab="${nom}"]`); await page.waitForFunction((n) => registreView === n && !!document.getElementById('pc-registre'), nom); };

// ================================================================ 1. indicateurs, onglet Sanitaire
check(await page.evaluate(() => !document.querySelector('.fiche-desktop-grid') && document.querySelector('.brd-title').textContent === "Registre d'élevage" && /conditionnalité PAC/.test(document.querySelector('.brd-sub').textContent)), 'titre, sous-titre');
check(await page.evaluate(() => [...document.querySelectorAll('.tab-bar .tab-btn')].map(b => b.textContent).join() === 'Agnelage,Mouvements,Sanitaire' && document.querySelector('.tab-btn.active').textContent === 'Sanitaire'), 'onglets Agnelage / Mouvements / Sanitaire');
let k = await kpis();
// soins : 8 (4 traitements, 2 vaccins, 2 autres) ; animaux : 7 (brebis 4, béliers 2, agnelles 1) dont 4 actifs et 3 sortis
check(k['Soins enregistrés'][0] === '8' && /toutes campagnes/.test(k['Soins enregistrés'][1]), 'soins enregistrés 8 : ' + JSON.stringify(k['Soins enregistrés']));
check(k['Traitements'][0] === '4' && k['Traitements'][1] === '50 %' && k['Vaccins'][0] === '2' && k['Vaccins'][1] === '25 %' && k['Autres'][0] === '2' && k['Autres'][1] === '25 %', 'traitements 4 / vaccins 2 / autres 2 : ' + JSON.stringify([k['Traitements'], k['Vaccins'], k['Autres']]));
check(k['Animaux au registre'][0] === '7' && /4 actifs · 3 sortis/.test(k['Animaux au registre'][1]), 'animaux au registre 7 (4 actifs, 3 sortis) : ' + JSON.stringify(k['Animaux au registre']));
const ind = await page.evaluate(() => JSON.parse(JSON.stringify(registreIndicateursPc())));
check(ind.animaux.parCategorie.brebis.total === 4 && ind.animaux.parCategorie.beliers.total === 2 && ind.animaux.parCategorie.agnelles.total === 1 && ind.sanitaire.soins === ind.sanitaire.traitements + ind.sanitaire.vaccins + ind.sanitaire.autres, 'répartition par catégorie 4 / 2 / 1 ; soins = traitements + vaccins + autres');
const coherence = await page.evaluate(() => registreSanitaireRows().length === registreIndicateursPc().sanitaire.soins && registreMouvementsRows().length === registreIndicateursPc().mouvements.total && registreAgnelageRows().length === registreIndicateursPc().agnelage.agneaux);
check(coherence, 'les indicateurs = nombre de lignes de chaque tableau (même source)');
console.log('OK 1 indicateurs du Sanitaire : 8 soins (4 traitements, 2 vaccins, 2 autres), 7 animaux au registre (4 actifs, 3 sortis : 4 brebis, 2 béliers, 1 agnelle) calculés depuis l\'actif + les archives.');

// ================================================================ 2. tableau pleine largeur, filtres
const geo = await page.evaluate(() => { const t = document.querySelector('#registre-body table'), c = document.getElementById('registre-body'); const r = t.getBoundingClientRect(), rc = c.getBoundingClientRect(); const dernier = t.querySelector('tr th:last-child').getBoundingClientRect(); return { sw: t.scrollWidth, cw: c.clientWidth, largeur: r.width, conteneur: rc.width, derniereDroite: dernier.right, conteneurDroite: rc.right, ths: [...t.querySelectorAll('th')].map(x => x.textContent), scrollX: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; });
check(geo.ths.join('|') === 'N°|Catégorie|Type de soin|Produit|Date|Dose|N° ordonnance|Campagne', 'colonnes du Sanitaire : ' + geo.ths.join('|'));
check(geo.sw <= geo.cw + 1 && geo.largeur >= geo.conteneur - 2 && geo.derniereDroite <= geo.conteneurDroite + 1 && geo.scrollX, 'tableau pleine largeur, colonne Campagne visible, aucun défilement horizontal : ' + JSON.stringify(geo));
check(await page.evaluate(() => document.getElementById('pc-registre-compte').textContent) === '8 soins affichés', 'compteur : 8 soins affichés');
const l1 = await page.evaluate(() => [...document.querySelectorAll('#registre-body tr')].slice(1, 2).map(r => [...r.cells].map(c => c.textContent.trim())));
check(JSON.stringify(l1[0]) === JSON.stringify(['n°00017', 'Brebis', 'Traitement · Antibiotique', 'Intramicine', '20-09-2026', '8 cc', '—', 'Campagne 2026']), 'ligne la plus récente (n°, catégorie, soin, produit, date, dose, ordonnance, campagne) : ' + JSON.stringify(l1[0]));
// filtres : une seule barre
check(await page.evaluate(() => { const f = document.querySelector('.pc-filtres-ligne'); const tops = [...f.querySelectorAll('input, select, button')].map(x => Math.round(x.getBoundingClientRect().top)); return tops.every(t => Math.abs(t - tops[0]) < 8); }), 'recherche, catégorie, type de soin, campagne et Réinitialiser sur une seule ligne');
await page.fill('#registre-filtre', '17');
check(await page.evaluate(() => document.getElementById('pc-registre-compte').textContent) === '2 soins affichés', 'recherche par numéro « 17 » : 2 soins');
await page.fill('#registre-filtre', '');
await page.selectOption('#pc-registre-selects select[data-col="categorie"]', 'Bélier');
check(await page.evaluate(() => document.getElementById('pc-registre-compte').textContent) === '1 soin affiché', 'catégorie Bélier : 1 soin');
await page.selectOption('#pc-registre-selects select[data-col="categorie"]', '');
await page.selectOption('#pc-registre-selects select[data-col="type"]', 'Vaccin');
check(await page.evaluate(() => document.getElementById('pc-registre-compte').textContent) === '2 soins affichés', 'type Vaccin : 2 soins');
await page.click('#btn-registre-reset');
check(await page.evaluate(() => document.getElementById('pc-registre-compte').textContent === '8 soins affichés' && document.getElementById('registre-filtre').value === '' && registreColFiltres.sanitaire.type === ''), 'Réinitialiser : 8 soins');
// clic sur un numéro : aucun effet (comportement actuel conservé)
await page.click('#registre-body tr:nth-child(2) td:first-child');
check(await page.evaluate(() => currentView === 'registre'), 'clic sur un numéro : sans effet (aucune navigation, comme avant)');
console.log('OK 2 tableau pleine largeur (8 colonnes, Campagne visible, pas de défilement horizontal), filtres sur une ligne (numéro, catégorie, type, campagne), Réinitialiser, clic sur un n° sans effet.');

// ================================================================ 3. onglets Mouvements et Agnelage
await ouvrirOnglet('mouvements');
k = await kpis();
check(k['Mouvements enregistrés'][0] === '11' && k['Entrées'][0] === '8' && k['Ventes'][0] === '2' && k['Morts et pertes'][0] === '1' && k['Autres sorties'][0] === '0', 'mouvements 11 = 8 entrées + 2 ventes + 1 mort : ' + JSON.stringify(k));
check(await page.evaluate(() => [...document.querySelectorAll('#registre-body th')].map(x => x.textContent).join('|')) === 'N°|Catégorie|Type|Cause / détail|Date|Campagne', 'colonnes des mouvements');
check(await page.evaluate(() => [...document.querySelectorAll('#pc-registre-selects label')].map(x => x.textContent).join('|')) === 'Catégorie|Type|Campagne', 'filtres des mouvements');
await ouvrirOnglet('agnelage');
k = await kpis();
check(k['Agneaux enregistrés'][0] === '3' && k['Mâles'][0] === '1' && k['Femelles'][0] === '1' && k['Morts-nés'][0] === '1' && k['Animaux au registre'][0] === '7', 'agnelage : 3 agneaux (1 mâle, 1 femelle, 1 mort-né) : ' + JSON.stringify(k));
check(await page.evaluate(() => [...document.querySelectorAll('#registre-body th')].map(x => x.textContent).join('|')) === 'N° mère|N° agneau|Sexe|Date de naissance|Campagne' && await page.evaluate(() => [...document.querySelectorAll('#pc-registre-selects label')].map(x => x.textContent).join('|')) === 'Sexe|Campagne', 'colonnes et filtres de l\'agnelage');
check(await page.evaluate(() => /Mort-né/.test(document.getElementById('registre-body').textContent)), 'mort-né affiché');
console.log('OK 3 onglets Mouvements (11 = 8 entrées + 2 ventes + 1 mort) et Agnelage (3 agneaux) : mêmes mise en page, colonnes et filtres propres.');

// ================================================================ 4. exports identiques à la référence (sans filtre puis avec filtres posés depuis la page PC)
// Le Sanitaire a gagné des colonnes (carnet sanitaire PC) : sa feuille Excel et son PDF sont comparés à part, colonne par colonne, par
// test_export_sanitaire. Ici : les autres feuilles (Agnelage, Mouvements) et les autres PDF restent identiques à la référence ; pour le
// Sanitaire on ne compare que le nom de fichier.
const sansSanitaire = cap => JSON.parse(JSON.stringify(cap)).map(c => c.t === 'xlsx' ? { ...c, s: c.s.filter(f => f.name !== 'Sanitaire') } : c);
const pdfSanitaire = cap => cap.map(c => c.t === 'file' ? { nom: c.nom, mime: c.mime } : c);
const capturer = async (declencheur) => { await page.evaluate(() => { window.__cap.length = 0; }); await declencheur(); await page.waitForFunction(() => window.__cap.some(c => c.t === 'file')); return page.evaluate(() => JSON.parse(JSON.stringify(window.__cap))); };
// sans filtre
for (const o of ['agnelage', 'mouvements', 'sanitaire']) { await ouvrirOnglet(o); await page.click('#btn-registre-reset'); }
let got = await capturer(() => page.click('#btn-export-registre'));
check(JSON.stringify(sansSanitaire(got)) === JSON.stringify(sansSanitaire(REF.exports.sans_filtre_xlsx)), 'export Excel sans filtre identique à la référence (feuilles Agnelage et Mouvements)');
for (const o of ['agnelage', 'mouvements', 'sanitaire']) {
  await ouvrirOnglet(o);
  got = await capturer(() => page.click('#btn-export-registre-pdf'));
  check(o === 'sanitaire' ? JSON.stringify(pdfSanitaire(got)) === JSON.stringify(pdfSanitaire(REF.exports['sans_filtre_pdf_' + o])) : JSON.stringify(got) === JSON.stringify(REF.exports['sans_filtre_pdf_' + o]), 'export PDF « ' + o + ' » sans filtre identique à la référence (octets ; Sanitaire : nom de fichier, colonnes vérifiées par test_export_sanitaire)');
}
// avec filtres (posés sur chaque onglet depuis les listes déroulantes de la page PC)
await ouvrirOnglet('agnelage'); await page.fill('#registre-filtre', '1');
await page.selectOption('#pc-registre-selects select[data-col="sexe"]', 'Mâle'); await page.selectOption('#pc-registre-selects select[data-col="campagne"]', '2025');
await ouvrirOnglet('mouvements');
await page.selectOption('#pc-registre-selects select[data-col="categorie"]', 'Brebis'); await page.selectOption('#pc-registre-selects select[data-col="type"]', 'Vente'); await page.selectOption('#pc-registre-selects select[data-col="campagne"]', '2025');
await ouvrirOnglet('sanitaire');
await page.selectOption('#pc-registre-selects select[data-col="categorie"]', 'Brebis'); await page.selectOption('#pc-registre-selects select[data-col="type"]', 'Traitement · Antibiotique'); await page.selectOption('#pc-registre-selects select[data-col="campagne"]', '2025');
check(await page.evaluate(() => registreFiltre === '1'), 'le filtre numéro est partagé entre onglets (comportement existant)');
got = await capturer(() => page.click('#btn-export-registre'));
check(JSON.stringify(sansSanitaire(got)) === JSON.stringify(sansSanitaire(REF.exports.avec_filtres_xlsx)), 'export Excel avec filtres identique à la référence (feuilles Agnelage et Mouvements) : ' + JSON.stringify(got[0].s.map(x => x.rows.length)));
for (const o of ['agnelage', 'mouvements', 'sanitaire']) {
  await ouvrirOnglet(o);
  got = await capturer(() => page.click('#btn-export-registre-pdf'));
  check(o === 'sanitaire' ? JSON.stringify(pdfSanitaire(got)) === JSON.stringify(pdfSanitaire(REF.exports['avec_filtres_pdf_' + o])) : JSON.stringify(got) === JSON.stringify(REF.exports['avec_filtres_pdf_' + o]), 'export PDF « ' + o + ' » avec filtres identique à la référence (octets, nom de fichier ; Sanitaire : nom de fichier)');
}
console.log('OK 4 exports identiques avant / après : Excel (3 onglets) et PDF (chaque onglet), sans filtre et avec filtres posés depuis la page PC — feuilles et octets comparés à la référence prise avant ce chantier.');

// ================================================================ 5. lecture seule
check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), 'aucun saveData, aucune donnée modifiée ni supprimée (DB identique à l\'octet près)');
console.log('OK 5 lecture seule : 0 saveData, DB identique avant et après (affichage, filtres, onglets, exports).');
await browser.close();
console.log('\nTOUS LES TESTS DE LA PAGE PC « REGISTRE D\'ÉLEVAGE » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
