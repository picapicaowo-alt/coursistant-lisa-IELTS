output "application_url" {
  description = "Temporary pilot URL. Replace with a Route 53 alias and ACM certificate before production use."
  value       = var.certificate_arn == null ? "http://${module.compute.alb_dns_name}" : "https://${module.compute.alb_dns_name}"
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
