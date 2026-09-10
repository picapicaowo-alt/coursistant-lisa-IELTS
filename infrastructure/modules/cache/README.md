# Cache module

Creates a private, node-based ElastiCache for Valkey replication group for the
pilot. It uses cluster-mode disabled compatibility, TLS in transit, the pilot
customer-managed KMS key at rest, a one-day snapshot baseline, and a security
group that accepts port `6379` only from the application security group. A
write-only, ephemeral AUTH token is written directly to the dedicated cache
Secrets Manager container without entering Terraform state or plan output.

The initial pilot has one `cache.t4g.micro` node and therefore no automatic
failover. Add a replica and Multi-AZ before treating cache availability as a
production guarantee. Backend clients fetch the token through the EC2 instance
role and connect with TLS. Increment `auth_token_version` for a coordinated
rotation.
