output "backend_developers_group_name" {
  value = aws_iam_group.backend_developers.name
}

output "frontend_developers_group_name" {
  value = aws_iam_group.frontend_developers.name
}

output "backend_developers_group_arn" {
  value = aws_iam_group.backend_developers.arn
}
