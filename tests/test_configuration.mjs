/* Première configuration en assistant (mobile : 3 étapes, PC : 2 étapes sans lecteur) et dates de campagne SAISIES : champs vides et obligatoires, fin postérieure au début, avertissements AMBRE sans blocage
   (fin ≠ veille du même jour l'an suivant ; nom de la campagne ≠ année de fin), nom d'après l'année de fin (« Campagne 2027 » pour 01-10-2026 → 30-09-2027), jour et mois du début = démarrage des campagnes suivantes,
   étape lecteur ignorable, rien d'écrit avant « Terminer », options de l'étape 2 (zéro / Nouveaux animaux / sauvegarde JSON : campagne masquée), changement de campagne (début proposé = lendemain de la fin, fin = veille
   du même jour l'an suivant, modifiables, à confirmer). Faux plugin Bluetooth, jeu synthétique, aucune donnée réelle. Logique de première connexion (compte lu avant toute écriture) : test_premiere_connexion. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
async function ouvrir(pc) {
  const page = await (await browser.newContext({ viewport: pc ? { width: 1300, height: 900 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
  await page.addInitScript((d) => {
    if (d) window.electronAPI = { isDesktop: true, version: '1.0.test' };
    else window.Capacitor = { Plugins: { BluetoothSerial: window.__fauxBt = {
      checkPermissions: async () => ({ connect: 'granted', scan: 'granted', fineLocation: 'granted' }), requestPermissions: async () => ({ connect: 'granted', scan: 'granted', fineLocation: 'granted' }),
      list: async () => ({ devices: [{ name: 'Allflex LPR 4812', address: 'AA:01' }] }), discoverUnpaired: async () => ({ devices: [{ name: 'Allflex LPR 3390', address: 'BB:02' }] }),
      addListener: async () => ({ remove() {} }), cancelDiscovery: async () => ({}), connect: async ({ address }) => { window.__connecte = address; return {}; }, disconnect: async () => ({}), available: async () => ({ available: 0 }), read: async () => ({ data: '' }) } } };
  }, !!pc);
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  const dialogues = []; page.on('dialog', d => { dialogues.push(d.message()); d.accept(); });
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate(() => { DB = migrateData({}); window.__saves = 0; const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); }; premconfEtat = null; render('premiere-configuration'); });
  return { page, dialogues };
}
const lire = (page, f, a) => page.evaluate(f, a);
const dates = async (page, d, f) => { await page.fill('#f-premconf-debut', d); await page.fill('#f-premconf-fin', f); };

for (const pc of [false, true]) {
  const nom = pc ? 'PC' : 'mobile', total = pc ? 2 : 3;
  const { page } = await ouvrir(pc);
  // ---------------- étape 1
  const e1 = await lire(page, () => ({ etape: document.querySelector('.assistant-tete .stp').textContent, titre: document.querySelector('.assistant-tete h1').textContent, logo: !!document.querySelector('.assistant-tete img[alt="Ovilog"]'), barre: document.querySelectorAll('.assistant-etapes i').length, actives: document.querySelectorAll('.assistant-etapes i.on').length,
    labels: [...document.querySelectorAll('#assistant-premiere-configuration label')].map(l => l.textContent), h: Math.round(document.getElementById('f-premconf-nom').getBoundingClientRect().height), boutons: [...document.querySelectorAll('.mn-barre .btn')].map(b => b.textContent), principaux: document.querySelectorAll('.mn-barre .btn-primary').length }));
  eq([e1.etape, e1.titre, e1.logo, e1.barre, e1.actives], ['Étape 1 sur ' + total, 'Votre exploitation', true, total, 1], nom + ' : étape 1, logo en tête, barre de progression à ' + total + ' étapes');
  eq(e1.labels, ["Nom de l'exploitation", 'N° de cheptel', 'Indicatif de marquage', 'Adresse', 'Téléphone'], nom + ' : champs de l\'exploitation');
  eq([e1.h, e1.boutons, e1.principaux], [pc ? 44 : 48, ['Continuer'], 1], nom + ' : champs de ' + (pc ? 44 : 48) + ' px, un seul bouton « Continuer »');
  await page.fill('#f-premconf-nom', 'GAEC de la Combe'); await page.fill('#f-premconf-cheptel', '81 123 456'); await page.fill('#f-premconf-marquage', 'FR 81 123'); await page.fill('#f-premconf-adresse', 'La Combe, 81000 Albi'); await page.fill('#f-premconf-tel', '06 12 34 56 78');
  await page.click('#btn-premconf-suivant');
  // ---------------- étape 2 : options + campagne de départ (champs vides)
  const e2 = await lire(page, () => ({ etape: document.querySelector('.assistant-tete .stp').textContent, titre: document.querySelector('.assistant-tete h1').textContent, options: [...document.querySelectorAll('.assistant-option')].map(o => o.querySelector('b').textContent + (o.classList.contains('on') ? '*' : '')),
    debut: document.getElementById('f-premconf-debut').value, fin: document.getElementById('f-premconf-fin').value, nomCamp: document.getElementById('premconf-nom-campagne').classList.contains('hidden'), info: document.querySelector('#premconf-campagne .info').textContent,
    boutons: [...document.querySelectorAll('.mn-barre .btn')].map(b => b.textContent) }));
  eq([e2.etape, e2.titre], ['Étape 2 sur ' + total, 'Vos données'], nom + ' : étape 2');
  eq(e2.options, ['Partir de zéro*', 'Nouveaux animaux', 'Restaurer une sauvegarde'], nom + ' : options (imports existants, libellés actuels)');
  eq([e2.debut, e2.fin, e2.nomCamp], ['', '', true], nom + ' : dates VIDES, aucun pré-remplissage, aucun nom de campagne tant qu\'elles ne sont pas valides');
  eq(e2.info, "Nommée d'après l'année de fin. Dates modifiables, elles servent aux bilans et exports.", nom + ' : ligne d\'information');
  eq(e2.boutons, ['Retour', pc ? 'Terminer' : 'Continuer'], nom + ' : Retour / ' + (pc ? 'Terminer' : 'Continuer'));
  check(await lire(page, () => window.__saves) === 0, nom + ' : rien n\'est écrit avant « Terminer »');
  // champs obligatoires
  await page.click('#btn-premconf-suivant');
  check(await lire(page, () => document.querySelectorAll('#premconf-dates-msg [data-erreur]').length > 0 && document.querySelector('.assistant-tete .stp').textContent.startsWith('Étape 2')), nom + ' : dates vides : message et on reste sur l\'étape');
  await dates(page, '2026-10-01', '');
  await page.click('#btn-premconf-suivant');
  check(/date de fin/.test(await lire(page, () => document.getElementById('premconf-dates-msg').textContent)) && await lire(page, () => document.querySelector('.assistant-tete .stp').textContent.startsWith('Étape 2')), nom + ' : fin manquante : bloqué');
  // fin postérieure au début
  await dates(page, '2026-10-01', '2026-10-01');
  let m = await lire(page, () => ({ erreurs: [...document.querySelectorAll('#premconf-dates-msg [data-erreur]')].map(e => e.textContent), fond: getComputedStyle(document.querySelector('#premconf-dates-msg [data-erreur]')).backgroundColor, nom: document.getElementById('premconf-nom-campagne').classList.contains('hidden') }));
  eq([m.erreurs, m.fond, m.nom], [['La fin de la campagne doit être postérieure à son début.'], 'rgb(251, 227, 224)', true], nom + ' : fin ≤ début : erreur (rouge), bloqué, pas de nom');
  await page.click('#btn-premconf-suivant');
  check(await lire(page, () => document.querySelector('.assistant-tete .stp').textContent.startsWith('Étape 2')), nom + ' : fin ≤ début : on ne passe pas');
  await dates(page, '2026-10-01', '2026-09-30');
  check(await lire(page, () => document.querySelectorAll('#premconf-dates-msg [data-erreur]').length === 1), nom + ' : fin avant le début : erreur');
  // campagne normale : nom d'après l'année de fin, aucun avertissement
  await dates(page, '2026-10-01', '2027-09-30');
  m = await lire(page, () => ({ nom: document.getElementById('premconf-nom-campagne').textContent, cache: document.getElementById('premconf-nom-campagne').classList.contains('hidden'), msgs: document.querySelectorAll('#premconf-dates-msg > *').length }));
  eq([m.nom, m.cache, m.msgs], ['Campagne 2027', false, 0], nom + ' : 01-10-2026 → 30-09-2027 = « Campagne 2027 » (année de fin), aucun avertissement');
  // fin inhabituelle : avertissement ambre, jamais bloquant
  await dates(page, '2026-10-01', '2027-12-31');
  m = await lire(page, () => ({ avert: [...document.querySelectorAll('#premconf-dates-msg [data-avertissement]')].map(e => e.textContent), fond: getComputedStyle(document.querySelector('#premconf-dates-msg [data-avertissement]')).backgroundColor, erreurs: document.querySelectorAll('#premconf-dates-msg [data-erreur]').length }));
  check(m.avert.length >= 1 && /veille du même jour l'an suivant \(30-09-2027\)/.test(m.avert[0]) && /restera?ont sur 12 mois/.test(m.avert[0]) && m.fond === 'rgb(251, 238, 215)' && m.erreurs === 0, nom + ' : fin inhabituelle : avertissement ambre : ' + JSON.stringify(m));
  // campagne dans une seule année civile : le nom donné par Ovilog est l'année de début + 1, signalé
  await dates(page, '2027-01-01', '2027-12-31');
  m = await lire(page, () => ({ nom: document.getElementById('premconf-nom-campagne').textContent, avert: [...document.querySelectorAll('#premconf-dates-msg [data-avertissement]')].map(e => e.textContent) }));
  check(m.nom === 'Campagne 2028' && m.avert.length === 1 && /nommera cette campagne « Campagne 2028 »/.test(m.avert[0]), nom + ' : campagne dans une seule année civile : le nom réel est annoncé : ' + JSON.stringify(m));
  // fin inhabituelle acceptée : on passe
  await dates(page, '2026-10-01', '2027-12-31');
  // « Retour » garde les saisies
  await page.click('#btn-premconf-retour');
  eq(await lire(page, () => [document.getElementById('f-premconf-nom').value, document.getElementById('f-premconf-tel').value]), ['GAEC de la Combe', '06 12 34 56 78'], nom + ' : « Retour » conserve les saisies de l\'étape 1');
  await page.click('#btn-premconf-suivant');
  eq(await lire(page, () => [document.getElementById('f-premconf-debut').value, document.getElementById('f-premconf-fin').value]), ['2026-10-01', '2027-12-31'], nom + ' : les dates saisies sont conservées');
  // restaurer une sauvegarde : la campagne est masquée
  await page.click('.assistant-option[data-source="json"]');
  check(await lire(page, () => !document.getElementById('premconf-campagne') && !!document.getElementById('premconf-campagne-json')), nom + ' : « Restaurer une sauvegarde » masque la carte « Campagne de départ »');
  await page.click('.assistant-option[data-source="zero"]');
  await dates(page, '2026-10-01', '2027-09-30');

  if (!pc) {
    // ---------------- étape 3 : lecteur (mobile seulement), ignorable
    await page.click('#btn-premconf-suivant');
    const e3 = await lire(page, () => ({ etape: document.querySelector('.assistant-tete .stp').textContent, titre: document.querySelector('.assistant-tete h1').textContent, boutons: [...document.querySelectorAll('.mn-barre .btn')].map(b => b.textContent), rech: document.getElementById('btn-rechercher-lecteur').textContent, barre: document.querySelectorAll('.assistant-etapes i.on').length }));
    eq([e3.etape, e3.titre, e3.boutons, e3.rech, e3.barre], ['Étape 3 sur 3', 'Lecteur de boucles', ['Plus tard', 'Terminer'], 'Rechercher', 3], nom + ' : étape 3 « Lecteur »');
    await page.click('#btn-rechercher-lecteur');
    await page.waitForSelector('.btn-connecter-lecteur');
    const l = await lire(page, () => ({ noms: [...document.querySelectorAll('.assistant-appareil b')].map(b => b.textContent), rech: document.getElementById('btn-rechercher-lecteur').textContent }));
    eq(l.noms, ['Allflex LPR 4812', 'Allflex LPR 3390'], nom + ' : lecteurs détectés (appairés puis à proximité)'); eq(l.rech, 'Rechercher à nouveau', nom + ' : « Rechercher à nouveau »');
    await page.click('.btn-connecter-lecteur[data-address="BB:02"]');
    await page.waitForFunction(() => !!document.querySelector('.assistant-appareil .mb-pastille.vert'));
    eq(await lire(page, () => [window.__connecte, DB.lecteurBluetooth && DB.lecteurBluetooth.address, DB.lecteurBluetooth && DB.lecteurBluetooth.name]), ['BB:02', 'BB:02', 'Allflex LPR 3390'], nom + ' : « Connecter » connecte et mémorise le lecteur');
  }
  // ---------------- Terminer : enregistrement
  const avant = await lire(page, () => ({ saves: window.__saves, nom: DB.exploitation.nom }));
  eq(avant.nom, '', nom + ' : exploitation encore vide avant « Terminer »');
  await page.click('#btn-premconf-suivant');
  await page.waitForFunction(() => currentView === 'home');
  const f = await lire(page, () => ({ ex: DB.exploitation, debut: DB.campagneDebut, dd: DB.campagneDateDebut, df: DB.campagneDateFin, label: campagneLabel(DB.campagneDebut), ref: [campagneDebutISO(DB.campagneDebut), campagneFinISO(DB.campagneDebut), formatISOLocal(campagneDateFinReelle())], suiv: [campagneDebutISO(DB.campagneDebut + 1), campagneFinISO(DB.campagneDebut + 1)], necessaire: premiereConfigurationCampagneNecessaire(), typeSuivi: DB.exploitation.typeSuivi, saves: window.__saves }));
  eq([f.ex.nom, f.ex.numeroCheptel, f.ex.indicatifMarquage, f.ex.adresse, f.ex.telephone], ['GAEC de la Combe', '81 123 456', 'FR 81 123', 'La Combe, 81000 Albi', '06 12 34 56 78'], nom + ' : exploitation enregistrée');
  eq([f.ex.campagneMoisDebut, f.ex.campagneJourDebut, f.debut, f.dd, f.df, f.label], [10, 1, 2026, '2026-10-01', '2027-09-30', 2027], nom + ' : jour et mois de démarrage, année, dates saisies, nom « Campagne 2027 »');
  eq(f.ref, ['2026-10-01', '2027-09-30', '2027-09-30'], nom + ' : début, fin et fin réelle = dates saisies');
  eq(f.suiv, ['2027-10-01', '2028-09-30'], nom + ' : les campagnes SUIVANTES restent sur 12 mois (jour et mois du début)');
  eq([f.necessaire, f.typeSuivi], [false, null], nom + ' : configuration faite ; le type de suivi laitier reste à régler dans Paramètres › Exploitation');
  check(f.saves >= 1 && !(pc && await lire(page, () => !!DB.lecteurBluetooth)), nom + ' : enregistré, pas de lecteur sur PC');
  console.log('OK ' + nom + ' : assistant en ' + total + ' étapes, dates saisies (vides, obligatoires, fin > début, avertissements ambre), campagne nommée d\'après la fin, rien d\'écrit avant « Terminer »' + (pc ? ', aucun lecteur.' : ', lecteur détecté / connecté.'));
}

// ---------------- étape lecteur ignorable (« Plus tard »), et issues de l'étape 2 (Nouveaux animaux, sauvegarde JSON)
{
  const { page } = await ouvrir(false);
  await page.click('#btn-premconf-suivant'); await dates(page, '2026-10-01', '2027-09-30'); await page.click('#btn-premconf-suivant');
  await page.click('#btn-premconf-retour');          // « Plus tard » : on termine sans lecteur
  await page.waitForFunction(() => currentView === 'home');
  eq(await lire(page, () => [DB.lecteurBluetooth, DB.campagneDateFin]), [null, '2027-09-30'], 'mobile : « Plus tard » ignore le lecteur et termine quand même');
}
{
  const { page } = await ouvrir(true);
  await page.click('#btn-premconf-suivant'); await page.click('.assistant-option[data-source="csv"]'); await dates(page, '2026-10-01', '2027-09-30'); await page.click('#btn-premconf-suivant');
  await page.waitForFunction(() => currentView === 'import-nouveaux-animaux');
  check(await lire(page, () => DB.campagneDateDebut === '2026-10-01'), 'PC : « Nouveaux animaux » : la configuration est enregistrée puis l\'import existant s\'ouvre');
}
{
  const { page } = await ouvrir(false);
  await page.click('#btn-premconf-suivant'); await page.click('.assistant-option[data-source="json"]'); await page.click('#btn-premconf-suivant');   // étape 3
  await page.click('#btn-premconf-suivant');                                                                                                      // Terminer
  await page.waitForFunction(() => currentView === 'parametres');
  eq(await lire(page, () => [parametresTab, DB.campagneDateDebut, premiereConfigurationCampagneNecessaire()]), ['sauvegarde', null, true], 'mobile : « Restaurer une sauvegarde » : étape 3 puis Paramètres › Sauvegarde ; aucune campagne inventée (la sauvegarde apporte la sienne)');
}

// ---------------- changement de campagne : dates proposées, modifiables, à confirmer
{
  const { page, dialogues } = await ouvrir(false);
  await page.evaluate(() => {
    DB.exploitation.campagneMoisDebut = 10; DB.exploitation.campagneJourDebut = 1; DB.campagneDebut = 2026; DB.campagneDateDebut = '2026-10-01'; DB.campagneDateFin = '2027-09-30'; DB.campagneInitialisee = true; DB.campagneDateDemarrage = '2026-10-01';
    DB.brebis = [{ id: 's1', eid: '250016299900001', statut: 'active', createdAt: 1, echographies: [], agnelages: [{ date: '2026-11-01', campagne: 2026, lambs: [{ sexe: 'Mâle' }] }], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }];
    DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; saveData(DB); render('confirmation-nouvelle-campagne');
  });
  await page.waitForSelector('#carte-dates-nouvelle-campagne');
  const p = await lire(page, () => ({ debut: document.getElementById('f-nc-debut').value, fin: document.getElementById('f-nc-fin').value, nom: document.getElementById('nc-nom').textContent, valider: document.getElementById('btn-confirmer-nouvelle-campagne').disabled, seuil: !!document.getElementById('f-avant-seuil-confirm') }));
  eq([p.debut, p.fin, p.nom], ['2027-10-01', '2028-09-30', 'Campagne 2028'], 'bascule : début proposé = lendemain de la fin (2027-10-01), fin = veille du même jour l\'an suivant (2028-09-30)');
  check(p.valider, 'bascule : « Valider » désactivé tant que les dates ne sont pas confirmées');
  await page.fill('#f-nc-fin', '2027-10-01');
  check(await lire(page, () => document.querySelectorAll('#nc-dates-msg .msg-charte.bloc').length === 1), 'bascule : fin ≤ début : erreur');
  await page.check('#f-nc-confirm'); check(await lire(page, () => document.getElementById('btn-confirmer-nouvelle-campagne').disabled), 'bascule : des dates invalides ne se confirment pas');
  await page.fill('#f-nc-debut', '2027-10-05'); await page.fill('#f-nc-fin', '2028-10-04');
  check(await lire(page, () => !document.getElementById('f-nc-confirm').checked && document.getElementById('btn-confirmer-nouvelle-campagne').disabled), 'bascule : modifier une date retire la confirmation');
  await page.check('#f-nc-confirm');
  if (await page.$('#f-avant-seuil-confirm')) await page.check('#f-avant-seuil-confirm');
  check(await lire(page, () => !document.getElementById('btn-confirmer-nouvelle-campagne').disabled), 'bascule : dates valides et confirmées : « Valider » actif');
  await page.click('#btn-confirmer-nouvelle-campagne');
  await page.waitForSelector('#btn-continuer-resultat-campagne', { timeout: 20000 });
  eq(await lire(page, () => [DB.campagneDebut, DB.campagneDateDebut, DB.campagneDateFin, campagneLabel(DB.campagneDebut), periodeNominaleTitre(DB.campagneDebut).titre]), [2027, '2027-10-05', '2028-10-04', 2028, 'du 05/10/2027 au 04/10/2028'], 'bascule : la nouvelle campagne prend les dates confirmées (aussi dans les périodes affichées et exportées)');
  void dialogues;
}

// ---------------- Paramètres › Campagne : dates de la campagne en cours, modifiables
{
  const { page } = await ouvrir(false);
  await page.evaluate(() => { DB.exploitation.campagneMoisDebut = 10; DB.exploitation.campagneJourDebut = 1; DB.campagneDebut = 2026; DB.campagneDateDebut = '2026-10-01'; DB.campagneDateFin = '2027-12-31'; parametresTab = 'campagne'; parametresRubrique = 'campagne'; render('parametres'); });
  check(/du 01-10-2026 au 31-12-2027/.test(await lire(page, () => document.getElementById('prm-campagne-periode').textContent)), 'Paramètres › Campagne : période = dates saisies');
  await page.click('#btn-modifier-dates-campagne');
  await page.fill('#f-prm-fin', '2026-09-01');
  check(await lire(page, () => document.getElementById('btn-enregistrer-dates-campagne').disabled), 'Paramètres › Campagne : fin avant le début : enregistrement impossible');
  await page.fill('#f-prm-fin', '2027-09-30'); await page.click('#btn-enregistrer-dates-campagne');
  eq(await lire(page, () => [DB.campagneDateFin, DB.campagneDateDebut]), ['2027-09-30', '2026-10-01'], 'Paramètres › Campagne : dates modifiées et enregistrées');
}
console.log('OK : première configuration, dates de campagne saisies, étape lecteur, changement de campagne, Paramètres › Campagne.');
await browser.close();
