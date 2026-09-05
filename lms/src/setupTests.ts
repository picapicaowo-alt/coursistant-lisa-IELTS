import '@testing-library/jest-dom/vitest';
import {vi} from 'vitest';

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(String(key), String(value));
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();

vi.stubGlobal('localStorage', localStorage);
vi.stubGlobal('sessionStorage', sessionStorage);
Object.defineProperty(globalThis, 'localStorage', {value: localStorage, configurable: true});
Object.defineProperty(globalThis, 'sessionStorage', {value: sessionStorage, configurable: true});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {value: localStorage, configurable: true});
  Object.defineProperty(window, 'sessionStorage', {value: sessionStorage, configurable: true});
}

// Components exercise the same translations as the application after storage is installed.
await import('./i18n');
