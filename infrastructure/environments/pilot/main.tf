module "network" {
  source = "../../modules/network"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)
  enable_nat_gateway = var.enable_nat_gateway
  log_group_prefix   = local.log_group_prefix
  kms_key_arn        = module.security.kms_key_arn
  tags               = local.common_tags
}

module "security" {
  source = "../../modules/security"

  name_prefix        = local.name_prefix
  aws_region         = var.aws_region
  account_id         = data.aws_caller_identity.current.account_id
  log_group_prefix   = local.log_group_prefix
  openai_secret_name = "/${var.project_name}/${var.environment}/openai"
  app_secret_name    = "/${var.project_name}/${var.environment}/application"
  cache_secret_name  = "/${var.project_name}/${var.environment}/cache"
  tags               = local.common_tags
}

module "storage" {
  source = "../../modules/storage"

  name_prefix          = local.name_prefix
  account_id           = data.aws_caller_identity.current.account_id
  kms_key_arn          = module.security.kms_key_arn
  cors_allowed_origins = var.cors_allowed_origins
  tags                 = local.common_tags
}

module "tls" {
  source = "../../modules/tls"

  domain_name = var.domain_name
  tags        = local.common_tags
}

module "compute" {
  source = "../../modules/compute"

  name_prefix                         = local.name_prefix
  aws_region                          = var.aws_region
  vpc_id                              = module.network.vpc_id
  vpc_cidr                            = module.network.vpc_cidr
  public_subnet_ids                   = module.network.public_subnet_ids
  private_subnet_ids                  = module.network.private_subnet_ids
  instance_type                       = var.instance_type
  root_volume_size_gib                = var.root_volume_size_gib
  app_port                            = var.app_port
  health_check_path                   = var.health_check_path
  log_group_prefix                    = local.log_group_prefix
  min_size                            = var.min_size
  desired_capacity                    = var.desired_capacity
  max_size                            = var.max_size
  certificate_arn                     = var.enable_https ? module.tls.certificate_arn : null
  kms_key_arn                         = module.security.kms_key_arn
  autoscaling_service_linked_role_arn = module.security.autoscaling_service_linked_role_arn
  uploads_bucket_arn                  = module.storage.uploads_bucket_arn
  artifacts_bucket_arn                = module.storage.artifacts_bucket_arn
  audit_bucket_name                   = module.storage.audit_bucket_name
  openai_secret_arn                   = module.security.openai_secret_arn
  openai_secret_name                  = module.security.openai_secret_name
  app_secret_arn                      = module.security.app_secret_arn
  app_secret_name                     = module.security.app_secret_name
  cache_secret_arn                    = module.security.cache_secret_arn
  cache_port                          = var.cache_port
  waf_rate_limit                      = var.waf_rate_limit
  tags                                = local.common_tags

  depends_on = [module.network, module.storage]
}

module "frontend" {
  source = "../../modules/frontend"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name_prefix          = local.name_prefix
  account_id           = data.aws_caller_identity.current.account_id
  domain_name          = var.frontend_domain_name
  enable_custom_domain = var.enable_frontend_custom_domain
  waf_rate_limit       = var.waf_rate_limit
  tags                 = local.common_tags
}

module "identity" {
  source = "../../modules/identity"

  name_prefix                 = local.name_prefix
  aws_region                  = var.aws_region
  account_id                  = data.aws_caller_identity.current.account_id
  project_tag                 = var.project_name
  uploads_bucket_arn          = module.storage.uploads_bucket_arn
  artifacts_bucket_arn        = module.storage.artifacts_bucket_arn
  openai_secret_arn           = module.security.openai_secret_arn
  app_secret_arn              = module.security.app_secret_arn
  cache_secret_arn            = module.security.cache_secret_arn
  frontend_bucket_arn         = module.frontend.bucket_arn
  frontend_kms_key_arn        = module.frontend.kms_key_arn
  cloudfront_distribution_arn = module.frontend.distribution_arn
}

module "observability" {
  source = "../../modules/observability"

  name_prefix                = local.name_prefix
  account_id                 = data.aws_caller_identity.current.account_id
  log_group_prefix           = local.log_group_prefix
  audit_bucket_name          = module.storage.audit_bucket_name
  kms_key_arn                = module.security.kms_key_arn
  alb_arn_suffix             = module.compute.alb_arn_suffix
  target_group_arn_suffix    = module.compute.target_group_arn_suffix
  autoscaling_group_name     = module.compute.autoscaling_group_name
  monthly_budget_usd         = var.monthly_budget_usd
  budget_notification_emails = var.budget_notification_emails
  tags                       = local.common_tags

  depends_on = [module.storage, module.compute]
}

module "cache" {
  source = "../../modules/cache"

  name_prefix                   = local.name_prefix
  vpc_id                        = module.network.vpc_id
  private_subnet_ids            = module.network.private_subnet_ids
  application_security_group_id = module.compute.application_security_group_id
  kms_key_arn                   = module.security.kms_key_arn
  cache_secret_arn              = module.security.cache_secret_arn
  notification_topic_arn        = module.observability.operations_topic_arn
  engine_version                = var.cache_engine_version
  node_type                     = var.cache_node_type
  port                          = var.cache_port
  snapshot_retention_days       = var.cache_snapshot_retention_days
  auth_token_version            = var.cache_auth_token_version
  tags                          = local.common_tags

  depends_on = [module.network, module.compute, module.observability]
}
