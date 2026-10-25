"""Keep prior tasks when the user explicitly starts another transfer in one chat."""
from alembic import op
import sqlalchemy as sa

revision = "20261021_agent_history"
down_revision = "20261020_agent"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("agent_tasks", sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.drop_constraint("agent_conversation", "agent_tasks", type_="unique")
    op.create_index("agent_current_conversation", "agent_tasks", ["session_id", "conversation_id"],
                    unique=True, postgresql_where=sa.text("is_current"))


def downgrade():
    # Preserve archived records under their own unique reference when reverting this schema.
    op.execute("UPDATE agent_tasks SET conversation_id = id WHERE NOT is_current")
    op.drop_index("agent_current_conversation", table_name="agent_tasks")
    op.create_unique_constraint("agent_conversation", "agent_tasks", ["session_id", "conversation_id"])
    op.drop_column("agent_tasks", "is_current")
