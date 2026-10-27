import json
from pathlib import Path
import unittest

CONTRACT = Path(__file__).resolve().parents[1] / "integration" / "bridge-contract-v1.json"

class BridgeContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(CONTRACT.read_text(encoding="utf-8"))

    def test_contract_version_and_interfaces_exist(self):
        self.assertEqual(self.data["contract_version"], "control12.bridge-contract/v1")
        self.assertGreaterEqual(len(self.data["interfaces"]), 10)

    def test_interface_ids_are_unique(self):
        ids = [item["id"] for item in self.data["interfaces"]]
        self.assertEqual(len(ids), len(set(ids)))

    def test_each_edge_has_testable_acceptance_criteria(self):
        for item in self.data["interfaces"]:
            with self.subTest(interface=item["id"]):
                self.assertTrue(item["producer"])
                self.assertTrue(item["consumer"])
                self.assertTrue(item["required_evidence"])
                self.assertTrue(item["acceptance_test"])
                self.assertTrue(item["gaps"])

    def test_status_values_are_known(self):
        allowed = set(self.data["status_vocabulary"])
        for item in self.data["interfaces"]:
            self.assertIn(item["status"], allowed)

    def test_no_interface_is_claimed_verified_without_evidence_record(self):
        # This registry has no execution-evidence fields yet; fail closed until a
        # later version adds per-edge run IDs, exact SHAs, receipts, and log links.
        for item in self.data["interfaces"]:
            self.assertNotEqual(item["status"], "verified")

    def test_critical_edges_have_multiple_required_evidence_items(self):
        for item in self.data["interfaces"]:
            if item["criticality"] == "critical":
                self.assertGreaterEqual(len(item["required_evidence"]), 3)

if __name__ == "__main__":
    unittest.main()
