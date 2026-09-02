# Backend deployment handoff

## What the platform team provides

After Terraform apply, use `terraform output` in `environments/pilot` to obtain:

- `application_url`: public HTTPS endpoint for the approved API hostname.
- `autoscaling_group_name`: deployment target group of EC2 instances.
- `uploads_bucket_name` and `artifacts_bucket_name`: private application buckets.
- `openai_secret_name` and `application_secret_name`: Secrets Manager paths.
- `cache_primary_endpoint`, `cache_port`, and `cache_secret_name`: private Valkey connection contract.
- `instance_role_arn`: runtime AWS identity.
- `operations_topic_arn` and `cloudwatch_dashboard_name`: operational monitoring.

Instances run in private subnets, have no public IP, and expose no SSH port. Operators use AWS Systems Manager Session Manager. Do not create or distribute EC2 SSH key pairs.

## Runtime contract

The backend service must:

1. Listen on `0.0.0.0:8080` unless the reviewed Terraform variable changes.
2. Return HTTP `200-399` from `GET /health` without authentication.
3. Fetch OpenAI and application configuration from Secrets Manager at runtime through the instance role.
4. Store uploads and generated artifacts in the provided S3 buckets rather than the instance root disk.
5. Write structured application logs to stdout or CloudWatch Logs.
6. Shut down gracefully within the ALB target group's 30-second deregistration window.
7. Connect to Valkey with TLS (`rediss://`) and the `REDIS_AUTH_TOKEN` read from the cache secret. Never place the token in a tracked `.env`, container image, deployment log, or command output.

The bootstrap placeholder returns `200` from `/health` and `503` elsewhere. Replace it only after the backend service is installed and supervised by `systemd`, Docker Compose, or the team's approved runtime manager.

## Secrets contract

Terraform creates all three secret containers. OpenAI and application values are populated by an authorized operator outside Terraform. The cache module writes a generated `REDIS_AUTH_TOKEN` through Terraform write-only/ephemeral attributes, so its plaintext does not enter the plan or state. Never paste any value into Terraform variables, GitHub issues, CI logs, shell history, or this repository.

Recommended JSON keys for the OpenAI secret:

```json
{
  "OPENAI_API_KEY": "managed-outside-source-control",
  "OPENAI_BASE_URL": "https://api.openai.com/v1",
  "OPENAI_MODEL": "gpt-5.6-luna",
  "OPENAI_PROJECT_ID": "project-scoped-id"
}
```

OpenAI is enabled for the Tokyo backend path. Browser clients must call the Coursistant backend; they must not receive or call with the OpenAI API key directly.

The application secret contract contains `APP_ENV`, `AWS_REGION`, `PORT`, `UPLOADS_BUCKET`, `ARTIFACTS_BUCKET`, `LOG_LEVEL`, `OPENAI_SECRET_NAME`, and a generated `SESSION_SECRET`. The separate cache secret contains exactly `REDIS_AUTH_TOKEN`; combine it at runtime with the Terraform outputs rather than duplicating endpoint or token values. Database, email, and vector-store credentials remain absent until the backend supplies those concrete contracts.

Recommended runtime mapping:

```text
REDIS_HOST=<terraform output cache_primary_endpoint>
REDIS_PORT=<terraform output cache_port>
REDIS_TLS=true
REDIS_AUTH_TOKEN=<Secrets Manager /coursistant-ielts/pilot/cache key REDIS_AUTH_TOKEN>
```

The pilot cache is intentionally one `cache.t4g.micro` node with no replica or automatic failover. It is suitable for the 300-person test and must not be treated as durable primary storage. Add a replica, Multi-AZ, capacity testing, and a recovery objective before production.

## Deployment acceptance

- The target group reports one healthy target.
- `GET <application_url>/health` returns `200`.
- The instance appears as `Online` in Systems Manager.
- The instance role can read both current secret versions without exposing their values in deployment logs.
- The instance can complete a TLS `AUTH` and `PING` against Valkey without printing the token.
- A test object can be written and read through each application S3 bucket using the runtime role.
- CloudWatch receives instance logs and alarms are `OK`.
- No instance has a public IPv4 address and port 22 is not allowed by any security group.

Database and vector database resources are not part of this pilot. Add them as reviewed modules after the backend supplies engine, sizing, retention, backup, and data-classification requirements.
