# Tokyo pilot delivery manifest

Verified on 2026-09-01 against AWS account `658424472610`. This manifest contains no credentials or secret values.

## Deployment boundary

| Item | Value |
|---|---|
| Environment | `pilot` |
| AWS region | `ap-northeast-1` (Tokyo) |
| Terraform state bucket | `coursistant-ielts-tfstate-658424472610` in `us-east-1` |
| Terraform state key | `pilot/terraform.tfstate` |
| Terraform state KMS key | `arn:aws:kms:us-east-1:658424472610:key/9e94ead8-bd34-4cf2-81ab-31d21416329b` |
| VPC | `vpc-0296dc123a76d3712` |
| Application URL | `https://api-cn.xlearnedu.com` |
| Approved API hostname | `api-cn.xlearnedu.com` |
| Frontend URL | `https://app.xlearnedu.com` |
| CloudFront distribution | `E2ZS5X94S7X4YW` / `d3jdo7vj70qb47.cloudfront.net` |
| Frontend ACM certificate | `arn:aws:acm:us-east-1:658424472610:certificate/09a34cb8-43af-44b4-9959-94e8e11fbeb1` (`ISSUED`) |
| Tokyo ACM certificate | `arn:aws:acm:ap-northeast-1:658424472610:certificate/a01a80c3-905d-4e3e-8cc7-7b1bd21aa2f4` (`ISSUED`) |
| Auto Scaling Group | `coursistant-ielts-pilot-application` |
| Instance type / capacity | `m7i.xlarge`, min `1`, desired `1`, max `2` |
| Backend port / health path | `8080` / `GET /health` |
| Instance role | `arn:aws:iam::658424472610:role/coursistant-ielts-pilot-instance` |
| Backend IAM group | `coursistant-ielts-pilot-backend-developers` |
| Frontend IAM group | `coursistant-ielts-pilot-frontend-developers` |

The instance ID is intentionally not a deployment parameter because Auto Scaling can replace instances. Discover the current instance from the Auto Scaling Group before every session or release.

## Application resources

| Purpose | AWS resource |
|---|---|
| User uploads | `coursistant-ielts-pilot-uploads-658424472610` |
| Backend artifacts | `coursistant-ielts-pilot-artifacts-658424472610` |
| Audit delivery | `coursistant-ielts-pilot-audit-658424472610` |
| OpenAI configuration | Secrets Manager `/coursistant-ielts/pilot/openai` |
| Application configuration | Secrets Manager `/coursistant-ielts/pilot/application` |
| Valkey cache | `master.coursistant-ielts-pilot-cache.a7mfip.apne1.cache.amazonaws.com:6379` (`rediss://`, private) |
| Cache AUTH | Secrets Manager `/coursistant-ielts/pilot/cache`, key `REDIS_AUTH_TOKEN` |
| Frontend origin | S3 `coursistant-ielts-pilot-web-658424472610` (private OAC origin) |
| Frontend delivery | CloudFront `E2ZS5X94S7X4YW`, global WAF and access logging enabled |
| Operations dashboard | CloudWatch `coursistant-ielts-pilot-operations` |
| Operations notifications | SNS `arn:aws:sns:ap-northeast-1:658424472610:coursistant-ielts-pilot-operations` |
| Regional management trail | CloudTrail `coursistant-ielts-pilot-management` |

OpenAI and application values are managed operationally outside Terraform. The cache token is generated and written with Terraform ephemeral/write-only fields without plaintext state persistence. The application container has a version containing the documented runtime contract and generated session secret. The OpenAI container has a project-scoped service-account key that passed a Tokyo-instance connectivity check. Do not give a backend engineer any secret through chat, source control, Terraform variables, or an EC2 environment file.

The OpenAI organization has a dedicated project, `Coursistant IELTS China Pilot` (`proj_YA0oSwTSyXAXKU1ZZjynBJPN`). Its API key must belong to a project-scoped service account rather than a person's reusable login.

## Backend release sequence

1. Ask an IAM administrator to add the engineer's existing IAM user to `coursistant-ielts-pilot-backend-developers`. Do not create an access key in Terraform.
2. Upload the immutable application package or container bundle to the artifacts bucket under a versioned key such as `releases/<git-sha>/...`.
3. Ask the secret owner to populate both Secrets Manager paths. The instance role reads them at runtime; the backend developers group can inspect metadata but cannot read secret values.
4. Find the current instance in the Auto Scaling Group and open a Systems Manager Session Manager session. There is no SSH port or EC2 key pair.
5. Install the backend as a supervised `systemd` service or the team's reviewed container runtime. It must listen on `0.0.0.0:8080`, preserve unauthenticated `GET /health`, and fetch secrets through the AWS SDK/instance role.
6. Disable the Nginx placeholder only after the real service answers locally, then verify the target remains healthy and the public health endpoint returns `200`.
7. Run `infrastructure/scripts/verify-pilot.sh`, review CloudWatch logs/alarms, and record the deployed artifact SHA.

The public endpoint uses the managed Tokyo ACM certificate for `api-cn.xlearnedu.com`; HTTP redirects to HTTPS. It continues to serve the infrastructure placeholder until the backend release replaces it.

`dev-jason` is an existing IAM user and is a member of `coursistant-ielts-pilot-backend-developers`. As verified on 2026-09-01, it has no Console login profile and no MFA device, and retains one existing active CLI access key. This repository neither creates nor rotates that key. Keep the current CLI-only workflow until the team deliberately migrates the user to Console MFA or short-lived `aws login` credentials.

## Frontend release sequence

1. Add the frontend engineer's existing IAM user to `coursistant-ielts-pilot-frontend-developers`; do not create a user or access key in Terraform.
2. Build the browser application in CI from an immutable Git SHA.
3. Upload hashed assets with long-lived immutable cache headers, then upload `index.html` with `no-cache` to `coursistant-ielts-pilot-web-658424472610`.
4. Create a CloudFront invalidation for `/index.html` and any non-hashed entry assets.
5. Verify `https://app.xlearnedu.com`, deep-link SPA fallback, authenticated API calls to `https://api-cn.xlearnedu.com`, security headers, and WAF/CloudFront logs.

The live object is currently a neutral infrastructure verification page, not the product release. Replacing it requires a separately accepted frontend build; infrastructure readiness does not prove authenticated business flows.

## External DNS records

The `xlearnedu.com` DNS zone is hosted at Namecheap rather than Route 53. Add only these new CNAMEs; do not change any existing host:

| Stage | Namecheap host | Target |
|---|---|---|
| ACM validation (active) | `_a108c7f1423ce650700f53bc33753895.api-cn` | `_3bbabd3129af32abe17f2814ac4553a0.jkddzztszm.acm-validations.aws.` |
| Application routing (active) | `api-cn` | `coursistant-ielts-pilot-alb-513932727.ap-northeast-1.elb.amazonaws.com.` |
| Frontend ACM validation (active) | `_e9b84cf1f59448596fa45be5a3e510cc.app` | `_cfd8ed31dfca0e349d84f2853b1e7e98.jkddzztszm.acm-validations.aws.` |
| Frontend routing (active) | `app` | `d3jdo7vj70qb47.cloudfront.net.` |

## Verified acceptance snapshot

- Terraform convergence: `No changes` after the final apply.
- Auto Scaling: one healthy `InService` instance.
- Load balancer: target healthy on port `8080`; `/health` returned `200`.
- Systems Manager: instance `Online`; no public IPv4 address; no port `22` ingress.
- Storage: all three buckets block public access and have versioning enabled. Uploads and artifacts use the pilot customer-managed KMS key; the audit bucket uses SSE-S3 for AWS log-delivery compatibility.
- Cache: Valkey is `available`, KMS encrypted at rest, TLS/AUTH protected in transit, and reachable from the application instance only after the expected security-group egress. A real TLS `AUTH`/`PING` returned `VALKEY_CONNECTIVITY_OK` without exposing the token.
- Frontend: CloudFront is `Deployed` with `app.xlearnedu.com`, the issued ACM certificate, OAC private origin, global WAF, access logging, and HTTPS redirect. The public URL returned `200` through the full CloudFront-to-private-S3 path.
- Access: `dev-jason` is in the backend group and remains CLI-only; the new frontend group exists with no members until an engineer is explicitly assigned.
- Security/operations: WAF associated and logging, CloudTrail logging in Tokyo only, encrypted SNS notifications, and all three CloudWatch alarms `OK`.
- Existing production boundary: the us-west-2 instances and VPC are not in this Terraform state. The 2026-09-01 post-apply check found `Prod`, `Dev`, `GroupChat`, and `VPN` still running, and `Individual_dev` still stopped.

See [BACKEND_HANDOFF.md](BACKEND_HANDOFF.md) for the runtime contract, [BACKEND_DEPLOYMENT_RUNBOOK.md](BACKEND_DEPLOYMENT_RUNBOOK.md) for the engineer-facing deployment procedure, and [OPERATIONS.md](OPERATIONS.md) for access, scaling, rollback, and emergency controls.
