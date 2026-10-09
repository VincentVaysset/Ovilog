/* Inventaire (onglets Brebis, Agnelles, Béliers, Agneaux actifs), PC et mobile : champ « Rechercher un numéro » (frappe réelle au clavier) qui porte sur TOUS les numéros de l'onglet
   (court, long, officiel, travail, EID complet) sans tenir compte des espaces ; le champ garde le focus pendant la frappe ; changer d'onglet vide la recherche ; « Export PDF » en vert plein et
   « Export Excel (.xlsx) » en contour ; PC : tableau pleine largeur, 3 tuiles d'effectifs, recherche à gauche et exports à droite ; clic sur une ligne -> fiche (brebis, agnelle, bélier ; agneau -> fiche de la mère), y compris dans une liste filtrée ;
   les exports PDF et Excel portent sur la liste AFFICHÉE ; aucune écriture de données. saveData et saveOrShareBinaryFile REMPLACÉS. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

for (const bureau of [true, false]) {
  const nom = bureau ? 'PC' : 'mobile';
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1500, height: 1000 } : { width: 420, height: 1400 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-09T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__saves = 0; DB = migrateData({}); saveData = function () { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    const b = (n, extra) => Object.assign({ id: 'b' + n, eid: '25001629910' + String(10000 + n), statut: 'active', mouvements: [], sanitaire: [], echographies: [], notes: [], agnelages: [], createdAt: 1,
      numeroCourtTravailSieol: String(n), numeroLongTravailSieol: '02' + String(1000 + n) }, extra || {});
    DB.brebis = [b(1, { agnelages: [{ date: '2026-02-01', lambs: [{ eid: '250016299100099001', sexe: 'Mâle', mouvements: [] }, { eid: '250016299100099002', sexe: 'Femelle', mouvements: [] }] }] }), b(2), b(3), b(12), b(23)];
    DB.agnelles = [{ id: 'a1', eid: '250016299100010001', statut: 'active' }, { id: 'a2', eid: '250016299100010002', statut: 'active' }];
    DB.beliers = [{ id: 'be1', eid: '250016299100020001', statut: 'actif', numeroTravailSieol: 'B12', mouvements: [] }, { id: 'be2', eid: '250016299100020002', statut: 'actif', numeroTravailSieol: 'B34', mouvements: [] }];
    window.__avant = JSON.stringify(DB);
    window.__saisies = [];
    saveOrShareBinaryFile = async function (nom, bytes, mime) { window.__saisies.push({ nom, mime, n: bytes.length }); };
    window.__xlsx = null;
    const vraiXlsx = buildXlsxWorkbook; buildXlsxWorkbook = async function (feuilles) { window.__xlsx = feuilles; return vraiXlsx(feuilles); };
    render('inventaire-actifs');
  });
  const lignes = () => page.evaluate(() => [...document.querySelectorAll('.inventaire-actifs-row')].map(tr => [...tr.children].map(td => td.textContent)));
  const compte = () => page.evaluate(() => document.getElementById('inv-compte').textContent);
  const box = (sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }, sel);
  const frappe = async (texte) => { await page.fill('#inventaire-recherche', ''); await page.click('#inventaire-recherche'); await page.keyboard.type(texte, { delay: 15 }); };

  // ---- structure : boutons, champ, tableau
  eq(await page.evaluate(() => [document.getElementById('btn-export-inventaire-pdf').className, document.getElementById('btn-export-inventaire-xlsx').className]), ['btn btn-primary', 'btn btn-secondary'], nom + ' : Export PDF vert plein, Export Excel en contour');
  eq(await page.evaluate(() => [document.getElementById('btn-export-inventaire-pdf').textContent, document.getElementById('btn-export-inventaire-xlsx').textContent]), ['Export PDF', 'Export Excel (.xlsx)'], nom + ' : libellés des boutons');
  eq(await page.evaluate(() => getComputedStyle(document.getElementById('btn-export-inventaire-pdf')).backgroundColor !== getComputedStyle(document.getElementById('btn-export-inventaire-xlsx')).backgroundColor), true, nom + ' : fonds différents');
  check(await page.evaluate(() => !!document.querySelector('label[for="inventaire-recherche"]') && document.getElementById('inventaire-recherche').placeholder.length > 0), nom + ' : champ de recherche avec libellé');
  const yq = await page.evaluate(() => document.getElementById('inventaire-recherche').getBoundingClientRect().y), yt = await page.evaluate(() => document.querySelector('#inv-liste').getBoundingClientRect().y);
  check(yq < yt, nom + ' : recherche au-dessus du tableau');
  const largTab = await page.evaluate(() => Math.round(document.querySelector('#inv-liste table').getBoundingClientRect().width)), largZone = await page.evaluate(() => Math.round(document.getElementById('inv-liste').getBoundingClientRect().width));
  check(largTab >= largZone - 2, nom + ' : tableau sur toute la largeur de la page (' + largTab + ' px sur ' + largZone + ' px)');
  if (bureau) {
    // 3 colonnes réparties sur la largeur (pas de colonnes resserrées)
    const colsW = await page.evaluate(() => [...document.querySelectorAll('#inv-liste thead th')].map(th => Math.round(th.getBoundingClientRect().width)));
    check(colsW.length === 3 && Math.max(...colsW) - Math.min(...colsW) <= 2 && colsW.every(w => w > largZone * 0.3), 'PC : 3 colonnes égales réparties sur la largeur ' + JSON.stringify(colsW));
    // style de la maquette : en-tête vert, lignes alternées beige / blanc, 1re colonne en vert gras
    const st = await page.evaluate(() => { const th = document.querySelector('#inv-liste thead th'), tds = [...document.querySelectorAll('#inv-liste tbody tr')].slice(0, 2).map(r => getComputedStyle(r.children[0])), tdb = [...document.querySelectorAll('#inv-liste tbody tr')].slice(0, 2).map(r => getComputedStyle(r.children[1]).backgroundColor);
      return { th: getComputedStyle(th).backgroundColor + '|' + getComputedStyle(th).color, premiere: tds.map(s => s.color + '|' + s.fontWeight), fonds: tdb }; });
    eq(st.th, 'rgb(53, 127, 75)|rgb(255, 255, 255)', 'PC : en-tête vert #357f4b, texte blanc');
    eq(st.premiere, ['rgb(47, 110, 68)|700', 'rgb(47, 110, 68)|700'], 'PC : 1re colonne en vert gras');
    eq(st.fonds, ['rgb(246, 241, 228)', 'rgb(255, 255, 255)'], 'PC : lignes alternées beige / blanc');
    // 3 tuiles d'effectifs colorées au-dessus du tableau, sur une ligne, toujours les mêmes
    const tu = await page.evaluate(() => [...document.querySelectorAll('#inv-tuiles .reg-tuile')].map(e => { const r = e.getBoundingClientRect(); return [e.querySelector('.reg-tuile-l').textContent, e.querySelector('.reg-tuile-v').textContent, e.classList[1], Math.round(r.y), e.classList.contains('actif')]; }));
    eq(tu.map(x => x.slice(0, 3)), [['Brebis actives', '5', 'vert'], ['Agnelles actives', '2', 'ambre'], ['Béliers actifs', '2', 'bleu']], 'PC : tuiles Brebis / Agnelles / Béliers (sans agneaux)');
    check(new Set(tu.map(x => x[3])).size === 1, 'PC : les 3 tuiles sont sur une ligne');
    check(tu[0][4] && !tu[1][4] && !tu[2][4], 'PC : la tuile de l\'onglet courant est cerclée');
    check(tu[0][3] + 40 < yt && (await box('#inv-tuiles')).y < yq, 'PC : tuiles au-dessus de la recherche et du tableau');
    // barre : recherche à gauche, Excel puis PDF à droite, sur une seule ligne
    const bq = await box('#inventaire-recherche'), bx = await box('#btn-export-inventaire-xlsx'), bp = await box('#btn-export-inventaire-pdf');
    check(Math.abs((bq.y + bq.h / 2) - (bx.y + bx.h / 2)) < 6 && Math.abs((bx.y + bx.h / 2) - (bp.y + bp.h / 2)) < 6, 'PC : recherche et boutons sur une seule ligne');
    check(bq.x < bx.x && bx.x < bp.x && bp.x + bp.w >= largZone - 10, 'PC : recherche à gauche, Export Excel puis Export PDF à droite');
  } else {
    check(await page.evaluate(() => !document.getElementById('inv-tuiles')), 'mobile : pas de tuiles (inchangé)');
    check(!(await page.evaluate(() => document.querySelector('#inv-liste table').classList.contains('inv-table'))), 'mobile : tableau d\'avant, inchangé');
  }
  eq(await compte(), '5 animal(aux) actif(s).', nom + ' : compte');
  eq((await lignes()).length, 5, nom + ' : 5 brebis');
  const btnMaj = await page.evaluate(() => !!document.getElementById('btn-maj-inventaire'));
  eq(btnMaj, !bureau, nom + ' : « Mise à jour inventaire » conservé sur mobile seulement (comme avant)');

  // ---- recherche brebis : court, long, officiel, EID complet, espaces
  await frappe('3');
  eq((await lignes()).map(l => l[0]), ['3', '23'], nom + ' : « 3 » : n° court contenant 3 (3 et 23)');
  eq(await compte(), '2 sur 5 animal(aux) actif(s).', nom + ' : compte filtré');
  await frappe('021012');
  eq((await lignes()).map(l => l[1]), ['021012'], nom + ' : n° long');
  await frappe('0 2 1 0 1 2');
  eq((await lignes()).map(l => l[1]), ['021012'], nom + ' : espaces ignorés');
  await frappe('62991010003');
  eq((await lignes()).map(l => l[2]), ['62991010003'], nom + ' : n° officiel');
  await frappe('250016299101');   // préfixe de l'EID complet (les 5 brebis)
  eq((await lignes()).length, 5, nom + ' : EID complet (début)');
  await frappe('250 016 299 10 100 23');
  eq((await lignes()).map(l => l[0]), ['23'], nom + ' : EID complet avec espaces');
  check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'inventaire-recherche'), nom + ' : le champ garde le focus pendant la frappe');
  await frappe('zzz');
  eq(await page.evaluate(() => document.getElementById('inv-liste').textContent.trim()), 'Aucun animal ne correspond à la recherche.', nom + ' : aucun résultat');
  eq(await page.evaluate(() => document.querySelectorAll('.inventaire-actifs-row').length), 0, nom + ' : aucune ligne');
  await page.fill('#inventaire-recherche', '');
  eq((await lignes()).length, 5, nom + ' : champ vidé -> liste complète');

  // ---- clic sur une ligne (liste filtrée) -> fiche de la brebis
  await frappe('021012');
  await page.click('.inventaire-actifs-row');
  eq(await page.evaluate(() => currentView), 'detail', nom + ' : clic -> fiche brebis');
  eq(await page.evaluate(() => pageTitle.textContent), 'Brebis n°10012', nom + ' : la fiche est celle de la brebis cherchée');
  // retour : la recherche est conservée
  await page.evaluate(() => render('inventaire-actifs'));
  eq(await page.inputValue('#inventaire-recherche'), '021012', nom + ' : recherche conservée au retour');
  eq((await lignes()).length, 1, nom + ' : liste filtrée au retour');

  // ---- onglets : la recherche est vidée ; recherche propre à chaque onglet
  await page.click('.tab-btn[data-tab="agnelles"]');
  eq(await page.inputValue('#inventaire-recherche'), '', nom + ' : changer d\'onglet vide la recherche');
  eq((await lignes()).length, 2, nom + ' : 2 agnelles');
  await frappe('10002');
  eq((await lignes()).map(l => l[0]), ['10002'], nom + ' : agnelle trouvée par son n°');
  await page.click('.inventaire-actifs-row');
  eq(await page.evaluate(() => currentView), 'agnelle-detail', nom + ' : clic -> fiche agnelle');
  eq(await page.evaluate(() => currentAgnelleId), 'a2', nom + ' : bonne agnelle');
  await page.evaluate(() => { inventaireActifsTab = 'beliers'; inventaireActifsRecherche = ''; render('inventaire-actifs'); });
  eq((await lignes()).length, 2, nom + ' : 2 béliers');
  await frappe('b3');
  eq((await lignes()).map(l => l[0]), ['B34'], nom + ' : bélier trouvé par son n° de travail (casse ignorée)');
  await page.click('.inventaire-actifs-row');
  eq(await page.evaluate(() => [currentView, currentBelierId]), ['belier-detail', 'be2'], nom + ' : clic -> fiche bélier');
  await page.evaluate(() => { inventaireActifsTab = 'agneaux'; inventaireActifsRecherche = ''; render('inventaire-actifs'); });
  eq((await lignes()).length, 2, nom + ' : 2 agneaux');
  await frappe('99002');
  eq((await lignes()).length, 1, nom + ' : agneau trouvé par son n°');
  await page.click('.inventaire-actifs-row');
  eq(await page.evaluate(() => [currentView, pageTitle.textContent]), ['detail', 'Brebis n°10001'], nom + ' : clic sur un agneau -> fiche de la mère');

  // ---- exports = liste affichée
  await page.evaluate(() => { inventaireActifsTab = 'brebis'; inventaireActifsRecherche = ''; render('inventaire-actifs'); });
  await frappe('3');
  await page.evaluate(() => { window.__saisies = []; });
  await page.click('#btn-export-inventaire-pdf'); await page.waitForFunction(() => window.__saisies.length === 1);
  const pdf = await page.evaluate(() => window.__saisies[0]);
  check(/^inventaire_brebis_2026-10-09\.pdf$/.test(pdf.nom) && pdf.mime === 'application/pdf', nom + ' : nom du PDF ' + pdf.nom);
  await page.click('#btn-export-inventaire-xlsx'); await page.waitForFunction(() => window.__saisies.length === 2);
  const xl = await page.evaluate(() => ({ s: window.__saisies[1], f: window.__xlsx }));
  eq(xl.s.nom, 'inventaire_brebis_2026-10-09.xlsx', nom + ' : nom de l\'Excel');
  eq(xl.f[0].rows, [['N° court', 'N° long', 'N° officiel'], ['3', '021003', '62991010003'], ['23', '021023', '62991010023']], nom + ' : l\'Excel ne contient que les lignes affichées');
  check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), nom + ' : aucune écriture de données');
  console.log('OK ' + nom + ' : boutons, recherche (tous les numéros, espaces, focus), onglets, clic vers les fiches, exports = liste affichée.');
  await page.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS DE L\'ÉCRAN INVENTAIRE SONT PASSÉS');
