variable "name_prefix" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "account_id" {
  type = string
}

variable "project_tag" {
  type = string
}

variable "uploads_bucket_arn" {
  type = string
}

variable "artifacts_bucket_arn" {
  type = string
}

variable "openai_secret_arn" {
  type = string
}

variable "app_secret_arn" {
  type = string
}

variable "cache_secret_arn" {
  type = string
}

variable "frontend_bucket_arn" {
  type = string
}

variable "frontend_kms_key_arn" {
  type = string
}

variable "cloudfront_distribution_arn" {
  type = string
}
