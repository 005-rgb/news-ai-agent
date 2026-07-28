import { create } from 'zustand';

export const useAppStore = create((set) => ({
  user: null,
  isLoggedIn: false,
  setUser: (user) => set({ user, isLoggedIn: !!user }),
  logout: () => set({ user: null, isLoggedIn: false }),

  // Global alerts from API keys
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),

  // Overview stats
  overviewStats: null,
  setOverviewStats: (stats) => set({ overviewStats: stats }),
}));
