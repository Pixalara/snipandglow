import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

// =============================================================================
// Guards the server/client boundary in the App Router.
//
// WHY THIS EXISTS
// ---------------
// A server component may import TYPES from a 'use client' module freely — those
// are erased at compile time. It must NOT import a runtime value, because Next
// replaces such exports with a client reference: an opaque proxy the server
// cannot invoke. Calling one throws at REQUEST time with
// "Attempted to call X() from the server".
//
// This took /dashboard/staff down in production. `page.tsx` imported
// `parseStaffTab` from `staff-workspace.tsx` ('use client') and called it while
// rendering. Nothing caught it:
//
//   • tsc passed        — the types are perfectly valid
//   • eslint passed     — no rule models the RSC boundary
//   • next build passed — the route is dynamic, so it is never prerendered,
//                         and the throw only happens on a real request
//
// The same hazard is documented in billing/invoice-pdf.tsx, which deliberately
// omits 'use client' so the server can render it too.
// =============================================================================

const APP_DIR = resolve(__dirname);

/** Every page.tsx / layout.tsx / route.ts under src/app. */
function collectServerEntrypoints(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectServerEntrypoints(full, found);
    } else if (/^(page|layout|route)\.(ts|tsx)$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

/** True when the file opts into the client bundle. */
function isClientModule(source: string): boolean {
  // The directive must lead the file, but comments and blank lines may precede it.
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .trim();
  return /^['"]use client['"]/.test(withoutComments);
}

interface ImportRef {
  specifierText: string;
  /** Imported binding names, `as` aliases resolved to the local name. */
  names: string[];
  from: string;
  typeOnly: boolean;
}

/**
 * Relative imports, with whether each is type-only.
 *
 * The clause is matched with `[^;]+?` and anchored to a line that starts with
 * `import`, so a match cannot run past the end of its own statement and swallow
 * the next one. A multi-line `import { A, B } from '...'` still matches, because
 * there is no semicolon inside the braces.
 */
function parseRelativeImports(source: string): ImportRef[] {
  const out: ImportRef[] = [];
  const re = /^\s*import\s+(type\s+)?([^;]+?)\s+from\s+['"](\.[^'"]+)['"]/gm;
  let m: RegExpExecArray | null;

  while ((m = re.exec(source)) !== null) {
    const clauseIsTypeOnly = Boolean(m[1]);
    const specifierText = m[2].trim();

    const named = specifierText.match(/^\{([\s\S]*)\}$/);
    const specifiers = named
      ? named[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [specifierText];

    // `import { type A, type B }` is also fully type-only.
    const everySpecifierTyped =
      named !== null && specifiers.every((s) => s.startsWith('type '));

    const names = specifiers
      .map((s) => s.replace(/^type\s+/, ''))
      // `X as Y` binds Y locally; either way the casing tells us if it is a
      // component, so take the local name.
      .map((s) => s.split(/\s+as\s+/).pop()!.trim())
      .filter((s) => s && s !== '*');

    out.push({
      specifierText,
      names,
      from: m[3],
      typeOnly: clauseIsTypeOnly || everySpecifierTyped,
    });
  }
  return out;
}

/** Resolve './foo' against a file, trying the usual extensions. */
function resolveImport(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

describe('server/client boundary', () => {
  const entrypoints = collectServerEntrypoints(APP_DIR);

  it('finds the app entrypoints to check', () => {
    // Guards against the traversal silently breaking and the suite passing empty.
    expect(entrypoints.length).toBeGreaterThan(20);
  });

  it('no server entrypoint imports a runtime value from a "use client" module', () => {
    const violations: string[] = [];

    for (const file of entrypoints) {
      const source = readFileSync(file, 'utf8');

      // A client entrypoint may import freely from other client modules.
      if (isClientModule(source)) continue;

      for (const ref of parseRelativeImports(source)) {
        if (ref.typeOnly) continue;

        const target = resolveImport(file, ref.from);
        if (!target) continue;
        if (!isClientModule(readFileSync(target, 'utf8'))) continue;

        // Rendering a client COMPONENT from a server component is the whole
        // point of the boundary and is always fine. PascalCase is how this
        // codebase names components, so an import whose bindings are all
        // PascalCase is allowed. Anything lowercase is a helper, constant or
        // validator that the server would have to CALL — and that throws.
        const allComponents =
          ref.names.length > 0 && ref.names.every((n) => /^[A-Z]/.test(n));
        if (allComponents) continue;

        const offending = ref.names.filter((n) => !/^[A-Z]/.test(n));
        const shortFile = file.slice(APP_DIR.length + 1).replace(/\\/g, '/');
        const shortTarget = target.slice(APP_DIR.length + 1).replace(/\\/g, '/');

        violations.push(
          `${shortFile} imports [${offending.join(', ')}] from '${ref.from}' (${shortTarget}), ` +
            `which is a 'use client' module. Calling a non-component runtime value imported across the ` +
            `boundary throws at request time. Move it to a module without 'use client', or make the import type-only.`
        );
      }
    }

    expect(violations, `\n${violations.join('\n\n')}\n`).toEqual([]);
  });
});
