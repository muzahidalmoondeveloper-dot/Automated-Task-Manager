# Organization Switching System

A complete design and implementation reference for multi-tenant organization
switching in a SaaS application.

---

## Table of Contents

1. [Overview & Core Concept](#1-overview--core-concept)
2. [Database Changes](#2-database-changes)
3. [JWT Token Design](#3-jwt-token-design)
4. [API Endpoints](#4-api-endpoints)
5. [Login Flow — Restore Last Active Tenant](#5-login-flow--restore-last-active-tenant)
6. [Auth Middleware Update](#6-auth-middleware-update)
7. [Frontend Implementation](#7-frontend-implementation)
8. [Security Considerations](#8-security-considerations)
9. [Edge Cases Reference](#9-edge-cases-reference)
10. [Full Endpoint Summary](#10-full-endpoint-summary)

---

## 1. Overview & Core Concept

A single user can belong to **multiple organizations (tenants)** with different
roles in each. The organization switching system lets a user seamlessly move
between those organizations without logging out and back in.

```
User: Rahim
  ├── Company A  →  role: owner
  ├── Company B  →  role: admin
  └── Company C  →  role: team_member

One account. One login. Switch between companies anytime.
```

### How it works at a high level

```
Login
  └─► Resolve last active tenant → issue JWT (userId + tenantId + role)

Every API request
  └─► Middleware validates JWT → live DB membership check → attach req.user

User opens Org Switcher UI
  └─► GET /me/organizations → show all orgs with current marked

User picks Company B
  └─► POST /me/switch-organization { tenantId: B }
        ├─► Verify membership in B
        ├─► Issue new accessToken + refreshToken scoped to B
        ├─► Update last_active_tenant_id = B
        └─► Frontend: replace tokens → clear tenant state → hard redirect

Invitation accepted (new org joined)
  └─► New tenant_users row added → appears in /me/organizations automatically
```

---

## 2. Database Changes

No new tables required. The existing `tenant_users` join table already supports
a user belonging to multiple tenants. Only one small addition is needed.

### 2.1 Existing Structure (Already in Place)

```sql
-- tenant_users links one user to many tenants with a role per tenant
-- tenant_id | user_id | role         | team_id | status
-- ---------------------------------------------------------
-- Company-A  | Rahim   | owner        | null    | active
-- Company-B  | Rahim   | admin        | null    | active
-- Company-C  | Rahim   | team_member  | team-1  | active
```

### 2.2 New Column — Remember Last Active Tenant

```sql
-- Remembers which org the user was last in, so login resumes there
ALTER TABLE users
  ADD COLUMN last_active_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
```

### 2.3 Indexes (Verify These Exist)

```sql
-- Fast lookup of all tenants a user belongs to
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);

-- Fast lookup of all users in a tenant
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
```

---

## 3. JWT Token Design

The JWT must carry the **active tenant context**. Every request is scoped to
one tenant at a time. Switching organizations issues a new JWT.

### 3.1 Token Payload

```javascript
// JWT payload
{
  userId:   "uuid",         // global user identity
  tenantId: "uuid",         // currently active organization
  role:     "admin",        // role IN that organization
  teamId:   "uuid | null",  // team within the org (for team_manager / team_member)
  iat:      1234567890,
  exp:      1234567890,
}
```

### 3.2 Token Generator

```javascript
function generateJWT({ userId, tenantId, role, teamId = null }) {
  return jwt.sign(
    { userId, tenantId, role, teamId },
    process.env.JWT_SECRET,
    { expiresIn: '15m' } // short-lived; refresh token handles renewal
  );
}

function generateRefreshToken({ userId, tenantId }) {
  return jwt.sign(
    { userId, tenantId },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
}
```

> **Important:** Keep access tokens short-lived (15 minutes). This limits the
> window where a stale role (e.g., after demotion) could be exploited before
> the middleware's live DB check catches it.

---

## 4. API Endpoints

### 4.1 List My Organizations

Returns all organizations the authenticated user belongs to, including their
role in each one.

```
GET /api/v1/me/organizations
Authorization: Bearer <accessToken>
```

**Controller:**

```javascript
async function listMyOrganizations(req, res) {
  const result = await db.query(
    `SELECT
       t.id,
       t.name,
       t.logo_url,
       t.status,
       tu.role,
       tu.team_id,
       tm.name      AS team_name,
       (t.id = $2)  AS is_current
     FROM tenant_users tu
     JOIN tenants t  ON t.id  = tu.tenant_id
     LEFT JOIN teams tm ON tm.id = tu.team_id
     WHERE tu.user_id  = $1
       AND tu.status   = 'active'
       AND t.status   != 'deleted'
     ORDER BY tu.created_at ASC`,
    [req.user.id, req.user.tenantId]
  );

  return res.json({
    current:       req.user.tenantId,
    organizations: result.rows,
  });
}
```

**Sample Response:**

```json
{
  "current": "tenant-uuid-A",
  "organizations": [
    {
      "id":        "tenant-uuid-A",
      "name":      "Company A",
      "logo_url":  "https://...",
      "role":      "owner",
      "team_id":   null,
      "team_name": null,
      "is_current": true
    },
    {
      "id":        "tenant-uuid-B",
      "name":      "Company B",
      "logo_url":  "https://...",
      "role":      "admin",
      "team_id":   null,
      "team_name": null,
      "is_current": false
    },
    {
      "id":        "tenant-uuid-C",
      "name":      "Company C",
      "logo_url":  "https://...",
      "role":      "team_member",
      "team_id":   "team-uuid-1",
      "team_name": "Design Team",
      "is_current": false
    }
  ]
}
```

---

### 4.2 Switch Organization

Verifies membership, issues new tokens scoped to the target tenant, and
updates the last active tenant record.

```
POST /api/v1/me/switch-organization
Authorization: Bearer <accessToken>
Body: { "tenantId": "tenant-uuid-B" }
```

**Controller:**

```javascript
async function switchOrganization(req, res) {
  const { tenantId } = req.body;

  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required' });
  }

  // Already on this tenant — no-op
  if (req.user.tenantId === tenantId) {
    return res.status(200).json({ message: 'Already on this organization' });
  }

  // Verify membership in the target tenant
  const membership = await db.query(
    `SELECT tu.role, tu.team_id, t.name, t.status
     FROM tenant_users tu
     JOIN tenants t ON t.id = tu.tenant_id
     WHERE tu.user_id  = $1
       AND tu.tenant_id = $2
       AND tu.status    = 'active'`,
    [req.user.id, tenantId]
  );

  if (!membership.rows.length) {
    return res.status(403).json({ error: 'You are not a member of this organization' });
  }

  const { role, team_id, name, status } = membership.rows[0];

  if (status === 'suspended') {
    return res.status(403).json({ error: 'This organization is currently suspended' });
  }

  // Issue new tokens scoped to the target tenant
  const accessToken = generateJWT({
    userId:   req.user.id,
    tenantId,
    role,
    teamId:   team_id,
  });

  const refreshToken = generateRefreshToken({
    userId:   req.user.id,
    tenantId,
  });

  // Persist last active tenant for next login
  await db.query(
    `UPDATE users SET last_active_tenant_id = $1 WHERE id = $2`,
    [tenantId, req.user.id]
  );

  return res.json({
    accessToken,
    refreshToken,
    organization: {
      id:     tenantId,
      name,
      role,
      teamId: team_id,
    },
  });
}
```

**Sample Response:**

```json
{
  "accessToken":  "<new JWT scoped to Company B>",
  "refreshToken": "<new refresh token>",
  "organization": {
    "id":     "tenant-uuid-B",
    "name":   "Company B",
    "role":   "admin",
    "teamId": null
  }
}
```

---

### 4.3 Refresh Token — Renew Access Token

When the access token expires (15 min), the frontend uses the refresh token
to get a new one without switching org or logging out.

```
POST /api/v1/auth/refresh
Body: { "refreshToken": "..." }
```

```javascript
async function refreshAccessToken(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  // Re-validate membership (role may have changed since last token)
  const membership = await db.query(
    `SELECT tu.role, tu.team_id
     FROM tenant_users tu
     WHERE tu.user_id   = $1
       AND tu.tenant_id = $2
       AND tu.status    = 'active'`,
    [payload.userId, payload.tenantId]
  );

  if (!membership.rows.length) {
    return res.status(403).json({ error: 'Membership revoked or inactive' });
  }

  const { role, team_id } = membership.rows[0];

  const newAccessToken = generateJWT({
    userId:   payload.userId,
    tenantId: payload.tenantId,
    role,
    teamId:   team_id,
  });

  return res.json({ accessToken: newAccessToken });
}
```

---

## 5. Login Flow — Restore Last Active Tenant

On login, automatically restore the user to their last active organization.
Fall back to the earliest joined org if no last-active record exists.

```javascript
async function login(req, res) {
  const { email, password } = req.body;

  const userResult = await db.query(
    `SELECT * FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  if (!userResult.rows.length) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = userResult.rows[0];

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  // Restore last active tenant, fall back to earliest joined
  const membership = await db.query(
    `SELECT tu.tenant_id, tu.role, tu.team_id
     FROM tenant_users tu
     JOIN tenants t ON t.id = tu.tenant_id
     WHERE tu.user_id  = $1
       AND tu.status   = 'active'
       AND t.status   != 'deleted'
     ORDER BY
       (tu.tenant_id = $2) DESC,  -- prefer last_active_tenant_id
       tu.created_at ASC           -- fallback: earliest joined
     LIMIT 1`,
    [user.id, user.last_active_tenant_id]
  );

  if (!membership.rows.length) {
    return res.status(403).json({ error: 'No active organization found for this account' });
  }

  const { tenant_id, role, team_id } = membership.rows[0];

  const accessToken  = generateJWT({ userId: user.id, tenantId: tenant_id, role, teamId: team_id });
  const refreshToken = generateRefreshToken({ userId: user.id, tenantId: tenant_id });

  return res.json({ accessToken, refreshToken });
}
```

### Login Resolution Flow

```
User logs in
    │
    ▼
Does last_active_tenant_id exist?
    │
    ├── YES ──► Is user still an active member there?
    │               ├── YES ──► Restore to that org ✓
    │               └── NO  ──► Fall through to fallback
    │
    └── NO / fallback ──► Pick earliest joined active org
                              │
                              └── None found? ──► 403 (no active org)
```

---

## 6. Auth Middleware Update

Every API request must validate the JWT **and** do a live DB membership check.
This ensures role changes (e.g., demotion, removal) take effect immediately
without needing to invalidate tokens.

```javascript
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Live DB check — do NOT trust role from JWT alone
  const membership = await db.query(
    `SELECT tu.role, tu.team_id, tu.status
     FROM tenant_users tu
     WHERE tu.user_id   = $1
       AND tu.tenant_id = $2`,
    [payload.userId, payload.tenantId]
  );

  if (!membership.rows.length || membership.rows[0].status !== 'active') {
    return res.status(403).json({ error: 'Membership revoked or inactive' });
  }

  // Always use DB values, not JWT values, for role and teamId
  req.user = {
    id:       payload.userId,
    tenantId: payload.tenantId,
    role:     membership.rows[0].role,     // from DB — always fresh
    teamId:   membership.rows[0].team_id,  // from DB — always fresh
  };

  next();
}
```

> **Why read role from DB on every request?**
> If a user is demoted from `admin` to `team_member`, their existing JWT
> still says `admin`. Reading from DB ensures the change takes effect
> immediately — no token invalidation needed, no waiting for expiry.

---

## 7. Frontend Implementation

### 7.1 Org Switcher UI

```
Header / Sidebar:
┌──────────────────────────────┐
│  🏢  Company A  (Owner)  ▼  │  ← currently active org
└──────────────────────────────┘
         ↓ on click
┌──────────────────────────────┐
│  ✓  Company A   (Owner)      │  ← checkmark = current
│     Company B   (Admin)      │
│     Company C   (Member)     │
│  ────────────────────────    │
│  +  Create new organization  │
└──────────────────────────────┘
```

### 7.2 Switch Handler

```javascript
async function handleSwitchOrganization(targetTenantId) {
  try {
    // 1. Call the switch endpoint
    const { data } = await api.post('/me/switch-organization', {
      tenantId: targetTenantId,
    });

    // 2. Store new tokens
    localStorage.setItem('accessToken',  data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    // 3. Clear all tenant-scoped cached state
    queryClient.clear();              // React Query — clear all cached queries
    store.dispatch(resetOrgState());  // Redux/Zustand — reset org-specific slices

    // 4. Hard redirect to dashboard
    // Must be a hard redirect (not router.push) to fully clear in-memory state
    window.location.href = '/dashboard';

  } catch (error) {
    if (error.response?.status === 403) {
      toast.error('You no longer have access to this organization.');
    } else {
      toast.error('Failed to switch organization. Please try again.');
    }
  }
}
```

### 7.3 Fetch Organizations on App Load

```javascript
// Call this once when the app mounts (e.g., in a top-level layout component)
async function fetchMyOrganizations() {
  const { data } = await api.get('/me/organizations');
  store.dispatch(setOrganizations(data.organizations));
  store.dispatch(setCurrentOrg(data.current));
}
```

### 7.4 What State to Clear on Switch

Switching orgs is like a "mini logout" for the previous org's data.
Clear everything that is tenant-scoped:

```javascript
function clearTenantScopedState() {
  queryClient.clear();          // All API response caches
  store.dispatch(resetOrgState()); // Org-specific Redux/Zustand slices
  closeAllModals();             // Any open dialogs
  clearNotifications();         // Notification tray
  resetSidebarNavigation();     // Nav items differ per role
}
```

### 7.5 Token Refresh Interceptor

```javascript
// Axios interceptor — auto-refresh access token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });

        localStorage.setItem('accessToken', data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

        return api(originalRequest); // retry original request
      } catch {
        // Refresh failed — force logout
        localStorage.clear();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
```

---

## 8. Security Considerations

### 8.1 Never Trust the JWT Role

Always read `role` and `team_id` from the database in the middleware, not
from the JWT payload. The JWT may be stale after a role change.

```
JWT says: role = "admin"
DB says:  role = "team_member"  ← trust this one
```

### 8.2 Membership Verified on Every Request

The middleware does a DB lookup on every request. This means:

- If a user is **removed** from an org, their next request with that org's token returns `403` immediately.
- If a user's **role is changed**, it takes effect on the very next request.
- No token blacklisting infrastructure needed.

### 8.3 Tenant Isolation

Every DB query in your controllers must include `tenant_id = $x` scoping.
Never rely solely on the resource ID — always filter by the tenant from `req.user.tenantId`:

```javascript
// ✅ Correct — scoped to current tenant
await db.query(
  `SELECT * FROM projects WHERE id = $1 AND tenant_id = $2`,
  [projectId, req.user.tenantId]
);

// ❌ Wrong — a user from tenant B could access tenant A's project
await db.query(
  `SELECT * FROM projects WHERE id = $1`,
  [projectId]
);
```

### 8.4 Rate Limit the Switch Endpoint

Prevent abuse (e.g., brute-force probing of tenant IDs):

```javascript
import rateLimit from 'express-rate-limit';

const switchOrgLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // max 20 switches per minute per IP
  message: { error: 'Too many organization switches. Please wait.' },
});

router.post('/me/switch-organization', switchOrgLimiter, authMiddleware, switchOrganization);
```

### 8.5 Suspended Organization Guard

If a tenant is suspended (e.g., billing lapsed), block the switch at the
API level and show a clear message in the UI:

```javascript
if (status === 'suspended') {
  return res.status(403).json({
    error: 'This organization is currently suspended.',
    code:  'ORG_SUSPENDED',
  });
}
```

---

## 9. Edge Cases Reference

| Scenario | Handling |
|---|---|
| User switches to an org they were just removed from | `tenant_users` membership check returns empty → `403` |
| User's role changed while they have an active JWT | Middleware reads role from DB → role change is immediate |
| Last active tenant was deleted | `last_active_tenant_id` set to `NULL` via `ON DELETE SET NULL` → falls back to earliest org |
| User belongs to only one org | Org switcher still renders but switch option is disabled |
| User has no active org at all | Login returns `403 No active organization found` — prompt to check email for invites |
| Org is suspended during an active session | Next API request returns `403 ORG_SUSPENDED` → frontend redirects to billing page |
| New invitation accepted | `tenant_users` row added → `/me/organizations` automatically includes the new org |
| User opens two browser tabs, switches in one | Other tab's next API call uses old token → gets `403` or stale data → should auto-refresh token to detect the switch |
| Concurrent switch requests | Both are valid — last write wins for `last_active_tenant_id`; stateless design handles this gracefully |
| Token stolen from old org after switch | Short token expiry (15 min) limits exposure; middleware still checks live membership |

---

## 10. Full Endpoint Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/me/organizations` | Required | List all orgs user belongs to |
| `POST` | `/me/switch-organization` | Required | Switch to a different org |
| `POST` | `/auth/refresh` | Refresh token | Renew access token |
| `POST` | `/auth/login` | Public | Login & restore last active org |

---

## Appendix: Integration with Invitation System

When a user **accepts an invitation**, the new `tenant_users` row is inserted
automatically. No extra steps are needed — the new org appears in
`GET /me/organizations` on the very next call. The user can switch to it
immediately.

```
Invitation accepted
  └─► tenant_users row inserted (tenant_id, user_id, role, team_id)
        └─► GET /me/organizations now includes the new org
              └─► User can POST /me/switch-organization to enter it
```

This is why the invitation and switching systems are designed together —
the `tenant_users` table is the single source of truth for both.
