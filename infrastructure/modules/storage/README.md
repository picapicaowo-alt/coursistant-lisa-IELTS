# Storage module

Creates private, versioned uploads, artifacts, and audit S3 buckets with public access blocked, TLS-only bucket policies, lifecycle controls, and encryption. Application buckets use the project KMS key. The audit bucket supports ALB and CloudTrail delivery and archives logs after 90 days.
