// gcs.mjs — shared Storage client builder.
import { Storage } from "@google-cloud/storage";

export function makeStorage() {
  if (process.env.GCS_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GCS_SERVICE_ACCOUNT_JSON);
    return new Storage({ credentials, projectId: credentials.project_id });
  }
  // Falls back to GOOGLE_APPLICATION_CREDENTIALS (path) or ADC.
  return new Storage();
}

export function bucket() {
  const name = process.env.GCS_BUCKET;
  if (!name) throw new Error("GCS_BUCKET is not set");
  return makeStorage().bucket(name);
}
