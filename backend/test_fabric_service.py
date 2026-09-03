from __future__ import annotations

import unittest
import threading
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import Mock, patch

from fastapi import Response
import main
from main import add_timing_headers

from fabric_service import (
    ENTITY_FIELDS,
    CachedTokenProvider,
    FabricGraphQLClient,
    FabricGraphQLError,
    FabricPsipService,
    _interactive_browser_credential,
)


class FakeClient:
    def __init__(self, dataset):
        self.dataset = dataset

    def fetch_entity(self, entity, fields):
        del fields
        return self.dataset.get(entity, [])


class CountingClient:
    def __init__(self, delay=0.0):
        self.delay = delay
        self.calls = 0
        self.active = 0
        self.max_active = 0
        self.lock = threading.Lock()

    def fetch_entity(self, entity, fields):
        del entity, fields
        with self.lock:
            self.calls += 1
            self.active += 1
            self.max_active = max(self.max_active, self.active)
        time.sleep(self.delay)
        with self.lock:
            self.active -= 1
        return []


class FabricGraphQLClientTests(unittest.TestCase):
    def test_paginates_until_has_next_page_is_false(self):
        credential = Mock()
        credential.get_token.return_value.token = "token"
        credential.get_token.return_value.expires_on = 9_999_999_999
        session = Mock()
        first = Mock()
        first.raise_for_status.return_value = None
        first.json.return_value = {
            "data": {"items": {"items": [{"id": 1}], "hasNextPage": True, "endCursor": "next"}}
        }
        second = Mock()
        second.raise_for_status.return_value = None
        second.json.return_value = {
            "data": {"items": {"items": [{"id": 2}], "hasNextPage": False, "endCursor": None}}
        }
        session.post.side_effect = [first, second]
        client = FabricGraphQLClient(
            "https://example.invalid/graphql", CachedTokenProvider(credential), session=session
        )

        rows = client.fetch_entity("items", ["id"])

        self.assertEqual(rows, [{"id": 1}, {"id": 2}])
        self.assertEqual(session.post.call_count, 2)

    def test_graphql_errors_are_controlled(self):
        credential = Mock()
        credential.get_token.return_value.token = "token"
        credential.get_token.return_value.expires_on = 9_999_999_999
        session = Mock()
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"errors": [{"message": "Bad field"}]}
        session.post.return_value = response
        client = FabricGraphQLClient(
            "https://example.invalid/graphql", CachedTokenProvider(credential), session=session
        )

        with self.assertRaisesRegex(FabricGraphQLError, "Bad field"):
            client.fetch_entity("items", ["id"])


class InteractiveAuthenticationTests(unittest.TestCase):
    def test_first_sign_in_is_saved_and_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            record_path = Path(directory) / "auth-record.json"
            record = Mock()
            record.serialize.return_value = "saved-record"
            first_credential = Mock()
            first_credential.authenticate.return_value = record
            reused_credential = Mock()

            with (
                patch.dict(
                    "os.environ",
                    {"FABRIC_AUTH_RECORD_PATH": str(record_path)},
                    clear=False,
                ),
                patch(
                    "fabric_service.InteractiveBrowserCredential",
                    side_effect=[first_credential, reused_credential],
                ) as credential_factory,
                patch(
                    "fabric_service.AuthenticationRecord.deserialize",
                    return_value=record,
                ) as deserialize,
            ):
                self.assertIs(_interactive_browser_credential(), first_credential)
                self.assertIs(_interactive_browser_credential(), reused_credential)

            first_credential.authenticate.assert_called_once_with(
                scopes=("https://analysis.windows.net/powerbi/api/.default",)
            )
            deserialize.assert_called_once_with("saved-record")
            self.assertEqual(credential_factory.call_count, 2)
            self.assertEqual(record_path.read_text(encoding="utf-8"), "saved-record")


class NormalizationTests(unittest.TestCase):
    def test_preserves_history_and_maps_curated_fields(self):
        dataset = {
            "pSIP_Curateds": [
                {
                    "ProjectSK": 9, "PSIPRefNo": "P-9", "SchoolSK": 3,
                    "SchoolID": "1001", "RegionName": "NCR", "TotalClassrooms": 12,
                    "NoAcademicClassrooms": 10, "NoScienceLabEq2CL": 2,
                    "EffectiveStartDate": "2024-01-01", "EffectiveEndDate": "2024-12-31",
                    "IsCurrent": False,
                },
                {
                    "ProjectSK": 9, "PSIPRefNo": "P-9", "SchoolSK": 3,
                    "SchoolID": "1001", "RegionName": "NCR", "TotalClassrooms": 14,
                    "NoAcademicClassrooms": 12, "NoScienceLabEq2CL": 2,
                    "EffectiveStartDate": "2025-01-01", "IsCurrent": True,
                },
            ],
            "dimSchoolPSIPs": [
                {
                    "SchoolSK": 3, "SchoolID": "1001", "SchoolName": "Sample School",
                    "RegionName": "NCR", "DivisionName": "Quezon City",
                    "Latitude": 14.6, "Longitude": 121.0, "IsCurrent": True,
                }
            ],
            "dimSchools": [
                {
                    "SchoolSK": 3,
                    "SchoolID": "1001",
                    "SchoolName": "Sample School",
                    "municipality": "Sample City",
                    "IsCurrent": True,
                }
            ],
            "dimProjects": [{"ProjectSK": 9, "OperationalReadinessFlag": True}],
        }
        service = FabricPsipService(FakeClient(dataset), cache_seconds=60)

        dashboard = service.get_dashboard()

        self.assertEqual(len(dashboard.records), 2)
        self.assertEqual(dashboard.summary.unique_schools, 1)
        self.assertEqual(dashboard.summary.classrooms, 26)
        self.assertEqual(dashboard.records[0].school_name, "Sample School")
        self.assertEqual(dashboard.records[0].municipality, "Sample City")
        self.assertNotEqual(dashboard.records[0].record_id, dashboard.records[1].record_id)


class DatasetCacheTests(unittest.TestCase):
    def test_entities_are_fetched_in_parallel(self):
        client = CountingClient(delay=0.03)
        service = FabricPsipService(client, cache_seconds=60, fetch_workers=4)

        _, timing = service.get_dashboard_with_timing()

        self.assertEqual(client.calls, len(ENTITY_FIELDS))
        self.assertGreaterEqual(client.max_active, 2)
        self.assertEqual(timing.cache_status, "miss")


class DatasetCacheAndApiTests(unittest.TestCase):
    def test_timing_headers_are_exposed(self):
        response = Response()

        add_timing_headers(response, "hit", 0.0, 12.5)

        self.assertEqual(response.headers["x-psip-cache"], "hit")
        self.assertEqual(
            response.headers["server-timing"],
            "fabric;dur=0.0, normalize;dur=12.5",
        )

    def test_concurrent_first_requests_create_one_service_instance(self):
        previous = main._service_instance
        service = Mock(spec=FabricPsipService)

        def create_service():
            time.sleep(0.03)
            return service

        main._service_instance = None
        try:
            with patch.object(
                main.FabricPsipService,
                "from_environment",
                side_effect=create_service,
            ) as factory:
                with ThreadPoolExecutor(max_workers=6) as executor:
                    services = list(executor.map(lambda _: main.get_service(), range(6)))
            self.assertEqual(factory.call_count, 1)
            self.assertTrue(all(result is service for result in services))
        finally:
            main._service_instance = previous

    def test_concurrent_requests_share_one_dataset_load(self):
        client = CountingClient(delay=0.02)
        service = FabricPsipService(client, cache_seconds=60, fetch_workers=4)

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: service.get_dashboard_with_timing(), range(2)))

        self.assertEqual(client.calls, len(ENTITY_FIELDS))
        self.assertEqual(
            sorted(timing.cache_status for _, timing in results),
            ["hit", "miss"],
        )

    def test_cache_hit_does_not_refetch(self):
        client = CountingClient()
        service = FabricPsipService(client, cache_seconds=60, fetch_workers=4)

        service.get_dashboard()
        _, timing = service.get_dashboard_with_timing()

        self.assertEqual(client.calls, len(ENTITY_FIELDS))
        self.assertEqual(timing.cache_status, "hit")

    def test_expired_cache_refetches(self):
        client = CountingClient()
        service = FabricPsipService(client, cache_seconds=-1, fetch_workers=4)

        service.get_dashboard()
        service.get_dashboard()

        self.assertEqual(client.calls, len(ENTITY_FIELDS) * 2)

    def test_failed_load_is_not_cached(self):
        class FailOnceClient(CountingClient):
            def __init__(self):
                super().__init__()
                self.failed = False

            def fetch_entity(self, entity, fields):
                if not self.failed:
                    with self.lock:
                        if not self.failed:
                            self.failed = True
                            raise FabricGraphQLError("temporary failure")
                return super().fetch_entity(entity, fields)

        client = FailOnceClient()
        service = FabricPsipService(client, cache_seconds=60, fetch_workers=4)

        with self.assertRaises(FabricGraphQLError):
            service.get_dashboard()
        _, timing = service.get_dashboard_with_timing()

        self.assertEqual(timing.cache_status, "miss")


if __name__ == "__main__":
    unittest.main()
