from datetime import datetime, timezone
from uuid import uuid4
import json
from pathlib import Path

from .models import Account, Recipient, Transaction, User

DEMO_RECIPIENTS = json.loads((Path(__file__).resolve().parents[1] / "data" / "demo-recipients.json").read_text(encoding="utf-8"))


def seed_user(db):
    user_id = str(uuid4())
    db.add(User(id=user_id, name="林小禾（虚构）"))
    db.flush()
    db.add(Account(user_id=user_id, balance=1286050))
    for person in DEMO_RECIPIENTS:
        db.add(Recipient(user_id=user_id, **person, is_favorite=person['id'] in {'landlord', 'zhang', 'li'}))
    for name, category, amount, date in [
        ("九月工资", "收入", 1500000, "2026-09-10"), ("房租", "转账", -300000, "2026-09-12"),
        ("日常餐饮", "餐饮", -85600, "2026-09-24"), ("生活采购", "购物", -62800, "2026-09-23"),
        ("地铁与打车", "交通", -18600, "2026-09-22"), ("云空间", "订阅", -2900, "2026-09-01"),
        ("光影视频", "订阅", -2500, "2026-09-01"), ("随听音乐", "订阅", -1800, "2026-09-02"),
    ]:
        db.add(Transaction(id=str(uuid4()), user_id=user_id, name=name, category=category,
                           amount=amount, date=date, created_at=datetime.fromisoformat(date).replace(tzinfo=timezone.utc)))
    return user_id
