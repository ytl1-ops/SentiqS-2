// Garde de non-régression : le bug corrigé le 2026-08-07 était un payload
// inséré dans public.activity_log avec des colonnes inexistantes (action,
// timestamp) — l'insertion échouait silencieusement à chaque exécution de
// scheduled-scan. Ce test statique relit chaque Edge Function et vérifie
// que tout insert() sur activity_log n'utilise que les colonnes réelles de
// la table (cf. supabase/migrations — colonnes : id, type, message, details,
// country_code, analyst_initials, created_at).
//
// Exécution : node --test scripts/tests/activity-log-schema.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = join(__dirname, '..', '..', 'supabase', 'functions');

const ALLOWED_COLUMNS = new Set(['type', 'message', 'details', 'country_code', 'analyst_initials']);
const REQUIRED_COLUMNS = ['type', 'message'];

function listIndexFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const candidate = join(full, 'index.ts');
      try {
        statSync(candidate);
        out.push(candidate);
      } catch {
        // pas de index.ts dans ce dossier — on ignore
      }
    }
  }
  return out;
}

function extractActivityLogInsertBlocks(source) {
  // Repère chaque `.from('activity_log').insert({ ... })` (accolade
  // top-level équilibrée) — suffisant pour ces fichiers, pas un vrai parseur JS.
  const blocks = [];
  const marker = /\.from\(\s*['"]activity_log['"]\s*\)\s*\.insert\(\s*\{/g;
  let m;
  while ((m = marker.exec(source)) !== null) {
    const start = m.index + m[0].length - 1; // position of the opening '{'
    let depth = 0;
    let i = start;
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push(source.slice(start + 1, i));
  }
  return blocks;
}

function extractTopLevelKeys(block) {
  const keys = [];
  let depth = 0;
  const keyRegex = /(^|[,{\s])([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
  // On ne garde que les clés situées à depth 0 dans le bloc (pas dans un
  // sous-objet comme details: {...}).
  let lastIndex = 0;
  for (let i = 0; i < block.length; i++) {
    if (block[i] === '{' || block[i] === '[') depth++;
    else if (block[i] === '}' || block[i] === ']') depth--;
    if (depth === 0) {
      keyRegex.lastIndex = i;
      const local = new RegExp(keyRegex.source, 'y');
      local.lastIndex = i;
      const match = local.exec(block);
      if (match && match.index === i) {
        keys.push(match[2]);
      }
    }
  }
  return keys;
}

test('chaque insert() sur activity_log utilise uniquement des colonnes existantes', () => {
  const files = listIndexFiles(FUNCTIONS_DIR);
  assert.ok(files.length > 0, 'aucune Edge Function trouvée sous supabase/functions — vérifier le chemin');

  let checkedInserts = 0;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const blocks = extractActivityLogInsertBlocks(source);

    for (const block of blocks) {
      checkedInserts++;
      const keys = extractTopLevelKeys(block);

      for (const key of keys) {
        assert.ok(
          ALLOWED_COLUMNS.has(key),
          `${file} : la clé "${key}" n'existe pas dans public.activity_log (colonnes valides : ${[...ALLOWED_COLUMNS].join(', ')})`,
        );
      }

      for (const required of REQUIRED_COLUMNS) {
        assert.ok(
          keys.includes(required),
          `${file} : colonne obligatoire "${required}" absente de l'insert activity_log`,
        );
      }
    }
  }

  assert.ok(checkedInserts > 0, 'aucun insert() sur activity_log détecté — vérifier que les fonctions attendues sont bien présentes');
});
