variable "name_prefix" {
  type = string
}

variable "account_id" {
  type = string
}

variable "domain_name" {
  type = string
}

variable "enable_custom_domain" {
  description = "Use the external hostname only after the us-east-1 ACM certificate is ISSUED."
  type        = bool
  default     = false
}

variable "waf_rate_limit" {
  type    = number
  default = 2000
}

variable "tags" {
  type    = map(string)
  default = {}
}
