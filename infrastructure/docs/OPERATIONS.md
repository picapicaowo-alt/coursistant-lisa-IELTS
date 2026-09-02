# Pilot operations

## Security telemetry

VPC traffic metadata is retained in an encrypted CloudWatch log group for 365 days. WAF request logs are retained for 365 days with the `Authorization` header redacted. Both log groups use the application KMS key; do not replace them with unencrypted destinations.

## Access an instance

Find an instance in the Auto Scaling Group returned by Terraform, then start a Systems Manager session. Access is controlled through IAM; there are no long-lived Terraform-generated credentials.

## Deploy a frontend build

The frontend S3 bucket is private and must remain private. Upload build artifacts using an IAM user already assigned to `coursistant-ielts-pilot-frontend-developers` or a future CI role. Use immutable cache headers for content-hashed assets and `no-cache` for `index.html`, then create a CloudFront invalidation. Never switch the bucket to static website hosting or public-read ACLs.

## Cache operations

The application reads `/coursistant-ielts/pilot/cache` through its instance role and connects to the Terraform output endpoint on port 6379 with TLS. Do not print or export the `REDIS_AUTH_TOKEN` into logs. Rotate it by incrementing `cache_auth_token_version` in a reviewed change and coordinating client reconnection; test the new token from an application instance before closing the change. The pilot is single-node, so maintenance or node failure can interrupt cache availability.

## Scale down after testing

The checked-in pilot configuration keeps one instance and one cache node running continuously. Stopping an Auto Scaling instance is not a cost-control mechanism because the group replaces it. To suspend compute after a test window, submit a reviewed variable change setting `min_size = 0` and `desired_capacity = 0`, apply it, and verify the target group drains. Valkey, NAT Gateway, ALB, CloudFront, S3, KMS, and logs continue to incur charges until their resources are separately changed through reviewed Terraform.

## Rollback

Application releases should be immutable artifacts stored in the artifacts bucket. Roll back the backend artifact independently from infrastructure. For Terraform changes, revert the pull request, review the new plan, and apply it. Never edit AWS resources manually to imitate a rollback.

## Emergency controls

- WAF rate limiting and managed rules can block abusive traffic before it reaches EC2.
- ALB deletion protection and S3 `prevent_destroy` reduce accidental destructive actions.
- CloudTrail records management events in the audit bucket and CloudWatch Logs.
- The monthly budget is an alerting control, not an automatic spending cap.
