// Loader hooks for battle-smoke.mjs.
//
// src/env.js reads `import.meta.env`, which only exists under Vite. Rather than
// changing app code for the sake of a test, this redirects that one module to a
// stub so the smoke test can import the real services under plain Node.
export async function load(url, context, nextLoad) {
  if (url.endsWith('/src/env.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `export const supabaseUrl = 'http://localhost'
export const supabaseAnonKey = 'smoke-test-key'
`
    }
  }
  return nextLoad(url, context)
}
