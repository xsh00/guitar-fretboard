import "@testing-library/jest-dom/vitest";

if (
  typeof window !== "undefined" &&
  (!window.localStorage || typeof window.localStorage.getItem !== "function")
) {
  const memoryStore = new Map<string, string>();

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => memoryStore.clear(),
      getItem: (key: string) => memoryStore.get(key) ?? null,
      key: (index: number) => Array.from(memoryStore.keys())[index] ?? null,
      removeItem: (key: string) => {
        memoryStore.delete(key);
      },
      setItem: (key: string, value: string) => {
        memoryStore.set(key, value);
      },
      get length() {
        return memoryStore.size;
      },
    },
  });
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: () => undefined,
  });
}
