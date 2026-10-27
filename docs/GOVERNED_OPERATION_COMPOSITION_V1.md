# Governed operation composition v1

`control_plane.governed_operation_v1.verify_and_record` composes the evidence verifier with the operation ledger. It evaluates against caller-supplied trusted expectations, persists both accepted and not-verified outcomes, and returns no production authorization.

The helper intentionally exposes no HTTP endpoint and does not create trust roots. Production must wire it into an authenticated service boundary, provide a trusted Ed25519 verifier and durable replay guard, and decide production promotion through a separate admission policy. It uses the trusted verifier configuration as ledger subject values rather than trusting the submitted envelope for the expected identity.

Test command:
```sh
python -m unittest discover -s tests -p 'test_governed_operation_v1.py' -v
```
