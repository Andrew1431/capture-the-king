# Docker repo that holds the server image built by Cloud Build.
resource "google_artifact_registry_repository" "ctk" {
  project       = var.project_id
  location      = var.region
  repository_id = "ctk"
  format        = "DOCKER"
  description   = "Capture the King server images"

  depends_on = [google_project_service.enabled]
}
