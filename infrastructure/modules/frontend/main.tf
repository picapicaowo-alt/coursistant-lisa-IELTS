data "aws_partition" "current" {}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_acm_certificate" "this" {
  provider = aws.us_east_1

  domain_name       = var.domain_name
  validation_method = "DNS"
  key_algorithm     = "RSA_2048"

  options {
    certificate_transparency_logging_preference = "ENABLED"
  }

  tags = merge(var.tags, { Name = var.domain_name, Purpose = "frontend-tls" })

  lifecycle {
    create_before_destroy = true
  }
}

data "aws_iam_policy_document" "kms" {
  #checkov:skip=CKV_AWS_109:KMS key policies require Resource="*"; administration is restricted to this account root principal.
  #checkov:skip=CKV_AWS_111:CloudFront KMS use requires Resource="*" in the key policy and is restricted to this account's distributions.
  #checkov:skip=CKV_AWS_356:The key policy defines the resource boundary and therefore uses Resource="*".
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
    sid    = "AllowAccountCloudFrontDistributions"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = [
      "kms:Decrypt",
      "kms:DescribeKey"
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceAccount"
      values   = [var.account_id]
    }

    condition {
      test     = "ArnLike"
      variable = "AWS:SourceArn"
      values   = ["arn:${data.aws_partition.current.partition}:cloudfront::${var.account_id}:distribution/*"]
    }
  }
}

resource "aws_kms_key" "frontend" {
  description             = "Encrypts ${var.name_prefix} private frontend assets"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.kms.json
  tags                    = merge(var.tags, { Name = "${var.name_prefix}-frontend" })
}

resource "aws_kms_alias" "frontend" {
  name          = "alias/${var.name_prefix}-frontend"
  target_key_id = aws_kms_key.frontend.key_id
}

resource "aws_s3_bucket" "site" {
  #checkov:skip=CKV_AWS_18:CloudFront access logging is delivered to the dedicated log bucket below rather than recursively logging the origin bucket.
  #checkov:skip=CKV_AWS_144:The pilot accepts regional origin durability; cross-region replication is a production requirement.
  #checkov:skip=CKV2_AWS_62:Static frontend deployment has no event-consumer contract.
  bucket = "${var.name_prefix}-web-${var.account_id}"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-web", Purpose = "frontend-origin" })

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_ownership_controls" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    bucket_key_enabled = true

    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.frontend.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "site" {
  depends_on = [aws_s3_bucket_versioning.site]
  bucket     = aws_s3_bucket.site.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  rule {
    id     = "expire-noncurrent-releases"
    status = "Enabled"
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

resource "aws_s3_bucket" "logs" {
  #checkov:skip=CKV_AWS_18:This bucket is the terminal CloudFront access-log destination and is not recursively logged.
  #checkov:skip=CKV_AWS_144:The pilot accepts regional access-log durability; production can add replication after data-classification review.
  #checkov:skip=CKV_AWS_145:CloudFront standard logging requires an ACL-enabled bucket and uses SSE-S3 for delivery compatibility.
  #checkov:skip=CKV2_AWS_62:Access logs have no approved downstream event consumer.
  bucket = "${var.name_prefix}-frontend-logs-${var.account_id}"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-frontend-logs", Purpose = "frontend-access-logs" })

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_ownership_controls" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  depends_on = [aws_s3_bucket_versioning.logs]
  bucket     = aws_s3_bucket.logs.id

  rule {
    id     = "retain-cloudfront-access-logs"
    status = "Enabled"
    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    expiration {
      days = 365
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

data "aws_iam_policy_document" "logs" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["s3:*"]
    resources = [aws_s3_bucket.logs.arn, "${aws_s3_bucket.logs.arn}/*"]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "logs" {
  bucket = aws_s3_bucket.logs.id
  policy = data.aws_iam_policy_document.logs.json
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.name_prefix}-frontend"
  description                       = "SigV4 access from CloudFront to the private frontend bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${var.name_prefix}-frontend-security"
  comment = "Security headers for the Coursistant frontend"

  security_headers_config {
    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "SAMEORIGIN"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
      preload                    = true
    }

    xss_protection {
      mode_block = true
      override   = true
      protection = true
    }
  }
}

resource "aws_cloudwatch_log_group" "waf" {
  provider = aws.us_east_1

  #checkov:skip=CKV_AWS_158:A separate us-east-1 KMS key is deferred for the pilot; WAF still redacts authorization headers and retains logs for one year.
  name              = "aws-waf-logs-${var.name_prefix}-frontend"
  retention_in_days = 365
  tags              = var.tags
}

resource "aws_wafv2_web_acl" "this" {
  provider = aws.us_east_1

  #checkov:skip=CKV_AWS_192:AWSManagedRulesKnownBadInputsRuleSet is enabled below and maintained by AWS.
  name  = "${var.name_prefix}-frontend"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit"
    priority = 0

    action {
      block {}
    }

    statement {
      rate_based_statement {
        aggregate_key_type = "IP"
        limit              = var.waf_rate_limit
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-frontend-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = {
      common        = { priority = 1, name = "AWSManagedRulesCommonRuleSet" }
      known_bad     = { priority = 2, name = "AWSManagedRulesKnownBadInputsRuleSet" }
      ip_reputation = { priority = 3, name = "AWSManagedRulesAmazonIpReputationList" }
    }

    content {
      name     = rule.key
      priority = rule.value.priority

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = rule.value.name
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.name_prefix}-frontend-${rule.key}"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-frontend"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}

resource "aws_wafv2_web_acl_logging_configuration" "this" {
  provider = aws.us_east_1

  resource_arn            = aws_wafv2_web_acl.this.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }
}

resource "aws_cloudfront_distribution" "this" {
  #checkov:skip=CKV_AWS_310:Single private S3 origin is sufficient for the pilot; origin-group failover is a production enhancement.
  #checkov:skip=CKV_AWS_174:Stage 1 uses CloudFront's default certificate; stage 2 conditionally enforces TLSv1.2_2021 with the issued ACM certificate.
  #checkov:skip=CKV_AWS_374:The product is intentionally global; AWS WAF and rate limiting protect access without a geographic deny list.
  enabled             = true
  is_ipv6_enabled     = true
  wait_for_deployment = true
  comment             = "${var.name_prefix} frontend"
  default_root_object = "index.html"
  price_class         = "PriceClass_200"
  aliases             = var.enable_custom_domain ? [var.domain_name] : []
  web_acl_id          = aws_wafv2_web_acl.this.arn

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
    origin_id                = "frontend-s3"
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD", "OPTIONS"]
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
    target_origin_id           = "frontend-s3"
    viewer_protocol_policy     = "redirect-to-https"
  }

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
  }

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }

  logging_config {
    bucket          = aws_s3_bucket.logs.bucket_domain_name
    include_cookies = false
    prefix          = "cloudfront/"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn            = var.enable_custom_domain ? aws_acm_certificate.this.arn : null
    cloudfront_default_certificate = var.enable_custom_domain ? false : true
    minimum_protocol_version       = var.enable_custom_domain ? "TLSv1.2_2021" : null
    ssl_support_method             = var.enable_custom_domain ? "sni-only" : null
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-frontend", Purpose = "frontend-delivery" })

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [aws_s3_bucket_policy.logs]
}

data "aws_iam_policy_document" "site" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["s3:*"]
    resources = [aws_s3_bucket.site.arn, "${aws_s3_bucket.site.arn}/*"]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  statement {
    sid    = "AllowCloudFrontRead"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site.json
}
