output "replication_group_id" {
  value = aws_elasticache_replication_group.this.id
}

output "arn" {
  value = aws_elasticache_replication_group.this.arn
}

output "primary_endpoint_address" {
  value = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "port" {
  value = aws_elasticache_replication_group.this.port
}

output "security_group_id" {
  value = aws_security_group.this.id
}

output "secret_arn" {
  value = var.cache_secret_arn
}
