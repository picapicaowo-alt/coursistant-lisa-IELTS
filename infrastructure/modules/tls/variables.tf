variable "domain_name" {
  description = "Fully qualified pilot API hostname validated through the external DNS provider."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", var.domain_name))
    error_message = "domain_name must be a lowercase fully qualified DNS name."
  }
}

variable "tags" {
  type = map(string)
}
