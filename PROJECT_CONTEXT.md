# BirLiy Kassa — Project Context

Last updated: 2026-04-13

This document describes the current state of the project in the local workspace at:

`/Users/fayzullohoja/Desktop/Birliy Claude`

Important:
- This is the best high-level description of the codebase and product direction.
- The local workspace may contain uncommitted changes beyond what is currently deployed.
- Treat this file as the source of truth for project context, architecture, product scope, and current gaps.

## 1. Product Summary

BirLiy Kassa is a restaurant operations system for Uzbekistan built primarily as a Telegram Mini App.

The project is not a customer ordering app. It is an internal staff tool for restaurant operations:
- waiter workflow
- kitchen workflow
- owner dashboard
- super-admin platform panel

The app is designed to support multiple restaurants on one platform.

Main purpose:
- manage tables
- create and update orders
- send items to kitchen
- mark food ready
- accept payments
- manage menu
- manage staff
- manage reservations
- manage subscriptions for restaurants

## 2. Current Product Roles

### `super_admin`
Platform-level role.

Access:
- `/admin`
- all restaurants
- all users
- all subscriptions
- all platform statistics

Responsibilities:
- create and edit restaurants
- assign users to restaurants
- assign staff roles
- promote users to super_admin
- manage subscription lifecycle

### `owner`
Restaurant-level management role.

Access:
- `/owner`
- `/kitchen`
- some waiter-related reads through shop access

Responsibilities:
- view restaurant analytics
- manage tables
- manage menu and categories
- manage bookings
- manage restaurant staff
- inspect order history
- optionally use kitchen view

### `waiter`
Restaurant-level operational role.

Access:
- `/waiter`

Responsibilities:
- open a table
- create an order
- add positions to an order
- send pending positions to kitchen
- view ready positions
- accept payment when order is ready
- cancel order before kitchen send

### `kitchen`
Restaurant-level operational role.

Access:
- `/kitchen`

Responsibilities:
- view kitchen queue for the current restaurant
- see only the active kitchen wave
- mark in-kitchen items as ready

Restrictions:
- cannot create orders
- cannot send items to kitchen
- cannot accept payment
- cannot cancel orders
- cannot edit tables

## 3. Product Scope: What Is Already Implemented

## 3.1 Authentication and Session

Implemented:
- Telegram Mini App authentication
- Telegram `initData` validation on server
- HS256 JWT session cookie (`birliy-session`)
- middleware-based route protection
- dev bypass for local testing using `?role=...`
- forced session refresh flow when current DB role/shop context differs from cookie claims

Files:
- [app/page.tsx](/Users/fayzullohoja/Desktop/Birliy%20Claude/app/page.tsx)
- [app/api/auth/route.ts](/Users/fayzullohoja/Desktop/Birliy%20Claude/app/api/auth/route.ts)
- [app/api/auth/status/route.ts](/Users/fayzullohoja/Desktop/Birliy%20Claude/app/api/auth/status/route.ts)
- [app/api/auth/logout/route.ts](/Users/fayzullohoja/Desktop/Birliy%20Claude/app/api/auth/logout/route.ts)
- [lib/auth/session.ts](/Users/fayzullohoja/Desktop/Birliy%20Claude/lib/auth/session.ts)
- [lib/auth/getUser.ts](/Users/fayzullohoja/Desktop/Birliy%20Claude/lib/auth/getUser.ts)
- [lib/auth/apiGuard.ts](/Users/fayzullohoja/Desktop/Birliy%20Claude/lib/auth/apiGuard.ts)
- [lib/auth/clientAuth.ts](/Users/fayzullohoja/Desktop/Birliy%20Claude/lib/auth/clientAuth.ts)
- [middleware.ts](/Users/fayzullohoja/Desktop/Birliy%20Claude/middleware.ts)

Current behavior:
- `super_admin` always routes to `/admin`
- non-admin role is derived from restaurant membership context
- users without restaurant membership go to `/not-connected`
- users with expired/inactive subscription go to `/subscription-blocked`

## 3.2 Waiter Module

Implemented:
- waiter home with live table list
- active orders list
- table detail page
- create order
- add positions
- edit pending positions
- send pending positions to kitchen
- receive ready state back from kitchen
- payment flow
- cancellation flow before kitchen send

Files:
- [app/waiter/page.tsx](/Users/fayzullohoja/Desktop/Birliy%20Claude/app/waiter/page.tsx)
- [app/waiter/orders/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/waiter/orders/page.tsx)
- [app/waiter/menu/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/waiter/menu/page.tsx)
- [app/waiter/table/[tableId]/page.tsx](/Users/fayzullohoja/Desktop/Birliy%20Claude/app/waiter/table/%5BtableId%5D/page.tsx)
- [app/waiter/table/[tableId]/menu/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/waiter/table/%5BtableId%5D/menu/page.tsx)
- [app/waiter/_context/WaiterSessionContext.tsx](/Users/fayzullohoja/Desktop/Birliy%20Claude/app/waiter/_context/WaiterSessionContext.tsx)

Current business logic:
- one table can have only one active non-terminal order
- waiter can keep adding new positions into the same order
- order items have kitchen statuses
- sending to kitchen sends only items with `pending`
- payment is allowed only when no items remain in `pending` or `in_kitchen`

## 3.3 Kitchen Module

Implemented:
- dedicated kitchen role
- kitchen dashboard
- queue summary
- refresh/polling
- ready action for current kitchen batch
- queue filtered to current restaurant

Files:
- [app/kitchen/page.tsx](/Users/fayzullohoja/Desktop/Birliy%20Claude/app/kitchen/page.tsx)
- [app/kitchen/layout.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/kitchen/layout.tsx)
- [app/kitchen/_context/KitchenSessionContext.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/kitchen/_context/KitchenSessionContext.tsx)

Current behavior:
- kitchen sees only orders that currently have `in_kitchen` items
- kitchen marks current wave as ready
- kitchen queue is based on item statuses, not just order header

## 3.4 Owner Module

Implemented:
- owner dashboard
- analytics
- tables CRUD
- menu/category CRUD
- bookings CRUD
- staff management
- order history view
- shortcut into kitchen view

Files:
- [app/owner/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/owner/page.tsx)
- [app/owner/orders/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/owner/orders/page.tsx)
- [app/owner/orders/[id]/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/owner/orders/%5Bid%5D/page.tsx)
- [app/owner/tables/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/owner/tables/page.tsx)
- [app/owner/menu/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/owner/menu/page.tsx)
- [app/owner/bookings/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/owner/bookings/page.tsx)
- [app/owner/staff/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/owner/staff/page.tsx)
- [app/owner/_context/OwnerSessionContext.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/owner/_context/OwnerSessionContext.tsx)

Current business rule:
- bookings are owner-only on API
- owner is allowed to manage all operational sections of a restaurant

## 3.5 Super Admin Module

Implemented:
- platform dashboard
- restaurants list and detail
- user management
- staff assignment
- subscriptions management

Files:
- [app/admin/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/admin/page.tsx)
- [app/admin/restaurants/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/admin/restaurants/page.tsx)
- [app/admin/restaurants/[id]/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/admin/restaurants/%5Bid%5D/page.tsx)
- [app/admin/users/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/admin/users/page.tsx)
- [app/admin/subscriptions/page.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/app/admin/subscriptions/page.tsx)

Admin capabilities currently implemented:
- assign user role from existing system users
- default restaurant fallback to demo shop for non-admin assignment
- assign user as owner / waiter / kitchen
- attach/remove restaurant personnel
- search users in admin UI
- search/filter users when adding restaurant staff

## 3.6 Shared UI / UX Layer

Implemented:
- common mobile-first UI kit
- app header
- bottom navigation
- cards
- badges
- bottom sheets
- form fields
- confirm dialogs
- toast system
- loading screens
- Telegram bootstrap
- sign out action

Files:
- [components/layout/AppHeader.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/components/layout/AppHeader.tsx)
- [components/layout/BottomNav.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/components/layout/BottomNav.tsx)
- [components/shared/LoadingScreen.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/components/shared/LoadingScreen.tsx)
- [components/shared/TelegramBootstrap.tsx](/Users/fayzulloja/Desktop/Birliy%20Claude/components/shared/TelegramBootstrap.tsx)
- [components/ui/*](/Users/fayzulloja/Desktop/Birliy%20Claude/components/ui)

## 4. Technical Stack

- Framework: Next.js 15 App Router
- Language: TypeScript
- Styling: Tailwind CSS
- Database: Supabase PostgreSQL
- Auth: Telegram Mini App + custom HS256 JWT
- Hosting: Vercel

Dependencies:
- `next`
- `react`
- `react-dom`
- `@supabase/supabase-js`
- `@supabase/ssr`
- `jose`
- `clsx`
- `tailwind-merge`

## 5. Data Model

Core DB entities:
- `users`
- `shops`
- `shop_users`
- `subscriptions`
- `restaurant_tables`
- `menu_categories`
- `menu_items`
- `orders`
- `order_items`
- `table_bookings`

Enums:
- `user_role`
- `shop_user_role`
- `table_status`
- `order_status`
- `order_item_status`
- `payment_type`
- `booking_status`
- `sub_status`
- `sub_plan`

Migration files:
- [001_schema.sql](/Users/fayzulloja/Desktop/Birliy%20Claude/supabase/migrations/001_schema.sql)
- [002_functions.sql](/Users/fayzulloja/Desktop/Birliy%20Claude/supabase/migrations/002_functions.sql)
- [003_rls.sql](/Users/fayzulloja/Desktop/Birliy%20Claude/supabase/migrations/003_rls.sql)
- [004_payment_types.sql](/Users/fayzulloja/Desktop/Birliy%20Claude/supabase/migrations/004_payment_types.sql)
- [005_kitchen_roles.sql](/Users/fayzulloja/Desktop/Birliy%20Claude/supabase/migrations/005_kitchen_roles.sql)
- [006_order_item_kitchen_flow.sql](/Users/fayzulloja/Desktop/Birliy%20Claude/supabase/migrations/006_order_item_kitchen_flow.sql)
- [seed.sql](/Users/fayzulloja/Desktop/Birliy%20Claude/supabase/seed.sql)

## 6. Current Business Logic

## 6.1 Authentication Model

Flow:
1. Telegram opens Mini App
2. client gets `initData`
3. `POST /api/auth`
4. server validates Telegram signature
5. server creates or updates `auth.users` and `public.users`
6. server loads shop access and subscription context
7. server signs session cookie
8. middleware routes user to the proper dashboard

Important current rule:
- `super_admin` is platform role
- non-admin runtime role is effectively resolved from current restaurant membership context

## 6.2 Order Lifecycle

Current lifecycle:
- order starts as `open`
- waiter adds positions
- order items start as `pending`
- waiter presses `На кухню`
- only `pending` items move to `in_kitchen`
- kitchen sees only `in_kitchen` items
- kitchen presses `Готово`
- current kitchen wave becomes `ready`
- waiter may add new `pending` items to same order
- payment is allowed only when all positions are no longer `pending` or `in_kitchen`
- then order can become `paid`

Important consequence:
- the project currently supports add-on waves in one active order
- this is more realistic than creating a second order for the same table

## 6.3 Booking Lifecycle

Current lifecycle:
- owner creates booking
- statuses: `confirmed`, `seated`, `cancelled`, `no_show`
- booking can affect table status
- booking APIs are owner-only for write actions

## 6.4 Subscription Gating

Current behavior:
- users with no restaurant assignment are redirected to `/not-connected`
- users whose current restaurant has invalid subscription are redirected to `/subscription-blocked`
- middleware makes this decision from session claims
- `/api/auth/status` can signal `needs_refresh` if claims are stale

## 7. API Surface

### Auth
- `POST /api/auth`
- `GET /api/auth/status`
- `POST /api/auth/logout`

### Admin
- `GET /api/admin/stats`
- `GET /api/admin/shops`
- `POST /api/admin/shops`
- `GET /api/admin/shops/[id]`
- `PATCH /api/admin/shops/[id]`
- `DELETE /api/admin/shops/[id]`
- `POST /api/admin/shops/[id]/members`
- `DELETE /api/admin/shops/[id]/members`
- `GET /api/admin/users`
- `GET /api/admin/users/[id]`
- `PATCH /api/admin/users/[id]`
- `PATCH /api/admin/subscriptions/[shopId]`

### Restaurant Operations
- `GET /api/analytics`
- `GET /api/bookings`
- `POST /api/bookings`
- `PATCH /api/bookings/[id]`
- `DELETE /api/bookings/[id]`
- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/[id]`
- `DELETE /api/categories/[id]`
- `GET /api/menu`
- `POST /api/menu`
- `PATCH /api/menu/[id]`
- `DELETE /api/menu/[id]`
- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/[id]`
- `PATCH /api/orders/[id]`
- `POST /api/orders/[id]/items`
- `PATCH /api/order-items/[id]`
- `DELETE /api/order-items/[id]`
- `GET /api/staff`
- `GET /api/tables`
- `POST /api/tables`
- `GET /api/tables/[id]`
- `PATCH /api/tables/[id]`
- `DELETE /api/tables/[id]`

## 8. What Is Still Missing or Incomplete

These are the main things that are not yet fully solved.

## 8.1 Role Model Still Needs Cleanup

Current state:
- `users.role` still exists and is still being updated in some admin flows
- `shop_users.role` is the real source for restaurant roles
- this means the project works, but the architecture is not perfectly clean yet

What is missing:
- full separation of platform role vs restaurant role
- single authoritative rule for all admin assignment paths

## 8.2 No Automated End-to-End Test Suite

Current state:
- no Playwright or Cypress test suite is present
- validation is manual through UI and API testing

What is missing:
- end-to-end regression tests for:
  - auth
  - waiter flow
  - kitchen flow
  - owner flow
  - admin assignment flow

## 8.3 No Real Realtime Layer

Current state:
- UI uses polling and refresh-on-focus

What is missing:
- Supabase realtime subscriptions or websocket-style updates

Impact:
- current MVP is acceptable
- not ideal for heavy operational load

## 8.4 No Restaurant Switching UX

Current state:
- current restaurant is derived from primary membership context

What is missing:
- explicit shop switcher for users attached to multiple restaurants

## 8.5 No Advanced Kitchen Features

Current state:
- kitchen queue exists
- ready action exists

What is missing:
- stations / sections
- partial readiness
- ticket splitting by course
- printer integration
- sound alerts
- SLA timers per item

## 8.6 No Cashier Role / Finance Layer

Current state:
- payment is handled by waiter/owner flow

What is missing:
- dedicated cashier role
- fiscal integrations
- receipt printing
- transaction/audit ledger

## 8.7 No Inventory / Procurement / Warehouse

Not implemented:
- stock deductions
- ingredient-level recipes
- purchase management
- inventory alerts

## 8.8 No Customer-Facing Product

Not implemented:
- guest-facing ordering
- QR order-from-table flow
- delivery
- loyalty
- CRM

## 9. Known Technical Caveats

## 9.1 `SessionPayload` Is Incomplete

File:
- [lib/types.ts](/Users/fayzulloja/Desktop/Birliy%20Claude/lib/types.ts)

Issue:
- `SessionPayload` does not reflect actual JWT claims used at runtime

Reality:
- real session claim type is effectively `BirliyClaims` in [lib/auth/session.ts](/Users/fayzulloja/Desktop/Birliy%20Claude/lib/auth/session.ts)

## 9.2 Duplicate Security Headers

Files:
- [vercel.json](/Users/fayzulloja/Desktop/Birliy%20Claude/vercel.json)
- [next.config.ts](/Users/fayzulloja/Desktop/Birliy%20Claude/next.config.ts)

Issue:
- some headers are declared in both places

Status:
- not critical
- can be cleaned later

## 9.3 Invalid `X-Frame-Options` Value

File:
- [next.config.ts](/Users/fayzulloja/Desktop/Birliy%20Claude/next.config.ts)

Issue:
- `X-Frame-Options: ALLOWALL` is not a standard valid value

Current practical situation:
- Telegram embedding mostly relies on CSP `frame-ancestors`

Recommendation:
- eventually remove invalid `X-Frame-Options` usage and rely on CSP

## 9.4 Workspace Hygiene

Current local folder contains:
- `.DS_Store` files
- a dirty git working tree in some paths

This is not a runtime blocker, but should be cleaned.

## 10. Deploy and Environment

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `NEXT_PUBLIC_APP_URL`

Deployment target:
- Vercel for app
- Supabase for DB/auth storage

Production requirements:
- all migrations applied
- correct Vercel env variables
- Telegram bot configured via BotFather
- `main` branch deployed

## 11. Current Maturity Assessment

Current maturity:
- strong internal MVP / pilot stage
- suitable for pilot across a small number of restaurants
- not yet a fully hardened large-scale production system

What is already good:
- auth flow
- role-gated dashboards
- restaurant operations core
- order and kitchen flow
- admin tools
- menu/tables/bookings/staff management

What still needs work before larger rollout:
- cleaner role architecture
- automated tests
- better realtime behavior
- more operational observability
- deployment/version discipline

## 12. Suggested Immediate Roadmap

### Phase A — Stabilization
- finish cleanup of platform role vs shop role
- normalize admin assignment behavior
- add regression tests for auth and order flow
- remove invalid/dead config and stale docs

### Phase B — Operational Hardening
- improve queue/table realtime behavior
- add better error reporting and observability
- clean deployment process and release checklist

### Phase C — Product Expansion
- richer kitchen workflow
- multi-restaurant switcher
- cashier flow
- printing
- inventory

## 13. Suggested Prompt Context for Another AI

If you need to hand this project to another ChatGPT/Codex session, give it this summary:

"BirLiy Kassa is a Telegram Mini App-based restaurant operations system on Next.js + Supabase. It supports super_admin, owner, waiter, and kitchen roles. Waiters manage tables and orders, owners manage restaurant operations, kitchen handles current cooking queue, and super_admin manages the platform, users, restaurants, and subscriptions. The system uses Telegram auth plus a custom HS256 JWT session cookie, with middleware-based routing and shop/subscription gating. The project currently supports one active order per table with multiple kitchen waves via order_item statuses (`pending`, `in_kitchen`, `ready`). Main missing pieces are role-model cleanup, automated e2e tests, realtime improvements, and advanced kitchen/cashier/inventory features. Treat the local workspace as the current source of truth, because deployed state may lag behind local changes if Vercel has not redeployed yet."

