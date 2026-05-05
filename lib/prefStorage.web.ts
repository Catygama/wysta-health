export const prefStorage = {
  getItem: (key: string) =>
    Promise.resolve(
      typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null,
    ),
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return Promise.resolve();
  },
};
