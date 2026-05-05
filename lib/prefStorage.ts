import * as SecureStore from 'expo-secure-store';

// Generic key/value preference storage backed by SecureStore on native. Web
// has its own override in prefStorage.web.ts using localStorage. Mirrors the
// shape of authStorage but is reused for non-secret app preferences (theme,
// etc.).
export const prefStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
