/* Moteur de versions des fiches (lot 4, livraison 2), fonctions pures, sans réseau : un « serveur » en mémoire applique les écritures de deux
   appareils (heure serveur = compteur) ; on vérifie rangement, lecture, ajout / suppression / modification concurrents, supprimé-modifié,
   choix de l'éleveur, écritures d'un appareil d'avant la livraison 1, horloge d'appareil faussée, doublons identiques. Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext()).newPage();
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  let heure = Date.now();
  // serveur : applique une écriture (marqueurs -> heure serveur / effacement)
  window.__srv = (raw, maj) => {
    const out = JSON.parse(JSON.stringify(raw || {}));
    heure += 10;
    Object.keys(maj).forEach(k => {
      const ch = k.split('.'); let c = out;
      for (let i = 0; i < ch.length - 1; i++) { if (!c[ch[i]] || typeof c[ch[i]] !== 'object') c[ch[i]] = {}; c = c[ch[i]]; }
      const v = maj[k], f = ch[ch.length - 1];
      const res = x => (x && typeof x === 'object' && !Array.isArray(x)) ? (x.__v2 === 'ts' ? { ms: heure } : Object.fromEntries(Object.entries(x).map(([a, b]) => [a, res(b)]))) : (Array.isArray(x) ? x.map(res) : x);
      if (v && v.__v2 === 'del') delete c[f]; else c[f] = res(v);
    });
    return out;
  };
  window.__soin = (prod, d, id) => ({ id, date: d, produit: prod, type: 'Traitement' });
  window.__fiche = () => ({ id: 'b1', eid: '250000045651001', statut: 'active', mouvements: [{ id: 'm1', type: 'Entrée', date: '2024-01-01' }],
    sanitaire: [__soin('Produit A', '2026-11-01', 's1'), __soin('Produit B', '2026-11-02', 's2')],
    agnelages: [{ id: 'a1', date: '2026-11-02', campagne: 2027, lambs: [{ id: 'l1', sexe: 'Mâle', eid: '250000045661001', sanitaire: [] }, { id: 'l2', sexe: 'Mort-né' }] }],
    controleLaitier: [{ id: 'c1', controle: 1, quantite: 900, campagne: 2027 }] });
  window.__ranger = raw => __srv(raw, Object.fromEntries(Object.entries(rangementFicheV(raw, { __v2: 'ts' })).map(([k, v]) => [k, v])));
  window.__ecrire = (raw, local, opts) => __srv(raw, opsVersionsFicheV(local, raw, opts).maj);
  window.__prod = r => (r.sanitaire || []).map(s => s.produit);
  window.__conflits = raw => [...etatVersionsV(raw.el).values()].filter(s => s.conflit).map(s => s.K);
});

// 1. rangement : même fiche relue, ids gardés, doublons identiques départagés
eq(await p.evaluate(() => {
  const leg = __fiche(); leg.notes = [{ date: '2026-11-01', texte: 'Même' }, { date: '2026-11-01', texte: 'Même' }];
  const raw = __ranger(leg);
  const attendu = JSON.parse(JSON.stringify(leg)); poserIdsFiche(attendu, 'contenu');
  const m = materialiserFicheV(raw);
  return [texteStableElement(m, false) === texteStableElement(Object.assign({}, attendu), false), m.notes.length, rangementVerifieV(raw), rangementFicheV(leg, 1).el['k' + empreinteTexte('sanitaire:s1')] !== undefined,
    JSON.stringify(rangementFicheV(leg, 1)) === JSON.stringify(rangementFicheV(JSON.parse(JSON.stringify(leg)), 1))];
}), [true, 2, true, true, true], 'rangement : fiche relue à l\'identique, 2 notes identiques gardées, vérification, rangement identique sur deux appareils');

// 2. test 7 : un appareil supprime un soin, l'autre en ajoute un (hors réseau, mêmes bases) : les deux sont gardés
eq(await p.evaluate(() => {
  let srv = __ranger(__fiche());
  const base = materialiserFicheV(srv);
  const pc = JSON.parse(JSON.stringify(base)); pc.sanitaire = pc.sanitaire.filter(s => s.produit !== 'Produit A');
  const tel = JSON.parse(JSON.stringify(base)); tel.sanitaire.push(__soin('Produit C', '2026-11-20', 'eC'));
  const opsTel = opsVersionsFicheV(tel, srv).maj, opsPc = opsVersionsFicheV(pc, srv).maj;
  srv = __srv(__srv(srv, opsTel), opsPc);
  return [__prod(materialiserFicheV(srv)), __conflits(srv)];
}), [['Produit B', 'Produit C'], []], 'suppression d\'un soin et ajout d\'un autre : aucune perte, aucun conflit');

// 3. même soin modifié des deux côtés : la plus récente à l'heure SERVEUR gagne, l'autre est gardée, conflit ; horloge d'appareil sans effet
eq(await p.evaluate(() => {
  let srv = __ranger(__fiche());
  const base = materialiserFicheV(srv);
  const a = JSON.parse(JSON.stringify(base)); a.sanitaire[0].dose = '1 cc';
  const b = JSON.parse(JSON.stringify(base)); b.sanitaire[0].dose = '3 cc';
  const realNow = Date.now; Date.now = () => realNow() + 86400000 * 30;    // appareil A en avance d'un mois : ne compte pas
  const opsA = opsVersionsFicheV(a, srv).maj; Date.now = realNow;
  const opsB = opsVersionsFicheV(b, srv).maj;
  srv = __srv(srv, opsB); srv = __srv(srv, opsA);                          // A arrive au serveur APRÈS B
  const m = materialiserFicheV(srv), st = etatVersionsV(srv.el).get('sanitaire:s1');
  return [m.sanitaire[0].dose, st.conflit, st.heads.map(h => h.d.dose).sort()];
}), ['1 cc', true, ['1 cc', '3 cc']], 'même soin modifié des deux côtés : dernier arrivé au serveur gagne, l\'autre gardée, conflit');

// 4. supprimé d'un côté, modifié de l'autre : la modification gagne, conflit ; mise bas supprimée et soin ajouté à son agneau : rétablie
eq(await p.evaluate(() => {
  let srv = __ranger(__fiche());
  const base = materialiserFicheV(srv);
  const a = JSON.parse(JSON.stringify(base)); a.sanitaire = a.sanitaire.filter(s => s.id !== 's1'); a.agnelages = [];
  const b = JSON.parse(JSON.stringify(base)); b.sanitaire[0].dose = '5 cc'; b.agnelages[0].lambs[0].sanitaire.push(__soin('Produit D', '2026-11-21', 'eD'));
  const opsA = opsVersionsFicheV(a, srv).maj, opsB = opsVersionsFicheV(b, srv).maj;
  srv = __srv(__srv(srv, opsB), opsA);
  const m = materialiserFicheV(srv);
  return [m.sanitaire.map(s => s.dose || '-'), m.agnelages.length, m.agnelages[0] && m.agnelages[0].lambs.map(l => l.id), m.agnelages[0] && m.agnelages[0].lambs[0].sanitaire.map(s => s.produit), __conflits(srv).sort()];
}), [['5 cc', '-'], 1, ['l1'], ['Produit D'], ['agnelages:a1', 'agnelages:a1>lambs:l1', 'sanitaire:s1']], 'supprimé / modifié : la modification gagne ; mise bas supprimée mais soin ajouté à un agneau : rétablie (mort-né non touché reste supprimé), conflits signalés');

// 5. choix de l'éleveur : écrit sur toutes les têtes, plus de conflit ; ménage après 10 min seulement
eq(await p.evaluate(() => {
  let srv = __ranger(__fiche());
  const base = materialiserFicheV(srv);
  const a = JSON.parse(JSON.stringify(base)); a.sanitaire[0].dose = '1 cc';
  const b = JSON.parse(JSON.stringify(base)); b.sanitaire[0].dose = '3 cc';
  srv = __srv(__srv(srv, opsVersionsFicheV(a, srv).maj), opsVersionsFicheV(b, srv).maj);
  const st = etatVersionsV(srv.el).get('sanitaire:s1');
  const choix = materialiserFicheV(srv); choix.sanitaire[0].dose = '1 cc';      // l'éleveur garde la version « 1 cc » (perdante)
  srv = __ecrire(srv, choix, { resolutions: { 'sanitaire:s1': { heads: st.heads.map(h => h.vid) } } });
  const apres = etatVersionsV(srv.el).get('sanitaire:s1');
  const nVersions = apres.versions.length;
  srv = __ecrire(srv, materialiserFicheV(srv), {});                              // une écriture tout de suite : rien n'est effacé
  const nApresTot = etatVersionsV(srv.el).get('sanitaire:s1').versions.length;
  srv = __ecrire(srv, materialiserFicheV(srv), { maintenant: Date.now() + 3600000 });   // plus tard : ménage
  return [materialiserFicheV(srv).sanitaire[0].dose, apres.conflit, nVersions, nApresTot, etatVersionsV(srv.el).get('sanitaire:s1').versions.length];
}), ['1 cc', false, 3, 3, 1], 'choix : version gardée, conflit levé, anciennes versions gardées 10 min (annulable) puis effacées');

// 6. appareil d'avant la livraison 1 : il réécrit les listes à l'ancienne ; changement sans contradiction repris, contradiction = conflit
eq(await p.evaluate(() => {
  let srv = __ranger(__fiche());
  // un appareil à jour modifie s2 après le rangement
  const ajour = materialiserFicheV(srv); ajour.sanitaire[1].dose = '9 cc'; srv = __ecrire(srv, ajour, {});
  // l'ancien appareil (listes de l'époque du rangement) : ajoute un soin, modifie s1 (sans contradiction) et s2 (contradiction)
  const leg = JSON.parse(JSON.stringify(srv.gel));
  leg.sanitaire.push({ date: '2026-11-22', produit: 'Produit E', type: 'Traitement' });
  leg.sanitaire[0].dose = '7 cc'; leg.sanitaire[1].dose = '8 cc';
  srv = Object.assign({}, srv, leg);
  const m = materialiserFicheV(srv);
  const ops = opsVersionsFicheV(m, srv).maj;
  const srv2 = __srv(srv, ops);
  return [__prod(m), m.sanitaire.map(s => s.dose || '-'), __conflits(srv2), JSON.stringify(srv2.gel) === JSON.stringify(leg), recupererEcrituresAnciennesV(srv2)];
}), [['Produit A', 'Produit B', 'Produit E'], ['7 cc', '8 cc', '-'], ['sanitaire:s2'], true, null], 'ancien appareil : ajout et modification sans contradiction repris, contradiction = conflit (arrivée la dernière au serveur, l\'autre version gardée), plus rien à reprendre ensuite');

// 7. rien de changé = aucune écriture ; ordre des listes gardé ; ajout local écrit une seule fois
eq(await p.evaluate(() => {
  let srv = __ranger(__fiche());
  const m = materialiserFicheV(srv);
  const vide = Object.keys(opsVersionsFicheV(m, srv).maj).length;
  m.sanitaire.splice(1, 0, __soin('Produit X', '2026-11-01', 'eX'));
  srv = __ecrire(srv, m, {});
  const m2 = materialiserFicheV(srv);
  return [vide, __prod(m2), Object.keys(opsVersionsFicheV(m2, srv).maj).length];
}), [0, ['Produit A', 'Produit X', 'Produit B'], 0], 'aucune écriture sans changement ; un soin inséré garde sa place ; pas de réécriture');

// 8. fusion à la réception : ajout distant et modification locale non envoyée sur des éléments différents : les deux
eq(await p.evaluate(() => {
  let srv = __ranger(__fiche());
  const base = materialiserFicheV(srv);
  const autre = JSON.parse(JSON.stringify(base)); autre.sanitaire.push(__soin('Produit Z', '2026-11-23', 'eZ')); srv = __ecrire(srv, autre, {});
  const local = JSON.parse(JSON.stringify(base)); local.sanitaire[0].dose = '2 cc';
  const notes = [];
  const f = fusionnerFicheElementsV(local, materialiserFicheV(srv), base, etatVersionsV(srv.el), K => notes.push(K));
  return [__prod(f), f.sanitaire[0].dose, notes];
}), [['Produit A', 'Produit B', 'Produit Z'], '2 cc', []], 'réception : ajout distant + modification locale en attente gardés tous les deux');
console.log('OK moteur de versions : rangement, ajouts/suppressions concurrents, conflits, supprimé-modifié, choix, ancien appareil, horloge, fusion.');
await browser.close();
console.log('test_versions_moteur : OK');
