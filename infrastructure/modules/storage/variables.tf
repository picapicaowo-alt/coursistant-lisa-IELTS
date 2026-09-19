variable "name_prefix" {
  type = string
}

variable "account_id" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "cors_allowed_origins" {
  description = "Browser origins allowed to upload directly to S3. Leave empty until the production domain is known."
  type        = list(string)
  default     = []
}

variable "tags" {
  type = map(string)
}
