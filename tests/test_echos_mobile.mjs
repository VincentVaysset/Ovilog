/* Écran mobile « Échographies » (menu) : onglets Aujourd'hui (réel, chaque brebis une fois) | Passages (jours d'écho figés, toucher = détail) | Historique ;
   « À passer au prochain passage » (suggestion) avec « Créer un lot avec ces animaux » (seule écriture) ; « Nouvelle session d'écho » ouvre la saisie,
   retour sur l'écran ; exports en bas. Jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.clock.setFixedTime(new Date('2026-12-03T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => d.accept());
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  const fiche = (n, extra) => Object.assign({ id: 'b' + n, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  const E = (date, stade, extra) => Object.assign({ type: 'stades', date, stade, campagne: 2026 }, extra || {});
  DB.brebis = [
    fiche('619001', { echographies: [E('2026-10-15', 'IA', { agneaux: 'Double' })], agnelages: [{ date: '2026-11-02', campagne: 2026, codeRepro: 'IA', lambs: [{ sexe: 'Mâle' }, { sexe: 'Femelle' }] }] }),
    fiche('619002', { echographies: [E('2026-10-15', 'IA', { agneaux: 'Simple' })] }),
    fiche('619003', { echographies: [E('2026-10-15', 'Vide'), E('2026-11-28', 'Retour 1', { agneaux: 'Simple' })] }),
    fiche('619004', { echographies: [E('2026-10-15', 'Vide'), E('2026-11-28', 'Vide')] }),
    fiche('619005', { echographies: [E('2026-10-15', 'Fin')], statut: 'vendue', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Vente', date: '2026-10-20' }] }),
    fiche('726010', { echographies: [E('2026-11-28', 'Début', { agneaux: 'Double' })] }),
    fiche('619008')];
  DB.lots = [{ id: 'L1', type: 'reproduction', mode: 'IA', nom: 'Lot IA 1', dateEvenement: '2026-05-20', dateCreation: '2026-05-20', campagneMisesBas: 2026, membres: ['250000045619001', '250000045619002', '250000045619003'] }];
  window.__avant = JSON.stringify(DB);
});

// 1. le menu ouvre l'écran, onglet Aujourd'hui
eq(await p.evaluate(() => NAV_ITEMS.find(i => i.label === 'Échographies').view), 'echographies', 'entrée de menu « Échographies »');
await p.evaluate(() => render('echographies'));
const A = await p.evaluate(() => ({ titre: pageTitle.textContent, onglets: [...document.querySelectorAll('#em-onglets .tab-btn')].map(b => b.textContent), tuiles: [...document.querySelectorAll('#em-tuiles .tuile-charte')].map(t => [t.querySelector('.l').textContent, t.querySelector('.n').textContent]),
  aussi: (document.getElementById('em-aussi') || {}).textContent, aPasser: document.querySelector('#em-a-passer .mb-pastille').textContent, lots: [...document.querySelectorAll('#em-parlot .carte-liste-nm')].map(x => x.textContent),
  exports: [...document.querySelectorAll('.em-exports .btn')].map(b => [b.textContent, b.classList.contains('btn-primary')]), campagne: !!document.getElementById('em-campagne') }));
eq([A.titre, A.onglets], ['Échographies', ['Aujourd\'hui', 'Passages', 'Historique']], 'titre et onglets');
eq(A.tuiles, [['Pleines, à mettre bas', '3'], ['Ont mis bas', '1'], ['Vides', '1'], ['Pas encore passées', '1']], 'quatre tuiles (chaque brebis une fois)');
eq([A.aussi, A.aPasser, A.lots, A.campagne], ['Aussi : 1 sortie.', '2', ['Monte naturelle', 'Lot IA 1'], false], 'ligne grise, suggestion à passer (vide + jamais passée), par lot ; pas de choix de campagne sans écho à venir');
eq(A.exports, [['Export Excel', false], ['Export PDF', true]], 'exports en bas : Excel blanc puis PDF vert');
check(await p.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'affichage : aucune écriture');

// 2. Créer un lot avec ces animaux -> lot de recherche, retour sur l'écran
await p.click('#em-creer-lot');
eq(await p.evaluate(() => [currentView, DB.lots.find(l => l.id === 'auto-echo-a-passer').membres.map(e => numeroVisuel(e)).sort()]), ['lot-search', ['19004', '19008']], 'lot de recherche des brebis à passer');
await p.evaluate(() => btnBack.onclick());
eq(await p.evaluate(() => currentView), 'echographies', 'retour du lot : l\'écran Échographies');
await p.evaluate(() => { DB = JSON.parse(window.__avant); window.__saves = 0; render('echographies'); });

// 3. Passages et détail d'un passage
await p.click('#em-onglets [data-o="passages"]');
eq(await p.evaluate(() => [...document.querySelectorAll('#em-passages .carte-liste')].map(c => [c.querySelector('.carte-liste-nm').textContent, c.querySelector('.carte-liste-l2').textContent])),
  [['Passage du 28-11-2026', '3 passées · 2 pleines · 1 vide · réussite 67 %'], ['Passage du 15-10-2026', '5 passées · 3 pleines · 2 vides · réussite 60 %']], 'passages figés, le plus récent d\'abord (la vendue comptée)');
await p.click('#em-passages .carte-liste >> nth=0');
const PA = await p.evaluate(() => ({ vue: currentView, titre: pageTitle.textContent, vues: [...document.querySelectorAll('#em-vue .tab-btn')].map(b => b.textContent), brebis: [...document.querySelectorAll('#em-passage-brebis .carte-liste')].map(c => [c.querySelector('.carte-liste-nm').textContent, c.querySelector('.mb-pastille').textContent, c.querySelector('.em-gris').textContent]) }));
eq([PA.vue, PA.titre, PA.vues], ['passage-echo', 'Passage du 28-11-2026', ['Toutes 3', 'Repassées 2', '1re écho 1']], 'détail du passage');
check(PA.brebis.some(b => b[0] === 'n°19003' && b[1] === 'À mettre bas' && b[2] === 'Vide le 15-10-2026') && PA.brebis.some(b => b[0] === 'n°26010' && b[2] === '1re écho · antenaise'), 'brebis : devenir et écho précédente : ' + JSON.stringify(PA.brebis));
await p.click('#em-vue [data-v="premiere"]');
eq(await p.evaluate(() => document.querySelectorAll('#em-passage-brebis .carte-liste').length), 1, 'sous-onglet 1re écho');
await p.click('#em-passage-brebis .carte-liste');
eq(await p.evaluate(() => [currentView, detailOrigin]), ['detail', 'passage-echo'], 'toucher une brebis ouvre sa fiche');
await p.evaluate(() => btnBack.onclick());
eq(await p.evaluate(() => currentView), 'passage-echo', 'retour de la fiche : le passage');
await p.evaluate(() => btnBack.onclick());
eq(await p.evaluate(() => [currentView, document.querySelector('#em-onglets .active').dataset.o]), ['echographies', 'passages'], 'retour du passage : la liste des passages');

// 4. Historique, session
await p.click('#em-onglets [data-o="historique"]');
eq(await p.evaluate(() => document.querySelectorAll('#historique-echo-cartes .carte-liste').length), 8, 'historique : toutes les échos');
await p.click('#em-onglets [data-o="aujourdhui"]');
await p.click('#em-session');
eq(await p.evaluate(() => [currentView, !!document.getElementById('btn-start-echo-session')]), ['echo-rapide', true], '« Nouvelle session d\'écho » ouvre la saisie');
await p.evaluate(() => btnBack.onclick());
eq(await p.evaluate(() => currentView), 'echographies', 'retour de la saisie : l\'écran Échographies');
await p.evaluate(() => render('historique-echo'));
await p.evaluate(() => btnBack.onclick());
eq(await p.evaluate(() => [currentView, document.querySelector('#em-onglets .active').dataset.o]), ['echographies', 'historique'], 'retour de l\'ancien historique : onglet Historique');

// 5. campagne à venir : segmenté seulement quand elle porte des échos
await p.evaluate(() => { DB.brebis[6].echographies.push({ type: 'constat', date: '2026-12-01', stade: 'Pleine', campagne: 2027 }); echosMobEtat.campagne = null; echosMobEtat.onglet = 'aujourdhui'; render('echographies'); });
eq(await p.evaluate(() => [...document.querySelectorAll('#em-campagne .tab-btn')].map(b => [b.textContent, b.classList.contains('active')])), [['Campagne 2027', false], ['Campagne 2028 (à venir)', true]], 'campagne à venir avec échos : choisie d\'office, segmenté affiché');

await browser.close();
console.log('\nTOUS LES TESTS DE L\'ÉCRAN MOBILE « ÉCHOGRAPHIES » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
