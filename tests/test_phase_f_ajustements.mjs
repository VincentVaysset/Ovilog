/* Teste les 5 ajustements demandés après validation du plan (3e demande du
   chantier "Changement de campagne") :
   1. Après échec d'un batch, rejeu opération par opération (jamais un retry
      aveugle du même batch), journalisation précise de la fautive.
   2. Pastille visible dans l'en-tête (#sync-badge) tant que la synchro est
      en attente.
   3. Réconciliation au démarrage : détecte les modifications non
      synchronisées (diff avec sync.lastSynced) même après une fermeture de
      l'appli pendant les relances.
   4. sync.lastSynced n'avance qu'après un commit réellement confirmé,
      opération par opération (vérifié en creux : 'b' se synchronise même
      quand 'a', dans le même batch initial, échoue).
   5. "Tester la sauvegarde" : fichier de test distinct des vraies
      sauvegardes, jamais compté ni supprimé par leur roulement.
   Utilise le même faux backend Firestore local que les tests précédents de
   ce chantier (voir fake_firebase_backend.mjs) -- aucune donnée réelle,
   aucun réseau externe. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const scratchDir = LIB_DIR;
const backendProc = spawn('node', [scratchDir + '/fake_firebase_backend.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
backendProc.stderr.on('data', d => process.stderr.write('[backend] ' + d));
// Filet : quelle que soit la façon dont ce script se termine (exception non
// rattrapée, rejet de promesse non géré), le faux backend ne doit jamais
// rester orphelin -- sinon son flux hérité garde un pipe ouvert et masque
// toute la sortie déjà produite (déjà observé une fois dans ce chantier).
let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  try { backendProc.kill(); } catch (e) { /* déjà mort */ }
}
process.on('exit', cleanup);
process.on('uncaughtException', e => { console.error('UNCAUGHT:', e); cleanup(); process.exit(1); });
process.on('unhandledRejection', e => { console.error('UNHANDLED REJECTION:', e); cleanup(); process.exit(1); });
const fakePort = await new Promise((resolve, reject) => {
  let buf = '';
  backendProc.stdout.on('data', d => {
    buf += d.toString();
    const m = buf.match(/FAKE_FIREBASE_PORT=(\d+)/);
    if (m) resolve(Number(m[1]));
  });
  backendProc.on('exit', code => reject(new Error('fake backend exited early, code ' + code)));
  setTimeout(() => reject(new Error('timeout')), 5000);
});
const fakeBundleSrc = readFileSync(scratchDir + '/fake_firebase_bundle.mjs', 'utf8').replace('__FAKE_FIREBASE_PORT__', String(fakePort));

const browser = await chromium.launch(LAUNCH);
const testEmail = 'phase-f-' + Date.now() + '@ovilog-audit-jetable.test';
const testPassword = 'AuditTest12345!';

async function newDevicePage() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/vendor/firebase.bundle.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fakeBundleSrc }));
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return { ctx, page };
}
async function waitFor(page, fn, { timeout = 20000, interval = 200, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(interval);
  }
  throw new Error('TIMEOUT en attendant : ' + label);
}

const d1 = await newDevicePage();
await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email: testEmail, pw: testPassword });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 1 connecté' });

await d1.page.evaluate(() => {
  DB.campagneDebut = 2026;
  DB.campagneInitialisee = true;
  DB.brebis = [
    { id: 'a', eid: '250016299950001', statut: 'active', createdAt: 1, notes: 'v1', echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] },
    { id: 'b', eid: '250016299950002', statut: 'active', createdAt: 1, notes: 'v1', echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }
  ];
  DB.beliers = [];
  DB.agnelles = [];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  saveData(DB);
});
await d1.page.waitForTimeout(500); // laisse le premier writeBatch se confirmer (lastSynced à jour pour a et b)

// ============================================================
// Points 1, 2 et 4 : échec d'un batch groupé -> rejeu opération par
// opération, une op saine s'applique quand même, la fautive est journalisée,
// la pastille d'en-tête apparaît -- sans passer par une vraie collision
// réseau : on supprime le document 'a' CÔTÉ SERVEUR directement (contournant
// la page, qui continue donc de croire 'a' à jour dans sync.lastSynced),
// exactement le scénario expliqué à la validation du plan (update() sur un
// document supprimé par un autre appareil).
// ============================================================
// Récupère l'uid du compte de test en interceptant un prochain appel réseau vers /batch (le chemin
// Firestore utilisé par writeBatch encode 'users/<uid>/...') -- fbAuth n'est pas exposé sur window,
// donc c'est le moyen le plus direct de le lire depuis l'extérieur de la page.
const uidToUse = await d1.page.evaluate(async () => {
  return await new Promise(resolve => {
    const origFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (typeof url === 'string' && url.includes('/batch') && opts && opts.body) {
        try { resolve(JSON.parse(opts.body).uid); } catch (e) {}
      }
      return origFetch.apply(this, arguments);
    };
    DB.brebis[0].notes = 'v2'; // vrai changement -> déclenche un writeBatch réel, capté ci-dessus
    saveData(DB);
    setTimeout(() => resolve(null), 800);
  });
});
if (!uidToUse) throw new Error('FAIL (infra test) : impossible de déterminer l\'uid du compte de test.');
await d1.page.waitForTimeout(300); // laisse ce writeBatch se confirmer avant la suite

const delResp = await fetch('http://127.0.0.1:' + fakePort + '/batch', {
  method: 'POST',
  body: JSON.stringify({ uid: uidToUse, ops: [{ type: 'delete', path: 'users/' + uidToUse + '/brebis/a' }] })
});
if (!delResp.ok) throw new Error('FAIL (infra test) : suppression directe côté faux backend a échoué.');
console.log('OK (infra) : document "a" supprimé directement côté faux backend, hors de la vue de la page (sync.lastSynced encore "à jour" sur le device).');

// Bloque temporairement les instantanés de la collection 'brebis' pour la page, le temps qu'elle
// modifie 'a' ET 'b' SANS avoir encore appris la suppression de 'a' (sinon buildAnimalCollectionOps ne
// générerait même plus d'update pour 'a', et le scénario de collision ne serait pas testé).
await d1.page.route('**/snapshot?*col=brebis*', route => route.abort());
await d1.page.evaluate(() => {
  DB.brebis.find(s => s.id === 'a').notes = 'modif-en-conflit';
  DB.brebis.find(s => s.id === 'b').notes = 'modif-saine';
  saveData(DB);
});
// Laisse le temps au writeBatch groupé d'échouer puis au repli opération par opération de s'exécuter.
await d1.page.waitForTimeout(1000);

const etatApresEchec = await d1.page.evaluate(() => ({
  enAttente: !!window.__syncEnAttente,
  badgeVisible: document.getElementById('sync-badge') ? document.getElementById('sync-badge').classList.contains('show') : null,
  journal: window.OvilogSync.lireJournal()
}));
if (!etatApresEchec.enAttente) throw new Error('FAIL: window.__syncEnAttente doit être vrai après l\'échec du batch groupé, obtenu ' + JSON.stringify(etatApresEchec));
console.log('OK point 4 (repli): la synchro est bien marquée "en attente" après l\'échec du batch groupé sur le document supprimé.');
if (etatApresEchec.badgeVisible !== true) throw new Error('FAIL point 2: la pastille #sync-badge doit être visible (classe .show) tant que la synchro est en attente, obtenu ' + JSON.stringify(etatApresEchec));
console.log('OK point 2: la pastille d\'en-tête #sync-badge apparaît bien tant que la synchro est en attente.');
if (etatApresEchec.journal.length !== 1 || etatApresEchec.journal[0].collection !== 'brebis' || etatApresEchec.journal[0].id !== 'a') {
  throw new Error('FAIL point 1: le journal doit contenir exactement 1 entrée précise (brebis/a), obtenu ' + JSON.stringify(etatApresEchec.journal));
}
console.log('OK point 1: la fautive (brebis/a) est journalisée précisément (collection + id + erreur), sans retry aveugle du même batch.');

// Vérifie CÔTÉ SERVEUR que 'b' (l'opération saine du même batch initial) a bien été appliquée malgré
// l'échec de 'a' dans ce même batch -- c'est le coeur du point 1 ("applique les autres") ET la preuve
// que sync.lastSynced n'avance que par opération réellement confirmée (point 4), pas tout ou rien.
const snapB = await fetch('http://127.0.0.1:' + fakePort + '/getdoc?uid=' + uidToUse + '&col=brebis&id=b').then(r => r.json());
if (!snapB.exists || snapB.data.notes !== 'modif-saine') {
  throw new Error('FAIL points 1/4: la modification saine de "b" (dans le même batch initial que "a", qui a échoué) doit malgré tout être appliquée côté serveur -- obtenu ' + JSON.stringify(snapB));
}
console.log('OK points 1 et 4: "b" est bien synchronisé malgré l\'échec de "a" dans le même batch initial -- rejeu opération par opération, jamais tout-ou-rien.');
const snapADevrait = await fetch('http://127.0.0.1:' + fakePort + '/getdoc?uid=' + uidToUse + '&col=brebis&id=a').then(r => r.json());
if (snapADevrait.exists) throw new Error('FAIL points 1/4: "a" reste supprimé côté serveur (la modif locale fautive n\'a jamais dû être appliquée), obtenu ' + JSON.stringify(snapADevrait));
console.log('OK points 1 et 4: "a" (fautif, ciblait un document supprimé) n\'a jamais été réappliqué côté serveur -- lastSynced n\'a donc jamais avancé à tort pour "a".');

// Débloque les instantanés : la page doit finir par apprendre la suppression de 'a' et converger
// (le badge doit finir par disparaître une fois la relance suivante n'ayant plus rien à repousser pour 'a').
await d1.page.unroute('**/snapshot?*col=brebis*');
await waitFor(d1.page, () => !DB.brebis.some(s => s.id === 'a'), { timeout: 10000, label: 'device 1 apprend la suppression de "a"' });
console.log('OK (convergence) : une fois les instantanés débloqués, le device apprend la suppression de "a" et son état local converge.');
// La relance suivante (planifiée par planifierRelanceSynchro, backoff 5s/30s/120s) ne trouvera plus
// d'update à faire pour 'a' (disparu de DB.brebis) -- le badge doit donc finir par se lever.
await waitFor(d1.page, () => window.__syncEnAttente === false, { timeout: 15000, label: 'la pastille "en attente" finit par disparaître après convergence' });
console.log('OK points 1/2/4 (convergence complète) : une fois "a" réellement disparu localement, la relance automatique suivante ne trouve plus rien à repousser pour lui, et l\'indicateur "en attente" retombe.');

// ============================================================
// Point 3 : réconciliation au démarrage -- une modification faite hors du
// chemin saveData normal (simule une modification restée non synchronisée
// après la fermeture de l'appli pendant une relance déjà planifiée) doit
// être repoussée automatiquement dès la prochaine connexion, SANS action de
// saisie explicite après coup.
// ============================================================
await d1.page.evaluate(() => {
  // Écrit directement en localStorage (contourne saveData -> AUCUN
  // syncAllToCloud n'a été déclenché pour ce changement) : représente
  // fidèlement l'état d'un appareil fermé avant qu'une relance planifiée
  // n'ait pu s'exécuter.
  DB.brebis.push({ id: 'c-hors-ligne', eid: '250016299950099', statut: 'active', createdAt: 99, notes: 'ajoutee-sans-sync', echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] });
  localStorage.setItem('troupeau_data_v1', JSON.stringify(DB));
});
const avantReconnexion = await fetch('http://127.0.0.1:' + fakePort + '/getdoc?uid=' + uidToUse + '&col=brebis&id=c-hors-ligne').then(r => r.json());
if (avantReconnexion.exists) throw new Error('FAIL (infra test) : "c-hors-ligne" ne doit pas encore exister côté serveur avant le test de réconciliation.');

// Force un nouveau cycle startListeners() (comme une réouverture d'appli) en repassant par
// déconnexion/reconnexion sur la MÊME page -- déclenche onAuthStateChanged -> onSignedIn -> startListeners(),
// qui attend la réception de TOUS les instantanés initiaux (collections + meta) avant de réconcilier.
await d1.page.evaluate(async ({ email, pw }) => {
  window.OvilogSync.logout();
  await new Promise(r => setTimeout(r, 200));
  await window.OvilogSync.login(email, pw);
}, { email: testEmail, pw: testPassword });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 1 reconnecté' });

// Poll fait depuis NODE (pas page.evaluate) : fakePort/fetch ici sont des
// closures Node, jamais sérialisables dans le contexte de la page.
await (async () => {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    const res = await fetch('http://127.0.0.1:' + fakePort + '/getdoc?uid=' + uidToUse + '&col=brebis&id=c-hors-ligne');
    const data = await res.json();
    if (data.exists) return;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('TIMEOUT en attendant : réconciliation au démarrage : "c-hors-ligne" finit par être poussée vers le cloud sans aucune nouvelle saisie');
})();
console.log('OK point 3: au redémarrage (reconnexion), une modification restée non synchronisée est automatiquement détectée et repoussée, sans action de saisie supplémentaire.');

await d1.ctx.close();

// ============================================================
// Point 5 : "Tester la sauvegarde" -- fichier de test distinct des vraies
// sauvegardes automatiques, jamais compté ni supprimé par leur roulement à
// BACKUP_AUTO_MAX (3) exemplaires, et ne modifie ni ne bascule rien.
// ============================================================
const d2 = await newDevicePage();
await d2.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.login(email, pw); }, { email: testEmail, pw: testPassword });
await waitFor(d2.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 2 connecté' });
await waitFor(d2.page, () => DB.brebis.some(s => s.id === 'c-hors-ligne'), { timeout: 15000, label: 'device 2 reçoit l\'état déjà réconcilié' });

await d2.page.evaluate(() => {
  window.__writtenFiles = {};
  window.__shareCallCount = 0;
  window.Capacitor = {
    Plugins: {
      Filesystem: {
        checkPermissions: async () => ({ publicStorage: 'granted' }),
        requestPermissions: async () => ({}),
        writeFile: async ({ path, data }) => { window.__writtenFiles[path] = atob(data); return {}; },
        readFile: async ({ path }) => ({ data: window.__writtenFiles[path] }),
        deleteFile: async ({ path }) => { delete window.__writtenFiles[path]; return {}; },
        readdir: async () => ({ files: Object.keys(window.__writtenFiles).map(name => ({ name })) }),
        getUri: async ({ path, directory }) => ({ uri: 'file:///fake/' + directory + '/' + path })
      },
      FileSaver: {
        saveAs: async ({ directory, path, fileName }) => {
          const src = window.__writtenFiles[path];
          return { ok: true, uri: 'content://fake/' + fileName, taille: src.length, nom: fileName, __src: src };
        },
        readUri: async ({ uri, asText }) => {
          const nom = uri.replace('content://fake/', '');
          const src = window.__writtenFiles[nom];
          return { ok: true, taille: src.length, texte: asText ? src : undefined };
        }
      },
      Share: { share: async () => { window.__shareCallCount++; return {}; } }
    }
  };
});

// Pose déjà BACKUP_AUTO_MAX (3) "vraies" sauvegardes dans le faux dossier, la plus récente étant
// celle qui NE DOIT JAMAIS être évincée par un test lancé ensuite.
await d2.page.evaluate(async () => {
  for (const nom of ['ovilog_backup_2026-01-01T00-00-00.json', 'ovilog_backup_2026-01-02T00-00-00.json', 'ovilog_backup_2026-01-03T00-00-00.json']) {
    await writeAutoBackupFile(nom, DB);
  }
  await purgeOldAutoBackups();
});
const listeAvantTest = await d2.page.evaluate(() => listAutoBackupFiles());
if (listeAvantTest.length !== 3) throw new Error('FAIL (infra test) : 3 vraies sauvegardes attendues avant le test, obtenu ' + JSON.stringify(listeAvantTest));

// Lance "Tester la sauvegarde" via le VRAI écran (Paramètres > Sauvegarde), pas un appel direct --
// c'est bien le bouton, avec son vrai câblage, qui est vérifié ici.
await d2.page.evaluate(() => { parametresTab = 'sauvegarde'; render('parametres'); });
await d2.page.waitForTimeout(150);
if (!(await d2.page.$('#btn-test-sauvegarde'))) throw new Error('FAIL point 5: le bouton "Tester la sauvegarde" doit exister dans Paramètres > Sauvegarde.');
await d2.page.click('#btn-test-sauvegarde');
await waitFor(d2.page, () => document.getElementById('test-sauvegarde-status').textContent.includes('✅'), { timeout: 5000, label: 'le test de sauvegarde se termine avec succès' });
const statusTexte = await d2.page.evaluate(() => document.getElementById('test-sauvegarde-status').textContent);
console.log('OK point 5: le bouton "Tester la sauvegarde" écrit, relit et vérifie -- statut affiché : "' + statusTexte + '"');

// Plan "Export SAF" : plus de partage automatique en tâche de fond (silencieux en cas d'échec) --
// l'export visible passe par le sélecteur système, et un bouton "Partager le fichier" reste
// affiché après le test, qui déclenche le partage seulement à la demande.
const shareCountAuto = await d2.page.evaluate(() => window.__shareCallCount);
if (shareCountAuto !== 0) throw new Error('FAIL point 5: aucun partage automatique en tâche de fond ne doit plus avoir lieu, obtenu ' + shareCountAuto + ' appel(s).');
if (await d2.page.evaluate(() => document.getElementById('btn-partager-test').classList.contains('hidden'))) throw new Error('FAIL point 5: le bouton "Partager le fichier" doit être affiché après un test réussi.');
await d2.page.click('#btn-partager-test');
await waitFor(d2.page, () => window.__shareCallCount === 1, { timeout: 5000, label: 'le partage à la demande' });
console.log('OK point 5: pas de partage automatique ; le bouton "Partager le fichier" est affiché après le test et ouvre bien le partage à la demande.');

// Le fichier de test ne doit JAMAIS apparaître dans le roulement des vraies sauvegardes, et les 3
// vraies sauvegardes doivent être TOUJOURS PRÉSENTES, intactes, après le test.
const listeApresTest = await d2.page.evaluate(() => listAutoBackupFiles());
if (listeApresTest.length !== 3) {
  throw new Error('FAIL point 5: le fichier de test ne doit jamais être compté parmi les vraies sauvegardes (roulement toujours à 3), obtenu ' + JSON.stringify(listeApresTest));
}
if (listeApresTest.some(n => n.includes('test'))) {
  throw new Error('FAIL point 5: aucun fichier de test ne doit apparaître dans la liste des vraies sauvegardes, obtenu ' + JSON.stringify(listeApresTest));
}
console.log('OK point 5: le fichier de test (' + await d2.page.evaluate(() => TEST_BACKUP_FILENAME) + ') n\'apparaît jamais dans le roulement des vraies sauvegardes -- toujours 3 vraies sauvegardes intactes après le test.');

// Relance le test une seconde fois : la rotation ne doit jamais évincer la sauvegarde pré-bascule
// la plus récente (ovilog_backup_2026-01-03...), même après plusieurs tests répétés.
await d2.page.click('#btn-test-sauvegarde');
await d2.page.waitForTimeout(400);
const listeApres2eTest = await d2.page.evaluate(() => listAutoBackupFiles());
if (!listeApres2eTest.includes('ovilog_backup_2026-01-03T00-00-00.json')) {
  throw new Error('FAIL point 5: la sauvegarde pré-bascule la plus récente ne doit JAMAIS être évincée par des tests répétés, obtenu ' + JSON.stringify(listeApres2eTest));
}
console.log('OK point 5: après plusieurs tests répétés, la sauvegarde pré-bascule la plus récente n\'est jamais évincée du roulement.');

// ============================================================
// Carry-over (plan validé, 3e demande, point 2) : erreur de quota localStorage
// sur le point de restauration interne -- bloque la bascule avec un message
// clair distinguant explicitement le quota plein d'une autre panne.
// ============================================================
const quotaResult = await d2.page.evaluate(async () => {
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key === 'ovilog_pre_campagne_snapshot') {
      const e = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      throw e;
    }
    return orig.call(this, key, value);
  };
  try {
    return await executerChangementCampagne();
  } finally {
    Storage.prototype.setItem = orig;
  }
});
if (quotaResult.ok) throw new Error('FAIL (carry-over) : la bascule doit être bloquée si le point de restauration interne ne peut pas être écrit (quota plein), obtenu ' + JSON.stringify(quotaResult));
if (!/quota/i.test(quotaResult.raison)) {
  throw new Error('FAIL (carry-over) : le message doit nommer explicitement le quota plein comme cause, obtenu "' + quotaResult.raison + '"');
}
console.log('OK (carry-over) : une erreur de quota localStorage sur le point de restauration interne bloque bien la bascule, avec un message qui nomme explicitement le quota comme cause : "' + quotaResult.raison + '"');

await d2.ctx.close();
backendProc.kill();
console.log('\nTOUS LES TESTS SONT PASSÉS (compte de test jetable, faux backend local, aucune donnée réelle, aucune bascule réelle)');
await browser.close();
