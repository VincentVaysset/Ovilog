/* Mise à jour de l'appli Android : reprises AUTOMATIQUES sur erreur serveur transitoire de GitHub (502 / 503 / 504, coupure réseau) -- « erreur 503 » signalé sur une tablette
   alors que le téléphone passait au même moment. Vérification de la dernière release (API) et téléchargement de l'APK (plugin natif) : 503 puis succès = la mise à jour réussit
   toute seule, en le disant à l'écran ; 503 persistant = message clair (pas de perte, version actuelle intacte) ; erreur non transitoire = aucun délai. Faux plugin natif, faux fetch :
   rien n'est téléchargé ni installé. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
await page.evaluate(() => { ATTENTES_REPRISE_MAJ_MS = [15, 15, 15]; });

// ---- 1. API GitHub : 503, 503, puis succès
const r1 = await page.evaluate(async () => {
  let n = 0; const vrai = window.fetch;
  window.fetch = async (url) => { n++; if (n <= 2) return { ok: false, status: 503, json: async () => ({}) }; return { ok: true, status: 200, json: async () => [{ tag_name: 'v250', name: 'v250', assets: [{ name: 'app-release.apk', browser_download_url: 'https://github.com/x/y/releases/download/v250/app-release.apk' }] }] }; };
  const r = await derniereReleaseDisponible(); window.fetch = vrai; return { n, ok: r.ok, code: r.best && r.best.versionCode };
});
check(r1.ok && r1.n === 3 && r1.code === 250, 'API : 503 deux fois puis succès -> la vérification aboutit (3 tentatives) : ' + JSON.stringify(r1));
// ---- 2. API : 503 persistant, coupure réseau
const r2 = await page.evaluate(async () => {
  let n = 0; const vrai = window.fetch; window.fetch = async () => { n++; return { ok: false, status: 503, json: async () => ({}) }; };
  const a = await derniereReleaseDisponible(); const na = n; n = 0; window.fetch = async () => { n++; throw new TypeError('Failed to fetch'); };
  const b = await derniereReleaseDisponible(); window.fetch = vrai; return { a: [a.ok, a.reason, na], b: [b.ok, b.reason.slice(0, 7), n] };
});
check(JSON.stringify(r2.a) === '[false,"http_503",4]' && JSON.stringify(r2.b) === '[false,"reseau:",4]', '503 persistant ou coupure réseau : 4 tentatives, puis échec signalé comme avant : ' + JSON.stringify(r2));
// ---- 3. API : 403 (limite de requêtes) ou 404 : pas de reprise inutile
const r3 = await page.evaluate(async () => { let n = 0; const vrai = window.fetch; window.fetch = async () => { n++; return { ok: false, status: 403, json: async () => ({}) }; }; const a = await derniereReleaseDisponible(); window.fetch = vrai; return [a.reason, n]; });
check(JSON.stringify(r3) === '["http_403",1]', '403 : aucune reprise inutile : ' + JSON.stringify(r3));

// ---- 4. téléchargement : 503, 503, puis succès
const lancer = (scenario) => page.evaluate(async (sc) => {
  const appels = { download: 0, install: 0 }; const messages = [];
  window.Capacitor = { Plugins: { ApkInstaller: {
    download: async () => { appels.download++; if (sc.echecs.length) throw new Error(sc.echecs.shift()); },
    canRequestInstall: async () => ({ value: true }), openInstallPermissionSettings: async () => {}, install: async () => { appels.install++; } } } };
  afficherPopupMiseAJour({ name: 'v250', tagName: 'v250', versionCode: 250, body: '', apkUrl: 'https://github.com/x/y/releases/download/v250/app-release.apk' });
  const st = document.querySelector('#update-popup-status');
  const obs = new MutationObserver(() => messages.push(st.textContent)); obs.observe(st, { childList: true, characterData: true, subtree: true });
  document.querySelector('#update-popup-install').click();
  await new Promise(r => setTimeout(r, 400)); obs.disconnect();
  const res = { appels, messages, statut: st ? st.textContent : null, popup: !!document.querySelector('#update-popup-status'), boutonActif: document.querySelector('#update-popup-install') ? !document.querySelector('#update-popup-install').disabled : null };
  document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
  return res;
}, scenario);
const t1 = await lancer({ echecs: ['Téléchargement impossible (code 503)', 'Téléchargement impossible (code 503)'] });
check(t1.appels.download === 3 && t1.appels.install === 1 && t1.messages.some(m => /momentanément indisponible \(Téléchargement impossible \(code 503\)\) — nouvelle tentative 2\/4/.test(m)) && t1.messages.some(m => /nouvelle tentative 3\/4/.test(m)), 'téléchargement : 503 deux fois puis succès -> installé tout seul, tentatives annoncées à l\'écran : ' + JSON.stringify(t1));
const t2 = await lancer({ echecs: Array(6).fill('Téléchargement impossible (code 503)') });
check(t2.appels.download === 4 && t2.appels.install === 0 && /momentanément indisponible/.test(t2.statut) && /ta version actuelle continue de fonctionner/.test(t2.statut) && t2.boutonActif === true, '503 persistant : 4 tentatives, message clair, bouton de nouvel essai réactivé : ' + t2.statut);
const t3 = await lancer({ echecs: ['url ou fileName manquant'] });
check(t3.appels.download === 1 && /url ou fileName manquant/.test(t3.statut), 'erreur non transitoire : aucune reprise, message d\'origine : ' + t3.statut);
await browser.close();
console.log('TOUS LES TESTS DES REPRISES DE MISE À JOUR SONT PASSÉS');
