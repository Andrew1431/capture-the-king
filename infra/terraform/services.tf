# Project APIs that must be enabled for the stack. Enabling an already-enabled
# API is a no-op, so these are safe to apply without importing.
locals {
  enabled_apis = [
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
  ]
}

resource "google_project_service" "enabled" {
  for_each = toset(local.enabled_apis)

  project = var.project_id
  service = each.value

  # Don't let terraform destroy disable APIs the rest of the project relies on.
  disable_on_destroy = false
}
