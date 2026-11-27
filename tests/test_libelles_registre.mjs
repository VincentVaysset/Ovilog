/* Libellés de mouvement (chantier du 27/11, point 6) : UN libellé par notion, celui du registre, sans distinction de sexe.
   1. Code : les anciens libellés (« Morte », « Vendue »…) ne sont écrits QUE dans la table de conversion ; le type « Mort » seulement dans la
      constante TYPE_MVT (aucun texte écrit en dur ailleurs) ; plus de « Mortes » / « Vendues » / « Perdue » / « Autoconsommée » affichés.
   2. Saisies : mort d'une brebis (fiche), mouvement collectif PC, mort d'un agneau : valeurs enregistrées dans la liste (TYPES_MOUVEMENT_VALIDES),
      statuts justes, libellés affichés = registre.
   3. Données d'un appareil pas à jour (« Morte » enregistré) : lues comme « Mort » partout (statut, mortalité, registre, fiche) ; au démarrage,
      la conversion attend une sauvegarde horodatée (« Plus tard » = rien n'est changé), puis réécrit seulement le type, relu dans le stockage ;
      ensuite un « Morte » reçu d'un autre appareil est converti tout seul, sans question.
   Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));

// ================================================================ 1. code source
// commentaires de bloc retirés (lignes gardées pour les numéros)
const src = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' ')).split('\n');
const sansCommentaire = l => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/ .*$/, '');
const fautifs = (re, permis) => src.map((l, i) => [i + 1, l]).filter(([, l]) => re.test(sansCommentaire(l)) && !permis(l)).map(([n, l]) => n + ': ' + l.trim().slice(0, 90));
const anciens = fautifs(/['"`](Morte|Vendue|Vendu|Vendue reproduction|Vendu reproduction)['"`]/, l => /^const CONVERSION_TYPES_MOUVEMENT = /.test(l.trim()) || /^const LIBELLE_STATUT_SORTIE = /.test(l.trim()));   // « Vendu » : libellé affiché du statut seulement, jamais un type
eq(anciens, [], 'anciens libellés écrits ailleurs que dans la table de conversion');
const mortEnDur = fautifs(/['"`]Mort['"`]/, l => /^const TYPE_MVT = /.test(l.trim()));
eq(mortEnDur, [], 'type « Mort » écrit en dur ailleurs que dans la constante TYPE_MVT');
const genres = fautifs(/['"`>](Mortes|Vendues|Perdue|Autoconsommée|Vendue repro\.)['"`<]/, () => false);
eq(genres, [], 'libellés au féminin affichés');
console.log('OK 1 code : anciens libellés seulement dans la table de conversion, « Mort » seulement dans TYPE_MVT, aucun libellé au féminin.');

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; window.__verrouConfirmeTest = true; });   // verrou de version supposé confirmé (testé à part : test_verrou_version)
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-11-26T09:00:00'));
const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
page.on('dialog', d => d.accept());
const jeu = (avecAnciens) => {
  try { localStorage.clear(); } catch (e) { /* ignoré */ }
  DB = migrateData({});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-09-29'; DB.campagneInitialisee = true;
  const f = (id, n, o) => Object.assign({ id, eid: '2500000129' + String(50000 + n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.brebis = [f('b1', 1), f('b2', 2), f('b3', 3, { agnelages: [{ id: 'mb1', date: '2026-11-05', campagne: 2026, lambs: [{ id: 'ag1', sexe: 'Mâle', eid: '250000045670001', mouvements: [] }, { id: 'ag2', sexe: 'Femelle', eid: '250000045670002', mouvements: [] }] }] }), f('b4', 4)];
  DB.beliers = [f('r1', 9, { statut: 'actif' })]; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
  if (avecAnciens) {   // données d'un appareil pas à jour
    const ancien = Object.keys(CONVERSION_TYPES_MOUVEMENT).find(k => CONVERSION_TYPES_MOUVEMENT[k] === TYPE_MVT.MORT);
    const b = DB.brebis[3]; b.mouvements.push({ id: 'mv-ancien', type: ancien, cause: 'Mammite', date: '2026-11-10', collectifId: 'MC-ANCIEN' }); b.statut = 'morte';
    DB.mouvementsCollectifs.push({ id: 'MC-ANCIEN', categorie: 'brebis', type: ancien, cause: 'Mammite', date: '2026-11-10', membres: [b.eid], createdAt: 1 });
    const vieuxVendu = Object.keys(CONVERSION_TYPES_MOUVEMENT).find(k => CONVERSION_TYPES_MOUVEMENT[k] === TYPE_MVT.VENTE && !/e$/.test(k));
    const ag = DB.brebis[2].agnelages[0].lambs[0]; ag.mouvements = [{ id: 'mv-ag-ancien', type: vieuxVendu, acheteur: 'Acheteur C', date: '2026-11-15', destination: 'boucherie' }]; ag.statutFinal = 'vendu';
    DB.registre.brebis['250000012955555'] = { eid: '250000012955555', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2023-01-01' }, { type: ancien, cause: 'Pneumonie', date: '2026-10-20' }] };
  }
  saveData(DB);
};
const typesEnregistres = () => page.evaluate(() => {
  const t = [];
  const l = x => (x || []).forEach(m => m && t.push(m.type));
  ['brebis', 'beliers', 'agnelles'].forEach(c => (DB[c] || []).forEach(f => { l(f.mouvements); (f.agnelages || []).forEach(a => (a.lambs || []).forEach(x => l(x.mouvements))); }));
  Object.values(DB.registre || {}).forEach(cat => Object.values(cat || {}).forEach(e => l(e.mouvements)));
  l(DB.mouvementsCollectifs);
  return { horsListe: t.filter(x => !TYPES_MOUVEMENT_VALIDES.includes(x)), tous: [...new Set(t)].sort() };
});
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);

// ================================================================ 2. saisies : valeurs de la liste, libellés du registre
await page.evaluate(jeu, false);
// mort d'une brebis par sa fiche
await page.evaluate(() => { currentSheepId = 'b1'; render('add-mouvement', 'b1'); });
await page.click('.type-opt[data-val="' + await page.evaluate(() => TYPE_MVT.MORT) + '"]');
await page.click('#btn-save-mouvement');
eq(await page.evaluate(() => { const b = DB.brebis.find(x => x.id === 'b1'); return [b.statut, b.mouvements.pop().type, libelleStatutBrebis(b)]; }), ['morte', 'Mort', 'Mort'], 'fiche brebis : type « Mort » enregistré, statut mort, affiché « Mort »');
// mouvement collectif PC (brebis vendue), agneau mort
await page.evaluate(() => {
  mvPcEtat = null; render('inventaire');
  document.querySelector('.mv-cat[data-cat="agneaux"]').click();
  document.querySelector('.mv-type[data-val="' + TYPE_MVT.MORT + '"]').click();
  document.querySelector('#mv-table tr.clic').click();
  document.getElementById('mv-valider').click();
});
// vente d'un agneau (fiche de sa mère) : « Vente », comme au registre
await page.evaluate(() => {
  DB.acheteurs = ['Acheteur C'];
  const l = DB.brebis.find(x => x.id === 'b3').agnelages[0].lambs.find(x => x.id === 'ag2');
  showLambSortieModal(l, 'vendu', () => {});
  document.getElementById('lambsortie-new-acheteur').value = 'Acheteur D';
  document.getElementById('lambsortie-add-acheteur').click();
  document.getElementById('lambsortie-date').value = '2026-11-21';
  document.getElementById('lambsortie-confirm').click();
});
eq(await page.evaluate(() => { const l = DB.brebis.find(x => x.id === 'b3').agnelages[0].lambs.find(x => x.id === 'ag2'); return [l.statutFinal, l.mouvements[l.mouvements.length - 1].type, libelleTypeMouvement(l.mouvements[l.mouvements.length - 1])]; }), ['vendu', 'Vente', 'Vente'], 'vente d\'un agneau : « Vente » enregistré, statut vendu');
const T = await typesEnregistres();
eq(T.horsListe, [], 'aucune valeur hors liste enregistrée');
check(T.tous.includes('Mort'), 'agneau mort : « Mort »');
const boutons = await page.evaluate(() => { mvPcEtat = null; render('inventaire'); return [...document.querySelectorAll('.mv-type')].map(b => b.textContent); });
eq(boutons, ['Mort', 'Vente', 'Vente · reproduction', 'Perte', 'Autoconsommation'], 'boutons de type (brebis) : libellés du registre');
console.log('OK 2 saisies : « Mort » enregistré (fiche, mouvement collectif, agneau), aucune valeur hors liste, boutons aux libellés du registre.');

// ================================================================ 3. données d'un appareil pas à jour : lues comme « Mort » ; conversion seulement autorisée
await page.evaluate(jeu, true);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(3500);   // rien d'automatique : ni question, ni conversion au démarrage
const lu = await page.evaluate(() => {
  const b = DB.brebis.find(x => x.id === 'b4');
  return { statut: libelleStatutBrebis(b), mortalite: mortaliteSanitaireData().brebisMortesCount, registre: registreMouvementsRows().filter(r => r.type === TYPE_MVT.MORT).length,
    question: !!document.getElementById('question-charte'), reste: texteContientAncienLibelle(localStorage.getItem(DB_KEY)) };
});
eq([lu.statut, lu.mortalite, lu.registre], ['Mort', 1, 2], 'ancien libellé lu comme « Mort » : statut, mortalité de la campagne, registre');
eq([lu.question, lu.reste], [false, true], 'rien d\'automatique au démarrage : aucune question, rien de converti');
const ap = await page.evaluate(() => apercuConversionLibelles(DB).map(l => [l.animal, l.date, l.ancien, l.nouveau]));
check(ap.length === 4 && ap.every(l => l[3] === 'Mort' || l[3] === 'Vente') && ap.some(l => /Agneau/.test(l[0]) && l[3] === 'Vente') && ap.some(l => /collectif/.test(l[0])) && ap.some(l => /registre/.test(l[0])), 'aperçu : 4 lignes animal / date / ancien mot / nouveau mot : ' + JSON.stringify(ap));
// autorisation avec un autre nombre attendu : rien n'est fait
const mauvais = await page.evaluate(async () => executerConversionAutorisee({ id: 'test-1', nbAttendu: 3 }));
check(!mauvais.fait && mauvais.etat === 'annulee' && /aperçu différent/.test(mauvais.raison), 'aperçu différent : annulée : ' + JSON.stringify(mauvais));
check(await page.evaluate(() => texteContientAncienLibelle(localStorage.getItem(DB_KEY))), 'aperçu différent : rien n\'est changé');
// autorisation conforme : conversion, relecture
const r = await page.evaluate(async () => {
  const avant = compterMouvementsBase(DB);
  const res = await executerConversionAutorisee({ id: 'test-2', nbAttendu: apercuConversionLibelles(DB).length });
  const st = localStorage.getItem(DB_KEY);
  return { res, resteAncien: texteContientAncienLibelle(st), avant, apres: compterMouvementsBase(JSON.parse(st)),
    statut: DB.brebis.find(x => x.id === 'b4').statut, mv: DB.brebis.find(x => x.id === 'b4').mouvements.find(m => m.id === 'mv-ancien'), lot: DB.mouvementsCollectifs[0].type };
});
check(r.res.fait && r.res.n === 4, 'conversion faite (fiche, mouvement collectif, registre, vente d\'agneau) : ' + JSON.stringify(r.res));
eq(await page.evaluate(() => { const l = DB.brebis.find(x => x.id === 'b3').agnelages[0].lambs[0]; const m = l.mouvements[0]; return [m.type, m.acheteur, m.date, m.destination, l.statutFinal, causeSortieEde(m, 'agneaux').code]; }), ['Vente', 'Acheteur C', '2026-11-15', 'boucherie', 'vendu', 'B'], 'vente d\'agneau à l\'ancien libellé : « Vente », reste du mouvement, statut et destination EDE gardés');
check(!r.resteAncien && r.avant === r.apres, 'stockage relu : plus aucun ancien libellé, même nombre de mouvements');
eq([r.statut, r.mv.type, r.mv.cause, r.mv.date, r.lot], ['morte', 'Mort', 'Mammite', '2026-11-10', 'Mort'], 'seul le type change (cause, date, statut, id gardés)');
eq((await typesEnregistres()).horsListe, [], 'aucune valeur hors liste après conversion');
// la même autorisation n'est jamais rejouée ; un ancien libellé reçu ensuite n'est PAS converti tout seul (lu comme « Mort »)
const recu = await page.evaluate(async () => {
  const ancien = Object.keys(CONVERSION_TYPES_MOUVEMENT)[0];
  window.__appliquerSynchro(() => { const b = DB.brebis.find(x => x.id === 'b2'); b.mouvements.push({ type: ancien, cause: 'Pneumonie', date: '2026-11-20' }); window.__recevoirFiches('brebis', DB.brebis.map(x => JSON.parse(JSON.stringify(x)))); });
  await new Promise(res => setTimeout(res, 2500));
  return { question: !!document.getElementById('question-charte'), reste: texteContientAncienLibelle(JSON.stringify(DB)), lu: libelleStatutBrebis(Object.assign({}, DB.brebis.find(x => x.id === 'b2'), { statut: 'morte' })) };
});
eq([recu.question, recu.reste], [false, true], 'ancien libellé reçu ensuite : aucune conversion automatique, aucune question');
check(!erreurs.length, 'erreurs JS : ' + erreurs.slice(0, 3).join(' | '));
console.log('OK 3 appareil pas à jour : lu comme « Mort » ; rien d\'automatique ; conversion seulement sur autorisation, au nombre attendu, seul le type change, relu.');
await browser.close();
console.log('TOUS LES TESTS « LIBELLÉS DU REGISTRE » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
