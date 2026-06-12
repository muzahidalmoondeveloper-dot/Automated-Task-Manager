# Multi-Tenant Architecture

This document covers the multi-tenant design of the Automated Task Manager — how workspaces are isolated, how roles and permissions work, how the authentication flow integrates org context, and how the frontend enforces tenant boundaries.

---

## Table of Contents

1. [Overview](#overview)
2. [Data Model](#data-model)
3. [Role Hierarchy](#role-hierarchy)
4. [Tenant Context Resolution](#tenant-context-resolution)
5. [JWT Token Structure](#jwt-token-structure)
6. [Authentication & Registration Flow](#authentication--registration-flow)
7. [API Endpoints](#api-endpoints)
8. [Tenant Data Isolation](#tenant-data-isolation)
9. [Plan Limits & Feature Gates](#plan-limits--feature-gates)
10. [Frontend Routing & Guards](#frontend-routing--guards)
11. [Invitation System](#invitation-system)
12. [Multi-Org Support](#multi-org-support)
13. [Security Considerations](#security-considerations)

---

## Overview

The application uses a **workspace-per-organization** multi-tenancy model. Every piece of business data (teams, projects, tasks, KPIs, rocks, issues, news) is scoped to an `Organization`. Users are global (shared across organizations) but hold a distinct role within each organization they belong to via the `OrganizationMembership` join table.

**Key architectural properties:**

- One global `users` table — no per-tenant user duplication
- All business data rows carry an `organization_id` foreign key
- JWT tokens embed `org_id` + `org_role` claims to identify the active tenant context on every request
- The `TenantContext` dependency resolves and validates the tenant on every protected route — no manual filtering required in route handlers
- A user may belong to multiple organizations with different roles in each

---

## Data Model

### Core Tables

```
users
├── id (int, PK)
├── full_name
├── email (unique)
├── hashed_password
├── role (str) ← global default role; overridden in API responses by org_role
├── is_active (bool)
├── email_verified_at (datetime | null)
└── created_at / updated_at

organizations
├── id (UUID, PK)
├── name
├── slug (unique) ← URL-safe identifier
├── description / logo_url
├── plan (str) ← "free", "pro", "enterprise"
├── is_active (bool)
├── owner_id (FK → users.id, RESTRICT)
└── created_at / updated_at

organization_memberships           ← the tenant ↔ user bridge
├── id (int, PK)
├── organization_id (FK → organizations.id, CASCADE)
├── user_id (FK → users.id, CASCADE)
├── role (str) ← "owner" | "admin" | "member"  [source of truth for permissions]
├── is_active (bool)               ← soft-delete; history is preserved
├── joined_at (datetime)
└── created_at
[unique constraint: (organization_id, user_id)]

organization_invitations
├── id (UUID, PK)
├── organization_id (FK → organizations.id, CASCADE)
├── email
├── role                           ← role the invitee will receive on acceptance
├── invited_by_id (FK → users.id)
├── token (unique, 128-char)       ← sent in the invitation email
├── accepted_at (datetime | null)
├── expires_at (datetime)          ← 72 h from creation
└── created_at

subscriptions
├── id (UUID, PK)
├── organization_id (FK, unique)
├── plan / status / seats
├── trial_ends_at / current_period_start / current_period_end
└── stripe_subscription_id / stripe_customer_id
```

### Business-Data Tables (all scoped by organization_id)

| Table | organization_id FK |
|---|---|
| `teams` | ✅ |
| `projects` | ✅ |
| `tasks` | via `project.organization_id` |
| `kpis` | ✅ |
| `rocks` | ✅ |
| `issues` | ✅ |
| `team_news` | via `team.organization_id` |
| `objectives` | ✅ |
| `org_values` | ✅ |
| `org_roles` (custom role chart) | ✅ |
| `integration_accounts` | ✅ |

---

## Role Hierarchy

Roles are stored on `OrganizationMembership.role` and are **per-organization** — the same user can be `owner` in one workspace and `member` in another.

```
OWNER  ──▶  full control: billing, delete org, transfer ownership, all admin actions
  │
ADMIN  ──▶  manage members, invite/remove users, update org settings, full app access
  │
MEMBER ──▶  standard workspace access: create/view tasks, teams, projects per plan
```

**Defined in `app/core/org_roles.py`:**

```python
ORG_OWNER            = "owner"
ORG_ADMIN            = "admin"
ORG_MEMBER           = "member"

ORG_MANAGEMENT_ROLES = {ORG_OWNER, ORG_ADMIN}   # can manage org settings & members
ALL_ORG_ROLES        = {ORG_OWNER, ORG_ADMIN, ORG_MEMBER}
```

### What each role can do

| Action | OWNER | ADMIN | MEMBER |
|---|:---:|:---:|:---:|
| View dashboard, tasks, projects | ✅ | ✅ | ✅ |
| Create / edit / delete tasks | ✅ | ✅ | ✅ |
| Create / edit teams & projects | ✅ | ✅ | — |
| Invite members | ✅ | ✅ | — |
| Remove members / change roles | ✅ | ✅ | — |
| Update org name & settings | ✅ | ✅ | — |
| View subscription & usage | ✅ | ✅ | — |
| Delete organization | ✅ | — | — |
| Transfer ownership | ✅ | — | — |

### Role in API responses

Every endpoint that issues or refreshes a token overrides the returned `user.role` field with the caller's **current org-scoped role** (`org_role` JWT claim), so the frontend always reads the active-workspace role directly from `user.role` — no separate lookup required.

---

## Tenant Context Resolution

Every protected route that needs org context depends on `TenantContext` (defined in `app/core/tenant.py`). The dependency chain:

```
Request JWT
    │
    ▼
decode_access_token()  ──▶  extract sub (user_id), org_id, org_role
    │
    ▼
load User from DB  ──▶  check is_active
    │
    ▼
load Organization  ──▶  check is_active
    │
    ▼
load OrganizationMembership  ──▶  check is_active
    │
    ▼
return TenantContext(organization_id, organization, membership, user, db)
```

**`TenantContext` properties:**

```python
tenant.org_role          # str: "owner" | "admin" | "member"
tenant.is_owner          # bool: role == "owner"
tenant.is_admin_or_owner # bool: role in {"owner", "admin"}
tenant.plan_limits       # PlanLimits object
tenant.organization_id   # UUID
tenant.user              # User ORM object
tenant.db                # AsyncSession
```

**Built-in role-gated dependencies (drop-in route guards):**

```python
# Usage in route handler:
tenant: TenantContext = Depends(get_tenant_context)   # any member
tenant: TenantContext = Depends(require_org_admin)    # owner or admin only
tenant: TenantContext = Depends(require_org_owner)    # owner only
```

---

## JWT Token Structure

The application issues short-lived **access tokens** (HS256) and long-lived **refresh tokens**.

### Access token claims

```json
{
  "sub":      "42",
  "email":    "user@example.com",
  "org_id":   "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "org_role": "owner",
  "jti":      "0cfbfe0f-6f76-4600-86c6-e7cc472437c8",
  "iat":      1780902053,
  "exp":      1780905653,
  "type":     "access"
}
```

- `org_id` / `org_role` are absent when the user has no active workspace (post-registration, before workspace creation).
- `org_id` presence controls `hasOrgContext` on the frontend — its absence triggers the workspace-setup redirect.
- `jti` is stored in Redis for instant revocation (logout / security events).

### Token lifecycle

```
POST /auth/register/verify-otp  ──▶  access token (no org_id)
        │
        │  user visits /setup/organization
        ▼
POST /organizations              ──▶  new access token (org_id = new workspace)
        │                                    ↑ user is now OWNER
        │                    OR
        │  token refresh
        ▼
POST /auth/token-refresh         ──▶  new access token (org_id preserved from old token)
        │
        │  switch workspace
        ▼
POST /auth/select-organization/{org_id}  ──▶  new access token (org_id = selected workspace)
```

---

## Authentication & Registration Flow

### New user registration

```
POST /auth/register
  └─ validate password strength
  └─ create user (is_active=false, email_verified_at=null)
  └─ send 6-digit OTP to email

POST /auth/register/verify-otp
  └─ verify OTP
  └─ activate user (is_active=true, email_verified_at=now())
  └─ issue access token WITHOUT org_id
  └─ return TokenResponse

[frontend: hasOrgContext = false → ProtectedRoute redirects to /setup/organization]

POST /organizations  (authenticated, no org context required)
  └─ create Organization record
  └─ add user as OrganizationMembership (role="owner")
  └─ create free Subscription
  └─ issue new access token WITH org_id + org_role="owner"
  └─ return TokenResponse

[frontend: user lands on /dashboard as workspace OWNER]
```

### Returning user login

```
POST /auth/login
  └─ verify credentials
  └─ if email not verified → resend OTP, return email_verification_required=true
  └─ if OTP login enabled → send OTP, return otp_required=true
  └─ else → resolve org context:
       ├─ 1 org   → auto-select, return TokenResponse with org context
       ├─ >1 orgs → return requires_org_selection=true + organizations list
       └─ 0 orgs  → return token without org context → /setup/organization

POST /auth/login/verify-otp   (if OTP step was triggered)
  └─ same org-resolution logic as above

POST /auth/select-organization/{org_id}   (if multiple orgs)
  └─ validate membership
  └─ issue org-scoped TokenResponse
```

---

## API Endpoints

### Auth (`/api/auth/`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Start registration, send OTP |
| POST | `/register/verify-otp` | — | Verify OTP, activate user, get org-less token |
| POST | `/login` | — | Login with password |
| POST | `/login/verify-otp` | — | Verify login OTP |
| GET | `/me` | ✅ | Current user profile (role reflects active org) |
| GET | `/my-organizations` | ✅ | List all orgs the user belongs to |
| POST | `/select-organization/{org_id}` | ✅ | Switch active workspace |
| POST | `/accept-invitation` | ✅ | Accept a workspace invitation |
| POST | `/token-refresh` | — | Refresh access token |
| POST | `/logout` | ✅ | Revoke tokens |

### Workspace Management (`/api/organizations/`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| POST | `/organizations` | any authenticated | Create new workspace (issues org-scoped token) |
| GET | `/organizations/current` | member | Get current workspace details |
| PUT | `/organizations/current` | admin+ | Update name / description / logo |
| DELETE | `/organizations/current` | owner | Deactivate workspace |
| GET | `/organizations/current/members` | admin+ | List members with roles |
| DELETE | `/organizations/current/members/{user_id}` | admin+ | Remove member |
| PUT | `/organizations/current/members/{user_id}/role` | admin+ | Change member role |
| POST | `/organizations/current/members/invite` | admin+ | Send invitation email |
| GET | `/organizations/current/invitations` | admin+ | List pending invitations |
| GET | `/organizations/current/subscription` | admin+ | Subscription details |
| GET | `/organizations/current/usage` | member | Plan limits + current usage |

### Users (`/api/users/`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| GET | `/users/me` | any auth | Current user profile |
| GET | `/users` | admin+ | List org members |
| POST | `/users` | admin+ | Create user + add to org |
| PATCH | `/users/{user_id}` | admin+ | Update user |
| DELETE | `/users/{user_id}` | owner | Remove user |

### Business Data (all require active org membership)

| Prefix | Required Role (reads) | Required Role (mutations) |
|---|---|---|
| `/api/teams/` | member | admin+ |
| `/api/projects/` | member | admin+ |
| `/api/tasks/` | member | admin+ |
| `/api/kpi/` | member | admin+ |
| `/api/rocks/` | member | admin+ |
| `/api/issues/` | member | admin+ |
| `/api/team-news/` | member | admin+ |
| `/api/chat/` | member (ai feature gate) | — |

---

## Tenant Data Isolation

### Query-level scoping

All repositories extend `BaseTenantRepository` and receive `organization_id` at construction time. Every query automatically includes an `organization_id` filter:

```python
# Example from TeamRepository
async def list_teams(self) -> list[Team]:
    result = await self.db.execute(
        select(Team).where(Team.organization_id == self.organization_id)
    )
    return result.scalars().all()
```

Route handlers construct repositories from the tenant context:

```python
@router.get("/teams")
async def list_teams(tenant: TenantContext = Depends(get_tenant_context)):
    repo = TeamRepository(tenant.db, tenant.organization_id)
    return await repo.list_teams()
```

### Cross-tenant attack prevention

1. **JWT `org_id` is the only accepted tenant identifier** — requests cannot specify a different org_id in the request body to access another tenant's data; only the JWT claim is used.
2. **Membership is verified on every request** — `get_tenant_context()` re-queries `OrganizationMembership` on each request; a deactivated or removed membership immediately blocks access on the next request.
3. **`organization_id` is never accepted as user input** for scoped queries — it is always sourced from `tenant.organization_id` (the verified JWT claim).
4. **Role escalation is blocked** — `PUT .../members/{user_id}/role` prevents demoting the org owner and only allows setting roles within `ALL_ORG_ROLES`.

---

## Plan Limits & Feature Gates

Plan limits are enforced via `tenant.plan_limits` (a `PlanLimits` dataclass keyed by `organization.plan`).

```python
# Enforce before creating a resource
await enforce_member_limit(tenant, db)  # checks current count vs plan max

# Check a feature flag before using it
enforce_feature(tenant, "has_ai_features")  # raises 402 if plan lacks the feature
```

**Current plan limits (example — free tier):**

| Limit | Free | Pro | Enterprise |
|---|---|---|---|
| `max_members` | 5 | 25 | -1 (unlimited) |
| `max_teams` | 3 | 20 | -1 |
| `max_projects` | 5 | 50 | -1 |
| `max_tasks_per_month` | 100 | 1000 | -1 |
| `has_ai_features` | false | true | true |
| `has_integrations` | false | true | true |
| `storage_gb` | 1 | 10 | 100 |

Usage is exposed to the frontend via `GET /organizations/current/usage`.

---

## Frontend Routing & Guards

### Route map

```
Public (no auth required):
  /login
  /register
  /forgot-password

Auth required, no org context required:
  /setup/organization   ←── first-time workspace creation page

Auth + org context required (ProtectedRoute):
  /dashboard
  /profile
  /users
  /teams, /teams/:teamId
  /projects, /projects/:projectId
  /tasks
  /integrations
  /organization
```

### `ProtectedRoute` guard logic

```jsx
// src/routes/ProtectedRoute.jsx
if (!isAuthenticated)              → <Navigate to="/login" />
if (!hasOrgContext)                → <Navigate to="/setup/organization" />
else                               → <Outlet />   // render the page
```

`hasOrgContext` is derived client-side from the JWT payload:

```js
// src/context/AuthContext.jsx
const jwtPayload = parseJwt(accessToken);
const hasOrgContext = Boolean(jwtPayload?.org_id);
```

This means any token issued without an `org_id` claim (e.g., post-registration before workspace creation) automatically triggers the workspace-setup redirect on every protected page attempt.

### Frontend permission checks

UI elements are gated by `user.role` (which always reflects the active org's role per the API contract):

```js
// Sidebar, pages
const canManageUsers    = user?.role === "owner" || user?.role === "admin" || user?.role === "team_manager";
const canManageTeams    = user?.role === "owner" || user?.role === "admin";
const canManageProjects = user?.role === "owner" || user?.role === "admin" || user?.role === "team_manager";
const isTeamMember      = user?.role === "team_member";
```

---

## Invitation System

### Flow

```
Admin sends invite
  POST /organizations/current/members/invite
  └─ validate: not already a member, plan member limit not reached
  └─ generate secure 128-char token
  └─ create OrganizationInvitation (expires in 72h)
  └─ send invitation email with link containing token

Invitee clicks link (existing user)
  POST /auth/accept-invitation  { token: "..." }
  └─ verify token: not expired, not already accepted
  └─ add to OrganizationMembership with invitation.role
  └─ mark invitation accepted_at = now()
  └─ issue org-scoped TokenResponse → user is now in that workspace

Invitee clicks link (new user)
  → registers normally
  → after /register/verify-otp, redirected to /setup/organization
     (or can accept invitation first via the link flow)
```

### Invitation states

| State | Condition |
|---|---|
| Pending | `accepted_at IS NULL` AND `expires_at > now()` |
| Accepted | `accepted_at IS NOT NULL` |
| Expired | `expires_at <= now()` AND `accepted_at IS NULL` |

---

## Multi-Org Support

A user may belong to multiple workspaces simultaneously with different roles in each.

### Workspace switching

```
POST /auth/select-organization/{org_id}
  └─ validates user is active member of target org
  └─ issues new access token with that org's org_id + org_role
  └─ previous token is NOT revoked (both remain valid until expiry)
  └─ returns TokenResponse — frontend calls loginWithToken() to swap context
```

The frontend `GET /auth/my-organizations` returns all workspaces the user belongs to, with their role in each:

```json
{
  "organizations": [
    { "id": "uuid-1", "name": "Acme Corp", "slug": "acme-corp", "plan": "pro",  "role": "owner" },
    { "id": "uuid-2", "name": "Side Project", "slug": "side-proj", "plan": "free", "role": "member" }
  ]
}
```

---

## Security Considerations

### Token revocation

- Access tokens are short-lived (1 hour by default). JTIs are stored in Redis; logout immediately blacklists the JTI.
- Refresh tokens are hashed before storage. `logout_all_devices=true` revokes all refresh tokens for that user.

### Membership changes take effect immediately

`get_tenant_context()` re-queries the database on every request. If a membership is deactivated (member removed), the user's next request returns `403 NOT_ORG_MEMBER` — even if their access token is still valid.

### Owner protections

- `DELETE /organizations/current/members/{user_id}` — cannot remove the org owner
- `PUT /organizations/current/members/{user_id}/role` — cannot demote the org owner
- `DELETE /users/{user_id}` — cannot delete yourself (`_CANNOT_DELETE_SELF` guard)

### Slug uniqueness

Organization slugs are globally unique. Slug availability is checked before creation to prevent enumeration conflicts.

### Rate limiting

Registration, login, and OTP verification endpoints are rate-limited per IP to prevent brute-force and OTP enumeration attacks.

---

## Repository

| Component | Location |
|---|---|
| Org role constants | `app/core/org_roles.py` |
| Tenant context + dependencies | `app/core/tenant.py` |
| Auth routes | `app/api/routes/auth.py` |
| Org management routes | `app/api/routes/organizations.py` |
| Org data models | `app/models/organization.py` |
| Org repository | `app/repositories/organization_repository.py` |
| Org schemas | `app/schemas/organization.py` |
| Frontend auth context | `frontend/src/context/AuthContext.jsx` |
| Frontend route guards | `frontend/src/routes/ProtectedRoute.jsx` |
| Workspace setup page | `frontend/src/pages/OrganizationSetupPage.jsx` |
| Database schema | `backend/alembic/versions/8f3a4e4936ab_init.py` |
