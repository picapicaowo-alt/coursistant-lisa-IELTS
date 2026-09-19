variable "name_prefix" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "instance_type" {
  type = string
}

variable "root_volume_size_gib" {
  type = number
}

variable "app_port" {
  type = number
}

variable "health_check_path" {
  type = string
}

variable "log_group_prefix" {
  description = "CloudWatch Logs prefix configured in the instance agent."
  type        = string
}

variable "min_size" {
  type = number
}

variable "desired_capacity" {
  type = number
}

variable "max_size" {
  type = number
}

variable "certificate_arn" {
  description = "Optional ACM certificate ARN. HTTP serves the pilot directly when null; when set, HTTP redirects to HTTPS."
  type        = string
  default     = null
  nullable    = true
}

variable "kms_key_arn" {
  type = string
}

variable "autoscaling_service_linked_role_arn" {
  type = string
}

variable "uploads_bucket_arn" {
  type = string
}

variable "artifacts_bucket_arn" {
  type = string
}

variable "audit_bucket_name" {
  type = string
}

variable "openai_secret_arn" {
  type = string
}

variable "openai_secret_name" {
  type = string
}

variable "app_secret_arn" {
  type = string
}

variable "app_secret_name" {
  type = string
}

variable "cache_secret_arn" {
  type = string
}

variable "cache_port" {
  type = number
}

variable "waf_rate_limit" {
  description = "Maximum requests per five-minute evaluation window per source IP."
  type        = number
}

variable "tags" {
  type = map(string)
}
