/* Neutralité d'un compte neuf : rien de l'élevage du concepteur ne doit apparaître chez un autre exploitant. Exemples d'EID neutres (250 000000 000000) dans les champs de saisie ;
   modèles Excel d'import embarqués (et leurs copies de tests/fixtures/modeles) sans EID, numéros ni nom de personne réels ; listes de départ vides pour vaccins et antiparasitaires ;
   aucun prix de référence négocié dans un compte neuf (mais un compte qui a déjà des données de lait garde le sien) ; aucun soin ajouté d'office à la naissance ; sauvegarde automatique Android désactivée.
   Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const source = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
const dossier = new URL('./fixtures/modeles/', import.meta.url).pathname;
const MODELES = ['Modele_Correspondance_SIEOL.xlsx', 'Modele_Controle_Laitier.xlsx', 'Modele_Lactation_CLS.xlsx', 'Modele_Lactation_CLO.xlsx', 'Modele_Nouveaux_Animaux.xlsx'];
// Règle générale, sans citer aucun élevage : l'indicatif (6 chiffres devant le n° individuel) de tout EID d'exemple commence par 00,
// qui n'est le département d'aucun élevage réel ; et les métadonnées du fichier ne portent que « Ovilog » (ou l'outil qui l'a produit)
const EID_REEL = c => (c.match(/\d{11,15}/g) || []).some(n => !/^00/.test(n.slice(-11)));
const AUTEURS_PERMIS = ['Ovilog', 'openpyxl'];

// ---- 1. champs de saisie : exemples d'EID neutres
const placeholders = [...source.matchAll(/placeholder="([^"]*)"/g)].map(m => m[1]);
check(!placeholders.some(p => /\b(?!00)\d{6}\b/.test(p.replace(/^ex: 250043$/, '')  /* n° long SIEOL, pas un indicatif */)), 'aucun exemple de saisie ne porte un indicatif réel (hors 00…) : ' + placeholders.filter(p => /\d{6}/.test(p)).join(' | '));
check(!/\(ex ?: ?(?!00)\d{6}\)/.test(source), 'aucun texte d\'aide ne cite un indicatif réel (hors 00…) comme exemple');
check(placeholders.filter(p => p === 'ex: 250 000000 000000').length === 4, 'les 4 champs d\'EID montrent l\'exemple neutre « ex: 250 000000 000000 »');

// ---- 2. modèles Excel : contenu (chaînes + métadonnées) lu avec python (zip) sur les copies de tests
const lecture = fichier => JSON.parse(execFileSync('python3', ['-I', '-c', `
import zipfile, re, json, sys
z = zipfile.ZipFile(sys.argv[1])
ss = z.read('xl/sharedStrings.xml').decode('utf-8')
core = z.read('docProps/core.xml').decode('utf-8')
print(json.dumps({'chaines': re.findall(r'<t[^>]*>([^<]*)</t>', ss), 'core': core}))
`, dossier + fichier], { encoding: 'utf8' }));
for (const f of MODELES) {
  const m = lecture(f);
  const trouve = m.chaines.filter(EID_REEL);
  check(trouve.length === 0, f + ' : aucun EID d\'exemple avec un indicatif réel (hors 00…) : ' + JSON.stringify(trouve));
  const auteurs = [...m.core.matchAll(/<(?:dc:creator|cp:lastModifiedBy)>([^<]*)</g)].map(x => x[1]);
  check(auteurs.every(a => AUTEURS_PERMIS.includes(a)), f + ' : métadonnées du fichier sans nom de personne : ' + JSON.stringify(auteurs));
}
console.log('OK 2 modèles Excel : aucun EID, n° ni nom réel (contenu et métadonnées).');

const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);

// ---- 3. les modèles embarqués dans l'appli sont EXACTEMENT les copies vérifiées ci-dessus
const embarques = await page.evaluate(() => Object.fromEntries(Object.entries(MODELES_IMPORT).map(([k, v]) => [v.fichier, v.b64])));
for (const f of MODELES) check(embarques[f] === readFileSync(dossier + f).toString('base64'), f + ' : le modèle embarqué dans l\'appli est identique à la copie vérifiée');
console.log('OK 3 modèles embarqués = copies vérifiées.');

// ---- 4. compte neuf : listes et prix de départ
const neuf = await page.evaluate(() => {
  const d = migrateData({});
  return { vaccins: d.produits.vaccins, antiparasitaires: d.produits.antiparasitaires, prix: d.parametresPrixLait, defauts: JSON.stringify(loadData()).match(/Cévac|Dectomax|1580/g) };
});
eq([neuf.vaccins, neuf.antiparasitaires], [[], []], 'compte neuf : vaccins et antiparasitaires vides');
check(neuf.prix.every(e => e.prixReference === null && e.msuReference === null) && !neuf.prix.some(e => e.campagne === 2025), 'compte neuf : aucun prix de référence ni entrée 2025 (' + JSON.stringify(neuf.prix) + ')');
check(neuf.defauts === null, 'base par défaut : ni « Cévac », ni « Dectomax », ni 1580');
// un compte qui a DÉJÀ des données de lait garde son prix de référence 2025 (comportement d'origine)
const ancien = await page.evaluate(() => { const d = migrateData({ laitTank: [{ date: '2026-01-01', quantite: 10 }] }); return d.parametresPrixLait.filter(e => e.campagne === 2025).map(e => [e.prixReference, e.msuReference]); });
eq(ancien, [[1580, 130]], 'compte existant avec données de lait : prix de référence 2025 conservé');
// listes vides : les écrans de soin ne plantent pas et laissent ajouter un produit
const ecrans = await page.evaluate(() => { DB = migrateData({}); saveData = () => true; const erreurs = []; for (const v of ['sanitaire', 'produits-delais']) { try { render(v); } catch (e) { erreurs.push(v + ': ' + e.message); } } return erreurs; });
eq(ecrans, [], 'écrans Carnet sanitaire et Produits avec listes vides : aucune erreur');
console.log('OK 4 compte neuf : listes vides, aucun prix négocié ; compte avec lait : prix conservé.');
// ---- 4 bis. aucun soin ajouté d'office à la naissance (plus de Séléphérol automatique) : sans réglage « Soins au bouclage », une mise bas n'écrit aucun soin, et aucun texte ne l'annonce
const naissance = await page.evaluate(() => {
  DB = migrateData({}); saveData = () => true; DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000000' });
  const brebis = { id: 'b1', eid: '250000000000001', statut: 'active', agnelages: [], sanitaire: [], mouvements: [] };
  DB.brebis = [brebis];
  const r = construireAgnelageMiseBas(brebis, { date: '2026-10-05', codeRepro: 'MN', lambs: [{ sexe: 'Mâle', eid: '250000000000101' }, { sexe: 'Femelle', eid: '250000000000102' }, { sexe: 'Mort-né' }] });
  if (r.erreur) return r.erreur;
  enregistrerMiseBas(brebis, r.agnelage);   // soins au bouclage : aucun réglé sur un compte neuf
  return JSON.stringify(DB.soinsBouclage) + JSON.stringify(brebis.agnelages[0].lambs.map(l => (l.sanitaire || []).length));
});
eq(naissance, '[][0,0,0]', 'compte neuf : aucun soin au bouclage réglé, une mise bas n\'ajoute aucun soin aux agneaux');
check(!/Injection systématique|ajouté à chaque agneau vivant|2 cc administré|Créer la fiche Séléphérol/.test(source), 'aucun soin d\'office ni texte qui l\'annonce dans l\'appli');
console.log('OK 4 bis : aucun soin ajouté d\'office à la naissance.');
await browser.close();

// ---- 5. Android : pas de sauvegarde automatique de la base locale
const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
check(/android:allowBackup="false"/.test(manifest) && !/allowBackup="true"/.test(manifest), 'AndroidManifest : allowBackup="false"');
console.log('OK 5 AndroidManifest : allowBackup=false.');
console.log('OK test_neutralite');
