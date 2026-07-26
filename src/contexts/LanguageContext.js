import { createContext, useContext } from "react";

export const languages = {
  en: "en",
  zh: "zh",
};

export const LanguageContext = createContext({
  language: languages.en,
  setLanguage: () => {},
  t: (key) => key,
});

export function useLanguage() {
  return useContext(LanguageContext);
}
