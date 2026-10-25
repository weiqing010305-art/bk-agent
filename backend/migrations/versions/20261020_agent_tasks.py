"""Durable conversation tasks and isolated payment credentials."""
from alembic import op
import sqlalchemy as sa

revision = "20261020_agent"
down_revision = "20260927_favorites"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("operations", sa.Column("auth_method", sa.String(24), nullable=False, server_default="code"))
    op.create_table("agent_tasks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("session_id", sa.String(64), sa.ForeignKey("sessions.id"), nullable=False, index=True),
        sa.Column("conversation_id", sa.String(36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("state", sa.JSON(), nullable=False),
        sa.Column("last_request", sa.String(36)),
        sa.Column("last_digest", sa.String(64)),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("session_id", "conversation_id", name="agent_conversation"))
    op.create_table("payment_credentials",
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("salt", sa.String(64), nullable=False),
        sa.Column("digest", sa.String(128), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_table("payment_credentials")
    op.drop_table("agent_tasks")
    op.drop_column("operations", "auth_method")
