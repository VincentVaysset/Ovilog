/* Import « Nouveaux animaux » : l'EID du fichier est accepté sur 11 chiffres (n° national) ou 15 chiffres (EID complet), espaces ignorés, et TOUJOURS enregistré sur 15 chiffres
   (« 2500 » + 11 chiffres). Un autre format est invalide (ligne non créée, motif affiché). Un animal « né » dont l'EID ne porte pas l'indicatif de marquage de l'exploitation
   donne un avertissement AMBRE (jamais un blocage) ; une « achetée » n'en donne pas. Non-doublon : un animal importé en 11 chiffres est reconnu en 15 chiffres (et l'inverse), y compris
   face à une fiche ancienne enregistrée sur 11 chiffres. Après import : âge lu dans l'EID juste, animal retrouvé au bip. Passe par le vrai écran d'import (fichier .xlsx généré par
   buildXlsxWorkbook). Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1200 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
const dialogues = [];
page.on('dialog', d => { dialogues.push(d.message()); d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.evaluate(() => {
  DB = migrateData({}); saveData = function () { return true; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation.indicatifMarquage = '162991';
  DB.brebis = [{ id: 'ancienne', eid: '16299153003', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }];   // fiche ANCIENNE, enregistrée sur 11 chiffres
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
});

// ---- 1. la fonction pure
const pur = await page.evaluate(() => ['16299151001', '16299 15 1001', '250016299151001', '2500 16299 151001', '1629915100', '250016299151', 'ABC1629915', '16299151001x', '', '  '].map(v => normaliserEidImport(v)));
eq(pur.map(r => [r.eid, r.valide]), [['250016299151001', true], ['250016299151001', true], ['250016299151001', true], ['250016299151001', true], ['1629915100', false], ['250016299151', false], ['ABC1629915', false], ['16299151001x', false], ['', true], ['', true]], 'normaliserEidImport : 11 ou 15 chiffres acceptés (espaces ignorés), le reste invalide');

// ---- 2. import par le vrai écran
const fichier = async (feuilles) => {
  const octets = await page.evaluate(async (f) => Array.from(await buildXlsxWorkbook(f)), feuilles);
  return { name: 'Modele_Nouveaux_Animaux.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(octets) };
};
const entete = [[], [], [], []];                       // données à partir de la ligne 5
const importer = async (feuilles) => {
  await page.evaluate(() => { render('import-nouveaux-animaux'); });
  await page.waitForSelector('#import-nouveaux-animaux-file');
  await page.setInputFiles('#import-nouveaux-animaux-file', await fichier(feuilles));
  await page.waitForTimeout(500);
};
const apercu = () => page.evaluate(() => document.getElementById('import-nouveaux-animaux-preview').innerText.replace(/\s+/g, ' '));
const confirmer = async () => { dialogues.length = 0; await page.click('#btn-confirm-import-nouveaux-animaux'); await page.waitForTimeout(200); return dialogues[dialogues.length - 1]; };

await importer([
  { name: 'Brebis', rows: [...entete,
    ['née', '16299151001', '12-09-2025', 'actif', '', '', '', ''],            // 11 chiffres, née 2025
    ['née', '250016299152002', '03-09-2025', 'actif', '', '', '', ''],        // 15 chiffres
    ['née', 'ABC123', '03-09-2025', 'actif', '', '', '', ''],                 // invalide
    ['née', '1629915', '03-09-2025', 'actif', '', '', '', ''],                // invalide (7 chiffres)
    ['achetée', '16480023987', '03-01-2026', 'actif', '', '', '', ''],        // autre indicatif, achetée : aucun avertissement
    ['née', '16480023988', '03-01-2026', 'actif', '', '', '', ''],            // autre indicatif, née : avertissement ambre
    ['née', '250016299153003', '03-09-2025', 'actif', '', '', '', ''] ] },    // 15 chiffres, fiche ancienne en 11 chiffres : doublon
  { name: 'Béliers', rows: [...entete, ['achetée', '16512298877', '05-09-2026', 'actif', '', '', '']] },
  { name: 'Agnelles', rows: [...entete, ['née', '16299155102', '01-09-2026', '', '', '', '']] }
]);
const ap = await apercu();
check(/EID invalide \("ABC123", attendu 11 ou 15 chiffres\)/.test(ap) && /EID invalide \("1629915"/.test(ap), 'aperçu : motif « EID invalide » pour les deux lignes non conformes : ' + ap.slice(0, 600));
check(/Indicatif différent de l'exploitation \(1\)/.test(ap) && /Lignes : 10\./.test(ap), 'aperçu : avertissement indicatif pour la seule « née » d\'un autre indicatif (ligne 10, pas la ligne 9 « achetée ») : ' + ap.slice(0, 900));
const ambre = await page.evaluate(() => { const e = document.getElementById('import-avertissement-indicatif'); const ref = document.createElement('i'); ref.style.background = 'var(--ch-ambre-pastel)'; document.body.appendChild(ref); const att = getComputedStyle(ref).backgroundColor; ref.remove(); return e ? { fond: getComputedStyle(e).backgroundColor, attendu: att, nb: document.querySelectorAll('#import-avertissement-indicatif').length } : null; });
check(ambre && ambre.fond === ambre.attendu && ambre.nb === 1, 'avertissement présenté dans un encart ambre de la charte (fond --ch-ambre-pastel), un seul : ' + JSON.stringify(ambre));
check(/Seront créées \(4\)/.test(ap), 'brebis à créer : 11 chiffres, 15 chiffres, achetée, née autre indicatif = 4 : ' + ap.slice(0, 900));
const retour = await confirmer();
eq(retour, '6 nouvelle(s) fiche(s) créée(s), 0 fiche(s) existante(s) complétée(s).', 'message de fin (4 brebis + 1 bélier + 1 agnelle, la fiche ancienne reconnue comme doublon)');
const eids = await page.evaluate(() => ({ brebis: DB.brebis.map(b => b.eid), beliers: DB.beliers.map(b => b.eid), agnelles: DB.agnelles.map(a => a.eid) }));
eq(eids.brebis, ['16299153003', '250016299151001', '250016299152002', '250016480023987', '250016480023988'], 'brebis : toutes enregistrées sur 15 chiffres (la fiche ancienne reste telle quelle, aucun doublon créé pour 250016299153003)');
eq([eids.beliers, eids.agnelles], [['250016512298877'], ['250016299155102']], 'béliers et agnelles aussi sur 15 chiffres');

// ---- 3. effets : âge juste, animal retrouvé au bip
const effets = await page.evaluate(() => {
  const b = DB.brebis.find(x => x.eid === '250016299151001');
  return { annee: anneeNaissance(b.eid), age: age(b.eid), bip: trouverUnParEidOuNumero(DB.brebis, '250016299151001').statut, bipEspaces: trouverUnParEidOuNumero(DB.brebis, '2500 16299 151001').statut,
    bipDoublon: verifierEidUnique('250016299151001') ? 'bloqué' : 'libre', mouvement: b.mouvements[0] && b.mouvements[0].date, dateEntree: b.dateEntree };
});
eq([effets.annee, effets.age, effets.bip, effets.bipEspaces, effets.bipDoublon], [2025, 1, 'trouve', 'trouve', 'bloqué'], 'année de naissance lue = 2025 (âge 1), animal retrouvé au bip, EID déjà utilisé détecté');

// ---- 4. non-doublon : le MÊME fichier réimporté, puis chaque animal dans l'autre forme (11 <-> 15)
const avant = await page.evaluate(() => [DB.brebis.length, DB.beliers.length, DB.agnelles.length]);
await importer([
  { name: 'Brebis', rows: [...entete,
    ['née', '250016299151001', '12-09-2025', 'actif', '', '', '', ''],        // importée en 11 chiffres, redonnée en 15
    ['née', '16299152002', '03-09-2025', 'actif', '', '', '', ''],            // importée en 15 chiffres, redonnée en 11
    ['née', '16299153003', '03-09-2025', 'actif', '', '', '', ''] ] },        // fiche ancienne en 11 chiffres, redonnée en 11
  { name: 'Béliers', rows: [...entete, ['achetée', '250016512298877', '05-09-2026', 'actif', '', '', '']] },
  { name: 'Agnelles', rows: [...entete, ['née', '250016299155102', '01-09-2026', '', '', '', '']] }
]);
const ap2 = await apercu();
check(!/Seront créées/.test(ap2) && !/EID invalide/.test(ap2), 'réimport 11/15 croisés : plus rien à créer, rien d\'invalide : ' + ap2.slice(0, 500));
const bouton = await page.evaluate(() => !document.getElementById('btn-confirm-import-nouveaux-animaux') || document.getElementById('btn-confirm-import-nouveaux-animaux').classList.contains('hidden'));
check(bouton, 'réimport : bouton « Confirmer » masqué (rien à écrire)');
eq(await page.evaluate(() => [DB.brebis.length, DB.beliers.length, DB.agnelles.length]), avant, 'aucune fiche en double après le réimport croisé 11 / 15');

// ---- 5. doublon DANS le fichier (11 puis 15 chiffres) : une seule fiche créée
await importer([{ name: 'Brebis', rows: [...entete, ['née', '16299159001', '01-09-2026', 'actif', '', '', '', ''], ['née', '250016299159001', '01-09-2026', 'actif', '', '', '', '']] }]);
await confirmer();
eq(await page.evaluate(() => DB.brebis.filter(b => b.eid.slice(-11) === '16299159001').length), 1, 'même animal deux fois dans le fichier (11 puis 15 chiffres) : une seule fiche');
await browser.close();
console.log('OK test_import_eid_normalisation');
