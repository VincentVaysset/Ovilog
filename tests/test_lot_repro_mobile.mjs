/* Chantier de tri, partie g : MOBILE -- lots de reproduction. Plus de bouton « Nouveau lot de reproduction » (création sur PC seulement) ; carte d'un lot de
   reproduction : « Ouvrir » (détail) à la place de « Modifier », « Chercher en bergerie » conservé, pas de « Suppr. » ; lots de recherche et de réforme inchangés.
   Détail : mode / cible / campagne en lecture seule, compteur, ajout par bip ou saisie du n° (brebis ACTIVE, bip différencié « déjà dans le lot »), retrait avec
   confirmation et motif facultatif (refusé avec message si une mise bas est rattachée), historique tracé, brebis vendue/morte conservée, écart non tranché et
   garde-fou de version. saveData REMPLACÉ par un compteur ; jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
const alertes = [];
page.on('dialog', d => { if (d.type() === 'alert') alertes.push(d.message()); d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const jeu = () => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  window.__bips = { trouve: 0, deja: 0, rate: 0 };
  playBeepTrouve = () => { window.__bips.trouve++; }; playBeepDejaTrouve = () => { window.__bips.deja++; }; playBeepRate = () => { window.__bips.rate++; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  window.E = (d, n) => '2500162991' + d + String(n).padStart(4, '0');
  const f = (d, n, extra) => Object.assign({ id: 'b' + d + n, eid: E(d, n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  DB.brebis = [f(8, 133), f(9, 59, { agnelages: [{ campagne: 2027, date: '2027-11-10', codeRepro: 'IA', lambs: [{}] }] }), f(9, 69, { statut: 'vendue' }), f(9, 152), f(0, 33), f(9, 77, { statut: 'vendue' })];
  const lot = creerLotReproductionJournalise({ id: 'LR', nom: 'IA du 15-06-2027', mode: 'IA', cible: 'Brebis', dateCreation: '2026-10-02', dateEvenement: '2027-06-15', campagne: 2026, campagneMisesBas: 2027 }, [E(8, 133), E(9, 59), E(9, 69)], { source: 'PC' });
  DB.brebis.filter(b => [E(8, 133), E(9, 59), E(9, 69)].includes(b.eid)).forEach(b => b.modesRepro.push({ date: '2027-06-15', mode: 'IA', campagne: 2027, lotId: 'LR' }));
  creerLotReproductionJournalise({ id: 'LV', nom: 'Éponge vide', mode: 'EP', cible: 'Brebis', dateCreation: '2026-10-02', dateEvenement: '2027-06-28', datePose: '2027-06-12', campagne: 2026, campagneMisesBas: 2027 }, []);
  DB.lots.push({ id: 'LS', nom: 'Brebis doubles', dateCreation: '2026-10-01', membres: [E(9, 152)] });
  window.__avant = JSON.stringify(DB); currentLotId = 'LR'; render('lots');
});
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);
const ouvrir = async () => { await page.evaluate(() => { lotReproToast = null; currentLotId = 'LR'; render('lot-repro-detail'); }); await page.waitForSelector('#lr-scan'); };
const scanner = async v => { await page.fill('#lr-scan', v); await page.press('#lr-scan', 'Enter'); };

// ================================================================ 1. liste des lots (mobile)
await jeu();
const h = await page.evaluate(() => document.getElementById('app').textContent);
check(!/Nouveau lot de reproduction/.test(h) && await page.evaluate(() => !document.getElementById('btn-new-lot-repro')) && !!await page.evaluate(() => document.getElementById('btn-new-lot') && document.getElementById('btn-new-lot-reforme')), 'plus de « Nouveau lot de reproduction » ; « Nouveau lot » et « Nouveau lot de réforme » conservés');
const cartes = await page.evaluate(() => [...document.querySelectorAll('#app .card')].map(c => ({ nom: c.querySelector('div[style*="font-weight:600"]').textContent.trim(), ouvrir: !!c.querySelector('.btn-open-lot-repro'), modifier: !!c.querySelector('.btn-edit-lot'), suppr: !!c.querySelector('.btn-del-lot'), chercher: !!c.querySelector('.btn-search-lot') })));
const lr = cartes.find(c => c.nom.startsWith('IA du')), lv = cartes.find(c => c.nom.startsWith('Éponge vide')), ls = cartes.find(c => c.nom.startsWith('Brebis doubles'));
check(lr.ouvrir && !lr.modifier && !lr.suppr && lr.chercher, 'carte d\'un lot de reproduction : « Ouvrir » (pas de « Modifier »), pas de « Suppr. » (PC seulement), « Chercher en bergerie » conservé : ' + JSON.stringify(lr));
check(lv.ouvrir && !lv.chercher && !lv.suppr, 'lot de reproduction vide : pas de « Chercher en bergerie »');
check(ls.modifier && ls.suppr && ls.chercher && !ls.ouvrir, 'lot de recherche : Modifier, Suppr., Chercher en bergerie inchangés');
check(await page.evaluate(() => { render('add-lot-repro'); return currentView === 'lots' || document.getElementById('btn-new-lot') !== null; }), 'l\'ancienne route de création renvoie à la liste');
console.log('OK 1 liste mobile : bouton de création supprimé, « Ouvrir » / « Chercher en bergerie » sur un lot de reproduction, pas de « Suppr. », recherche et réforme inchangés.');

// ================================================================ 2. détail du lot
await ouvrir();
check(await page.evaluate(() => document.getElementById('page-title').textContent) === 'Lot IA du 15-06-2027', 'titre : « Lot IA du 15-06-2027 »');
const det = await $t('#app');
check(/IA · Brebis/.test(det) && /IA le 15-06-2027 · mises bas campagne 2028/.test(det) && /3 brebis/.test(await $t('#lr-compteur')), 'carte : mode, cible, date, campagne des mises bas (lecture seule), compteur : ' + det.slice(0, 120));
check(await page.evaluate(() => document.querySelectorAll('#app input:not(#lr-scan)').length) === 0, 'aucun champ modifiable : mode, cible, campagne en lecture seule');
const lignes = await page.evaluate(() => [...document.querySelectorAll('#app .card[data-eid]')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
check(lignes.length === 3 && lignes[0].startsWith('n°80133') && lignes[1].startsWith('n°90059') && /n°90069.*vendue — reste dans le lot \(hors taux\)/.test(lignes[2]), 'liste : âge décroissant puis n° ; la brebis vendue reste dans le lot, signalée : ' + JSON.stringify(lignes));
check(/lot existant repris|affectées|n°80133 ajoutée/.test(await $t('#lr-histo')) || /3 brebis/.test(await $t('#lr-histo')), 'historique : création tracée : ' + await $t('#lr-histo'));
console.log('OK 2 détail : titre, carte (lecture seule), liste triée, vendue conservée, historique.');

// ================================================================ 3. ajout par bip / saisie du n°
await ouvrir();
await scanner(await page.evaluate(() => E(9, 152)));
const ad = await page.evaluate(() => { const l = DB.lots.find(x => x.id === 'LR'); const ev = DB.evenementsLots[DB.evenementsLots.length - 1]; const b = DB.brebis.find(x => x.eid === E(9, 152)); return { membres: l.membres.length, type: ev.type, src: ev.source, eids: ev.eids.length, mr: b.modesRepro.map(m => [m.mode, m.date, m.campagne, m.lotId]), saves: window.__saves, bips: window.__bips }; });
check(ad.membres === 4 && ad.type === 'affectation' && ad.src === 'mobile' && ad.eids === 1 && JSON.stringify(ad.mr) === '[["IA","2027-06-15",2027,"LR"]]' && ad.saves === 1 && ad.bips.trouve === 1, 'brebis active ajoutée : événement (source mobile), modesRepro, une écriture, bip « trouvé » : ' + JSON.stringify(ad));
check(/n°90152 ajoutée au lot · 4 brebis/.test(await $t('#lr-toast')) && /4 brebis/.test(await $t('#lr-compteur')) && /ajoutée aujourd'hui/.test(await $t('#app .card[data-eid="' + await page.evaluate(() => E(9, 152)) + '"]')), 'toast « n°90152 ajoutée au lot · 4 brebis », compteur, « ajoutée aujourd\'hui »');
check(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'lr-scan', 'champ de scan focalisé pour la suivante');
await scanner(await page.evaluate(() => E(9, 152)));
const dj = await page.evaluate(() => ({ n: DB.lots.find(x => x.id === 'LR').membres.length, ev: DB.evenementsLots.length, bips: window.__bips }));
check(dj.n === 4 && dj.ev === 2 && dj.bips.deja === 1 && /n°90152 est déjà dans le lot/.test(await $t('#lr-toast')), 'brebis déjà dans le lot : rien d\'ajouté, bip différencié, message : ' + JSON.stringify(dj));
await scanner('90077');
check(await page.evaluate(() => DB.lots.find(x => x.id === 'LR').membres.length) === 4 && /n°90077 n'est pas active \(vendue\)/.test(await $t('#lr-err')) && await page.evaluate(() => window.__bips.rate) === 1, 'brebis vendue : refusée avec message (seules les actives), bip « raté »');
await scanner('99999');
check(/Aucune brebis active correspondante/.test(await $t('#lr-err')), 'n° inconnu : message');
await scanner('00033');
check(await page.evaluate(() => DB.lots.find(x => x.id === 'LR').membres.length) === 5, 'saisie du n° court (00033) : ajoutée');
console.log('OK 3 ajout : bip et saisie du n°, brebis active seulement, bip différencié « déjà dans le lot », messages, journal source mobile.');

// ================================================================ 4. retrait : confirmation, motif facultatif, refus si mise bas rattachée
await ouvrir();
await page.click('.btn-retirer-lot[data-eid="' + await page.evaluate(() => E(9, 152)) + '"]');
check(/Retirer n°90152 du lot \?/.test(await $t('.modal-card')) && /Motif \(facultatif\)/.test(await $t('.modal-card')), 'retrait : fenêtre de confirmation avec motif facultatif');
const n0 = await page.evaluate(() => DB.lots.find(x => x.id === 'LR').membres.length);
await page.click('#retrait-annuler');
check(await page.evaluate(() => !document.querySelector('.modal-card')) && await page.evaluate(() => DB.lots.find(x => x.id === 'LR').membres.length) === n0, 'Annuler : rien n\'est retiré');
await page.click('.btn-retirer-lot[data-eid="' + await page.evaluate(() => E(9, 152)) + '"]'); await page.click('.motif-retrait[data-val="Malade"]'); await page.click('#retrait-confirm');
const rt = await page.evaluate(() => { const ev = DB.evenementsLots[DB.evenementsLots.length - 1]; return { n: DB.lots.find(x => x.id === 'LR').membres.length, type: ev.type, motif: ev.motif, src: ev.source, mr: DB.brebis.find(x => x.eid === E(9, 152)).modesRepro.length }; });
check(rt.n === n0 - 1 && rt.type === 'retrait' && rt.motif === 'Malade' && rt.src === 'mobile' && rt.mr === 0, 'retrait confirmé avec motif « Malade » : événement tracé, modesRepro retiré : ' + JSON.stringify(rt));
check(/n°90152 retirée du lot/.test(await $t('#lr-toast')) && /retirée · malade/.test(await $t('#lr-histo')), 'toast et historique : « n°90152 retirée · malade »');
await page.click('.btn-retirer-lot[data-eid="' + await page.evaluate(() => E(0, 33)) + '"]'); await page.click('#retrait-confirm');
check(await page.evaluate(() => DB.evenementsLots[DB.evenementsLots.length - 1].motif) === null, 'motif facultatif : sans choix, aucun motif');
const avantRefus = await page.evaluate(() => JSON.stringify(DB.lots.find(x => x.id === 'LR').membres));
await page.click('.btn-retirer-lot[data-eid="' + await page.evaluate(() => E(9, 59)) + '"]'); await page.click('#retrait-confirm');
check(/Retrait impossible pour n°90059 : une mise bas lui est déjà rattachée dans ce lot/.test(await $t('#lr-toast')) && await page.evaluate(a => JSON.stringify(DB.lots.find(x => x.id === 'LR').membres) === a, avantRefus), 'retrait REFUSÉ avec message si une mise bas est rattachée, rien corrigé');
console.log('OK 4 retrait : confirmation, motif facultatif, refus avec message si mise bas rattachée, journal et modesRepro cohérents.');

// ================================================================ 5. écart non tranché, garde-fou de version
await jeu(); await ouvrir();
await page.evaluate(() => { DB.lots.find(x => x.id === 'LR').membres.push('250016299190999'); });
await scanner(await page.evaluate(() => E(9, 152)));
check(/écart non tranché/.test(await $t('#lr-toast')) && await page.evaluate(() => DB.evenementsLots.length) === 1, 'écart non tranché : rien n\'est ajouté, message (à trancher sur PC)');
await jeu(); await ouvrir();
await page.evaluate(() => { DB.schemaLots = 3; });
await scanner(await page.evaluate(() => E(9, 152)));
check(alertes.some(m => /Mettre à jour l'application/.test(m)) && await page.evaluate(() => DB.evenementsLots.length) === 1, 'format de lots plus récent : « Mettre à jour l\'application », lot non modifié');
console.log('OK 5 écart non tranché et garde-fou de version : rien n\'est écrit.');

// ================================================================ 6. cible Agnelles
await jeu();
await page.evaluate(() => {
  DB.agnelles = [{ id: 'ag1', eid: E(5, 41), origine: 'née', dateEntree: '2026-09-01', mouvements: [], sanitaire: [], modesRepro: [] }, { id: 'ag2', eid: E(5, 42), origine: 'achetée', dateEntree: '2026-09-10', mouvements: [], sanitaire: [], modesRepro: [] }];
  creerLotReproductionJournalise({ id: 'LA', nom: 'Éponge antenaises', mode: 'EP', cible: 'Agnelles', dateCreation: '2026-10-02', dateEvenement: '2027-06-28', datePose: '2027-06-12', campagne: 2026, campagneMisesBas: 2027 }, [E(5, 41)]);
  currentLotId = 'LA'; render('lot-repro-detail');
});
check(/Éponge · Agnelles/.test(await $t('#app')) && /Pose le 12-06-2027 · lutte le 28-06-2027/.test(await $t('#app')) && /1 antenaise/.test(await $t('#lr-compteur')), 'lot Éponge cible Agnelles : pose et lutte, compteur en antenaises');
await scanner('50042');
check(await page.evaluate(() => DB.lots.find(x => x.id === 'LA').membres.length) === 2 && await page.evaluate(() => DB.agnelles[1].modesRepro.length) === 1, 'ajout d\'une antenaise par n° : membre + évènement modesRepro sur l\'agnelle');
console.log('OK 6 lot cible Agnelles : pose / lutte, antenaises, ajout par n°.');

await browser.close();
console.log('\nTOUS LES TESTS DES LOTS DE REPRODUCTION SUR MOBILE SONT PASSÉS');
