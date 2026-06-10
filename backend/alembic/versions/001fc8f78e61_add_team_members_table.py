"""add team members table

Revision ID: 001fc8f78e61
Revises: 0001_initial_schema
Create Date: 2026-04-28 19:48:37.931692
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '001fc8f78e61'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass