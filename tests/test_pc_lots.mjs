/* Page PC « Chantier de tri » > Lots (chantier de tri, partie b) : étape 1 (créer le lot, VIDE), étape 2 (4 onglets de critères avec leurs filtres et colonnes,
   sélection conservée d'un onglet à l'autre, filtres rapides qui ne cochent rien, Affecter qui AJOUTE avec confirmation, panneau du lot, Retirer avec
   confirmation et refus si mise bas rattachée), lots cible Agnelles, exports Excel, écarts de classe entre sources. saveData REMPLACÉ par un compteur ;
   jeu synthétique ; l'export réel, s'il est présent, est chargé en LECTURE SEULE (section finale). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_CORRIGE, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1800 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponse = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

const jeu = () => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  window.E = (d, n) => '2500162991' + d + String(n).padStart(4, '0');
  const f = (d, n, extra) => Object.assign({ id: 'b' + d + n, eid: E(d, n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  const ctr = (n, q, an) => ({ controle: n, campagne: 2025, date: '2026-0' + (n + 1) + '-10', quantite: q, anomalie: an || null });
  const mb = (campagne, date, code) => ({ campagne, date, codeRepro: code, lambs: [{ sexe: 'Femelle' }] });
  DB.brebis = [
    f(8, 133, { agnelages: [mb(2025, '2026-02-15', 'IA')], controleLaitier: [ctr(1, 1400), ctr(2, 1500, '3'), ctr(3, 1300)] }),            // A
    f(9, 59, { agnelages: [mb(2025, '2026-01-10', 'MN')] }),                                                                               // B
    f(9, 69, { videesDefinitives: [{ campagne: 2026 }] }),                                                                                  // C
    f(9, 152, { controleLaitier: [ctr(1, 900, '1')] }),                                                                                     // D
    f(0, 33, { agnelages: [mb(2025, '2026-03-20', 'IA')] }),                                                                                // E
    f(7, 5, {}),                                                                                                                            // F
    f(9, 77, { statut: 'vendue' })                                                                                                          // G (pas proposée)
  ];
  DB.lactationModele = [
    { eid: E(8, 133), campagne: 2025, lactationTotale: 452, classeParQuart: '1' }, { eid: E(9, 59), campagne: 2025, lactationTotale: 389.6, classeParQuart: '2' },
    { eid: E(9, 69), campagne: 2025, lactationTotale: 300, classeParQuart: '0' }, { eid: E(0, 33), campagne: 2025, lactationTotale: 331, classeParQuart: '3' }];
  DB.bilanLactation = [{ eid: E(8, 133), campagne: 2025, lactTotale: 452, classeParQuart: 2 }, { eid: E(9, 152), campagne: 2025, lactTotale: 250, classeParQuart: 4 }];
  DB.agnelles = [{ id: 'ag1', eid: E(5, 41), origine: 'née', motherEid: E(8, 133), dateEntree: '2026-09-01', mouvements: [], sanitaire: [] }, { id: 'ag2', eid: E(5, 42), origine: 'achetée', dateEntree: '2026-09-10', mouvements: [], sanitaire: [] }];
  DB.lots = [{ id: 'LX', nom: 'Brebis doubles', dateCreation: '2026-10-01', membres: [E(9, 69)] }];
  DB.evenementsLots = [];
  lotsPcEtat = null; window.__avant = JSON.stringify(DB);
  render('lots');
});
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);
const lignes = () => page.evaluate(() => [...document.querySelectorAll('#lt-table tr[data-eid]')].map(r => [...r.children].slice(1, -1).map(c => c.textContent.replace(/\s+/g, ' ').trim()).join('|')));
const nums = () => page.evaluate(() => [...document.querySelectorAll('#lt-table tr[data-eid]')].map(r => r.children[1].textContent.trim()));
const ouvrirOnglet = async v => { await page.click(`#lt-onglets .opt-btn[data-val="${v}"]`); };
const creerLot = async (type, extra) => {
  await page.click(`#lt-type .opt-btn[data-val="${type}"]`);
  if (extra) await extra();
  await page.click('#lt-creer'); await page.waitForSelector('#lt-table');
};

// ================================================================ 1. étape 1 : formulaire, valeurs par défaut, lot créé VIDE
await jeu();
check(await page.evaluate(() => !!document.getElementById('pc-lots')) && /Lots/.test(await $t('.pc-seg2')) && /Tri des agnelles/.test(await $t('.pc-seg2')), 'page à 2 onglets : Lots et Tri des agnelles');
check(!/Créer une liste/.test(await $t('#pc-lots')), 'pas d\'onglet « Créer une liste » sur PC');
const f1 = await page.evaluate(() => ({ type: document.querySelector('#lt-type .selected').dataset.val, cible: document.querySelector('#lt-cible .selected').dataset.val, mode: document.querySelector('#lt-mode .selected').dataset.val, camp: document.querySelector('#lt-campagne .selected').dataset.val, nom: document.getElementById('lt-nom').value, date: document.getElementById('lt-date').value, camps: [...document.querySelectorAll('#lt-campagne .opt-btn')].map(b => b.textContent) }));
check(f1.type === 'reproduction' && f1.cible === 'Brebis' && f1.mode === 'IA' && f1.camp === 'avenir' && f1.nom === 'IA du 03-10-2026' && f1.date === '2026-10-03', 'défauts : reproduction / Brebis / IA / campagne à venir / « IA du 03-10-2026 » : ' + JSON.stringify(f1));
check(f1.camps.join() === '2027 · en cours,2028 · à venir', 'campagnes des mises bas affichées : 2027 en cours, 2028 à venir : ' + f1.camps.join());
await page.fill('#lt-date', '2027-06-15'); await page.dispatchEvent('#lt-date', 'change');
check(await page.evaluate(() => document.getElementById('lt-nom').value) === 'IA du 15-06-2027', 'le nom par défaut suit la date');
await page.click('#lt-creer'); await page.waitForSelector('#lt-table');
const l1 = await page.evaluate(() => { const l = DB.lots[DB.lots.length - 1]; return { type: l.type, mode: l.mode, cible: l.cible, nom: l.nom, journal: l.journal, membres: l.membres.length, date: l.dateEvenement, cmb: l.campagneMisesBas, camp: l.campagne, events: DB.evenementsLots.length, saves: window.__saves, mr: DB.brebis.reduce((n, s) => n + s.modesRepro.length, 0) }; });
check(l1.type === 'reproduction' && l1.mode === 'IA' && l1.cible === 'Brebis' && l1.nom === 'IA du 15-06-2027' && l1.journal === 1 && l1.membres === 0 && l1.date === '2027-06-15' && l1.cmb === 2027 && l1.camp === 2026 && l1.events === 0 && l1.saves === 1 && l1.mr === 0, 'lot de reproduction créé VIDE (journalisé, campagne des mises bas 2027 stockée = « 2028 », aucun évènement, aucun modesRepro) : ' + JSON.stringify(l1));
check(/Étape 2/.test(await $t('#pc-lots')) && /0 brebis/.test(await $t('#lt-nb-membres')), 'on passe à l\'étape 2, lot vide');
console.log('OK 1 étape 1 : deux onglets, défauts, nom par défaut, campagne à venir, lot de reproduction créé vide et journalisé.');

// ================================================================ 2. éponge, recherche, réforme
await jeu();
await page.click('#lt-type .opt-btn[data-val="reproduction"]'); await page.click('#lt-mode .opt-btn[data-val="EP"]'); await page.click('#lt-campagne .opt-btn[data-val="encours"]');
check(/Date de pose/.test(await $t('label[for="lt-date"]')) && await page.evaluate(() => document.getElementById('lt-nom').value) === 'Éponge du 03-10-2026', 'éponge : « Date de pose », nom « Éponge du … »');
await page.fill('#lt-date', '2026-10-10'); await page.dispatchEvent('#lt-date', 'change');
await page.click('#lt-creer'); await page.waitForSelector('#lt-table');
const ep = await page.evaluate(() => { const l = DB.lots[DB.lots.length - 1]; return [l.mode, l.datePose, l.dateEvenement, l.campagneMisesBas]; });
check(JSON.stringify(ep) === '["EP","2026-10-10","2026-10-26",2026]', 'éponge : pose conservée, lutte = pose + 16 j, campagne des mises bas en cours (2026 stocké) : ' + JSON.stringify(ep));
await jeu();
await page.click('#lt-type .opt-btn[data-val="recherche"]');
check(!await page.evaluate(() => !!document.getElementById('lt-cible')), 'recherche : ni cible, ni mode, ni campagne');
await page.fill('#lt-nom', 'Brebis à voir'); await page.click('#lt-creer'); await page.waitForSelector('#lt-table');
const rch = await page.evaluate(() => { const l = DB.lots[DB.lots.length - 1]; return [l.type === undefined, l.nom, l.membres.length, l.dateCreation, l.journal]; });
check(rch[0] && rch[1] === 'Brebis à voir' && rch[2] === 0 && rch[3] === '2026-10-03' && rch[4] === undefined, 'lot de recherche créé vide, sans journal : ' + JSON.stringify(rch));
await jeu();
await page.click('#lt-type .opt-btn[data-val="reforme"]');
check(await $t('#lt-creer') === 'Créer le lot de réforme' && await page.evaluate(() => document.getElementById('lt-nom').value) === 'Réforme du 03-10-2026' && !await page.evaluate(() => !!document.getElementById('lt-date')), 'réforme : bouton rouge « Créer le lot de réforme », nom « Réforme du … », pas de date');
await page.click('#lt-creer'); await page.waitForSelector('#lt-table');
check(await page.evaluate(() => { const l = DB.lots[DB.lots.length - 1]; return l.type === 'reforme' && l.membres.length === 0; }), 'lot de réforme créé vide');
await jeu(); await page.fill('#lt-nom', ''); await page.click('#lt-creer');
check(/Donne un nom au lot/.test(await $t('#lt-erreurs')) && await page.evaluate(() => DB.lots.length) === 1, 'nom obligatoire, rien créé');
console.log('OK 2 éponge (pose + 16 j), recherche, réforme, validation du nom : lots créés vides.');

// ================================================================ 3. étape 2 : onglet Mises bas, colonnes, tri, filtres, raccourci
await jeu(); await creerLot('reproduction', async () => { await page.fill('#lt-date', '2027-06-15'); await page.dispatchEvent('#lt-date', 'change'); });
check(await $t('#lt-compte') === '6 brebis correspondent · 0 sélectionnée sur cet onglet', 'comptage (6 actives, la vendue n\'est pas proposée) : ' + await $t('#lt-compte'));
const n0 = await nums();
check(JSON.stringify(n0) === JSON.stringify(['70005', '80133', '90059', '90069', '90152', '00033']), 'tri : âge décroissant puis n° croissant (2017, 2018, 2019×3, 2020) : ' + n0.join());
const ent = await page.evaluate(() => [...document.querySelectorAll('#lt-table th')].map(x => x.textContent.replace(/[▲▼]/g, '').trim()).join('|'));
check(ent === '|N°|Millésime · âge|Statut de reproduction|Dernière mise bas|Délai mise bas → IA|Lots', 'colonnes de l\'onglet Mises bas : ' + ent);
const l0 = await lignes();
check(l0[1] === '80133|2018 · 8 ans|Aucune info repro|15-02-2026|16 mois', 'A : dernière mise bas 15-02-2026 (campagne précédente), délai mise bas → IA 16 mois : ' + l0[1]);
check(l0[0].endsWith('|-|-') && l0[3].includes('Vide définitive'), 'F sans mise bas : « - » ; C : Vide définitive');
await page.click('#lt-mb-mode .opt-btn[data-val="avant"]'); await page.fill('#lt-mb-du', '2026-02-01'); await page.dispatchEvent('#lt-mb-du', 'change');
check((await nums()).join() === '90059' && /Dernière mise bas avant le 01-02-2026/.test(await $t('#lt-tags')), 'filtre « Avant le 01/02/2026 » : B seule (les sans mise bas ne comptent pas) + étiquette');
await page.click('#lt-mb-mode .opt-btn[data-val="entre"]'); await page.fill('#lt-mb-du', '2026-02-01'); await page.dispatchEvent('#lt-mb-du', 'change'); await page.fill('#lt-mb-au', '2026-03-31'); await page.dispatchEvent('#lt-mb-au', 'change');
check((await nums()).join() === '80133,00033', 'filtre « Entre le 01/02 et le 31/03/2026 » : A et E');
await page.click('#lt-mb-mode .opt-btn[data-val="aucune"]');
check((await nums()).join() === '70005,90069,90152', 'filtre « Aucune » : F, C, D (aucune mise bas)');
await page.click('#lt-tags .lt-tag');
check((await nums()).length === 6, 'étiquette supprimable : le filtre disparaît');
await page.click('#lt-mb-raccourci');
const rac = await page.evaluate(() => [lotsPcEtat.F.mbMode, lotsPcEtat.F.mbDu]);
check(JSON.stringify(rac) === '["avant","2027-03-15"]', 'raccourci « 3 mois avant l\'IA » : avant le 15/03/2027 (IA du 15/06/2027 − 3 mois) : ' + JSON.stringify(rac));
await page.click('#lt-reinit');
check((await nums()).length === 6 && await page.evaluate(() => lotsPcEtat.F.mbMode === ''), 'Réinitialiser');
await page.click('.lt-th[data-col="delaiMB"]');
check(JSON.stringify(await nums()) === JSON.stringify(['00033', '80133', '90059', '70005', '90069', '90152']), 'tri par colonne (délai croissant) : E 14, A 16, B 17 puis les « - » toujours en bas, dans l\'ordre âge / n° : ' + (await nums()).join());
await page.click('.lt-th[data-col="delaiMB"]');
check((await nums()).slice(0, 3).join() === '90059,80133,00033' && (await nums()).slice(3).join() === '70005,90069,90152', 'tri décroissant : les « - » restent en bas : ' + (await nums()).join());
console.log('OK 3 onglet Mises bas : colonnes, tri âge puis n°, avant / entre / aucune, étiquettes supprimables, raccourci 3 mois avant l\'IA, tri par colonne avec « - » en bas.');

// ================================================================ 4. onglets Contrôles, Lactations, Réussite IA
await jeu(); await creerLot('reproduction');
await ouvrirOnglet('controles');
const optC = await page.evaluate(() => document.querySelector('#lt-ctrl-campagne option').textContent);
check(/Dernière avec contrôles \(2026\)/.test(optC), 'contrôles : campagne par défaut = la dernière qui en a (affichée 2026) : ' + optC);
const lc = await lignes();
check(lc.find(l => l.startsWith('80133')) === '80133|2018 · 8 ans|1400|—|1500|3|1300|—', 'A : lait C1 1400, C2 1500 anomalie 3, C3 1300 (mL) : ' + lc.find(l => l.startsWith('80133')));
check(lc.find(l => l.startsWith('90059')).endsWith('|-|-|-|-|-|-'), 'B sans contrôle : « - » partout');
await page.selectOption('#lt-an2', '3'); check((await nums()).join() === '80133', 'filtre anomalie C2 = code 3 : A');
await page.selectOption('#lt-an2', '');
await page.check('#lt-anomalie-any'); check((await nums()).join() === '80133,90152', '« Au moins une anomalie » : A et D');
await page.uncheck('#lt-anomalie-any');
await page.fill('#lt-lait1-min', '1000'); await page.dispatchEvent('#lt-lait1-min', 'change'); await page.fill('#lt-lait1-max', '1450'); await page.dispatchEvent('#lt-lait1-max', 'change');
check((await nums()).join() === '80133', 'lait C1 entre 1000 et 1450 mL : A seule (D = 900 exclue, sans contrôle exclues)');
await page.click('#lt-reinit');
await ouvrirOnglet('lactations');
const ll = await lignes();
check(ll.find(l => l.startsWith('80133')).startsWith('80133|452,0 L|1|') && ll.find(l => l.startsWith('90059')).startsWith('90059|389,6 L|2|') && ll.find(l => l.startsWith('90069')).startsWith('90069|300,0 L|-|') && ll.find(l => l.startsWith('90152')).startsWith('90152|-|-|'), 'lactation N-1 (L) et classe 1 à 4 ; classe « 0 » → « - » ; sans donnée → « - » : ' + ll.join(' ; '));
await page.click('.lt-classe[data-c="1"]'); await page.click('.lt-classe[data-c="2"]');
check((await nums()).join() === '80133,90059', 'filtre classe 1 ou 2 : A et B');
await page.click('#lt-reinit');
await page.fill('#lt-lact-min', '320'); await page.dispatchEvent('#lt-lact-min', 'change');
check((await nums()).join() === '80133,90059,00033', 'lactation ≥ 320 L : A, B, E (les « - » exclues)');
await page.click('#lt-reinit');
await ouvrirOnglet('ia');
const li = await lignes();
check(li.find(l => l.startsWith('00033')).includes('✓') && li.find(l => l.startsWith('90059')).includes('–'), 'réussite IA : E prise en 2026 (✓) ; B (MN, aucun lot) = pas en IA (–) : ' + li.join(' ; '));
const entIA = await page.evaluate(() => [...document.querySelectorAll('#lt-table th')].map(x => x.textContent.replace(/[▲▼]/g, '').trim()).join('|'));
check(/IA 2026\|IA 2027\|IA 2028\|2 échecs de suite/.test(entIA), 'colonnes par campagne des mises bas (2026, 2027, 2028) : ' + entIA);
await page.selectOption('#lt-ia-2025', 'prise');
check((await nums()).join() === '80133,00033', 'filtre IA 2026 = prise : A et E');
await page.click('#lt-reinit');
console.log('OK 4 onglets Contrôles (campagne, anomalie, lait mL), Lactations et classes (L, classe 1-4, « - »), Réussite à l\'IA (résultat par campagne, filtre).');

// ================================================================ 5. sélection conservée, Tout cocher sur le filtré, Affecter (confirmation) qui AJOUTE
await jeu(); await creerLot('reproduction', async () => { await page.fill('#lt-date', '2027-06-15'); await page.dispatchEvent('#lt-date', 'change'); });
await ouvrirOnglet('lactations'); await page.click('.lt-classe[data-c="1"]'); await page.click('.lt-classe[data-c="2"]');
await page.click('#lt-tout');
check(/2 brebis correspondent · 2 sélectionnées/.test(await $t('#lt-compte')) && /Affecter 2 brebis au lot/.test(await $t('#lt-affecter')), 'Tout cocher : seulement le résultat filtré (classes 1-2) : ' + await $t('#lt-compte'));
await ouvrirOnglet('controles');
check(/Affecter 2 brebis au lot/.test(await $t('#lt-affecter')) && await page.evaluate(() => document.querySelectorAll('#lt-table tr.sel').length) === 2, 'la sélection est CONSERVÉE en changeant d\'onglet');
await page.click('#lt-table tr.clic >> nth=3');
check(/Affecter 3 brebis/.test(await $t('#lt-affecter')), 'clic sur une ligne : cochée');
await page.click('#lt-rien'); check(/Affecter 0 brebis/.test(await $t('#lt-affecter')) && await page.evaluate(() => document.getElementById('lt-affecter').disabled), 'Tout décocher');
check(await page.evaluate(() => window.__saves === 1 && DB.evenementsLots.length === 0), 'rien d\'écrit tant qu\'on n\'a pas affecté');
await ouvrirOnglet('lactations'); await page.click('#lt-tout');
reponse = false; confirms.length = 0; const sv = await page.evaluate(() => window.__saves);
await page.click('#lt-affecter');
check(confirms.length === 1 && /Affecter 2 brebis au lot « IA du 15-06-2027 »/.test(confirms[0]) && /AJOUTE au lot/.test(confirms[0]) && await page.evaluate(s => window.__saves === s && DB.evenementsLots.length === 0, sv), 'confirmation avant écriture ; refus = rien n\'est écrit');
reponse = true;
await page.click('#lt-affecter');
const af = await page.evaluate(() => { const l = DB.lots[DB.lots.length - 1]; return { membres: l.membres.length, ev: DB.evenementsLots.length, eids: DB.evenementsLots[0].eids.length, type: DB.evenementsLots[0].type, src: DB.evenementsLots[0].source, mr: DB.brebis.filter(s => s.modesRepro.length).map(s => [s.modesRepro[0].mode, s.modesRepro[0].date, s.modesRepro[0].campagne, s.modesRepro[0].lotId === l.id]) }; });
check(af.membres === 2 && af.ev === 1 && af.eids === 2 && af.type === 'affectation' && af.src === 'PC', 'affectation groupée : 1 événement (eids[] de 2), source PC : ' + JSON.stringify(af));
check(JSON.stringify(af.mr) === '[["IA","2027-06-15",2027,true],["IA","2027-06-15",2027,true]]', 'modesRepro écrit sur chaque brebis (IA, date du lot, campagne des mises bas, lotId) : ' + JSON.stringify(af.mr));
check(/2 brebis/.test(await $t('#lt-nb-membres')) && /Affecter 0/.test(await $t('#lt-affecter')), 'panneau du lot mis à jour, sélection vidée');
const dl = await page.evaluate(() => [...document.querySelectorAll('#lt-table tr')].filter(r => /dans ce lot/.test(r.textContent)).length);
check(dl === 2, 'les brebis déjà dans le lot sont signalées « dans ce lot » : ' + dl);
await page.click('#lt-reinit'); await page.click('#lt-tout');
check(/Affecter 4 brebis/.test(await $t('#lt-affecter')), 'Tout cocher n\'inclut pas les brebis déjà dans le lot (6 actives − 2 déjà dedans = 4) : ' + await $t('#lt-affecter'));
await page.click('#lt-affecter');
check(await page.evaluate(() => DB.lots[DB.lots.length - 1].membres.length) === 6 && await page.evaluate(() => DB.evenementsLots.length) === 2, 'une 2e affectation AJOUTE (6 brebis, 2 événements), sans rien retirer');
console.log('OK 5 sélection conservée entre onglets, Tout cocher sur le filtré, Affecter avec confirmation (1 événement groupé + modesRepro), « dans ce lot », ajout sans retrait.');

// ================================================================ 6. Retirer (confirmation, refus si mise bas rattachée)
await page.evaluate(() => { const l = DB.lots[DB.lots.length - 1]; const a = DB.brebis.find(s => s.eid === E(0, 33)); a.agnelages.push({ campagne: 2027, date: '2027-11-10', codeRepro: 'IA', lambs: [{}] }); });  // mise bas dans la fenêtre 144-152 j du lot du 15/06/2027
reponse = false; confirms.length = 0;
await page.click('.lt-retirer[data-eid="' + await page.evaluate(() => E(9, 59)) + '"]');
check(confirms.length === 1 && /Retirer n°90059 du lot/.test(confirms[0]) && await page.evaluate(() => DB.lots[DB.lots.length - 1].membres.length) === 6, 'Retirer demande confirmation ; refus = rien');
reponse = true;
await page.click('.lt-retirer[data-eid="' + await page.evaluate(() => E(0, 33)) + '"]');
check(/Retrait impossible : une mise bas est déjà rattachée à n°00033 dans ce lot/.test(await $t('#lt-msg-panneau')) && await page.evaluate(() => DB.lots[DB.lots.length - 1].membres.length) === 6, 'retrait refusé AVEC MESSAGE si une mise bas est rattachée (n°00033), rien corrigé');
await page.click('.lt-retirer[data-eid="' + await page.evaluate(() => E(9, 59)) + '"]');
const rt = await page.evaluate(() => { const l = DB.lots[DB.lots.length - 1], b = DB.brebis.find(s => s.eid === E(9, 59)); return { membres: l.membres.length, dernier: DB.evenementsLots[DB.evenementsLots.length - 1].type, mr: b.modesRepro.length }; });
check(rt.membres === 5 && rt.dernier === 'retrait' && rt.mr === 0, 'retrait accepté : événement « retrait », évènement modesRepro retiré : ' + JSON.stringify(rt));
console.log('OK 6 Retirer : confirmation, refus avec message si mise bas rattachée, journal et modesRepro cohérents.');

// ================================================================ 7. filtres rapides : règlent des filtres, ne cochent JAMAIS
await jeu(); await creerLot('reproduction', async () => { await page.fill('#lt-date', '2027-06-15'); await page.dispatchEvent('#lt-date', 'change'); });
await page.click('#lt-rapide-ia');
const qi = await page.evaluate(() => [lotsPcEtat.selection.size, lotsPcEtat.F.sansDeuxEchecs, lotsPcEtat.F.mbMode, lotsPcEtat.F.mbDu, lotsPcEtat.onglet]);
check(JSON.stringify(qi) === '[0,true,"avant","2027-03-15","misesbas"]', 'Critères IA : règle les filtres (pas 2 échecs de suite, mise bas avant IA − seuil), 0 case cochée : ' + JSON.stringify(qi));
await page.click('#lt-rapide-reforme');
const qr = await page.evaluate(() => [lotsPcEtat.selection.size, lotsPcEtat.F.anomalieAny, lotsPcEtat.onglet]);
check(JSON.stringify(qr) === '[0,true,"controles"]' && (await nums()).join() === '80133,90152', 'Critères réforme : règle « au moins une anomalie » sur l\'onglet Contrôles, 0 case cochée, filtres modifiables : ' + JSON.stringify(qr));
console.log('OK 7 filtres rapides : règlent des filtres, ne cochent aucune brebis.');

// ================================================================ 8. exports Excel
await page.evaluate(() => { window.__xl = []; buildXlsxWorkbook = async (f) => { window.__xl.push(f); return new Uint8Array([1]); }; saveOrShareBinaryFile = async (nom) => { window.__xlNom = nom; }; });
await page.click('#lt-reinit'); await page.click('#lt-tout'); await page.click('#lt-export-sel'); await page.waitForTimeout(100);
const xs = await page.evaluate(() => ({ nom: window.__xlNom, f: window.__xl[0][0] }));
check(/^selection-lot_2026-10-03\.xlsx$/.test(xs.nom) && xs.f.rows.length === 7 && xs.f.rows[0].join() === 'N°,Millésime,Âge,Statut de reproduction,Lots', 'Exporter la sélection (.xlsx) : 6 brebis + en-têtes : ' + xs.nom + ' ' + xs.f.rows.length);
await page.click('#lt-affecter'); await page.waitForTimeout(100); await page.click('#lt-export-lot'); await page.waitForTimeout(100);
const xl = await page.evaluate(() => ({ nom: window.__xlNom, f: window.__xl[window.__xl.length - 1][0] }));
check(/^lot-IA_du_15-06-2027_2026-10-03\.xlsx$/.test(xl.nom) && xl.f.rows.length === 7, 'Exporter (.xlsx) du lot : ' + xl.nom + ' ' + xl.f.rows.length);
console.log('OK 8 exports Excel : sélection en cours et lot.');

// ================================================================ 9. lot cible Agnelles
await jeu();
await page.click('#lt-cible .opt-btn[data-val="Agnelles"]'); await page.click('#lt-creer'); await page.waitForSelector('#lt-table');
check(!await page.evaluate(() => !!document.getElementById('lt-onglets')) && /Étape 2 — Affecter des agnelles/.test(await $t('#pc-lots')), 'cible Agnelles : une seule liste, sans les 4 onglets');
const ea = await page.evaluate(() => [...document.querySelectorAll('#lt-table th')].map(x => x.textContent.replace(/[▲▼]/g, '').trim()).join('|'));
check(ea === '|N°|Millésime · âge|Origine|Classe mère|Lactation mère N-1|Lots', 'colonnes : ' + ea);
const la = await lignes();
check(la.some(l => l.startsWith('50041|2025 · 1 ans|Née|1|452,0 L')) && la.some(l => l.startsWith('50042') && l.endsWith('Achetée|-|-')), 'classe et lactation de la mère (« - » pour l\'achetée sans mère) : ' + la.join(' ; '));
await page.click('#lt-table tr.clic >> nth=0'); await page.click('#lt-affecter');
check(await page.evaluate(() => { const l = DB.lots[DB.lots.length - 1]; return l.membres.length === 1 && DB.agnelles.some(a => a.modesRepro && a.modesRepro.length === 1); }), 'affectation d\'une agnelle : membre + évènement modesRepro sur l\'agnelle');
console.log('OK 9 lot cible Agnelles : liste unique, classe et lactation de la mère, « - » sans donnée.');

// ================================================================ 10. écarts de classe entre sources
await jeu();
const ec = await page.evaluate(() => ecartsSourcesLactation().map(x => [x.numero, x.type]));
check(ec.some(e => e[0] === '80133' && /classe différente/.test(e[1])) && ec.some(e => e[0] === '90069' && /hors 1 à 4/.test(e[1])) && ec.some(e => e[0] === '90152' && /absente de lactationModele/.test(e[1])) && ec.length === 3, 'écarts : A (classe 1 contre 2), C (classe 0), D (absente de lactationModele) : ' + JSON.stringify(ec));
console.log('OK 10 écarts de classe entre sources (lactationModele / bilanLactation / cahier) listés, jamais corrigés.');

// ================================================================ 11. mobile : l'écran des lots d'origine, redirections PC
await jeu();
const rd = await page.evaluate(() => { const r = {}; render('add-lot'); r.add = !!document.getElementById('pc-lots'); render('add-lot-repro'); r.repro = !!document.getElementById('pc-lots');
  currentLotId = DB.lots[0].id; render('edit-lot'); r.edit = !!document.getElementById('pc-lots') && lotsPcEtat.lotId === DB.lots[0].id;
  window.electronAPI.isDesktop = false; lotsPcEtat = null; render('lots'); r.mobile = !document.getElementById('pc-lots') && !!document.getElementById('btn-new-lot') && /Nouveau lot de reproduction/.test(document.getElementById('app').textContent);
  window.electronAPI.isDesktop = true; return r; });
check(rd.add && rd.repro && rd.edit && rd.mobile, 'anciens écrans de création → page PC ; modification → étape 2 du lot ; mobile : écran d\'origine : ' + JSON.stringify(rd));
console.log('OK 11 routes : PC redirigé vers la page Lots ; mobile inchangé.');

// ================================================================ 12. DONNÉES RÉELLES (lecture seule)
if (exportPresent(EXPORT_CORRIGE)) {
  const reel = JSON.stringify(lireExport(EXPORT_CORRIGE));
  const t0 = Date.now();
  const r = await page.evaluate(j => {
    const brut = JSON.parse(j);
    DB = migrateData(JSON.parse(j)); window.__saves = 0; saveData = function () { window.__saves++; }; lotsPcEtat = null; window.__avant = JSON.stringify(DB);
    render('lots');
    lotsPcEtat.form.type = 'reproduction'; document.getElementById('lt-creer').click();
    const out = {}; out.lignes = document.querySelectorAll('#lt-table tr[data-eid]').length;
    ['controles', 'lactations', 'ia', 'misesbas'].forEach(o => { lotsPcEtat.onglet = o; renderLotsPc(); out[o] = document.querySelectorAll('#lt-table tr[data-eid]').length; });
    lotsPcEtat.onglet = 'lactations'; renderLotsPc();
    out.avecClasse = [...document.querySelectorAll('#lt-table tr[data-eid]')].filter(r => /^[1-4]$/.test(r.children[3].textContent.trim())).length;
    out.sansLact = [...document.querySelectorAll('#lt-table tr[data-eid]')].filter(r => r.children[2].textContent.trim() === '-').length;
    out.ecarts = ecartsSourcesLactation().length;
    const lm = {}; (brut.lactationModele || []).forEach(x => { lm[x.eid.replace(/\s+/g, '')] = x; });
    const bl = {}; (brut.bilanLactation || []).forEach(x => { bl[x.eid.replace(/\s+/g, '')] = x; });
    out.attenduDiff = brut.brebis.filter(s => { const k = s.eid.replace(/\s+/g, ''); return lm[k] && bl[k] && lm[k].campagne === brut.campagneDebut - 1 && bl[k].campagne === brut.campagneDebut - 1 && [1, 2, 3, 4].includes(parseInt(lm[k].classeParQuart, 10)) && [1, 2, 3, 4].includes(parseInt(bl[k].classeParQuart, 10)) && parseInt(lm[k].classeParQuart, 10) !== parseInt(bl[k].classeParQuart, 10); }).length;
    out.actives = DB.brebis.filter(s => (s.statut || 'active') === 'active').length;
    out.lotVide = DB.lots[DB.lots.length - 1].membres.length;
    out.attenduAvecClasse = DB.brebis.filter(s => (s.statut || 'active') === 'active').filter(s => { const k = s.eid.replace(/\s+/g, ''); return lm[k] && lm[k].campagne === brut.campagneDebut - 1 && [1, 2, 3, 4].includes(parseInt(lm[k].classeParQuart, 10)); }).length;
    return out;
  }, reel);
  console.log('   réel :', JSON.stringify(r), (Date.now() - t0) + ' ms');
  check(r.lignes === r.actives && r.controles === r.actives && r.lactations === r.actives && r.ia === r.actives && r.misesbas === r.actives, 'les 4 onglets listent les ' + r.actives + ' brebis actives réelles');
  check(r.avecClasse === r.attenduAvecClasse && r.sansLact > 0, 'classe 1 à 4 : ' + r.avecClasse + ' brebis, égal au comptage indépendant du JSON (' + r.attenduAvecClasse + ') ; les autres « - »');
  check(r.ecarts >= r.attenduDiff && r.lotVide === 0, 'écarts de sources calculés (≥ ' + r.attenduDiff + ' classes différentes lactationModele/bilanLactation) ; lot créé vide');
  check(await page.evaluate(() => window.__saves === 1 && JSON.stringify(DB.brebis) === JSON.stringify(JSON.parse(window.__avant).brebis)), 'données réelles : aucune fiche modifiée, seul le lot vide a été créé (en mémoire)');
  console.log('OK 12 données réelles (lecture seule) : 4 onglets sur les brebis actives, classe 1-4 = comptage indépendant, « - » ailleurs, écarts listés.');
} else console.log('SKIP 12 : export réel absent (voir tests/README.md)');

await browser.close();
console.log('\nTOUS LES TESTS DE LA PAGE PC « LOTS » SONT PASSÉS');
