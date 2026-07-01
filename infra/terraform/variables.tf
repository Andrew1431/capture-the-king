variable "project_id" {
  type        = string
  description = "GCP project ID."
  default     = "capture-the-king"
}

variable "project_number" {
  type        = string
  description = "GCP project number (used for the default compute service account)."
  default     = "1054289488256"
}

variable "region" {
  type        = string
  description = "Primary region for Cloud Run and Artifact Registry."
  default     = "us-central1"
}

variable "github_repo" {
  type        = string
  description = "owner/repo that CI runs from. Case-sensitive: it's matched against GitHub's OIDC claim."
  default     = "Andrew1431/capture-the-king"
}

variable "web_origin" {
  type        = string
  description = "Allowed browser origin for the server's Socket.IO CORS list."
  default     = "https://capturetheking.hartwigdev.ca"
}

variable "server_image" {
  type        = string
  description = "Container image the Cloud Run service runs."
  default     = "us-central1-docker.pkg.dev/capture-the-king/ctk/server:latest"
}

variable "ws_domain" {
  type        = string
  description = "Custom domain mapped to the Cloud Run service (WebSocket API)."
  default     = "ws.capturetheking.hartwigdev.ca"
}
