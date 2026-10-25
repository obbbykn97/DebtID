// Loads web/src/core.js (a plain browser script) into a sandbox and returns the DebtID object.
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const arquivo = fileURLToPath(new URL('../src/core.js', import.meta.url));

export function carregar() {
  const fonte = fs.readFileSync(arquivo, 'utf8') + '\n;globalThis.DebtID = DebtID;';
  const ctx = vm.createContext({
    crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, Intl, Date, Math, console,
    Uint8Array, BigInt, Number, String, Array, Object, Error, RangeError, TypeError, WeakMap, Map, Set,
    JSON, Promise, Symbol, parseInt, parseFloat, isNaN, isFinite
  });
  vm.runInContext(fonte, ctx, { filename: arquivo });
  return ctx.DebtID;
}

export const hoje = () => Math.floor(Date.now() / 864e5);
