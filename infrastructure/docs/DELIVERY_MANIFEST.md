# Tokyo pilot delivery manifest

Verified on 2026-09-01 against AWS account `658424472610`. This manifest contains no credentials or secret values.

## Deployment boundary

| Item | Value |
|---|---|
| Environment | `pilot` |
| AWS region | `ap-northeast-1` (Tokyo) |
| Terraform state key | `pilot/terraform.tfstate` |
| VPC | `vpc-0296dc123a76d3712` |
| Application URL | `http://coursistant-ielts-pilot-alb-513932727.ap-northeast-1.elb.amazonaws.com` |
| Auto Scaling Group | `coursistant-ielts-pilot-application` |
| Instance type / capacity | `m7i.xlarge`, min `1`, desired `1`, max `2` |
| Backend port / health path | `8080` / `GET /health` |
| Instance role | `arn:aws:iam::658424472610:role/coursistant-ielts-pilot-instance` |
| Backend IAM group | `coursistant-ielts-pilot-backend-developers` |

The instance ID is intentionally not a deployment parameter because Auto Scaling can replace instances. Discover the current instance from the Auto Scaling Group before every session or release.

## Application resources

| Purpose | AWS resource |
|---|---|
| User uploads | `coursistant-ielts-pilot-uploads-658424472610` |
| Backend artifacts | `coursistant-ielts-pilot-artifacts-658424472610` |
| Audit delivery | `coursistant-ielts-pilot-audit-658424472610` |
| OpenAI configuration | Secrets Manager `/coursistant-ielts/pilot/openai` |
| Application configuration | Secrets Manager `/coursistant-ielts/pilot/application` |
| Operations dashboard | CloudWatch `coursistant-ielts-pilot-operations` |
| Operations notifications | SNS `arn:aws:sns:ap-northeast-1:658424472610:coursistant-ielts-pilot-operations` |
| Regional management trail | CloudTrail `coursistant-ielts-pilot-management` |

The two Secrets Manager containers currently have no Terraform-managed value. An authorized operator must create secret versions before the real backend starts. Do not give a backend engineer the OpenAI key through chat, source control, Terraform variables, or an EC2 environment file.

## Backend release sequence

1. Ask an IAM administrator to add the engineer's existing IAM user to `coursistant-ielts-pilot-backend-developers`. Do not create an access key in Terraform.
2. Upload the immutable application package or container bundle to the artifacts bucket under a versioned key such as `releases/<git-sha>/...`.
3. Ask the secret owner to populate both Secrets Manager paths. The instance role reads them at runtime; the backend developers group can inspect metadata but cannot read secret values.
4. Find the current instance in the Auto Scaling Group and open a Systems Manager Session Manager session. There is no SSH port or EC2 key pair.
5. Install the backend as a supervised `systemd` service or the team's reviewed container runtime. It must listen on `0.0.0.0:8080`, preserve unauthenticated `GET /health`, and fetch secrets through the AWS SDK/instance role.
6. Disable the Nginx placeholder only after the real service answers locally, then verify the target remains healthy and the public health endpoint returns `200`.
7. Run `infrastructure/scripts/verify-pilot.sh`, review CloudWatch logs/alarms, and record the deployed artifact SHA.

The current public endpoint is HTTP and serves only the infrastructure placeholder. Do not send learner data through it. Supply an approved domain and Tokyo ACM certificate before real testing; Terraform will then create HTTPS and redirect HTTP.

## Verified acceptance snapshot

- Terraform convergence: `No changes` after the final apply.
- Auto Scaling: one healthy `InService` instance.
- Load balancer: target healthy on port `8080`; `/health` returned `200`.
- Systems Manager: instance `Online`; no public IPv4 address; no port `22` ingress.
- Storage: all three buckets block public access and have versioning enabled. Uploads and artifacts use the pilot customer-managed KMS key; the audit bucket uses SSE-S3 for AWS log-delivery compatibility.
- Security/operations: WAF associated and logging, CloudTrail logging in Tokyo only, encrypted SNS notifications, CloudWatch dashboard and alarms present.
- Existing production boundary: the us-west-2 instances and VPC are not in this Terraform state. The 2026-09-01 post-apply check found `Prod`, `Dev`, `GroupChat`, and `VPN` still running, and `Individual_dev` still stopped.

See [BACKEND_HANDOFF.md](BACKEND_HANDOFF.md) for the runtime contract and [OPERATIONS.md](OPERATIONS.md) for access, scaling, rollback, and emergency controls.
