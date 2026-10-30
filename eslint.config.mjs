import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Los parámetros y variables con prefijo `_` son intencionalmente ignorados (p. ej. el `AdminUser` que prueba que se llamó a `requireAdmin()`).
  { rules: { "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }] } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Copias de trabajo temporales que crea la app de escritorio de Claude Code (excluidas de git en .git/info/exclude):
    // traen su propio `.next/` generado y no son código de este proyecto.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
