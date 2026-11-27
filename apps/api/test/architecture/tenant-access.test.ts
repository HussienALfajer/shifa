// A-01b criterion 8 (review 3 of A-01-04): product modules reach tenant data only through
// TenantDb with the scope the guard checked. The raw handle (SHIFA_DB), a direct withTenant(),
// and the link-scope exception (linkScope(), withScope()) are allowed only in the files listed
// here, each with its reason; anything new must be added with a reason, in review.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const MODULES = join(import.meta.dirname, '..', '..', 'src', 'modules');

/** Pattern → files (relative to src/modules) allowed to use it, and why. */
const ALLOWED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  SHIFA_DB: {
    'health/health.service.ts': 'readiness probe: ping() only',
    'identity/sessions.service.ts': 'builds the principal before any scope exists (AuthPort)',
    'identity/setup-links.service.ts': 'a link page reads its roles in the link’s clinic',
    'identity/invitations.service.ts': 'answering an invitation writes the clinic’s audit row',
    'identity/my-invitations.service.ts':
      'an invitation answered from the chooser writes the clinic’s audit row (OD-90)',
    'identity/switcher.service.ts':
      'a switch, checked against the person’s own clinics, writes the clinic’s audit row',
    'identity/support-sessions.ts':
      'a support session’s banner names its clinic, read before any scope exists (AuthPort)',
    'support/request-audit.ts':
      'the guard records each support-session request in the clinic before any scope is bound',
  },
  withTenant: {
    'identity/support-sessions.ts':
      'the clinic’s name for the support banner, READ ONLY, in the grant’s clinic',
    'support/request-audit.ts':
      'one support.request row in the grant’s clinic per support-session request (A-02 14)',
    'identity/sessions.service.ts': 'the member’s last activity, for the principal (AuthPort)',
    'identity/tenant-view.ts': 'builds the principal before any scope exists (AuthPort)',
    'identity/clinic-choices.ts':
      'active branches of the person’s own clinics, found on the auth path first (A-01b 10)',
    'identity/switcher.service.ts':
      'clinic.switched and the archived-branch check, in a clinic found as the person’s own',
  },
  linkScope: {
    'identity/setup-links.service.ts': 'a link page, nobody signed in there',
    'identity/invitations.service.ts': 'the invited person is not yet a member there',
    'identity/my-invitations.service.ts':
      'the invited person is not yet a member there; the invitation found on the auth path by id and phone',
  },
  withScope: {
    'identity/setup-links.service.ts': 'with linkScope()',
    'identity/invitations.service.ts': 'with linkScope()',
    'identity/my-invitations.service.ts': 'with linkScope()',
  },
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/**
 * Every identifier and string literal in `text`, from the TypeScript AST (security review L3):
 * an aliased import (`linkScope as ls`) still names `linkScope`, and `db['withTenant']` holds the
 * string `withTenant`.
 */
function names(file: string, text: string): Set<string> {
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) found.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  return found;
}

export function tenantAccessViolations(root: string): string[] {
  const problems: string[] = [];
  for (const file of sourceFiles(root)) {
    const name = relative(root, file).replaceAll('\\', '/');
    const used = names(file, readFileSync(file, 'utf8'));
    for (const [pattern, files] of Object.entries(ALLOWED)) {
      if (used.has(pattern) && !(name in files)) problems.push(`${name} uses ${pattern}`);
    }
  }
  return problems.sort();
}

describe('tenant access in product modules', () => {
  it('only the listed files hold the raw handle or the link-scope exception', () => {
    expect(tenantAccessViolations(MODULES)).toEqual([]);
  });

  it('red: a module opening a tenant from request data fails', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const root = mkdtempSync(join(tmpdir(), 'shifa-tenant-access-'));
    try {
      mkdirSync(join(root, 'reports'));
      writeFileSync(
        join(root, 'reports', 'r.ts'),
        [
          "import { linkScope as ls, withScope as ws } from '../../access/index.ts';",
          'class R {',
          '  constructor(@Inject(SHIFA_DB) private db: X) {}',
          "  run(body: B) { return this.db['withTenant']({ tenantId: body.clinicId }, fn); }",
          '  other(p: P) { return ws(this.db, ls({ tenantId: p.id, userId }), fn); }',
          '}',
        ].join('\n'),
      );
      expect(tenantAccessViolations(root)).toEqual([
        'reports/r.ts uses SHIFA_DB',
        'reports/r.ts uses linkScope',
        'reports/r.ts uses withScope',
        'reports/r.ts uses withTenant',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
