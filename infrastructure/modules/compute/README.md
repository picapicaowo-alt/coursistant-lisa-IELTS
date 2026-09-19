# Compute module

Creates the ALB, target group, WAF, private EC2 launch template, instance role, and Auto Scaling Group. Instances use Amazon Linux 2023, encrypted gp3, IMDSv2, detailed monitoring, Systems Manager, and no SSH/public IP. A bootstrap Nginx health endpoint lets infrastructure acceptance finish before backend deployment.
