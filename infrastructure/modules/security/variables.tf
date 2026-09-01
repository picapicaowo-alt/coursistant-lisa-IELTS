variable "name_prefix" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "account_id" {
  type = string
}

variable "log_group_prefix" {
  type = string
}

variable "openai_secret_name" {
  description = "Secrets Manager path that backend operators populate with OpenAI credentials."
  type        = string
}

variable "app_secret_name" {
  description = "Secrets Manager path for non-OpenAI application secrets."
  type        = string
}

variable "tags" {
  type = map(string)
}
