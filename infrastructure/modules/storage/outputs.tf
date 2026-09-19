output "uploads_bucket_name" {
  value = aws_s3_bucket.this["uploads"].id
}

output "uploads_bucket_arn" {
  value = aws_s3_bucket.this["uploads"].arn
}

output "artifacts_bucket_name" {
  value = aws_s3_bucket.this["artifacts"].id
}

output "artifacts_bucket_arn" {
  value = aws_s3_bucket.this["artifacts"].arn
}

output "audit_bucket_name" {
  value = aws_s3_bucket.this["audit"].id
}

output "audit_bucket_arn" {
  value = aws_s3_bucket.this["audit"].arn
}
