output "kms_key_arn" {
  value = aws_kms_key.application.arn
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
