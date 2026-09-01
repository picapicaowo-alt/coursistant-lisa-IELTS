# TLS module

Requests the Tokyo ACM certificate for the pilot API hostname. DNS is hosted outside AWS, so this module outputs the exact validation CNAME instead of attempting to manage another provider's zone. Keep `enable_https = false` until ACM reports `ISSUED`; then enable HTTPS in a reviewed second apply.
