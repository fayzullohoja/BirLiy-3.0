'use client'

import { useEffect, useState } from 'react'
import AppHeader from '@/components/layout/AppHeader'
import { BottomSheet } from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import PageContainer, { Section } from '@/components/ui/PageContainer'
import { toast } from '@/components/ui/Toast'
import { clearStoredAppLanguage, getLocalizedRoleLabel, LANGUAGE_LABELS, normalizeAppLanguage } from '@/lib/appLanguage'
import { signOutCurrentSession } from '@/lib/auth/clientAuth'
import { useAppLanguage } from '@/lib/useAppLanguage'
import type { ApiResponse, AppUser, AppLanguage } from '@/lib/types'

export default function MiniAppProfilePage() {
  const { language, setLanguage, copy } = useAppLanguage()
  const [loading, setLoading] = useState(true)
  const [savingData, setSavingData] = useState(false)
  const [savingLanguage, setSavingLanguage] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(language)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        const json: ApiResponse<{ user: AppUser }> = await res.json()

        if (cancelled) return

        if (json.error || !json.data?.user) {
          throw new Error(json.error?.message ?? copy.profile.load_error)
        }

        const user = json.data.user
        const nextLanguage = normalizeAppLanguage(user.preferred_language)
        setProfile(user)
        setName(user.name ?? '')
        setUsername(user.username ?? '')
        setSelectedLanguage(nextLanguage)
        setLanguage(nextLanguage)
      } catch {
        if (!cancelled) {
          toast.error(copy.profile.load_error)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [copy.profile.load_error, setLanguage])

  async function handleSaveData() {
    setSavingData(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          username,
        }),
      })
      const json: ApiResponse<{ user: AppUser }> = await res.json()

      if (json.error || !json.data?.user) {
        throw new Error(json.error?.message ?? copy.profile.save_error)
      }

      setProfile(json.data.user)
      setName(json.data.user.name ?? '')
      setUsername(json.data.user.username ?? '')
      toast.success(copy.profile.save_success)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.profile.save_error)
    } finally {
      setSavingData(false)
    }
  }

  async function handleSaveLanguage() {
    setSavingLanguage(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_language: selectedLanguage }),
      })
      const json: ApiResponse<{ user: AppUser }> = await res.json()

      if (json.error || !json.data?.user) {
        throw new Error(json.error?.message ?? copy.profile.language_error)
      }

      setProfile(json.data.user)
      setLanguage(selectedLanguage)
      toast.success(copy.profile.language_success)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.profile.language_error)
    } finally {
      setSavingLanguage(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch('/api/profile', { method: 'DELETE' })
      const json = await res.json().catch(() => null)

      if (!res.ok || json?.error) {
        throw new Error(json?.error?.message ?? copy.profile.delete_error)
      }

      clearStoredAppLanguage()
      await signOutCurrentSession({ redirectTo: '/' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.profile.delete_error)
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <AppHeader
        title={copy.profile.title}
        subtitle={copy.profile.subtitle}
        showSignOut={false}
      />

      <PageContainer>
        <Section className="pt-5">
          <div className="rounded-3xl border border-surface-border bg-surface px-5 py-5 shadow-card-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-bold text-ink">{profile?.name ?? '...'}</p>
                <p className="mt-1 text-sm text-ink-secondary">
                  {copy.profile.role_label}: {getLocalizedRoleLabel(profile?.role, language)}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {copy.profile.telegram_label}: {profile?.telegram_id ?? '—'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center text-lg font-bold">
                {(profile?.name ?? '?').slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </Section>

        <Section title={copy.profile.account_section} className="mt-5">
          <div className="rounded-3xl border border-surface-border bg-surface px-4 py-4 shadow-card-sm space-y-4">
            <FormField
              label={copy.profile.name_label}
              value={name}
              onChange={setName}
              placeholder={copy.profile.name_label}
              disabled={loading || savingData}
            />
            <FormField
              label={copy.profile.username_label}
              value={username}
              onChange={setUsername}
              placeholder="username"
              hint={copy.profile.username_hint}
              disabled={loading || savingData}
            />
            <Button fullWidth loading={savingData} disabled={loading} onClick={handleSaveData}>
              {copy.profile.save_data}
            </Button>
          </div>
        </Section>

        <Section title={copy.profile.language_section} className="mt-5">
          <div className="rounded-3xl border border-surface-border bg-surface px-4 py-4 shadow-card-sm">
            <p className="text-sm text-ink-secondary mb-4">{copy.profile.language_hint}</p>
            <div className="grid grid-cols-2 gap-3">
              {(['ru', 'uz'] as AppLanguage[]).map((lang) => {
                const active = selectedLanguage === lang
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSelectedLanguage(lang)}
                    className={[
                      'rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors duration-150',
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-surface-border bg-surface-muted text-ink-secondary',
                    ].join(' ')}
                  >
                    {LANGUAGE_LABELS[lang]}
                  </button>
                )
              })}
            </div>
            <Button
              fullWidth
              className="mt-4"
              variant="secondary"
              loading={savingLanguage}
              disabled={loading}
              onClick={handleSaveLanguage}
            >
              {copy.profile.save_language}
            </Button>
          </div>
        </Section>

        <Section title={copy.profile.delete_section} className="mt-5">
          <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-4 shadow-card-sm">
            <p className="text-sm text-red-700 mb-4">{copy.profile.delete_hint}</p>
            <Button fullWidth variant="danger" disabled={loading} onClick={() => setConfirmOpen(true)}>
              {copy.profile.delete_action}
            </Button>
          </div>
        </Section>

        <Section className="mt-3 pb-10">
          <div className="flex items-center justify-center gap-4 text-xs text-ink-muted">
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink-secondary underline underline-offset-2 transition-colors"
            >
              Политика конфиденциальности
            </a>
            <span>·</span>
            <span>BirLiy Kassa</span>
          </div>
        </Section>
      </PageContainer>

      <BottomSheet
        open={confirmOpen}
        onClose={() => {
          if (!deleting) setConfirmOpen(false)
        }}
        title={copy.profile.delete_title}
      >
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-ink-secondary">
            {copy.profile.delete_description}
          </p>
          <Button variant="danger" fullWidth loading={deleting} onClick={handleDeleteAccount}>
            {deleting ? copy.profile.deleting : copy.profile.confirm_delete}
          </Button>
          <Button variant="secondary" fullWidth disabled={deleting} onClick={() => setConfirmOpen(false)}>
            {copy.profile.cancel}
          </Button>
        </div>
      </BottomSheet>
    </>
  )
}
