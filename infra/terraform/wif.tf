# Keyless CI: GitHub Actions impersonates a deploy SA via Workload Identity
# Federation. No service-account key is ever stored in GitHub.

resource "google_service_account" "gh_deployer" {
  project      = var.project_id
  account_id   = "gh-deployer"
  display_name = "GitHub Actions deployer"
}

# Roles the deploy SA needs to build the image and roll out Cloud Run.
locals {
  gh_deployer_roles = [
    "roles/run.admin",
    "roles/cloudbuild.builds.editor",
    "roles/storage.admin",
    "roles/artifactregistry.reader",
  ]
}

resource "google_project_iam_member" "gh_deployer" {
  for_each = toset(local.gh_deployer_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gh_deployer.email}"
}

# Let the deploy SA deploy a service that RUNS AS the Cloud Run runtime SA.
resource "google_service_account_iam_member" "gh_deployer_actas_runtime" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${local.compute_sa}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.gh_deployer.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  # Lock the provider to this one repo.
  attribute_condition = "assertion.repository=='${var.github_repo}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Only this repo may impersonate the deploy SA.
resource "google_service_account_iam_member" "gh_deployer_wif" {
  service_account_id = google_service_account.gh_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

output "gcp_wif_provider" {
  description = "Value for the GCP_WIF_PROVIDER GitHub Actions variable."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "gcp_deploy_sa" {
  description = "Value for the GCP_DEPLOY_SA GitHub Actions variable."
  value       = google_service_account.gh_deployer.email
}
