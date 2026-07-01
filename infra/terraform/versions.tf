terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Remote state is optional. To keep state off your laptop, create a bucket
  # (e.g. `gsutil mb -l us-central1 gs://ctk-tfstate`) and uncomment:
  #
  # backend "gcs" {
  #   bucket = "ctk-tfstate"
  #   prefix = "capture-the-king"
  # }
}
