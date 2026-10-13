/* Lecteur (mobile) : pastille « Lecteur » de TOUS les écrans mobiles à bandeau vert (sur la ligne du logo, à droite, symétrique du bouton menu, libellés courts « Lecteur » / « Connecter » / « Choisir » / « Connexion… » / « Reconnexion… » ; toucher sur « Connecter » = connexion immédiate sans quitter l'écran ni perdre la saisie, « Connexion… » ignoré puis rendu après 10 s, toucher sur la verte et appui long = écran Lecteur PAR-DESSUS l'écran de scan, flèche et bouton Retour d'Android le ferment) (verte connecté, ambre reconnexion / absent, JAMAIS rouge ; absente hors écran de scan, sur PC et sans plugin), reconnexion automatique
   (3 essais, « essai n sur 3 », coupure détectée par l'écouteur du plugin, réglage qui la coupe, déconnexion voulue = aucun essai), écran Paramètres › Lecteur (état, deux interrupteurs, test de scan, choisir un autre
   lecteur, oublier sans confirm()), bip sonore par appareil (coupe tous les bips, saisie manuelle comprise ; les quatre bips trouvé / ambigu / introuvable / déjà trouvé restent distincts), réglages propres à l'appareil
   (hors META_FIELDS) et PC : « Lecteur : mobile uniquement » sans lecteur ni scan. Faux plugin Bluetooth et faux AudioContext ; jeu synthétique. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
async function ouvrir(pc, avecPlugin = true) {
  const page = await (await browser.newContext({ viewport: pc ? { width: 1300, height: 900 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
  await page.addInitScript(([d, plugin]) => {
    if (d) window.electronAPI = { isDesktop: true, version: '1.0.test' };
    // faux AudioContext : enregistre la fréquence de chaque bip
    window.__bips = [];
    window.AudioContext = class { constructor() { this.currentTime = 0; this.destination = {}; }
      createOscillator() { const o = { frequency: { value: 0 }, type: 'sine', connect() {}, start: () => window.__bips.push({ f: o.frequency.value, t: o.type }), stop() {} }; return o; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } };
    if (!d && plugin) {
      const bt = window.__bt = { connectOk: true, essais: [], deconnexions: 0, ecouteurs: {} };
      const app = window.__app = { ecouteurs: {} };
      window.Capacitor = { Plugins: { App: { addListener: async (n, cb) => { app.ecouteurs[n] = cb; return { remove() { delete app.ecouteurs[n]; } }; } }, BluetoothSerial: {
        checkPermissions: async () => ({ connect: 'granted', scan: 'granted', fineLocation: 'granted' }), requestPermissions: async () => ({ connect: 'granted', scan: 'granted', fineLocation: 'granted' }),
        list: async () => ({ devices: [{ name: 'Allflex LPR 4812', address: 'AA:01' }] }), discoverUnpaired: async () => ({ devices: [{ name: 'Allflex LPR 3390', address: 'BB:02' }] }),
        addListener: async (nom, cb) => { bt.ecouteurs[nom] = cb; return { remove() {} }; }, cancelDiscovery: async () => ({}),
        connect: async ({ address }) => { bt.essais.push(address); if (bt.delai) await new Promise(r => setTimeout(r, bt.delai)); const ok = typeof bt.connectOk === 'function' ? bt.connectOk(bt.essais.length) : bt.connectOk; if (!ok) throw new Error('introuvable'); return {}; },
        disconnect: async () => { bt.deconnexions++; return {}; }, available: async () => ({ available: 0 }), read: async () => ({ data: '' }) } } };
    }
  }, [!!pc, avecPlugin]);
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  const dialogues = []; page.on('dialog', d => { dialogues.push(d.message()); d.accept(); });
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate(() => { DB = migrateData({}); DB.brebis.push({ id: 'b1', eid: '250123456789012', numeroOrdre: '1234', statut: 'Entrée', dateNaissance: '2022-01-10', mere: '', pere: '' }); window.__saves = 0; const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); }; BT_PAUSES_MS[0] = 20; BT_PAUSES_MS[1] = 20; BT_PAUSES_MS[2] = 20; });
  return { page, dialogues };
}
const pastille = (page) => page.evaluate(() => { const b = document.getElementById('btn-lecteur-lpr'), c = document.getElementById('led-lecteur-lpr'), r = c.getBoundingClientRect(); return { visible: b.classList.contains('visible') && getComputedStyle(b).display !== 'none', etat: c.dataset.etat, texte: c.querySelector('.txt').textContent, fond: getComputedStyle(c).backgroundColor, point: getComputedStyle(c.querySelector('.point')).backgroundColor, h: Math.round(r.height), droite: Math.round(innerWidth - r.right) }; });
const couleur = (page, v) => page.evaluate((n) => { const e = document.createElement('i'); e.style.color = 'var(' + n + ')'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; }, v);
const ROUGES = ['--ch-rouge', '--ch-rouge-pastel', '--danger'];

// ======================================================================= mobile
{
  const { page, dialogues } = await ouvrir(false);
  const [vert, vertPastel, ambre, ambrePastel] = [await couleur(page, '--ch-vert'), await couleur(page, '--ch-vert-pastel'), await couleur(page, '--ch-ambre'), await couleur(page, '--ch-ambre-pastel')];
  const rouges = []; for (const r of ROUGES) rouges.push(await couleur(page, r));

  // ---- pastille : seulement sur un écran de scan
  await page.evaluate(() => render('home'));
  check((await pastille(page)).visible, 'Accueil (aucun champ de scan) : la pastille est présente');
  await page.evaluate(() => render('misebas-rapide'));
  let p = await pastille(page);
  eq([p.visible, p.etat, p.texte], [true, 'absent', 'Choisir'], 'écran de scan sans lecteur choisi : pastille ambre « Choisir »');
  check(p.fond === ambrePastel && p.point === ambre && !rouges.includes(p.fond) && !rouges.includes(p.point), 'lecteur absent : ambre, jamais rouge');
  check(await page.evaluate(() => !!document.getElementById('scan-misebas')), 'la saisie manuelle reste possible (champ présent)');

  // ---- connecté : verte
  await page.evaluate(async () => { DB.lecteurBluetooth = { address: 'AA:01', name: 'Allflex LPR 4812' }; await btConnect('AA:01'); });
  p = await pastille(page);
  eq([p.visible, p.etat, p.texte, p.fond, p.point], [true, 'connecte', 'Lecteur', vertPastel, vert], 'connecté : pastille verte « Lecteur »');

  // ---- coupure : 3 essais qui échouent -> ambre « Reconnexion… » puis « Lecteur absent »
  await page.evaluate(() => { __bt.essais = []; __bt.connectOk = false; BT_PAUSES_MS[0] = 400; BT_PAUSES_MS[1] = 400; BT_PAUSES_MS[2] = 400; __bt.ecouteurs.connectionChange({ state: 0 }); });
  p = await pastille(page);
  eq([p.etat, p.texte, p.fond], ['reconnexion', 'Reconnexion…', ambrePastel], 'coupure : « Reconnexion… » en ambre');
  const vus = new Set();
  for (let i = 0; i < 40; i++) { vus.add(await page.evaluate(() => lecteurEtatInfo().detail)); await page.waitForTimeout(60); }
  check(vus.has('Essai 1 sur 3') && vus.has('Essai 2 sur 3') && vus.has('Essai 3 sur 3'), 'les essais s\'affichent « Essai n sur 3 » : ' + [...vus].join(' | '));
  p = await pastille(page);
  eq([p.etat, p.texte], ['absent', 'Connecter'], '3 essais sans réponse : « Connecter » (ambre)');
  eq(await page.evaluate(() => __bt.essais), ['AA:01', 'AA:01', 'AA:01'], 'exactement 3 tentatives de connexion sur le lecteur mémorisé');
  check(!rouges.includes((await pastille(page)).fond), 'après échec : toujours pas de rouge');

  // ---- coupure puis succès au 2e essai
  await page.evaluate(async () => { __bt.connectOk = true; BT_PAUSES_MS[0] = 20; BT_PAUSES_MS[1] = 20; BT_PAUSES_MS[2] = 20; await btConnect('AA:01'); __bt.essais = []; __bt.connectOk = (n) => n >= 2; __bt.ecouteurs.connectionChange({ state: 0 }); });
  await page.waitForFunction(() => lecteurEtatInfo().cle === 'connecte', null, { timeout: 4000 });
  eq(await page.evaluate(() => __bt.essais.length), 2, 'reconnecté au 2e essai : la reconnexion s\'arrête');
  eq((await pastille(page)).etat, 'connecte', 'de nouveau verte');

  // ---- réglage « Reconnexion automatique » coupé : aucune tentative
  await page.evaluate(() => { lecteurEnregistrerOption('reconnexionAuto', false); __bt.essais = []; __bt.connectOk = true; __bt.ecouteurs.connectionChange({ state: 0 }); });
  await page.waitForTimeout(300);
  eq([await page.evaluate(() => __bt.essais.length), (await pastille(page)).etat], [0, 'absent'], 'reconnexion automatique coupée : aucune tentative, « Lecteur absent »');
  await page.evaluate(() => lecteurEnregistrerOption('reconnexionAuto', true));

  // ---- déconnexion voulue : aucun essai
  await page.evaluate(async () => { __bt.essais = []; await btConnect('AA:01'); __bt.essais = []; await btDisconnect(); __bt.ecouteurs.connectionChange({ state: 0 }); });
  await page.waitForTimeout(300);
  eq(await page.evaluate(() => __bt.essais.length), 0, 'déconnexion voulue : pas de reconnexion automatique');
  await page.evaluate(() => { btDeconnexionVolontaire = false; });

  // ---- gestes sur la pastille : toucher, toucher sur la verte, appui long, retour Android, saisie conservée
  await page.evaluate(() => { BT_DELAIS.connexion = 700; BT_DELAIS.appuiLong = 150; lecteurEnregistrerOption('reconnexionAuto', false); __bt.connectOk = true; __bt.essais = []; __bt.deconnexions = 0; render('misebas-rapide'); });
  await page.fill('#scan-misebas', '09152');
  const saisie = () => page.evaluate(() => ({ valeur: document.getElementById('scan-misebas').value, vue: currentView, cible: !!activeScanTarget && activeScanTarget.id }));
  const mm = (v) => ({ valeur: '09152', vue: 'misebas-rapide', cible: 'scan-misebas' });
  p = await pastille(page);
  eq([p.etat, p.texte], ['absent', 'Connecter'], 'lecteur mémorisé mais absent : « Connecter »');
  check(p.h >= 36 && p.droite >= 0 && p.droite <= 24, 'zone tactile de la pastille : ' + p.h + ' px (36 minimum), dans l\'écran à droite');
  // mise en page à 360 px : sur la ligne du logo, symétrique du menu, sans chevaucher le logo, bandeau de même hauteur, quel que soit le libellé
  await page.setViewportSize({ width: 360, height: 800 });
  const geometrie = () => page.evaluate(() => { const hd = document.querySelector('header'), b = document.getElementById('btn-lecteur-lpr'), pill = document.getElementById('led-lecteur-lpr').getBoundingClientRect(), menu = document.querySelector('.header-slot-g .icon-btn:not(.hidden)').getBoundingClientRect(),
    lk = document.getElementById('brand-lockup'), r = document.createRange(); r.selectNodeContents(lk); const t = r.getBoundingClientRect(); const avec = Math.round(hd.getBoundingClientRect().height); b.classList.remove('visible'); const sans = Math.round(hd.getBoundingClientRect().height); b.classList.add('visible');
    return { hauteurIdentique: avec === sans, h: Math.round(pill.height), memeLigne: Math.abs((pill.top + pill.height / 2) - (menu.top + menu.height / 2)) <= 1, sansChevauchement: t.right <= pill.left + 0.5 && t.left >= menu.right - 0.5, dansEcran: pill.right <= innerWidth, decalage: Math.round((t.left + t.right) / 2 - innerWidth / 2) }; });
  for (const [cle, court] of [['connecte', 'Lecteur'], ['absent', 'Connecter'], ['aucun', 'Choisir'], ['connexion', 'Connexion…'], ['reconnexion', 'Reconnexion…']]) {
    await page.evaluate(([c, t]) => { document.getElementById('led-lecteur-lpr').dataset.etat = c; document.getElementById('led-lecteur-lpr').querySelector('.txt').textContent = t; }, [cle, court]);
    const g = await geometrie();
    check(g.hauteurIdentique && g.h >= 36 && g.memeLigne && g.sansChevauchement && g.dansEcran && Math.abs(g.decalage) <= (cle === 'reconnexion' ? 10 : 1), '360 px, « ' + court + ' » : ' + JSON.stringify(g));
  }
  await page.evaluate(() => updateHeaderReaderButton());
  await page.setViewportSize({ width: 390, height: 844 });
  // toucher : connexion immédiate, sans quitter l'écran
  await page.evaluate(() => { __bt.delai = 400; });
  await page.click('#btn-lecteur-lpr');
  p = await pastille(page);
  eq([p.etat, p.texte, p.fond], ['connexion', 'Connexion…', ambrePastel], 'toucher sur l\'ambre : « Connexion… » (ambre)');
  await page.click('#btn-lecteur-lpr');   // ignoré pendant « Connexion… »
  eq(await page.evaluate(() => __bt.essais.length), 1, 'un second toucher pendant « Connexion… » est ignoré (une seule connexion)');
  await page.waitForFunction(() => document.getElementById('led-lecteur-lpr').dataset.etat === 'connecte');
  p = await pastille(page);
  eq([p.texte, p.fond, p.point], ['Lecteur', vertPastel, vert], 'connexion réussie : « Lecteur » (vert)');
  eq([await page.evaluate(() => __bt.essais), await saisie(), await page.evaluate(() => !!document.getElementById('ecran-lecteur'))], [['AA:01'], mm(), false], 'la connexion s\'est faite sans quitter l\'écran ni perdre la saisie, sans ouvrir l\'écran Lecteur');
  // échec : retour à l'ambre + toast, saisie intacte
  await page.evaluate(() => { __bt.delai = 0; __bt.ecouteurs.connectionChange({ state: 0 }); __bt.connectOk = false; __bt.essais = []; });
  eq((await pastille(page)).texte, 'Connecter', 'coupure (reconnexion automatique coupée) : de nouveau « Connecter »');
  await page.click('#btn-lecteur-lpr');
  await page.waitForFunction(() => document.getElementById('led-lecteur-lpr').dataset.etat === 'absent' && document.querySelector('.toast.show'));
  eq([await page.evaluate(() => document.querySelector('.toast').textContent), (await pastille(page)).texte, await saisie()], ['Lecteur introuvable.', 'Connecter', mm()], 'échec : toast « Lecteur introuvable. », pastille ambre, saisie intacte');
  check(!rouges.includes((await pastille(page)).fond), 'jamais rouge, même après un échec');
  // connexion qui dure : après 10 s (ici 0,7 s) la pastille redevient cliquable
  await page.evaluate(() => { __bt.delai = 5000; __bt.connectOk = true; __bt.essais = []; });
  await page.click('#btn-lecteur-lpr');
  eq((await pastille(page)).texte, 'Connexion…', 'connexion lente : « Connexion… »');
  await page.waitForFunction(() => document.getElementById('led-lecteur-lpr').dataset.etat === 'absent', null, { timeout: 3000 });
  eq((await pastille(page)).texte, 'Connecter', 'au-delà du délai : la pastille repasse à « Connecter » (pas de blocage silencieux)');
  await page.click('#btn-lecteur-lpr');
  eq([await page.evaluate(() => __bt.essais.length), (await pastille(page)).texte], [2, 'Connexion…'], 'un nouveau toucher relance une connexion');
  await page.waitForFunction(() => document.getElementById('led-lecteur-lpr').dataset.etat === 'absent', null, { timeout: 3000 });
  await page.evaluate(() => { __bt.delai = 0; __bt.essais = []; });
  // appui long sur l'ambre : écran Lecteur, aucune connexion lancée
  const appuiLong = async () => { const r = await page.evaluate(() => { const b = document.getElementById('led-lecteur-lpr').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }); await page.mouse.move(r.x, r.y); await page.mouse.down(); await page.waitForTimeout(350); await page.mouse.up(); };
  await appuiLong();
  eq([await page.evaluate(() => !!document.getElementById('ecran-lecteur')), await page.evaluate(() => __bt.essais.length), (await pastille(page)).visible], [true, 0, false], 'appui long sur l\'ambre : écran Lecteur ouvert, aucune connexion lancée, pastille masquée derrière');
  eq(await page.evaluate(() => [document.querySelector('#ecran-lecteur h2').textContent, document.getElementById('scan-misebas').value, document.getElementById('scan-misebas').isConnected, currentView]), ['Lecteur', '09152', true, 'misebas-rapide'], 'l\'écran dessous n\'a pas bougé : même champ, même saisie');
  // bouton Retour d'Android : ferme et rétablit la cible de scan
  eq(await page.evaluate(() => typeof __app.ecouteurs.backButton), 'function', 'Retour Android : écouteur posé pendant l\'écran Lecteur');
  await page.evaluate(() => __app.ecouteurs.backButton({ canGoBack: false }));
  eq([await page.evaluate(() => !!document.getElementById('ecran-lecteur')), await page.evaluate(() => typeof __app.ecouteurs.backButton), await saisie(), (await pastille(page)).visible], [false, 'undefined', mm(), true], 'Retour Android : écran Lecteur fermé, écouteur retiré, saisie et cible de scan rétablies, pastille de retour');
  // toucher sur la verte : écran Lecteur, jamais de déconnexion
  await page.evaluate(async () => { __bt.connectOk = true; await btConnect('AA:01'); __bt.essais = []; __bt.deconnexions = 0; });
  await page.click('#btn-lecteur-lpr');
  eq([await page.evaluate(() => !!document.getElementById('ecran-lecteur')), await page.evaluate(() => [__bt.essais.length, __bt.deconnexions])], [true, [0, 0]], 'toucher sur la verte : écran Lecteur, sans déconnexion ni nouvelle connexion');
  await page.click('#btn-lecteur-retour');
  eq([await page.evaluate(() => !!document.getElementById('ecran-lecteur')), await saisie(), await page.evaluate(() => typeof __app.ecouteurs.backButton)], [false, mm(), 'undefined'], 'flèche de retour : écran de scan retrouvé à l\'identique (saisie et cible de scan)');
  // appui long sur la verte
  await appuiLong();
  check(await page.evaluate(() => !!document.getElementById('ecran-lecteur')), 'appui long sur la verte : écran Lecteur');
  await page.click('#btn-lecteur-retour');
  // appui long pendant « Connexion… »
  await page.evaluate(async () => { await btDisconnect(); btDeconnexionVolontaire = false; __bt.delai = 5000; });
  await page.click('#btn-lecteur-lpr');
  eq((await pastille(page)).texte, 'Connexion…', 'connexion en cours');
  await appuiLong();
  check(await page.evaluate(() => !!document.getElementById('ecran-lecteur')), 'appui long pendant « Connexion… » : écran Lecteur');
  await page.click('#btn-lecteur-retour');
  await page.evaluate(() => { __bt.delai = 0; });
  await page.waitForFunction(() => document.getElementById('led-lecteur-lpr').dataset.etat !== 'connexion', null, { timeout: 3000 });
  // aucun lecteur choisi : le toucher ouvre l'écran Lecteur
  await page.evaluate(() => { btConnectedAddress = null; DB.lecteurBluetooth = null; updateHeaderReaderButton(); });
  eq((await pastille(page)).texte, 'Choisir', 'aucun lecteur : « Choisir »');
  await page.click('#btn-lecteur-lpr');
  check(await page.evaluate(() => !!document.getElementById('ecran-lecteur')), 'toucher sur « Choisir » : écran Lecteur');
  await page.click('#btn-lecteur-retour');
  await page.evaluate(() => { DB.lecteurBluetooth = { address: 'AA:01', name: 'Allflex LPR 4812' }; lecteurEnregistrerOption('reconnexionAuto', true); BT_DELAIS.connexion = 10000; __bt.connectOk = true; __bt.essais = []; });

  // ---- écran Lecteur (par-dessus l'écran de scan)
  await page.evaluate(async () => { render('misebas-rapide'); await btConnect('AA:01'); });
  await page.click('#btn-lecteur-lpr');
  const e = await page.evaluate(() => ({ titre: document.querySelector('#ecran-lecteur h2').textContent, nom: document.querySelector('#lecteur-etat b').textContent, etat: document.getElementById('lecteur-pastille-etat').textContent, ton: document.getElementById('lecteur-pastille-etat').className,
    interrupteurs: [...document.querySelectorAll('#lecteur-reglages label')].map(l => l.firstElementChild.firstChild.textContent + ':' + l.querySelector('input').checked), zones: [...document.querySelectorAll('.card .prm-titre')].map(t => t.textContent),
    boutons: [...document.querySelectorAll('#ecran-lecteur .btn')].map(b => b.textContent), principaux: document.querySelectorAll('#ecran-lecteur .btn-primary').length, pastilleEntete: getComputedStyle(document.getElementById('btn-lecteur-lpr')).display }));
  eq([e.titre, e.nom, e.etat, e.ton], ['Lecteur', 'Allflex LPR 4812', 'Connecté', 'mb-pastille vert'], 'écran Lecteur : état « Connecté » (vert)');
  eq(e.interrupteurs, ['Reconnexion automatique:true', 'Bip sonore:true'], 'deux interrupteurs, activés par défaut');
  check(e.zones.includes('Tester un scan') && e.zones.includes('Changer de lecteur'), 'zones « Tester un scan » et choix du lecteur');
  eq(e.boutons, ['Choisir un autre lecteur', 'Oublier ce lecteur'], 'boutons : « Choisir un autre lecteur », « Oublier ce lecteur »');
  eq([e.principaux, e.pastilleEntete], [0, 'none'], 'connecté : aucun bouton principal ; pas de pastille d\'en-tête derrière l\'écran Lecteur');

  // état reconnexion / absent dans l'écran
  await page.evaluate(() => { __bt.connectOk = false; BT_PAUSES_MS[0] = 3000; __bt.ecouteurs.connectionChange({ state: 0 }); });
  let r = await page.evaluate(() => ({ etat: document.getElementById('lecteur-pastille-etat').textContent, ton: document.getElementById('lecteur-pastille-etat').className, detail: document.getElementById('lecteur-detail').textContent }));
  eq(r, { etat: 'Reconnexion en cours…', ton: 'mb-pastille ambre', detail: 'Essai 1 sur 3' }, 'écran Lecteur : « Reconnexion en cours… » (ambre, essai 1 sur 3)');
  await page.evaluate(() => { btReconnexionAnnuler(); });
  r = await page.evaluate(() => ({ etat: document.getElementById('lecteur-pastille-etat').textContent, ton: document.getElementById('lecteur-pastille-etat').className, bouton: document.getElementById('btn-lecteur-reconnecter').textContent, principaux: document.querySelectorAll('#ecran-lecteur .btn-primary').length }));
  eq(r, { etat: 'Lecteur absent', ton: 'mb-pastille ambre', bouton: 'Se reconnecter', principaux: 1 }, 'écran Lecteur : absent (ambre) avec « Se reconnecter » (un seul bouton principal)');
  await page.evaluate(() => { __bt.connectOk = true; __bt.essais = []; });
  await page.click('#btn-lecteur-reconnecter');
  await page.waitForFunction(() => document.getElementById('lecteur-pastille-etat').textContent === 'Connecté');
  eq(await page.evaluate(() => __bt.essais), ['AA:01'], '« Se reconnecter » : connexion au lecteur mémorisé');

  // ---- interrupteurs : propres à l'appareil
  await page.click('#f-lecteur-bip'); await page.click('#f-lecteur-reco');
  eq(await page.evaluate(() => DB.lecteurOptions), { reconnexionAuto: false, bip: false }, 'interrupteurs mémorisés dans DB.lecteurOptions');
  const html = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
  const meta = html.match(/const META_FIELDS = \[([\s\S]*?)\];/)[1];
  check(!/lecteurOptions|lecteurBluetooth/.test(meta), 'réglages du lecteur absents de META_FIELDS : propres à l\'appareil, jamais synchronisés');
  await page.click('#f-lecteur-bip'); await page.click('#f-lecteur-reco');
  eq(await page.evaluate(() => lecteurOptions()), { reconnexionAuto: true, bip: true }, 'réactivés');

  // ---- tester un scan : clavier et bâton
  await page.fill('#f-lecteur-test', '250123456789012'); await page.press('#f-lecteur-test', 'Enter');
  check(await page.evaluate(() => /Scan reçu : 250123456789012/.test(document.getElementById('lecteur-test-ok').textContent) && /brebis n°/.test(document.getElementById('lecteur-test-ok').textContent)), 'test de scan au clavier : résultat vert, brebis reconnue');
  await page.evaluate(() => onEidScanned('250999888777666'));
  check(await page.evaluate(() => /250999888777666/.test(document.getElementById('lecteur-test-ok').textContent) && !/brebis n°/.test(document.getElementById('lecteur-test-ok').textContent)), 'un scan du bâton arrive dans la zone de test');
  await page.fill('#f-lecteur-test', '1234'); await page.press('#f-lecteur-test', 'Enter');
  check(await page.evaluate(() => !!document.getElementById('lecteur-test-court') && getComputedStyle(document.getElementById('lecteur-test-court')).backgroundColor === 'rgb(251, 238, 215)'), 'numéro trop court : message ambre');

  // ---- choisir un autre lecteur
  await page.click('#btn-lecteur-choisir');
  await page.waitForFunction(() => document.querySelectorAll('#lecteur-appareils .assistant-appareil').length === 2);
  eq(await page.evaluate(() => [document.querySelectorAll('.btn-choisir-lecteur').length, document.querySelector('#lecteur-appareils .mb-pastille').textContent]), [1, 'Mémorisé'], 'le lecteur déjà mémorisé est marqué « Mémorisé »');
  eq(await page.evaluate(() => [...document.querySelectorAll('#lecteur-appareils .assistant-appareil b')].map(b => b.textContent)), ['Allflex LPR 4812', 'Allflex LPR 3390'], 'recherche : lecteurs détectés');
  await page.evaluate(() => { __bt.essais = []; __bt.deconnexions = 0; });
  await page.click('.btn-choisir-lecteur[data-address="BB:02"]');
  await page.waitForFunction(() => DB.lecteurBluetooth.address === 'BB:02');
  await page.waitForFunction(() => document.querySelector('#lecteur-etat b').textContent === 'Allflex LPR 3390');
  eq(await page.evaluate(() => [__bt.essais, __bt.deconnexions]), [['BB:02'], 1], 'nouveau lecteur mémorisé et connecté (l\'ancien est déconnecté)');

  // ---- oublier ce lecteur : un geste, sans confirm()
  await page.click('#btn-lecteur-oublier');
  check(await page.evaluate(() => /Oublier « Allflex LPR 3390 »/.test(document.getElementById('lecteur-oubli-msg').textContent)), 'oublier : confirmation en ligne');
  await page.click('#btn-lecteur-oubli-annuler');
  check(await page.evaluate(() => DB.lecteurBluetooth.address === 'BB:02' && !!document.getElementById('btn-lecteur-oublier')), 'Annuler : le lecteur est conservé');
  await page.click('#btn-lecteur-oublier'); await page.click('#btn-lecteur-oubli-ok');
  await page.evaluate(() => { __bt.essais = []; __bt.ecouteurs.connectionChange({ state: 0 }); });
  await page.waitForTimeout(200);
  r = await page.evaluate(() => ({ db: DB.lecteurBluetooth, etat: document.getElementById('lecteur-pastille-etat').textContent, essais: __bt.essais.length, principal: document.getElementById('btn-lecteur-choisir').className.includes('btn-primary') }));
  eq(r, { db: null, etat: 'Aucun lecteur choisi', essais: 0, principal: true }, 'lecteur oublié : « Aucun lecteur choisi », plus de reconnexion, « Choisir un lecteur » devient le bouton principal');
  eq(dialogues, [], 'aucun confirm() / alert() dans tout le parcours');

  // ---- retour : revient à l'écran de scan
  await page.click('#btn-lecteur-retour');
  eq(await page.evaluate(() => [currentView, !!document.getElementById('ecran-lecteur')]), ['misebas-rapide', false], 'la flèche de retour ferme l\'écran Lecteur : écran de scan d\'où l\'on vient');
  check((await pastille(page)).visible, 'la pastille est de retour sur l\'écran de scan');
  // depuis Paramètres (menu) : cinq rubriques dont Lecteur
  await page.evaluate(() => { parametresRubrique = null; render('parametres'); });
  eq(await page.evaluate(() => [...document.querySelectorAll('.prm-rub-titre')].map(e => e.textContent)), ['Exploitation', 'Campagne', 'Listes', 'Lecteur', 'Sauvegarde'], 'mobile : la rubrique Lecteur existe dans Paramètres');
  eq(await page.evaluate(() => document.querySelector('.prm-rub[data-rub="lecteur"] .prm-rub-resume').textContent), 'Aucun lecteur choisi', 'résumé de la rubrique');
  await page.click('.prm-rub[data-rub="lecteur"]'); await page.click('#btn-back');
  eq(await page.evaluate(() => [currentView, !!document.querySelector('.prm-rub')]), ['parametres', true], 'Retour depuis la rubrique : écran d\'arrivée de Paramètres');
  check(await page.evaluate(() => !document.getElementById('card-diag-bluetooth')), 'le diagnostic n\'est plus une carte de la Sauvegarde');
  await page.evaluate(() => { parametresRubrique = 'lecteur'; render('parametres'); });
  await page.click('#btn-goto-diag-bluetooth');
  eq(await page.evaluate(() => currentView), 'diag-bluetooth', 'le diagnostic reste accessible depuis l\'écran Lecteur');

  // ---- bip sonore
  await page.evaluate(() => { render('misebas-rapide'); window.__bips.length = 0; lecteurEnregistrerOption('bip', true); playBeepTrouve(); playBeepAmbigu(); playBeepRate(); playBeepDejaTrouve(); });
  await page.waitForTimeout(400);
  const bips = await page.evaluate(() => window.__bips);
  eq(bips.length, 6, 'bip activé : 2 + 2 + 1 + 1 notes');
  const sig = (a) => JSON.stringify(a);
  const profils = [bips.slice(0, 2), bips.slice(2, 4), bips.slice(4, 5), bips.slice(5, 6)].map(sig);
  check(new Set(profils).size === 4, 'les quatre bips (trouvé, ambigu, introuvable, déjà trouvé) restent distincts : ' + profils.join(' / '));
  await page.evaluate(() => { window.__bips.length = 0; lecteurEnregistrerOption('bip', false); playBeepTrouve(); playBeepAmbigu(); playBeepRate(); playBeepDejaTrouve(); playBeep(); });
  await page.waitForTimeout(400);
  eq(await page.evaluate(() => window.__bips.length), 0, 'bip coupé : plus aucun son (quatre bips et bip simple)');
  // la saisie manuelle passe par le même interrupteur
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'essai-bip'; document.body.appendChild(i); attachEidBeep(i); });
  await page.fill('#essai-bip', '250123456789012'); await page.waitForTimeout(200);
  eq(await page.evaluate(() => window.__bips.length), 0, 'bip coupé : la saisie manuelle d\'un n° est silencieuse aussi');
  await page.evaluate(() => { lecteurEnregistrerOption('bip', true); document.getElementById('essai-bip').value = ''; document.getElementById('essai-bip').dispatchEvent(new Event('input')); });
  await page.fill('#essai-bip', '250123456789012'); await page.waitForTimeout(200);
  eq(await page.evaluate(() => window.__bips.length), 1, 'bip activé : la saisie manuelle bipe');
  // ---- la pastille est sur TOUS les écrans mobiles à bandeau vert (parcours des écrans du menu, de saisie, de détail et de Paramètres)
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => { __bt.connectOk = false; __bt.delai = 0; lecteurEnregistrerOption('reconnexionAuto', false); btReconnexionAnnuler(); btConnectedAddress = null; DB.lecteurBluetooth = { address: 'AA:01', name: 'Allflex LPR 4812' }; parametresRubrique = null; });
  const ecrans = await page.evaluate(() => [...new Set([...NAV_ITEMS.map(i => i.view), 'misebas-rapide', 'echo-rapide', 'controle-lot-delai', 'parametres', 'diag-bluetooth', 'add-sheep', 'detail'])]);
  check(ecrans.length >= 20, 'parcours : ' + ecrans.length + ' écrans');
  for (const v of ecrans) {
    await page.evaluate((x) => { parametresRubrique = null; render(x, x === 'detail' ? DB.brebis[0].id : undefined); }, v);
    const r = await page.evaluate(() => { const hd = document.querySelector('header'), b = document.getElementById('btn-lecteur-lpr'), pill = document.getElementById('led-lecteur-lpr').getBoundingClientRect(), menu = document.querySelector('.header-slot-g .icon-btn:not(.hidden)').getBoundingClientRect(), camp = document.querySelector('.header-farm-row').getBoundingClientRect(),
      rg = document.createRange(); rg.selectNodeContents(document.getElementById('brand-lockup')); const t = rg.getBoundingClientRect(); return { entete: !hd.classList.contains('hidden') && getComputedStyle(hd).display !== 'none', visible: b.classList.contains('visible') && getComputedStyle(b).display !== 'none', h: Math.round(pill.height),
      memeLigne: Math.abs((pill.top + pill.height / 2) - (menu.top + menu.height / 2)) <= 1, sansChevauchement: t.right <= pill.left + 0.5 && t.left >= menu.right - 0.5 && pill.bottom <= camp.top + 1, texte: document.getElementById('led-lecteur-lpr').querySelector('.txt').textContent }; });
    check(r.entete && r.visible && r.h >= 36 && r.memeLigne && r.sansChevauchement && r.texte === 'Connecter', 'écran « ' + v + ' » : pastille présente en haut à droite, sur la ligne du logo : ' + JSON.stringify(r));
  }
  // exception : l'écran Lecteur des Paramètres est déjà cet écran (pas de pastille, pas d'identifiants en double)
  await page.evaluate(() => { parametresRubrique = 'lecteur'; render('parametres'); });
  check(await page.evaluate(() => !document.getElementById('btn-lecteur-lpr').classList.contains('visible') && document.querySelectorAll('#lecteur-etat').length === 1), 'Paramètres › Lecteur : pas de pastille');
  await page.evaluate(() => { parametresRubrique = null; });
  // écrans sans bandeau vert : pas de pastille visible
  for (const v of ['auth', 'attente-compte', 'premiere-configuration']) {
    await page.evaluate((x) => { premconfEtat = null; render(x); }, v);
    check(await page.evaluate(() => getComputedStyle(document.querySelector('header')).display === 'none'), 'écran « ' + v + ' » : pas de bandeau, donc pas de pastille');
  }
  await page.evaluate(() => render('home'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.close();
}

// ======================================================================= mobile sans plugin (navigateur)
{
  const { page } = await ouvrir(false, false);
  await page.evaluate(() => render('misebas-rapide'));
  check(!(await pastille(page)).visible, 'sans plugin Bluetooth : pas de pastille');
  await page.evaluate(() => { parametresRubrique = 'lecteur'; render('parametres'); });
  check(await page.evaluate(() => !!document.getElementById('lecteur-indisponible')), 'sans plugin : message neutre (pas d\'erreur)');
  await page.close();
}

// ======================================================================= PC
{
  const { page } = await ouvrir(true);
  for (const v of await page.evaluate(() => [...NAV_ITEMS.map(i => i.view), 'misebas-rapide', 'parametres'])) { await page.evaluate((x) => render(x), v); check(!(await pastille(page)).visible && await page.evaluate(() => getComputedStyle(document.getElementById('btn-lecteur-lpr')).display === 'none'), 'PC ' + v + ' : aucune pastille de lecteur'); }
  await page.evaluate(() => render('parametres'));
  for (const t of ['exploitation', 'campagne', 'listes', 'imports', 'sauvegarde']) {
    await page.evaluate((k) => { parametresTab = k; render('parametres'); }, t);
    eq(await page.evaluate(() => document.getElementById('prm-lecteur-pc').textContent), 'Lecteur : mobile uniquement', 'PC Paramètres › ' + t + ' : une ligne « Lecteur : mobile uniquement »');
  }
  eq(await page.evaluate(() => [...document.querySelectorAll('.tab-bar .tab-btn')].map(b => b.textContent)), ['Exploitation', 'Campagne', 'Listes', 'Imports', 'Sauvegarde'], 'PC : toujours 5 onglets, pas d\'onglet Lecteur');
  check(await page.evaluate(() => !/Scanner|bip/i.test(document.getElementById('app').innerText)), 'PC : aucun libellé de scan ni de bip');
  await page.close();
}
await browser.close();
console.log('\nTOUS LES TESTS « LECTEUR » SONT PASSÉS.');
