# Pilot operations

## Access an instance

Find an instance in the Auto Scaling Group returned by Terraform, then start a Systems Manager session. Access is controlled through IAM; there are no long-lived Terraform-generated credentials.

## Scale down after testing

The checked-in pilot configuration keeps one instance running continuously. Stopping an Auto Scaling instance is not a cost-control mechanism because the group replaces it. To suspend compute after a test window, submit a reviewed variable change setting `min_size = 0` and `desired_capacity = 0`, apply it, and verify the target group drains. NAT Gateway, ALB, S3, KMS, and logs continue to incur smaller charges until their stack is separately removed.

## Rollback

Application releases should be immutable artifacts stored in the artifacts bucket. Roll back the backend artifact independently from infrastructure. For Terraform changes, revert the pull request, review the new plan, and apply it. Never edit AWS resources manually to imitate a rollback.

## Emergency controls

- WAF rate limiting and managed rules can block abusive traffic before it reaches EC2.
- ALB deletion protection and S3 `prevent_destroy` reduce accidental destructive actions.
- CloudTrail records management events in the audit bucket and CloudWatch Logs.
- The monthly budget is an alerting control, not an automatic spending cap.
