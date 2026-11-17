"""Bring a database under Alembic control, whatever state it is in.

Schema used to be created by `Base.metadata.create_all()` on startup. A
database built that way holds all the tables but no `alembic_version` row, so
`alembic upgrade head` tries to CREATE TABLE over tables that exist and fails.
The fix is a one-time `alembic stamp head`, and the failure only shows up on
deploy, against production, at the least convenient moment.

This script looks at the database and does the right thing:

    python -m scripts.bootstrap_migrations          # inspect and act
    python -m scripts.bootstrap_migrations --dry-run  # report only

It is safe to run repeatedly. On an already-managed database it is just
`alembic upgrade head`.
"""

import argparse
import asyncio
import enum
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# One table that only ever existed via create_all or a migration. If this is
# present, the schema predates nothing -- it is a real deployment.
DOMAIN_TABLE = "users"
VERSION_TABLE = "alembic_version"


class Action(str, enum.Enum):
    stamp = "stamp"
    upgrade = "upgrade"


def decide_action(current_revision: str | None, has_domain_tables: bool) -> Action:
    """What to run, given what the database already contains.

    Keyed on the recorded revision, not on whether `alembic_version` exists: a
    failed `alembic upgrade` creates that table and leaves it empty, and
    treating the empty table as "managed" would retry the upgrade and fail the
    same way. The only case needing a stamp is real tables with no revision.
    """
    if current_revision is None and has_domain_tables:
        return Action.stamp
    return Action.upgrade


async def inspect_database(url: str) -> tuple[str | None, bool]:
    """(current_revision, has_domain_tables) for `url`.

    `current_revision` is None when Alembic has recorded nothing -- whether
    because the version table is absent or because it is present but empty.
    """
    from sqlalchemy import inspect as sa_inspect, text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            names = await conn.run_sync(lambda c: sa_inspect(c).get_table_names())
            revision = None
            if VERSION_TABLE in names:
                result = await conn.execute(text(f"SELECT version_num FROM {VERSION_TABLE}"))
                revision = result.scalar_one_or_none()
    finally:
        await engine.dispose()

    return revision, DOMAIN_TABLE in names


def run_alembic(action: Action) -> int:
    from alembic import command
    from alembic.config import Config

    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config = Config(os.path.join(here, "alembic.ini"))
    config.set_main_option("script_location", os.path.join(here, "migrations"))

    if action is Action.stamp:
        command.stamp(config, "head")
        # The stamp only records the baseline; anything after it still applies.
        command.upgrade(config, "head")
    else:
        command.upgrade(config, "head")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report what would happen without changing the database",
    )
    args = parser.parse_args()

    from core.config import settings

    url = settings.DATABASE_URL
    if not url:
        print("DATABASE_URL is not set.", file=sys.stderr)
        return 2

    # Never print the URL: it carries the password.
    target = url.split("@")[-1].split("/")[0] if "@" in url else url.split("://")[0]
    print(f"Inspecting database ({target}) ...")

    revision, has_tables = asyncio.run(inspect_database(url))
    action = decide_action(revision, has_tables)

    print(f"  recorded revision: {revision or 'none'}")
    print(f"  {DOMAIN_TABLE} table: {'present' if has_tables else 'absent'}")

    if action is Action.stamp:
        print(
            "\nThis database predates migrations: it has tables but Alembic has\n"
            "never seen it. Stamping the baseline as applied, then upgrading."
        )
    else:
        print("\nRunning outstanding migrations.")

    if args.dry_run:
        print(f"\n--dry-run: would run 'alembic {action.value}'. Nothing changed.")
        return 0

    run_alembic(action)
    print("\nDone. The database is now at head.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
