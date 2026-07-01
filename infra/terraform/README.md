# Terraform — Capture the King GCP infrastructure

Infrastructure-as-code for the **GCP** side of the live stack (see
[`../../LIVE_STATUS.md`](../../LIVE_STATUS.md)). The infra was originally set up by
hand; this project **adopts** it via [`import` blocks](./imports.tf) rather than
recreating it. A `terraform plan` here has been verified to match live exactly
(0 add / 0 change / 0 destroy), so from now on infra changes go through these files
instead of ad-hoc `gcloud` commands.

**In scope (GCP):**

| File | Resources |
|---|---|
| `services.tf` | Enabled project APIs (run, cloudbuild, artifactregistry, iamcredentials, sts) |
| `artifact_registry.tf` | `ctk` Docker repo |
| `run.tf` | `ctk-server` Cloud Run service + public-invoke IAM (ws. domain mapping commented — not live yet) |
| `wif.tf` | `gh-deployer` SA + roles, Workload Identity pool/provider, CI impersonation |

**Out of scope (managed elsewhere, on purpose):**
- **Cloudflare** (Pages project + DNS) — handled by the GitHub workflow
  (`.github/workflows/deploy-web.yml`, wrangler Direct Upload). One-off, not re-touched.
- **Firestore rules** — Firebase CLI (`firebase deploy --only firestore:rules`).
- **Firebase Auth authorized domains** and the **billing budget** — dashboard.
- The **container image** — Cloud Build pushes `:latest`; `run.tf` ignores image drift
  so Terraform and CI don't fight.

## First-time adoption (run once)

You need GCP Application Default Credentials (already present on the maintainer's
machine):

```sh
gcloud auth application-default login
gcloud auth application-default set-quota-project capture-the-king
```

Then:

```sh
cd infra/terraform
terraform init
terraform plan     # should say: 17 to import, 0 to add, 0 to change, 0 to destroy
terraform apply    # performs the imports — writes state, changes nothing in GCP
```

After the apply the resources are in Terraform state. The `import` blocks in
`imports.tf` become no-ops (Terraform skips imports for resources already in state),
so you can leave them as the reproducible adoption recipe or delete them.

## Making infra changes after adoption

Edit the `.tf` file, then:

```sh
terraform plan     # review exactly what will change
terraform apply
```

That's the whole point: the diff tells you precisely what will happen before it
happens — no more wondering what got spun up.

## Notes

- **State is local** (`terraform.tfstate`, gitignored — it can hold values you don't
  want in git). It lives only on the machine that ran `apply`. If you want it durable
  / shareable, create a bucket and uncomment the `backend "gcs"` block in `versions.tf`,
  then `terraform init -migrate-state`.
- **ws. domain mapping** isn't live yet (LIVE_STATUS §2). When you set it up, uncomment
  the resource in `run.tf` and the matching `import` block, or let `apply` create it.
- To reverse-generate HCL for something that exists but isn't written here, add a bare
  `import` block for it and run `terraform plan -generate-config-out=generated.tf`.
