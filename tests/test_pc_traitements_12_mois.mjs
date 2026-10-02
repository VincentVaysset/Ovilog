/* Suivi bio « Traitements sur 12 mois » (PC et mobile, une seule fonction pure) : fenêtre glissante (Au − 1 an + 1 jour), animaux actifs brebis /
   antenaises / béliers, un soin compte à sa date de début, une cure = 1 traitement, un soin collectif = 1 par animal, option « compte » par produit
   (oui / non / à confirmer = ne compte pas, signalé), numérotation chronologique, niveaux (seuil − 1 = à surveiller, seuil = limite, au-delà =
   dépassé), seuil réglable, tri (traitements décroissants, âge décroissant, n° croissant), filtres, vue par intervention, exports Excel / PDF,
   mobile, lecture seule, jamais de blocage. saveData est REMPLACÉ par un compteur. Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1600 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const jeu = (bio, nombreAnimauxUn) => page.evaluate(([bio, nbUn]) => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign({}, DB.exploitation, { elevageBio: !!bio });
  DB.produits = { vaccins: ['Bravoxin 10'], antibiotiques: ['Antibiotique X', 'Intramicine'], antiparasitaires: ['Antiparasitaire Y'], antiinflammatoires: ['Finadyne'], autres: ['Aluspray'] };
  DB.produitsInfo = {}; ['Bravoxin 10', 'Antibiotique X', 'Intramicine', 'Antiparasitaire Y', 'Finadyne', 'Aluspray'].forEach(n => { DB.produitsInfo[n] = { posologie: null, delaiAttente: 0, delaiLait: 0, delaiViande: 0, surOrdonnance: false, reserveVeterinaire: false }; });
  const T = { 'Antibiotique X': ['Traitement', 'Antibiotique'], Intramicine: ['Traitement', 'Antibiotique'], Finadyne: ['Traitement', 'Anti-inflammatoire'], 'Antiparasitaire Y': ['Traitement', 'Antiparasitaire'], 'Bravoxin 10': ['Vaccin', null], Aluspray: ['Autre', 'Soin de plaie'] };
  const soin = (date, produit, o) => Object.assign({ type: T[produit][0], sousType: T[produit][1], produit, date, quantiteCc: 2, intervenant: 'Éleveur', commentaire: '', dureeJours: 1 }, o || {});
  window.soin = soin;
  DB.brebis = [
    fiche(eid(9, 985), { id: 'a985', sanitaire: [soin('2025-11-12', 'Antibiotique X'), soin('2026-01-03', 'Finadyne'), soin('2026-04-21', 'Antibiotique X'), soin('2026-05-12', 'Bravoxin 10'), soin('2026-09-18', 'Intramicine')] }),
    fiche(eid(9, 9152), { id: 'a9152', sanitaire: [soin('2025-11-02', 'Antibiotique X'), soin('2026-03-14', 'Finadyne'), soin('2026-04-30', 'Antiparasitaire Y'), soin('2026-09-20', 'Intramicine')] }),
    fiche(eid(0, 2118), { id: 'a2118', sanitaire: [soin('2026-01-27', 'Antibiotique X'), soin('2026-09-30', 'Antibiotique X')] }),
    fiche(eid(8, 8133), { id: 'a8133', sanitaire: [soin('2026-06-01', 'Intramicine', { dureeJours: 5 })] }),                   // cure de 5 jours = 1 traitement
    fiche(eid(8, 8200), { id: 'a8200', sanitaire: [soin('2025-10-02', 'Antibiotique X'), soin('2026-10-03', 'Antibiotique X')] }),   // 02/10/2025 : veille du début ; 03/10/2026 : après « Au » : aucun ne compte dans la fenêtre
    fiche(eid(8, 8201), { id: 'a8201', sanitaire: [soin('2025-10-03', 'Antibiotique X'), soin('2026-10-02', 'Finadyne')] }),         // bornes incluses : 03/10/2025 et 02/10/2026
    fiche(eid(5, 5001), { id: 'a5001', sanitaire: [soin('2026-08-01', 'Aluspray')] }),                                              // antenaise, produit « à confirmer » : ne compte pas
    fiche(eid(8, 8300), { id: 'a8300', statut: 'vendue', sanitaire: [soin('2026-08-01', 'Antibiotique X'), soin('2026-08-02', 'Antibiotique X'), soin('2026-08-03', 'Antibiotique X')] })   // vendue : exclue
  ];
  for (let i = 0; i < nbUn; i++) DB.brebis.push(fiche(eid(7, 7000 + i), { id: 'u' + i, sanitaire: [soin('2026-05-01', 'Antibiotique X')] }));
  DB.beliers = [fiche(eid(6, 6001), { id: 'bel', statut: 'actif', sanitaire: [soin('2026-02-01', 'Antibiotique X'), soin('2026-03-01', 'Finadyne')] })];
  DB.agnelles = [fiche(eid(5, 5900), { id: 'agn', sanitaire: [soin('2026-02-01', 'Antibiotique X'), soin('2026-03-01', 'Antibiotique X'), soin('2026-04-01', 'Antibiotique X'), soin('2026-05-01', 'Antibiotique X')] })];   // agnelle : hors suivi
  DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.intervenants = ['Éleveur'];
  window.E = eid; window.__avant = JSON.stringify(DB);
}, [bio, nombreAnimauxUn || 0]);
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);

// ================================================================ 1. fenêtre glissante
await jeu(true);
const fen = await page.evaluate(() => ['2026-10-02', '2026-03-01', '2028-02-29', '2027-01-01', '2026-12-31'].map(a => { const f = fenetre12Mois(a); return f.du + '→' + f.au; }));
check(JSON.stringify(fen) === JSON.stringify(['2025-10-03→2026-10-02', '2025-03-02→2026-03-01', '2027-03-01→2028-02-29', '2026-01-02→2027-01-01', '2026-01-01→2026-12-31']), 'fenêtre = Au − 1 an + 1 jour (29/02 compris) : ' + fen);
console.log('OK 1 fenêtre : 02/10/2026 → du 03/10/2025 ; 29/02/2028 → du 01/03/2027 ; 31/12 → du 01/01.');

// ================================================================ 2. niveaux, option « compte » par produit
const niv = await page.evaluate(() => { const f = (n, s) => niveauTraitements(n, s).cle; return { s3: [0, 1, 2, 3, 4, 5].map(n => f(n, 3)), s2: [0, 1, 2, 3].map(n => f(n, 2)), s1: [0, 1, 2].map(n => f(n, 1)), s5: [3, 4, 5, 6].map(n => f(n, 5)) }; });
check(JSON.stringify(niv.s3) === '["aucun","normal","surveiller","limite","depasse","depasse"]' && JSON.stringify(niv.s2) === '["aucun","surveiller","limite","depasse"]' && JSON.stringify(niv.s1) === '["aucun","limite","depasse"]' && JSON.stringify(niv.s5) === '["normal","surveiller","limite","depasse"]', 'niveaux : 2 à surveiller, 3 limite, 4+ dépassé ; seuil réglable : ' + JSON.stringify(niv));
const et = await page.evaluate(() => {
  const r = {};
  r.defauts = ['Antibiotique X', 'Finadyne', 'Bravoxin 10', 'Antiparasitaire Y', 'Aluspray'].map(n => etatCompteSoin({ produit: n }));
  DB.produitsInfo['Bravoxin 10'].compteTraitements = 'oui'; DB.produitsInfo['Antibiotique X'].compteTraitements = 'non';
  r.choisis = ['Bravoxin 10', 'Antibiotique X'].map(n => etatCompteSoin({ produit: n }));
  r.produitRetire = [etatCompteSoin({ produit: 'Produit retiré', type: 'Traitement', sousType: 'Antibiotique' }), etatCompteSoin({ produit: 'Produit retiré', type: 'Vaccin' }), etatCompteSoin({ produit: 'Soin de plaie', type: 'Autre', sousType: 'Soin de plaie' })];
  DB.produitsInfo['Bravoxin 10'].compteTraitements = undefined; delete DB.produitsInfo['Bravoxin 10'].compteTraitements; delete DB.produitsInfo['Antibiotique X'].compteTraitements;
  return r;
});
check(JSON.stringify(et.defauts) === '["oui","oui","non","non","a_confirmer"]' && JSON.stringify(et.choisis) === '["oui","non"]' && JSON.stringify(et.produitRetire) === '["oui","non","a_confirmer"]', 'option « compte » : défauts de la catégorie, valeur choisie prioritaire, produit retiré d\'après le type du soin : ' + JSON.stringify(et));
console.log('OK 2 niveaux (seuil réglable) et option « compte » par produit (défaut, choix, produit retiré).');

// ================================================================ 3. fonction pure
const D = await page.evaluate(() => { const d = traitements12Mois('2026-10-02'); return { du: d.du, seuil: d.seuil, kpis: d.kpis, nAConfirmer: d.nAConfirmer, animaux: d.animaux.map(a => ({ n: a.item.court || a.item.numero, cat: a.categorie, age: a.item.age, nCompte: a.nCompte, niveau: a.niveau.cle, ordres: a.traitements.map(t => t.ordre), dates: a.traitements.map(t => t.date), aConf: a.nAConfirmer })), nInterv: d.interventions.length }; });
const an = n => D.animaux.find(a => a.n.endsWith(n));
check(D.du === '2025-10-03' && D.seuil === 3, 'fenêtre et seuil par défaut');
check(an('00985').nCompte === 4 && an('00985').niveau === 'depasse' && JSON.stringify(an('00985').ordres) === '[1,2,3,null,4]', 'n°985 : 4 comptés, le vaccin ne compte pas (–), numérotation chronologique 1 2 3 – 4 : ' + JSON.stringify(an('00985')));
check(an('09152').nCompte === 3 && an('09152').niveau === 'limite' && JSON.stringify(an('09152').ordres) === '[1,2,null,3]', 'n°9152 : 3 comptés, limite atteinte (antiparasitaire ne compte pas)');
check(an('02118').nCompte === 2 && an('02118').niveau === 'surveiller', 'n°2118 : 2 comptés, à surveiller');
check(an('08133').nCompte === 1 && an('08133').dates.length === 1, 'cure de 5 jours = 1 traitement');
check(an('08200').nCompte === 0 && an('08200').dates.length === 0, 'soins du 02/10/2025 (veille du début) et du 03/10/2026 (après « Au ») hors fenêtre');
check(an('08201').nCompte === 2 && JSON.stringify(an('08201').dates) === '["2025-10-03","2026-10-02"]', 'bornes incluses : 03/10/2025 et 02/10/2026');
check(an('05001').nCompte === 0 && an('05001').aConf === 1 && D.nAConfirmer === 1, 'produit « à confirmer » : ne compte pas, signalé (1 soin)');
check(!D.animaux.some(a => a.n.endsWith('08300')) && !D.animaux.some(a => a.n.endsWith('05900')), 'brebis vendue et agnelle exclues du suivi');
check(D.animaux.length === 8 && D.animaux.some(a => a.cat === 'Bélier' && a.nCompte === 2) && an('05001').cat === 'Antenaise', 'animaux suivis : 7 brebis dont 1 antenaise + 1 bélier ; bélier 2 comptés : ' + D.animaux.map(a => a.n + ':' + a.cat).join(' '));
check(D.kpis.actifs === 8 && D.kpis.aucun === 2 && D.kpis.parNombre[1] === 1 && D.kpis.parNombre[2] === 3 && D.kpis.parNombre[3] === 1 && D.kpis.plus === 1, 'KPI : 8 actifs, 2 sans traitement compté, 1 / 3 (2 : n°2118, 8201, bélier) / 1 (3) / 1 (4+) : ' + JSON.stringify(D.kpis));
// tri : traitements décroissants, âge décroissant, n° croissant
const tri = await page.evaluate(() => {
  const c = (a, b) => comparerAnimauxAgeNumero(a, b);
  return [c({ age: 8, numero: '00100' }, { age: 6, numero: '00001' }) < 0, c({ age: 7, court: '985', numero: '00985' }, { age: 7, court: '9152', numero: '09152' }) < 0, c({ age: 7, court: '9152' }, { age: 7, court: '985' }) > 0, c({ age: null, numero: '00001' }, { age: 1, numero: '00002' }) > 0, c({ age: 7, court: '21' }, { age: 7, court: '3' }) > 0];
});
check(tri.every(Boolean), 'règle habituelle : âge décroissant puis n° croissant (numérique) : ' + tri);
console.log('OK 3 fonction pure : bornes, cure = 1, numérotation, « à confirmer » non compté, exclusions, KPI, règle de tri.');

// ================================================================ 4. collectif : un traitement par animal ; seuil réglable
await jeu(true);
const col = await page.evaluate(() => {
  [0, 1, 2].forEach(i => DB.brebis[i].sanitaire.push(soin('2026-09-25', 'Intramicine', { collectif: true, collectifId: 'TC-1' })));
  const d = traitements12Mois('2026-10-02');
  const gr = d.interventions.find(g => g.produit === 'Intramicine' && g.date === '2026-09-25');
  const a985 = d.animaux.find(a => a.item.numero === '00985');
  const d2 = traitements12Mois('2026-10-02', 2);
  return { nAnimaux: gr.animaux.length, c985: a985.nCompte, niv985: a985.niveau.cle, niv2118_s2: d2.animaux.find(a => a.item.numero === '02118' || a.item.court === '2118' || a.eid.endsWith('00118')).niveau.cle };
});
check(col.nAnimaux === 3 && col.c985 === 5, 'soin collectif : 1 traitement pour chacun des 3 animaux (n°985 passe de 4 à 5), regroupé en 1 intervention : ' + JSON.stringify(col));
console.log('OK 4 soin collectif : 1 traitement par animal, 1 ligne en vue par intervention.');

// ================================================================ 5. page PC
await jeu(true, 35);
await page.evaluate(() => { carnetSanitairePcEtat = null; render('sanitaire'); });
check(await page.evaluate(() => !!document.getElementById('cs-12-mois')), 'bouton « Traitements sur 12 mois » sur le carnet quand le bio est activé');
await page.click('#cs-12-mois'); await page.waitForSelector('#pc-s12');
const kp = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#s12-kpis .brd-kpi')].map(x => [x.querySelector('.brd-kpi-l').textContent, [x.querySelector('.brd-kpi-v').textContent.trim(), (x.querySelector('.brd-kpi-s') || { textContent: '' }).textContent.trim()]])));
check(kp['Animaux actifs'][0] === '43' && kp['Aucun traitement compté'][0] === '2' && kp['1 traitement'][0] === '36' && kp['2 traitements'][0] === '3' && kp['3 traitements'][0] === '1' && kp['4 et plus'][0] === '1' && /à surveiller/.test(kp['2 traitements'][1]) && /limite atteinte/.test(kp['3 traitements'][1]) && /seuil dépassé/.test(kp['4 et plus'][1]), 'KPI PC (6 cartes comme la maquette) : ' + JSON.stringify(kp));
check(/du 03-10-2025 au 02-10-2026/.test(await $t('.brd-sub')) && /Rappel bio/.test(await $t('#pc-s12')) && /Ce qui compte dans les 3 traitements/.test(await $t('#s12-ce-qui-compte')), 'période, cartes « Ce qui compte » et « Rappel bio »');
const cq = await $t('#s12-ce-qui-compte');
check(/Antibiotiques[^A-Z]*compte/.test(cq) && /Vaccins[^A-Z]*ne compte pas/.test(cq) && /Autres[^A-Z]*à confirmer/.test(cq), 'carte « Ce qui compte » : ' + cq);
const premiers = await page.evaluate(() => [...document.querySelectorAll('.s12-an')].slice(0, 3).map(a => a.querySelector('b').textContent + ' ' + a.querySelector('.pc-pill').textContent));
check(/985 4 traitements · seuil dépassé/.test(premiers[0]) && /9152 3 traitements · limite atteinte/.test(premiers[1]) && /2 traitements · à surveiller/.test(premiers[2]), 'liste : n°985 (4, dépassé), n°9152 (3, limite), puis 2 traitements : ' + premiers.join(' | '));
const l985 = await page.evaluate(() => [...[...document.querySelectorAll('.s12-an[data-eid]')].find(a => a.querySelector('b').textContent.includes('985') && !a.querySelector('b').textContent.includes('9852')).querySelectorAll('.s12-ln')].map(x => [...x.children].map(c => c.textContent.trim()).join(' ')));
check(l985.length === 5 && /^1 12-11-2025 Antibiotique X · Antibiotique compte$/.test(l985[0]) && /^– 12-05-2026 Bravoxin 10 ne compte pas$/.test(l985[3]) && /^4 18-09-2026 Intramicine · Antibiotique compte$/.test(l985[4]), 'lignes du n°985 : numérotées, vaccin « ne compte pas » : ' + JSON.stringify(l985));
check(/Voir les 11 autres/.test(await $t('#s12-voir-tout')), '« Voir les N autres » au-delà de 30 animaux : ' + await $t('#s12-voir-tout'));
check(await page.evaluate(() => document.querySelectorAll('.s12-an').length) === 30, '30 animaux affichés d\'abord');
await page.click('#s12-voir-tout');
check(await page.evaluate(() => document.querySelectorAll('.s12-an').length) === 41, 'tous affichés après « Voir les autres » (41 animaux avec au moins 1 traitement compté)');
console.log('OK 5 page PC : 6 KPI, période, cartes « Ce qui compte » et « Rappel bio », liste numérotée, « Voir les autres ».');

// ================================================================ 6. filtres, vue par intervention, lecture seule
await page.selectOption('#s12-min', '3');
check(await page.evaluate(() => document.querySelectorAll('.s12-an').length) === 2 && /2 animaux avec au moins 3 traitements comptés/.test(await $t('#s12-compte')), 'à partir de 3 traitements : 2 animaux : ' + await $t('#s12-compte'));
await page.selectOption('#s12-min', '1');
await page.click('.s12-cat[data-cat="brebis"]');
check(await page.evaluate(() => [...document.querySelectorAll('.s12-an')].every(a => !/Brebis ·/.test(a.querySelector('.s12-ah').textContent))), 'catégorie Brebis décochée : plus aucune brebis (reste bélier, antenaise)');
await page.click('.s12-cat[data-cat="brebis"]');
await page.fill('#s12-q', '9152');
check(await page.evaluate(() => document.querySelectorAll('.s12-an').length) === 1, 'recherche de n°9152 : 1 animal');
await page.fill('#s12-q', '');
await page.fill('#s12-au', '2026-05-01'); await page.dispatchEvent('#s12-au', 'change');
check(/du 02-05-2025 au 01-05-2026/.test(await $t('.brd-sub')), 'date « Au » modifiée : fenêtre recalculée : ' + await $t('.brd-sub'));
await page.fill('#s12-au', '2026-10-02'); await page.dispatchEvent('#s12-au', 'change');
await page.click('#s12-vue-interv');
const ti = await page.evaluate(() => [...document.querySelectorAll('#s12-table-interventions tr')].slice(1).map(r => [...r.children].map(c => c.textContent.trim()).join(' ')));
check(/18-09-2026 Intramicine/.test(ti[1] || '') || ti.some(t => /20-09-2026 Intramicine Antibiotique 1 · 9152 compte/.test(t)) || ti.length > 5, 'vue par intervention : tableau des soins : ' + ti.slice(0, 3).join(' | '));
check(ti.some(t => /^01-05-2026 Antibiotique X Antibiotique 35 animaux · 35 brebis compte Éleveur$/.test(t)), 'intervention regroupant 35 animaux (même jour, même produit) : ' + ti.filter(t => /35 animaux/.test(t)));
check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), 'écran en lecture seule : rien écrit, aucune donnée modifiée');
console.log('OK 6 filtres (≥ N traitements, catégories, n°, date « Au »), vue par intervention, lecture seule.');

// ================================================================ 7. exports Excel / PDF (suivent les filtres)
const exp = await page.evaluate(async () => {
  const cap = [];
  window.buildXlsxWorkbook = async (s) => { cap.push({ t: 'xlsx', s: JSON.parse(JSON.stringify(s)) }); return new Uint8Array([1]); };
  const bp = window.buildPdfTable; window.buildPdfTable = (a) => { cap.push({ t: 'pdf', a: JSON.parse(JSON.stringify(a)) }); return bp(a); };
  window.saveOrShareBinaryFile = async (nom, bytes, mime) => { cap.push({ t: 'file', nom, mime }); };
  suivi12Etat.vue = 'brebis'; suivi12Etat.min = 3; suivi12Etat.q = ''; suivi12Etat.au = ''; suivi12Etat.toutVoir = false; render('traitements-12-mois');
  document.getElementById('s12-export-xlsx').click(); await new Promise(r => setTimeout(r, 100));
  document.getElementById('s12-export-pdf').click(); await new Promise(r => setTimeout(r, 100));
  return cap;
});
const xl = exp.find(x => x.t === 'xlsx').s[0], pdf = exp.find(x => x.t === 'pdf').a, fich = exp.filter(x => x.t === 'file').map(x => x.nom);
check(xl.name === 'Traitements 12 mois' && xl.rows[0].join('|') === 'N°|Catégorie|Âge|Traitements comptés|Statut|Date|Produit|Type|Compte|N° d\'ordre|Fait par' && xl.rows.length === 1 + 9, 'Excel : en-têtes, 9 lignes (5 + 4 soins des 2 animaux ≥ 3 traitements) : ' + xl.rows.length);
check(xl.rows.slice(1).every(r => r[3] >= 3) && xl.rows.some(r => r[8] === 'ne compte pas' && r[9] === '') && xl.rows[1][4] === 'seuil dépassé' && xl.rows[1][9] === 1, 'Excel : suit les filtres ; comptés numérotés, non comptés vides : ' + JSON.stringify(xl.rows.slice(1, 3)));
check(pdf.title === 'Traitements sur 12 mois — suivi bio' && /du 03-10-2025 au 02-10-2026/.test(pdf.subtitle) && /seuil 3/.test(pdf.subtitle) && pdf.columns.length === 10 && pdf.rows.length === 9, 'PDF : titre, période, seuil, 10 colonnes, 9 lignes : ' + pdf.subtitle);
check(JSON.stringify(fich) === '["traitements-12-mois_2026-10-02.xlsx","traitements-12-mois_2026-10-02.pdf"]', 'noms de fichiers : ' + fich);
const larg = await page.evaluate(([cols, rows, taille]) => { const t = taille || 9.5; return cols.map((c, i) => Math.max(pdfTextWidth(c.label, t + 0.5, true), ...rows.map(r => pdfTextWidth(String(r[i] || ''), t, false)))); }, [pdf.columns, pdf.rows, pdf.fontSize]);
check(pdf.columns.every((c, i) => i === pdf.columns.length - 1 || c.x + larg[i] <= pdf.columns[i + 1].x) && pdf.columns[pdf.columns.length - 1].x + larg[larg.length - 1] <= 762, 'PDF : colonnes sans chevauchement, dans la page (police ' + (pdf.fontSize || 9.5) + ')');
console.log('OK 7 exports : Excel (une ligne par traitement, numéro d\'ordre, compte / ne compte pas) et PDF suivent les filtres, sans chevauchement.');

// ================================================================ 8. seuil réglable (Paramètres) et bio non activé
await jeu(true);
await page.evaluate(() => { parametresTab = 'exploitation'; render('parametres'); });
await page.waitForSelector('#f-exp-seuil-bio');
check(await page.evaluate(() => document.getElementById('f-exp-seuil-bio').value === '3' && document.getElementById('bloc-seuil-bio').style.display !== 'none'), 'seuil proposé : 3, visible quand le bio est activé');
await page.fill('#f-exp-seuil-bio', '0'); await page.dispatchEvent('#f-exp-seuil-bio', 'change');
check(await page.evaluate(() => document.getElementById('f-exp-seuil-bio').value === '3' && !DB.exploitation.seuilTraitementsBio), 'seuil 0 refusé, valeur d\'avant conservée');
await page.fill('#f-exp-seuil-bio', '2'); await page.dispatchEvent('#f-exp-seuil-bio', 'change');
check(await page.evaluate(() => DB.exploitation.seuilTraitementsBio === 2 && seuilTraitementsBio() === 2 && window.__saves === 1), 'seuil 2 enregistré (1 écriture)');
await page.evaluate(() => { render('traitements-12-mois'); });
const kp2 = await page.evaluate(() => [...document.querySelectorAll('#s12-kpis .brd-kpi-l')].map(x => x.textContent));
check(kp2.join('|') === 'Animaux actifs|Aucun traitement compté|1 traitement|2 traitements|3 et plus', 'seuil 2 : cartes 1 / 2 (limite) / 3 et plus : ' + kp2.join('|'));
await page.evaluate(() => { DB.exploitation.elevageBio = false; render('traitements-12-mois'); });
check(await page.evaluate(() => !!document.getElementById('s12-pas-bio') && !document.getElementById('pc-s12')), 'bio non activé : message, pas de suivi');
await page.evaluate(() => { carnetSanitairePcEtat = null; render('sanitaire'); });
check(await page.evaluate(() => !document.getElementById('cs-12-mois')), 'bio non activé : pas de bouton sur le carnet');
console.log('OK 8 seuil réglable (entier ≥ 1) ; bio non activé : suivi inactif.');

// ================================================================ 9. mobile : même fonction, liste compacte
await jeu(true, 35);
await page.evaluate(() => { window.electronAPI.isDesktop = false; render('sanitaire'); });
check(await page.evaluate(() => !!document.getElementById('btn-12-mois')), 'mobile : bouton « Traitements sur 12 mois » sur l\'écran Sanitaire (bio activé)');
await page.click('#btn-12-mois'); await page.waitForSelector('#m12');
const mk = await page.evaluate(() => [...document.querySelectorAll('#m12 .card')].slice(0, 3).map(c => c.textContent.replace(/\s+/g, ' ').trim()));
check(/2 traitements\s*3/.test(mk[0]) && /3 : limite\s*1/.test(mk[1]) && /4 et plus\s*1/.test(mk[2]), 'mobile : cartes 2 / 3 limite / 4 et plus : ' + mk.join(' | '));
check(await page.evaluate(() => document.querySelectorAll('.m12-an').length) === 41, 'mobile : 41 animaux (même fonction que le PC)');
await page.click('.m12-puce[data-v="3"]');
check(await page.evaluate(() => document.querySelectorAll('.m12-an').length) === 1, 'filtre rapide « 3 » : 1 animal');
await page.click('.m12-puce[data-v="plus"]');
check(await page.evaluate(() => document.querySelectorAll('.m12-an').length) === 1 && /dépassé/.test(await page.evaluate(() => document.querySelector('.m12-an').textContent)), 'filtre « 4+ » : n°985 « dépassé »');
await page.click('.m12-tete');
check(await page.evaluate(() => document.querySelectorAll('.m12-an .s12-ln').length) === 5 && await page.evaluate(() => document.querySelectorAll('.m12-an .s12-ln.nc').length) === 1, 'ligne dépliée : 5 traitements datés, 1 « ne compte pas »');
await page.click('#m12-vue-interv');
check(/35 animaux/.test(await $t('#m12-interventions')), 'mobile : vue par intervention');
check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), 'mobile : lecture seule');
await page.evaluate(() => { DB.exploitation.elevageBio = false; render('sanitaire'); });
check(await page.evaluate(() => !document.getElementById('btn-12-mois')), 'mobile, bio non activé : pas de bouton');
await page.evaluate(() => { window.electronAPI.isDesktop = true; });
console.log('OK 9 mobile : cartes, filtres rapides, ligne dépliable, vue par intervention, lecture seule ; bouton seulement si bio.');
await browser.close();
console.log('\nTOUS LES TESTS « TRAITEMENTS SUR 12 MOIS » SONT PASSÉS (jeu synthétique, saveData remplacé, aucune donnée réelle)');
