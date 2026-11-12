// Lets Node's built-in test runner import the app's extension-less TypeScript modules
// (Vite resolves "./format" to "./format.ts"; Node needs a hint). No extra dependency.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]sx?$|\.json$/.test(specifier) && context.parentURL) {
      for (const ext of ['.ts', '.tsx']) {
        const url = new URL(specifier + ext, context.parentURL);
        if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context);
      }
    }
    if (specifier.endsWith('.json')) return nextResolve(specifier, { ...context, importAttributes: { type: 'json' } });
    return nextResolve(specifier, context);
  }
});
