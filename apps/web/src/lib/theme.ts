export const THEME_STORAGE_KEY = "gestao_financeira_theme";
export type ThemeMode = "light" | "dark";

export function getThemeBootstrapScript() {
  return `(function(){try{var key=${JSON.stringify(THEME_STORAGE_KEY)};var stored=localStorage.getItem(key);var dark=stored?stored==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
}
