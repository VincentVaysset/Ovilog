/* Canal de test des mises à jour (APK). Sur UNE MÊME liste de Releases (stable promue, build de main en pre-release, pre-release « [test] » de branche,
   brouillon), seul un appareil de l'ADMINISTRATEUR qui a activé « Recevoir les versions de test » se voit proposer la pre-release ; tous les autres cas
   (éleveur réglage coupé, éleveur réglage forcé, administrateur réglage coupé) ne voient que la version promue. Fenêtre : « version de test ».
   Paramètres › Sauvegarde : réglage visible seulement pour l'administrateur sur mobile (jamais sur PC), version installée affichée, propre à l'appareil.
   Workflow : le ménage ne vise que les pre-releases portant les deux marqueurs du canal de test. Faux fetch et faux plugin App, rien n'est téléchargé. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));

const apk = tag => [{ name: 'app-release.apk', browser_download_url: 'https://github.com/VincentVaysset/Ovilog/releases/download/' + tag + '/app-release.apk' }];
const RELEASES = [
  { tag_name: 'v290', name: 'Brouillon', body: '', prerelease: false, draft: true, assets: apk('v290') },
  { tag_name: 'v280', name: '[test] Ovilog 1.0.280 (claude/branche)', body: '<!-- ovilog-canal-test -->\nVersion de test (branche claude/branche)', prerelease: true, draft: false, assets: apk('v280') },
  { tag_name: 'v275', name: 'Ovilog 1.0.275', body: 'Build automatique — main', prerelease: true, draft: false, assets: apk('v275') },
  { tag_name: 'v268', name: 'Ovilog 1.0.268', body: 'Version stable', prerelease: false, draft: false, assets: apk('v268') }
];

const browser = await chromium.launch(LAUNCH);
async function appareil({ admin, reglage, bureau }) {
  const ctx = await browser.newContext({ viewport: bureau ? { width: 1400, height: 900 } : { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.addInitScript(({ admin, reglage, bureau }) => {
    if (bureau) window.electronAPI = { isDesktop: true, version: '1.0.test' };
    else window.Capacitor = { isNativePlatform: () => true, Plugins: { App: { getInfo: async () => ({ version: '1.0.260', build: '260' }), addListener: () => ({ remove() {} }) } } };
    try { if (reglage) localStorage.setItem('ovilog_canal_test', '1'); else localStorage.removeItem('ovilog_canal_test'); } catch (e) {}
    window.__adminFaux = admin;
  }, { admin, reglage, bureau });
  await page.route('https://api.github.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RELEASES) }));
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  // compte connecté, administrateur ou non (état de la bulle de contact)
  await page.evaluate(() => { const etat = window.OvilogSync.contactEtat; window.OvilogSync.contactEtat = () => Object.assign(etat(), { connecte: true, estAdmin: window.__adminFaux, prets: true }); });
  return { ctx, page };
}
const propose = page => page.evaluate(async () => { const v = await verifierMiseAJourDisponible(); return v.release ? [v.release.tagName, v.release.test] : null; });

// ================================================================ 1. même liste, quatre cas : seul « administrateur + réglage » voit la pre-release
const cas = {};
for (const [nom, o] of Object.entries({ 'éleveur, réglage coupé': { admin: false, reglage: false }, 'éleveur, réglage forcé sur l\'appareil': { admin: false, reglage: true }, 'administrateur, réglage coupé': { admin: true, reglage: false }, 'administrateur, réglage activé': { admin: true, reglage: true } })) {
  const d = await appareil(o);
  cas[nom] = await propose(d.page);
  await d.ctx.close();
}
eq(cas, { 'éleveur, réglage coupé': ['v268', false], 'éleveur, réglage forcé sur l\'appareil': ['v268', false], 'administrateur, réglage coupé': ['v268', false], 'administrateur, réglage activé': ['v280', true] },
  'seul l\'administrateur avec le réglage activé voit la pre-release (jamais un brouillon)');
console.log('OK 1 même liste de Releases : pre-release proposée au seul administrateur qui a activé le réglage ; tous les autres : version promue v268.');

// ================================================================ 2. fenêtre de mise à jour : « version de test », nom et notes sans marqueur
const adm = await appareil({ admin: true, reglage: true });
const fenetre = await adm.page.evaluate(async () => {
  const deja = document.getElementById('update-popup-overlay'); if (deja) deja.remove();   // fenêtre de la vérification de démarrage
  const { release } = await verifierMiseAJourDisponible(); afficherPopupMiseAJour(release);
  const o = document.getElementById('update-popup-overlay'); const t = o.textContent.replace(/\s+/g, ' ');
  const r = [/Nouvelle version de test disponible/.test(t), /version de test/.test(o.querySelector('.mb-pastille').textContent), t.includes('[test]'), t.includes('ovilog-canal-test'), t.includes('Ovilog 1.0.280 (claude/branche)')];
  o.remove(); return r;
});
eq(fenetre, [true, true, false, false, true], 'fenêtre : « Nouvelle version de test disponible », pastille « version de test », sans « [test] » ni marqueur');
const eleveur = await appareil({ admin: false, reglage: false });
const fenStable = await eleveur.page.evaluate(async () => { const deja = document.getElementById('update-popup-overlay'); if (deja) deja.remove();   // fenêtre de la vérification de démarrage
  const { release } = await verifierMiseAJourDisponible(); afficherPopupMiseAJour(release); const o = document.getElementById('update-popup-overlay'); const r = [o.textContent.includes('Nouvelle version disponible'), !o.querySelector('.mb-pastille')]; o.remove(); return r; });
eq(fenStable, [true, true], 'version stable : fenêtre inchangée, sans mention de test');
console.log('OK 2 fenêtre : mention « version de test » pour une pre-release, inchangée pour une version stable.');

// ================================================================ 3. Paramètres › Sauvegarde : réglage de l'administrateur sur mobile, version installée
const reglageVisible = async page => page.evaluate(async () => { parametresRubrique = 'sauvegarde'; render('parametres'); await new Promise(r => setTimeout(r, 200)); return { reglage: !!document.getElementById('f-canal-test'), version: (document.getElementById('update-version-installee') || {}).textContent }; });
eq(await reglageVisible(adm.page), { reglage: true, version: '1.0.260' }, 'administrateur sur mobile : réglage « Recevoir les versions de test » et version installée');
eq((await reglageVisible(eleveur.page)).reglage, false, 'éleveur : aucun réglage de test');
const pc = await appareil({ admin: true, reglage: false, bureau: true });
eq((await reglageVisible(pc.page)).reglage, false, 'administrateur sur PC : aucun réglage (le PC reste sur les versions stables)');
// le réglage s'enregistre sur l'appareil seulement et change la version proposée
await adm.page.click('#f-canal-test');   // désactive
eq([await adm.page.evaluate(() => localStorage.getItem('ovilog_canal_test')), await propose(adm.page)], [null, ['v268', false]], 'réglage coupé : version stable proposée');
await adm.page.click('#f-canal-test');   // réactive
eq([await adm.page.evaluate(() => localStorage.getItem('ovilog_canal_test')), await propose(adm.page)], ['1', ['v280', true]], 'réglage activé : version de test proposée');
check(/Versions de test activées/.test(await adm.page.textContent('#update-check-status')), 'message après activation');
check(!/ovilog_canal_test/.test(readFileSync(new URL('../www/index.html', import.meta.url), 'utf8').match(/const META_FIELDS = \[[\s\S]*?\];/)[0]), 'réglage jamais synchronisé (hors META_FIELDS)');
await adm.ctx.close(); await eleveur.ctx.close(); await pc.ctx.close();
console.log('OK 3 Paramètres › Sauvegarde : réglage de l\'administrateur sur mobile seulement, version installée, propre à l\'appareil.');
await browser.close();

// ================================================================ 4. workflow : le ménage ne vise que les pre-releases de test (filtre jq du workflow, sur une liste type)
const yml = readFileSync(new URL('../.github/workflows/build-apk.yml', import.meta.url), 'utf8');
const filtre = yml.match(/--jq '([^']+)'/)[1];
const liste = [
  { id: 1, tag_name: 'v280', name: '[test] Ovilog 1.0.280 (b)', prerelease: true, draft: false, body: '<!-- ovilog-canal-test -->\nx' },
  { id: 2, tag_name: 'v279', name: 'Ovilog 1.0.279', prerelease: true, draft: false, body: 'Build automatique — main\n\n<!-- ovilog-canal-test --> cité dans un message' },
  { id: 3, tag_name: 'v278', name: '[test] Ovilog 1.0.278 (b)', prerelease: true, draft: false, body: '<!-- ovilog-canal-test -->\nx' },
  { id: 4, tag_name: 'v277', name: '[test] Ovilog 1.0.277 (b)', prerelease: false, draft: false, body: '<!-- ovilog-canal-test -->\npromue' },
  { id: 5, tag_name: 'v276', name: '[test] Ovilog 1.0.276 (b)', prerelease: true, draft: false, body: '<!-- ovilog-canal-test -->\nx' },
  { id: 6, tag_name: 'v99', name: '[test] Ovilog 1.0.99 (b)', prerelease: true, draft: false, body: '<!-- ovilog-canal-test -->\nx' },
  { id: 7, tag_name: 'v268', name: 'Ovilog 1.0.268', prerelease: false, draft: false, body: 'stable' },
  { id: 8, tag_name: 'v275', name: '[test] sans marqueur', prerelease: true, draft: false, body: 'rien' }
];
let candidats;
try { candidats = execFileSync('jq', ['-r', filtre], { input: JSON.stringify(liste), encoding: 'utf8' }).trim().split('\n').map(l => l.split('\t')[2]); }
catch (e) { console.log('SKIP 4 (jq absent)'); candidats = null; }
if (candidats) {
  eq(candidats.sort(), ['v276', 'v278', 'v280', 'v99'], 'ménage : seules les pre-releases avec les deux marqueurs sont candidates (jamais main, promue ou sans marqueur)');
  check(/sort -t\$'\\t' -k1,1nr \| tail -n \+4/.test(yml), 'ménage : tri par n° de version décroissant, les 3 plus récentes gardées');
  console.log('OK 4 ménage : candidates = pre-releases « [test] » + marqueur ; v280, v278, v276 gardées, v99 supprimée.');
}
console.log('OK test_canal_test');
