"""add notifications and task review workflow

Revision ID: 4fa4503a50f5
Revises: b8dc3c7300ec
Create Date: 2026-05-05 17:53:08.380837
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4fa4503a50f5'
down_revision: Union[str, None] = 'b8dc3c7300ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass