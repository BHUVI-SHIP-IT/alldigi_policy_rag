import { create } from 'zustand';

const useThemeStore = create((set) => {
  // Read initial theme preference from localStorage or default to system settings
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

  // Apply class to body initially
  if (isDark) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }

  return {
    isDarkMode: isDark,
    toggleTheme: () => {
      set((state) => {
        const nextDark = !state.isDarkMode;
        if (nextDark) {
          document.body.classList.add('dark-mode');
          localStorage.setItem('theme', 'dark');
        } else {
          document.body.classList.remove('dark-mode');
          localStorage.setItem('theme', 'light');
        }
        return { isDarkMode: nextDark };
      });
    }
  };
});

export default useThemeStore;
