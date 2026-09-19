output "operations_topic_arn" {
  value = aws_sns_topic.operations.arn
}

output "cloudwatch_dashboard_name" {
  value = aws_cloudwatch_dashboard.this.dashboard_name
}

output "cloudtrail_arn" {
  value = aws_cloudtrail.this.arn
}
