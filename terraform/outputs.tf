output "public_ip" {
  description = "Static public IP of the instance. Point your DNS A record here."
  value       = aws_lightsail_static_ip.app.ip_address
}

output "instance_name" {
  value = aws_lightsail_instance.app.name
}

output "app_url" {
  description = "URL once the container is up (port 80 -> container 5000)."
  value       = "http://${aws_lightsail_static_ip.app.ip_address}"
}

output "ssh_command" {
  description = "SSH in (adjust key path; default user for Ubuntu blueprint is 'ubuntu')."
  value       = "ssh -i /path/to/lightsail-key.pem ubuntu@${aws_lightsail_static_ip.app.ip_address}"
}
