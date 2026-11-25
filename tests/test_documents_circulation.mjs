/* Documents de circulation (chantier EDE, étape 1, point 5). Derrière l'interrupteur « Notification EDE » : ligne de menu « Réglementaire »
   (Documents de circulation, Registre, Déclaration), module PC et consultation mobile (carte en haut de Mouvements). Ventes et achats depuis
   « Notifier à partir du », regroupés par sens, date et partenaire ; morts et autoconsommation sans abattoir « hors document » ; états À compléter /
   Complet / Validé ; agneaux Boucherie | Reproduction (confirmer, ligne ambre, n° national obligatoire pour la reproduction) ; délai d'attente
   viande en rouge, « Valider quand même » ; mettre à part ; échéance d'après le délai réglé (Règles d'élevage › Mouvements) ; achats : rappel
   du feuillet d'arrivée et « Envoyé ». Désactivé : rien de tout cela. Noms et numéros fictifs. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

const donnees = () => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.acheteurs = ['Coop Exemple', 'Abattoir Test', 'Éleveur Test'];
  DB.partenairesInfo = { 'Coop Exemple': { categorie: 'cooperative', numero: 'FR 12345678' }, 'Abattoir Test': { categorie: 'abattoir', numero: 'FR 12.000.001' }, 'Éleveur Test': { categorie: 'eleveur', numero: 'FR12000001' } };
  DB.produitsInfo = { ProdX: { delaiViande: 28, delaiAttente: 0 } };
  const b = (id, eid, mouvements, extra) => Object.assign({ id, eid, statut: 'active', createdAt: 1, agnelages: [], sanitaire: [], notes: [], echographies: [], controleLaitier: [], modesRepro: [], mouvements }, extra || {});
  DB.brebis = [
    b('b1', '250000004561001', [{ id: 'm1', type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }], { statut: 'vendue', numeroCourtTravailSieol: '601', sanitaire: [{ id: 's1', produit: 'ProdX', date: '2026-11-05', delaiViandeJours: 28 }] }),
    b('b2', '250000004561002', [{ id: 'm2', type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }], { statut: 'vendue', agnelages: [{ id: 'ag1', date: '2026-10-01', campagne: 2026, lambs: [
      { id: 'l1', eid: '250000004571001', sexe: 'Mâle', mouvements: [{ id: 'm11', type: 'Vendu', acheteur: 'Coop Exemple', date: '2026-11-10' }] },
      { id: 'l2', eid: '', sexe: 'Mâle', mouvements: [{ id: 'm12', type: 'Vendu', acheteur: 'Coop Exemple', date: '2026-11-10' }] },
      { id: 'l3', eid: '71003', sexe: 'Femelle', mouvements: [{ id: 'm13', type: 'Vendu', acheteur: 'Coop Exemple', date: '2026-11-10' }] }] }] }),
    b('b3', '250000004561003', [{ id: 'm3', type: 'Morte', cause: 'Mammite', date: '2026-11-12' }], { statut: 'morte' }),
    b('b4', '250000004561004', [{ id: 'm4', type: 'Autoconsommation', date: '2026-11-15' }], { statut: 'autoconsommée' }),
    b('b5', '250000004561005', [{ id: 'm5', type: 'Vente', acheteur: 'Coop Exemple', date: '2026-08-15' }], { statut: 'vendue' }),
    b('b6', '250000004561006', [{ id: 'm6', type: 'Entrée', cause: 'Import Nouveaux animaux (achetée)', importNature: 'achat', provenance: 'Éleveur Test', date: '2026-11-03' }], { dateEntree: '2026-11-03' }),
    b('b7', '250000004561007', [{ id: 'm7', type: 'Entrée', cause: 'Import Nouveaux animaux (achetée)', importNature: 'inventaire', date: '2026-11-03' }], { dateEntree: '2026-11-03' }),
    b('b8', '250000004561008', [{ id: 'm9', type: 'Entrée', cause: 'Import Nouveaux animaux (achetée)', date: '2026-11-04' }], { dateEntree: '2026-11-04' }),
    b('b9', '250000004561009', [{ id: 'm10', type: 'Entrée', cause: 'Import Nouveaux animaux (née)', date: '2026-11-04' }], { dateEntree: '2026-11-04' })
  ];
  DB.beliers = [];
  DB.agnelles = [{ id: 'a1', eid: '250000009871001', origine: 'achetée', statut: 'active', dateEntree: '2026-11-02', sanitaire: [], notes: [], mouvements: [{ id: 'm8', type: 'Entrée', cause: 'Achat', date: '2026-11-02' }] }];
};

for (const pc of [true, false]) {
  const nom = pc ? 'PC' : 'mobile';
  const ctx = await browser.newContext({ viewport: pc ? { width: 1400, height: 950 } : { width: 400, height: 860 } });
  const page = await ctx.newPage();
  if (pc) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  // interrupteur DÉSACTIVÉ : rien ne change
  await page.evaluate(() => { window.OvilogSync = window.OvilogSync || {}; window.__ede = false; window.OvilogSync.reglagesAdmin = () => ({ connu: true, data: { notificationEde: window.__ede, notifierAPartirDu: '2026-09-01' } }); });
  await page.evaluate(donnees);
  await page.evaluate(() => render('home'));
  eq(await page.evaluate(() => document.querySelector('.nav-item[data-view="reglementaire"]').classList.contains('hidden')), true, nom + ' : désactivé, pas de ligne « Réglementaire »');
  await page.evaluate(() => render('documents-circulation'));
  eq(await page.evaluate(() => currentView), 'home', nom + ' : désactivé, le module renvoie à l\'Accueil');
  await page.evaluate(() => render('inventaire'));
  eq(await page.evaluate(() => !!document.getElementById('dc-carte-mouvements')), false, nom + ' : désactivé, pas de carte dans Mouvements');
  await page.evaluate(() => { parametresTab = 'regles'; parametresRubrique = 'regles'; render('parametres'); });
  eq(await page.evaluate(() => !!document.getElementById('card-mouvements-ede')), false, nom + ' : désactivé, pas de carte « Mouvements » dans Règles d\'élevage');
  eq(await page.evaluate(() => [DB.documentsCirculation === undefined, DB.delaiNotificationEde === undefined]), [true, true], nom + ' : désactivé, rien d\'écrit');
  if (pc) { await page.evaluate(() => render('import-nouveaux-animaux')); eq(await page.evaluate(() => !!document.getElementById('import-na-nature')), false, nom + ' : désactivé, import sans question'); }
  // création à la main, désactivé : identique à avant (pas d'origine, entrée « Création (ajout manuel) »)
  await page.evaluate(() => render('add-belier'));
  eq(await page.evaluate(() => !!document.getElementById('cr-origine-bloc')), false, nom + ' : désactivé, création de bélier sans origine');
  await page.fill('#input-eid', '250000004599001'); await page.click('#btn-save-belier');
  eq(await page.evaluate(() => { const b = DB.beliers.find(x => x.eid === '250000004599001'); return [b.origine === undefined, b.mouvements[0].cause, Object.keys(b.mouvements[0]).filter(k => k !== 'id')]; }), [true, 'Création (ajout manuel)', ['type', 'cause', 'date', 'dateInconnue']], nom + ' : désactivé, entrée comme avant');

  // ACTIVÉ
  await page.evaluate(() => { window.__ede = true; render('home'); });
  eq(await page.evaluate(() => document.querySelector('.nav-item[data-view="reglementaire"]').classList.contains('hidden')), false, nom + ' : activé, ligne « Réglementaire » au menu');
  eq(await page.evaluate(() => ['registre', 'declaration-annuelle'].map(v => !!document.querySelector('.nav-item[data-view="' + v + '"]'))), [true, true], nom + ' : Registre et Déclaration restent à leur place');
  await page.evaluate(() => render('reglementaire'));
  eq(await page.evaluate(() => [...document.querySelectorAll('.rg-ligne .carte-liste-nm')].map(e => e.textContent)), ['Documents de circulation', "Registre d'élevage", 'Déclaration annuelle'], nom + ' : Réglementaire = 3 lignes dans l\'ordre');

  // calculs
  const r = await page.evaluate(() => { const r = documentsCirculationCalcules({}); return { docs: r.docs.map(x => [x.doc.sens, x.doc.date, x.partenaire, x.items.map(i => i.ref).sort(), x.etat]), hors: r.hors.map(i => [i.ref, i.hors]) }; });
  eq(r.docs, [
    ['sortie', '2026-11-10', 'Coop Exemple', ['agneaux:l1:m11', 'agneaux:l2:m12', 'agneaux:l3:m13', 'brebis:250000004561001:m1', 'brebis:250000004561002:m2'], 'acompleter'],
    ['entree', '2026-11-03', 'Éleveur Test', ['brebis:250000004561006:m6'], 'complet'],
    ['entree', '2026-11-02', '', ['agnelles:250000009871001:m8'], 'acompleter']
  ], nom + ' : documents proposés par sens, date et partenaire ; vente d\'avant « Notifier à partir du » et import d\'inventaire absents');
  eq(r.hors, [['brebis:250000004561004:m4', 'Autoconsommation'], ['brebis:250000004561003:m3', 'Mort']], nom + ' : mort et autoconsommation sans abattoir hors document');
  const x0 = await page.evaluate(() => { const x = documentsCirculationCalcules({}).docs[0]; return { manques: x.manques, listes: x.listes.length, comptes: x.comptes.length, viande: x.alertesViande.map(a => a.it.ref), notif: x.notif }; });
  eq(x0.manques, ['heure de départ', 'transporteur', 'destination des agneaux à confirmer'], nom + ' : ce qui manque à la vente');
  eq([x0.listes, x0.comptes, x0.viande], [2, 3, ['brebis:250000004561001:m1']], nom + ' : 2 brebis listées, 3 agneaux comptés (boucherie présumée), une brebis sous délai viande');
  eq(x0.notif, { ton: 'rouge', texte: 'Délai dépassé : à notifier avant le 17\/11\/2026' }, nom + ' : échéance date + 7 jours, dépassée = rouge');

  await page.evaluate(() => render('documents-circulation'));
  eq(await page.evaluate(() => document.querySelectorAll('.dc-carte').length), 3, nom + ' : 3 cartes de documents');
  check(/Vente d'agneaux|hors document/.test(await page.evaluate(() => document.body.innerText)), nom + ' : liste affichée');
  check(!/(^|\s)[BEMCAHP](\s|$)|catégorie \d\d/.test(await page.evaluate(() => document.querySelector('.dc-page').innerText)), nom + ' : aucun code officiel affiché');

  if (pc) {
    // autoconsommation partie à l'abattoir : un document est proposé, Annuler exact
    await page.selectOption('.dc-abattoir', 'Abattoir Test');
    eq(await page.evaluate(() => [DB.brebis[3].mouvements[0].abattoir, documentsCirculationCalcules({}).docs.some(x => x.partenaire === 'Abattoir Test'), documentsCirculationCalcules({}).hors.length]), ['Abattoir Test', true, 1], nom + ' : abattoir indiqué = document proposé');
    await page.click('#sup-snack-annuler');
    eq(await page.evaluate(() => ['abattoir' in DB.brebis[3].mouvements[0], documentsCirculationCalcules({}).hors.length]), [false, 2], nom + ' : Annuler = mouvement exact d\'avant');

    // fiche de la vente
    await page.evaluate(() => { dcEtat.id = documentsCirculationCalcules({}).docs[0].doc.id; render('document-circulation'); });
    eq(await page.evaluate(() => [document.getElementById('dc-ica').checked, document.getElementById('dc-camion-vide').checked, document.getElementById('dc-valider').disabled, !!document.getElementById('dc-dest-a-confirmer')]), [false, false, true, true], nom + ' : ICA et camion vide jamais cochés d\'office, Valider bloqué, ligne ambre « à confirmer »');
    check(/boucherie par défaut, à confirmer/.test(await page.textContent('#dc-dest-a-confirmer')), nom + ' : texte de la ligne ambre');
    check(await page.isVisible('#dc-alerte-viande'), nom + ' : alerte rouge délai viande');
    eq(await page.evaluate(() => DB.documentsCirculation === undefined), true, nom + ' : rien d\'écrit avant le premier geste');
    await page.fill('#dc-heure', '07:30'); await page.dispatchEvent('#dc-heure', 'change');
    const id1 = await page.evaluate(() => dcEtat.id);
    check(/^dc/.test(id1), nom + ' : premier geste = document écrit');
    eq(await page.evaluate(id => [DB.documentsCirculation[id].heure, DB.documentsCirculation[id].refs.length, DB.documentsCirculation[id].sens], id1), ['07:30', 5, 'sortie'], nom + ' : heure et mouvements du document');
    await page.click('#dc-inconnu');
    eq(await page.evaluate(id => DB.documentsCirculation[id].transporteur, id1), 'Inconnu', nom + ' : transporteur « Inconnu »');
    // mettre à part puis remettre
    await page.click('.dc-apart[data-ref="brebis:250000004561002:m2"]');
    const idPart = await page.evaluate(() => dcEtat.id);
    eq(await page.evaluate(([a, b]) => [DB.documentsCirculation[b].aPart, DB.documentsCirculation[b].refs, DB.documentsCirculation[a].refs.includes('brebis:250000004561002:m2')], [id1, idPart]), [true, ['brebis:250000004561002:m2'], false], nom + ' : animal mis à part = document à lui');
    await page.click('#dc-rattacher');
    eq(await page.evaluate(([a, b]) => [b in DB.documentsCirculation, documentsCirculationCalcules({}).docs.find(x => x.doc.id === a).items.length], [id1, idPart]), [false, 5], nom + ' : remis avec les autres');
    await page.evaluate(id => { dcEtat.id = id; render('document-circulation'); }, id1);
    // agneaux : l1 et l3 en reproduction (brouillon), confirmer
    await page.click('.dc-dest[data-ref="agneaux:l1:m11"] button[data-val="reproduction"]');
    await page.click('.dc-dest[data-ref="agneaux:l3:m13"] button[data-val="reproduction"]');
    eq(await page.evaluate(() => DB.brebis[1].agnelages[0].lambs.map(l => l.mouvements[0].destination || null)), [null, null, null], nom + ' : rien d\'écrit avant « Confirmer »');
    await page.click('#dc-dest-confirmer');
    eq(await page.evaluate(() => DB.brebis[1].agnelages[0].lambs.map(l => l.mouvements[0].destination)), ['reproduction', 'boucherie', 'reproduction'], nom + ' : Confirmer écrit la destination de chaque agneau');
    eq(await page.evaluate(() => [!!document.getElementById('dc-dest-a-confirmer'), document.getElementById('dc-valider').disabled]), [false, true], nom + ' : ligne ambre retirée ; agneau sans n° national = validation impossible');
    check(/1 agneau à vérifier/.test(await page.textContent('#dc-manques')), nom + ' : « à vérifier » affiché');
    eq(await page.evaluate(() => { const x = documentsCirculationCalcules({}).docs[0]; return [x.listes.map(i => i.ref).sort(), x.comptes.map(i => i.ref)]; }),
      [['agneaux:l1:m11', 'agneaux:l3:m13', 'brebis:250000004561001:m1', 'brebis:250000004561002:m2'], ['agneaux:l2:m12']], nom + ' : agneaux de reproduction listés, boucherie comptés');
    await page.click('.dc-dest[data-ref="agneaux:l3:m13"] button[data-val="boucherie"]');
    eq(await page.evaluate(() => [DB.brebis[1].agnelages[0].lambs[2].mouvements[0].destination, document.getElementById('dc-valider').disabled]), ['boucherie', false], nom + ' : agneau repassé en boucherie, document complet');
    // valider : délai viande = question de la charte
    await page.click('#dc-valider');
    check(await page.isVisible('#question-charte'), nom + ' : « Valider quand même ? » (délai viande)');
    await page.click('#qc-non');
    eq(await page.evaluate(id => DB.documentsCirculation[id].valideLe || null, id1), null, nom + ' : Revenir = rien de validé');
    await page.click('#dc-valider'); await page.click('#qc-oui');
    eq(await page.evaluate(id => [!!DB.documentsCirculation[id].valideLe, documentsCirculationCalcules({}).docs.find(x => x.doc.id === id).etat], id1), [true, 'valide'], nom + ' : validé');
    eq(await page.evaluate(() => !!document.getElementById('dc-heure')), false, nom + ' : document validé figé');
    await page.click('#dc-envoye');
    eq(await page.evaluate(id => documentsCirculationCalcules({}).docs.find(x => x.doc.id === id).notif.ton, id1), 'vert', nom + ' : envoyé à l\'EDE');
    await page.click('#sup-snack-annuler');
    eq(await page.evaluate(id => [DB.documentsCirculation[id].envoyeLe || null, !!DB.documentsCirculation[id].valideLe], id1), [null, true], nom + ' : Annuler = document exact d\'avant');

    // achat sans provenance : à compléter, puis provenance choisie, Envoyé
    const idA = await page.evaluate(() => documentsCirculationCalcules({}).docs.find(x => x.doc.date === '2026-11-02').doc.id);
    await page.evaluate(id => { dcEtat.id = id; render('document-circulation'); }, idA);
    check(/feuillet d'arrivée du document du vendeur à l'EDE avant le 09\/11\/2026/.test(await page.evaluate(() => document.body.innerText)), nom + ' : rappel du feuillet d\'arrivée avec l\'échéance');
    eq(await page.evaluate(() => [document.getElementById('dc-envoye').disabled, /provenance/.test(document.getElementById('dc-manques').textContent)]), [true, true], nom + ' : achat sans provenance à compléter');
    await page.selectOption('#dc-partenaire', 'Éleveur Test');
    eq(await page.evaluate(() => [documentsCirculationCalcules({}).docs.find(x => x.doc.id === dcEtat.id).etat, document.getElementById('dc-envoye').disabled]), ['complet', false], nom + ' : provenance indiquée = complet');
    await page.click('#dc-envoye');
    eq(await page.evaluate(() => documentsCirculationCalcules({}).docs.find(x => x.doc.id === dcEtat.id).etat), 'envoye', nom + ' : achat noté envoyé');
    eq(await page.evaluate(() => DB.agnelles[0].mouvements[0].provenance === undefined), true, nom + ' : le mouvement de l\'animal n\'est pas réécrit');

    // imports déjà faits : à classer, jamais d'office
    await page.evaluate(() => render('documents-circulation'));
    eq(await page.evaluate(() => importsAClasserEde().map(c => c.animal.id)), ['b8'], nom + ' : seule l\'achetée importée sans réponse est à classer (née et inventaire jamais)');
    check(await page.isVisible('#dc-a-classer'), nom + ' : carte « Imports à classer »');
    await page.click('.dc-classer[data-val="achat"]');
    eq(await page.evaluate(() => [DB.brebis[7].mouvements[0].importNature, documentsCirculationCalcules({}).docs.some(x => x.items.some(i => i.ref === 'brebis:250000004561008:m9'))]), ['achat', true], nom + ' : classée en achat = entrée à notifier');
    await page.click('#sup-snack-annuler');
    eq(await page.evaluate(() => 'importNature' in DB.brebis[7].mouvements[0]), false, nom + ' : Annuler = mouvement exact d\'avant');
    // import avec la question « Inventaire de départ | Achat »
    const fichier = async (feuilles) => { const octets = await page.evaluate(async (f) => Array.from(await buildXlsxWorkbook(f)), feuilles); return { name: 'Modele_Nouveaux_Animaux.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(octets) }; };
    const entete = [[], [], [], []];
    await page.evaluate(() => render('import-nouveaux-animaux'));
    await page.setInputFiles('#import-nouveaux-animaux-file', await fichier([
      { name: 'Brebis', rows: [...entete, ['achetée', '00000046001', '10\/11\/2026', 'actif', '', '', '', '', 'coop exemple'], ['née', '00000046002', '10\/11\/2026', 'actif', '', '', '', ''], ['achetée', '00000046003', '', 'actif', '', '', '', '', 'Vendeur Nouveau']] },
      { name: 'Béliers', rows: [...entete] }, { name: 'Agnelles', rows: [...entete] }]));
    await page.waitForTimeout(500);
    check(await page.isVisible('#import-na-nature'), nom + ' : question « Ce fichier est : » affichée');
    eq(await page.evaluate(() => document.querySelectorAll('.na-nature.selected').length), 0, nom + ' : aucune réponse par défaut');
    const avant = await page.evaluate(() => DB.brebis.length);
    await page.click('#btn-confirm-import-nouveaux-animaux');
    eq(await page.evaluate(() => [DB.brebis.length, document.getElementById('import-na-nature-err').classList.contains('hidden')]), [avant, false], nom + ' : sans réponse, rien n\'est importé');
    await page.click('.na-nature[data-val="achat"]');
    await page.click('#btn-confirm-import-nouveaux-animaux');
    const crees = await page.evaluate(() => DB.brebis.filter(b => /4600[123]$/.test(b.eid)).map(b => [b.eid.slice(-5), b.mouvements[0].importNature || null, b.mouvements[0].provenance || null, !!b.mouvements[0].dateInconnue]));
    eq(crees, [['46001', 'achat', 'Coop Exemple', false], ['46002', null, null, false], ['46003', 'achat', 'Vendeur Nouveau', true]], nom + ' : achetées marquées Achat avec leur provenance (orthographe de la liste), née jamais');
    eq(await page.evaluate(() => DB.acheteurs), ['Coop Exemple', 'Abattoir Test', 'Éleveur Test', 'Vendeur Nouveau'], nom + ' : provenance nouvelle ajoutée aux Partenaires');
    const ent = await page.evaluate(() => documentsCirculationCalcules({}).docs.filter(x => x.items.some(i => /4600[13]/.test(i.ref))).map(x => [x.partenaire, x.etat, x.manques]));
    check(ent.some(e => e[0] === 'Coop Exemple' && e[1] === 'complet') && ent.some(e => e[0] === 'Vendeur Nouveau' && e[1] === 'acompleter' && /date d'entrée/.test(e[2].join())), nom + ' : entrées à notifier ; sans date d\'entrée = à compléter : ' + JSON.stringify(ent));

    // création à la main d'un bélier acheté (activé) : origine sans réponse par défaut, provenance de la liste
    await page.evaluate(() => render('add-belier'));
    eq(await page.evaluate(() => [!!document.getElementById('cr-origine-bloc'), document.querySelectorAll('.cr-origine.selected').length, document.getElementById('cr-achat').classList.contains('hidden')]), [true, 0, true], nom + ' : origine proposée, sans réponse par défaut');
    await page.fill('#input-eid', '250000004599002'); await page.click('#btn-save-belier');
    eq(await page.evaluate(() => [DB.beliers.some(b => b.eid === '250000004599002'), document.getElementById('err').textContent]), [false, "Choisissez l'origine : né ici ou acheté."], nom + ' : sans origine, rien de créé');
    await page.click('.cr-origine[data-val="achetée"]');
    await page.fill('#input-date-entree', '2026-11-20'); await page.selectOption('#cr-provenance', 'Éleveur Test');
    await page.click('#btn-save-belier');
    eq(await page.evaluate(() => { const b = DB.beliers.find(x => x.eid === '250000004599002'); return [b.origine, b.mouvements[0].cause, b.mouvements[0].provenance, b.mouvements[0].date]; }), ['achetée', 'Achat', 'Éleveur Test', '2026-11-20'], nom + ' : bélier acheté = entrée « Achat » avec provenance');
    eq(await page.evaluate(() => documentsCirculationCalcules({}).docs.filter(x => x.items.some(i => i.ref.startsWith('beliers:250000004599002'))).map(x => [x.doc.sens, x.partenaire, x.etat])), [['entree', 'Éleveur Test', 'complet']], nom + ' : achat de bélier = entrée à notifier');
    await page.evaluate(() => render('add-sheep'));
    await page.fill('#input-eid', '250000004599003'); await page.click('.cr-origine[data-val="née"]'); await page.click('#btn-save-sheep');
    eq(await page.evaluate(() => { const b = DB.brebis.find(x => x.eid === '250000004599003'); return [b.origine, b.mouvements[0].cause]; }), ['née', 'Création (ajout manuel)'], nom + ' : brebis née ici = pas d\'entrée à notifier');

    // délai de notification réglé
    await page.evaluate(() => { parametresTab = 'regles'; parametresRubrique = 'regles'; render('parametres'); });
    check(await page.isVisible('#card-mouvements-ede'), nom + ' : carte « Mouvements » dans Règles d\'élevage');
    eq(await page.inputValue('#f-delai-notification'), '7', nom + ' : 7 jours au départ');
    await page.fill('#f-delai-notification', '2'); await page.click('#btn-save-delai-notification');
    eq(await page.evaluate(() => [DB.delaiNotificationEde, documentsCirculationCalcules({}).docs.find(x => x.doc.date === '2026-11-03').echeance]), [2, '2026-11-05'], nom + ' : délai réglé appliqué');
    // aller-retour de la liste du compte (synchro)
    eq(await page.evaluate(() => { const v = DB.documentsCirculation; return JSON.stringify(recordVersListeCompte(listeCompteVersRecord('documentsCirculation', v))) === JSON.stringify(v); }), true, nom + ' : liste du compte, aller-retour exact');
  } else {
    // mobile : carte en haut de Mouvements, consultation seule
    await page.evaluate(() => render('inventaire'));
    check(await page.isVisible('#dc-carte-mouvements'), nom + ' : carte « Documents de circulation » en haut de Mouvements');
    check(/1 à compléter|2 à compléter/.test(await page.textContent('#dc-carte-mouvements')), nom + ' : nombre à compléter');
    await page.click('#dc-carte-mouvements');
    eq(await page.evaluate(() => currentView), 'documents-circulation', nom + ' : la carte ouvre la liste');
    await page.click('.dc-carte');
    eq(await page.evaluate(() => [currentView, document.querySelectorAll('#app input, #app select').length, document.querySelectorAll('#app .btn-primary').length]), ['document-circulation', 0, 0], nom + ' : fiche en consultation seule');
  }
  check(!erreurs.length, nom + ' : aucune erreur JS ' + erreurs.join(' | '));
  await ctx.close();
}
await browser.close();
console.log('test_documents_circulation : OK');
