# Coursistant Tokyo Pilot — Backend Deployment Runbook

## Document control

| Field | Value |
|---|---|
| Environment | `pilot` |
| AWS account | `658424472610` |
| AWS region | `ap-northeast-1` (Tokyo) |
| Service owner | Backend engineering |
| Infrastructure owner | Platform / infrastructure maintainer |
| Deployment method | Immutable release through S3 and AWS Systems Manager |
| Production readiness | Pilot only; see [Known limitations](#known-limitations) |

This runbook contains no credentials or secret values. Follow it from a reviewed, committed backend Git SHA. Do not deploy from an uncommitted worktree.

## 1. Infrastructure contract

| Purpose | Value |
|---|---|
| Public API | `https://api-cn.xlearnedu.com` |
| Auto Scaling Group | `coursistant-ielts-pilot-application` |
| Application port | `8080` |
| Health check | Unauthenticated `GET /health`, HTTP `200-399` |
| Backend IAM group | `coursistant-ielts-pilot-backend-developers` |
| Release bucket | `s3://coursistant-ielts-pilot-artifacts-658424472610` |
| Uploads bucket | `s3://coursistant-ielts-pilot-uploads-658424472610` |
| OpenAI secret | `/coursistant-ielts/pilot/openai` |
| Application secret | `/coursistant-ielts/pilot/application` |
| Cache secret | `/coursistant-ielts/pilot/cache` |
| Valkey endpoint | `master.coursistant-ielts-pilot-cache.a7mfip.apne1.cache.amazonaws.com:6379` |
| Valkey protocol | TLS / `rediss://` |

Instances have no public IP address and no SSH ingress. Use AWS Systems Manager Session Manager; do not create an EC2 key pair or open port 22.

## 2. Runtime requirements

The backend service must:

1. Listen on `0.0.0.0:8080`.
2. return HTTP `200-399` from unauthenticated `GET /health`.
3. Retrieve OpenAI and application configuration through the AWS SDK and EC2 instance role.
4. Retrieve `REDIS_AUTH_TOKEN` from `/coursistant-ielts/pilot/cache` and connect to Valkey with TLS.
5. Store uploads and generated artifacts in the supplied S3 buckets, not on the EC2 root volume.
6. Emit structured logs and configure the CloudWatch Agent to collect the application log destination.
7. Complete graceful shutdown within the ALB target group's 30-second deregistration window.
8. Never expose OpenAI, application, or cache credentials to a browser client.

Do not store secret values in source control, tracked `.env` files, release archives, container images, Terraform variables, deployment output, CI logs, or shell history.

## 3. Release artifact contract

Every release must be immutable and addressable by its Git SHA.

```text
release-<git-sha>.tar.gz
release-<git-sha>.sha256
deploy/install.sh
deploy/rollback.sh
deploy/coursistant-backend.service
```

Recommended server layout:

```text
/opt/coursistant/releases/<git-sha>/
/opt/coursistant/current  -> /opt/coursistant/releases/<git-sha>/
/opt/coursistant/previous -> /opt/coursistant/releases/<previous-sha>/
```

The install script must be idempotent. Re-running it for the same SHA must not overwrite another release or corrupt `current`/`previous`.

## 4. Pre-deployment checks

Set the operator's existing AWS CLI profile name locally. Do not create a new access key for this deployment.

```bash
export COURSE_AWS_PROFILE="<existing-profile-name>"
export COURSE_AWS_REGION="ap-northeast-1"

aws sts get-caller-identity \
  --profile "${COURSE_AWS_PROFILE}"
```

Confirm the returned account is `658424472610` before continuing.

Ask the platform operator to run the infrastructure verifier from the repository and establish a pre-deployment baseline. The verifier intentionally requires broader read-only infrastructure access plus `ssm:SendCommand`; the backend-developers group does not have that permission.

```bash
COURSI_AWS_PROFILE="<platform-operator-profile>" \
  infrastructure/scripts/verify-pilot.sh
```

The platform operator must stop the deployment if the baseline fails. Do not add `ssm:SendCommand` to the backend-developers group solely to run this verifier.

## 5. Build and publish an immutable release

Build from a clean, reviewed backend commit and record its SHA:

```bash
COURSE_RELEASE_SHA="$(git rev-parse HEAD)"
git diff --quiet
git diff --cached --quiet
```

Produce the release archive using the backend repository's approved build process, then calculate its checksum:

```bash
sha256sum "release-${COURSE_RELEASE_SHA}.tar.gz" \
  > "release-${COURSE_RELEASE_SHA}.sha256"
```

Upload both immutable files:

```bash
aws s3 cp "release-${COURSE_RELEASE_SHA}.tar.gz" \
  "s3://coursistant-ielts-pilot-artifacts-658424472610/releases/${COURSE_RELEASE_SHA}/" \
  --profile "${COURSE_AWS_PROFILE}" \
  --region "${COURSE_AWS_REGION}"

aws s3 cp "release-${COURSE_RELEASE_SHA}.sha256" \
  "s3://coursistant-ielts-pilot-artifacts-658424472610/releases/${COURSE_RELEASE_SHA}/" \
  --profile "${COURSE_AWS_PROFILE}" \
  --region "${COURSE_AWS_REGION}"
```

Do not reuse or overwrite a previously published SHA path.

## 6. Discover the active instance

Never hardcode an EC2 instance ID. Auto Scaling can replace instances.

```bash
COURSE_INSTANCE_ID="$(aws autoscaling describe-auto-scaling-groups \
  --profile "${COURSE_AWS_PROFILE}" \
  --region "${COURSE_AWS_REGION}" \
  --auto-scaling-group-names coursistant-ielts-pilot-application \
  --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService` && HealthStatus==`Healthy`].InstanceId | [0]' \
  --output text)"

test -n "${COURSE_INSTANCE_ID}"
test "${COURSE_INSTANCE_ID}" != "None"
```

## 7. Open a Systems Manager session

```bash
aws ssm start-session \
  --profile "${COURSE_AWS_PROFILE}" \
  --region "${COURSE_AWS_REGION}" \
  --target "${COURSE_INSTANCE_ID}"
```

The backend-developers group can start sessions only on tagged pilot instances. It can inspect secret metadata but cannot retrieve secret values through the developer identity. The application retrieves values from inside EC2 through the instance role.

## 8. Install and smoke-test the release

Inside the EC2 session, set the intended release SHA and download it using the instance role:

```bash
COURSE_RELEASE_SHA="<reviewed-git-sha>"
COURSE_RELEASE_DIR="/opt/coursistant/releases/${COURSE_RELEASE_SHA}"

sudo mkdir -p "${COURSE_RELEASE_DIR}"
sudo chown "$(id -un):$(id -gn)" "${COURSE_RELEASE_DIR}"

aws s3 cp \
  "s3://coursistant-ielts-pilot-artifacts-658424472610/releases/${COURSE_RELEASE_SHA}/release-${COURSE_RELEASE_SHA}.tar.gz" \
  "/tmp/release-${COURSE_RELEASE_SHA}.tar.gz" \
  --region ap-northeast-1

aws s3 cp \
  "s3://coursistant-ielts-pilot-artifacts-658424472610/releases/${COURSE_RELEASE_SHA}/release-${COURSE_RELEASE_SHA}.sha256" \
  "/tmp/release-${COURSE_RELEASE_SHA}.sha256" \
  --region ap-northeast-1

cd /tmp
sha256sum --check "release-${COURSE_RELEASE_SHA}.sha256"
tar -xzf "release-${COURSE_RELEASE_SHA}.tar.gz" -C "${COURSE_RELEASE_DIR}"
```

Run the release's idempotent installer. The implementation may use Node.js, Python, Java, Docker Compose, or another reviewed runtime; the infrastructure contract does not prescribe a language.

```bash
sudo "${COURSE_RELEASE_DIR}/deploy/install.sh" \
  --release-dir "${COURSE_RELEASE_DIR}" \
  --smoke-test-port 18080
```

Before production cutover, verify the candidate on the temporary port:

```bash
curl --fail --silent --show-error \
  http://127.0.0.1:18080/health
```

The smoke test must retrieve secrets using the instance role, complete a Valkey TLS `AUTH`/`PING`, and perform any required dependency checks without printing secret values.

## 9. Cut over to the new release

Keep the previous release addressable for rollback:

```bash
if [[ -L /opt/coursistant/current ]]; then
  sudo ln -sfn "$(readlink -f /opt/coursistant/current)" \
    /opt/coursistant/previous
fi

sudo ln -sfn "${COURSE_RELEASE_DIR}" /opt/coursistant/current
```

Install the reviewed `systemd` unit, stop the infrastructure placeholder, and start the real service:

```bash
sudo install -o root -g root -m 0644 \
  "${COURSE_RELEASE_DIR}/deploy/coursistant-backend.service" \
  /etc/systemd/system/coursistant-backend.service

sudo systemctl daemon-reload
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo systemctl enable --now coursistant-backend
```

Confirm the service is supervised and healthy:

```bash
sudo systemctl --no-pager --full status coursistant-backend
curl --fail --silent --show-error \
  http://127.0.0.1:8080/health
```

## 10. Post-deployment acceptance

From the backend engineer's machine, verify the public service endpoint:

```bash
curl --fail --silent --show-error \
  https://api-cn.xlearnedu.com/health
```

Then ask the platform operator to run the full infrastructure acceptance check:

```bash
COURSI_AWS_PROFILE="<platform-operator-profile>" \
  infrastructure/scripts/verify-pilot.sh
```

The release is accepted only when all of the following are true:

- Local `GET /health` succeeds on port 8080.
- Public `https://api-cn.xlearnedu.com/health` succeeds.
- The ALB target reports `healthy`.
- The instance remains `Online` in Systems Manager.
- Valkey TLS `AUTH` and `PING` succeed.
- Required S3 write/read checks succeed through the runtime role.
- OpenAI calls occur only through the backend.
- Application logs arrive in CloudWatch.
- No secret value appears in application or deployment logs.
- No public IP, SSH rule, or unmanaged AWS resource was added.

Record the deployed Git SHA, release time, operator, validation result, and any migration identifier in the release record.

## 11. Rollback

Rollback is an immutable release switch, not a rebuild of the failed version.

Inside the EC2 session:

```bash
sudo systemctl stop coursistant-backend
sudo /opt/coursistant/current/deploy/rollback.sh \
  --previous-link /opt/coursistant/previous \
  --current-link /opt/coursistant/current
sudo systemctl start coursistant-backend

curl --fail --silent --show-error \
  http://127.0.0.1:8080/health
```

Then verify the public health endpoint and ALB target state. Record both the failed SHA and restored SHA. Database migrations must have an independently reviewed backward-compatible or rollback strategy; do not assume changing the application symlink reverses a database migration.

## 12. Known limitations

- The pilot runs one active EC2 instance. The ASG can replace infrastructure, but a replacement currently returns to the placeholder until the backend release is deployed again.
- A deployment or rollback can cause a short API interruption because only one application instance is active.
- Valkey has one node and no Multi-AZ automatic failover. It is not durable primary storage.
- RDS/database and vector database resources are not provisioned.
- GitHub OIDC deployment roles and automatic backend deployment are not enabled.
- Application deployment through an interactive SSM session is a pilot workflow, not the production end state.

Before production, move to an automated immutable deployment model—preferably ECR plus at least two ECS Fargate tasks across availability zones—or implement a reviewed immutable AMI/bootstrap release mechanism. Add RDS Multi-AZ, Valkey Multi-AZ with a replica, tested backup/restore procedures, capacity testing, and automated rollback.

## 13. Related documents

- [Backend runtime contract](BACKEND_HANDOFF.md)
- [Live delivery manifest](DELIVERY_MANIFEST.md)
- [Operations guide](OPERATIONS.md)
- [Pilot security exceptions](SECURITY_EXCEPTIONS.md)
- [Infrastructure overview](../README.md)
