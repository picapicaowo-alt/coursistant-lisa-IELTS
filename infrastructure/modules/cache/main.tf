resource "aws_elasticache_subnet_group" "this" {
  name        = "${var.name_prefix}-cache"
  description = "Private subnets for ${var.name_prefix} Valkey"
  subnet_ids  = var.private_subnet_ids
  tags        = merge(var.tags, { Name = "${var.name_prefix}-cache" })
}

resource "aws_security_group" "this" {
  name_prefix = "${var.name_prefix}-cache-"
  description = "Allows Valkey TLS only from the pilot application security group"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-cache" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "application" {
  security_group_id            = aws_security_group.this.id
  referenced_security_group_id = var.application_security_group_id
  description                  = "Valkey from pilot application instances"
  from_port                    = var.port
  ip_protocol                  = "tcp"
  to_port                      = var.port
}

ephemeral "random_password" "auth" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret_version" "cache" {
  secret_id                = var.cache_secret_arn
  secret_string_wo         = jsonencode({ REDIS_AUTH_TOKEN = ephemeral.random_password.auth.result })
  secret_string_wo_version = var.auth_token_version
}

resource "aws_elasticache_replication_group" "this" {
  #checkov:skip=CKV_AWS_31:The cache uses TLS plus auth_token_wo; its ephemeral token is written directly to Secrets Manager and never persisted in Terraform state or plan output.
  #checkov:skip=CKV2_AWS_50:The 300-person pilot accepts one cache node and no failover; a replica and Multi-AZ are mandatory before production.
  replication_group_id = "${var.name_prefix}-cache"
  description          = "Managed Valkey cache for ${var.name_prefix}"

  engine               = "valkey"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_clusters   = 1
  port                 = var.port
  parameter_group_name = "default.valkey8"

  automatic_failover_enabled = false
  multi_az_enabled           = false
  apply_immediately          = true

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.this.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  transit_encryption_mode    = "required"
  kms_key_id                 = var.kms_key_arn
  auth_token_wo              = ephemeral.random_password.auth.result
  auth_token_wo_version      = var.auth_token_version

  snapshot_retention_limit = var.snapshot_retention_days
  snapshot_window          = "17:00-18:00"
  maintenance_window       = "sun:18:00-sun:19:00"
  notification_topic_arn   = var.notification_topic_arn

  tags = merge(var.tags, { Name = "${var.name_prefix}-cache", Purpose = "application-cache" })

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [aws_secretsmanager_secret_version.cache]
}

resource "aws_cloudwatch_metric_alarm" "memory" {
  alarm_name          = "${var.name_prefix}-cache-memory"
  alarm_description   = "Valkey database memory usage is above 80 percent"
  namespace           = "AWS/ElastiCache"
  metric_name         = "DatabaseMemoryUsagePercentage"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  treat_missing_data  = "breaching"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.this.id
  }

  alarm_actions = [var.notification_topic_arn]
  ok_actions    = [var.notification_topic_arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "engine_cpu" {
  alarm_name          = "${var.name_prefix}-cache-engine-cpu"
  alarm_description   = "Valkey engine CPU is above 75 percent"
  namespace           = "AWS/ElastiCache"
  metric_name         = "EngineCPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 75
  treat_missing_data  = "breaching"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.this.id
  }

  alarm_actions = [var.notification_topic_arn]
  ok_actions    = [var.notification_topic_arn]
  tags          = var.tags
}
