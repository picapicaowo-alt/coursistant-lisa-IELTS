output "kms_key_arn" {
  value = aws_kms_key.application.arn
}

output "autoscaling_service_linked_role_arn" {
  value = aws_iam_service_linked_role.autoscaling.arn
}

output "openai_secret_arn" {
  value = aws_secretsmanager_secret.openai.arn
}

output "openai_secret_name" {
  value = aws_secretsmanager_secret.openai.name
}

output "app_secret_arn" {
  value = aws_secretsmanager_secret.application.arn
}

output "app_secret_name" {
  value = aws_secretsmanager_secret.application.name
}

output "cache_secret_arn" {
  value = aws_secretsmanager_secret.cache.arn
}

output "cache_secret_name" {
  value = aws_secretsmanager_secret.cache.name
}
