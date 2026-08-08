// Garde de non-régression : la table public.country_risks n'est jamais
// alimentée (0 ligne) — le hook useSupabaseCountryRisks.ts et le fallback
// de AfricaHeatmap.tsx qui l'interrogeaient ont été retirés le 2026-08-07
// car confirmés inatteignables en usage réel. Ce test empêche qu'une
// référence à cette table morte soit réintroduite par erreur côté frontend.
//
// Exécution : node --test scripts/tests/no-dead-country-risks-reference.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..', '..', 'src');
const CODE_EXTENSIONS = new Set(['.ts', '.tsx']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (CODE_EXTENSIONS.has(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

test("aucune référence à la table morte 'country_risks' dans src/", () => {
  const files = walk(SRC_DIR);
  assert.ok(files.length > 0, 'aucun fichier source trouvé sous src/ — vérifier le chemin');

  const offenders = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    if (source.includes('country_risks')) {
      offenders.push(file);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `référence(s) trouvée(s) à la table morte "country_risks" : ${offenders.join(', ')}`,
  );
});
