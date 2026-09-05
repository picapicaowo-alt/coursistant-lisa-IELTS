locals {
  buckets = {
    uploads = {
      force_destroy = false
      kms           = true
    }
    artifacts = {
      force_destroy = false
      kms           = true
    }
    audit = {
      force_destroy = false
      kms           = false
    }
  }
}

resource "aws_s3_bucket" "this" {
  #checkov:skip=CKV_AWS_18:CloudTrail and ALB delivery provide pilot audit coverage; a recursive log target for the audit bucket is intentionally not created.
  #checkov:skip=CKV_AWS_21:Versioning is enabled for every map member by aws_s3_bucket_versioning.this; source graph expansion cannot correlate the for_each resources.
  #checkov:skip=CKV_AWS_144:The single-region pilot accepts regional durability; cross-region replication is reserved for production data-classification requirements.
  #checkov:skip=CKV_AWS_145:Uploads and artifacts use the customer KMS key; audit uses SSE-S3 for ALB log-delivery compatibility. The source graph cannot distinguish map members.
  #checkov:skip=CKV2_AWS_6:Every map member has all four public-access-block controls enabled by aws_s3_bucket_public_access_block.this.
  #checkov:skip=CKV2_AWS_61:Every map member has an explicit lifecycle configuration in aws_s3_bucket_lifecycle_configuration.this.
  #checkov:skip=CKV2_AWS_62:Notifications require a reviewed backend event contract; none exists for the initial HTTP pilot.
  for_each = local.buckets

  bucket        = "${var.name_prefix}-${each.key}-${var.account_id}"
  force_destroy = each.value.force_destroy
  tags          = merge(var.tags, { Name = "${var.name_prefix}-${each.key}", Purpose = each.key })

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_ownership_controls" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = aws_s3_bucket.this

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id

  rule {
    bucket_key_enabled = each.key != "audit"

    apply_server_side_encryption_by_default {
      kms_master_key_id = each.key == "audit" ? null : var.kms_key_arn
      sse_algorithm     = each.key == "audit" ? "AES256" : "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = aws_s3_bucket.this

  depends_on = [aws_s3_bucket_versioning.this]
  bucket     = each.value.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  rule {
    id     = "noncurrent-version-retention"
    status = "Enabled"
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = each.key == "audit" ? 2555 : 90
    }
  }

  dynamic "rule" {
    for_each = each.key == "audit" ? [1] : []

    content {
      id     = "archive-audit-logs"
      status = "Enabled"
      filter {}

      transition {
        days          = 90
        storage_class = "GLACIER_IR"
      }
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  count = length(var.cors_allowed_origins) > 0 ? 1 : 0

  bucket = aws_s3_bucket.this["uploads"].id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

data "aws_iam_policy_document" "bucket" {
  for_each = aws_s3_bucket.this

  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      each.value.arn,
      "${each.value.arn}/*"
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  dynamic "statement" {
    for_each = each.key == "audit" ? [1] : []

    content {
      sid    = "AllowCloudTrailAclCheck"
      effect = "Allow"

      principals {
        type        = "Service"
        identifiers = ["cloudtrail.amazonaws.com"]
      }

      actions   = ["s3:GetBucketAcl"]
      resources = [each.value.arn]
    }
  }

  dynamic "statement" {
    for_each = each.key == "audit" ? [1] : []

    content {
      sid    = "AllowCloudTrailWrite"
      effect = "Allow"

      principals {
        type        = "Service"
        identifiers = ["cloudtrail.amazonaws.com"]
      }

      actions   = ["s3:PutObject"]
      resources = ["${each.value.arn}/cloudtrail/AWSLogs/${var.account_id}/*"]

      condition {
        test     = "StringEquals"
        variable = "s3:x-amz-acl"
        values   = ["bucket-owner-full-control"]
      }
    }
  }

  dynamic "statement" {
    for_each = each.key == "audit" ? [1] : []

    content {
      sid    = "AllowAlbLogDelivery"
      effect = "Allow"

      principals {
        type        = "Service"
        identifiers = ["logdelivery.elasticloadbalancing.amazonaws.com"]
      }

      actions   = ["s3:PutObject"]
      resources = ["${each.value.arn}/alb/AWSLogs/${var.account_id}/*"]
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  policy = data.aws_iam_policy_document.bucket[each.key].json
}
