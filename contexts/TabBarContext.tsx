import { createContext, useContext, useState, type ReactNode } from 'react';

const TabBarContext = createContext<{
  isTabBarHidden: boolean;
  setIsTabBarHidden: (hidden: boolean) => void;
}>({
  isTabBarHidden: false,
  setIsTabBarHidden: () => {},
});

export function TabBarProvider({ children }: { children: ReactNode }) {
  const [isTabBarHidden, setIsTabBarHidden] = useState(false);
  return (
    <TabBarContext.Provider value={{ isTabBarHidden, setIsTabBarHidden }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  return useContext(TabBarContext);
}
