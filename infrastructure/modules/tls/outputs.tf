output "certificate_arn" {
  description = "Tokyo ACM certificate ARN. Attach it only after status becomes ISSUED."
  value       = aws_acm_certificate.this.arn
}

output "domain_validation_options" {
  description = "CNAME records that the external DNS owner must add for ACM validation."
  value = [
    for option in aws_acm_certificate.this.domain_validation_options : {
      domain_name           = option.domain_name
      resource_record_name  = option.resource_record_name
      resource_record_type  = option.resource_record_type
      resource_record_value = option.resource_record_value
    }
  ]
}
