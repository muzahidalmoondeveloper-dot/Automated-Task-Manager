"""add task review and notifications

Revision ID: add_task_review_notifications
Revises: previous_revision_id
Create Date: 2026-05-05
"""

from alembic import op
import sqlalchemy as sa


revision = "add_task_review_notifications"
down_revision = "previous_revision_id"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "tasks",
        sa.Column("completed_by_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("review_note", sa.Text(), nullable=True),
    )

    op.create_foreign_key(
        "fk_tasks_completed_by_id_users",
        "tasks",
        "users",
        ["completed_by_id"],
        ["id"],
    )

    op.create_foreign_key(
        "fk_tasks_reviewed_by_id_users",
        "tasks",
        "users",
        ["reviewed_by_id"],
        ["id"],
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False, server_default="task_review"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
    )

    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_task_id", "notifications", ["task_id"])


def downgrade():
    op.drop_index("ix_notifications_task_id", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")

    op.drop_constraint("fk_tasks_reviewed_by_id_users", "tasks", type_="foreignkey")
    op.drop_constraint("fk_tasks_completed_by_id_users", "tasks", type_="foreignkey")

    op.drop_column("tasks", "review_note")
    op.drop_column("tasks", "reviewed_at")
    op.drop_column("tasks", "reviewed_by_id")
    op.drop_column("tasks", "completed_at")
    op.drop_column("tasks", "completed_by_id")