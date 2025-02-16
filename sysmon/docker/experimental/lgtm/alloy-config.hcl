loki.source.file "nginx_logs" {
  targets = [
    { __path__ = "/var/log/nginx/access.log" },
    { __path__ = "/var/log/nginx/error.log" }
  ]
  forward_to = [loki.write.loki.receiver]
}

