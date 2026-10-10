/* Mouvements d'animaux MOBILE (maquette « Mouvements d'animaux mobile ») : liste en cartes (segmenté Brebis / Béliers / Agneaux / Agnelles, recherche + type, du plus récent au plus ancien,
   un mouvement collectif = UNE carte avec « Voir les animaux » et « Annuler » = annulation du lot, « Voir les plus anciens » 20 cartes à la fois, Excel de la liste filtrée) et écran
   « Nouveau mouvement » (chips catégorie / type, date, acheteur ou cause, animaux concernés : sélection, recherche par n° ou n° SIEOL, tout cocher, bip en série, bandeau de délai
   d'attente, barre fixe Annuler / Valider N…). Mêmes données et mêmes fonctions que la page PC : chaque chiffre, chaque texte de confirmation, chaque écriture est comparé à la page PC
   chargée avec le MÊME jeu. Parcours : sélection, bip en série, délai d'attente, annulation d'un groupé (y compris partiellement archivé). saveData REMPLACÉ, jeu SYNTHÉTIQUE, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const norm = s => String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const browser = await chromium.launch(LAUNCH);

// ---- jeu commun (identique sur la page PC et sur la page mobile)
function jeu() {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  window.EID = eid;
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.acheteurs = ['Natera', 'Bio Plus', 'Boucherie Martin']; DB.causesMortalite = ['Mammite', 'Boiterie', 'Pneumonie'];
  DB.produits = { vaccins: [], antibiotiques: ['Intramicine'], antiparasitaires: [], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = { Intramicine: { posologie: null, delaiAttente: 7, delaiLait: 7, delaiViande: 28 } };
  const A = fiche(eid(8, 8133), { id: 'A' });
  A.agnelages = [{ date: '2026-09-25', campagne: 2026, lambs: [
    { eid: eid(6, 801), sexe: 'Mâle', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-25' }] },
    { eid: eid(6, 802), sexe: 'Mâle', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-25' }] },
    { eid: eid(6, 803), sexe: 'Mâle', sanitaire: [], statutFinal: 'vendu', mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-25' }, { type: 'Vendu', acheteur: 'Natera', date: '2026-10-01' }] },
    { eid: eid(6, 804), sexe: 'Femelle', sanitaire: [], statutFinal: 'mort', mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-25' }, { type: 'Mort', cause: 'Pneumonie', date: '2026-10-02' }] }] }];
  const sd = [{ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-20', quantiteCc: 8, intervenant: 'Éleveur', dureeJours: 1, bio: true, delaiLaitJours: 14, delaiViandeJours: 56 }];
  DB.brebis = [A, fiche(eid(9, 59), { id: 'B' }), fiche(eid(9, 69), { id: 'C' }), fiche(eid(9, 152), { id: 'D', sanitaire: sd, numeroCourtTravailSieol: '152' }), fiche(eid(0, 33), { id: 'E' }), fiche(eid(7, 5), { id: 'F' }),
    fiche(eid(9, 77), { id: 'G' }), fiche(eid(9, 81), { id: 'H' }), fiche(eid(8, 90), { id: 'I' }), fiche(eid(8, 91), { id: 'J' }), fiche(eid(7, 12), { id: 'K' }), fiche(eid(6, 40), { id: 'L' }),
    fiche(eid(9, 99), { id: 'M', statut: 'vendue', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', acheteur: 'Natera', date: '2026-09-01' }] }),
    fiche(eid(8, 600), { id: 'N', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2026-10-02' }] })];   // entrée le 02/10 : une sortie datée avant est incohérente
  DB.beliers = [fiche(eid(9, 90), { id: 'bel1', statut: 'actif' }), fiche(eid(8, 91), { id: 'bel2', statut: 'actif' }), fiche(eid(9, 92), { id: 'bel3', statut: 'vendu', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente reproduction', acheteur: 'Bio Plus', date: '2026-10-02' }] })];
  DB.agnelles = [fiche(eid(5, 41), { id: 'ag1' }), fiche(eid(5, 42), { id: 'ag2' }), fiche(eid(5, 43), { id: 'ag3' })];
  DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
  const poser = (cat, type, cause, acheteur, date, ids) => { const items = animauxMouvementPc(cat).filter(a => ids.includes(a.id)); appliquerMouvementCollectifPc({ categorie: cat, type, cause, acheteur, date, animaux: items }); };
  poser('brebis', 'Vente', '', 'Natera', '2026-10-02', ['G', 'H', 'I']);          // lot de 3 ventes
  poser('brebis', 'Morte', 'Mammite', null, '2026-10-02', ['J', 'K']);             // lot de 2 mortes
  poser('agnelles', 'Vente reproduction', '', 'Bio Plus', '2026-10-02', ['ag3']);  // agnelle archivée
  const L = DB.brebis.find(x => x.id === 'L'); L.mouvements.push({ type: 'Autoconsommation', date: '2026-10-02' }); L.statut = 'autoconsommée'; recalculerStatutBrebis(L);   // sortie individuelle
  window.__saves = 0; window.__avant = JSON.stringify(DB);
}
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.confirms = []; page.reponse = true;
  page.on('dialog', d => { if (d.type() === 'confirm') { page.confirms.push(d.message()); page.reponse ? d.accept() : d.dismiss(); } else { page.confirms.push('(alerte) ' + d.message()); d.accept(); } });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeu);
  await page.evaluate(() => {
    window.__xlsx = []; buildXlsxWorkbook = async f => { window.__xlsx.push(f); return new Uint8Array([1]); };
    window.__fich = []; saveOrShareBinaryFile = async nom => { window.__fich.push(nom); };
  });
  return page;
}
const pc = await ouvrir(true), mob = await ouvrir(false);
const listeMob = (cat) => mob.evaluate(c => { mvMobEtat = { cat: c, type: '', q: '', nb: 20, etendu: false, ouverts: new Set(), message: '' }; render('inventaire'); }, cat);
const intact = async page => (await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0));
// Lignes de la liste mobile : [date, n°, type, détail] pour chaque animal (membres des cartes de lot compris)
const lignesMob = () => mob.evaluate(() => {
  const out = [];
  document.querySelectorAll('#mm-liste .mm-carte').forEach(c => {
    if (!c.querySelector('.reg-pastille')) return;
    const type = c.querySelector('.reg-pastille').textContent.trim(), dt = c.querySelector('.mm-dt').textContent.split(' · ');
    const nums = c.classList.contains('mm-lot') ? [...c.querySelectorAll('.mm-membre .mm-nm')].map(x => x.textContent.replace('n°', '')) : [c.querySelector('.mm-nm').textContent.replace('n°', '')];
    nums.forEach(n => out.push([dt[0], n, type, dt.slice(1).join(' · ') || '—']));
  });
  return out;
});
// Lignes de la page PC pour une seule catégorie
const lignesPc = async (cle) => {
  await pc.evaluate(() => { mvPcEtat = null; render('inventaire'); });
  await pc.waitForSelector('#mvp-table');
  for (const k of ['brebis', 'beliers', 'agnelles', 'agneaux']) if (k !== cle) await pc.click('.mvp-cat[data-cat="' + k + '"]');
  return pc.evaluate(() => [...document.querySelectorAll('#mvp-table tr[data-eid]')].map(r => [r.children[0].textContent.trim(), r.children[1].textContent.trim(), r.children[3].textContent.trim(), r.children[4].textContent.trim()]));
};
const trier = l => l.map(x => x.join('|')).sort();

// ================================================================ 1. liste : structure, mêmes lignes que la page PC
await listeMob('brebis');
const struct = await mob.evaluate(() => ({
  nouveau: document.getElementById('mm-nouveau').textContent.trim(), anciensBoutons: !!document.getElementById('btn-mouvement-groupe') || !!document.getElementById('btn-historique-mouvement-groupe'),
  seg: [...document.querySelectorAll('#mm-cats .tab-btn')].map(b => b.textContent), actif: document.querySelector('#mm-cats .tab-btn.active').textContent,
  tuiles: document.querySelectorAll('.reg-tuile').length, tableau: document.querySelectorAll('table').length, aide: document.querySelectorAll('.info-bulle, .help-bubble').length,
  filtres: [!!document.getElementById('mm-q'), !!document.getElementById('mm-type')], export: document.getElementById('mm-export').textContent.trim(),
  ligneFiltres: (() => { const q = document.getElementById('mm-q').getBoundingClientRect(), t = document.getElementById('mm-type').getBoundingClientRect(); return Math.abs(q.top - t.top) < 4; })()
}));
check(/Nouveau mouvement/.test(struct.nouveau) && !struct.anciensBoutons, 'bouton « Nouveau mouvement » à la place des deux gros boutons : ' + JSON.stringify(struct));
eq(struct.seg, ['Brebis', 'Béliers', 'Agneaux', 'Agnelles'], 'segmenté dans l\'ordre de la maquette'); eq(struct.actif, 'Brebis', 'catégorie active');
check(struct.tuiles === 0 && struct.tableau === 0 && struct.aide === 0 && struct.filtres.every(Boolean) && struct.ligneFiltres, 'pas de tuiles, pas de tableau, pas de « ? », recherche + type sur une ligne : ' + JSON.stringify(struct));
check(/Excel/.test(struct.export), 'export Excel en bas');
for (const [cle, mobKey] of [['brebis', 'brebis'], ['beliers', 'beliers'], ['agnelles', 'agnelles'], ['agneaux', 'agneaux']]) {
  await listeMob(mobKey);
  eq(trier(await lignesMob()), trier(await lignesPc(cle)), 'catégorie ' + cle + ' : mêmes mouvements (date, n°, type, cause / acheteur) que la page PC');
}
await listeMob('brebis');
const cartes = await mob.evaluate(() => [...document.querySelectorAll('#mm-liste .mm-carte')].map(c => ({ lot: c.classList.contains('mm-lot'), titre: c.querySelector('.mm-nm').textContent, pastille: c.querySelector('.reg-pastille').textContent, classe: c.querySelector('.reg-pastille').className.replace('reg-pastille ', ''), date: c.querySelector('.mm-dt').textContent })));
check(cartes.filter(c => c.lot).length === 2 && cartes.length === 3, 'brebis : 2 lots (une carte chacun) + 1 sortie individuelle = 3 cartes : ' + JSON.stringify(cartes));
const titres = cartes.map(c => c.titre).sort();
eq(titres, ['Morte · 2 brebis', 'Vente · 3 brebis', 'n°00040'].sort(), 'titres des cartes');
eq(cartes.map(c => [c.pastille, c.classe]).sort(), [['Autoconsommation', 'ambre'], ['Morte', 'rouge'], ['Vente', 'bleu']], 'couleurs des pastilles de type');
check(await intact(mob), 'la liste ne modifie rien (DB identique, 0 saveData)');
console.log('OK 1 liste : « Nouveau mouvement », segmenté Brebis / Béliers / Agneaux / Agnelles, recherche + type sur une ligne, ni tuiles ni tableau ni « ? » ; mêmes mouvements que la page PC pour les 4 catégories ; un lot = une carte ; pastilles Morte rouge / Vente bleu / Autoconsommation ambre.');

// ================================================================ 2. ordre, filtres, recherche
const dates = await mob.evaluate(() => [...document.querySelectorAll('#mm-liste .mm-dt')].map(d => d.textContent.slice(0, 10)));
check(dates.join() === [...dates].sort((a, b) => b.split('-').reverse().join('').localeCompare(a.split('-').reverse().join(''))).join(), 'du plus récent au plus ancien : ' + dates);
eq((await mob.evaluate(() => [...document.querySelectorAll('#mm-type option')].map(o => o.textContent))).sort(), ['Autoconsommation', 'Morte', 'Tous types', 'Vente'], 'filtre de type : les types présents dans la catégorie');
await mob.selectOption('#mm-type', 'Morte');
eq(await mob.evaluate(() => [...document.querySelectorAll('#mm-liste .mm-nm')].filter(n => !n.closest('.mm-membre')).map(n => n.textContent)), ['Morte · 2 brebis'], 'filtre « Morte » : une seule carte');
await mob.selectOption('#mm-type', '');
await mob.fill('#mm-q', '40');
eq(await mob.evaluate(() => [...document.querySelectorAll('#mm-liste .mm-nm')].filter(n => !n.closest('.mm-membre')).map(n => n.textContent)), ['n°00040'], 'recherche « 40 » : la sortie du n°00040');
await mob.fill('#mm-q', '99999');
check(await mob.evaluate(() => /Aucun mouvement ne correspond/.test(document.getElementById('mm-liste').textContent)), 'recherche sans résultat : message');
await mob.fill('#mm-q', '');
await mob.click('#mm-cats [data-cat="agnelles"]');
check(await mob.evaluate(() => document.getElementById('mm-type').value === '' && document.querySelectorAll('#mm-liste .mm-carte').length === 1), 'changer de catégorie remet le type à « Tous »');
console.log('OK 2 filtres : du plus récent au plus ancien, type, recherche par n°, aucun résultat, changement de catégorie.');

// ================================================================ 3. « Voir les animaux », Modifier
await listeMob('brebis');
const lotVente = '.mm-lot:has(.mm-nm:text("Vente · 3 brebis"))';
check(await mob.evaluate(() => [...document.querySelectorAll('.mm-membres')].every(m => m.classList.contains('hidden'))), 'animaux des lots masqués au départ');
await mob.click(lotVente + ' .mm-voir');
const membres = await mob.evaluate(() => [...document.querySelectorAll('.mm-lot:not(.hidden) .mm-membres:not(.hidden) .mm-membre')].map(m => [m.querySelector('.mm-nm').textContent, m.querySelector('.mm-modifier') ? m.querySelector('.mm-modifier').textContent : '']));
eq(membres, [['n°00077', 'Modifier'], ['n°00081', 'Modifier'], ['n°00090', 'Modifier']], 'Voir les animaux : n° + « Modifier » par animal');
check(await mob.evaluate(() => /Masquer les animaux/.test(document.querySelector('.mm-voir[aria-expanded="true"]').textContent)), 'le bouton devient « Masquer les animaux »');
await mob.click(lotVente + ' .mm-membre >> nth=1 >> .mm-modifier');
check(await mob.evaluate(() => currentView === 'add-mouvement' && /Modifier le mouvement/.test(document.getElementById('pageTitle') ? document.getElementById('pageTitle').textContent : pageTitle.textContent) && document.querySelector('.type-opt.selected, .type-opt[data-val="Vente"]') !== null), 'Modifier : ouvre l\'écran de modification du mouvement de cet animal');
check(await intact(mob), 'ouvrir la modification n\'écrit rien');
await listeMob('brebis');
await mob.click('.mm-carte:not(.mm-lot):has(.mm-nm:text("n°00040")) .mm-modifier');
check(await mob.evaluate(() => currentView === 'add-mouvement'), 'Modifier (sortie individuelle) : ouvre l\'écran de modification');
console.log('OK 3 Voir les animaux : masqués au départ, n° + Modifier par animal, Masquer ; Modifier ouvre la modification (collectif et individuel), rien d\'écrit.');

// ================================================================ 4. annulation d'un mouvement individuel (confirmation = celle du PC)
await listeMob('brebis');
mob.reponse = false; mob.confirms.length = 0;
await mob.click('.mm-carte:not(.mm-lot):has(.mm-nm:text("n°00040")) .mm-annuler');
check(mob.confirms.length === 1 && await intact(mob), 'Annuler demande toujours une confirmation ; refusée : rien ne change');
await lignesPc('brebis');
pc.reponse = false; pc.confirms.length = 0;
await pc.click('#mvp-table tr:has(b:text-is("00040")) .mv-annuler');
eq(mob.confirms[0], pc.confirms[0], 'texte de confirmation identique à celui de la page PC');
mob.reponse = true;
await mob.click('.mm-carte:not(.mm-lot):has(.mm-nm:text("n°00040")) .mm-annuler');
const apres4 = await mob.evaluate(() => ({ statut: DB.brebis.find(b => b.id === 'L').statut, mvts: DB.brebis.find(b => b.id === 'L').mouvements.map(m => m.type), msg: document.getElementById('mm-message').textContent, cartes: document.querySelectorAll('#mm-liste .mm-carte').length }));
check(apres4.statut === 'active' && apres4.mvts.join() === 'Entrée' && /Annulé : Autoconsommation · Brebis n°00040/.test(apres4.msg) && apres4.cartes === 2, 'annulation confirmée : l\'animal redevient active, message vert, carte retirée : ' + JSON.stringify(apres4));
console.log('OK 4 annulation individuelle : confirmation obligatoire (texte = page PC), refus sans effet, accord : statut restauré, mouvement retiré, message.');

// ================================================================ 5. annulation d'un groupé (confirmation = celle du PC) + lot partiellement archivé
await listeMob('brebis'); mob.reponse = false; mob.confirms.length = 0;
await mob.click(lotVente + ' .mm-annuler-lot');
check(mob.confirms.length === 1 && await mob.evaluate(() => DB.mouvementsCollectifs.length === 3), 'Annuler le lot : confirmation, refusée = rien ne change');
await lignesPc('brebis'); pc.reponse = false; pc.confirms.length = 0;
await pc.click('#mvp-table tr:has(b:text-is("00077")) .mv-annuler-lot');
eq(mob.confirms[0], pc.confirms[0], 'texte de confirmation du lot identique à celui de la page PC');
mob.reponse = true;
await mob.click(lotVente + ' .mm-annuler-lot');
const apres5 = await mob.evaluate(() => ({ statuts: ['G', 'H', 'I'].map(id => DB.brebis.find(b => b.id === id).statut), restes: ['G', 'H', 'I'].map(id => DB.brebis.find(b => b.id === id).mouvements.some(m => m.collectifId)), lots: DB.mouvementsCollectifs.length, msg: document.getElementById('mm-message').textContent, cartes: [...document.querySelectorAll('#mm-liste .mm-nm')].filter(n => !n.closest('.mm-membre')).map(n => n.textContent) }));
check(apres5.statuts.every(s => s === 'active') && apres5.restes.every(x => !x) && apres5.lots === 2 && /Lot annulé : 3 brebis restaurées/.test(apres5.msg) && !apres5.cartes.includes('Vente · 3 brebis'), 'lot annulé : 3 brebis redevenues actives, mouvements retirés, lot supprimé, carte retirée : ' + JSON.stringify(apres5));
// lot partiellement archivé : K passe au registre, J reste vivante
await mob.evaluate(() => {
  const K = DB.brebis.find(b => b.id === 'K');
  DB.registre.brebis[K.eid] = { eid: K.eid, sanitaire: [], agnelages: [], mouvements: K.mouvements.slice() }; DB.brebis = DB.brebis.filter(b => b.id !== 'K');
  window.__avant = JSON.stringify(DB); window.__saves = 0; render('inventaire');
});
mob.confirms.length = 0; mob.reponse = false;
await mob.click('.mm-lot:has(.mm-nm:text("Morte · 2 brebis")) .mm-annuler-lot');
check(/1 brebis restaurée/.test(mob.confirms[0]) && /1 brebis déjà archivée au registre : non restaurable/.test(mob.confirms[0]), 'lot partiellement archivé : la confirmation le dit : ' + mob.confirms[0]);
mob.reponse = true;
await mob.click('.mm-lot:has(.mm-nm:text("Morte · 2 brebis")) .mm-annuler-lot');
const part = await mob.evaluate(() => ({ J: DB.brebis.find(b => b.id === 'J').statut, lot: DB.mouvementsCollectifs.find(l => l.type === 'Morte').membres.length, msg: document.getElementById('mm-message').textContent, bouton: !!document.querySelector('.mm-lot .mm-annuler-lot'), mention: document.querySelector('.mm-lot') ? document.querySelector('.mm-lot .mm-mention').textContent : '' }));
check(part.J === 'active' && part.lot === 1 && /1 déjà archivée non restaurable/.test(part.msg) && !part.bouton && /archivés au registre/.test(part.mention), 'annulation partielle : J restaurée, le lot ne garde que l\'archivée, plus de bouton Annuler : ' + JSON.stringify(part));
// agnelles : lot non annulable
await mob.click('#mm-cats [data-cat="agnelles"]');
const ag = await mob.evaluate(() => ({ boutons: document.querySelectorAll('#mm-liste .mm-modifier, #mm-liste .mm-annuler, #mm-liste .mm-annuler-lot').length, mention: [...document.querySelectorAll('#mm-liste .mm-mention')].map(m => m.textContent) }));
check(ag.boutons === 0 && /agnelles? archivées? : ni modification ni annulation/.test(ag.mention.join()), 'agnelle archivée : ni Modifier ni Annuler, avec la mention : ' + JSON.stringify(ag));
console.log('OK 5 annulation d\'un groupé : confirmation = page PC, refus sans effet, accord : 3 brebis restaurées + lot supprimé ; lot partiellement archivé (1/2) : 1 restaurée, lot conservé pour l\'archivée, plus de bouton ; agnelles : aucune action.');

// ================================================================ 6. « Voir les plus anciens » (20 cartes à la fois, puis les campagnes précédentes)
await mob.evaluate(jeu);
await mob.evaluate(() => {
  const F = [];
  for (let i = 0; i < 25; i++) { const b = { id: 'X' + i, eid: EID(9, 1000 + i), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Perte', cause: 'Boiterie', date: '2026-10-02' }], controleLaitier: [], modesRepro: [] }; recalculerStatutBrebis(b); F.push(b); }
  DB.brebis = DB.brebis.concat(F); window.__avant = JSON.stringify(DB); window.__saves = 0;
  mvMobEtat = { cat: 'brebis', type: '', q: '', nb: 20, etendu: false, ouverts: new Set(), message: '' }; render('inventaire');
});
const nbCartes = () => mob.evaluate(() => document.querySelectorAll('#mm-liste > .mm-carte').length);
check(await nbCartes() === 20 && /Voir les mouvements plus anciens/.test(await mob.textContent('#mm-plus')), '20 cartes d\'abord + « Voir les mouvements plus anciens »');
check(/Campagne en cours/.test(await mob.textContent('#mm-info')), 'campagne en cours d\'abord');
await mob.click('#mm-plus'); const n2 = await nbCartes();
check(n2 > 20 && /Campagne en cours/.test(await mob.textContent('#mm-info')), 'puis la suite de la campagne en cours : ' + n2);
const dernier = async () => (await mob.evaluate(() => [...document.querySelectorAll('#mm-liste .mm-dt')].map(d => d.textContent.slice(0, 10)))).pop();
check(await dernier() >= '01-10-2026' || /^0[1-3]-10-2026$/.test(await dernier()), 'aucune carte antérieure à la campagne tant qu\'on est dans la campagne en cours : ' + await dernier());
await mob.click('#mm-plus');
check(/Toutes les campagnes/.test(await mob.textContent('#mm-info')) && (await dernier()) === '01-09-2026', 'quand la campagne en cours est épuisée : les campagnes précédentes (dernière carte : 01-09-2026) : ' + await dernier());
check(await mob.evaluate(() => !document.getElementById('mm-plus')), 'plus de bouton une fois tout affiché');
console.log('OK 6 plus anciens : 20 cartes à la fois, campagne en cours d\'abord, puis les campagnes précédentes, bouton retiré à la fin.');

// ================================================================ 7. export Excel : la liste filtrée, mêmes colonnes que la page PC
await listeMob('brebis'); await mob.evaluate(() => { window.__xlsx = []; window.__fich = []; });
await mob.selectOption('#mm-type', 'Morte');
await mob.click('#mm-export'); await mob.waitForFunction(() => window.__fich.length);
const xm = await mob.evaluate(() => ({ rows: window.__xlsx[0][0].rows, nom: window.__fich[0] }));
await lignesPc('brebis'); await pc.evaluate(() => { window.__xlsx = []; window.__fich = []; });
await pc.selectOption('#mvp-type', 'Morte'); await pc.click('#mvp-export'); await pc.waitForFunction(() => window.__fich.length);
const xp = await pc.evaluate(() => ({ rows: window.__xlsx[0][0].rows, nom: window.__fich[0] }));
eq(xm.rows[0], ['Date', 'N°', 'Catégorie', 'Type', 'Cause / acheteur', 'Lot'], 'colonnes de l\'export');
eq(xm.rows, xp.rows, 'export mobile (filtre Morte) = export PC (mêmes lignes, mêmes colonnes)');
check(/^mouvements-animaux_\d{4}-\d{2}-\d{2}\.xlsx$/.test(xm.nom) && xm.nom === xp.nom && xm.rows.length === 3, 'même nom de fichier ; 2 lignes + en-tête : ' + xm.nom + ' / ' + xm.rows.length);
await mob.selectOption('#mm-type', '');
console.log('OK 7 export Excel : liste filtrée à l\'écran, colonnes Date / N° / Catégorie / Type / Cause-acheteur / Lot, identique à l\'export PC.');

// ================================================================ 8. « Nouveau mouvement » : structure
await mob.evaluate(jeu); await mob.evaluate(() => { mvMobEtat.cat = 'brebis'; render('inventaire'); });
await mob.click('#mm-nouveau');
const nv = await mob.evaluate(() => ({ titre: pageTitle.textContent, cats: [...document.querySelectorAll('#mn-categories .mn-chip')].map(b => b.textContent), actif: document.querySelector('#mn-categories .mn-chip.on').textContent,
  types: [...document.querySelectorAll('#mn-types .mn-chip')].map(b => b.textContent), date: document.getElementById('mn-date').value, acheteur: !!document.getElementById('mn-acheteur'), cause: !!document.getElementById('mn-cause'),
  valider: document.getElementById('mn-valider').textContent, annuler: document.getElementById('mn-annuler').textContent, compte: document.getElementById('mn-compte').textContent, bip: document.getElementById('mn-bip').checked,
  barre: (() => { const b = document.querySelector('.mn-barre'); return getComputedStyle(b).position; })() }));
eq(nv.cats, ['Brebis · 7', 'Béliers · 2', 'Agneaux · 2', 'Agnelles · 2'], 'chips catégorie avec l\'effectif ACTIF'); eq(nv.types, ['Morte', 'Vente', 'Vente repro', 'Perte', 'Autoconsommation'], 'chips type (brebis)');
check(nv.titre === 'Nouveau mouvement' && nv.date === '2026-10-03' && !nv.acheteur && !nv.cause && nv.valider === 'Valider 0 mouvement' && nv.annuler === 'Annuler' && !nv.bip && nv.compte === '0 sélectionnée' && nv.barre === 'sticky', 'état initial (date du jour, aucun champ avant le type, barre fixe) : ' + JSON.stringify(nv));
const pcEffectifs = await pc.evaluate(() => { mvPcEtat = null; render('inventaire'); return [...document.querySelectorAll('#mv-categories button')].map(b => b.textContent.replace(/\s+/g, ' ')); });
eq(pcEffectifs, ['Brebis · 7', 'Béliers · 2', 'Agnelles · 2', 'Agneaux · 2'], 'mêmes effectifs actifs que la page PC');
// types et champs par catégorie et par type
const champs = async () => mob.evaluate(() => ({ ach: !!document.getElementById('mn-acheteur'), cau: !!document.getElementById('mn-cause') }));
for (const [t, attendu] of [['Vente', { ach: true, cau: false }], ['Vente reproduction', { ach: true, cau: false }], ['Morte', { ach: false, cau: true }], ['Perte', { ach: false, cau: true }], ['Autoconsommation', { ach: false, cau: false }]]) {
  await mob.click('#mn-types [data-val="' + t + '"]'); eq(await champs(), attendu, 'champs pour ' + t);
}
await mob.click('#mn-categories [data-cat="beliers"]'); eq(await mob.evaluate(() => [...document.querySelectorAll('#mn-types .mn-chip')].map(b => b.textContent)), ['Mort', 'Vente', 'Vente repro', 'Perte', 'Autoconsommation'], 'béliers : « Mort »');
await mob.click('#mn-categories [data-cat="agneaux"]'); eq(await mob.evaluate(() => [...document.querySelectorAll('#mn-types .mn-chip')].map(b => b.textContent)), ['Vendu', 'Mort'], 'agneaux : Vendu / Mort');
await mob.click('#mn-types [data-val="Vendu"]'); eq(await champs(), { ach: true, cau: false }, 'agneaux : Vendu = acheteur');
await mob.click('#mn-categories [data-cat="brebis"]');
console.log('OK 8 Nouveau mouvement : chips catégorie (effectifs = page PC) et type, champs selon le type (acheteur pour Vente / Vente repro, cause pour Morte / Perte, rien pour Autoconsommation), types des béliers et des agneaux, barre fixe.');

// ================================================================ 9. liste des animaux : tri, recherche (n° et SIEOL), tout cocher
const ordreMob = () => mob.evaluate(() => [...document.querySelectorAll('#mn-liste .mn-it')].map(l => [l.querySelector('.mn-num').textContent.replace('n°', ''), l.querySelector('.mn-age').textContent]));
const ordrePc = await pc.evaluate(() => [...document.querySelectorAll('#mv-table tr.clic')].map(r => [r.children[1].textContent.trim(), r.children[2].textContent.trim()]));
eq(await ordreMob(), ordrePc, 'mêmes animaux, même ordre (âge décroissant puis n° croissant), même âge que le tableau de la page PC');
check(!(await mob.evaluate(() => [...document.querySelectorAll('#mn-liste .mn-num')].some(n => /00099|00600/.test(n.textContent) && false))), 'animaux actifs seulement');
await mob.fill('#mn-q', '59'); eq((await ordreMob()).map(x => x[0]), ['00059'], 'recherche par n°');
await mob.fill('#mn-q', '152'); eq((await ordreMob()).map(x => x[0]), ['152'], 'recherche par n° de travail SIEOL (le n° affiché est le court SIEOL, comme sur PC)');
await mob.fill('#mn-q', '12345'); check(await mob.evaluate(() => /Aucun animal ne correspond/.test(document.getElementById('mn-liste').textContent)), 'aucun résultat : message');
await mob.fill('#mn-q', '00');
const nbFiltres = (await ordreMob()).length;
await mob.click('#mn-tout');
check((await mob.textContent('#mn-compte')) === nbFiltres + ' sélectionnées' && (await mob.textContent('#mn-tout')) === 'Tout décocher', 'Tout cocher : les animaux filtrés seulement ; le bouton devient « Tout décocher » : ' + await mob.textContent('#mn-compte'));
await mob.click('#mn-tout');
check(await mob.textContent('#mn-compte') === '0 sélectionnée', 'Tout décocher');
await mob.fill('#mn-q', '');
await mob.click('#mn-liste .mn-it >> nth=0'); await mob.click('#mn-liste .mn-it >> nth=2');
check((await mob.textContent('#mn-compte')) === '2 sélectionnées' && await mob.evaluate(() => document.querySelectorAll('#mn-liste .mn-cb:checked').length === 2), 'cocher / décocher : pastille « N sélectionnées »');
await mob.click('#mn-liste .mn-it >> nth=0'); await mob.click('#mn-liste .mn-it >> nth=2');
console.log('OK 9 animaux concernés : mêmes animaux, ordre et âges que la page PC, recherche par n° et par n° SIEOL, tout cocher / décocher sur le filtré, compteur.');

// ================================================================ 10. bip en série
await mob.evaluate(() => { document.getElementById('mn-annuler').click(); }); await mob.click('#mm-nouveau');
await mob.click('label.mn-bip');
check(await mob.evaluate(() => !!document.getElementById('mn-scan') && document.getElementById('mn-bip').checked), 'l\'interrupteur « Bip en série » affiche le champ de lecture');
const bip = async v => { await mob.evaluate(v => { const el = document.getElementById('mn-scan'); el.value = v; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })); }, v); await mob.waitForTimeout(250); };
const E1 = await mob.evaluate(() => EID(9, 59)), E2 = await mob.evaluate(() => EID(9, 69));
await bip(E1);
check(await mob.textContent('#mn-compte') === '1 sélectionnée' && /ajoutée/.test(await mob.textContent('#mn-scan-fb')) && await mob.evaluate(() => document.querySelectorAll('#mn-liste .mn-cb:checked').length === 1), 'un bip coche l\'animal : ' + await mob.textContent('#mn-scan-fb'));
await bip(E1);
check(await mob.textContent('#mn-compte') === '1 sélectionnée' && /déjà sélectionnée/.test(await mob.textContent('#mn-scan-fb')), 'second bip du même animal : « déjà sélectionnée », pas de doublon');
await bip(E2);
check(await mob.textContent('#mn-compte') === '2 sélectionnées', 'deuxième animal ajouté');
await bip('250016299999999');
check(await mob.textContent('#mn-compte') === '2 sélectionnées' && /introuvable/.test(await mob.textContent('#mn-scan-fb')), 'EID inconnu : message « introuvable », rien de coché : ' + await mob.textContent('#mn-scan-fb'));
await bip('152');
check(await mob.textContent('#mn-compte') === '3 sélectionnées', 'n° de travail SIEOL court accepté au bip');
await mob.click('label.mn-bip');
check(await mob.evaluate(() => !document.getElementById('mn-scan')) && await mob.textContent('#mn-compte') === '3 sélectionnées', 'désactiver le bip garde la sélection');
console.log('OK 10 bip en série : coche l\'animal, « déjà sélectionnée » au second bip, EID inconnu signalé, n° SIEOL court accepté, la sélection survit au changement de mode.');

// ================================================================ 11. bandeau de délai d'attente (même calcul que la page PC)
const zone = () => mob.evaluate(() => { const z = document.getElementById('zone-alerte-vente-delai'); return z ? z.textContent.replace(/\s+/g, ' ').trim() : null; });
await mob.click('#mn-types [data-val="Vente"]');
const zVente = await zone();
check(zVente && /n°152 est encore sous délai d'attente viande à la date de la vente/.test(zVente) && /16-11-2026/.test(zVente) && /rien n'est bloqué/.test(zVente) && !/quand même/.test(zVente), 'Vente d\'un animal sous délai : bandeau avec la date de fin (16-11-2026), non bloquant : ' + zVente);
check(await mob.evaluate(() => { const z = document.querySelector('#zone-alerte-vente-delai .brd-alert.warn'); return !!z && getComputedStyle(z).borderLeftWidth === '5px'; }), 'bandeau ambre');
// même texte que la page PC avec la même sélection
await pc.evaluate(() => { mvPcEtat = null; render('inventaire'); });
await pc.click('.mv-type[data-val="Vente"]'); await pc.fill('#mv-q', '152'); await pc.click('#mv-table tr.clic >> nth=0');
const zPc = await pc.evaluate(() => document.getElementById('zone-alerte-vente-delai').textContent.replace(/\s+/g, ' ').trim());
eq(zVente.replace(/n°\d+/g, 'n°X'), zPc.replace(/n°\d+/g, 'n°X'), 'texte du bandeau identique à celui de la page PC');
await mob.click('#mn-types [data-val="Morte"]'); check(await zone() === null, 'Morte : pas de bandeau');
await mob.click('#mn-types [data-val="Vente reproduction"]'); check(await zone() === null, 'Vente reproduction : pas de bandeau (comme sur PC)');
await mob.click('#mn-types [data-val="Autoconsommation"]'); check(!!(await zone()), 'Autoconsommation : bandeau');
await mob.evaluate(() => { const d = document.getElementById('mn-date'); d.value = '2026-11-20'; d.dispatchEvent(new Event('input')); });
check(await zone() === null, 'date après la fin du délai : le bandeau disparaît');
await mob.evaluate(() => { const d = document.getElementById('mn-date'); d.value = '2026-10-03'; d.dispatchEvent(new Event('input')); });
check(!!(await zone()), 'date remise : le bandeau revient');
// décocher l'animal concerné : plus de bandeau
await mob.fill('#mn-q', '152'); await mob.click('#mn-liste .mn-it >> nth=0'); await mob.fill('#mn-q', '');
check(await zone() === null, 'animal décoché : plus de bandeau');
console.log('OK 11 délai d\'attente : bandeau ambre non bloquant avec la date de fin, texte = page PC, seulement pour Vente / Autoconsommation, suit la date et la sélection.');

// ================================================================ 12. validation : erreurs, confirmation = page PC, écriture = page PC
await mob.evaluate(() => { document.getElementById('mn-annuler').click(); }); await mob.click('#mm-nouveau');
await mob.click('#mn-valider');
const errs = await mob.evaluate(() => [...document.querySelectorAll('#mn-erreurs li')].map(l => l.textContent));
const errsPc = await pc.evaluate(() => { const E = mvPcEtatInitial(); return erreursMouvementPc(E, []); });
eq(errs, errsPc, 'messages d\'erreur identiques à ceux de la page PC (type manquant, aucun animal)'); check(await intact(mob), 'valider avec erreurs n\'écrit rien');
await mob.click('#mn-types [data-val="Vente"]'); await mob.click('#mn-liste .mn-it >> nth=0'); await mob.click('#mn-valider');
check(await mob.evaluate(() => [...document.querySelectorAll('#mn-erreurs li')].some(l => /acheteur est obligatoire/.test(l.textContent))), 'Vente sans acheteur : erreur');
// entrée après la date de sortie
await mob.fill('#mn-q', '600'); await mob.click('#mn-liste .mn-it >> nth=0'); await mob.fill('#mn-q', '');
await mob.selectOption('#mn-acheteur', 'Natera');
await mob.evaluate(() => { const d = document.getElementById('mn-date'); d.value = '2026-10-01'; d.dispatchEvent(new Event('input')); });
await mob.click('#mn-valider');
check(await mob.evaluate(() => [...document.querySelectorAll('#mn-erreurs li')].some(l => /est entré\(e\) le 02-10-2026, après la date de sortie choisie \(01-10-2026\)/.test(l.textContent))), 'animal entré après la date choisie : erreur (comme sur PC)');
await mob.evaluate(() => { const d = document.getElementById('mn-date'); d.value = '2026-10-03'; d.dispatchEvent(new Event('input')); document.getElementById('mn-erreurs').innerHTML = ''; });
await mob.fill('#mn-q', '600'); await mob.click('#mn-liste .mn-it >> nth=0'); await mob.fill('#mn-q', '');   // décoche
// parcours complet identique sur les deux pages : 2 brebis vendues à Boucherie Martin
const saisieMob = async () => {
  await mob.selectOption('#mn-acheteur', 'Boucherie Martin');
  check((await mob.textContent('#mn-valider')) === 'Valider 1 vente', 'libellé du bouton : ' + await mob.textContent('#mn-valider'));
  await mob.fill('#mn-q', '5'); const nums = await ordreMob(); await mob.fill('#mn-q', '');
  return nums;
};
await saisieMob();
await mob.click('#mn-liste .mn-it >> nth=1');
check((await mob.textContent('#mn-valider')) === 'Valider 2 ventes', 'libellé au pluriel : ' + await mob.textContent('#mn-valider'));
const selMob = await mob.evaluate(() => [...document.querySelectorAll('#mn-liste .mn-it.on .mn-num')].map(n => n.textContent.replace('n°', '')));
mob.reponse = false; mob.confirms.length = 0; await mob.click('#mn-valider');
check(mob.confirms.length === 1 && await intact(mob), 'Valider demande une confirmation ; refusée : rien n\'est écrit');
// même sélection sur la page PC
await pc.evaluate(() => { mvPcEtat = null; render('inventaire'); });
await pc.click('.mv-type[data-val="Vente"]'); await pc.selectOption('#mv-acheteur', 'Boucherie Martin');
for (const n of selMob) { await pc.fill('#mv-q', n); await pc.click('#mv-table tr.clic >> nth=0'); }
await pc.fill('#mv-q', '');
pc.reponse = false; pc.confirms.length = 0; await pc.click('#mv-valider');
eq(mob.confirms[0], pc.confirms[0], 'texte de confirmation identique à celui de la page PC');
mob.reponse = true; pc.reponse = true;
await mob.click('#mn-valider'); await pc.click('#mv-valider'); await pc.waitForTimeout(150);
const ecrit = page => page.evaluate(() => ({
  brebis: DB.brebis.filter(b => b.mouvements.some(m => m.acheteur === 'Boucherie Martin')).map(b => [b.eid, b.statut, JSON.stringify(b.mouvements.filter(m => m.acheteur === 'Boucherie Martin').map(m => [m.type, m.date, m.cause || null, m.acheteur, !!m.collectifId]))]).sort(),
  lots: DB.mouvementsCollectifs.filter(l => l.acheteur === 'Boucherie Martin').map(l => [l.categorie, l.annulable, l.type, l.cause, l.acheteur, l.date, l.membres.slice().sort()])
}));
const wm = await ecrit(mob), wp = await ecrit(pc);
eq(wm, wp, 'écriture identique à celle de la page PC (mouvements, statuts, mouvement collectif)');
check(wm.brebis.length === 2 && wm.lots.length === 1, 'un mouvement par animal + un lot : ' + JSON.stringify(wm).slice(0, 200));
const retour = await mob.evaluate(() => ({ vue: currentView, msg: document.getElementById('mm-message').textContent, lot: [...document.querySelectorAll('#mm-liste .mm-nm')].some(n => n.textContent === 'Vente · 2 brebis'), cat: document.querySelector('#mm-cats .tab-btn.active').textContent }));
check(retour.vue === 'inventaire' && /Enregistré : Vente · 2 brebis · Boucherie Martin/.test(retour.msg) && retour.lot && retour.cat === 'Brebis', 'retour à la liste : message « Enregistré », carte du nouveau lot : ' + JSON.stringify(retour));
console.log('OK 12 validation : erreurs = page PC, confirmation obligatoire (texte = page PC), « Valider N ventes » ; écriture identique à celle du PC (un mouvement par animal + un lot) ; retour à la liste avec la carte du lot.');

// ================================================================ 13. Annuler, libellés par type, autres catégories
await mob.click('#mm-nouveau'); await mob.click('#mn-types [data-val="Perte"]'); await mob.click('#mn-liste .mn-it >> nth=0');
await mob.click('#mn-annuler');
check(await mob.evaluate(() => currentView === 'inventaire' && !!document.getElementById('mm-nouveau')) && await mob.evaluate(() => !DB.brebis.some(b => b.mouvements.some(m => m.type === 'Perte'))), '« Annuler » : retour à la liste sans rien écrire');
await mob.click('#mm-nouveau');
const lib = async (type, n) => { await mob.click('#mn-types [data-val="' + type + '"]'); return mob.textContent('#mn-valider'); };
await mob.click('#mn-liste .mn-it >> nth=0');
eq([await lib('Morte'), await lib('Vente reproduction'), await lib('Perte'), await lib('Autoconsommation')], ['Valider 1 morte', 'Valider 1 vente repro', 'Valider 1 perte', 'Valider 1 autoconsommation'], 'libellés du bouton selon le type');
await mob.click('#mn-categories [data-cat="agneaux"]'); await mob.click('#mn-types [data-val="Vendu"]'); await mob.click('#mn-liste .mn-it >> nth=0'); await mob.click('#mn-liste .mn-it >> nth=1');
eq(await mob.textContent('#mn-valider'), 'Valider 2 agneaux vendus', 'agneaux : « Valider 2 agneaux vendus »');
await mob.selectOption('#mn-acheteur', 'Natera'); mob.reponse = true; await mob.click('#mn-valider');
const agn = await mob.evaluate(() => ({ vues: currentView, vendus: DB.brebis.flatMap(b => (b.agnelages || []).flatMap(a => a.lambs)).filter(l => l.statutFinal === 'vendu').length, cat: document.querySelector('#mm-cats .tab-btn.active').textContent, cartes: document.querySelectorAll('#mm-liste .mm-lot').length }));
check(agn.vues === 'inventaire' && agn.vendus === 3 && agn.cat === 'Agneaux' && agn.cartes === 1, 'agneaux : 2 agneaux vendus (+1 déjà vendu), liste ouverte sur Agneaux, une carte de lot : ' + JSON.stringify(agn));
console.log('OK 13 Annuler revient à la liste sans écrire ; libellés « Valider N … » par type (morte, vente repro, perte, autoconsommation, agneaux vendus) ; agneaux : Vendu + acheteur.');

// ================================================================ 14. répertoire : « Ajouter… » acheteur / cause depuis l'écran
await mob.evaluate(jeu); await mob.evaluate(() => { mvMobEtat.cat = 'brebis'; render('mouvement-groupe'); });
await mob.click('#mn-types [data-val="Vente"]'); await mob.selectOption('#mn-acheteur', '__ajouter__');
await mob.waitForSelector('.modal-overlay, .modal-card');
check(await mob.evaluate(() => /Ajouter un acheteur/.test(document.body.textContent)), 'option « Ajouter… » : fenêtre d\'ajout d\'un acheteur');
await mob.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.remove()));
console.log('OK 14 répertoire : « Ajouter… » ouvre la fenêtre d\'ajout d\'un acheteur (même fenêtre que sur PC).');

// ================================================================ 15. PC inchangé : aucune écriture, aucun style mobile
await pc.evaluate(() => { mvPcEtat = null; render('inventaire'); });
check(await pc.evaluate(() => !!document.getElementById('pc-mouvements') && !document.getElementById('mm-nouveau') && !document.querySelector('.mn-page')), 'PC : la page PC reste la seule page (aucun élément de l\'écran mobile)');
check(await mob.evaluate(() => window.__saves === 0), 'aucune écriture non confirmée côté mobile');
console.log('OK 15 PC inchangé.');
await browser.close();
console.log('\nTOUS LES TESTS DES MOUVEMENTS D\'ANIMAUX MOBILE SONT PASSÉS.');
