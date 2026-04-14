import type { AppLanguage, UserRole } from '@/lib/types'

const STORAGE_KEY = 'birliy-language'
const LANGUAGE_EVENT = 'birliy:language-changed'

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'ru'

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  ru: 'Русский',
  uz: "O'zbekcha",
}

export const MINI_APP_COPY = {
  ru: {
    nav: {
      admin_overview: 'Обзор',
      restaurants: 'Заведения',
      users: 'Пользователи',
      subscriptions: 'Подписки',
      analytics: 'Итоги',
      orders: 'Заказы',
      tables: 'Столы',
      menu: 'Меню',
      kitchen: 'Кухня',
      profile: 'Профиль',
    },
    profile: {
      title: 'Профиль',
      subtitle: 'Личные настройки аккаунта',
      account_section: 'Личные данные',
      role_label: 'Текущая роль',
      telegram_label: 'Telegram ID',
      name_label: 'Имя',
      username_label: 'Username',
      username_hint: 'Можно оставить пустым, если не хотите показывать username.',
      save_data: 'Сохранить данные',
      language_section: 'Язык интерфейса',
      language_hint: 'Сейчас перевод применяется к профилю и нижней навигации mini app.',
      save_language: 'Сохранить язык',
      delete_section: 'Аккаунт',
      delete_hint: 'Если у аккаунта уже есть история заказов или вы являетесь единственным владельцем, удаление будет заблокировано.',
      delete_action: 'Удалить аккаунт и выйти',
      delete_title: 'Удалить аккаунт?',
      delete_description: 'Аккаунт будет удалён, текущая сессия завершится. Это действие необратимо.',
      confirm_delete: 'Удалить аккаунт',
      cancel: 'Отмена',
      load_error: 'Не удалось загрузить профиль',
      save_success: 'Данные обновлены',
      save_error: 'Не удалось сохранить данные',
      language_success: 'Язык сохранён',
      language_error: 'Не удалось сохранить язык',
      delete_error: 'Не удалось удалить аккаунт',
      deleting: 'Удаляем аккаунт...',
    },
  },
  uz: {
    nav: {
      admin_overview: 'Umumiy',
      restaurants: 'Filiallar',
      users: 'Foydalanuvchilar',
      subscriptions: 'Obunalar',
      analytics: 'Natijalar',
      orders: 'Buyurtmalar',
      tables: 'Stollar',
      menu: 'Menyu',
      kitchen: 'Oshxona',
      profile: 'Profil',
    },
    profile: {
      title: 'Profil',
      subtitle: 'Akkaunt sozlamalari',
      account_section: "Shaxsiy ma'lumotlar",
      role_label: 'Joriy rol',
      telegram_label: 'Telegram ID',
      name_label: 'Ism',
      username_label: 'Username',
      username_hint: "Agar username ko'rsatishni istamasangiz, bo'sh qoldiring.",
      save_data: "Ma'lumotlarni saqlash",
      language_section: 'Interfeys tili',
      language_hint: 'Hozircha tarjima profil va mini app pastki menyusiga qo‘llanadi.',
      save_language: 'Tilni saqlash',
      delete_section: 'Akkaunt',
      delete_hint: "Agar akkauntda buyurtmalar tarixi bo'lsa yoki siz yagona owner bo'lsangiz, o'chirish bloklanadi.",
      delete_action: "Akkauntni o'chirish va chiqish",
      delete_title: "Akkaunt o'chirilsinmi?",
      delete_description: "Akkaunt o'chiriladi va joriy sessiya tugaydi. Bu amalni ortga qaytarib bo'lmaydi.",
      confirm_delete: "Akkauntni o'chirish",
      cancel: 'Bekor qilish',
      load_error: 'Profilni yuklab bo‘lmadi',
      save_success: "Ma'lumotlar yangilandi",
      save_error: "Ma'lumotlarni saqlab bo'lmadi",
      language_success: 'Til saqlandi',
      language_error: 'Tilni saqlab bo‘lmadi',
      delete_error: "Akkauntni o'chirib bo'lmadi",
      deleting: "Akkaunt o'chirilmoqda...",
    },
  },
} as const

const ROLE_LABELS: Record<AppLanguage, Record<UserRole, string>> = {
  ru: {
    super_admin: 'Супер-админ',
    unauthorized: 'Не авторизован',
    owner: 'Владелец',
    manager: 'Менеджер',
    waiter: 'Официант',
    kitchen: 'Кухня',
  },
  uz: {
    super_admin: 'Super admin',
    unauthorized: 'Ulanmagan',
    owner: 'Ega',
    manager: 'Menejer',
    waiter: 'Ofitsiant',
    kitchen: 'Oshxona',
  },
}

export function normalizeAppLanguage(value: unknown): AppLanguage {
  return value === 'uz' ? 'uz' : 'ru'
}

export function getLocalizedRoleLabel(role: UserRole | null | undefined, language: AppLanguage) {
  if (!role) return ''
  return ROLE_LABELS[language][role]
}

export function readStoredAppLanguage() {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored ? normalizeAppLanguage(stored) : null
}

export function writeStoredAppLanguage(language: AppLanguage) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, language)
  window.dispatchEvent(new CustomEvent<AppLanguage>(LANGUAGE_EVENT, { detail: language }))
}

export function clearStoredAppLanguage() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent<AppLanguage>(LANGUAGE_EVENT, { detail: DEFAULT_APP_LANGUAGE }))
}
