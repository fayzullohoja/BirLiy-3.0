// ─── Enums / Literal Types ────────────────────────────────────────────────────

export type UserRole      = 'super_admin' | 'owner' | 'manager' | 'waiter' | 'kitchen'
export type ShopUserRole  = 'owner' | 'manager' | 'waiter' | 'kitchen'
export type TableStatus   = 'free' | 'occupied' | 'reserved' | 'bill_requested'
export type OrderStatus   = 'open' | 'in_kitchen' | 'ready' | 'paid' | 'cancelled'
export type OrderItemStatus = 'pending' | 'in_kitchen' | 'ready'
export type PaymentType   = 'cash' | 'card' | 'payme' | 'click'
export type BookingStatus = 'confirmed' | 'seated' | 'cancelled' | 'no_show'
export type SubStatus     = 'trial' | 'active' | 'expired' | 'suspended'
export type SubPlan       = 'trial' | 'starter' | 'pro'
export type OwnerApplicationStatus = 'pending' | 'contacted' | 'approved' | 'rejected'

// ─── Core Entities ────────────────────────────────────────────────────────────

/** Linked 1:1 to auth.users via id */
export interface AppUser {
  id:          string    // = auth.users.id
  telegram_id: number
  name:        string
  username:    string | null
  role:        UserRole
  created_at:  string
  updated_at:  string
}

export interface Shop {
  id:         string
  name:       string
  address:    string | null
  phone:      string | null
  is_active:  boolean
  created_at: string
  updated_at: string
}

export interface ShopUser {
  id:         string
  shop_id:    string
  user_id:    string
  role:       ShopUserRole
  created_at: string
  // Joined relations
  shop?:      Shop
  user?:      AppUser
}

export interface Subscription {
  id:         string
  shop_id:    string
  status:     SubStatus
  plan:       SubPlan
  expires_at: string
  created_at: string
  updated_at: string
}

export interface Table {
  id:         string
  shop_id:    string
  number:     number
  name:       string
  capacity:   number
  status:     TableStatus
  created_at: string
  updated_at: string
}

export interface MenuCategory {
  id:         string
  shop_id:    string
  name:       string
  sort_order: number
  created_at: string
}

export interface MenuItem {
  id:           string
  shop_id:      string
  category_id:  string | null
  name:         string
  price:        number
  is_available: boolean
  sort_order:   number
  created_at:   string
  updated_at:   string
  // Joined
  category?:    MenuCategory
}

export interface Order {
  id:           string
  shop_id:      string
  table_id:     string
  waiter_id:    string
  status:       OrderStatus
  total_amount: number
  payment_type: PaymentType | null
  notes:        string | null
  created_at:   string
  updated_at:   string
  // Joined
  table?:       Table
  waiter?:      AppUser
  items?:       OrderItem[]
}

export interface OrderItem {
  id:           string
  order_id:     string
  menu_item_id: string
  quantity:     number
  unit_price:   number
  status:       OrderItemStatus
  notes:        string | null
  sent_to_kitchen_at: string | null
  ready_at:     string | null
  created_at:   string
  // Joined
  menu_item?:   MenuItem
}

export interface TableBooking {
  id:               string
  shop_id:          string
  table_id:         string
  booked_by:        string
  guest_name:       string
  guest_phone:      string | null
  party_size:       number
  booked_at:        string
  duration_minutes: number
  status:           BookingStatus
  notes:            string | null
  created_at:       string
  updated_at:       string
  // Joined
  table?:           Table
  user?:            AppUser
}

export interface ShopInviteCode {
  id:         string
  shop_id:    string
  role:       ShopUserRole
  code:       string
  is_active:  boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  shop?:      Shop
}

export interface OwnerApplication {
  id:               string
  telegram_user_id: string | null
  telegram_id:      number
  applicant_name:   string
  restaurant_name:  string
  phone:            string
  status:           OwnerApplicationStatus
  note:             string | null
  reviewed_by:      string | null
  created_at:       string
  updated_at:       string
  user?:            AppUser | null
  reviewer?:        AppUser | null
}

// ─── Auth / Session ───────────────────────────────────────────────────────────

export interface TelegramUser {
  id:             number
  first_name:     string
  last_name?:     string
  username?:      string
  language_code?: string
  is_premium?:    boolean
}

export interface TelegramInitData {
  user?:           TelegramUser
  chat_instance?:  string
  chat_type?:      string
  auth_date:       number
  hash:            string
  start_param?:    string
}

/** Payload stored in the Supabase-compatible JWT session cookie */
export interface SessionPayload {
  sub:             string     // auth.users.id (= public.users.id)
  role:            'authenticated'
  aud:             'authenticated'
  app_role:        UserRole
  shop_ids:        string[]
  primary_shop_id: string | null
  subscription_ok: boolean
  iat:             number
  exp:             number
}

/** Decoded user info available to server-side code via headers or cookie */
export interface RequestUser {
  userId:   string
  role:     UserRole
}

/** Full user context fetched for redirects / page-level checks */
export interface UserContext {
  user:             AppUser
  shopAccess:       ShopAccessEntry[]
  appRole:          UserRole
  primaryShopRole:  ShopUserRole | null
  hasShopAccess:    boolean
  subscriptionOk:   boolean
  primaryShopId:    string | null
}

export interface ShopAccessEntry {
  shop_id:  string
  role:     ShopUserRole
  shop:     Shop & { subscription: Subscription | null }
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  data:  T
  error: null
}

export interface ApiError {
  data:  null
  error: {
    code:    string
    message: string
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── Auth Route Responses ──────────────────────────────────────────────────────

export interface AuthResponse {
  user:              AppUser
  role:              UserRole
  has_shop_access:   boolean
  subscription_ok:   boolean
  primary_shop_id:   string | null
}

export interface AuthStatusPayload {
  user_id:         string
  role:            UserRole
  shop_ids:        string[]
  shops:           Array<{ id: string; name: string }>
  primary_shop_id: string | null
  shop_name:       string | null
  expires_at:      string | null
  sub_status:      SubStatus | null
  needs_refresh:   boolean
}

export interface ExtendedAnalyticsByDay {
  date:    string
  revenue: number
  orders:  number
}

export interface ExtendedAnalyticsByWaiter {
  waiter_id:   string
  waiter_name: string
  orders:      number
  revenue:     number
}

export interface ExtendedAnalyticsTopItem {
  item_id:  string
  name:     string
  quantity: number
  revenue:  number
}

export interface ExtendedAnalyticsResponse {
  period: {
    revenue:   number
    orders:    number
    avg_order: number
  }
  by_day:    ExtendedAnalyticsByDay[]
  by_waiter: ExtendedAnalyticsByWaiter[]
  top_items: ExtendedAnalyticsTopItem[]
}

export interface StatsTimelinePoint {
  date: string
  plan: SubPlan
  count: number
}

export interface StatsTimelineResponse {
  subscriptions_by_day: StatsTimelinePoint[]
  totals: {
    active: number
    trial: number
    expired: number
    suspended: number
    total: number
  }
}
