from __future__ import annotations

import unittest
from unittest.mock import Mock

from fabric_service import CachedTokenProvider, FabricGraphQLClient, FabricGraphQLError, FabricPsipService


class FakeClient:
    def __init__(self, dataset):
        self.dataset = dataset

    def fetch_entity(self, entity, fields):
        del fields
        return self.dataset.get(entity, [])


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


if __name__ == "__main__":
    unittest.main()
