"""add notifications and task review workflow

Revision ID: 5d61243658a7
Revises: 9352d50dd334
Create Date: 2026-05-05 18:01:29.460098
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5d61243658a7'
down_revision: Union[str, None] = '9352d50dd334'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass