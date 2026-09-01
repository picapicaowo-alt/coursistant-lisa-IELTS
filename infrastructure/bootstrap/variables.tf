variable "aws_region" {
  description = "AWS region that stores Terraform state. The application runs separately in Tokyo."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Stable project identifier used in resource names and tags."
  type        = string
  default     = "coursistant-ielts"
}

variable "owner" {
  description = "Team responsible for the infrastructure."
  type        = string
  default     = "coursistant-platform"
}

variable "state_bucket_name" {
  description = "Optional globally unique state bucket name. A deterministic account-scoped name is used when null."
  type        = string
  default     = null
  nullable    = true
}

variable "state_noncurrent_version_retention_days" {
  description = "Retention for superseded Terraform state object versions."
  type        = number
  default     = 365

  validation {
    condition     = var.state_noncurrent_version_retention_days >= 90
    error_message = "Terraform state versions must be retained for at least 90 days."
  }
}
