output "state_bucket_name" {
  description = "S3 bucket used by environment backends."
  value       = aws_s3_bucket.terraform_state.id
}

output "state_kms_key_arn" {
  description = "KMS key used to encrypt Terraform state."
  value       = aws_kms_key.terraform_state.arn
}

output "backend_configuration" {
  description = "Values to copy into an untracked backend.hcl file for terraform init."
  value = {
    bucket       = aws_s3_bucket.terraform_state.id
    encrypt      = true
    region       = var.aws_region
    use_lockfile = true
    kms_key_id   = aws_kms_key.terraform_state.arn
  }
}
