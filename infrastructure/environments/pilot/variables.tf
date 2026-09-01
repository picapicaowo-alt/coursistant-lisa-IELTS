variable "aws_region" {
  description = "Application region. Tokyo is required for the Mainland China pilot path."
  type        = string
  default     = "ap-northeast-1"

  validation {
    condition     = var.aws_region == "ap-northeast-1"
    error_message = "The approved pilot architecture is restricted to AWS Tokyo (ap-northeast-1)."
  }
}

variable "expected_account_id" {
  description = "AWS account guardrail. Terraform refuses to run when the active identity belongs to another account."
  type        = string
  default     = "658424472610"

  validation {
    condition     = can(regex("^[0-9]{12}$", var.expected_account_id))
    error_message = "expected_account_id must be a 12-digit AWS account ID."
  }
}

variable "project_name" {
  type    = string
  default = "coursistant-ielts"
}

variable "environment" {
  type    = string
  default = "pilot"

  validation {
    condition     = var.environment == "pilot"
    error_message = "This root module is only for the pilot environment."
  }
}

variable "owner" {
  type    = string
  default = "coursistant-platform"
}

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Required for private EC2 access to package registries and the OpenAI API."
  type        = bool
  default     = true
}

variable "instance_type" {
  description = "Approved 4 vCPU / 16 GiB pilot instance."
  type        = string
  default     = "m7i.xlarge"
}

variable "root_volume_size_gib" {
  type    = number
  default = 100

  validation {
    condition     = var.root_volume_size_gib >= 30
    error_message = "The root volume must be at least 30 GiB."
  }
}

variable "app_port" {
  type    = number
  default = 8080
}

variable "health_check_path" {
  type    = string
  default = "/health"
}

variable "min_size" {
  type    = number
  default = 1
}

variable "desired_capacity" {
  type    = number
  default = 1
}

variable "max_size" {
  type    = number
  default = 2
}

variable "certificate_arn" {
  description = "Optional ACM certificate ARN in Tokyo. Leave null for the temporary HTTP pilot endpoint."
  type        = string
  default     = null
  nullable    = true
}

variable "cors_allowed_origins" {
  description = "Exact browser origins allowed for direct S3 uploads. Empty disables S3 CORS."
  type        = list(string)
  default     = []
}

variable "waf_rate_limit" {
  type    = number
  default = 2000

  validation {
    condition     = var.waf_rate_limit >= 100
    error_message = "The WAF rate limit must be at least 100 requests per five-minute evaluation window."
  }
}

variable "monthly_budget_usd" {
  type    = number
  default = 400
}

variable "budget_notification_emails" {
  description = "Billing alert recipients supplied through an untracked terraform.tfvars file or CI variable."
  type        = list(string)
  default     = []
}

check "autoscaling_capacity" {
  assert {
    condition     = var.min_size <= var.desired_capacity && var.desired_capacity <= var.max_size
    error_message = "Auto Scaling capacity must satisfy min_size <= desired_capacity <= max_size."
  }
}
