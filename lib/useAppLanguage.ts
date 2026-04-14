'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AppLanguage } from '@/lib/types'
import {
  DEFAULT_APP_LANGUAGE,
  MINI_APP_COPY,
  normalizeAppLanguage,
  readStoredAppLanguage,
  writeStoredAppLanguage,
} from '@/lib/appLanguage'

export function useAppLanguage() {
  const [language, setLanguageState] = useState<AppLanguage>(() => readStoredAppLanguage() ?? DEFAULT_APP_LANGUAGE)

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'birliy-language') {
        setLanguageState(normalizeAppLanguage(event.newValue))
      }
    }

    const onLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<AppLanguage>).detail
      setLanguageState(normalizeAppLanguage(nextLanguage))
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('birliy:language-changed', onLanguageChange)

    const stored = readStoredAppLanguage()
    if (stored) {
      setLanguageState(stored)
    }

    void fetch('/api/profile', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null
        const json = await res.json()
        return json.data?.user?.preferred_language ?? null
      })
      .then((nextLanguage) => {
        if (!nextLanguage) return
        const normalized = normalizeAppLanguage(nextLanguage)
        writeStoredAppLanguage(normalized)
        setLanguageState(normalized)
      })
      .catch(() => null)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('birliy:language-changed', onLanguageChange)
    }
  }, [])

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    const normalized = normalizeAppLanguage(nextLanguage)
    writeStoredAppLanguage(normalized)
    setLanguageState(normalized)
  }, [])

  return {
    language,
    setLanguage,
    copy: MINI_APP_COPY[language],
  }
}
