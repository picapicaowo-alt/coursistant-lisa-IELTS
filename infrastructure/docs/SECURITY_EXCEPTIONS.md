# Pilot security exceptions

These exceptions are scoped to the 300-person Tokyo pilot. Checkov suppressions live on the exact Terraform resource so that new resources remain subject to the full policy set. Every exception must be reconsidered before a production environment is created.

| Check | Scope | Pilot decision | Production exit condition |
|---|---|---|---|
| `CKV_AWS_18` | State and application S3 buckets | CloudTrail records S3 API activity and ALB writes to the audit bucket. A recursive access-log target for the audit bucket is intentionally absent. | Add a separately administered central log archive and S3 access logging. |
| `CKV_AWS_144` | State and application S3 buckets | Single-region durability and bucket versioning are accepted for the pilot. | Define the data-residency and disaster-recovery region, then enable replication. |
| `CKV2_AWS_62` | State and application S3 buckets | State is not an event source; application events are unwired until the backend supplies a consumer contract. | Add event destinations only for approved backend workflows. |
| `CKV2_AWS_20`, `CKV_AWS_103` | Public ALB | The initial endpoint is HTTP because there is no approved domain or Tokyo ACM certificate. WAF and rate limiting remain active. | Supply `certificate_arn`; Terraform then redirects HTTP to the TLS 1.2+ listener. |
| `CKV_AWS_378` | ALB target group | TLS terminates at the ALB. ALB-to-instance traffic is private and security-group restricted. | Reassess end-to-end TLS for regulated or production data. |
| `CKV2_AWS_57` | Secrets Manager | OpenAI has no provider-managed rotation integration, and the application rotation Lambda contract does not exist yet. | Adopt an operational rotation schedule; add automatic rotation where a supported contract exists. |
| `CKV2_AWS_19` | NAT EIP | The address is attached to the NAT Gateway rather than EC2; this is a scanner model mismatch. | None while NAT remains the egress design. |
| `CKV_AWS_21`, `CKV2_AWS_6`, `CKV2_AWS_61` | Application S3 map | Versioning, full public-access blocking, and lifecycle configuration are present for every `for_each` bucket; Checkov CI cannot correlate the companion resources. | Remove suppressions when the scanner correctly resolves these graph edges. |
| `CKV_AWS_145` | Application S3 map | Uploads and artifacts use the customer KMS key. The audit bucket uses SSE-S3 for ALB log-delivery compatibility; Checkov cannot distinguish the map members. | Reassess the audit encryption destination when ALB logging requirements change. |
| `CKV2_AWS_76` | ALB/WAF graph | The ALB is associated with a WAF Web ACL containing AWS Managed Known Bad Inputs protection; Checkov cannot trace both graph edges. | Remove when the scanner recognizes the association. |
| `CKV_AWS_67` | CloudTrail | The pilot trail is deliberately Tokyo-only so it does not duplicate account-wide logging or costs for existing us-west-2 production workloads. | Reassess against the organization's central trail before production; never create a competing organization trail. |

Inline suppressions are not permission to add another exception silently. Any new suppression requires a matching row here and PR review.
