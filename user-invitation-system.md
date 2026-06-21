# User Invitation & Ownership Management System

A complete design and implementation reference for a multi-tenant SaaS invitation
system supporting four roles: **Owner**, **Admin**, **Team Manager**, and **Team Member**.

---

## Table of Contents

1. [Overview & Core Concepts](#1-overview--core-concepts)
2. [Database Schema](#2-database-schema)
3. [Role & Permission Model](#3-role--permission-model)
4. [Invitation API](#4-invitation-api)
5. [Signup Flow (Invited vs Normal)](#5-signup-flow-invited-vs-normal)
6. [Ownership Transfer](#6-ownership-transfer)
7. [Email Templates](#7-email-templates)
8. [Frontend Flow](#8-frontend-flow)
9. [Security Checklist](#9-security-checklist)
10. [Edge Cases Reference](#10-edge-cases-reference)

---

## 1. Overview & Core Concepts

### Entity Relationships

```
users            -- global user accounts (email, password, etc.) — NOT tenant-scoped
tenants          -- organizations / companies (the "SaaS account")
teams            -- sub-groups within a tenant
tenant_users     -- join table: links a user to a tenant with a role (+ optional team)
invitations      -- pending/accepted/revoked invite records
ownership_transfers -- pending ownership change requests
```

**Key principle:** A `user` is a global identity. A `tenant` is an organization.
A user is connected to a tenant only through `tenant_users`. This means:

- One user can belong to **multiple tenants** with different roles in each.
- Inviting someone never "creates" a user inside a tenant — it creates a
  `tenant_users` row linking an existing or newly-created user to that tenant.

---

## 2. Database Schema

```sql
-- ============================================
-- Core tenancy tables (assumed to already exist)
-- ============================================
-- tenants(id, name, status, ...)
-- users(id, email, name, password_hash, email_verified, ...)
-- teams(id, tenant_id, name, ...)
-- tenant_users(tenant_id, user_id, role, team_id, status, ...)

-- ============================================
-- Invitations
-- ============================================
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin','team_manager','team_member')),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    invited_by UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','accepted','revoked','expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Only one PENDING invite per (tenant, email)
    CONSTRAINT uniq_pending_invite UNIQUE (tenant_id, email, status)
);

CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_tenant ON invitations(tenant_id);
CREATE INDEX idx_invitations_token_hash ON invitations(token_hash);

-- ============================================
-- Ownership Transfers
-- ============================================
CREATE TABLE ownership_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    current_owner_id UUID NOT NULL REFERENCES users(id),
    new_owner_id UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','accepted','rejected','cancelled','expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_ownership_transfers_tenant ON ownership_transfers(tenant_id);
```

### Notes

- **Never store raw invitation tokens** — store only a SHA-256 hash. The raw
  token only ever exists in the email link.
- The `uniq_pending_invite` constraint relies on Postgres allowing multiple
  rows with the same `(tenant_id, email)` as long as `status` differs — so
  re-inviting after expiry/revocation is fine, but two simultaneous `pending`
  rows for the same email are blocked.

---

## 3. Role & Permission Model

### 3.1 Invitation Permission Matrix

| Inviter Role | Can Invite As | Team Scope |
|---|---|---|
| **Owner** | Admin, Team Manager, Team Member | Any team |
| **Admin** | Admin, Team Manager, Team Member | Any team |
| **Team Manager** | Team Manager, Team Member | **Only their own team** |
| **Team Member** | — (cannot invite) | — |

> **Note:** Nobody can invite a new **Owner** directly. Ownership changes
> only happen via the [Ownership Transfer](#6-ownership-transfer) flow — this
> guarantees a tenant never accidentally ends up with two owners.

### 3.2 Permission Code

```javascript
const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  team_manager: 2,
  team_member: 1,
};

const INVITE_PERMISSIONS = {
  owner:        ['admin', 'team_manager', 'team_member'],
  admin:        ['admin', 'team_manager', 'team_member'],
  team_manager: ['team_manager', 'team_member'],
  team_member:  [], // cannot invite anyone
};

/**
 * @param inviterRole    role of the person sending the invite
 * @param targetRole     role being granted to the invitee
 * @param inviterTeamId  team the inviter belongs to (null for owner/admin)
 * @param targetTeamId   team the invite assigns the invitee to (if any)
 */
function canInvite(inviterRole, targetRole, inviterTeamId, targetTeamId) {
  const allowedRoles = INVITE_PERMISSIONS[inviterRole] || [];
  if (!allowedRoles.includes(targetRole)) return false;

  // Team managers are scoped strictly to their own team
  if (inviterRole === 'team_manager') {
    if (!inviterTeamId || !targetTeamId) return false;
    return inviterTeamId === targetTeamId;
  }

  // owner/admin can invite to any team (or no team, for admin role)
  return true;
}
```

### 3.3 Role / Team Validation Rules

| Role | Requires `team_id`? |
|---|---|
| Owner | No |
| Admin | No (org-wide role) |
| Team Manager | **Yes** |
| Team Member | **Yes** |

### 3.4 Invariant: Exactly One Owner Per Tenant

Enforce everywhere roles can change (remove member, change role, etc.):

```javascript
async function ensureNotLastOwner(tenantId, userId, tx) {
  const member = await tx.query(
    `SELECT role FROM tenant_users WHERE tenant_id = $1 AND user_id = $2`,
    [tenantId, userId]
  );

  if (member.rows[0]?.role === 'owner') {
    throw new ApiError(400, 'Cannot remove or demote the tenant owner. Transfer ownership first.');
  }
}
```

---

## 4. Invitation API

### 4.1 Create Invitation

```
POST /api/v1/tenants/:tenantId/invitations
Body: { email, role, teamId? }
```

```javascript
async function createInvitation(req, res) {
  const { email, role, teamId } = req.body;
  const inviter = req.user;
  const tenantId = req.params.tenantId;

  // 1. Authorization
  if (!canInvite(inviter.role, role, inviter.teamId, teamId)) {
    return res.status(403).json({ error: 'Insufficient permissions to invite this role' });
  }

  // 2. Role / team validation
  if (['team_manager', 'team_member'].includes(role) && !teamId) {
    return res.status(400).json({ error: 'teamId is required for team_manager and team_member roles' });
  }
  if (role === 'admin' && teamId) {
    return res.status(400).json({ error: 'Admins are not assigned to a specific team' });
  }

  // 3. Team managers can only target their own team (defense in depth)
  if (inviter.role === 'team_manager' && teamId !== inviter.teamId) {
    return res.status(403).json({ error: 'Team managers can only invite to their own team' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // 4. Already a member of this tenant?
  const existingMembership = await db.query(
    `SELECT tu.* FROM tenant_users tu
     JOIN users u ON u.id = tu.user_id
     WHERE tu.tenant_id = $1 AND u.email = $2 AND tu.status = 'active'`,
    [tenantId, normalizedEmail]
  );
  if (existingMembership.rows.length) {
    return res.status(409).json({ error: 'User is already a member of this tenant' });
  }

  // 5. Existing pending invite?
  const existingInvite = await db.query(
    `SELECT * FROM invitations WHERE tenant_id = $1 AND email = $2 AND status = 'pending'`,
    [tenantId, normalizedEmail]
  );
  if (existingInvite.rows.length) {
    return res.status(409).json({ error: 'An invitation is already pending for this email' });
  }

  // 6. Generate secure token (raw -> email, hash -> DB)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await db.query(
    `INSERT INTO invitations (tenant_id, email, role, team_id, invited_by, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [tenantId, normalizedEmail, role, teamId || null, inviter.id, tokenHash, expiresAt]
  );

  // 7. Send email asynchronously (queue it — don't block the response)
  await sendInvitationEmail({
    email: normalizedEmail,
    tenantName: req.tenant.name,
    inviterName: inviter.name,
    role,
    token: rawToken,
  });

  return res.status(201).json({ id: invitation.rows[0].id, status: 'pending' });
}
```

### 4.2 Preview Invitation (Public)

```
GET /api/v1/invitations/:token
```

```javascript
async function getInvitationDetails(req, res) {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const result = await db.query(
    `SELECT i.*, t.name as tenant_name
     FROM invitations i
     JOIN tenants t ON t.id = i.tenant_id
     WHERE i.token_hash = $1`,
    [tokenHash]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Invalid invitation link' });
  }

  const invite = result.rows[0];

  if (invite.status !== 'pending') {
    return res.status(410).json({ error: `Invitation already ${invite.status}` });
  }

  if (new Date(invite.expires_at) < new Date()) {
    await db.query(`UPDATE invitations SET status = 'expired' WHERE id = $1`, [invite.id]);
    return res.status(410).json({ error: 'Invitation has expired' });
  }

  // Tell the frontend whether this email already has an account
  const existingUser = await db.query(`SELECT id FROM users WHERE email = $1`, [invite.email]);

  return res.json({
    email: invite.email,
    role: invite.role,
    tenantName: invite.tenant_name,
    requiresSignup: existingUser.rows.length === 0,
  });
}
```

### 4.3 Accept Invitation (Existing Logged-in User)

```
POST /api/v1/invitations/:token/accept
```

```javascript
async function acceptInvitation(req, res) {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

  return await db.transaction(async (tx) => {
    const result = await tx.query(
      `SELECT * FROM invitations WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash]
    );
    if (!result.rows.length) throw new ApiError(404, 'Invalid invitation');

    const invite = result.rows[0];
    if (invite.status !== 'pending') throw new ApiError(410, `Invitation ${invite.status}`);
    if (new Date(invite.expires_at) < new Date()) throw new ApiError(410, 'Invitation expired');

    // Caller must be authenticated and match the invited email
    if (!req.user) throw new ApiError(401, 'Login required to accept this invitation');
    if (req.user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ApiError(403, 'This invitation was sent to a different email address');
    }

    // Already a member? (idempotency)
    const existingMembership = await tx.query(
      `SELECT * FROM tenant_users WHERE tenant_id = $1 AND user_id = $2`,
      [invite.tenant_id, req.user.id]
    );
    if (!existingMembership.rows.length) {
      await tx.query(
        `INSERT INTO tenant_users (tenant_id, user_id, role, team_id, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [invite.tenant_id, req.user.id, invite.role, invite.team_id]
      );
    }

    await tx.query(
      `UPDATE invitations SET status = 'accepted', accepted_at = now() WHERE id = $1`,
      [invite.id]
    );

    const authToken = generateJWT({ userId: req.user.id, tenantId: invite.tenant_id, role: invite.role });
    return res.json({ token: authToken, tenantId: invite.tenant_id, role: invite.role });
  });
}
```

### 4.4 Management Endpoints

```javascript
// List pending invitations for a tenant
// GET /api/v1/tenants/:tenantId/invitations
async function listInvitations(req, res) {
  const result = await db.query(
    `SELECT id, email, role, team_id, status, expires_at, created_at
     FROM invitations
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [req.params.tenantId]
  );
  return res.json(result.rows);
}

// Revoke a pending invitation
// DELETE /api/v1/tenants/:tenantId/invitations/:id
async function revokeInvitation(req, res) {
  const result = await db.query(
    `UPDATE invitations SET status = 'revoked'
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
     RETURNING id`,
    [req.params.id, req.params.tenantId]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'No pending invitation found' });
  return res.status(204).send();
}

// Resend (regenerate token + extend expiry, with cooldown)
// POST /api/v1/tenants/:tenantId/invitations/:id/resend
async function resendInvitation(req, res) {
  const invite = await db.query(
    `SELECT * FROM invitations WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
    [req.params.id, req.params.tenantId]
  );
  if (!invite.rows.length) return res.status(404).json({ error: 'No pending invitation found' });

  const row = invite.rows[0];

  // Cooldown: prevent resend spam
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  if (new Date(row.updated_at) > oneMinuteAgo) {
    return res.status(429).json({ error: 'Please wait before resending this invitation' });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.query(
    `UPDATE invitations SET token_hash = $1, expires_at = $2, updated_at = now() WHERE id = $3`,
    [tokenHash, expiresAt, row.id]
  );

  await sendInvitationEmail({
    email: row.email,
    tenantName: req.tenant.name,
    inviterName: req.user.name,
    role: row.role,
    token: rawToken,
  });

  return res.json({ message: 'Invitation resent' });
}
```

### 4.5 Endpoint Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/tenants/:tenantId/invitations` | Owner/Admin/Team Manager | Create invite |
| `GET` | `/tenants/:tenantId/invitations` | Owner/Admin/Team Manager | List invites |
| `GET` | `/invitations/:token` | Public | Preview invite |
| `POST` | `/invitations/:token/accept` | Authenticated | Accept (existing user) |
| `DELETE` | `/tenants/:tenantId/invitations/:id` | Owner/Admin/Team Manager | Revoke invite |
| `POST` | `/tenants/:tenantId/invitations/:id/resend` | Owner/Admin/Team Manager | Resend invite |

---

## 5. Signup Flow (Invited vs Normal)

A critical design decision: **invited users must skip the "create your
organization" onboarding wizard** and join the existing tenant directly.

```
Normal signup (no invite token)
  → Create user
  → Create new tenant
  → Make user the OWNER of that tenant
  → Run org setup wizard (company name, billing, etc.)

Invited signup (has invite token)
  → Create user
  → Skip tenant creation entirely
  → Attach user to the EXISTING tenant from the invitation
  → Apply the role/team from the invitation
  → Skip org setup wizard — go straight to dashboard
```

### 5.1 Unified Signup Endpoint

```javascript
async function signup(req, res) {
  const { name, email, password, inviteToken } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  return await db.transaction(async (tx) => {
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await tx.query(
      `INSERT INTO users (email, name, password_hash, email_verified)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [normalizedEmail, name, hashedPassword, !!inviteToken] // email pre-verified via invite link
    );
    const userId = user.rows[0].id;

    if (inviteToken) {
      // ===== INVITED USER PATH =====
      const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
      const invite = await tx.query(
        `SELECT * FROM invitations WHERE token_hash = $1 AND status = 'pending' FOR UPDATE`,
        [tokenHash]
      );
      if (!invite.rows.length) throw new ApiError(400, 'Invalid or expired invitation');

      const inv = invite.rows[0];
      if (inv.email.toLowerCase() !== normalizedEmail) {
        throw new ApiError(400, 'Email does not match invitation');
      }
      if (new Date(inv.expires_at) < new Date()) {
        throw new ApiError(410, 'Invitation expired');
      }

      await tx.query(
        `INSERT INTO tenant_users (tenant_id, user_id, role, team_id, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [inv.tenant_id, userId, inv.role, inv.team_id]
      );

      await tx.query(
        `UPDATE invitations SET status = 'accepted', accepted_at = now() WHERE id = $1`,
        [inv.id]
      );

      const authToken = generateJWT({ userId, tenantId: inv.tenant_id, role: inv.role });
      return res.json({
        token: authToken,
        tenantId: inv.tenant_id,
        role: inv.role,
        onboarding: 'skip', // frontend: go directly to dashboard
      });

    } else {
      // ===== NORMAL SIGNUP PATH =====
      const tenant = await tx.query(
        `INSERT INTO tenants (name, status) VALUES ($1, 'pending_setup') RETURNING id`,
        [`${name}'s Organization`]
      );
      const tenantId = tenant.rows[0].id;

      await tx.query(
        `INSERT INTO tenant_users (tenant_id, user_id, role, status)
         VALUES ($1, $2, 'owner', 'active')`,
        [tenantId, userId]
      );

      const authToken = generateJWT({ userId, tenantId, role: 'owner' });
      return res.json({
        token: authToken,
        tenantId,
        role: 'owner',
        onboarding: 'org_setup', // frontend: show company setup wizard
      });
    }
  });
}
```

### 5.2 Existing User Accepting an Invitation

If the invited email **already has an account** (e.g., a contractor who owns
their own tenant elsewhere and is now invited to a client's tenant):

1. They log in normally (not via the signup endpoint).
2. Frontend calls `POST /invitations/:token/accept` (see [4.3](#43-accept-invitation-existing-logged-in-user)).
3. A new `tenant_users` row links their existing `user_id` to the new
   `tenant_id` — **no new user is created**.
4. The user now belongs to multiple tenants and needs **tenant switching**.

```javascript
// POST /api/v1/auth/switch-tenant
async function switchTenant(req, res) {
  const { tenantId } = req.body;

  const membership = await db.query(
    `SELECT role, team_id FROM tenant_users
     WHERE user_id = $1 AND tenant_id = $2 AND status = 'active'`,
    [req.user.id, tenantId]
  );
  if (!membership.rows.length) throw new ApiError(403, 'Not a member of this tenant');

  const { role, team_id } = membership.rows[0];
  const newToken = generateJWT({ userId: req.user.id, tenantId, role, teamId: team_id });
  return res.json({ token: newToken });
}
```

### 5.3 Frontend Routing After Signup/Accept

```javascript
const response = await signup(formData);

if (response.onboarding === 'org_setup') {
  router.push('/onboarding/company-setup'); // new tenant owner sets up org details
} else {
  router.push('/dashboard'); // invited user goes straight in
}
```

---

## 6. Ownership Transfer

Transferring ownership is a high-stakes action. It uses a **two-step
request/accept flow** with re-authentication, so ownership never changes
without explicit consent from both parties.

### 6.1 Flow Diagram

```
Owner (re-auth with password)
   │
   ▼
POST /tenants/:id/ownership-transfer  ──► creates pending ownership_transfers row
   │                                       sends email to target user
   ▼
Target user clicks link
   │
   ├─► Accept ──► ATOMIC SWAP:
   │               - old owner role -> admin
   │               - target role    -> owner
   │               - transfer marked 'accepted'
   │
   └─► Reject ──► transfer marked 'rejected', owner notified
```

### 6.2 Step 1 — Owner Initiates Transfer

```
POST /api/v1/tenants/:tenantId/ownership-transfer
Body: { newOwnerId, password }
```

```javascript
async function initiateOwnershipTransfer(req, res) {
  const { newOwnerId, password } = req.body;
  const tenantId = req.params.tenantId;
  const currentOwner = req.user;

  if (currentOwner.role !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can transfer ownership' });
  }

  // Re-authentication
  const validPassword = await bcrypt.compare(password, currentOwner.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  if (newOwnerId === currentOwner.id) {
    return res.status(400).json({ error: 'You already own this tenant' });
  }

  // Target must already be an active member of this tenant
  const target = await db.query(
    `SELECT * FROM tenant_users WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'`,
    [tenantId, newOwnerId]
  );
  if (!target.rows.length) {
    return res.status(400).json({ error: 'Target user is not a member of this tenant' });
  }

  // No overlapping pending transfer
  const existing = await db.query(
    `SELECT * FROM ownership_transfers WHERE tenant_id = $1 AND status = 'pending'`,
    [tenantId]
  );
  if (existing.rows.length) {
    return res.status(409).json({ error: 'A pending ownership transfer already exists. Cancel it first.' });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  await db.query(
    `INSERT INTO ownership_transfers (tenant_id, current_owner_id, new_owner_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [tenantId, currentOwner.id, newOwnerId, tokenHash, expiresAt]
  );

  await sendOwnershipTransferEmail({
    toUserId: newOwnerId,
    tenantName: req.tenant.name,
    fromUserName: currentOwner.name,
    token: rawToken,
  });

  return res.status(201).json({
    status: 'pending',
    message: 'Transfer request sent to the new owner for confirmation',
  });
}
```

### 6.3 Step 2 — Target User Accepts or Rejects

```
GET  /api/v1/ownership-transfers/:token
POST /api/v1/ownership-transfers/:token/accept
POST /api/v1/ownership-transfers/:token/reject
```

```javascript
async function acceptOwnershipTransfer(req, res) {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

  return await db.transaction(async (tx) => {
    const result = await tx.query(
      `SELECT * FROM ownership_transfers WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash]
    );
    if (!result.rows.length) throw new ApiError(404, 'Invalid transfer link');

    const transfer = result.rows[0];
    if (transfer.status !== 'pending') throw new ApiError(410, `Transfer already ${transfer.status}`);

    if (new Date(transfer.expires_at) < new Date()) {
      await tx.query(`UPDATE ownership_transfers SET status = 'expired' WHERE id = $1`, [transfer.id]);
      throw new ApiError(410, 'Transfer request expired');
    }

    if (req.user.id !== transfer.new_owner_id) {
      throw new ApiError(403, 'This transfer is not addressed to your account');
    }

    // ===== ATOMIC ROLE SWAP =====
    await tx.query(
      `UPDATE tenant_users SET role = 'admin' WHERE tenant_id = $1 AND user_id = $2`,
      [transfer.tenant_id, transfer.current_owner_id]
    );
    await tx.query(
      `UPDATE tenant_users SET role = 'owner' WHERE tenant_id = $1 AND user_id = $2`,
      [transfer.tenant_id, transfer.new_owner_id]
    );

    await tx.query(
      `UPDATE ownership_transfers SET status = 'accepted', resolved_at = now() WHERE id = $1`,
      [transfer.id]
    );

    await notifyOwnershipTransferred(transfer.tenant_id, transfer.current_owner_id, transfer.new_owner_id);

    return res.json({ message: 'Ownership transferred successfully', newRole: 'owner' });
  });
}

async function rejectOwnershipTransfer(req, res) {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const result = await db.query(
    `UPDATE ownership_transfers
     SET status = 'rejected', resolved_at = now()
     WHERE token_hash = $1 AND status = 'pending' AND new_owner_id = $2
     RETURNING tenant_id, current_owner_id`,
    [tokenHash, req.user.id]
  );

  if (!result.rows.length) return res.status(404).json({ error: 'Invalid or already-resolved transfer' });

  await notifyTransferRejected(result.rows[0].current_owner_id);
  return res.json({ message: 'Transfer rejected' });
}
```

### 6.4 Cancel Pending Transfer

```javascript
// POST /api/v1/tenants/:tenantId/ownership-transfer/cancel
async function cancelOwnershipTransfer(req, res) {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can cancel a transfer' });
  }

  const result = await db.query(
    `UPDATE ownership_transfers
     SET status = 'cancelled', resolved_at = now()
     WHERE tenant_id = $1 AND current_owner_id = $2 AND status = 'pending'
     RETURNING id`,
    [req.params.tenantId, req.user.id]
  );

  if (!result.rows.length) return res.status(404).json({ error: 'No pending transfer found' });
  return res.status(204).send();
}
```

### 6.5 Side Effects Checklist

| Concern | Action |
|---|---|
| Billing/subscription owner | Update billing contact email in Stripe/etc. |
| Audit log | Record who/when/from/to for compliance |
| JWT/session invalidation | Old owner's existing JWT may still say `role: owner` until refresh — use short-lived tokens or a `role_version` check |
| Old owner's new role | Becomes `admin` — broad access, but no billing/delete-tenant/transfer rights |
| Last-owner guard | `ensureNotLastOwner()` (see [3.4](#34-invariant-exactly-one-owner-per-tenant)) prevents removing/demoting the only owner |

---

## 7. Email Templates

```javascript
async function sendInvitationEmail({ email, tenantName, inviterName, role, token }) {
  const inviteUrl = `${process.env.APP_URL}/invite/${token}`;

  await emailQueue.add('send-invitation', {
    to: email,
    subject: `${inviterName} invited you to join ${tenantName}`,
    template: 'invitation',
    data: {
      tenantName,
      inviterName,
      roleLabel: formatRoleLabel(role), // e.g. "Team Manager"
      inviteUrl,
      expiresInDays: 7,
    },
  });
}

async function sendOwnershipTransferEmail({ toUserId, tenantName, fromUserName, token }) {
  const transferUrl = `${process.env.APP_URL}/ownership-transfer/${token}`;
  const targetUser = await db.query(`SELECT email, name FROM users WHERE id = $1`, [toUserId]);

  await emailQueue.add('send-ownership-transfer', {
    to: targetUser.rows[0].email,
    subject: `${fromUserName} wants to transfer ownership of ${tenantName} to you`,
    template: 'ownership-transfer',
    data: {
      tenantName,
      fromUserName,
      transferUrl,
      expiresInHours: 48,
    },
  });
}
```

> Always send emails via a **queue** (BullMQ, SQS, etc.) — never block the
> API response on SMTP latency.

---

## 8. Frontend Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Owner/Admin/Team Manager clicks "Invite Member"            │
│    → fills email, selects role (+ team if applicable)        │
│    → frontend hides roles the inviter isn't allowed to grant  │
└────────────────────────┬────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Backend validates & creates invitation, queues email       │
└────────────────────────┬────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Recipient clicks email link → GET /invitations/:token      │
│    ├─ Invalid/expired → show error page                       │
│    ├─ requiresSignup = true  → show signup form                │
│    │     (email pre-filled & read-only)                       │
│    │     → POST /api/v1/auth/signup { ...,  inviteToken }      │
│    └─ requiresSignup = false → "Log in to accept"              │
│          → after login: POST /invitations/:token/accept        │
└────────────────────────┬────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Success → redirect to tenant dashboard with assigned role   │
│    (onboarding === 'skip' for invited users — no org wizard)  │
└─────────────────────────────────────────────────────────────┘
```

### Ownership Transfer (Owner UI)

```
Settings → Members → [Select member] → "Transfer Ownership"
   → Modal: confirm target + re-enter password
   → POST /tenants/:id/ownership-transfer
   → Show "Pending confirmation from {name}" banner
   → Target receives email → accepts/rejects
   → Owner sees toast notification of the result
```

---

## 9. Security Checklist

- [ ] Invitation tokens are **256-bit random**, **hashed (SHA-256)** before storage.
- [ ] Tokens are **single-use** — status flips to `accepted`/`revoked`/`expired`.
- [ ] Invitation expiry: **7 days** (configurable). Ownership transfer: **48 hours**.
- [ ] All emails normalized to **lowercase** before storage/comparison.
- [ ] Rate-limit invite creation per tenant (e.g., 50/day) to prevent abuse.
- [ ] Resend has a **cooldown** (e.g., 1 minute) to prevent spam.
- [ ] `canInvite()` checked server-side on every create — never trust frontend role filtering alone.
- [ ] Team Managers' `teamId` is taken from **their own session**, not from request body, for the authorization check (defense in depth).
- [ ] Ownership transfer requires **password re-authentication**.
- [ ] No invite can grant the `owner` role — only the transfer flow can.
- [ ] `ensureNotLastOwner()` enforced on remove-member and change-role endpoints.
- [ ] Audit log entries for: invite created/revoked/accepted, ownership transferred.

---

## 10. Edge Cases Reference

| Scenario | Handling |
|---|---|
| User invited to multiple tenants | `tenant_users` allows many rows per user — each invite just adds one row to a different tenant |
| Invited email already has an account | `requiresSignup: false` → user logs in, then `POST /invitations/:token/accept` |
| Invite sent, then role changed before acceptance | Resend regenerates token + can update role; old token becomes invalid |
| Invite expires | Lazily marked `expired` on access, or via scheduled cron job |
| Inviting an existing tenant member | Blocked at creation (step 4 in [4.1](#41-create-invitation)) |
| Self-invite | Blocked — `existingMembership` check catches this |
| Team Manager tries to invite outside their team | Blocked — `canInvite()` + server-side `teamId` check |
| Anyone tries to invite an "owner" | Blocked — `owner` not in any `INVITE_PERMISSIONS` list |
| Owner tries to transfer to a non-member | Blocked — target must be an active `tenant_users` row |
| Two simultaneous ownership transfers | Blocked — only one `pending` transfer per tenant |
| Last owner tries to leave/be removed | Blocked by `ensureNotLastOwner()` — must transfer ownership first |
| Bulk invites | Accept an array of `{email, role, teamId}`, validate each independently, return per-row success/failure |

---

## Appendix: Quick Reference — Complete Endpoint List

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/tenants/:tenantId/invitations` | Create invitation |
| `GET` | `/tenants/:tenantId/invitations` | List invitations |
| `DELETE` | `/tenants/:tenantId/invitations/:id` | Revoke invitation |
| `POST` | `/tenants/:tenantId/invitations/:id/resend` | Resend invitation |
| `GET` | `/invitations/:token` | Preview invitation (public) |
| `POST` | `/invitations/:token/accept` | Accept (existing user) |
| `POST` | `/auth/signup` | Signup (handles invited + normal paths) |
| `POST` | `/auth/switch-tenant` | Switch active tenant context |
| `POST` | `/tenants/:tenantId/ownership-transfer` | Initiate ownership transfer |
| `POST` | `/tenants/:tenantId/ownership-transfer/cancel` | Cancel pending transfer |
| `GET` | `/ownership-transfers/:token` | Preview transfer (public) |
| `POST` | `/ownership-transfers/:token/accept` | Accept transfer |
| `POST` | `/ownership-transfers/:token/reject` | Reject transfer |
