/* Saisies à récupérer (correctif de la perte du 23/11) : les sauvegardes faites AVANT la conversion (dossier interne Android) sont comparées au
   troupeau par CONTENU (brebis + campagne + date + agneaux), jamais par identifiant : même mise bas déjà là (autres ids, champs vides) = rien ;
   absente = proposée ; autre mise bas de la même brebis la même campagne = conflit montré, jamais remise. Soins des 7 jours avant la sauvegarde.
   « Tout récupérer » puis Annuler = fiches exactes ; Ignorer. Sauvegardes : nom horodaté à la seconde jamais réutilisé, lecture du dossier,
   copie hors de l'appli notée. Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
const erreurs = [];
p.on('pageerror', e => erreurs.push(e.message));
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);

await p.evaluate(() => {
  const f = (id, eid, extra) => Object.assign({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [], sanitaire: [] }, extra);
  DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = [
    f('a', '250000045651001', { numeroCourtTravailSieol: '501', agnelages: [{ id: 'eA', date: '2026-11-19', campagne: 2027, lambs: [{ id: 'eA1', sexe: 'Mâle', eid: '250000045671001' }] }] }),
    f('b', '250000045651002', { numeroCourtTravailSieol: '564' }),
    f('c', '250000045651003', { numeroCourtTravailSieol: '503', agnelages: [{ id: 'eC', date: '2026-11-20', campagne: 2027, lambs: [{ id: 'eC1', sexe: 'Femelle' }] }] })];
  DB.beliers = []; DB.agnelles = [];
  saveData(DB);
  // sauvegarde d'avant conversion : mêmes brebis, autres identifiants et champs vides (comme le serveur les rend)
  const copie = JSON.parse(JSON.stringify(DB));
  copie.exportedAt = '2026-11-23T13:02:10.000Z';
  copie.brebis[0].agnelages = [{ id: 'h9', date: '2026-11-19', campagne: 2027, codeRepro: null, note: '', lambs: [{ id: 'h91', sexe: 'Mâle', eid: '250000045671001', pere: null }] }];
  copie.brebis[1].agnelages = [{ id: 'hB', date: '2026-11-23', campagne: 2027, saisieA: 1795417200000, lambs: [{ id: 'hB1', sexe: 'Mâle', eid: '250000045671281', sanitaire: [{ id: 'hBS', date: '2026-11-23', produit: 'Produit A', type: 'Traitement' }] }] }];
  copie.brebis[1].sanitaire = [{ id: 'hS', date: '2026-11-22', produit: 'Produit B', type: 'Traitement' }, { id: 'hV', date: '2026-10-01', produit: 'Produit C', type: 'Vaccin' }];
  copie.brebis[2].agnelages = [{ id: 'hC', date: '2026-11-21', campagne: 2027, lambs: [{ id: 'hC1', sexe: 'Mâle' }] }];
  sauvegardesConversion = [{ nom: 'ovilog_avant_versions_20261123_140210.json', data: copie }];
  localStorage.removeItem('ovilog_recup_ignores');
  render('home');
});
const r = await p.evaluate(() => { const x = saisiesARecuperer(); return { items: x.items.map(i => i.id + ':' + i.type), conflits: x.conflits.map(i => i.id) }; });
eq(r, { items: ['b:misebas', 'b:sanitaire'], conflits: ['c'] }, 'comparaison par contenu : la 501 déjà là (autres ids, champs vides), la 564 et son soin récent à récupérer (soin d\'il y a 7 jours et plus : non), la 503 en conflit');
check(/Saisies à récupérer : 3/.test(await p.textContent('#pastille-recuperation')), 'pastille « Saisies à récupérer : 3 » sur l\'Accueil');
await p.click('#pastille-recuperation');
eq(await p.evaluate(() => [currentView, document.querySelectorAll('.rc-recuperer').length, /À vérifier \(1\)/.test(document.body.textContent)]), ['saisies-a-recuperer', 2, true], 'écran : 2 à récupérer, 1 à vérifier');
await p.evaluate(() => { window.__avant = JSON.stringify(DB.brebis); });
await p.click('#rc-tout');
const apres = await p.evaluate(() => { const b = DB.brebis.find(x => x.id === 'b'); return [b.agnelages.length, b.agnelages[0].lambs[0].eid, b.agnelages[0].id !== 'hB', b.agnelages[0].lambs[0].sanitaire.length, b.sanitaire.map(s => s.produit), DB.brebis.find(x => x.id === 'c').agnelages.length, saisiesARecuperer().items.length]; });
eq(apres, [1, '250000045671281', true, 1, ['Produit B'], 1, 0], 'Tout récupérer : mise bas (agneau et son soin) et soin remis avec un identifiant neuf, conflit jamais remis, plus rien à récupérer');
check(/2 saisies récupérées/.test(await p.textContent('.sup-snack')), 'bandeau « 2 saisies récupérées · Annuler »');
await p.click('#sup-snack-annuler');
eq(await p.evaluate(() => JSON.stringify(DB.brebis) === window.__avant), true, 'Annuler : fiches exactes d\'avant');
await p.evaluate(() => render('saisies-a-recuperer'));
await p.evaluate(() => document.querySelectorAll('.rc-recuperer')[0].click());
eq(await p.evaluate(() => [DB.brebis.find(x => x.id === 'b').agnelages.length, saisiesARecuperer().items.length]), [1, 1], 'Récupérer une seule saisie');
await p.evaluate(() => [...document.querySelectorAll('.rc-ignorer')].pop().click());
eq(await p.evaluate(() => saisiesARecuperer().conflits.length), 0, '« Ne plus montrer » : conflit écarté (cet appareil)');
console.log('OK récupération : comparaison par contenu, conflit montré jamais remis, Tout récupérer, Annuler exact, Ignorer.');

// sauvegardes : nom horodaté à la seconde jamais réutilisé, lecture du dossier interne, copie notée
const fs = await p.evaluate(async () => {
  const fichiers = {};
  const pris = nomFichierAvantConversion(new Date());
  fichiers[pris] = JSON.stringify({ brebis: [], exportedAt: '2026-11-23T13:02:10.000Z' });
  fichiers['ovilog_avant_versions_2026-11-22.json'] = JSON.stringify({ brebis: [{ id: 'x' }] });
  fichiers['ovilog_backup_20261120_100000.json'] = '{}';
  window.Capacitor = { Plugins: { Filesystem: {
    readdir: async () => ({ files: Object.keys(fichiers).map(name => ({ name })) }),
    readFile: async ({ path }) => ({ data: fichiers[path] }) } } };
  const libre = await nomLibreAvantConversion();
  const lues = await chargerSauvegardesAvantConversion();
  window.exporterFichierVisible = async () => ({ ok: true });
  const avant = sauvegardesConversionAExporter().length;
  ajouterListeLocale('ovilog_avant_exportees', [lues[0].nom]);
  const apres = sauvegardesConversionAExporter().length;
  delete window.Capacitor;
  return { libreDiffere: libre !== pris && /^ovilog_avant_versions_\d{8}_\d{6}(_\d+)?\.json$/.test(libre), lues: lues.map(l => l.nom).sort(), avant, apres };
});
check(fs.libreDiffere, 'nom de la sauvegarde avant conversion : horodaté à la seconde, jamais celui d\'un fichier existant');
eq([fs.lues.length, fs.lues.every(n => n.startsWith('ovilog_avant_')), fs.avant, fs.apres], [2, true, 2, 1], 'dossier interne : seules les sauvegardes d\'avant conversion sont lues ; une copiée hors de l\'appli n\'est plus à mettre à l\'abri');
eq(erreurs, [], 'aucune erreur de page');
await browser.close();
console.log('test_recuperation_saisies : OK');
