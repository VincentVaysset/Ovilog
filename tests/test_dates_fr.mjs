/* Format des dates (CLAUDE.md) : tous les champs date affichent jj/mm/aaaa. Le format d'un <input type="date"> suit la LANGUE DU PROGRAMME (Chromium), pas
   l'attribut lang de la page : sur PC, Electron démarre en français (app.commandLine.appendSwitch('lang', 'fr-FR')) AVANT le démarrage de l'appli ;
   mobile : langue du téléphone (rien d'imposé). La page reste déclarée en français. Les valeurs restent en aaaa-mm-jj (données inchangées). */
import { readFileSync } from 'fs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const main = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
const i = main.indexOf("app.commandLine.appendSwitch('lang', 'fr-FR')"), j = main.indexOf('app.whenReady(');
check(i > 0, 'Electron démarre en français (appendSwitch lang fr-FR)');
check(j > i, 'le réglage de langue est posé AVANT app.whenReady');
const html = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
check(/^<!DOCTYPE html>\s*<html lang="fr">/.test(html), 'page déclarée en français');
check(!/type="date"[^>]*\blang="(?!fr)/.test(html), 'aucun champ date dans une autre langue');
console.log('test_dates_fr : OK');
