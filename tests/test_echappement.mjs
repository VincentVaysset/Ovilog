/* Échappement des textes saisis ou importés à l'affichage (echapperHtml : & < > " '). Jeu SYNTHÉTIQUE (jeuPcEcrans) dont chaque texte libre reçoit des
   PIÈGES : balise injectée (<i data-piege>, <img onerror>), sortie d'attribut ("> et '>), chaîne JavaScript (L'agneau "Rex", '); alert(1); ('), « < 40 & plus ».
   1) tous les écrans de consultation, mobile 390 et PC 1500 : aucun élément injecté, aucune boîte native, aucun « &amp; / &lt; / &quot; / &#39; » visible
      (double échappement), et le texte piégé s'affiche tel qu'il a été saisi là où il est montré ;
   2) aller-retour : une note, un nom de lot, un évènement du calendrier saisis avec < & ' " sont rouverts, modifiés, enregistrés : le texte stocké est EXACTEMENT
      celui tapé (rien n'est converti en entités). Aucune donnée réelle, saveData remplacé. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuPcEcrans } from './lib/jeu_pc_ecrans.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));

// Pose les pièges dans le jeu (dans la page) : chaque texte libre reçoit une valeur piégée et repérable par son étiquette
function pieger() {
  const P = tag => `L'agneau "Rex" <i data-piege="${tag}">X</i> < 40 & plus '"><img data-piege="${tag}-img" src="x" onerror="window.__piege=1"> '); window.__piege=2; ('`;
  window.__PIEGE_VISIBLE = `L'agneau "Rex" <i data-piege=`;
  const tous = [...DB.brebis, ...DB.beliers, ...DB.agnelles];
  tous.forEach((a, i) => {
    a.notes = (a.notes || []).concat([{ id: 'np' + i, categorie: P('ncat'), texte: P('note'), date: '2026-12-08' }]);
    a.sanitaire = (a.sanitaire || []).concat([{ type: 'Traitement', sousType: 'Autre', produit: P('prod'), date: '2026-12-03', dose: 1, quantiteCc: 1, intervenant: P('interv'), commentaire: P('comsoin'), dureeJours: 1, bio: false, delaiLaitJours: 2, delaiViandeJours: 3, numeroOrdonnance: P('numord') }]);
    (a.mouvements || []).forEach(m => { if (m.acheteur) m.acheteur = P('ach'); });
    (a.echographies || []).forEach(e => { e.commentaire = P('echo'); });
    (a.agnelages || []).forEach(ag => (ag.lambs || []).forEach(l => { l.notes = [{ id: 'nl', categorie: P('lcat'), texte: P('lnote'), date: '2026-12-08' }]; (l.mouvements || []).forEach(m => { if (m.acheteur) m.acheteur = P('lach'); }); }));
  });
  DB.agnelles.forEach(a => { if (a.pere !== undefined) a.pere = P('pere'); if (a.mere !== undefined) a.mere = P('mere'); });
  DB.produits.autres = (DB.produits.autres || []).concat([P('prod')]);
  DB.produitsInfo[P('prod')] = { posologie: P('poso'), delaiAttente: 2, delaiLait: 2, delaiViande: 3 };
  DB.acheteurs = DB.acheteurs.concat([P('ach')]); DB.causesMortalite = DB.causesMortalite.concat([P('cause')]);
  DB.intervenants = [P('interv')]; DB.categoriesNotes = (DB.categoriesNotes || []).concat([P('ncat')]);
  DB.casParticuliers = (DB.casParticuliers || []).concat([P('cas')]);
  DB.lots.forEach((l, i) => { l.nom = P('lot' + i); });
  DB.ordonnances.forEach(o => { o.veterinaire = P('veto'); o.numero = P('ord'); });
  DB.exploitation = Object.assign(DB.exploitation || {}, { nom: P('expl'), adresse: P('adr'), telephone: P('tel'), indicatifMarquage: '000456' });
  DB.journal = (DB.journal || []).concat([{ type: (DB.typesJournal && DB.typesJournal[0]) || 'Autre', date: '2026-12-04', note: P('journal') }]);
  DB.mouvementsCollectifs = (DB.mouvementsCollectifs || []);
}

const VUES = [
  'home', 'list', 'beliers', 'agneaux', 'agnelles', 'agnelles-inventaire', 'inventaire', 'inventaire-actifs', 'sanitaire', 'sous-delai', 'ordonnances', 'produits-delais',
  'journal', 'registre', 'controle-laitier', 'qualite', 'lots', 'mouvement-groupe', 'mouvements', 'traitements-collectifs', 'historique-echo', 'echo-rapide',
  'misebas-rapide', 'declaration-annuelle', 'liste-serie', 'soins-sans-bio',
  ['bilan-campagne', 'bilanCampagneTab="reproduction"'], ['bilan-campagne', 'bilanCampagneTab="lactation"'],
  ['parametres', 'parametresRubrique="exploitation";parametresTab="exploitation"'], ['parametres', 'parametresRubrique="listes";parametresTab="listes"'], ['parametres', 'parametresRubrique="campagne";parametresTab="campagne"'],
  ['detail', 'currentSheepId="B1"', 'B1'], ['belier-detail', 'currentBelierId="bel1"', 'bel1'], ['belier-detail', 'currentBelierId="bel3"', 'bel3'],
  ['agnelle-detail', 'currentAgnelleId="ag1"', 'ag1'], ['agnelle-detail', 'currentAgnelleId="ag2"', 'ag2'],
  ['agneau-detail', 'currentAgneauEid=DB.brebis[0].agnelages[0].lambs[0].eid', '__agneau'],
  ['lot-search', 'currentLotId="L2"'], ['edit-lot', 'currentLotId="L1"'], ['lot-repro-detail', 'currentLotId="L1"'],
  ['add-note', 'currentSheepId="B1"'], ['add-mouvement', 'currentSheepId="B1"'], ['add-ordonnance', ''], ['add-lot-repro', '']
];

const browser = await chromium.launch(LAUNCH);
const fuites = [];
async function passe(nom, contexte, bureau) {
  const page = await (await browser.newContext(contexte)).newPage();
  await page.clock.setFixedTime(new Date('2026-12-10T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  page.on('dialog', d => { fuites.push(nom + ' : boîte native « ' + d.message() + ' »'); d.dismiss(); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeuPcEcrans); await page.evaluate(pieger);
  let vuesVues = 0;
  for (const v of VUES) {
    const [vue, prep, arg] = Array.isArray(v) ? v : [v, '', undefined];
    const etiquette = nom + ' ' + vue + (prep ? ' (' + prep + ')' : '');
    const r = await page.evaluate(({ vue, prep, arg }) => {
      try {
        if (prep) (0, eval)(prep);
        const a = arg === '__agneau' ? DB.brebis[0].agnelages[0].lambs[0].eid : arg;
        render(vue, a);
      } catch (e) { return { err: e.message }; }
      const app = document.getElementById('app'); const corps = document.body;
      const injectes = new Set(), entites = new Set(); let montre = false;
      const scanner = () => {
        document.querySelectorAll('details').forEach(d => { d.open = true; });
        corps.querySelectorAll('[data-piege]').forEach(e => injectes.add(e.tagName.toLowerCase() + ':' + e.getAttribute('data-piege')));
        const visible = (app ? app.innerText : '') + ' ' + ((document.getElementById('page-title') || {}).textContent || '');
        (visible.match(/&(amp|lt|gt|quot|#39|#x27);/g) || []).forEach(x => entites.add(x));
        if (visible.includes(window.__PIEGE_VISIBLE)) montre = true;
      };
      scanner();
      // onglets et segments de l'écran : chacun est ouvert à son tour (le contenu d'un onglet n'existe qu'une fois choisi)
      const SEL = '#app .fiche-tab-btn, #app .tab-btn, #app [role="tab"], #app .pc-onglets button, #app .seg-btn, #app .pc-seg2 button, #app .tri-onglet';
      const n = Math.min(document.querySelectorAll(SEL).length, 24);
      for (let i = 0; i < n; i++) { const b = document.querySelectorAll(SEL)[i]; if (!b) break; try { b.click(); } catch (e) {} scanner(); }
      return { injectes: [...injectes], entites: [...entites].slice(0, 3), piege: window.__piege || 0, montre, vue: currentView };
    }, { vue, prep, arg });
    if (r.err) { fuites.push(etiquette + ' : erreur au rendu ' + r.err); continue; }
    vuesVues++;
    if (r.injectes.length) fuites.push(etiquette + ' : éléments injectés ' + [...new Set(r.injectes)].join(', '));
    if (r.entites.length) fuites.push(etiquette + ' : double échappement visible ' + r.entites.join(' '));
    if (r.piege) fuites.push(etiquette + ' : code injecté exécuté');
    if (/^(detail|belier-detail|agnelle-detail|ordonnances|lots|produits-delais)$/.test(vue) && !r.montre) fuites.push(etiquette + ' : le texte piégé n\'est pas affiché tel qu\'il a été saisi');
    await page.evaluate(() => { window.__piege = 0; });
  }
  await page.waitForTimeout(300);
  if (await page.evaluate(() => window.__piege || 0)) fuites.push(nom + ' : code injecté exécuté (différé)');
  erreurs.forEach(e => fuites.push(nom + ' : PAGEERROR ' + e));
  return { page, vuesVues };
}

const mobile = await passe('mobile', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, false);
const pc = await passe('PC', { viewport: { width: 1500, height: 950 } }, true);
if (fuites.length) { console.log(fuites.join('\n')); }
check(!fuites.length, fuites.length + ' fuite(s) d\'affichage (liste ci-dessus)');
console.log('OK 1 pièges sur ' + mobile.vuesVues + ' écrans mobiles et ' + pc.vuesVues + ' écrans PC : rien d\'injecté, rien d\'exécuté, aucun double échappement.');

// ================================================================ 2. aller-retour : rouvrir, modifier, enregistrer ne change jamais le texte stocké
const T = `poids < 40 & "gros" l'agneau <b>Rex</b>`;
const T2 = T + ` · revu l'été & "corrigé"`;
const aller = await mobile.page.evaluate(async ({ t, t2 }) => {
  const r = {};
  window.saveData = () => {};
  // note de brebis
  const b = DB.brebis[0]; b.notes = [{ id: 'nr', categorie: null, texte: t, date: '2026-12-08' }];
  editContext = { kind: 'notes', idx: 0 }; render('add-note', b.id);
  r.note = document.getElementById('f-texte').value;
  document.getElementById('f-texte').value = t2; document.getElementById('btn-save-note').click();
  r.noteStockee = b.notes[0].texte;
  // note d'agnelle
  const ag = DB.agnelles[0]; ag.notes = [{ id: 'na2', categorie: null, texte: t, date: '2026-12-08' }];
  currentAgnelleId = ag.id; editAgnelleContext = { kind: 'notes', idx: 0 }; render('add-note-agnelle');
  r.noteAg = document.getElementById('f-texte').value;
  document.getElementById('f-texte').value = t2; document.getElementById('btn-save-note').click();
  r.noteAgStockee = ag.notes[0].texte;
  // évènement du calendrier
  DB.journal = [{ type: DB.typesJournal[0], date: '2026-12-04', note: t }];
  calendrierEdition = 0; render('journal');
  r.cal = document.getElementById('f-journal-note').value;
  document.getElementById('f-journal-note').value = t2; document.getElementById('btn-save-journal').click();
  r.calStockee = DB.journal[0].note;
  // nom d'un lot (mobile)
  const lot = DB.lots.find(l => l.id === 'L2'); lot.nom = t; lot.dateCreation = lot.dateCreation || '2026-11-15'; currentLotId = 'L2'; render('edit-lot');
  const champ = document.getElementById('f-edit-lot-nom');
  r.lot = champ ? champ.value : '(champ absent)';
  if (champ) { champ.value = t2; document.getElementById('btn-save-edit-lot').click(); }
  r.lotStocke = lot.nom;
  return r;
}, { t: T, t2: T2 });
eq([aller.note, aller.noteAg, aller.cal, aller.lot], [T, T, T, T], 'le texte rouvert dans son champ est exactement le texte stocké (note brebis, note agnelle, calendrier, lot)');
eq([aller.noteStockee, aller.noteAgStockee, aller.calStockee, aller.lotStocke], [T2, T2, T2, T2], 'après modification et enregistrement, le texte stocké est exactement le texte tapé, sans entité');
console.log('OK 2 aller-retour : notes (brebis, agnelle), évènement du calendrier et nom de lot rouverts, modifiés et enregistrés sans aucune conversion.');
await browser.close();
console.log('OK test_echappement');
