/* Bilan de campagne MOBILE (maquette « Bilan de campagne mobile », mise à jour) : onglets « Brebis à régulariser » et « Bilan de reproduction ».
   - Libellés d'onglets raccourcis sur mobile (À régulariser / Reproduction / Économique / Lactation), PC inchangé.
   - Brebis à régulariser : bande rouge des incohérences (ouvre la liste, « Ouvrir la fiche »), barre d'avancement, 4 tuiles = chiffres de la page PC,
     carte « À régulariser » (recherche par n°, filtre d'âge, 8 lignes puis « Voir les N autres »), sections « Ont mis bas » / « Vides définitives »
     repliables, export Excel (même fichier que le PC), chaque ligne ouvre la fiche sans rien écrire, plus de carte « sans contrôle laitier ».
   - Bilan de reproduction : sélecteur de campagne, taux de réussite, 4 tuiles et tableau par groupe d'âge = chiffres de la page PC, « Tout afficher »,
     « Détail par millésime » repliable (= tableau PC), lots IA / Éponge en cartes repliables = tableaux PC (campagne en cours seulement, comme sur PC),
     boutons PDF, aucun graphique / comparatif / mouvements sur mobile.
   - PDF inchangés : mêmes octets sur PC et sur mobile (bilan par âge, bilan complet, lot IA, lot Éponge).
   Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { installerCasPdf } from './lib/jeux_pdf.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const norm = s => String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const browser = await chromium.launch(LAUNCH);
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-03-15T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(installerCasPdf);
  await page.evaluate(() => {
    jeuBilanSynth();
    DB.brebis.filter(s => (s.agnelages || []).length).slice(0, 2).forEach(s => { s.videesDefinitives = [{ campagne: DB.campagneDebut, date: '2026-02-01' }]; });   // 2 incohérences
    DB.brebis.filter(s => !(s.agnelages || []).length).slice(0, 3).forEach(s => { s.videesDefinitives = [{ campagne: DB.campagneDebut, date: '2026-01-20' }]; });  // 3 vides définitives
    const eids = DB.brebis.filter(s => (s.agnelages || []).length).map(s => s.eid);
    DB.lots = [
      { id: 'lia1', nom: 'IA septembre', type: 'reproduction', mode: 'IA', cible: 'Brebis', membres: eids.slice(0, 80), dateEvenement: '2025-09-25', dateCreation: '2025-09-25' },
      { id: 'lia2', nom: 'IA octobre', type: 'reproduction', mode: 'IA', cible: 'Brebis', membres: eids.slice(80, 140), dateEvenement: '2025-10-05', dateCreation: '2025-10-05' },
      { id: 'lep1', nom: 'Éponge août', type: 'reproduction', mode: 'EP', cible: 'Brebis', membres: eids.slice(140, 220), dateEvenement: '2025-08-20', dateCreation: '2025-08-20' }
    ];
    window.__avant = JSON.stringify(DB); window.__saves = 0;
    window.__exports = [];
    exportBilanAgeExactPdf = async n => { window.__exports.push(['age', n]); };
    exportBilanCompletPdf = async n => { window.__exports.push(['complet', n]); };
    exportLotIaPdf = async l => { window.__exports.push(['lia', l.id]); };
    exportLotEpongePdf = async l => { window.__exports.push(['lep', l.id]); };
    window.__feuilles = null; buildXlsxWorkbook = async f => { window.__feuilles = f; return new Uint8Array([1]); };
    window.__fich = []; saveOrShareBinaryFile = async (nom) => { window.__fich.push(nom); };
  });
  return page;
}
const aller = (page, tab) => page.evaluate(t => { bilanCampagneTab = t; render('bilan-campagne'); window.scrollTo(0, 0); }, tab);
const pc = await ouvrir(true), mob = await ouvrir(false);

// ================================================================ 1. onglets
await aller(mob, 'incoherences');
eq(await mob.evaluate(() => [...document.querySelectorAll('.tab-bar .tab-btn')].map(b => b.textContent)), ['À régulariser', 'Reproduction', 'Économique', 'Lactation'], 'onglets mobile raccourcis');
check(await mob.evaluate(() => { const r = [...document.querySelectorAll('.tab-bar .tab-btn')].map(b => b.getBoundingClientRect()); return r.every(x => x.height >= 44) && new Set(r.map(x => Math.round(x.top))).size === 1 && document.documentElement.scrollWidth <= 390; }), 'onglets sur une ligne (≥ 44 px), pas de défilement horizontal');
await aller(pc, 'incoherences');
eq(await pc.evaluate(() => [...document.querySelectorAll('.tab-bar .tab-btn')].map(b => b.textContent)), ['Brebis à régulariser', 'Bilan de reproduction', 'Bilan économique', 'Bilan de lactation'], 'onglets PC inchangés');
await mob.click('.tab-bar .tab-btn[data-tab="reproduction"]');
check(await mob.evaluate(() => bilanCampagneTab === 'reproduction' && !!document.getElementById('btn-export-bilan-complet-pdf')), 'clic sur « Reproduction » : onglet ouvert');
await mob.click('.tab-bar .tab-btn[data-tab="incoherences"]');
console.log('OK 1 onglets : libellés raccourcis sur mobile (une ligne, ≥ 44 px), libellés complets sur PC, navigation entre onglets.');

// ================================================================ 2. Brebis à régulariser : chiffres = page PC
const kpiPc = Object.fromEntries(await pc.evaluate(() => [...document.querySelectorAll('#pc-regulariser .brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent.trim(), [k.querySelector('.brd-kpi-v').textContent.trim(), (k.querySelector('.brd-kpi-s') || { textContent: '' }).textContent.trim()]])));
const tuiles = await mob.evaluate(() => [...document.querySelectorAll('.bc-tuiles .reg-tuile')].map(t => [t.querySelector('.reg-tuile-l').textContent, t.querySelector('.reg-tuile-v').textContent, t.querySelector('.reg-tuile-s').textContent, t.className.replace('reg-tuile ', '')]));
eq(tuiles.map(t => t[0]), ['À régulariser', 'Ont mis bas', 'Vides définitives', 'Brebis présentes'], 'ordre des tuiles');
eq(tuiles.map(t => t[3]), ['ambre', 'vert', 'bleu', 'gris'], 'couleurs des tuiles');
tuiles.forEach(t => { check(kpiPc[t[0]] && kpiPc[t[0]][0] === t[1], 'tuile « ' + t[0] + ' » = page PC : ' + t[1] + ' / ' + JSON.stringify(kpiPc[t[0]])); });
eq(tuiles.slice(0, 3).map(t => norm(t[2])), ['À régulariser', 'Ont mis bas', 'Vides définitives'].map(l => norm(kpiPc[l][1])), 'pourcentages = page PC');
const d = await mob.evaluate(() => { const x = bilanARegulariserData(); return { reg: x.groupes.aRegulariser.length, mb: x.groupes.misesBas.length, vd: x.groupes.videsDefinitives.length, inco: x.groupes.incoherentes.length, actives: x.actives, informees: x.informees }; });
eq([d.mb, d.vd, d.inco, d.actives], [363, 3, 2, 401], 'jeu : 363 mises bas, 3 vides, 2 incohérences, 401 brebis');
check(d.reg + d.mb + d.vd === d.actives, 'groupes = brebis actives');
check(await mob.evaluate(() => /sur/.test(document.querySelector('.bc-avance-t span').textContent)) && norm(await mob.textContent('.bc-avance-t span')) === d.informees + ' sur ' + d.actives + ' renseignées', 'avancement : ' + await mob.textContent('.bc-avance-t span'));
check(await mob.evaluate(() => document.querySelector('.bc-barre').children.length === 3), 'barre d\'avancement à 3 segments');
check(norm(await mob.textContent('#bc-bande-inco .cl-bande-n')) === kpiPc['Incohérences'][0] && /Incohérences à trancher/.test(await mob.textContent('#bc-bande-inco')), 'bande rouge : même nombre que la page PC (' + kpiPc['Incohérences'][0] + ')');
check(await mob.evaluate(() => !document.getElementById('carte-sans-controle-laitier') && !/sans contrôle laitier/i.test(document.getElementById('app').textContent) && !document.querySelector('table')), 'plus de carte « sans contrôle laitier », aucun tableau');
console.log('OK 2 Brebis à régulariser : 4 tuiles (ambre / vert / bleu / gris) = chiffres et pourcentages de la page PC, avancement ' + d.informees + ' sur ' + d.actives + ', bande rouge = ' + d.inco + ', plus de carte « sans contrôle laitier ».');

// ================================================================ 3. liste, recherche, filtre d'âge, « Voir les autres »
const vis = () => mob.evaluate(() => [...document.querySelectorAll('#pc-reg-liste [data-num]:not(.hidden)')].length);
check(await vis() === 8, '8 lignes visibles d\'abord : ' + await vis());
check(norm(await mob.textContent('#pc-reg-plus')) === 'Voir les ' + (d.reg - 8) + ' autres', 'bouton : ' + await mob.textContent('#pc-reg-plus'));
await mob.click('#pc-reg-plus');
check(await vis() === d.reg && await mob.evaluate(() => getComputedStyle(document.getElementById('pc-reg-plus')).display === 'none'), 'toutes les lignes après « Voir les autres »');
const nums = await mob.evaluate(() => [...document.querySelectorAll('#pc-reg-liste [data-num]')].map(l => l.dataset.num));
const numsPc = await pc.evaluate(() => [...document.querySelectorAll('#pc-reg-liste .pc-li')].map(l => l.dataset.num));
eq(nums, numsPc, 'mêmes brebis, même ordre que la page PC');
await mob.fill('#pc-reg-recherche', nums[3].slice(-3));
const trouve = await mob.evaluate(() => [...document.querySelectorAll('#pc-reg-liste [data-num]:not(.hidden)')].map(l => l.dataset.num));
check(trouve.includes(nums[3]) && trouve.every(n => n.includes(nums[3].slice(-3))) && trouve.length === nums.filter(n => n.includes(nums[3].slice(-3))).length, 'recherche par n° : ' + trouve);
await mob.fill('#pc-reg-recherche', '99999');
check(await mob.evaluate(() => document.getElementById('pc-reg-aucune').style.display !== 'none') && await vis() === 0, 'recherche sans résultat : message');
await mob.fill('#pc-reg-recherche', '');
const ages = await mob.evaluate(() => [...document.querySelectorAll('#pc-reg-age option')].map(o => o.value));
check(ages.length >= 2 && ages[0] === '', 'filtre d\'âge : ' + ages);
await mob.selectOption('#pc-reg-age', ages[1]);
const parAge = await mob.evaluate(() => [...document.querySelectorAll('#pc-reg-liste [data-num]:not(.hidden)')].map(l => l.dataset.age));
check(parAge.length > 0 && parAge.every(a => a === ages[1]), 'filtre d\'âge : seulement l\'âge ' + ages[1] + ' (' + parAge.length + ' lignes)');
await mob.selectOption('#pc-reg-age', '');
console.log('OK 3 liste : 8 lignes puis « Voir les ' + (d.reg - 8) + ' autres », mêmes brebis et même ordre que le PC, recherche par n°, filtre d\'âge, aucun résultat.');

// ================================================================ 4. sections repliables, bande rouge, fiches
const corps = id => mob.evaluate(i => { const c = document.querySelector('#bc-sec-' + i + ' .bc-sec-corps'); return { cache: c.classList.contains('hidden'), lignes: c.querySelectorAll('[data-num]').length, visibles: c.querySelectorAll('[data-num]:not(.hidden)').length, aria: document.querySelector('#bc-sec-' + i + ' .bc-sec-tete').getAttribute('aria-expanded') }; }, id);
eq(await corps('mb'), { cache: true, lignes: d.mb, visibles: 20, aria: 'false' }, 'Ont mis bas : repliée, ' + d.mb + ' brebis (20 lignes visibles une fois dépliée)');
await mob.click('#bc-sec-mb .bc-sec-tete');
eq(await corps('mb'), { cache: false, lignes: d.mb, visibles: 20, aria: 'true' }, 'Ont mis bas : dépliée (20 premières lignes)');
check(norm(await mob.textContent('#bc-sec-mb .bc-plus')) === 'Voir les ' + (d.mb - 20) + ' autres', '« Voir les autres » de la section');
await mob.click('#bc-sec-mb .bc-plus');
eq((await corps('mb')).visibles, d.mb, 'section dépliée : toutes les lignes');
await mob.click('#bc-sec-mb .bc-sec-tete');
check((await corps('mb')).cache, 'Ont mis bas : repliée de nouveau');
await mob.click('#bc-sec-vd .bc-sec-tete');
eq(await corps('vd'), { cache: false, lignes: d.vd, visibles: d.vd, aria: 'true' }, 'Vides définitives : dépliée');
check(norm(await mob.textContent('#bc-sec-vd .reg-pastille')) === d.vd + ' brebis' && norm(await mob.textContent('#bc-sec-mb .reg-pastille')) === d.mb + ' brebis', 'pastilles « N brebis »');
check(await mob.evaluate(() => document.getElementById('bc-liste-inco').classList.contains('hidden')), 'liste des incohérences repliée');
await mob.click('#bc-bande-inco');
const inco = await mob.evaluate(() => [...document.querySelectorAll('#bc-liste-inco .bc-li')].map(l => [l.querySelector('.bc-li-n').textContent, l.querySelector('.bc-li-f').textContent]));
check(inco.length === d.inco && inco.every(i => i[1] === 'Ouvrir la fiche'), 'bande rouge ouverte : ' + d.inco + ' lignes « Ouvrir la fiche » : ' + JSON.stringify(inco));
await mob.click('#bc-bande-inco');
check(await mob.evaluate(() => document.getElementById('bc-liste-inco').classList.contains('hidden')), 'bande rouge : se referme');
// chaque ligne ouvre la fiche, sans écriture
for (const sel of ['#pc-reg-liste [data-num] >> nth=0', '#bc-sec-vd [data-num] >> nth=0']) {
  await aller(mob, 'incoherences'); if (sel.startsWith('#bc-sec')) await mob.click('#bc-sec-vd .bc-sec-tete');
  const num = await mob.evaluate(s => document.querySelector(s.replace(' >> nth=0', '')).dataset.num, sel);
  await mob.click(sel);
  check(await mob.evaluate(n => currentView === 'detail' && new RegExp(n).test(document.getElementById('app').textContent) && window.__saves === 0, num), 'la ligne n°' + num + ' ouvre sa fiche, 0 saveData');
}
await aller(mob, 'incoherences'); await mob.click('#bc-bande-inco'); await mob.click('#bc-liste-inco .bc-li >> nth=0');
check(await mob.evaluate(() => currentView === 'detail' && window.__saves === 0), 'une incohérence ouvre sa fiche');
console.log('OK 4 repli / dépli : sections (« Voir les autres » à 20), bande rouge ouvre « Ouvrir la fiche », chaque ligne ouvre la fiche (3 cas), 0 écriture.');

// ================================================================ 5. export Excel (même fichier que le PC)
await aller(mob, 'incoherences');
await mob.evaluate(() => { window.__feuilles = null; window.__fich = []; });
await mob.click('#btn-export-regulariser-xlsx'); await mob.waitForFunction(() => window.__fich.length);
const xm = await mob.evaluate(() => ({ nom: window.__fich[0], rows: window.__feuilles[0].rows }));
await pc.evaluate(() => { window.__feuilles = null; window.__fich = []; }); await aller(pc, 'incoherences');
await pc.click('#btn-export-regulariser-xlsx'); await pc.waitForFunction(() => window.__fich.length);
const xp = await pc.evaluate(() => ({ nom: window.__fich[0], rows: window.__feuilles[0].rows }));
eq(xm.rows, xp.rows, 'export Excel mobile = export Excel PC'); eq(xm.nom.replace(/_\d{4}-\d{2}-\d{2}/, ''), xp.nom.replace(/_\d{4}-\d{2}-\d{2}/, ''), 'même nom de fichier');
check(xm.rows.length === 1 + d.actives, 'une ligne par brebis active : ' + xm.rows.length);
console.log('OK 5 export Excel : bouton en bas, même fichier que sur PC (' + xm.rows.length + ' lignes).');

// ================================================================ 6. Bilan de reproduction : chiffres = page PC
await aller(mob, 'reproduction'); await aller(pc, 'reproduction');
const kpiR = await pc.evaluate(() => [...document.querySelectorAll('.brd-kpis .brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent.trim(), k.querySelector('.brd-kpi-v').textContent.trim(), k.querySelector('.brd-kpi-s').textContent.trim()]));
const tuilesR = await mob.evaluate(() => [...document.querySelectorAll('.bc-tuiles .reg-tuile')].map(t => [t.querySelector('.reg-tuile-l').textContent, t.querySelector('.reg-tuile-v').textContent, t.querySelector('.reg-tuile-s').textContent, t.className.replace('reg-tuile ', '')]));
eq(tuilesR.map(t => t[3]), ['vert', 'bleu', 'ambre', 'rouge'], 'couleurs des tuiles');
eq(tuilesR.map(t => norm(t[1])), kpiR.map(k => norm(k[1])), 'valeurs des 4 tuiles = indicateurs de la page PC');
kpiR.forEach((k, i) => { const nb = (k[2].match(/\d+/g) || []).join('/').split('/')[0]; check(!nb || tuilesR[i][2].includes(nb), 'sous-titre tuile « ' + tuilesR[i][0] + ' » = ' + k[2].slice(0, 40) + ' / ' + tuilesR[i][2]); });
const tauxPc = await pc.evaluate(() => { const a = document.querySelector('.brd-alert.info strong'); return a ? a.textContent : null; });
check(tauxPc && norm(await mob.textContent('.bc-taux b')) === norm(tauxPc), 'taux de réussite = page PC : ' + tauxPc);
const ligPc = await pc.evaluate(() => [...document.querySelector('.brd-t').querySelectorAll('tr')].slice(1).map(tr => [...tr.children].map(td => td.textContent.trim())));
const ligMobCles = await mob.evaluate(() => [...document.querySelectorAll('#bc-groupes .bc-lg:not(.hidden)')].map(l => [...l.children].map(c => c.textContent.trim())));
eq(ligMobCles.map(l => l[0]), ['Brebis présentes', 'Mises bas', 'Fertilité', 'Agneaux nés', 'Prolificité', 'Mortalité totale'], 'lignes clés d\'abord');
await mob.click('#bc-tout-afficher');
const ligMob = await mob.evaluate(() => [...document.querySelectorAll('#bc-groupes .bc-lg')].map(l => [...l.children].map(c => c.textContent.trim())));
check(await mob.evaluate(() => document.querySelectorAll('#bc-groupes .bc-lg.hidden').length === 0) && (await mob.textContent('#bc-tout-afficher')) === 'Réduire', '« Tout afficher » montre toutes les lignes');
eq(ligMob.map(l => l.slice(1)), ligPc.map(l => l.slice(1)), 'toutes les valeurs (Brebis / Antenaises / Total) = tableau de la page PC');
check(ligMob.every((l, i) => ligPc[i][0].startsWith(l[0])), 'mêmes libellés (abrégés) : ' + ligMob.map(l => l[0]).join(' | '));
await mob.click('#bc-tout-afficher');
check(await mob.evaluate(() => document.querySelectorAll('#bc-groupes .bc-lg:not(.hidden)').length === 6), '« Réduire » revient aux 6 lignes clés');
console.log('OK 6 Bilan de reproduction : taux ' + tauxPc + ', 4 tuiles et ' + ligMob.length + ' lignes du tableau par groupe d\'âge = page PC ; 6 lignes clés puis « Tout afficher » / « Réduire ».');

// ================================================================ 7. détail par millésime (repliable) = tableau PC
const millPc = await pc.evaluate(() => [...document.querySelectorAll('.brd-t')].find(t => /Millésime/.test(t.textContent)).querySelectorAll('tr:not(:first-child)').length && [...[...document.querySelectorAll('.brd-t')].find(t => /Millésime/.test(t.textContent)).querySelectorAll('tr')].slice(1).map(tr => [...tr.children].map(td => td.textContent.replace('antenaises', '').trim())));
check(await mob.evaluate(() => document.querySelector('#bc-sec-mill .bc-sec-corps').classList.contains('hidden')), 'détail par millésime replié');
check(norm(await mob.textContent('#bc-sec-mill .reg-pastille')) === millPc.length + ' millésimes', 'pastille « ' + millPc.length + ' millésimes »');
await mob.click('#bc-sec-mill .bc-sec-tete');
const millMob = await mob.evaluate(() => [...document.querySelectorAll('#bc-sec-mill .bc-m')].map(m => [m.querySelector('.bc-m-t').childNodes[0].textContent.trim(), ...[...m.querySelectorAll('.bc-m-v')].map(v => v.textContent.trim())]));
eq(millMob.map(m => m.map(x => norm(x).replace(/\s/g, ''))), millPc.map(l => [l[0], l[1], l[2], l[3], l[4], l[5]].map(x => norm(x).replace(/\s/g, ''))), 'millésimes = tableau de la page PC (présentes, mises bas, fertilité, prolificité, durée)');
check(await mob.evaluate(() => /antenaises/.test(document.querySelector('#bc-sec-mill .bc-m .reg-pastille').textContent)), 'pastille « antenaises » sur le millésime le plus jeune');
console.log('OK 7 détail par millésime : replié, ' + millMob.length + ' millésimes dépliés = tableau de la page PC.');

// ================================================================ 8. lots IA / Éponge (cartes repliables = tableaux PC)
eq(await mob.evaluate(() => [...document.querySelectorAll('#bc-lots-ia .bc-lot-nom, #bc-lots-eponge .bc-lot-nom')].map(n => n.textContent)), ['IA septembre', 'IA octobre', 'Éponge août'], 'lots affichés sous les autres sections');
check(await mob.evaluate(() => [...document.querySelectorAll('.bc-lot-corps')].every(c => c.classList.contains('hidden'))), 'cartes de lot repliées');
check(await mob.evaluate(() => { const o = [...document.querySelectorAll('#app > *, #app > * > *')].map(e => e.id); return document.getElementById('bc-sec-mill').compareDocumentPosition(document.getElementById('bc-lots-ia')) & 4; }), 'lots sous le détail par millésime');
// têtes : nom, effectif, fertilité, prolif. = PC
const teteMob = await mob.evaluate(() => [...document.querySelectorAll('.bc-lot-tete')].map(t => [t.querySelector('.bc-lot-nom').textContent, t.querySelector('.bc-lot-eff').textContent, ...[...t.querySelectorAll('.bc-lot-v')].map(v => v.textContent)]));
const tetePc = await pc.evaluate(() => [...document.querySelectorAll('.lot-ia-head, .lot-eponge-head')].map(h => { const v = h.querySelectorAll('div > div'); return h.innerText.replace(/\s+/g, ' ').trim(); }));
teteMob.forEach((t, i) => { const pcTxt = norm(tetePc[i]); check(pcTxt.includes(t[0]) && pcTxt.includes(norm(t[1])) && pcTxt.includes(norm(t[2])) && pcTxt.includes(norm(t[3])), 'tête du lot « ' + t[0] + ' » = PC : ' + JSON.stringify(t) + ' / ' + pcTxt); });
await mob.click('.lot-ia-head >> nth=0'); await mob.click('.lot-eponge-head');
const tabMob = await mob.evaluate(() => [...document.querySelectorAll('.lot-ia-card .bc-lot-corps:not(.hidden) .bc-lt, .lot-eponge-card .bc-lot-corps:not(.hidden) .bc-lt')].map(l => [...l.children].map(c => c.textContent.trim())));
const tabPc = await pc.evaluate(() => [...document.querySelectorAll('.lot-ia-body, .lot-eponge-body')].map(b => b.classList.add('hidden') || b).slice(0, 3).filter(b => true).map(b => [...b.querySelectorAll('tr')].slice(1).map(tr => [...tr.children].map(td => td.textContent.trim()))));
// premier lot IA (tableau 4 colonnes) et lot éponge (2 colonnes)
eq(tabMob.slice(0, 3), tabPc[0], 'lot IA : tableau IA / 1er retour / Global = page PC');
eq(tabMob.slice(3), tabPc[tabPc.length - 1], 'lot Éponge : colonne Global = page PC');
check(await mob.evaluate(() => /IA\s*1er retour\s*Global/.test(document.querySelector('.lot-ia-card .bc-lh').textContent.replace(/\s+/g, ' ')) && /Global/.test(document.querySelector('.lot-eponge-card .bc-lh').textContent)), 'en-têtes IA / 1er retour / Global ; Global seul pour l\'éponge');
const ageMob = await mob.evaluate(() => [...document.querySelectorAll('.lot-ia-card .bc-lot-age-l')].slice(0, 2).map(l => [l.children[0].textContent, l.children[1].textContent]));
const agePc = await pc.evaluate(() => [...document.querySelector('.lot-ia-body').querySelectorAll('div[style*="justify-content:space-between"]')].map(l => [l.children[0].textContent, l.children[1].textContent]));
eq(ageMob.map(l => l[0]), agePc.map(l => l[0]), 'détail par groupe d\'âge : mêmes libellés (Antenaises / Brebis)');
eq(ageMob.map(l => norm(l[1])), agePc.map(l => norm(l[1]).replace('Fertilité ', '').replace('Prolificité ', '')), 'détail par groupe d\'âge : mêmes valeurs');
check(await mob.evaluate(() => !/Unotec|monte naturelle \(MN\)|÷/.test(document.querySelector('#bc-lots-ia').textContent)) && /La monte naturelle n'a pas de carte dédiée/.test(await mob.textContent('#bc-lots-eponge')), 'notes longues remplacées par une ligne sur la monte naturelle');
check(await mob.evaluate(() => document.querySelector('.lot-ia-card').classList.contains('ouverte')), 'chevron : carte ouverte');
await mob.click('.lot-ia-head >> nth=0');
check(await mob.evaluate(() => document.querySelector('.lot-ia-card .bc-lot-corps').classList.contains('hidden')), 'repli de la carte de lot');
// boutons
await mob.click('.lot-ia-head >> nth=1'); await mob.click('.btn-export-lot-ia-pdf[data-lot-id="lia2"]');
await mob.click('.btn-export-lot-eponge-pdf');
eq(await mob.evaluate(() => window.__exports), [['lia', 'lia2'], ['lep', 'lep1']], 'boutons « Export PDF de ce lot »');
console.log('OK 8 lots IA / Éponge : 3 cartes repliables (sous le détail par millésime), têtes et tableaux = page PC, groupes d\'âge, une ligne sur la monte naturelle, exports PDF par lot.');

// ================================================================ 9. campagne passée : pas de lots (comme PC), PDF, sélecteur
const optsM = await mob.evaluate(() => [...document.querySelectorAll('#brd-campagne-select option')].map(o => o.textContent));
const optsP = await pc.evaluate(() => [...document.querySelectorAll('#brd-campagne-select option')].map(o => o.textContent));
eq(optsM, optsP, 'mêmes campagnes proposées que sur PC'); check(/en cours/.test(optsM[0]), 'campagne en cours en tête');
await mob.evaluate(() => { window.__exports = []; });
await mob.click('#btn-export-bilan-age-pdf'); await mob.click('#btn-export-bilan-complet-pdf');
eq(await mob.evaluate(() => window.__exports), [['age', undefined], ['complet', undefined]], 'PDF de la campagne en cours : argument inchangé');
const passee = await mob.evaluate(() => document.querySelector('#brd-campagne-select').options[1].value);
await mob.selectOption('#brd-campagne-select', passee);
await pc.selectOption('#brd-campagne-select', passee);
check(await mob.evaluate(() => !document.getElementById('bc-lots-ia') && !document.getElementById('bc-lots-eponge') && !document.querySelector('.bc-taux')), 'campagne passée : ni lots ni taux de réussite');
check(await pc.evaluate(() => !document.querySelector('.lot-ia-card') && !document.querySelector('.lot-eponge-card')), 'comme sur PC');
const kpiP2 = await pc.evaluate(() => [...document.querySelectorAll('.brd-kpis .brd-kpi .brd-kpi-v')].map(v => v.textContent.trim()));
eq(await mob.evaluate(() => [...document.querySelectorAll('.bc-tuiles .reg-tuile-v')].map(v => v.textContent.trim())), kpiP2, 'tuiles de la campagne ' + passee + ' = page PC');
await mob.evaluate(() => { window.__exports = []; });
await mob.click('#btn-export-bilan-age-pdf'); await mob.click('#btn-export-bilan-complet-pdf');
eq(await mob.evaluate(() => window.__exports), [['age', +passee], ['complet', +passee]], 'PDF de la campagne affichée');
console.log('OK 9 campagne passée : sélecteur identique au PC, lots et taux absents (comme PC), tuiles = PC, PDF de la campagne affichée.');

// ================================================================ 10. retraits mobile, PC inchangé, aucune écriture
await mob.selectOption('#brd-campagne-select', await mob.evaluate(() => String(DB.campagneDebut)));
check(await mob.evaluate(() => !document.querySelector('.brd-svg, svg.brd-svg, .pc-bars, table') && !/Comparatif|Mouvements des brebis|Mouvements des agneaux|Mises bas par semaine|Répartition des portées/.test(document.getElementById('app').textContent)), 'mobile : ni graphique, ni comparatif, ni mouvements');
check(await pc.evaluate(() => { bilanReproductionCampagneAffichee = null; render('bilan-campagne'); return !!document.querySelector('.brd-svg') && /Comparatif/.test(document.getElementById('app').textContent) && /Mouvements des brebis/.test(document.getElementById('app').textContent) && /Mouvements des agneaux/.test(document.getElementById('app').textContent); }), 'PC : graphiques, comparatif et mouvements toujours là');
check(await mob.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0) && await pc.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'aucune écriture : DB identique, 0 saveData');
console.log('OK 10 retraits mobile (graphiques, comparatif, mouvements) ; PC inchangé ; DB identique, 0 saveData.');
await mob.context().close(); await pc.context().close();

// ================================================================ 11. PDF inchangés : mêmes octets sur PC et mobile
async function pdfs(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-03-15T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(installerCasPdf);
  const out = {};
  for (const n of ['bilan_age', 'bilan_complet', 'lot_ia', 'lot_eponge']) out[n] = await page.evaluate(async (n) => { const o = await window.CAS_PDF[n](); let h = 0; for (const x of o) h = (h * 31 + x) >>> 0; return o.length + ':' + h; }, n);
  await page.context().close(); return out;
}
const pdfPc = await pdfs(true), pdfMob = await pdfs(false);
eq(pdfMob, pdfPc, 'PDF identiques sur PC et mobile');
console.log('OK 11 PDF inchangés : bilan par âge, bilan complet, lot IA, lot Éponge = mêmes octets sur PC et mobile (références pdf_avant.json vérifiées par test_pdf_harmonises / test_bilan_pdf).');
await browser.close();
console.log('\nTOUS LES TESTS DU BILAN DE CAMPAGNE MOBILE SONT PASSÉS.');
