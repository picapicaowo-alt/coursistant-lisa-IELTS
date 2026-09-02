output "application_url" {
  description = "Pilot URL. The ALB DNS fallback remains active until the external DNS record and HTTPS listener are enabled."
  value       = var.enable_https ? "https://${var.domain_name}" : "http://${module.compute.alb_dns_name}"
}

output "certificate_arn" {
  value = module.tls.certificate_arn
}

output "certificate_dns_validation" {
  value = module.tls.domain_validation_options
}

output "alb_dns_name" {
  value = module.compute.alb_dns_name
}

output "uploads_bucket_name" {
  value = module.storage.uploads_bucket_name
}

output "artifacts_bucket_name" {
  value = module.storage.artifacts_bucket_name
}

output "audit_bucket_name" {
  value = module.storage.audit_bucket_name
}

output "openai_secret_name" {
  value = module.security.openai_secret_name
}

output "application_secret_name" {
  value = module.security.app_secret_name
}

output "backend_developers_group_name" {
  value = module.identity.backend_developers_group_name
}

output "instance_role_arn" {
  value = module.compute.instance_role_arn
}

output "autoscaling_group_name" {
  value = module.compute.autoscaling_group_name
}

output "operations_topic_arn" {
  value = module.observability.operations_topic_arn
}

output "cloudwatch_dashboard_name" {
  value = module.observability.cloudwatch_dashboard_name
}

output "cache_replication_group_id" {
  value = module.cache.replication_group_id
}

output "cache_primary_endpoint" {
  value = module.cache.primary_endpoint_address
}

output "cache_port" {
  value = module.cache.port
}

output "cache_secret_name" {
  value = module.security.cache_secret_name
}

output "frontend_url" {
  value = var.enable_frontend_custom_domain ? "https://${var.frontend_domain_name}" : "https://${module.frontend.distribution_domain_name}"
}

output "frontend_bucket_name" {
  value = module.frontend.bucket_name
}

output "frontend_distribution_id" {
  value = module.frontend.distribution_id
}

output "frontend_distribution_domain_name" {
  value = module.frontend.distribution_domain_name
}

output "frontend_certificate_arn" {
  value = module.frontend.certificate_arn
}

output "frontend_certificate_dns_validation" {
  value = module.frontend.certificate_dns_validation
}

output "frontend_developers_group_name" {
  value = module.identity.frontend_developers_group_name
}
