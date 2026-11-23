/* Identifiant d'un élément calculé d'après son contenu (v464, texteIdentiteElement) : la MÊME mise bas, telle qu'un appareil v446 la garde
   (champs vides absents, aucun id), telle que le serveur la garde (null, '' ), puis lue par la v463 et par la v464, sur deux appareils : la v464
   ne donne qu'UN identifiant ; un élément déjà rangé au serveur avec son identifiant v463 le garde (aucun nouvel id) ; un appareil qui arrive
   avec son propre identifiant pour la même mise bas reprend celui du serveur (une seule copie). Fonctions pures, jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext()).newPage();
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  // la même mise bas : appareil v446 (JSON local : champs vides absents) et serveur (Firestore : null, chaînes vides)
  const appareil = () => [{ date: '2026-11-02', campagne: 2027, lambs: [{ sexe: 'Mâle' }, { sexe: 'Femelle', eid: '250000045671001' }] }];
  const serveur = () => [{ date: '2026-11-02', campagne: 2027, codeRepro: null, note: '', lambs: [{ sexe: 'Mâle', eid: '', pere: null }, { sexe: 'Femelle', eid: '250000045671001', cause: null }] }];
  const idV463 = l => 'h' + empreinteTexte(texteStableElement(l[0], true));
  const idsV464 = l => { const c = JSON.parse(JSON.stringify(l)); poserIdsListe(c, 'contenu'); return c[0].id; };
  // deux appareils v464 qui lisent chacun une forme
  const a1 = appareil(), a2 = serveur();
  poserIdsFiche({ agnelages: a1 }, 'contenu'); poserIdsFiche({ agnelages: a2 }, 'contenu');
  // compte rangé en v463 (identifiants v463 dans el) : la v464 garde ces identifiants
  const ficheServeur = { id: 'b1', eid: '250000045651001', agnelages: serveur() };
  const vieux = JSON.parse(JSON.stringify(ficheServeur));
  // rangement fait par une v463 : on le simule en posant les identifiants à l'ancienne (texteStableElement) avant de ranger
  const ancienPoser = liste => { const rangs = {}; liste.forEach(e => { const b = 'h' + empreinteTexte(texteStableElement(e, true)); rangs[b] = (rangs[b] || 0) + 1; e.id = rangs[b] === 1 ? b : b + '-' + rangs[b]; }); };
  ancienPoser(vieux.agnelages); vieux.agnelages.forEach(ag => ancienPoser(ag.lambs));
  const rv = rangementFicheV(vieux, 1);
  const raw = Object.assign({}, ficheServeur, { el: rv.el, gel: { agnelages: serveur() }, lp: ['agnelages'] });
  const verifie = rangementVerifieV(raw);
  const lu = materialiserFicheV(raw);
  // un appareil ancien réécrit la liste à l'ancienne, sans rien changer : rien à reprendre, aucun nouvel élément
  const raw2 = Object.assign({}, raw, { agnelages: serveur() });
  const recup = recupererEcrituresAnciennesV(raw2);
  // un appareil arrive avec SA copie (identifiant v464) de la même mise bas : il reprend l'identifiant du serveur
  const local = { id: 'b1', eid: '250000045651001', agnelages: appareil() };
  poserIdsFiche(local, 'contenu');
  const fus = fusionnerFicheElementsV(local, lu, lu, etatVersionsV(raw.el), null);
  return {
    v463: [idV463(appareil()), idV463(serveur())], v464: [idsV464(appareil()), idsV464(serveur())], deuxAppareils: [a1[0].id, a2[0].id, a1[0].lambs.map(l => l.id).join(), a2[0].lambs.map(l => l.id).join()],
    verifie, idGarde: lu.agnelages[0].id === vieux.agnelages[0].id, recup: recup ? recup.ajouts.length : 0,
    fusion: [fus.agnelages.length, fus.agnelages[0].id === vieux.agnelages[0].id, fus.agnelages[0].lambs.length]
  };
});
check(r.v463[0] !== r.v463[1], 'constat v463 : la même mise bas recevait deux identifiants (champ vide absent / null)');
eq(r.v464[0], r.v464[1], 'v464 : la même mise bas, un seul identifiant (null, absent et vide comptent pareil)');
eq([r.deuxAppareils[0] === r.deuxAppareils[1], r.deuxAppareils[2] === r.deuxAppareils[3]], [true, true], 'deux appareils v464 : mêmes identifiants pour la mise bas et pour ses agneaux');
check(r.verifie && r.idGarde, 'compte rangé en v463 : relu par la v464 sans écart, l\'identifiant déjà synchronisé est gardé');
eq(r.recup, 0, 'liste réécrite à l\'ancienne sans changement : aucun nouvel identifiant, rien à reprendre');
eq(r.fusion, [1, true, 2], 'appareil arrivant avec sa propre copie : une seule mise bas, identifiant du serveur, ses 2 agneaux');
// écho d'un appareil v446 : la même mise bas renvoyée SANS id à côté de sa copie identifiée (cas réel : 9 mises bas en double)
const e = await p.evaluate(() => {
  const mb = () => ({ date: '2026-11-22', campagne: 2027, saisieA: 1795370519426, lambs: [{ sexe: 'Femelle', eid: '250000045672265' }] });
  const avecId = Object.assign(mb(), { id: 'hX' });
  const liste = [avecId, mb()];
  const retires = retirerEchosSansIdListe(liste);
  const vraieDouble = [mb(), mb()]; const gardees = retirerEchosSansIdListe(vraieDouble);
  // compte rangé : un appareil v446 réécrit la liste à l'ancienne avec l'écho → rien à reprendre
  const fiche = { id: 'b9', eid: '250000045651009', agnelages: [Object.assign(mb(), { id: 'hX' })] };
  const rv = rangementFicheV(fiche, 1);
  const raw = Object.assign({}, fiche, { el: rv.el, gel: rv.gel, lp: rv.lp });
  const raw2 = Object.assign({}, raw, { agnelages: [Object.assign(mb(), { id: 'hX' }), mb()] });
  const recup = recupererEcrituresAnciennesV(raw2);
  // base locale d'un appareil v446 qui passe en v464 : l'écho est retiré au chargement
  const d = migrateData({ brebis: [{ id: 'b9', eid: '250000045651009', statut: 'active', agnelages: [Object.assign(mb(), { id: 'hX' }), mb()] }], beliers: [], agnelles: [] });
  return [retires, liste.length, gardees, vraieDouble.length, recup ? recup.ajouts.length : 0, materialiserFicheV(raw2).agnelages.length, d.brebis[0].agnelages.length];
});
eq(e, [1, 1, 0, 2, 0, 1, 1], 'écho v446 (copie sans id) : retiré de la liste, jamais repris par la récupération, retiré au chargement ; une vraie double saisie (deux copies sans id) est gardée');
console.log('OK écho d\'un appareil v446 : une seule mise bas.');
console.log('OK identifiants : v463 en donnait deux, la v464 un seul (deux appareils), identifiants déjà rangés gardés, copie de l\'appareil alignée sur le serveur.');
await browser.close();
console.log('test_identite_elements : OK');
