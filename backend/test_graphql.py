"""CLI for validating the PSIP Fabric GraphQL connection."""

from __future__ import annotations

import json
import logging

from dotenv import load_dotenv

from fabric_service import FabricPsipService


def main() -> None:
    load_dotenv()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    dashboard = FabricPsipService.from_environment().get_dashboard()
    print(
        json.dumps(
            {
                "generatedAt": dashboard.generated_at,
                "snapshotDate": dashboard.snapshot_date,
                "summary": dashboard.summary.model_dump(by_alias=True),
                "recordsReturned": len(dashboard.records),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
