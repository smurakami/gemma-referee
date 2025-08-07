// src/store.js
import {create} from 'zustand';

export interface AppStoreData {
  lang: 'ja'|'en';
  setLang: (lang: "ja"|"en") => void;

}

export const useAppStore = create<AppStoreData>(set => ({
  lang: 'en',
  setLang: lang => set({lang,}),
}));
