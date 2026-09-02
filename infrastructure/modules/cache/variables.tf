variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "application_security_group_id" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "cache_secret_arn" {
  type = string
}

variable "notification_topic_arn" {
  type = string
}

variable "engine_version" {
  type    = string
  default = "8.2"
}

variable "node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "port" {
  type    = number
  default = 6379
}

variable "snapshot_retention_days" {
  type    = number
  default = 1

  validation {
    condition     = var.snapshot_retention_days >= 1 && var.snapshot_retention_days <= 35
    error_message = "snapshot_retention_days must be between 1 and 35."
  }
}

variable "auth_token_version" {
  description = "Increment to rotate the write-only Valkey AUTH token and Secrets Manager version together."
  type        = number
  default     = 1
}

variable "tags" {
  type    = map(string)
  default = {}
}
