#!/usr/bin/env bash
set -euo pipefail

readonly COURSI_PROFILE="${COURSI_AWS_PROFILE:-coursistant-admin}"
readonly COURSI_REGION="${COURSI_AWS_REGION:-ap-northeast-1}"
readonly COURSI_ACCOUNT="658424472610"
readonly COURSI_ASG="coursistant-ielts-pilot-application"
readonly COURSI_TARGET_GROUP="coursistant-ielts-pilot-app"
readonly COURSI_TRAIL="coursistant-ielts-pilot-management"
readonly COURSI_APPLICATION_URL="${COURSI_APPLICATION_URL:-https://api-cn.xlearnedu.com}"
readonly COURSI_FRONTEND_URL="${COURSI_FRONTEND_URL:-https://app.xlearnedu.com}"
readonly COURSI_FRONTEND_BUCKET="coursistant-ielts-pilot-web-658424472610"
readonly COURSI_FRONTEND_DISTRIBUTION="E2ZS5X94S7X4YW"
readonly COURSI_CACHE_ID="coursistant-ielts-pilot-cache"
readonly COURSI_CACHE_SECRET="/coursistant-ielts/pilot/cache"

if [[ "${COURSI_REGION}" != "ap-northeast-1" ]]; then
  echo "Refusing verification outside ap-northeast-1: ${COURSI_REGION}" >&2
  exit 1
fi

actual_account="$(aws sts get-caller-identity \
  --profile "${COURSI_PROFILE}" \
  --query Account \
  --output text)"

if [[ "${actual_account}" != "${COURSI_ACCOUNT}" ]]; then
  echo "Refusing unexpected AWS account: ${actual_account}" >&2
  exit 1
fi

# The JMESPath backticks are literal query syntax, not shell expansion.
# shellcheck disable=SC2016
instance_id="$(aws autoscaling describe-auto-scaling-groups \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --auto-scaling-group-names "${COURSI_ASG}" \
  --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService` && HealthStatus==`Healthy`].InstanceId | [0]' \
  --output text)"

if [[ -z "${instance_id}" || "${instance_id}" == "None" ]]; then
  echo "No healthy InService pilot instance found" >&2
  exit 1
fi

public_ip="$(aws ec2 describe-instances \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --instance-ids "${instance_id}" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)"

if [[ "${public_ip}" != "None" ]]; then
  echo "Pilot instance unexpectedly has public IP ${public_ip}" >&2
  exit 1
fi

application_security_group_id="$(aws ec2 describe-instances \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --instance-ids "${instance_id}" \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' \
  --output text)"

# Reject any ingress rule whose protocol/port range could admit SSH, regardless
# of its source. The application instance is managed only through SSM.
# shellcheck disable=SC2016
ssh_ingress_rule_count="$(aws ec2 describe-security-group-rules \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --filters "Name=group-id,Values=${application_security_group_id}" \
  --query 'length(SecurityGroupRules[?IsEgress==`false` && (IpProtocol==`"-1"` || (FromPort<=`22` && ToPort>=`22`))])' \
  --output text)"

if [[ "${ssh_ingress_rule_count}" != "0" ]]; then
  echo "Application security group permits SSH ingress" >&2
  exit 1
fi

target_group_arn="$(aws elbv2 describe-target-groups \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --names "${COURSI_TARGET_GROUP}" \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)"

target_state="$(aws elbv2 describe-target-health \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --target-group-arn "${target_group_arn}" \
  --targets "Id=${instance_id}" \
  --query 'TargetHealthDescriptions[0].TargetHealth.State' \
  --output text)"

if [[ "${target_state}" != "healthy" ]]; then
  echo "ALB target is not healthy: ${target_state}" >&2
  exit 1
fi

ssm_state="$(aws ssm describe-instance-information \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --filters "Key=InstanceIds,Values=${instance_id}" \
  --query 'InstanceInformationList[0].PingStatus' \
  --output text)"

if [[ "${ssm_state}" != "Online" ]]; then
  echo "SSM is not online: ${ssm_state}" >&2
  exit 1
fi

cache_status="$(aws elasticache describe-replication-groups \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --replication-group-id "${COURSI_CACHE_ID}" \
  --query 'ReplicationGroups[0].Status' \
  --output text)"

cache_protection="$(aws elasticache describe-replication-groups \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --replication-group-id "${COURSI_CACHE_ID}" \
  --query '[ReplicationGroups[0].TransitEncryptionEnabled,ReplicationGroups[0].AtRestEncryptionEnabled]' \
  --output text)"

if [[ "${cache_status}" != "available" || "${cache_protection}" != $'True\tTrue' ]]; then
  echo "Valkey is not available with both encryption controls: ${cache_status} ${cache_protection}" >&2
  exit 1
fi

cache_endpoint="$(aws elasticache describe-replication-groups \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --replication-group-id "${COURSI_CACHE_ID}" \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
  --output text)"

# The JMESPath backticks are literal query syntax, not shell expansion.
# shellcheck disable=SC2016
cache_secret_current="$(aws secretsmanager describe-secret \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --secret-id "${COURSI_CACHE_SECRET}" \
  --query 'length(VersionIdsToStages.*[?contains(@, `AWSCURRENT`)])' \
  --output text)"

if [[ "${cache_secret_current}" == "0" ]]; then
  echo "Cache secret has no AWSCURRENT version" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for the secret-safe Valkey connectivity check" >&2
  exit 1
fi

cache_commands="$(jq -nc --arg endpoint "${cache_endpoint}" '{commands:[
  "set -eu",
  "CACHE_JSON=$(aws secretsmanager get-secret-value --region ap-northeast-1 --secret-id /coursistant-ielts/pilot/cache --query SecretString --output text)",
  "CACHE_AUTH_TOKEN=$(printf %s \"$CACHE_JSON\" | python3 -c '\''import json,sys; print(json.load(sys.stdin)[\"REDIS_AUTH_TOKEN\"])'\'')",
  ("CACHE_ENDPOINT=" + $endpoint + " CACHE_AUTH_TOKEN=\"$CACHE_AUTH_TOKEN\" python3 -c '\''import os,ssl,socket; s=ssl.create_default_context().wrap_socket(socket.create_connection((os.environ[\"CACHE_ENDPOINT\"],6379),timeout=10),server_hostname=os.environ[\"CACHE_ENDPOINT\"]); t=os.environ[\"CACHE_AUTH_TOKEN\"].encode(); s.sendall(b\"*2\\r\\n$4\\r\\nAUTH\\r\\n$\"+str(len(t)).encode()+b\"\\r\\n\"+t+b\"\\r\\n\"); a=s.recv(256); assert a.startswith(b\"+OK\"), a; s.sendall(b\"*1\\r\\n$4\\r\\nPING\\r\\n\"); p=s.recv(256); assert p.startswith(b\"+PONG\"), p; print(\"VALKEY_CONNECTIVITY_OK\")'\''"),
  "unset CACHE_JSON CACHE_AUTH_TOKEN"
]}')"

cache_command_id="$(aws ssm send-command \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --instance-ids "${instance_id}" \
  --document-name AWS-RunShellScript \
  --parameters "${cache_commands}" \
  --query 'Command.CommandId' \
  --output text)"

aws ssm wait command-executed \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --command-id "${cache_command_id}" \
  --instance-id "${instance_id}"

cache_check="$(aws ssm get-command-invocation \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --command-id "${cache_command_id}" \
  --instance-id "${instance_id}" \
  --query StandardOutputContent \
  --output text)"

if [[ "${cache_check}" != "VALKEY_CONNECTIVITY_OK" ]]; then
  echo "Valkey TLS/AUTH connectivity check failed" >&2
  exit 1
fi

http_url="${COURSI_APPLICATION_URL/https:\/\//http://}"
redirect_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 15 "${http_url}/health")"

if [[ "${redirect_code}" != "301" ]]; then
  echo "HTTP endpoint did not redirect to HTTPS: ${redirect_code}" >&2
  exit 1
fi

curl --fail --silent --show-error --max-time 15 "${COURSI_APPLICATION_URL}/health" >/dev/null

distribution_status="$(aws cloudfront get-distribution \
  --profile "${COURSI_PROFILE}" \
  --id "${COURSI_FRONTEND_DISTRIBUTION}" \
  --query 'Distribution.Status' \
  --output text)"

# The JMESPath backticks are literal query syntax, not shell expansion.
# shellcheck disable=SC2016
frontend_controls="$(aws cloudfront get-distribution \
  --profile "${COURSI_PROFILE}" \
  --id "${COURSI_FRONTEND_DISTRIBUTION}" \
  --query 'Distribution.DistributionConfig.[contains(Aliases.Items, `app.xlearnedu.com`),Logging.Enabled,DefaultCacheBehavior.ViewerProtocolPolicy,WebACLId]' \
  --output text)"

if [[ "${distribution_status}" != "Deployed" || "${frontend_controls}" != True$'\t'True$'\t'redirect-to-https$'\t'arn:* ]]; then
  echo "CloudFront controls are not fully deployed: ${distribution_status} ${frontend_controls}" >&2
  exit 1
fi

frontend_public_block="$(aws s3api get-public-access-block \
  --profile "${COURSI_PROFILE}" \
  --bucket "${COURSI_FRONTEND_BUCKET}" \
  --query 'PublicAccessBlockConfiguration.[BlockPublicAcls,IgnorePublicAcls,BlockPublicPolicy,RestrictPublicBuckets]' \
  --output text)"

frontend_versioning="$(aws s3api get-bucket-versioning \
  --profile "${COURSI_PROFILE}" \
  --bucket "${COURSI_FRONTEND_BUCKET}" \
  --query Status \
  --output text)"

if [[ "${frontend_public_block}" != $'True\tTrue\tTrue\tTrue' || "${frontend_versioning}" != "Enabled" ]]; then
  echo "Frontend S3 protection is incomplete" >&2
  exit 1
fi

curl --fail --silent --show-error --max-time 20 "${COURSI_FRONTEND_URL}/" >/dev/null

trail_logging="$(aws cloudtrail get-trail-status \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --name "${COURSI_TRAIL}" \
  --query IsLogging \
  --output text)"

if [[ "${trail_logging}" != "True" ]]; then
  echo "CloudTrail is not logging: ${trail_logging}" >&2
  exit 1
fi

echo "Pilot verification passed"
echo "Account: ${actual_account}"
echo "Region: ${COURSI_REGION}"
echo "Instance: ${instance_id} (private, SSM ${ssm_state})"
echo "SSH ingress rules: ${ssh_ingress_rule_count}"
echo "ALB target: ${target_state}"
echo "Health URL: ${COURSI_APPLICATION_URL}/health (HTTPS 200, HTTP 301)"
echo "Valkey: ${cache_status}, encrypted, TLS/AUTH connectivity passed"
echo "Frontend: ${COURSI_FRONTEND_URL} (CloudFront ${distribution_status}, private S3)"
echo "CloudTrail logging: ${trail_logging}"
