variable "name_prefix" {
  type = string
}

variable "account_id" {
  type = string
}

variable "log_group_prefix" {
  type = string
}

variable "audit_bucket_name" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "alb_arn_suffix" {
  type = string
}

variable "target_group_arn_suffix" {
  type = string
}

variable "autoscaling_group_name" {
  type = string
}

variable "monthly_budget_usd" {
  type = number
}

variable "budget_notification_emails" {
  description = "Optional billing alert recipients. Values are supplied outside source control."
  type        = list(string)
  default     = []
}

variable "tags" {
  type = map(string)
}
