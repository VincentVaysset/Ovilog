/* Configuration commune des tests (voir tests/README.md). Aucun chemin absolu :
   tout se règle par variables d'environnement. */
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

const ici = path.dirname(fileURLToPath(import.meta.url));
export const LIB_DIR = ici;
// Appli servie en HTTP (par run_all.sh : python3 -m http.server 8998 dans www/).
export const URL_APP = process.env.OVILOG_URL || 'http://localhost:8998/index.html';
// Chromium : par défaut celui de Playwright ; CHROMIUM_PATH pour en imposer un.
export const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
// Exports d'élevage RÉELS : jamais versionnés (tests/data/ est ignoré par git).
const data = path.join(ici, '..', 'data');
export const EXPORT_ORIGINAL = process.env.OVILOG_EXPORT_ORIGINAL || path.join(data, 'troupeau-sauvegarde-2026-09-29.json');
export const EXPORT_CORRIGE = process.env.OVILOG_EXPORT_CORRIGE || path.join(data, 'troupeau_corrige.json');

// Lit un export en LECTURE SEULE ; absent => le test est SAUTÉ (code 0, message SKIP).
export function lireExport(chemin) {
  if (!existsSync(chemin)) {
    console.log('SKIP : export absent (' + chemin + ') -- voir tests/README.md');
    process.exit(0);
  }
  return JSON.parse(readFileSync(chemin, 'utf8'));
}
export function exportPresent(chemin) { return existsSync(chemin); }
