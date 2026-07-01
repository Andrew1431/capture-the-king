locals {
  compute_sa = "${var.project_number}-compute@developer.gserviceaccount.com"
}

# Authoritative game server. Pinned to a single instance because state lives in
# the in-process MemoryStore (see LIVE_STATUS / PLAN §M7 for the Redis path).
resource "google_cloud_run_v2_service" "server" {
  project  = var.project_id
  location = var.region
  name     = "ctk-server"

  # Cloud Build redeploys :latest out of band; don't let terraform fight it.
  lifecycle {
    ignore_changes = [template[0].containers[0].image, client, client_version]
  }

  # Service-level scaling (both 0 = the defaults live carries). Per-revision
  # autoscaling is the template.scaling block below.
  scaling {
    min_instance_count = 0
  }

  template {
    service_account                  = local.compute_sa
    timeout                          = "3600s"
    max_instance_request_concurrency = 800

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    # session-affinity: keep a client pinned to the instance holding its game.
    session_affinity = true

    containers {
      image = var.server_image

      ports {
        container_port = 8080
      }

      env {
        name  = "WEB_ORIGIN"
        value = var.web_origin
      }
    }
  }

  depends_on = [google_project_service.enabled]
}

# --allow-unauthenticated
resource "google_cloud_run_v2_service_iam_member" "public_invoke" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.server.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Maps ws.capturetheking.hartwigdev.ca -> the service. Not created yet (LIVE_STATUS
# §2 is still pending), so it's commented out. To enable: verify the domain first
# (`gcloud domains verify capturetheking.hartwigdev.ca`), uncomment, add the CNAME
# in Cloudflare (DNS-only), then `terraform apply`.
# resource "google_cloud_run_domain_mapping" "ws" {
#   project  = var.project_id
#   location = var.region
#   name     = var.ws_domain
#
#   metadata {
#     namespace = var.project_id
#   }
#
#   spec {
#     route_name = google_cloud_run_v2_service.server.name
#   }
# }
