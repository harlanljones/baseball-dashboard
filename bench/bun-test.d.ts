/**
 * Minimal ambient types for the one Bun API the benchmark uses. The project
 * does not depend on `@types/bun` (the app itself never touches Bun-only APIs),
 * so the surface is declared here as narrowly as the harness needs it.
 */
declare module "bun:test" {
  export const mock: {
    /** Replace a module for every importer, resolved by specifier. */
    module(specifier: string, factory: () => Record<string, unknown>): void;
  };
}
