"""add notifications and task review workflow

Revision ID: 9352d50dd334
Revises: 4fa4503a50f5
Create Date: 2026-05-05 18:01:18.137151
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9352d50dd334'
down_revision: Union[str, None] = '4fa4503a50f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass