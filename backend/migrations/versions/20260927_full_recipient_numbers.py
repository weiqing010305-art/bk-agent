"""Expand fictional recipients without resetting balances, ledgers or operation snapshots."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert

revision = "20260927_recipients"
down_revision = "60a9f0ae31d4"
branch_labels = None
depends_on = None

# Frozen migration data: do not import the evolving application seed.
PEOPLE = [
    ("landlord", "房东 · 王女士", "9900000000003821", "6228 •••• 3821"),
    ("zhang", "张三", "9900000000009062", "6217 •••• 9062"),
    ("li", "李四", "9900000000001058", "6222 •••• 1058"),
    ("chen", "陈晨", "9900000000002601", None),
    ("lin", "林悦", "9900000000002602", None),
    ("zhao", "赵宇", "9900000000002603", None),
    ("zhou", "周宁", "9900000000002604", None),
    ("wu", "吴桐", "9900000000002605", None),
    ("sun", "孙萌", "9900000000002606", None),
    ("xu", "徐远", "9900000000002607", None),
]


def upgrade():
    users = sa.table("users", sa.column("id", sa.String))
    recipients = sa.table("recipients", sa.column("user_id", sa.String), sa.column("id", sa.String),
                          sa.column("name", sa.String), sa.column("number", sa.String))
    for id_, name, number, legacy in PEOPLE:
        if legacy:
            op.execute(recipients.update().where(recipients.c.id == id_, recipients.c.number == legacy).values(number=number))
        query = sa.select(users.c.id, sa.literal(id_), sa.literal(name), sa.literal(number))
        op.execute(insert(recipients).from_select(["user_id", "id", "name", "number"], query)
                   .on_conflict_do_nothing(index_elements=["user_id", "id"]))
    op.create_unique_constraint("recipient_number_per_user", "recipients", ["user_id", "number"])


def downgrade():
    # Preserve added people/full numbers; reverting data would invalidate historical references.
    op.drop_constraint("recipient_number_per_user", "recipients", type_="unique")
