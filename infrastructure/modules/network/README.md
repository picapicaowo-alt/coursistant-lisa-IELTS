# Network module

Creates a two-AZ VPC with public ALB subnets, private workload subnets, an Internet Gateway, an optional single NAT Gateway, and an S3 Gateway Endpoint. It exports VPC and subnet IDs. The pilot deliberately uses one NAT Gateway to control cost; production can evolve the module to one NAT per AZ when the availability requirement justifies it.
