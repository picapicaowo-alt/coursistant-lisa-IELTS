# Backend deployment handoff

## What the platform team provides

After Terraform apply, use `terraform output` in `environments/pilot` to obtain:

- `application_url`: temporary ALB endpoint.
- `autoscaling_group_name`: deployment target group of EC2 instances.
- `uploads_bucket_name` and `artifacts_bucket_name`: private application buckets.
- `openai_secret_name` and `application_secret_name`: Secrets Manager paths.
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

The bootstrap placeholder returns `200` from `/health` and `503` elsewhere. Replace it only after the backend service is installed and supervised by `systemd`, Docker Compose, or the team's approved runtime manager.

## Secrets contract

Terraform creates secret containers but deliberately creates no secret versions. Populate them using an authorized operational identity. Never paste values into Terraform, GitHub issues, CI logs, shell history, or this repository.

Recommended JSON keys for the OpenAI secret:

```json
{
  "OPENAI_API_KEY": "managed-outside-source-control",
  "OPENAI_BASE_URL": "https://api.openai.com/v1",
  "OPENAI_MODEL": "team-approved-model"
}
```

OpenAI is enabled for the Tokyo backend path. Browser clients must call the Coursistant backend; they must not receive or call with the OpenAI API key directly.

## Deployment acceptance

- The target group reports one healthy target.
- `GET <application_url>/health` returns `200`.
- The instance appears as `Online` in Systems Manager.
- The instance role can read both secret containers after versions are populated.
- A test object can be written and read through each application S3 bucket using the runtime role.
- CloudWatch receives instance logs and alarms are `OK`.
- No instance has a public IPv4 address and port 22 is not allowed by any security group.

Database, Redis, and vector database resources are not part of this initial pilot. Add them as reviewed modules after the backend supplies engine, sizing, retention, and data-classification requirements.
