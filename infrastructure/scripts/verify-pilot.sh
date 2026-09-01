#!/usr/bin/env bash
set -euo pipefail

readonly COURSI_PROFILE="${COURSI_AWS_PROFILE:-coursistant-admin}"
readonly COURSI_REGION="${COURSI_AWS_REGION:-ap-northeast-1}"
readonly COURSI_ACCOUNT="658424472610"
readonly COURSI_ASG="coursistant-ielts-pilot-application"
readonly COURSI_ALB="coursistant-ielts-pilot-alb"
readonly COURSI_TARGET_GROUP="coursistant-ielts-pilot-app"
readonly COURSI_TRAIL="coursistant-ielts-pilot-management"

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

alb_dns="$(aws elbv2 describe-load-balancers \
  --profile "${COURSI_PROFILE}" \
  --region "${COURSI_REGION}" \
  --names "${COURSI_ALB}" \
  --query 'LoadBalancers[0].DNSName' \
  --output text)"

curl --fail --silent --show-error --max-time 15 "http://${alb_dns}/health" >/dev/null

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
echo "ALB target: ${target_state}"
echo "Health URL: http://${alb_dns}/health"
echo "CloudTrail logging: ${trail_logging}"
