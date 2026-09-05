# Frontend delivery module

Creates a private, versioned, KMS-encrypted S3 origin; CloudFront Origin Access
Control; a dedicated access-log bucket; security response headers; a global
AWS WAF; and a DNS-validated ACM certificate in `us-east-1` for CloudFront.

Use two reviewed applies with externally hosted DNS. The first keeps
`enable_custom_domain = false`, deploys the distribution with its CloudFront
hostname, and outputs the ACM validation CNAME. After ACM reports `ISSUED`, set
the variable to `true`, apply the alias and certificate, and only then route the
public hostname to the distribution.

The module does not publish application artifacts. Upload an immutable frontend
build to the returned bucket and invalidate CloudFront as a separate release.
