from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session


def paginate(
    db: Session,
    query: Any,
    page: int,
    page_size: int,
    *,
    unique: bool = False,
    scalars: bool = True,
) -> dict[str, Any]:
    total = (
        db.scalar(
            select(func.count()).select_from(query.order_by(None).subquery())
        )
        or 0
    )
    result = db.execute(query.offset((page - 1) * page_size).limit(page_size))
    if scalars:
        items = result.unique().scalars().all() if unique else result.scalars().all()
    else:
        items = result.unique().all() if unique else result.all()
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_next": page * page_size < total,
    }
