/* Chantier de tri, partie a : journal d'affectations des lots de reproduction (collection evenementsLots), migration des lots existants,
   campagne des mises bas, règle Repro (attente S et S+1 / échec S seulement), résultat IA par campagne (code Repro inscrit sur la mise bas),
   sorties avant mise bas exclues des taux, garde-fou « Mettre à jour l'application », seuil dans Paramètres (PC seulement).
   saveData est REMPLACÉ par un compteur ; jeux synthétiques ; rien n'est écrit. La concurrence PC/mobile est dans test_lots_concurrence. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_CORRIGE, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1400 } })).newPage();
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
const alertes = [];
page.on('dialog', d => { if (d.type() === 'alert') alertes.push(d.message()); d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const reset = () => page.evaluate(() => { DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; }; DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true; window.E = (n) => '25001629919' + String(n).padStart(5, '0'); });

// ================================================================ 1. migration : un événement initial par lot de reproduction existant
await reset();
const mig = await page.evaluate(() => {
  const base = { lots: [
    { id: '1700000000000', nom: 'IA juin', type: 'reproduction', mode: 'IA', cible: 'Brebis', dateCreation: '2027-06-15', dateEvenement: '2027-06-15', campagne: 2026, membres: [E(59), E(69)] },
    { id: '1700000000001', nom: 'Éponge', type: 'reproduction', mode: 'EP', cible: 'Agnelles', dateCreation: '2026-10-04', dateEvenement: '2026-10-20', campagne: 2026, membres: [E(41)] },
    { id: '1700000000002', nom: 'Recherche', membres: [E(1), E(2)], dateCreation: '2026-10-01' },
    { id: '1700000000003', nom: 'Réforme', type: 'reforme', membres: [E(3)], dateCreation: '2026-10-01' }] };
  const m = migrateData(JSON.parse(JSON.stringify(base)));
  const m2 = migrateData(JSON.parse(JSON.stringify(m)));            // idempotent
  const autreAppareil = migrateData(JSON.parse(JSON.stringify(base)));  // un 2e appareil migre de son côté
  const ids = new Set([...m.evenementsLots, ...autreAppareil.evenementsLots].map(e => e.id));
  return { m, nEv2: m2.evenementsLots.length, ids: [...ids], schema: m.schemaLots, seuil: m.reproSeuilMiseBasMois };
});
const [l0, l1, l2, l3] = mig.m.lots;
const E0 = (n) => '25001629919' + String(n).padStart(5, '0');
check(mig.m.evenementsLots.length === 4 && mig.nEv2 === 4, 'un événement initial par lot non vide (reproduction, recherche, réforme), migration idempotente : ' + mig.m.evenementsLots.length);
check(mig.m.evenementsLots[0].id === 'EL-init-1700000000000' && mig.m.evenementsLots[0].type === 'initial' && mig.m.evenementsLots[0].eids.length === 2 && mig.m.evenementsLots[0].source === 'migration', 'événement initial : id déterministe, type initial, tous les membres');
check(mig.ids.length === 4, 'deux appareils qui migrent chacun de leur côté produisent les MÊMES ids (aucun doublon après fusion)');
check(l0.journal === 1 && l1.journal === 1 && JSON.stringify(l0.membres) === JSON.stringify(['25001629919' + '00059', '25001629919' + '00069']) && l0.journalN === 1, 'lot migré : journalisé, membres conservés, cache à jour');
check(l0.campagneMisesBas === 2027 && l0.campagneMisesBasDeduite === true && l1.campagneMisesBas === 2026, 'campagne des mises bas déduite (IA du 15/06/2027 → 2027 ; éponge lutte 20/10/2026 → 2026) : ' + l0.campagneMisesBas + ' / ' + l1.campagneMisesBas);
check(l0.campagne === 2026, 'lot.campagne (ancien sens) jamais réécrit');
check(l2.journal === 1 && l3.journal === 1 && l2.type === undefined && l3.type === 'reforme' && l2.campagneMisesBas === undefined && l3.campagneMisesBas === undefined, 'lots de recherche et de réforme : journalisés, sans campagne des mises bas');
const ev23 = mig.m.evenementsLots.filter(e => e.lotId === l2.id || e.lotId === l3.id);
check(ev23.length === 2 && ev23.every(e => e.id === 'EL-init-' + e.lotId && e.type === 'initial' && e.source === 'migration') && JSON.stringify(l2.membres) === JSON.stringify([E0(1), E0(2)]) && JSON.stringify(l3.membres) === JSON.stringify([E0(3)]), 'recherche / réforme : un événement initial déterministe, membres conservés : ' + JSON.stringify(ev23));
check(mig.schema === 3 && mig.seuil === 3, 'marqueur de version du format = 3 ; seuil mise bas = 3 mois par défaut');
console.log('OK 1 migration : événement initial par lot de reproduction, ids déterministes, idempotente, campagne des mises bas déduite, recherche/réforme intacts.');

// ================================================================ 2. moteur du journal
await reset();
const eng = await page.evaluate(() => {
  const r = {};
  const lot = creerLotReproductionJournalise({ id: 'L1', nom: 'IA', mode: 'IA', cible: 'Brebis', dateCreation: '2027-06-15', dateEvenement: '2027-06-15', campagneMisesBas: 2027 }, []);
  r.vide = [lot.membres.length, lot.journalN, ecartsMembresLots().length];
  const cent = Array.from({ length: 100 }, (_, i) => E(1000 + i));
  const ev = ajouterEvenementLot(lot, 'affectation', cent);
  r.groupe = [DB.evenementsLots.length, ev.eids.length, lot.membres.length];
  ajouterEvenementLot(lot, 'retrait', [E(1000), E(1001)], { motif: 'Malade' });
  ajouterEvenementLot(lot, 'affectation', [E(1001)]);                // retrait puis ré-ajout
  r.retraitReajout = [lot.membres.length, lot.membres.includes(E(1000)), lot.membres.includes(E(1001))];
  const avant = rejouerMembresLot('L1').join();
  DB.evenementsLots.reverse();
  r.deterministe = avant === rejouerMembresLot('L1').join();
  // horloge en retard : un événement déjà daté dans le futur ne doit pas passer APRÈS un retrait postérieur
  DB.evenementsLots.push({ id: 'EL-futur', lotId: 'L1', type: 'affectation', eids: [E(5000)], date: '2099-01-01T00:00:00.000Z', motif: null, source: 'PC' });
  materialiserMembresLot(lot);
  ajouterEvenementLot(lot, 'retrait', [E(5000)]);
  r.horloge = lot.membres.includes(E(5000));
  r.motif = DB.evenementsLots.find(e => e.motif === 'Malade').source;
  r.sourcePC = DB.evenementsLots[DB.evenementsLots.length - 1].source;
  r.rienEcrit = window.__saves;
  return r;
});
check(JSON.stringify(eng.vide) === '[0,0,0]', 'lot créé vide : 0 membre, 0 événement, aucun écart');
check(JSON.stringify(eng.groupe) === '[1,100,100]', 'affectation groupée de 100 brebis = 1 seul événement (eids[]) : ' + JSON.stringify(eng.groupe));
check(JSON.stringify(eng.retraitReajout) === '[99,false,true]', 'retrait puis ré-ajout : n°1000 retiré, n°1001 revenu, 99 membres : ' + JSON.stringify(eng.retraitReajout));
check(eng.deterministe, 'rejeu déterministe : l\'ordre de stockage des événements ne change rien');
check(eng.horloge === false, 'horloge en retard : le retrait reste postérieur à l\'affectation datée dans le futur (horodatage strictement croissant)');
check(eng.sourcePC === 'PC', 'source de l\'événement = PC en mode bureau');
check(eng.rienEcrit === 0, 'le moteur n\'appelle jamais saveData (c\'est l\'appelant)');

const ecart = await page.evaluate(() => {
  const r = {}; const lot = DB.lots.find(l => l.id === 'L1');
  const nAvant = DB.evenementsLots.length;
  lot.membres.push(E(7777));                                                    // modification hors journal (appareil non à jour)
  r.detecte = ecartsMembresLots().map(x => [x.lotId, x.ajoutees.length, x.retirees.length]);
  r.refus = ajouterEvenementLot(lot, 'retrait', [E(1002)]);
  r.cacheIntact = lot.membres.includes(E(7777)) && materialiserMembresLot(lot) === 'ecart' && lot.membres.includes(E(7777));
  r.nEv = DB.evenementsLots.length - nAvant;
  integrerEcartLot('L1');
  r.integre = [lot.membres.includes(E(7777)), ecartsMembresLots().length, DB.evenementsLots[DB.evenementsLots.length - 1].source];
  const taille = lot.membres.length;
  lot.membres.pop();                                                             // 2e écart : retrait hors journal
  r.detecte2 = ecartsMembresLots().map(x => [x.ajoutees.length, x.retirees.length]);
  rejeterEcartLot('L1');
  r.rejete = [lot.membres.length === taille, ecartsMembresLots().length];
  lot.journalN = 9999;                                                           // cache issu d'un appareil qui a vu plus d'événements
  const avant = lot.membres.slice();
  r.attente = [materialiserMembresLot(lot), JSON.stringify(lot.membres) === JSON.stringify(avant)];
  lot.journalN = DB.evenementsLots.filter(e => e.lotId === 'L1').length;
  return r;
});
check(JSON.stringify(ecart.detecte) === '[["L1",1,0]]', 'écart (appareil non à jour) détecté : 1 brebis ajoutée hors journal : ' + JSON.stringify(ecart.detecte));
check(ecart.refus && ecart.refus.refuse === 'ecart' && ecart.cacheIntact && ecart.nEv === 0, 'tant que l\'écart n\'est pas tranché : aucun événement écrit, cache jamais écrasé');
check(ecart.integre[0] === true && ecart.integre[1] === 0 && ecart.integre[2] === 'appareil non à jour', 'écart intégré au journal sur choix de l\'éleveur (source « appareil non à jour »)');
check(JSON.stringify(ecart.detecte2) === '[[0,1]]' && ecart.rejete[0] === true && ecart.rejete[1] === 0, 'écart rejeté : le journal fait foi, cache rétabli');
check(ecart.attente[0] === 'attente' && ecart.attente[1] === true, 'cache plus récent que les événements reçus : on attend, rien n\'est écrasé');
console.log('OK 2 moteur : affectation groupée (eids[]), retrait puis ré-ajout, rejeu déterministe, horodatage croissant, écart détecté puis intégré / rejeté, attente des événements en retard.');

// ================================================================ 3. règle Repro : attente S et S+1, échec S seulement, bascule de campagne
await reset();
const rep = await page.evaluate(() => {
  const r = {};
  const brebis = (n, extra) => Object.assign({ id: 'b' + n, eid: E(n), statut: 'active', agnelages: [], modesRepro: [], videesDefinitives: [], mouvements: [], sanitaire: [], echographies: [], controleLaitier: [] }, extra || {});
  const lotIA = (id, date, membres) => creerLotReproductionJournalise({ id, nom: 'IA ' + date, mode: 'IA', cible: 'Brebis', dateCreation: date, dateEvenement: date, campagne: 2026, campagneMisesBas: campagneMisesBasDepuisDate(date) }, membres);
  const X = brebis(1), Y = brebis(2);
  DB.brebis = [X, Y];
  const lJuin = lotIA('LJ', '2027-06-15', [X.eid]);           // IA d'été 2027 : mises bas de la campagne SUIVANTE (2027)
  const lAutomne = lotIA('LA', '2026-10-20', [Y.eid]);        // IA d'automne : mises bas de la campagne en cours (2026)
  X.modesRepro.push({ date: '2027-06-15', mode: 'IA', campagne: lJuin.campagneMisesBas, lotId: 'LJ' });
  Y.modesRepro.push({ date: '2026-10-20', mode: 'IA', campagne: lAutomne.campagneMisesBas, lotId: 'LA' });
  r.campagnes = [lJuin.campagneMisesBas, lAutomne.campagneMisesBas];
  r.attenteX = codeReproActuel(X, null, false);                  // S = 2026, lot de S+1 : « attente » IA (pas MN)
  r.echecX = codeReproActuel(X, null, true);                     // vide définitive : lot de S+1 non attribué
  r.echecY = codeReproActuel(Y, null, true);                     // lot de S : échec attribué à l'IA
  // bascule de campagne : le lot de juin devient celui de la campagne en cours
  DB.campagneDebut = 2027;
  r.apresBascule = codeReproActuel(X, null, false);
  r.deduction = deduireCodeRepro(X, '2027-11-10');
  // lot ANCIEN (campagne = campagne de l'IA, avant ce chantier) retrouvé après la bascule grâce à la migration
  const m = migrateData({ campagneDebut: 2027, lots: [{ id: '17000', nom: 'ancien', type: 'reproduction', mode: 'IA', cible: 'Brebis', dateCreation: '2027-06-15', dateEvenement: '2027-06-15', campagne: 2026, membres: [E(9)] }],
    brebis: [brebis(9, { modesRepro: [{ date: '2027-06-15', mode: 'IA', campagne: 2026, lotId: '17000' }] })] });
  const sauve = DB; DB = m;
  r.ancienApresBascule = codeReproActuel(m.brebis[0], null, false);
  DB = sauve;
  return r;
});
check(JSON.stringify(rep.campagnes) === '[2027,2026]', 'campagne des mises bas : IA de juin 2027 → 2027 (S+1), IA du 20/10/2026 → 2026 (S) : ' + JSON.stringify(rep.campagnes));
check(rep.attenteX.code === 'IA' && rep.attenteX.style === 'attente', 'lot de S+1 : la brebis affiche « IA en attente » (pas MN) avant la bascule : ' + JSON.stringify(rep.attenteX));
check(rep.echecX.code === 'MN' && rep.echecX.style === 'echec', 'vide définitive : le lot de S+1 n\'est PAS son échec (code MN) : ' + JSON.stringify(rep.echecX));
check(rep.echecY.code === 'IA' && rep.echecY.style === 'echec', 'vide définitive : le lot de S (campagne en cours) est attribué à l\'IA : ' + JSON.stringify(rep.echecY));
check(rep.apresBascule.code === 'IA' && rep.deduction === 'IA', 'lot créé AVANT la bascule, mise bas saisie APRÈS : code retrouvé (affichage IA, déduction IA) : ' + JSON.stringify(rep.apresBascule) + ' ' + rep.deduction);
check(rep.ancienApresBascule.code === 'IA', 'lot ancien (campagne = campagne de l\'IA) retrouvé après la bascule grâce à campagneMisesBas déduite : ' + JSON.stringify(rep.ancienApresBascule));
console.log('OK 3 règle Repro : attente S et S+1, échec S seulement, bascule de campagne (lot créé avant, mise bas saisie après), ancien lot retrouvé.');

// ================================================================ 4. résultat IA par campagne (code Repro inscrit sur la mise bas)
await reset();
const ia = await page.evaluate(() => {
  const r = {}; const auj = '2027-09-01';
  const b = (n, extra) => Object.assign({ id: 'b' + n, eid: E(n), statut: 'active', agnelages: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  const mb = (campagne, code, date) => ({ campagne, date, codeRepro: code, lambs: [{}] });
  const lot = (id, date, cm, membres) => { const l = creerLotReproductionJournalise({ id, nom: id, mode: 'IA', cible: 'Brebis', dateCreation: date, dateEvenement: date, campagneMisesBas: cm }, membres); return l; };
  const P = b(1, { agnelages: [mb(2025, 'IA', '2026-03-10')] });                       // prise, aucun lot connu
  const NP1 = b(2, { agnelages: [mb(2025, 'RE', '2026-04-02')] });                      // lot IA mais mise bas de code retour
  const NP2 = b(3, { videesDefinitives: [{ campagne: 2025 }] });                         // lot IA, vide définitive
  const NP3 = b(4);                                                                       // lot IA, rien, délai dépassé
  const AT = b(5);                                                                        // lot IA récent, rien : en attente
  const PI = b(6);                                                                        // aucun lot
  lot('L25', '2025-10-20', 2025, [NP1.eid, NP2.eid, NP3.eid]);
  lot('L27', '2027-06-15', 2027, [AT.eid]);
  const res = x => [2025, 2026, 2027].map(c => resultatIAPourCampagne(x, c, auj));
  r.P = res(P); r.NP1 = res(NP1); r.NP2 = res(NP2); r.NP3 = res(NP3); r.AT = res(AT); r.PI = res(PI);
  // correction manuelle du code Repro sur la mise bas : prise en compte immédiatement (même objet, aucune copie)
  NP1.agnelages[0].codeRepro = 'IA';
  r.apresCorrection = resultatIAPourCampagne(NP1, 2025, auj);
  // « pas 2 échecs de suite »
  const C = b(7), D = b(8), F = b(9);
  lot('M24', '2024-10-20', 2024, [C.eid, D.eid, F.eid]); lot('M25', '2025-10-21', 2025, [C.eid, D.eid]); lot('M26', '2026-10-22', 2026, [F.eid]);
  D.agnelages.push(mb(2025, 'IA', '2026-03-12'));                                        // D : prise en 2025
  lot('M27', '2027-06-20', 2027, [C.eid]);                                                // C : lot 2027 en attente (sautée)
  const G = b(10); lot('M26b', '2026-10-23', 2026, [G.eid]);                           // G : un seul lot tranché
  r.echecs = [deuxEchecsIADeSuite(C, auj), deuxEchecsIADeSuite(D, auj), deuxEchecsIADeSuite(F, auj), deuxEchecsIADeSuite(G, auj)];
  r.seq = [C, F].map(x => campagnesIAEnLot(x.eid).join());
  return r;
});
check(JSON.stringify(ia.P) === '["prise","pas_en_ia","pas_en_ia"]', 'prise même sans lot connu : ' + JSON.stringify(ia.P));
check(JSON.stringify(ia.NP1.slice(0, 1)) === '["non_prise"]' && JSON.stringify(ia.NP2.slice(0, 1)) === '["non_prise"]' && JSON.stringify(ia.NP3.slice(0, 1)) === '["non_prise"]', 'non prise : mise bas de code retour, vide définitive, ni l\'un ni l\'autre une fois le délai dépassé');
check(ia.AT[2] === 'attente' && ia.AT[0] === 'pas_en_ia' && ia.PI.every(x => x === 'pas_en_ia'), 'en attente (IA du 15/06/2027 + 171 j > 01/09/2027) ; sans lot connu ce n\'est pas « non prise » ; aucune IA : pas en IA : ' + JSON.stringify(ia.AT));
check(ia.apresCorrection === 'prise', 'correction manuelle du code Repro (agnelage.codeRepro) : résultat recalculé immédiatement');
check(JSON.stringify(ia.echecs) === '[true,false,true,false]', '« pas 2 échecs de suite » : C (2024, 2025 non prises ; 2027 en attente sautée) = oui ; D (prise en 2025) = non ; F (2024 et 2026 non prises, 2025 sans lot sautée) = oui ; G (1 seul lot tranché) = non : ' + JSON.stringify(ia.echecs));
console.log('OK 4 résultat IA : prise (code inscrit), non prise, en attente (+171 j), pas en IA, correction manuelle prise en compte, deux échecs de suite.');

// ================================================================ 5. sorties avant mise bas exclues des taux
await reset();
const st = await page.evaluate(() => {
  const b = (n, extra) => Object.assign({ id: 'b' + n, eid: E(n), statut: 'active', agnelages: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  const mb = (date, lambs) => ({ campagne: 2026, date, codeRepro: 'IA', lambs: Array.from({ length: lambs }, () => ({})) });
  const A = b(1, { agnelages: [mb('2027-03-15', 2)] }), Ee = b(2), B = b(3, { statut: 'vendue' });
  DB.brebis = [A, Ee, B];
  DB.registre.brebis[E(4)] = { eid: E(4), agnelages: [], mouvements: [], sanitaire: [] };
  DB.registre.brebis[E(5)] = { eid: E(5), agnelages: [mb('2027-03-16', 1)], mouvements: [], sanitaire: [] };
  const lot = creerLotReproductionJournalise({ id: 'LS', nom: 'IA', mode: 'IA', cible: 'Brebis', dateCreation: '2026-10-20', dateEvenement: '2026-10-20', campagneMisesBas: 2026 }, [A, Ee, B].map(x => x.eid).concat([E(4), E(5)]));
  const s = statsLotIA(lot);
  const ep = creerLotReproductionJournalise({ id: 'LE', nom: 'EP', mode: 'EP', cible: 'Brebis', dateCreation: '2026-10-20', dateEvenement: '2026-10-20', campagneMisesBas: 2026 }, [A.eid, B.eid]);
  const se = statsLotEponge(ep);
  return { membres: lot.membres.length, effectif: s.effectif, sorties: s.sorties, misesBasIA: s.ia.misesBas, fertilite: s.ia.fertilite, ep: [se.effectif, se.sorties, se.misesBas],
    parAge: statsLotIAParAgeExact(lot).reduce((t, g) => t + g.effectif, 0) };
});
check(st.membres === 5, 'les 5 membres restent dans le lot (jamais retirés automatiquement)');
check(st.effectif === 3 && st.sorties === 2 && st.misesBasIA === 2 && st.fertilite === 66.7, 'stats IA : effectif 3 (active sans mise bas, active avec, archivée AVEC mise bas), 2 sorties avant mise bas (vendue, archivée sans), taux 66,7 % : ' + JSON.stringify(st));
check(st.parAge === 3, 'détail par millésime (PDF) cohérent avec le total : ' + st.parAge);
check(JSON.stringify(st.ep) === '[1,1,1]', 'éponge : même règle (effectif 1, 1 sortie, 1 mise bas)');
console.log('OK 5 statistiques : sorties avant mise bas exclues du numérateur et du dénominateur, comptées à part, jamais retirées du lot ; archivée avec mise bas comptée.');

// ================================================================ 6. plomberie de synchro, garde-fou version, lot vide, seuil Paramètres
await reset();
// DOC_COLLECTIONS / META_FIELDS / sync vivent dans le module de synchro (non global) : vérifiés dans la source servie
const src = await page.evaluate(() => fetch(location.href).then(r => r.text()));
const pl = { doc: /const DOC_COLLECTIONS = \[[^\]]*'evenementsLots'[^\]]*\]/.test(src), meta: /const META_FIELDS = \[[\s\S]*?'reproSeuilMiseBasMois', 'schemaLots'[\s\S]*?\];/.test(src), lastSynced: /lastSynced: \{[\s\S]{0,200}evenementsLots: \{\}/.test(src), hook: /if \(colName === 'evenementsLots'\) recalculerMembresLotsRepro\(\)/.test(src) };
check(pl.doc && pl.meta && pl.lastSynced && pl.hook, 'evenementsLots dans DOC_COLLECTIONS (1 document par événement) et lastSynced, schemaLots et seuil dans META_FIELDS, cache recalculé à la réception : ' + JSON.stringify(pl));
const gf = await page.evaluate(() => { const r = {}; r.libre = garderLotsModifiables(); DB.schemaLots = 4; r.verrou = lotsVerrouilles(); r.refus = garderLotsModifiables(); DB.schemaLots = 3; return r; });
check(gf.libre === true && gf.verrou === true && gf.refus === false && alertes.some(m => /Mettre à jour l'application/.test(m)), 'garde-fou : version du format plus récente → « Mettre à jour l\'application », lots non modifiables ; sinon libre');
await page.evaluate(() => { DB.schemaLots = 4; window.electronAPI.isDesktop = false; render('lots'); });
check(/Mettre à jour l'application/.test(await page.evaluate(() => document.getElementById('app').textContent)), 'bandeau « Mettre à jour l\'application » sur l\'écran des lots (mobile)');
await page.evaluate(() => { DB.schemaLots = 3; });
const vide = await page.evaluate(() => {
  creerLotReproductionJournalise({ id: 'LV', nom: 'Lot vide', mode: 'IA', cible: 'Brebis', dateCreation: '2026-10-20', dateEvenement: '2026-10-20', campagneMisesBas: 2026 }, []);
  creerLotReproductionJournalise({ id: 'LP', nom: 'Lot plein', mode: 'IA', cible: 'Brebis', dateCreation: '2026-10-20', dateEvenement: '2026-10-20', campagneMisesBas: 2026 }, [E(1)]);
  DB.brebis = [{ id: 'b1', eid: E(1), statut: 'active', agnelages: [], modesRepro: [], videesDefinitives: [], sanitaire: [], mouvements: [], echographies: [], controleLaitier: [] }];
  render('lots');
  const boutons = [...document.querySelectorAll('.btn-search-lot')].map(b => b.dataset.id);
  let bilan = '';
  try { bilan = JSON.stringify(bilanLotsReproductionHtml(classementAntenaisesCampagne(campagneCohortPresente()))); } catch (e) { bilan = 'ERR ' + e.message; }
  return { boutons, vide: /Lot vide/.test(bilan), plein: /Lot plein/.test(bilan), bilan: bilan.slice(0, 60) };
});
check(JSON.stringify(vide.boutons) === '["LP"]', 'un lot vide n\'a pas « Chercher en bergerie » : ' + JSON.stringify(vide.boutons));
check(vide.plein === true && vide.vide === false, 'un lot vide n\'apparaît pas dans le Bilan de reproduction : ' + vide.bilan);
await page.evaluate(() => { window.electronAPI.isDesktop = true; });
await page.evaluate(() => { parametresTab = 'campagne'; parametresRubrique = 'campagne'; render('parametres'); });
check(await page.evaluate(() => document.getElementById('f-repro-seuil-mb') && document.getElementById('f-repro-seuil-mb').value) === '3', 'Paramètres (PC) : seuil « délai depuis la dernière mise bas » = 3 mois par défaut');
await page.fill('#f-repro-seuil-mb', '4'); await page.click('#btn-save-repro-seuil');
check(await page.evaluate(() => DB.reproSeuilMiseBasMois === 4 && window.__saves > 0), 'seuil enregistré (4 mois)');
await page.evaluate(() => { window.electronAPI.isDesktop = false; render('parametres'); });
check(await page.evaluate(() => !document.getElementById('f-repro-seuil-mb')), 'Paramètres mobile : carte absente (mobile inchangé)');
console.log('OK 6 synchro (collection + champs meta), garde-fou version, lot vide hors Bilan et sans « Chercher en bergerie », seuil dans Paramètres (PC seulement).');


// ================================================================ 7. DONNÉES RÉELLES (lecture seule) : rien ne change, les « - » sont honnêtes
if (exportPresent(EXPORT_CORRIGE)) {
  const reel = JSON.stringify(lireExport(EXPORT_CORRIGE));
  const r = await page.evaluate(j => {
    const brut = JSON.parse(j); const avant = JSON.stringify(brut.brebis);
    DB = migrateData(JSON.parse(j)); window.__saves = 0; saveData = function () { window.__saves++; };
    const actives = DB.brebis.filter(s => (s.statut || 'active') === 'active');
    const codes = {}; actives.forEach(s => { const c = codeReproActuel(s, agnelageCampagneActuelle(s), false); const k = c.code + '/' + c.style; codes[k] = (codes[k] || 0) + 1; });
    const ia = {}; actives.forEach(s => [2024, 2025, 2026].forEach(c => { const k = resultatIAPourCampagne(s, c, '2026-10-03'); ia[k] = (ia[k] || 0) + 1; }));
    const resultat = { identique: JSON.stringify(DB.brebis) === avant || JSON.stringify(DB.brebis.map(s => Object.assign({}, s))) === avant, lots: DB.lots.length, evts: DB.evenementsLots.length, schema: DB.schemaLots, seuil: DB.reproSeuilMiseBasMois,
      codes, ia, orphelins: actives.reduce((n, s) => n + (s.modesRepro || []).length, 0), saves: window.__saves };
    window.electronAPI.isDesktop = false; render('lots'); resultat.lotsMobile = document.getElementById('app').textContent.length > 0;
    window.electronAPI.isDesktop = true; parametresTab = 'campagne'; parametresRubrique = 'campagne'; render('parametres'); resultat.param = !!document.getElementById('f-repro-seuil-mb');
    return resultat;
  }, reel);
  console.log('   réel :', JSON.stringify(r));
  check(r.lots === 0 && r.evts === 0 && r.schema === 2 && r.seuil === 3, 'données réelles : aucun lot, aucun événement, marqueur de version posé, seuil par défaut');
  check(r.identique, 'migrateData ne modifie AUCUNE fiche brebis réelle');
  check(Object.keys(r.codes).join() === 'MN/attente' && Object.keys(r.ia).join() === 'pas_en_ia', 'code Repro et résultat IA sur les brebis réelles : tout « MN/attente » et « pas en IA » (aucun lot, aucune mise bas) : ' + JSON.stringify(r.codes) + ' ' + JSON.stringify(r.ia));
  check(r.lotsMobile && r.param && r.saves === 0, 'écrans des lots (mobile) et Paramètres (PC) s\'affichent sur les données réelles, rien d\'écrit');
  console.log('OK 7 données réelles (lecture seule) : fiches intactes, aucun lot, « MN/attente » et « pas en IA » partout (aucune mise bas dans les exports).');
} else console.log('SKIP 7 : export réel absent (voir tests/README.md)');

await browser.close();
console.log('\nTOUS LES TESTS DU JOURNAL DES LOTS (PARTIE A) SONT PASSÉS');
