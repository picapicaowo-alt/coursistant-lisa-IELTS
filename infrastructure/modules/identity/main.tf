resource "aws_iam_group" "backend_developers" {
  name = "${var.name_prefix}-backend-developers"
  path = "/coursistant/"
}

data "aws_partition" "current" {}

data "aws_iam_policy_document" "backend_developers" {
  #checkov:skip=CKV_AWS_356:AWS Describe/List APIs in the first statement do not support resource scoping; all mutating actions are separately scoped.
  statement {
    sid    = "InspectPilotInfrastructure"
    effect = "Allow"
    actions = [
      "autoscaling:Describe*",
      "cloudwatch:Describe*",
      "cloudwatch:Get*",
      "cloudwatch:List*",
      "ec2:Describe*",
      "elasticloadbalancing:Describe*",
      "logs:Describe*",
      "logs:FilterLogEvents",
      "logs:GetLogEvents",
      "logs:StartQuery",
      "logs:StopQuery",
      "logs:GetQueryResults",
      "ssm:DescribeInstanceInformation"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ListApplicationBuckets"
    effect = "Allow"
    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket"
    ]
    resources = [var.uploads_bucket_arn, var.artifacts_bucket_arn]
  }

  statement {
    sid    = "ManageApplicationObjects"
    effect = "Allow"
    actions = [
      "s3:AbortMultipartUpload",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:ListMultipartUploadParts",
      "s3:PutObject"
    ]
    resources = ["${var.uploads_bucket_arn}/*", "${var.artifacts_bucket_arn}/*"]
  }

  statement {
    sid       = "InspectSecretMetadata"
    effect    = "Allow"
    actions   = ["secretsmanager:DescribeSecret", "secretsmanager:ListSecretVersionIds"]
    resources = [var.openai_secret_arn, var.app_secret_arn, var.cache_secret_arn]
  }

  statement {
    sid       = "StartTaggedInstanceSessions"
    effect    = "Allow"
    actions   = ["ssm:StartSession"]
    resources = ["arn:${data.aws_partition.current.partition}:ec2:${var.aws_region}:${var.account_id}:instance/*"]

    condition {
      test     = "StringEquals"
      variable = "ssm:resourceTag/Project"
      values   = [var.project_tag]
    }
  }

  statement {
    sid     = "UseSessionManagerDocuments"
    effect  = "Allow"
    actions = ["ssm:StartSession"]
    resources = [
      "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}::document/AWS-StartInteractiveCommand",
      "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}::document/AWS-StartPortForwardingSession"
    ]
  }

  statement {
    sid    = "ManageOwnSessions"
    effect = "Allow"
    actions = [
      "ssm:DescribeSessions",
      "ssm:GetConnectionStatus",
      "ssm:ResumeSession",
      "ssm:TerminateSession"
    ]
    resources = ["arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${var.account_id}:session/$${aws:username}-*"]
  }
}

resource "aws_iam_group_policy" "backend_developers" {
  name   = "${var.name_prefix}-backend-deployment"
  group  = aws_iam_group.backend_developers.name
  policy = data.aws_iam_policy_document.backend_developers.json
}

resource "aws_iam_group" "frontend_developers" {
  name = "${var.name_prefix}-frontend-developers"
  path = "/coursistant/"
}

data "aws_iam_policy_document" "frontend_developers" {
  #checkov:skip=CKV_AWS_356:CloudFront list APIs do not support resource scoping; mutating actions remain scoped to the pilot distribution.
  statement {
    sid    = "ListFrontendBucket"
    effect = "Allow"
    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket"
    ]
    resources = [var.frontend_bucket_arn]
  }

  statement {
    sid    = "ManageFrontendObjects"
    effect = "Allow"
    actions = [
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:PutObject"
    ]
    resources = ["${var.frontend_bucket_arn}/*"]
  }

  statement {
    sid    = "UseFrontendKmsKey"
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey*",
      "kms:ReEncrypt*"
    ]
    resources = [var.frontend_kms_key_arn]
  }

  statement {
    sid       = "InvalidateFrontendDistribution"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [var.cloudfront_distribution_arn]
  }

  statement {
    sid    = "InspectFrontendDistribution"
    effect = "Allow"
    actions = [
      "cloudfront:GetDistribution",
      "cloudfront:GetDistributionConfig",
      "cloudfront:GetInvalidation",
      "cloudfront:ListInvalidations"
    ]
    resources = [var.cloudfront_distribution_arn]
  }
}

resource "aws_iam_group_policy" "frontend_developers" {
  name   = "${var.name_prefix}-frontend-deployment"
  group  = aws_iam_group.frontend_developers.name
  policy = data.aws_iam_policy_document.frontend_developers.json
}
