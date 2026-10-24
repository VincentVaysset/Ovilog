/* Canal stable des mises à jour. L'appli (APK) et l'installeur Windows ne proposent que les Releases que le propriétaire a promues à la main (non « pre-release », non brouillon) ;
   les builds de main naissent en pre-release ; un push de branche ne publie qu'une pre-release « [test] » (canal de test, voir test_canal_test), un lancement manuel rien.
   A. Application : derniereReleaseDisponible / verifierMiseAJourDisponible avec un faux fetch (mélange stable / pre-release / brouillon).
   B. Workflow build-apk.yml et electron/main.js : garde-fous vérifiés dans les fichiers eux-mêmes. Faux fetch, rien n'est téléchargé ni installé. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));

// ---------------- B. fichiers du dépôt
const yml = readFileSync(new URL('../.github/workflows/build-apk.yml', import.meta.url), 'utf8');
const etapes = yml.split(/\n      - name: /).slice(1);
const toutesPublications = etapes.filter(e => /\n\s+uses: softprops\/action-gh-release@v2/.test(e));
const publications = toutesPublications.filter(e => !/^Publier la pre-release de test/.test(e));
eq(publications.length, 2, 'workflow : deux étapes de publication de Release sur main (APK et installeur Windows)');
// canal de test : la seule autre publication est la pre-release « [test] » d'un push de branche (voir test_canal_test)
const publicationsTest = toutesPublications.filter(e => /^Publier la pre-release de test/.test(e));
eq(publicationsTest.length, 1, 'workflow : une seule publication hors main, la pre-release de test');
check(/\n\s+if: github\.ref != 'refs\/heads\/main' && github\.event_name == 'push'/.test(publicationsTest[0]) && /\n\s+prerelease: true\b/.test(publicationsTest[0]) && /name: "\[test\] /.test(publicationsTest[0]) && /body: \|\n\s+<!-- ovilog-canal-test -->/.test(publicationsTest[0]), 'workflow : pre-release de test seulement sur un push de branche, toujours en pre-release, marquée « [test] » et <!-- ovilog-canal-test -->');
publications.forEach((e, i) => {
  check(/\n\s+if: github\.ref == 'refs\/heads\/main' && github\.event_name == 'push'/.test(e), 'workflow : l\'étape de publication ' + (i + 1) + ' ne tourne que sur un push de main');
  check(/\n\s+prerelease: true\b/.test(e), 'workflow : l\'étape de publication ' + (i + 1) + ' publie toujours en pre-release');
  check(!/prerelease: \$\{\{/.test(e), 'workflow : aucune condition qui rendrait une release stable automatiquement');
});
check(/actions\/upload-artifact@v4/.test(yml) && yml.match(/actions\/upload-artifact@v4/g).length === 2, 'workflow : les artefacts (APK, installeur) sont toujours produits, y compris hors main');
const main = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
check(/autoUpdater\.allowPrerelease = false;/.test(main) && !/allowPrerelease = true/.test(main), 'electron : allowPrerelease = false (seules les versions promues sont proposées)');
console.log('OK B workflow et Electron : publication seulement sur main, toujours en pre-release, Electron ignore les pre-release.');

// ---------------- A. application
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
const apk = tag => [{ name: 'app-release.apk', browser_download_url: 'https://github.com/VincentVaysset/Ovilog/releases/download/' + tag + '/app-release.apk' }];
const rel = (n, extra) => Object.assign({ tag_name: 'v' + n, name: 'Ovilog 1.0.' + n, body: '', prerelease: false, draft: false, assets: apk('v' + n) }, extra || {});
const avec = (releases, code) => page.evaluate(async ({ releases, code }) => {
  const vrai = window.fetch; window.fetch = async () => ({ ok: true, status: 200, json: async () => releases });
  const vraiCode = versionCodeInstalle; versionCodeInstalle = async () => code;
  const b = await derniereReleaseDisponible(); const v = await verifierMiseAJourDisponible();
  window.fetch = vrai; versionCodeInstalle = vraiCode;
  return { ok: b.ok, best: b.best && b.best.tagName, propose: v.release && v.release.tagName };
}, { releases, code });

// la plus récente est une pre-release : c'est la plus récente PROMUE qui est proposée
eq(await avec([rel(305, { prerelease: true }), rel(304, { prerelease: true }), rel(303), rel(302)], 300), { ok: true, best: 'v303', propose: 'v303' }, 'pre-release v305 et v304 ignorées : v303 (promue) proposée');
// brouillon ignoré
eq(await avec([rel(310, { draft: true }), rel(303)], 300), { ok: true, best: 'v303', propose: 'v303' }, 'brouillon ignoré');
// rien de promu : rien n'est proposé, et ce n'est pas une erreur
eq(await avec([rel(305, { prerelease: true }), rel(304, { prerelease: true })], 300), { ok: true, best: null, propose: null }, 'aucune version promue : aucune mise à jour proposée, pas d\'erreur');
// déjà à jour malgré une pre-release plus récente
eq(await avec([rel(305, { prerelease: true }), rel(303)], 303), { ok: true, best: 'v303', propose: null }, 'déjà sur la dernière version promue : rien à proposer malgré une pre-release plus récente');
// promotion : la même release, une fois décochée « pre-release », devient visible
eq(await avec([rel(305, { prerelease: false }), rel(303)], 303), { ok: true, best: 'v305', propose: 'v305' }, 'après promotion de v305, elle est proposée');
// champ absent (ancienne réponse) : traité comme stable, comme avant
eq(await avec([{ tag_name: 'v250', name: 'v250', assets: apk('v250') }], 200), { ok: true, best: 'v250', propose: 'v250' }, 'release sans champ prerelease : comportement d\'origine');
await browser.close();
console.log('OK A application : seules les releases promues sont proposées.');
console.log('OK test_canal_stable');
