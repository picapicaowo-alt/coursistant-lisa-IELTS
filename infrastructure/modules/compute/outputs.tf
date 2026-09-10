output "alb_arn" {
  value = aws_lb.this.arn
}

output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "alb_arn_suffix" {
  value = aws_lb.this.arn_suffix
}

output "alb_zone_id" {
  value = aws_lb.this.zone_id
}

output "target_group_arn" {
  value = aws_lb_target_group.application.arn
}

output "target_group_arn_suffix" {
  value = aws_lb_target_group.application.arn_suffix
}

output "autoscaling_group_name" {
  value = aws_autoscaling_group.this.name
}

output "instance_role_arn" {
  value = aws_iam_role.instance.arn
}

output "application_security_group_id" {
  value = aws_security_group.application.id
}

output "waf_web_acl_arn" {
  value = aws_wafv2_web_acl.this.arn
}
