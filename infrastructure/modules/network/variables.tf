variable "name_prefix" {
  description = "Prefix applied to network resource names."
  type        = string
}

variable "vpc_cidr" {
  description = "IPv4 CIDR for the VPC."
  type        = string
}

variable "availability_zones" {
  description = "Two availability zones used for public and private subnets."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) == 2
    error_message = "Exactly two availability zones are required."
  }
}

variable "enable_nat_gateway" {
  description = "Create a single NAT gateway for private workload egress."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
}
