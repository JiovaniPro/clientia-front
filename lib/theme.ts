/**
 * Thème clair/sombre : une classe `.dark` sur <html> (lue par les tokens de globals.css et le Logo), et le
 * choix mémorisé par navigateur. Le script THEME_INIT_SCRIPT (app/layout.tsx) réapplique ce choix avant le
 * premier affichage, pour qu'un rechargement en mode sombre ne clignote pas en clair.
 */
export const THEME_STORAGE_KEY = "clientia:theme";

export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export function isDarkTheme(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

export function setDarkTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // stockage indisponible : le thème vaut pour cette page seulement
  }
}
