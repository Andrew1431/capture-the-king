# Adopt the infrastructure that already exists (set up by hand per LIVE_STATUS.md)
# instead of recreating it. With these blocks a first `terraform apply` reconciles
# state to the live resources — it should show few or no changes, never a create.
#
# Delete a block once its resource is in state (after the apply that imports it).
# IDs below assume the default project/region; adjust if you overrode the vars.

import {
  to = google_artifact_registry_repository.ctk
  id = "projects/capture-the-king/locations/us-central1/repositories/ctk"
}

import {
  to = google_cloud_run_v2_service.server
  id = "projects/capture-the-king/locations/us-central1/services/ctk-server"
}

import {
  to = google_cloud_run_v2_service_iam_member.public_invoke
  id = "projects/capture-the-king/locations/us-central1/services/ctk-server roles/run.invoker allUsers"
}

import {
  to = google_service_account.gh_deployer
  id = "projects/capture-the-king/serviceAccounts/gh-deployer@capture-the-king.iam.gserviceaccount.com"
}

import {
  to = google_iam_workload_identity_pool.github
  id = "projects/capture-the-king/locations/global/workloadIdentityPools/github"
}

import {
  to = google_iam_workload_identity_pool_provider.github
  id = "projects/capture-the-king/locations/global/workloadIdentityPools/github/providers/github"
}

import {
  to = google_service_account_iam_member.gh_deployer_wif
  id = "projects/capture-the-king/serviceAccounts/gh-deployer@capture-the-king.iam.gserviceaccount.com roles/iam.workloadIdentityUser principalSet://iam.googleapis.com/projects/1054289488256/locations/global/workloadIdentityPools/github/attribute.repository/Andrew1431/capture-the-king"
}

import {
  to = google_service_account_iam_member.gh_deployer_actas_runtime
  id = "projects/capture-the-king/serviceAccounts/1054289488256-compute@developer.gserviceaccount.com roles/iam.serviceAccountUser serviceAccount:gh-deployer@capture-the-king.iam.gserviceaccount.com"
}

# Project-level role bindings for the deploy SA (one per role).
import {
  to = google_project_iam_member.gh_deployer["roles/run.admin"]
  id = "capture-the-king roles/run.admin serviceAccount:gh-deployer@capture-the-king.iam.gserviceaccount.com"
}
import {
  to = google_project_iam_member.gh_deployer["roles/cloudbuild.builds.editor"]
  id = "capture-the-king roles/cloudbuild.builds.editor serviceAccount:gh-deployer@capture-the-king.iam.gserviceaccount.com"
}
import {
  to = google_project_iam_member.gh_deployer["roles/storage.admin"]
  id = "capture-the-king roles/storage.admin serviceAccount:gh-deployer@capture-the-king.iam.gserviceaccount.com"
}
import {
  to = google_project_iam_member.gh_deployer["roles/artifactregistry.reader"]
  id = "capture-the-king roles/artifactregistry.reader serviceAccount:gh-deployer@capture-the-king.iam.gserviceaccount.com"
}

# Enabled APIs (safe to leave out — apply just re-enables, a no-op — but importing
# keeps the plan clean).
import {
  to = google_project_service.enabled["run.googleapis.com"]
  id = "capture-the-king/run.googleapis.com"
}
import {
  to = google_project_service.enabled["cloudbuild.googleapis.com"]
  id = "capture-the-king/cloudbuild.googleapis.com"
}
import {
  to = google_project_service.enabled["artifactregistry.googleapis.com"]
  id = "capture-the-king/artifactregistry.googleapis.com"
}
import {
  to = google_project_service.enabled["iamcredentials.googleapis.com"]
  id = "capture-the-king/iamcredentials.googleapis.com"
}
import {
  to = google_project_service.enabled["sts.googleapis.com"]
  id = "capture-the-king/sts.googleapis.com"
}

# Cloud Run domain mapping — only uncomment if the ws. mapping already exists live
# (LIVE_STATUS §2). If it doesn't, leave the resource in run.tf commented too.
# import {
#   to = google_cloud_run_domain_mapping.ws
#   id = "locations/us-central1/namespaces/capture-the-king/domainmappings/ws.capturetheking.hartwigdev.ca"
# }
