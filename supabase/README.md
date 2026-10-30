# Database Architecture & Migration Management: StockSentinel AI

This directory manages the PostgreSQL DDL schemas, chronological migrations, and isolation test suites for StockSentinel AI.

---

## Directory Hierarchy

```text
database/
├── schema/
│   └── init_schema.sql         # Base PostgreSQL schema definition
├── migrations/                 # Chronological versioned migrations
│   ├── 20261018000000_init_schema.sql
│   ├── 20261018000001_secure_schema.sql
│   ├── 20261028000000_chat_schema.sql
│   ├── 20261029000000_multi_tenant_rbac_rollback.sql
│   ├── 20261029000000_multi_tenant_rbac_schema.sql
│   ├── 20261029000001_invitations_declined_state.sql
│   └── 20261029000002_fix_accept_invitation_ambiguity.sql
└── tests/
    └── 20261029000000_test_rbac_isolation.sql # SQL transaction-level isolation tests
```

---

## 1. Migration Execution Order

When deploying to a fresh PostgreSQL or Supabase instance, execute the scripts in the following order:

1. `20261018000000_init_schema.sql`: Base retail tables (`stores`, `products`, `daily_sales`, `inventory_snapshots`, `promotions`, `alerts`).
2. `20261018000001_secure_schema.sql`: Row-Level Security (RLS) enforcement and indexes.
3. `20261028000000_chat_schema.sql`: Conversational AI persistence (`chat_conversations`, `chat_messages`).
4. `20261029000000_multi_tenant_rbac_schema.sql`: Multi-tenant hierarchy (`companies`, `company_memberships`, `store_assignments`, `invitations`, `platform_administrators`).
5. `20261029000001_invitations_declined_state.sql`: Invitation lifecycle extension (`DECLINED` state).
6. `20261029000002_fix_accept_invitation_ambiguity.sql`: Resolves column ambiguity in stored procedure `accept_invitation`.

---

## 2. Row-Level Security (RLS) Policies

All tables have RLS enabled:
- **`company_memberships`**: Users may only read memberships within their own company.
- **`store_assignments`**: Users can only see their own store assignment unless they are `COMPANY_MANAGER` or `PLATFORM_ADMIN`.
- **`alerts` & `daily_sales`**: Scoped strictly by `can_access_store(store_id)` security definer function.
- **`chat_conversations` & `chat_messages`**: Accessible strictly by `auth.uid() = user_id`.

