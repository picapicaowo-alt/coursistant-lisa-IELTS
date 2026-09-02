output "bucket_name" {
  value = aws_s3_bucket.site.id
}

output "bucket_arn" {
  value = aws_s3_bucket.site.arn
}

output "kms_key_arn" {
  value = aws_kms_key.frontend.arn
}

output "distribution_id" {
  value = aws_cloudfront_distribution.this.id
}

output "distribution_arn" {
  value = aws_cloudfront_distribution.this.arn
}

output "distribution_domain_name" {
  value = aws_cloudfront_distribution.this.domain_name
}

output "certificate_arn" {
  value = aws_acm_certificate.this.arn
}

output "certificate_dns_validation" {
  value = [for option in aws_acm_certificate.this.domain_validation_options : {
    domain_name           = option.domain_name
    resource_record_name  = option.resource_record_name
    resource_record_type  = option.resource_record_type
    resource_record_value = option.resource_record_value
  }]
}

output "waf_web_acl_arn" {
  value = aws_wafv2_web_acl.this.arn
}
