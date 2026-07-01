# GCP auth: Application Default Credentials.
#   ! gcloud auth application-default login
#   ! gcloud auth application-default set-quota-project capture-the-king
provider "google" {
  project = var.project_id
  region  = var.region
}
