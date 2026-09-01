resource "aws_iam_service_linked_role" "autoscaling" {
  aws_service_name = "autoscaling.amazonaws.com"
  custom_suffix    = var.name_prefix
  description      = "Scoped Auto Scaling service role for ${var.name_prefix}"
}

resource "aws_kms_key" "application" {
  description             = "Encrypts ${var.name_prefix} application data and secrets"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.application_kms.json
  tags                    = merge(var.tags, { Name = "${var.name_prefix}-application" })
}

data "aws_partition" "current" {}

data "aws_iam_policy_document" "application_kms" {
  #checkov:skip=CKV_AWS_109:KMS key policies require Resource="*"; administration is restricted to this account root principal.
  #checkov:skip=CKV_AWS_111:KMS service permissions require Resource="*" and are restricted by service principals plus encryption-context/source-ARN conditions.
  #checkov:skip=CKV_AWS_356:KMS key policies require Resource="*" because the key policy itself defines the resource boundary.
  statement {
    sid    = "EnableAccountAdministration"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:${data.aws_partition.current.partition}:iam::${var.account_id}:root"]
    }

    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "AllowAutoScalingUse"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = [aws_iam_service_linked_role.autoscaling.arn]
    }

    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:DescribeKey"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "AllowAutoScalingGrantForAwsResources"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = [aws_iam_service_linked_role.autoscaling.arn]
    }

    actions   = ["kms:CreateGrant"]
    resources = ["*"]

    condition {
      test     = "Bool"
      variable = "kms:GrantIsForAWSResource"
      values   = ["true"]
    }
  }

  statement {
    sid    = "AllowCloudWatchLogsEncryption"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["logs.${var.aws_region}.amazonaws.com"]
    }

    actions = [
      "kms:Decrypt",
      "kms:Encrypt",
      "kms:GenerateDataKey*",
      "kms:ReEncrypt*"
    ]
    resources = ["*"]

    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values = [
        "arn:${data.aws_partition.current.partition}:logs:${var.aws_region}:${var.account_id}:log-group:${var.log_group_prefix}/*",
        "arn:${data.aws_partition.current.partition}:logs:${var.aws_region}:${var.account_id}:log-group:aws-waf-logs-${var.name_prefix}*"
      ]
    }
  }

  statement {
    sid    = "AllowCloudTrailEncryption"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    actions   = ["kms:DescribeKey", "kms:GenerateDataKey*"]
    resources = ["*"]

    condition {
      test     = "StringLike"
      variable = "aws:SourceArn"
      values   = ["arn:${data.aws_partition.current.partition}:cloudtrail:*:${var.account_id}:trail/${var.name_prefix}-*"]
    }
  }

  statement {
    sid    = "AllowCloudTrailEncryptedSns"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    actions = [
      "kms:Decrypt",
      "kms:GenerateDataKey*"
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["arn:${data.aws_partition.current.partition}:cloudtrail:${var.aws_region}:${var.account_id}:trail/${var.name_prefix}-management"]
    }
  }
}

resource "aws_kms_alias" "application" {
  name          = "alias/${var.name_prefix}-application"
  target_key_id = aws_kms_key.application.key_id
}

resource "aws_secretsmanager_secret" "openai" {
  #checkov:skip=CKV2_AWS_57:OpenAI key rotation has no provider-managed rotation API; versions are rotated through the operations runbook.
  name                    = var.openai_secret_name
  description             = "OpenAI API configuration for ${var.name_prefix}; value is managed outside Terraform"
  kms_key_id              = aws_kms_key.application.arn
  recovery_window_in_days = 30
  tags                    = merge(var.tags, { Purpose = "openai" })
}

resource "aws_secretsmanager_secret" "application" {
  #checkov:skip=CKV2_AWS_57:Automatic rotation needs a backend-specific Lambda contract; the empty pilot container is manually versioned until that contract exists.
  name                    = var.app_secret_name
  description             = "Backend runtime secrets for ${var.name_prefix}; value is managed outside Terraform"
  kms_key_id              = aws_kms_key.application.arn
  recovery_window_in_days = 30
  tags                    = merge(var.tags, { Purpose = "application" })
}
