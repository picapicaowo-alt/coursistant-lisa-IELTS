locals {
  name_prefix      = "${var.project_name}-${var.environment}"
  log_group_prefix = "/${replace(var.project_name, "-", "/")}/${var.environment}"

  common_tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = var.owner
    Project     = var.project_name
    Repository  = "picapicaowo-alt/coursistant-lisa-IELTS"
  }
}
