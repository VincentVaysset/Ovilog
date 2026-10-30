/* Accueil PC (maquette « Accueil PC », Mises bas à gauche, Reproduction à droite) : 5 tuiles à liseré (« Sous délai d'attente » rouge seulement si > 0), Mises bas (attendues = présentes − vides définitives présentes), Reproduction (écho figée, vides définitives = total du troupeau),
   Derniers mouvements (brebis et agneaux de la campagne, un lot = une ligne), Contrôle laitier en graphique SVG, Attendues à la traite (avec motif), Mortalité brebis / agneaux (base écrite, mort-nés, cause par défaut « Mort » affichée « Non renseignée »).
   Plus d'encart bleu, de barres beiges ni de flèches orange. Lecture seule. Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
function jeu(avecSousDelai) {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (n) => '25000001296' + String(n).padStart(4, '0');
  let k = 0;
  const fiche = (id, o) => Object.assign({ id, eid: eid(++k), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const e = (type, stade, date) => ({ date: date || '2026-08-01', campagne: 2026, type, stade });
  const lamb = (n, sexe, mv, o) => Object.assign({ eid: sexe === 'Mort-né' ? undefined : eid(700 + n), sexe, sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-10' }].concat(mv || []) }, o || {});
  const vendu = (d) => ({ statutFinal: 'vendu', mouvements: null, _mv: { type: 'Vendu', acheteur: 'Acheteur C', date: d } });
  const lvendu = (n, d) => lamb(n, 'Mâle', [{ type: 'Vendu', acheteur: 'Acheteur C', date: d }], { statutFinal: 'vendu' });
  const lmort = (n, sexe, d, cause) => lamb(n, sexe, [{ type: 'Mort', cause: cause, date: d }], { statutFinal: 'mort' });
  const ag = (lambs) => [{ date: '2026-11-10', campagne: 2026, lambs }];
  const morte = (d, cause) => ({ statut: 'morte', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Morte', cause, date: d }] });
  const vendueLot = () => ({ statut: 'vendue', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Vente', acheteur: 'Négociant', date: '2026-11-28', collectifId: 'MC1' }] });
  const soin = { type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-11-28', dose: 2, quantiteCc: 2, intervenant: 'Éleveur', dureeJours: 1, bio: false, delaiLaitJours: 7, delaiViandeJours: 28, numeroOrdonnance: '' };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true; DB.casParticuliers = ['Avortée', 'Pseudogestation'];
  DB.produitsInfo = { Intramicine: { posologie: null, delaiAttente: 7, delaiLait: 7, delaiViande: 28 } };
  DB.brebis = [
    fiche('E1', { echographies: [e('constat', 'Pleine')], sanitaire: avecSousDelai ? [soin] : [] }), fiche('E2', { echographies: [e('constat', 'Pleine')], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Entrée', cause: 'Achat', date: '2026-11-26' }] }), fiche('E3', { echographies: [e('constat', 'Pleine', '2026-08-20')] }),   // 3 pleines
    fiche('E4', { echographies: [e('constat', 'Vide')] }), fiche('E5', Object.assign({ echographies: [e('constat', 'Vide')] }, vendueLot())),                                                            // 2 vides (une vendue : figée)
    fiche('E6', { echographies: [e('constat', 'Vide')], videesDefinitives: [{ campagne: 2026, date: '2026-09-01' }] }),                                                                                  // 1 vide définitive présente
    fiche('M1', { agnelages: ag([lvendu(1, '2026-11-25'), lmort(2, 'Femelle', '2026-11-22', 'Pneumonie')]) }),                                                                                           // attendue : agneau vendu
    fiche('M2', { agnelages: ag([lamb(3, 'Mort-né'), lmort(4, 'Mâle', '2026-11-24', 'Mort')]) }),                                                                                                         // attendue : agneau mort (cause par défaut)
    fiche('M3', { agnelages: ag([lvendu(5, '2026-11-27')]) }),                                                                                                                                            // attendue : agneau vendu
    fiche('M4', { agnelages: ag([lamb(6, 'Mâle'), lamb(7, 'Femelle')]) }),                                                                                                                                // 2 agneaux actifs
    fiche('D1', morte('2026-11-15', 'Mammite')), fiche('D2', morte('2026-11-16', '')), fiche('D3', morte('2026-11-17', 'Mammite')),
    fiche('S1', vendueLot())];
  DB.beliers = [fiche('B1', { statut: 'actif' }), fiche('B2', { statut: 'vendu' })]; DB.agnelles = [fiche('A1', {})]; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.mouvementsCollectifs = [{ id: 'MC1', categorie: 'brebis', type: 'Vente', cause: '', acheteur: 'Négociant', date: '2026-11-28', membres: [DB.brebis[4].eid, DB.brebis[DB.brebis.length - 1].eid], createdAt: 1 }];
  const rc = (campagne, controle, nb, l) => ({ campagne, controle, nbBrebis: nb, laitTroupeau: l });
  DB.resumeControleLaitier = [rc(2026, 1, 396, 2280), rc(2026, 2, 388, 2190), rc(2026, 3, 371, 1800), rc(2025, 1, 400, 2210), rc(2025, 2, 390, 2160), rc(2025, 3, 380, 1710)];
  window.__avant = JSON.stringify(DB); window.__saves = 0;
}
async function ouvrir(bureau, avecSousDelai) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-12-01T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeu, avecSousDelai);
  return page;
}
const pc = await ouvrir(true, true);
const D = await pc.evaluate(() => accueilPcData());

// ================================================================ 1. données (fonction pure)
eq([D.brebis, D.beliers, D.agnelles, D.agneaux, D.sousDelai], [9, 1, 1, { total: 2, males: 1, femelles: 1 }, 1], 'tuiles : brebis, béliers, agnelles, agneaux (mâles / femelles), sous délai');
eq(D.misesBas, { faites: 4, attendues: 8, restantes: 4, pct: 50, prolificite: 1.75, agneauxNes: 7, mortNes: 1, presentes: 9, videsDefinitivesPresentes: 1 }, 'mises bas : attendues = 9 présentes − 1 vide définitive présente ; restantes = 8 − 4');
eq(D.repro, { date: '2026-08-20', pleines: 3, vides: 2, videsDefinitives: 1, reussite: 60 }, 'reproduction : écho figée (la vide vendue reste comptée), vide définitive à part, réussite 3 / (3 + 2)');
eq(D.mouvements.map(m => [m.date, m.lot, m.nb, m.categorie, m.type, m.detail]), [
  ['2026-11-28', true, 2, 'Brebis', 'Vente', 'Négociant'], ['2026-11-27', false, 1, 'Agneau', 'Vente', 'Acheteur C'], ['2026-11-26', false, 1, 'Brebis', 'Entrée', 'Achat'], ['2026-11-25', false, 1, 'Agneau', 'Vente', 'Acheteur C'],
  ['2026-11-24', false, 1, 'Agneau', 'Morte', 'Non renseignée']], 'derniers mouvements : sorties ET entrées, un lot = une ligne, brebis et agneaux, 5 lignes du plus récent au plus ancien, cause par défaut « Non renseignée »');
const toutes = await pc.evaluate(() => derniersMouvementsPcData(99));
eq(toutes.filter(m => m.type === 'Entrée').map(m => [m.date, m.categorie, m.detail]).sort().map(l => l.join('|')), ['2026-11-10|Agneau|Naissance', '2026-11-10|Agneau|Naissance', '2026-11-10|Agneau|Naissance', '2026-11-10|Agneau|Naissance', '2026-11-10|Agneau|Naissance', '2026-11-10|Agneau|Naissance', '2026-11-26|Brebis|Achat'].sort(), 'entrées de la campagne : l\'achat du 26-11 et les 6 naissances bouclées (le mort-né n\'a pas d\'identifiant) (l\'achat de 2024 est hors campagne)');
eq(D.lait.points.map(p => [p.libelle, p.actuel, p.precedent, p.nbBrebis]), [['1er contrôle', 2.28, 2.21, 396], ['2e contrôle', 2.19, 2.16, 388], ['3e contrôle', 1.8, 1.71, 371]], 'contrôle laitier : campagne en cours et précédente');
eq([D.attendues.total, D.attendues.liste.map(a => [a.motif, a.date])], [3, [['Agneau vendu', '2026-11-27'], ['Agneau vendu', '2026-11-25'], ['Agneau mort', '2026-11-24']]], 'attendues à la traite : motif et date de la dernière sortie');
eq(D.mortalite.brebis, { pertes: 3, presentes: 9, base: 12, causes: [['Mammite', 2], ['Non renseignée', 1]] }, 'mortalité brebis : base = présentes + pertes ; cause vide = « Non renseignée »');
eq(D.mortalite.agneaux, { pertes: 3, nes: 7, mortNes: 1, avortons: 0, causes: [['Mort-nés', 1], ['Non renseignée', 1], ['Pneumonie', 1]] }, 'mortalité agneaux : base = agneaux nés ; « Mort-nés » sur sa ligne ; cause par défaut « Mort » = « Non renseignée »');
console.log('OK données de l\'accueil PC : tuiles, mises bas, reproduction, mouvements, contrôle laitier, attendues, mortalité.');

// ================================================================ 2. affichage
await pc.evaluate(() => render('home')); await pc.waitForTimeout(200);
const A = await pc.evaluate(() => {
  const cs = e => getComputedStyle(e), q = s => document.querySelector(s), txt = s => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null), r = s => q(s).getBoundingClientRect();
  const tuiles = ['compteur-brebis-actives', 'compteur-beliers-actifs', 'compteur-agneaux-actifs', 'compteur-agnelles-actives', 'compteur-sous-delai'].map(id => ({ id, t: txt('#' + id), bg: cs(q('#' + id)).backgroundColor, bord: cs(q('#' + id)).borderLeftWidth, chev: cs(q('#' + id + ' .apc-chev')).color }));
  const cartes = [...document.querySelectorAll('.apc-carte')].map(c => c.querySelector('h3').textContent);
  return { titre: document.getElementById('page-title').textContent, tuiles, cartes, gauche: Math.round(r('#apc-mises-bas').left), droite: Math.round(r('#apc-reproduction').left),
    mb: txt('#apc-mises-bas'), rp: txt('#apc-reproduction'), mv: txt('.apc-t'), lait: txt('#bloc-controle-laitier'), nbRect: document.querySelectorAll('#bloc-controle-laitier svg rect').length, att: txt('.apc-g2 .apc-carte:last-child'), mortB: txt('#bloc-mortalite'), mortA: txt('#bloc-mortalite-agneaux'),
    ancien: !!document.querySelector('.dash-callout, .compare-bar-track, .compteur-case, .bar-track'), hex: document.getElementById('app').innerHTML.match(/#[0-9a-fA-F]{3,6}\b/g) };
});
eq(A.titre, 'Accueil', 'titre du bandeau');
eq(A.cartes, ['Mises bas · réalisé', 'Reproduction · échographies', 'Derniers mouvements · brebis et agneaux', 'Contrôle laitier · moyenne par brebis', 'Attendues à la traite', 'Mortalité brebis', 'Mortalité agneaux'], 'cartes dans l\'ordre de la maquette');
check(A.gauche < A.droite, 'Mises bas à gauche, Reproduction à droite (exception demandée) : ' + A.gauche + ' / ' + A.droite);
eq(A.tuiles.map(t => t.t), ['Brebis actives9', 'Béliers actifs1', 'Agneaux actifs21 mâle · 1 femelle', 'Agnelles actives1', 'Sous délai d\'attente1'], 'tuiles : libellés et chiffres');
eq(A.tuiles.map(t => t.bg), ['rgb(227, 243, 230)', 'rgb(230, 240, 250)', 'rgb(251, 238, 215)', 'rgb(251, 238, 215)', 'rgb(251, 227, 224)'], 'tuiles : pastels vert, bleu, ambre, ambre, rouge (sous délai > 0)');
check(A.tuiles.every(t => t.bord === '5px' && t.chev === 'rgb(138, 134, 112)'), 'tuiles : liseré gauche de 5 px et chevron gris');
check(/4\s*brebis ont mis bas sur 8 attendues/.test(A.mb) && /50 %/.test(A.mb) && /4Restantes/.test(A.mb) && /1,75Prolificité/.test(A.mb) && /7Agneaux nés \(1 mort-né\)/.test(A.mb) && /8 attendues = 9 brebis présentes − 1 vide définitive\./.test(A.mb), 'carte Mises bas : ' + A.mb);
check(/Écho du 20-08-2026 · figée/.test(A.rp) && /3Pleines/.test(A.rp) && /2Vides/.test(A.rp) && /1Vides définitives/.test(A.rp) && /60,0 %/.test(A.rp) && /5 brebis échographiées/.test(A.rp), 'carte Reproduction : ' + A.rp);
check(/28-11-2026/.test(A.mv) && /2 brebis.?lot/.test(A.mv) && /Négociant/.test(A.mv) && /Non renseignée/.test(A.mv) && /26-11-2026/.test(A.mv) && /Entrée/.test(A.mv) && /Achat/.test(A.mv), 'tableau des derniers mouvements : ' + A.mv);
check(A.nbRect === 6 && /2,28 L/.test(A.lait) && /396 brebis/.test(A.lait) && /Campagne précédente/.test(A.lait), 'contrôle laitier : 6 barres SVG, moyennes et nombre de brebis : ' + A.nbRect);
check(/3/.test(A.att) && /Agneau vendu/.test(A.att) && /Agneau mort/.test(A.att), 'attendues à la traite : ' + A.att);
check(/3 pertes · 25,0 %/.test(A.mortB) && /Base : 9 brebis présentes \+ 3 pertes = 12\./.test(A.mortB) && /Mammite2/.test(A.mortB) && /Non renseignée1/.test(A.mortB), 'mortalité brebis : ' + A.mortB);
check(/3 pertes · 42,9 %/.test(A.mortA) && /Base : 7 agneaux nés \(dont 1 mort-né\)\./.test(A.mortA) && /Mort-nés1/.test(A.mortA) && /Non renseignée1/.test(A.mortA), 'mortalité agneaux : ' + A.mortA);
check(!A.ancien && !A.hex, 'aucun ancien bloc (encart bleu, barres beiges, compteurs) ni couleur en dur : ' + JSON.stringify(A.hex));
console.log('OK affichage de l\'accueil PC : titre, ordre des cartes (Mises bas à gauche), tuiles à liseré et chevron gris, textes, SVG, aucune couleur en dur.');

// ================================================================ 3. « Sous délai d'attente » neutre à 0, clics, lecture seule
const pc0 = await ouvrir(true, false);
await pc0.evaluate(() => render('home')); await pc0.waitForTimeout(200);
eq(await pc0.evaluate(() => [document.querySelector('#compteur-sous-delai .n').textContent, getComputedStyle(document.getElementById('compteur-sous-delai')).backgroundColor]), ['0', 'rgb(239, 233, 218)'], 'sous délai à 0 : tuile neutre');
for (const [id, titre] of [['compteur-brebis-actives', 'Brebis (9)'], ['compteur-beliers-actifs', 'Béliers (1)'], ['compteur-agneaux-actifs', 'Agneaux (6)'], ['compteur-agnelles-actives', 'Agnelles (1)'], ['compteur-sous-delai', 'Sous délai d\'attente'], ['bloc-controle-laitier', 'Contrôle laitier'], ['apc-tous-mouvements', 'Mouvements d\'animaux'], ['apc-reproduction', 'Échographies'], ['apc-mises-bas', 'Bilan de campagne']]) {
  await pc.evaluate(() => render('home')); await pc.waitForTimeout(120);
  await pc.click('#' + id); await pc.waitForTimeout(150);
  eq(await pc.evaluate(() => document.getElementById('page-title').textContent), titre, 'clic sur #' + id);
}
eq(await pc.evaluate(() => [JSON.stringify(DB) === window.__avant, window.__saves]), [true, 0], 'lecture seule : aucune donnée modifiée, aucune sauvegarde');
console.log('OK navigation des tuiles et cartes, tuile neutre à 0, lecture seule.');
await browser.close();
console.log('\nTOUS LES TESTS DE L\'ACCUEIL PC SONT PASSÉS.');
