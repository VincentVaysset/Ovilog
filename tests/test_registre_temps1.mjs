/* Étape B, temps 1 : sur un compte MIGRÉ (registre dans sa collection dédiée), cette version ne lit ni n'écrit plus la copie meta.registre ; rien n'est effacé.
   Faux serveur, deux appareils à jour (A mobile, B PC) et un « ancien appareil » 1.0.290 simulé par des écritures directes de la copie dans meta.
   1) l'ancien appareil écrit une copie DIFFÉRENTE (entrée fantôme, mouvement en plus) : le registre de A vient UNIQUEMENT de la collection ;
   2) A enregistre un réglage puis archive un animal : la copie du serveur reste identique (octet pour octet), aucune écriture de meta par A ne contient
      « registre », l'animal arrive dans la collection et au registre affiché ;
   3) B se connecte alors que la copie est PLUS RÉCENTE que la collection : B n'affiche que la collection ; l'ancien appareil réécrit encore la copie : rien ne bouge ;
   4) vente d'une agnelle HORS LIGNE sur A, puis retour du réseau : une seule entrée dans la collection, sans doublon ni perte, reçue par B ;
   5) dédoublonnage du registre sur A (export de sauvegarde + confirmation) : éléments retirés dans la collection, propagés à B, copie intacte ;
   6) compte NON migré : comportement d'avant (la copie meta.registre est lue). Comptes jetables, aucune donnée réelle. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const metaServeur = async uid => { const r = await (await fetch('http://127.0.0.1:' + h.port + '/getdoc?uid=' + uid + '&col=meta&id=main')).json(); return r.data || null; };
const collection = async uid => (await h.serveur(uid, 'registre')).docs || {};
const eidsCollection = async uid => Object.values(await collection(uid)).map(d => d.categorie + ':' + d.eid).sort();
const eidsAffiches = dev => dev.page.evaluate(() => ['brebis', 'beliers', 'agnelles'].flatMap(c => Object.keys((DB.registre || {})[c] || {}).map(e => c + ':' + e)).sort());
const E = n => '25000000456' + String(n).padStart(4, '0');
const mv = (type, date, extra) => Object.assign({ type, date }, extra || {});
const COPIE_ANCIENNE = (fantome) => ({ brebis: { [E(1)]: { mouvements: [mv('Entrée', '2024-01-01'), mv('Vente', '2026-02-02', { acheteur: 'Acheteur C' }), mv('Vente', '2026-03-03', { acheteur: 'Acheteur D' })] }, [fantome]: { mouvements: [mv('Morte', '2026-01-05')] } }, beliers: {}, agnelles: {} });

// Plugins de fichiers simulés (export de sauvegarde exigé avant le dédoublonnage), comme test_dedoublonnage_registre
const fauxPlugins = dev => dev.page.evaluate(() => {
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  window.__fs = {}; window.__docs = {};
  window.Capacitor = Object.assign(window.Capacitor || {}, { Plugins: Object.assign((window.Capacitor || {}).Plugins || {}, {
    Filesystem: { checkPermissions: async () => ({ publicStorage: 'granted' }), requestPermissions: async () => ({}),
      writeFile: async ({ path, data, directory }) => { window.__fs[directory + '/' + path] = b64(data); return {}; },
      readFile: async ({ path, directory }) => { const b = window.__fs[directory + '/' + path]; if (!b) throw new Error('File does not exist'); return { data: new TextDecoder().decode(b) }; },
      readdir: async ({ directory }) => ({ files: Object.keys(window.__fs).filter(k => k.startsWith(directory + '/')).map(k => ({ name: k.slice(directory.length + 1) })) }),
      deleteFile: async ({ path, directory }) => { delete window.__fs[directory + '/' + path]; }, getUri: async ({ path, directory }) => ({ uri: 'file:///fake/' + directory + '/' + path }) },
    FileSaver: { saveAs: async (a) => { const src = window.__fs[a.directory + '/' + a.path]; const uri = 'content://fake/' + a.fileName; window.__docs[uri] = src.slice(); return { ok: true, uri, taille: src.length, nom: 'Sauvegarde.json' }; },
      readUri: async ({ uri, asText }) => { const d = window.__docs[uri]; return { ok: true, taille: d.length, texte: asText ? new TextDecoder().decode(d) : undefined }; } },
    Share: { share: async () => ({}) } }) });
});

try {
  // ================================================================ mise en place : compte migré, registre dans la collection, copie écrite par un « ancien appareil »
  const A = await h.ouvrir({ contexte: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } });
  await h.inscrire(A, 'eleveur@example.fr', 'secret1');
  await h.attendre(A, () => currentView === 'premiere-configuration' || currentView === 'home', { label: 'A connecté' });
  await A.page.evaluate(({ E1, E2 }) => {
    DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.exploitation = Object.assign(DB.exploitation || {}, { nom: 'Ferme du Test', indicatifMarquage: '000456' });
    DB.registreCollectionMigree20260930 = true;
    DB.registre = { brebis: { [E1]: { mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', date: '2026-02-02', acheteur: 'Acheteur C' }, { type: 'Vente', date: '2026-02-02', acheteur: 'Acheteur C' }] } }, beliers: {}, agnelles: {} };
    DB.brebis = [{ id: 'b2', eid: E2, statut: 'vendue', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], controleLaitier: [], modesRepro: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', date: '2026-04-04', acheteur: 'Acheteur D' }] }];
    DB.agnelles = [{ id: 'ag1', eid: '25000000456' + '0030', origine: 'née', statut: 'active', sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-01-15' }], modesRepro: [] }];
    saveData(DB); render('home');
  }, { E1: E(1), E2: E(2) });
  await h.attendreServeur(A.uid, 'registre', s => Object.keys(s.docs || {}).length === 1, 'entrée du registre dans la collection');
  await h.attendreCalme(A.uid);
  const COPIE = COPIE_ANCIENNE(E(99));
  await h.ecrireServeur(A.uid, [{ type: 'update', path: 'users/' + A.uid + '/meta/main', data: { registre: COPIE } }]);   // l'ancien appareil 1.0.290 réécrit sa copie
  await A.page.waitForTimeout(1500);

  // ================================================================ 1. la copie différente n'entre jamais dans le registre de A
  eq(await eidsAffiches(A), ['brebis:' + E(1)], 'A : registre affiché = collection seule (pas d\'entrée fantôme venue de la copie)');
  eq(await A.page.evaluate(e => DB.registre.brebis[e].mouvements.length, E(1)), 3, 'A : contenu de l\'entrée = celui de la collection, pas celui de la copie');
  console.log('OK 1 copie différente écrite par un ancien appareil : ignorée, le registre de A vient uniquement de la collection.');

  // ================================================================ 2. A enregistre un réglage et archive un animal : la copie du serveur ne bouge pas
  const avant = JSON.stringify((await metaServeur(A.uid)).registre);
  const nJournal = (await h.journal(A.uid)).length;
  await A.page.evaluate(() => { DB.exploitation.nom = 'Ferme du Test modifiée'; saveData(DB); });
  const r = await A.page.evaluate(async () => { const a = DB.brebis[0]; const res = await archiverEtRetirerFicheComplete('brebis', a); saveData(DB); return res; });
  check(r.ok, 'archivage confirmé : ' + JSON.stringify(r));
  await h.attendreServeur(A.uid, 'registre', s => Object.keys(s.docs || {}).length === 2, 'animal archivé dans la collection');
  await h.attendreCalme(A.uid);
  const mServeur = await metaServeur(A.uid);
  eq(mServeur.exploitation.nom, 'Ferme du Test modifiée', 'le réglage est bien arrivé au serveur');
  check(JSON.stringify(mServeur.registre) === avant, 'copie meta.registre du serveur identique octet pour octet');
  const ecrituresMetaA = (await h.journal(A.uid)).slice(nJournal).filter(j => j.clientId !== 'test-direct').flatMap(j => j.ops).filter(o => /\/meta\//.test(o.path));
  check(ecrituresMetaA.length > 0 && ecrituresMetaA.every(o => Array.isArray(o.cles) && !o.cles.includes('registre')), 'aucune écriture de meta par A ne contient « registre » : ' + JSON.stringify(ecrituresMetaA));
  eq(await eidsCollection(A.uid), ['brebis:' + E(1), 'brebis:' + E(2)].sort(), 'collection : l\'animal archivé est arrivé');
  eq(await eidsAffiches(A), ['brebis:' + E(1), 'brebis:' + E(2)].sort(), 'A : l\'animal archivé est au registre affiché');
  check(await A.page.evaluate(e => { registreView = 'mouvements'; render('registre'); return document.getElementById('app').textContent.includes(numeroVisuel(e)); }, E(2)), 'A : l\'animal archivé apparaît à l\'écran Registre');
  console.log('OK 2 réglage + archivage : copie du serveur intacte, aucune écriture de « registre » dans meta, animal archivé dans la collection et à l\'écran.');

  // ================================================================ 3. B (à jour) arrive alors que la copie est plus récente que la collection
  await h.ecrireServeur(A.uid, [{ type: 'update', path: 'users/' + A.uid + '/meta/main', data: { registre: COPIE_ANCIENNE(E(98)) } }]);
  const B = await h.ouvrir({ desktop: true, contexte: { viewport: { width: 1500, height: 950 } } });
  await h.connecter(B, 'eleveur@example.fr', 'secret1');
  await h.attendre(B, () => ['brebis', 'beliers', 'agnelles'].reduce((n, c) => n + Object.keys((DB.registre || {})[c] || {}).length, 0) === 2, { label: 'B : registre chargé' });
  await B.page.waitForTimeout(1200);
  eq(await eidsAffiches(B), ['brebis:' + E(1), 'brebis:' + E(2)].sort(), 'B : registre = collection seule, malgré une copie plus récente et différente');
  await h.ecrireServeur(A.uid, [{ type: 'update', path: 'users/' + A.uid + '/meta/main', data: { registre: COPIE_ANCIENNE(E(97)) } }]);
  await B.page.waitForTimeout(1500);
  eq([await eidsAffiches(A), await eidsAffiches(B)], [['brebis:' + E(1), 'brebis:' + E(2)].sort(), ['brebis:' + E(1), 'brebis:' + E(2)].sort()], 'nouvelle copie de l\'ancien appareil : A et B ne bougent pas');
  console.log('OK 3 B à jour : registre = collection seule même avec une copie plus récente ; une nouvelle copie de l\'ancien appareil ne change rien.');

  // ================================================================ 4. vente d'une agnelle hors ligne sur A, puis retour du réseau
  await h.reseau(A, { coupe: true });
  await A.page.evaluate(() => {   // mêmes étapes que la fenêtre « Vendre » de l'agnelle (confirmation acceptée)
    const ag = DB.agnelles[0]; ag.mouvements.push({ type: 'Vente', cause: null, acheteur: 'Acheteur C', date: '2026-10-20' }); ag.statut = 'vendue';
    archiverDansRegistre('agnelles', ag.eid, { sanitaire: ag.sanitaire, mouvements: ag.mouvements });
    DB.agnelles = DB.agnelles.filter(a => a.id !== ag.id); saveData(DB);
  });
  await A.page.waitForTimeout(1500);
  eq((await eidsCollection(A.uid)).filter(x => x.startsWith('agnelles:')).length, 0, 'hors ligne : rien n\'arrive encore au serveur');
  await h.reseau(A, { coupe: false });
  await h.attendreServeur(A.uid, 'registre', s => Object.values(s.docs || {}).some(d => d.categorie === 'agnelles'), 'agnelle vendue dans la collection au retour du réseau');
  await h.attendreCalme(A.uid);
  const agDocs = Object.values(await collection(A.uid)).filter(d => d.categorie === 'agnelles');
  eq([agDocs.length, agDocs[0].mouvements.length, agDocs[0].mouvements[1].acheteur], [1, 2, 'Acheteur C'], 'une seule entrée, complète (entrée + vente), sans doublon');
  await h.attendre(B, () => Object.keys((DB.registre || {}).agnelles || {}).length === 1, { label: 'B : agnelle vendue reçue' });
  eq(await B.page.evaluate(() => Object.values(DB.registre.agnelles)[0].mouvements.length), 2, 'B : même entrée, sans doublon ni perte');
  check(JSON.stringify((await metaServeur(A.uid)).registre) === JSON.stringify(COPIE_ANCIENNE(E(97))), 'copie du serveur toujours intacte après la synchro hors ligne');
  console.log('OK 4 vente hors ligne : une seule entrée dans la collection au retour du réseau, reçue par B, sans doublon ni perte ; copie intacte.');

  // ================================================================ 5. dédoublonnage (export + confirmation) sur A : propagé à B, copie intacte
  await fauxPlugins(A);
  await A.page.evaluate(() => { parametresRubrique = 'sauvegarde'; prmMaintenanceOuvert = true; render('parametres'); });
  await A.page.waitForSelector('#btn-dd-analyser');
  await A.page.click('#btn-dd-analyser');
  await A.page.waitForSelector('#btn-dd-appliquer:not([disabled])');
  await A.page.click('#btn-dd-appliquer');
  await h.attendre(A, () => !dedoublonRegistreEnCours && /✅|⚠️/.test(doublonsRegistreEtat.message), { label: 'dédoublonnage terminé' });
  check(/✅/.test(await A.page.evaluate(() => doublonsRegistreEtat.message)), 'dédoublonnage réussi : ' + await A.page.evaluate(() => doublonsRegistreEtat.message));
  await h.attendreServeur(A.uid, 'registre', s => { const d = Object.values(s.docs || {}).find(x => x.eid === E(1)); return d && d.mouvements.length === 2; }, 'doublon retiré dans la collection');
  await h.attendre(B, e => DB.registre.brebis[e] && DB.registre.brebis[e].mouvements.length === 2, { label: 'B : doublon retiré reçu', arg: E(1) });
  check(JSON.stringify((await metaServeur(A.uid)).registre) === JSON.stringify(COPIE_ANCIENNE(E(97))), 'copie du serveur toujours intacte après le dédoublonnage');
  console.log('OK 5 dédoublonnage (export de sauvegarde, confirmation) : élément retiré dans la collection, propagé à B ; copie intacte.');

  // ================================================================ 6. compte NON migré : la copie meta.registre reste lue (comportement d'avant)
  const C = await h.ouvrir({ contexte: { viewport: { width: 390, height: 844 } } });
  await h.inscrire(C, 'eleveur2@example.fr', 'secret1');
  await h.attendre(C, () => currentView === 'premiere-configuration' || currentView === 'home', { label: 'C connecté' });
  await h.attendreCalme(C.uid);
  const lu = await C.page.evaluate(() => { const s = window.OvilogSync; return typeof s.mesureMeta === 'function'; });
  check(lu, 'OvilogSync disponible');
  await C.page.evaluate(() => { DB.registreCollectionMigree20260930 = false; });
  await h.ecrireServeur(C.uid, [{ type: 'update', path: 'users/' + C.uid + '/meta/main', data: { registreCollectionMigree20260930: false, registre: { brebis: { [ '250000000456' + '0077' ]: { mouvements: [{ type: 'Entrée', date: '2024-01-01' }] } }, beliers: {}, agnelles: {} } } }]);
  await h.attendre(C, () => Object.keys((DB.registre || {}).brebis || {}).length === 1, { label: 'C (non migré) : copie meta.registre lue comme avant' });
  console.log('OK 6 compte non migré : la copie meta.registre est lue comme avant.');

  console.log('OK test_registre_temps1');
} finally { await h.fin(); }
