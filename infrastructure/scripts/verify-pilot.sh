#!/usr/bin/env bash
set -euo pipefail

readonly COURSI_PROFILE="${COURSI_AWS_PROFILE:-coursistant-admin}"
readonly COURSI_REGION="${COURSI_AWS_REGION:-ap-northeast-1}"
readonly COURSI_ACCOUNT="658424472610"
readonly COURSI_ASG="coursistant-ielts-pilot-application"
readonly COURSI_TARGET_GROUP="coursistant-ielts-pilot-app"
readonly COURSI_TRAIL="coursistant-ielts-pilot-management"
readonly COURSI_APPLICATION_URL="${COURSI_APPLICATION_URL:-https://api-cn.xlearnedu.com}"

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

http_url="${COURSI_APPLICATION_URL/https:\/\//http://}"
redirect_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 15 "${http_url}/health")"

if [[ "${redirect_code}" != "301" ]]; then
  echo "HTTP endpoint did not redirect to HTTPS: ${redirect_code}" >&2
  exit 1
fi

curl --fail --silent --show-error --max-time 15 "${COURSI_APPLICATION_URL}/health" >/dev/null

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
echo "CloudTrail logging: ${trail_logging}"
