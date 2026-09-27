"""Separate favorite contacts from the fictional bank recipient directory."""
from alembic import op
import sqlalchemy as sa

revision = "20260927_favorites"
down_revision = "20260927_recipients"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('recipients', sa.Column('is_favorite', sa.Boolean(), nullable=False, server_default=sa.false()))
    table = sa.table('recipients', sa.column('id', sa.String), sa.column('is_favorite', sa.Boolean))
    op.execute(table.update().where(table.c.id.in_(['landlord', 'zhang', 'li'])).values(is_favorite=True))


def downgrade():
    op.drop_column('recipients', 'is_favorite')
