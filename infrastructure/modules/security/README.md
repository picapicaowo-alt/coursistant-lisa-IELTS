# Security module

Creates a rotating customer-managed KMS key and metadata-only Secrets Manager containers for OpenAI and application configuration. The KMS key policy permits account administration, scoped CloudWatch Logs encryption, and scoped CloudTrail data-key generation. Secret values are never managed by Terraform.
