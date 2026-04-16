import type { Metadata } from 'next'
import BrandLogo from '@/components/brand/BrandLogo'

export const metadata: Metadata = {
  title: 'Политика конфиденциальности — BirLiy Kassa',
}

const LAST_UPDATED = '15 апреля 2025 г.'
const CONTACT_EMAIL = 'support@birliy.uz'
const APP_NAME = 'BirLiy Kassa'
const COMPANY = 'BirLiy'

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl w-full py-12 px-4">

      {/* Header */}
      <div className="mb-10 text-center">
        <BrandLogo size={56} className="mx-auto mb-4 rounded-3xl" priority />
        <h1 className="text-3xl font-bold text-gray-900">Политика конфиденциальности</h1>
        <p className="mt-2 text-sm text-gray-500">{APP_NAME} · Последнее обновление: {LAST_UPDATED}</p>
      </div>

      <div className="prose prose-gray max-w-none space-y-8 text-sm leading-7 text-gray-700">

        <Section title="1. Общие положения">
          <p>
            Настоящая Политика конфиденциальности описывает, как {COMPANY} («мы», «нас») собирает,
            использует и защищает информацию, которую вы («пользователь») предоставляете при использовании
            приложения {APP_NAME} — кассовой и управленческой системы для ресторанного бизнеса.
          </p>
          <p>
            Используя приложение, вы соглашаетесь с условиями данной Политики.
          </p>
        </Section>

        <Section title="2. Какие данные мы собираем">
          <ul>
            <li><strong>Данные аккаунта Telegram:</strong> имя пользователя, Telegram ID, имя — передаются при авторизации через Telegram Login.</li>
            <li><strong>Данные заведения:</strong> название, адрес, контактный номер телефона.</li>
            <li><strong>Операционные данные:</strong> заказы, меню, столы, сотрудники — только в рамках работы приложения.</li>
            <li><strong>Технические данные:</strong> IP-адрес, тип устройства, браузер, время сессии — для обеспечения безопасности.</li>
          </ul>
        </Section>

        <Section title="3. Как мы используем данные">
          <ul>
            <li>Предоставление функций приложения: управление заказами, меню, персоналом.</li>
            <li>Аутентификация и безопасность сессий.</li>
            <li>Формирование аналитики и отчётов для владельца заведения.</li>
            <li>Техническая поддержка и устранение неполадок.</li>
            <li>Уведомления о состоянии подписки.</li>
          </ul>
          <p>Мы не продаём, не передаём и не раскрываем ваши данные третьим лицам в коммерческих целях.</p>
        </Section>

        <Section title="4. Хранение данных">
          <p>
            Данные хранятся на защищённых серверах с использованием сервиса Supabase (PostgreSQL).
            Серверная инфраструктура соответствует стандартам ISO 27001. Передача данных осуществляется
            по протоколу HTTPS/TLS.
          </p>
          <p>
            Данные хранятся в течение срока действия подписки и 90 дней после её истечения,
            после чего могут быть безвозвратно удалены.
          </p>
        </Section>

        <Section title="5. Telegram Mini App">
          <p>
            {APP_NAME} работает в том числе как Telegram Mini App. В этом случае:
          </p>
          <ul>
            <li>Мы получаем базовые данные профиля Telegram, предоставленные самой платформой.</li>
            <li>Мы не имеем доступа к вашим сообщениям, контактам или другим данным Telegram.</li>
            <li>Использование Mini App регулируется также <a href="https://telegram.org/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Политикой конфиденциальности Telegram</a>.</li>
          </ul>
        </Section>

        <Section title="6. Права пользователей">
          <p>Вы вправе:</p>
          <ul>
            <li>Запросить копию своих персональных данных.</li>
            <li>Потребовать исправления неточных данных.</li>
            <li>Запросить удаление своего аккаунта и связанных данных.</li>
          </ul>
          <p>
            Для реализации этих прав свяжитесь с нами по адресу:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <Section title="7. Безопасность">
          <p>
            Мы применяем технические и организационные меры для защиты ваших данных: шифрование
            при передаче (TLS), JWT-токены с ограниченным сроком жизни, ролевую модель доступа.
            Тем не менее ни одна система не может гарантировать абсолютную безопасность.
          </p>
        </Section>

        <Section title="8. Изменения в политике">
          <p>
            Мы оставляем за собой право изменять данную Политику. При существенных изменениях
            уведомление будет размещено в приложении. Продолжение использования приложения после
            публикации изменений означает ваше согласие с обновлённой Политикой.
          </p>
        </Section>

        <Section title="9. Контакты">
          <p>
            По вопросам конфиденциальности обращайтесь:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">{CONTACT_EMAIL}</a>
          </p>
        </Section>

      </div>

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} {COMPANY}. Все права защищены.</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
