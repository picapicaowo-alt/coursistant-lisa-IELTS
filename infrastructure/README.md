# Coursistant IELTS AWS infrastructure

Terraform in this directory provisions the initial 300-person Coursistant IELTS pilot in AWS Tokyo. It follows the existing Coursistant infrastructure convention (`environments`, `bootstrap`, and reusable `modules`) while correcting the unsafe parts of the early reference implementation: Terraform never creates long-lived developer access keys, never outputs credentials, and never treats an IAM group as an S3 principal.

## Architecture

- Region: `ap-northeast-1` (Tokyo), two availability zones.
- Network: one VPC, two public ALB subnets, two private application subnets, one NAT gateway, and an S3 gateway endpoint.
- Compute: `m7i.xlarge` launch template, 100 GiB encrypted gp3 root disk, Auto Scaling Group `1/1/2`, no public IP, no SSH ingress, Systems Manager access only.
- Edge: public Application Load Balancer, AWS WAF managed protections and per-IP rate limiting. A Tokyo ACM certificate terminates HTTPS for `api-cn.xlearnedu.com`; HTTP redirects to HTTPS.
- Storage: private versioned `uploads`, `artifacts`, and `audit` buckets. Application buckets use a customer-managed KMS key; the audit bucket supports ALB and CloudTrail delivery.
- Cache: private single-node ElastiCache for Valkey 8.2 (`cache.t4g.micro`) with TLS, AUTH, customer-managed KMS encryption, snapshots, and alarms. Only the pilot application security group can enter port 6379.
- Frontend: private versioned KMS S3 origin, CloudFront OAC, global WAF, access logs, security headers, and the issued `app.xlearnedu.com` ACM certificate. The bucket is never a public website origin.
- Secrets: Secrets Manager containers for OpenAI, application configuration, and cache AUTH. The cache token uses Terraform write-only/ephemeral values and is not persisted in Terraform state or plan output.
- Operations: CloudTrail, encrypted VPC Flow Logs and WAF logs, instance logs, alarms, dashboard, SNS topic, and a USD 400 monthly budget.
- Access: instance role with only the S3/KMS/Secrets Manager permissions needed at runtime, plus separate backend- and frontend-developers IAM groups. No IAM users or access keys are created.
- Isolation guardrails: the provider rejects any account other than `658424472610`, and the pilot root rejects any region other than Tokyo. Existing us-west-2 services are outside this state and provider region.

## Repository layout

```text
infrastructure/
├── bootstrap/                 # One-time S3/KMS remote-state resources
├── environments/
│   └── pilot/                 # Tokyo pilot root module and tfvars
└── modules/
    ├── compute/
    ├── cache/
    ├── frontend/
    ├── identity/
    ├── network/
    ├── observability/
    ├── security/
    ├── tls/
    └── storage/
```

Environment roots consume modules. Application teams change reviewed variables in the environment root; shared module logic is changed only when the platform contract itself changes.

The pilot TLS module manages the issued Tokyo ACM certificate for `api-cn.xlearnedu.com`. The frontend module manages the issued `us-east-1` certificate required by CloudFront for `app.xlearnedu.com`. The `xlearnedu.com` zone remains externally hosted at Namecheap; all four active validation/routing CNAMEs are recorded in the live delivery manifest. New external hostnames use two reviewed applies: create the certificate/distribution first, add only the emitted validation CNAME, wait for ACM `ISSUED`, then attach the custom hostname and add its routing CNAME.

## One-time bootstrap

Run bootstrap with an authorized operator identity. This creates only the remote-state S3 bucket and its KMS key.

```bash
cd infrastructure/bootstrap
terraform init
terraform plan -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
terraform output backend_configuration
```

On the first run, initialize with `terraform init -backend=false`. After the bucket exists, copy `bootstrap/backend.hcl.example` to the ignored `bootstrap/backend.hcl`, fill it from the outputs, and migrate the bootstrap state with `terraform init -migrate-state -backend-config=backend.hcl`. Copy the same bucket/KMS values into the ignored `environments/pilot/backend.hcl`, using its example as the schema. State resources have `prevent_destroy`; deleting them requires a separately reviewed break-glass change.

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

Start with the live [DELIVERY_MANIFEST.md](docs/DELIVERY_MANIFEST.md), use [BACKEND_HANDOFF.md](docs/BACKEND_HANDOFF.md) for the runtime contract, and follow [BACKEND_DEPLOYMENT_RUNBOOK.md](docs/BACKEND_DEPLOYMENT_RUNBOOK.md) for the engineer-facing release, verification, and rollback procedure. Terraform brings up a healthy backend placeholder on port 8080 and publishes a neutral frontend verification page so both delivery paths can be accepted before application artifacts exist. The backend team replaces its placeholder with a supervised service while preserving `/health`; the frontend team uploads an immutable build and invalidates CloudFront. After either release, run `infrastructure/scripts/verify-pilot.sh` for account, network, ALB, SSM, cache, S3, CloudFront, public endpoints, and CloudTrail checks.

Pilot-only Checkov suppressions and their production exit conditions are recorded in [SECURITY_EXCEPTIONS.md](docs/SECURITY_EXCEPTIONS.md).

## Future environments

Create `environments/dev`, `environments/staging`, or `environments/prod` by consuming the existing modules with separate state keys, CIDRs, Secrets Manager paths, budgets, and GitHub environments. Never reuse the pilot state for production.
