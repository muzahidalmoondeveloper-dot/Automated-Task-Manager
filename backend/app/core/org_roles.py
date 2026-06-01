ORG_OWNER = "owner"    # full control — billing, delete org, transfer ownership
ORG_ADMIN = "admin"    # manage members, settings, invite/remove
ORG_MEMBER = "member"  # basic workspace access

ORG_MANAGEMENT_ROLES = {ORG_OWNER, ORG_ADMIN}
ALL_ORG_ROLES = {ORG_OWNER, ORG_ADMIN, ORG_MEMBER}

# Human-readable labels used in responses and emails
ORG_ROLE_LABELS: dict[str, str] = {
    ORG_OWNER: "Owner",
    ORG_ADMIN: "Admin",
    ORG_MEMBER: "Member",
}
