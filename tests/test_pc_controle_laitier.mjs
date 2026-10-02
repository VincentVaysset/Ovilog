/* Page PC « Contrôle laitier » (écran PC simulé) : indicateurs (brebis contrôlées, moyennes C1/C2/C3, mises bas sans
   contrôle), filtres en barre (contrôle, condition, seuil, mise bas après le, Réinitialiser), compteur, « Tout cocher »,
   tableau sans colonne « Moyenne » avec valeurs sous le seuil surlignées, distribution du contrôle choisi calculée sur les
   brebis contrôlées (seuil en pointillé, tranches sous le seuil en orange), barre de sélection (action existante « Créer un
   lot de recherche »), carte « mises bas sans contrôle laitier » (même fonction que Brebis à régulariser), exports qui
   suivent les filtres. Mobile intact (voir test_cl_registre_reference). Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuControleLaitier } from './lib/jeu_registre_cl.mjs';

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
await page.evaluate(() => { window.__saves = 0; });
const ouvrir = (avec) => page.evaluate(([fn, avec]) => { eval('(' + fn + ')')(avec); const o = saveData; if (!window.__patched) { window.__patched = true; saveData = function (...a) { window.__saves++; return o.apply(this, a); }; } window.__saves = 0; render('controle-laitier'); }, [jeuControleLaitier.toString(), avec]);
const kpis = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-controle-laitier .pc-kpis .brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent, [k.querySelector('.brd-kpi-v').textContent.replace(/ /g, ' ').trim(), (k.querySelector('.brd-kpi-s') || { textContent: '' }).textContent.replace(/ /g, ' ').trim()]])));
const lignes = () => page.evaluate(() => [...document.querySelectorAll('#cl-table tr')].slice(1).map(r => [...r.cells].slice(1).map(c => c.textContent.replace(/ /g, ' ').trim())));

// ================================================================ 1. indicateurs
await ouvrir(true);
await page.waitForSelector('#pc-controle-laitier');
let k = await kpis();
// 10 brebis actives ; 7 contrôlées ; C1 (7) = 1494 ; C2 (7) = 1380 ; C3 (6) = 1060
check(k['Brebis contrôlées'][0] === '7' && /sur 10 présentes/.test(k['Brebis contrôlées'][1]), 'brebis contrôlées 7 sur 10 : ' + JSON.stringify(k['Brebis contrôlées']));
check(k['Moyenne C1'][0] === '1 494 mL' && k['Moyenne C2'][0] === '1 380 mL' && k['Moyenne C3'][0] === '1 060 mL', 'moyennes C1/C2/C3 : ' + JSON.stringify([k['Moyenne C1'], k['Moyenne C2'], k['Moyenne C3']]));
check(/7 brebis/.test(k['Moyenne C2'][1]) && /6 brebis/.test(k['Moyenne C3'][1]), 'effectifs des moyennes 7 / 6 brebis');
check(k['Mises bas sans contrôle laitier'][0] === '2' && /1 attendue à la traite/.test(k['Mises bas sans contrôle laitier'][1]), 'mises bas sans contrôle : 2, dont 1 attendue : ' + JSON.stringify(k['Mises bas sans contrôle laitier']));
check(await page.evaluate(() => !document.querySelector('.fiche-desktop-grid') && document.querySelector('.brd-title').textContent === 'Contrôle laitier' && /3 contrôles par campagne/.test(document.querySelector('.brd-sub').textContent)), 'titre, sous-titre, pleine largeur');
console.log('OK 1 indicateurs : 7 brebis contrôlées sur 10 ; moyennes C1 1 494 / C2 1 380 / C3 1 060 mL (7, 7, 6 brebis) ; 2 mises bas sans contrôle (1 attendue à la traite).');

// ================================================================ 2. tableau sans colonne Moyenne, filtres, surlignage
const ths = await page.evaluate(() => [...document.querySelectorAll('#cl-table th')].map(t => t.textContent.replace(/[▲▼]/g, '').trim()));
check(ths.join('|') === '|N° court|MàB|C1 (mL)|C2 (mL)|C3 (mL)' && !ths.some(t => /moyenne|cumul/i.test(t)), 'colonnes : N° court / MàB / C1 / C2 / C3, aucune colonne Moyenne : ' + ths.join('|'));
check(await page.evaluate(() => document.getElementById('cl-count').textContent) === '10 brebis correspondantes sur 10' && await page.evaluate(() => document.getElementById('cl-filtre-actif').textContent) === 'Aucun filtre actif', 'compteur sans filtre');
const toutes = await lignes();
check(toutes.length === 10 && toutes[0][0] === '950' && toutes[0][2] === '1 520', 'tableau : 10 brebis actives (la vendue est exclue), N° court et valeurs : ' + JSON.stringify(toutes[0]));
check(await page.evaluate(() => document.getElementById('cl-table').scrollWidth <= document.getElementById('cl-table').parentElement.clientWidth + 1), 'pas de défilement horizontal');
// filtre C2 < 1000
await page.click('.ctrl-filtre-opt[data-val="2"]');
await page.click('.op-filtre-opt[data-val="<"]');
await page.fill('#f-seuil', '1000');
check(await page.evaluate(() => document.getElementById('cl-count').textContent) === '3 brebis correspondantes sur 10' && await page.evaluate(() => document.getElementById('cl-filtre-actif').textContent) === 'Filtre actif : C2 < 1000 mL', 'filtre C2 < 1000 : 3 brebis : ' + await page.evaluate(() => document.getElementById('cl-count').textContent));
const filtrees = await lignes();
check(filtrees.map(r => r[0]).join() === '951,953,955' && filtrees.map(r => r[3].split(' ')[0]).join() === '960,820,980', 'lignes filtrées 951 / 953 / 955 (C2 960, 820, 980) : ' + JSON.stringify(filtrees));
check(await page.evaluate(() => [...document.querySelectorAll('#cl-table .pc-lo')].map(e => e.textContent).join()) === '960,820,980', 'valeurs sous le seuil surlignées (C2 seulement)');
// supérieur à
await page.click('.op-filtre-opt[data-val=">"]');
check(await page.evaluate(() => document.getElementById('cl-count').textContent) === '4 brebis correspondantes sur 10' && /C2 > 1000 mL/.test(await page.evaluate(() => document.getElementById('cl-filtre-actif').textContent)), 'C2 > 1000 : 4 brebis (1640, 1820, 1530, 1910)');
await page.click('.op-filtre-opt[data-val="<"]');
// mise bas après le
await page.click('#btn-cl-reset');
check(await page.evaluate(() => document.getElementById('f-seuil').value === '' && document.querySelectorAll('.ctrl-filtre-opt.selected').length === 0 && document.getElementById('cl-count').textContent === '10 brebis correspondantes sur 10'), 'Réinitialiser : filtres remis à zéro');
await page.fill('#f-date-apres', '2026-11-12');
check((await lignes()).length === 6 && /mise bas après le 12-11-2026/.test(await page.evaluate(() => document.getElementById('cl-filtre-actif').textContent)), 'mise bas après le 12/11 : 6 brebis (4 contrôlées + 2 sans contrôle)');
await page.click('#btn-cl-reset');
// tri
await page.click('#cl-table th[data-key="numero"]');
check(await page.evaluate(() => document.querySelector('#cl-table th[data-key="numero"]').textContent.includes('▼')) && (await lignes())[0][0] === '8135', 'tri N° court décroissant');
await page.click('#cl-table th[data-key="c2"]');
check((await lignes())[0][3] === '820', 'tri sur C2 croissant : 820 en tête');
console.log('OK 2 tableau : colonnes N° court / MàB / C1 / C2 / C3 (pas de Moyenne), filtre C2 < 1000 = 3 brebis surlignées, > 1000 = 4, mise bas après le, Réinitialiser, tri.');

// ================================================================ 3. distribution
await page.click('#btn-cl-reset');
await page.click('.ctrl-filtre-opt[data-val="2"]');
await page.click('.op-filtre-opt[data-val="<"]');
await page.fill('#f-seuil', '1000');
const dist = await page.evaluate(() => ({ titre: document.querySelector('#cl-distrib .brd-ttl').textContent, nb: [...document.querySelectorAll('#cl-distrib .pc-bar > span')].map(s => s.textContent).join(','), lbl: [...document.querySelectorAll('#cl-distrib .pc-bar-lbls > span')].map(s => s.textContent).join(','), orange: [...document.querySelectorAll('#cl-distrib .pc-bar > div')].map(d => d.style.background).map(b => /235, 104, 52|eb6834/i.test(b)).join(), ligne: document.querySelector('#cl-distrib [style*="dashed"]') ? document.querySelector('#cl-distrib [style*="dashed"]').style.left : null, note: document.querySelector('#cl-distrib').textContent.replace(/\s+/g, ' ') }));
check(dist.titre === 'Distribution du C2' && dist.nb === '0,0,3,0,0,1,1,2,0' && dist.lbl === '<500,500,800,1000,1200,1400,1600,1800,2000+', 'distribution C2 : tranches 0,0,3,0,0,1,1,2,0 : ' + JSON.stringify(dist));
check(dist.orange === 'true,true,true,false,false,false,false,false,false' && dist.ligne === '33.3%', 'tranches sous le seuil en orange, seuil en pointillé à 33,3 % : ' + dist.orange + ' ' + dist.ligne);
check(/Sous le seuil de 1000 mL : 3 brebis/.test(dist.note) && /7 brebis\)/.test(dist.note), 'légende : 3 brebis sous le seuil, calculé sur les 7 brebis contrôlées');
// la distribution est calculée sur les brebis CONTRÔLÉES (pas sur la vendue ni sur les brebis sans valeur) et ne dépend pas du filtre de lignes
const dbDist = await page.evaluate(() => { const rows = DB.brebis.filter(b => (b.statut || 'active') === 'active').map(b => ({ c2: ((b.controleLaitier || []).find(c => c.controle === 2 && c.campagne === 2026) || {}).quantite })); return controleLaitierDistribution(rows.map(r => ({ c2: r.c2 === undefined ? null : r.c2 })), 2, '<', 1000).n; });
check(dbDist === 7, 'distribution calculée sur 7 brebis contrôlées : ' + dbDist);
// sans seuil : pas de ligne en pointillé ni de tranche orange ; contrôle par défaut = le plus récent avec valeurs (C3)
await page.click('#btn-cl-reset');
const sans = await page.evaluate(() => ({ titre: document.querySelector('#cl-distrib .brd-ttl').textContent, ligne: !!document.querySelector('#cl-distrib [style*="dashed"]'), note: document.querySelector('#cl-distrib').textContent }));
check(sans.titre === 'Distribution du C3' && !sans.ligne && !/seuil/.test(sans.note), 'sans filtre : distribution du dernier contrôle importé (C3), sans seuil : ' + JSON.stringify(sans));
console.log('OK 3 distribution du contrôle choisi : 7 brebis contrôlées en 9 tranches, seuil de 1000 mL en pointillé (33,3 %), 3 tranches sous le seuil en orange, 3 brebis sous le seuil ; sans filtre : dernier contrôle, sans seuil.');

// ================================================================ 4. cases à cocher et barre de sélection (actions existantes)
check(await page.evaluate(() => document.getElementById('pc-cl-selbar').classList.contains('hidden')), 'barre de sélection masquée sans sélection');
await page.click('#cl-table .cl-check >> nth=0');
await page.click('#cl-table .cl-check >> nth=2');
check(await page.evaluate(() => !document.getElementById('pc-cl-selbar').classList.contains('hidden') && document.getElementById('pc-cl-selcount').textContent === '2 brebis sélectionnées'), 'barre de sélection : 2 brebis sélectionnées');
// la sélection survit à un changement de filtre (comportement existant)
await page.click('.ctrl-filtre-opt[data-val="2"]'); await page.click('.op-filtre-opt[data-val="<"]'); await page.fill('#f-seuil', '1000');
check(await page.evaluate(() => document.getElementById('pc-cl-selcount').textContent) === '2 brebis sélectionnées', 'la sélection n\'est pas vidée par un filtre');
await page.click('#btn-cl-toggle-all');
check(await page.evaluate(() => document.getElementById('btn-cl-toggle-all').textContent) === 'Tout décocher' && await page.evaluate(() => document.querySelectorAll('#cl-table .cl-check:checked').length) === 3, '« Tout cocher » coche les 3 lignes filtrées');
await page.click('#btn-cl-reset');
check(await page.evaluate(() => document.getElementById('pc-cl-selcount').textContent) === '4 brebis sélectionnées' || await page.evaluate(() => /sélectionnée/.test(document.getElementById('pc-cl-selcount').textContent)), 'Réinitialiser ne vide pas la sélection');
check(await page.evaluate(() => window.__saves) === 0, 'aucun saveData jusqu\'ici (affichage, filtres, cases)');
// « Créer un lot de recherche » : action existante (modale de nommage, puis recherche en bergerie)
const selEids = await page.evaluate(() => [...document.querySelectorAll('#cl-table .cl-check:checked')].map(c => c.dataset.eid));
await page.click('#btn-cl-create-lot');
await page.waitForSelector('#cl-lot-nom');
check(await page.evaluate(() => document.getElementById('cl-lot-nom').value) === 'Contrôle laitier 02/10', 'modale de nommage existante');
await page.click('#cl-lot-confirm');
await page.waitForFunction(() => currentView === 'lot-search');
const lot = await page.evaluate(() => JSON.parse(JSON.stringify(DB.lots[DB.lots.length - 1])));
check(lot.nom === 'Contrôle laitier 02/10' && lot.membres.length === selEids.length && selEids.every(e => lot.membres.includes(e)) && !lot.type, 'lot de recherche créé comme avant (même modale, mêmes membres, même type de lot) : ' + JSON.stringify(lot));
console.log('OK 4 cases à cocher : barre de sélection (compteur), sélection conservée entre filtres, « Tout cocher », action existante « Créer un lot de recherche » inchangée (modale, membres, recherche en bergerie).');

// ================================================================ 5. carte « mises bas sans contrôle laitier » = même fonction que Brebis à régulariser
await ouvrir(true);
const carte = await page.evaluate(() => ({ lignes: [...document.querySelectorAll('#carte-sans-controle-laitier .pc-li')].map(l => [...l.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' ')), lien: document.getElementById('btn-cl-voir-regulariser').textContent }));
check(carte.lignes.length === 2 && /n°00200\s*mise bas le 20\/11 · 1 agneau attendue à la traite/.test(carte.lignes[0]) && /n°00201\s*mise bas le 01\/12 · 1 agneau pas encore attendue \(1 agneau non réglé\)/.test(carte.lignes[1]), 'carte : signal fort en tête : ' + JSON.stringify(carte.lignes));
const memes = await page.evaluate(() => { const a = brebisMiseBasSansControleLaitier(DB.campagneDebut).liste.map(l => l.eid).join(); bilanCampagneTab = 'incoherences'; render('bilan-campagne'); const b = [...document.querySelectorAll('#carte-sans-controle-laitier .pc-li')].length; const kpi = document.querySelectorAll('#pc-regulariser .pc-kpis .brd-kpi-v')[4].textContent; render('controle-laitier'); return { n: a.split(',').length, b, kpi }; });
check(memes.n === 2 && memes.b === 2 && memes.kpi === '2', 'même résultat dans Brebis à régulariser (2 lignes, indicateur 2) : ' + JSON.stringify(memes));
await page.click('#carte-sans-controle-laitier .pc-li >> nth=0');
check(await page.evaluate(() => currentView === 'detail' && detailOrigin === 'controle-laitier' && window.__saves === 0), '« Ouvrir la fiche » : fiche de la brebis, retour prévu vers Contrôle laitier, aucune écriture');
await page.click('#btn-back').catch(() => {});
await ouvrir(true);
await page.click('#btn-cl-voir-regulariser');
check(await page.evaluate(() => bilanCampagneTab === 'incoherences' && !!document.getElementById('pc-regulariser')), 'lien vers Brebis à régulariser');
console.log('OK 5 carte « mises bas sans contrôle laitier » : 2 brebis (signal fort en tête), identique à Brebis à régulariser (même fonction), « Ouvrir la fiche » sans écriture, lien vers Brebis à régulariser.');

// ================================================================ 6. exports qui suivent les filtres
await ouvrir(true);
await page.evaluate(() => { window.__cap = []; window.buildXlsxWorkbook = async (s) => { window.__cap.push({ t: 'xlsx', s }); return new Uint8Array([1]); }; window.saveOrShareBinaryFile = async (nom, bytes, mime) => { window.__cap.push({ t: 'file', nom, mime, n: bytes.length }); }; });
await page.click('.ctrl-filtre-opt[data-val="2"]'); await page.click('.op-filtre-opt[data-val="<"]'); await page.fill('#f-seuil', '1000');
await page.click('#btn-cl-export-xlsx');
await page.waitForFunction(() => window.__cap.some(c => c.t === 'file'));
const ex = await page.evaluate(() => window.__cap);
const feuille = ex.find(c => c.t === 'xlsx').s[0].rows;
check(feuille.length === 4 && feuille[0][0] === 'N° court' && feuille.slice(1).map(r => r[0]).join() === '951,953,955', 'export Excel = lignes filtrées (3) : ' + JSON.stringify(feuille));
await page.evaluate(() => { window.__cap.length = 0; });
await page.click('#btn-cl-export-pdf');
await page.waitForFunction(() => window.__cap.some(c => c.t === 'file'));
const pdf = await page.evaluate(() => window.__cap[0]);
check(/^controle-laitier_\d{4}-\d{2}-\d{2}\.pdf$/.test(pdf.nom) && pdf.mime === 'application/pdf', 'export PDF : ' + JSON.stringify(pdf));
console.log('OK 6 exports Excel et PDF : mêmes fonctions que sur mobile, ils suivent les filtres actifs (3 brebis).');

// ================================================================ 7. aucun contrôle importé
await ouvrir(false);
k = await kpis();
check(k['Brebis contrôlées'][0] === '0' && k['Moyenne C1'][0] === '—' && /aucun C1 importé/.test(k['Moyenne C1'][1]), 'sans contrôle : moyennes en tiret : ' + JSON.stringify([k['Brebis contrôlées'], k['Moyenne C1']]));
check(k['Mises bas sans contrôle laitier'][0] === '—' && /dès le 1er contrôle importé/.test(k['Mises bas sans contrôle laitier'][1]) && await page.evaluate(() => !document.getElementById('carte-sans-controle-laitier')), 'règle muette avant le 1er contrôle : tiret, pas de carte');
check(/Aucun C1 importé/.test(await page.evaluate(() => document.getElementById('cl-distrib').textContent)), 'distribution : message');
check(await page.evaluate(() => window.__saves) === 0, 'aucun saveData');
console.log('OK 7 avant le 1er contrôle importé : moyennes et indicateur en tiret, pas de carte, pas de distribution.');
await browser.close();
console.log('\nTOUS LES TESTS DE LA PAGE PC « CONTRÔLE LAITIER » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
