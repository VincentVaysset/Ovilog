/* Charte graphique Ovilog : les valeurs écrites dans CLAUDE.md (section « Charte graphique ») sont EXACTEMENT celles des variables CSS --ch-* du :root et des constantes PDF (PDF_CHARTE) ;
   --primary (en-tête, bouton principal) = vert de la charte #357f4b ; aucune couleur de la charte n'est écrite en dur ailleurs dans le code (variables et constantes uniquement) ;
   les écrans refondus (Inventaire, Registre mobile) lisent bien leurs couleurs dans les variables. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const racine = new URL('../', import.meta.url).pathname;
const claude = readFileSync(racine + 'CLAUDE.md', 'utf8');
const html = readFileSync(racine + 'www/index.html', 'utf8');
const section = claude.slice(claude.indexOf('## Charte graphique'));
check(section.length > 500, 'CLAUDE.md contient la section « Charte graphique »');
// couleurs de la charte (CLAUDE.md) -> variable attendue
const ATTENDU = { '--ch-fond': '#fbf8f1', '--ch-carte': '#ffffff', '--ch-bord': '#e6ddc9', '--ch-texte': '#2b261c', '--ch-texte2': '#5e5b47', '--ch-icone': '#8a8670', '--ch-vert': '#357f4b', '--ch-vert-fonce': '#2f6e44',
  '--ch-vert-pastel': '#e3f3e6', '--ch-vert-texte': '#24613a', '--ch-bleu': '#1f5a8a', '--ch-bleu-pastel': '#e6f0fa', '--ch-ambre': '#b5701c', '--ch-ambre-pastel': '#fbeed7', '--ch-ambre-texte': '#8a5413', '--ch-rouge': '#a33a31', '--ch-rouge-pastel': '#fbe3e0',
  '--ch-onglets': '#efe9da', '--ch-ligne-alt': '#f6f1e4', '--ch-separateur': '#efe9da', '--ch-bord-champ': '#d9cfb8' };
for (const [v, hex] of Object.entries(ATTENDU)) check(section.toLowerCase().includes(hex) || hex === '#ffffff', 'CLAUDE.md mentionne ' + hex + ' (' + v + ')');
const racineCss = html.slice(html.indexOf(':root {'), html.indexOf('* { box-sizing'));
for (const [v, hex] of Object.entries(ATTENDU)) check(new RegExp(v + ':\\s*' + hex + '\\b', 'i').test(racineCss), ':root définit ' + v + ' = ' + hex);
const pdfCharte = html.match(/const PDF_CHARTE = \{([^}]*)\}/)[1];
for (const hex of ['#357f4b', '#2f6e44', '#e3f3e6', '#1f5a8a', '#e6f0fa', '#b5701c', '#fbeed7', '#a33a31', '#fbe3e0', '#f6f1e4']) check(pdfCharte.includes(hex), 'PDF_CHARTE contient ' + hex);
console.log('OK 1 CLAUDE.md = variables --ch-* = constantes PDF_CHARTE (' + Object.keys(ATTENDU).length + ' couleurs).');

// aucune couleur de la charte écrite en dur hors des deux endroits de définition
const sansDefs = html.replace(racineCss, '').replace(/const PDF_CHARTE = \{[^}]*\}/, '');
const interdits = ['#357f4b', '#2f6e44', '#e3f3e6', '#24613a', '#1f5a8a', '#e6f0fa', '#b5701c', '#fbeed7', '#a33a31', '#fbe3e0', '#f6f1e4', '#8a5413', '#d9cfb8', '#e6ddc9', '#efe9da', '#fbf8f1', '#2b261c', '#5e5b47', '#8a8670'];
const trouves = interdits.filter(h => sansDefs.toLowerCase().includes(h));
eq(trouves, [], 'couleurs de la charte écrites en dur hors :root / PDF_CHARTE');
console.log('OK 2 aucune couleur de la charte écrite en dur hors des variables et des constantes.');

// rendu : --primary et en-tête = vert de la charte ; écrans refondus lisent les variables
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
const rendu = await page.evaluate(() => {
  const r = getComputedStyle(document.documentElement);
  DB = migrateData({}); saveData = () => true; DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.brebis = [{ id: 'b1', eid: '2500162991010001', statut: 'active', mouvements: [], sanitaire: [], echographies: [], notes: [], agnelages: [], createdAt: 1, numeroCourtTravailSieol: '1', numeroLongTravailSieol: '021001' }];
  render('inventaire-actifs');
  const th = getComputedStyle(document.querySelector('.inv-table th')), tuile = getComputedStyle(document.querySelector('.reg-tuile.vert'));
  return { primary: r.getPropertyValue('--primary').trim(), header: getComputedStyle(document.querySelector('header')).backgroundColor, th: th.backgroundColor, tuileFond: tuile.backgroundColor, tuileBord: tuile.borderLeftColor };
});
eq(rendu.primary, '#357f4b', '--primary = vert de la charte');
eq(rendu.header, 'rgb(53, 127, 75)', 'en-tête vert #357f4b');
eq([rendu.th, rendu.tuileFond, rendu.tuileBord], ['rgb(53, 127, 75)', 'rgb(227, 243, 230)', 'rgb(47, 110, 68)'], 'tableau et tuile de l\'Inventaire : couleurs de la charte via les variables');
await browser.close();
console.log('OK 3 rendu : --primary et en-tête = #357f4b ; tableau et tuiles lisent les variables.');
console.log('\nTOUS LES TESTS DE LA CHARTE GRAPHIQUE SONT PASSÉS');
