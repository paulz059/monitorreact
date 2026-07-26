import React, { useState, useCallback } from "react";
import { LanguageContext, languages } from "contexts/LanguageContext";
import translations from "translations";

const STORAGE_KEY = "appLanguage";

function getInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === languages.en || stored === languages.zh) {
      return stored;
    }
  } catch (e) {
    // localStorage unavailable (e.g. private browsing) - fall back to default
  }
  return languages.en;
}

export default function LanguageContextWrapper(props) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // ignore write failures
    }
  }, []);

  const t = useCallback(
    (key) => {
      const parts = key.split(".");
      let value = translations[language];
      for (const part of parts) {
        value = value?.[part];
      }
      return typeof value === "string" ? value : key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {props.children}
    </LanguageContext.Provider>
  );
}
