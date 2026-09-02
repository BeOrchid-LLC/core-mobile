/**
 * Stands in for `jose`, which cannot be bundled into this app.
 *
 * WHY THIS EXISTS. core-sdk's index.ts re-exports ./verify, and verify.ts
 * imports `jose`. So importing anything at all from @beorchid/core-sdk — a
 * type, hasPermission, StubCoreClient — drags `jose` in with it. `jose`
 * resolves to its Node build, which imports `node:buffer`, and the bundle fails
 * outright. Its browser build resolves instead to a module-scope `export
 * default crypto`, and neither React Native nor Expo defines a global crypto,
 * so that throws at import time rather than at call time.
 *
 * This app never verifies a token itself: Clerk's Expo SDK owns that, and
 * TokenVerifier is not referenced anywhere in core-mobile. So the import is
 * satisfied here rather than the dependency being carried.
 *
 * These throw rather than returning something harmless. If a future change does
 * try to verify a token on this surface, it must fail loudly and be dealt with
 * properly — a silent no-op in a verification path would be an authentication
 * bypass, which is precisely what must not be possible.
 *
 * THE REAL FIX BELONGS IN core-sdk, which this app must not change: either
 * split ./verify out of the barrel so consumers that do not verify tokens do
 * not pay for it, or give the package a react-native export condition. Raised,
 * not fixed. See metro.config.js for the mapping.
 */

const unavailable = (symbol: string): never => {
  throw new Error(
    `jose.${symbol} is not available on the mobile surface. Token verification here is ` +
      "Clerk's, via @clerk/clerk-expo. See src/shims/jose.ts.",
  );
};

export function createRemoteJWKSet(..._args: unknown[]): never {
  return unavailable('createRemoteJWKSet');
}

export function jwtVerify(..._args: unknown[]): never {
  return unavailable('jwtVerify');
}
