"""Create local operation keys without printing them or changing existing keys."""

import argparse
import json
import os
import secrets
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env")
    args = parser.parse_args()
    path = Path(args.env)
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    existing = {}
    for line in text.splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            existing[key.strip()] = value.strip().strip("\"'")
    if existing.get("OPERATION_SIGNING_KEYS"):
        print("As chaves de operações já estão configuradas; arquivo preservado.")
        return
    lines = [
        line
        for line in text.splitlines()
        if not line.startswith(("OPERATION_SIGNING_KEYS=", "OPERATION_ACTIVE_KEY_ID="))
    ]
    keys = json.dumps({"v1": secrets.token_hex(32)}, separators=(",", ":"))
    lines.extend(
        [
            "",
            "# Chaves locais de operações: não publicar nem enviar ao frontend.",
            "OPERATION_ACTIVE_KEY_ID=v1",
            f"OPERATION_SIGNING_KEYS='{keys}'",
        ]
    )
    if "OPERATION_TTL_SECONDS" not in existing:
        lines.append("OPERATION_TTL_SECONDS=300")
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    if os.name != "nt":
        path.chmod(0o600)
    print("Configuração criada. Reinicie a API para carregar as chaves.")


if __name__ == "__main__":
    main()
