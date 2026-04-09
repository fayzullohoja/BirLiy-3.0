// ─── Enums / Literal Types ────────────────────────────────────────────────────

export type UserRole      = 'super_admin' | 'owner' | 'waiter' | 'kitchen'
export type ShopUserRole  = 'owner' | 'waiter' | 'kitchen'
export type TableStatus   = 'free' | 'occupied' | 'reserved' | 'bill_requested'
export type OrderStatus   = 'open' | 'in_kitchen' | 'ready' | 'paid' | 'cancelled'
export type PaymentType   = 'cash' | 'card' | 'payme' | 'click'
export type BookingStatus = 'confirmed' | 'seated' | 'cancelled' | 'no_show'
export type SubStatus     = 'trial' | 'active' | 'expired' | 'suspended'
export type SubPlan       = 'trial' | 'starter' | 'pro'

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
  notes:        string | null
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
  sub:      string     // auth.users.id (= public.users.id)
  role:     'authenticated'
  aud:      'authenticated'
  app_role: UserRole
  iat:      number
  exp:      number
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
  primary_shop_id: string | null
  shop_name:       string | null
  expires_at:      string | null
  sub_status:      string | null
  needs_refresh:   boolean
}
