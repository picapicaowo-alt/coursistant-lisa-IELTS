# Coursistant IELTS AWS infrastructure

Terraform in this directory provisions the initial 300-person Coursistant IELTS pilot in AWS Tokyo. It follows the existing Coursistant infrastructure convention (`environments`, `bootstrap`, and reusable `modules`) while correcting the unsafe parts of the early reference implementation: Terraform never creates long-lived developer access keys, never outputs credentials, and never treats an IAM group as an S3 principal.

## Architecture

- Region: `ap-northeast-1` (Tokyo), two availability zones.
- Network: one VPC, two public ALB subnets, two private application subnets, one NAT gateway, and an S3 gateway endpoint.
- Compute: `m7i.xlarge` launch template, 100 GiB encrypted gp3 root disk, Auto Scaling Group `1/1/2`, no public IP, no SSH ingress, Systems Manager access only.
- Edge: public Application Load Balancer, AWS WAF managed protections and per-IP rate limiting. HTTP is temporary until a Tokyo ACM certificate is supplied.
- Storage: private versioned `uploads`, `artifacts`, and `audit` buckets. Application buckets use a customer-managed KMS key; the audit bucket supports ALB and CloudTrail delivery.
- Secrets: Secrets Manager placeholders for OpenAI and application configuration. Terraform stores no secret value.
- Operations: CloudTrail, encrypted CloudWatch Logs, alarms, dashboard, SNS topic, and a USD 400 monthly budget.
- Access: instance role with only the S3/KMS/Secrets Manager permissions needed at runtime, plus a backend-developers IAM group. No IAM users or access keys are created.

## Repository layout

```text
infrastructure/
├── bootstrap/                 # One-time S3/KMS remote-state resources
├── environments/
│   └── pilot/                 # Tokyo pilot root module and tfvars
└── modules/
    ├── compute/
    ├── identity/
    ├── network/
    ├── observability/
    ├── security/
    └── storage/
```

Environment roots consume modules. Application teams change reviewed variables in the environment root; shared module logic is changed only when the platform contract itself changes.

## One-time bootstrap

Run bootstrap with an authorized operator identity. This creates only the remote-state S3 bucket and its KMS key.

```bash
cd infrastructure/bootstrap
terraform init
terraform plan -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
terraform output backend_configuration
```

Copy the returned values into an untracked `infrastructure/environments/pilot/backend.hcl`, using `backend.hcl.example` as the schema. State resources have `prevent_destroy`; deleting them requires a separately reviewed break-glass change.

## Pilot workflow

```bash
cd infrastructure/environments/pilot
cp terraform.tfvars.example terraform.tfvars
terraform init -backend-config=backend.hcl
terraform fmt -check -recursive ../..
terraform validate
terraform plan -lock-timeout=5m -out=pilot.tfplan
terraform show pilot.tfplan
```

Do not put passwords, API keys, recipient emails, account credentials, or private endpoints in tracked `.tfvars`. Production applies are not performed locally. The GitHub `pilot` environment must require a maintainer approval before the apply workflow is enabled.

## GitHub repository configuration

The Terraform workflow validates every infrastructure PR without AWS credentials. Remote plans and applies become active only after the following GitHub Actions variables and OIDC roles are configured:

| Variable | Purpose |
|---|---|
| `TF_STATE_BUCKET` | Bootstrap output `state_bucket_name` |
| `TF_STATE_KMS_KEY_ARN` | Bootstrap output `state_kms_key_arn` |
| `AWS_TERRAFORM_PLAN_ROLE_ARN` | Read-only plan role with state lock permissions |
| `AWS_TERRAFORM_APPLY_ROLE_ARN` | Protected `pilot` environment deployment role |

The apply job is manual and GitHub-environment gated. A later platform change can switch it to merge-triggered apply after the team establishes the required reviewers and OIDC roles.

## Backend handoff

See [BACKEND_HANDOFF.md](docs/BACKEND_HANDOFF.md). Terraform brings up a healthy placeholder on port 8080 so network and load-balancer acceptance can complete before backend artifacts exist. The backend team replaces that placeholder with its supervised service while preserving the `/health` contract.

## Future environments

Create `environments/dev`, `environments/staging`, or `environments/prod` by consuming the existing modules with separate state keys, CIDRs, Secrets Manager paths, budgets, and GitHub environments. Never reuse the pilot state for production.
