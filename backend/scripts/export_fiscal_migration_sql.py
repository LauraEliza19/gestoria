"""Export SQL for the optional PGlite smoke test; no database connection."""

import sys
from pathlib import Path

from alembic.config import Config

from alembic import command

output = Path(sys.argv[1])
output.mkdir(parents=True, exist_ok=True)
for name, target, downgrade in [
    ("before.sql", "0005_fiscal_documents", False),
    ("upgrade.sql", "0005_fiscal_documents:0006_fiscal_integrity", False),
    ("downgrade.sql", "0006_fiscal_integrity:0005_fiscal_documents", True),
]:
    with (output / name).open("w", encoding="utf-8") as stream:
        config = Config("alembic.ini", output_buffer=stream)
        (command.downgrade if downgrade else command.upgrade)(config, target, sql=True)
