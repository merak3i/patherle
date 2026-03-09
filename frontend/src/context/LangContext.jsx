import { createContext, useContext, useState } from 'react'

const LangContext = createContext({ lang: 'en', setLang: () => {} })

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('patherle_lang') || 'en')

  const changeLang = (code) => {
    setLang(code)
    localStorage.setItem('patherle_lang', code)
  }

  return (
    <LangContext.Provider value={{ lang, setLang: changeLang }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
