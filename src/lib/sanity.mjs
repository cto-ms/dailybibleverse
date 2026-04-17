// sanity.mjs — shared Sanity client.
import { createClient } from "@sanity/client";

export function makeSanityClient({ useCdn = false, withToken = true } = {}) {
  const projectId = process.env.SANITY_PROJECT_ID || "hx1r1wkd";
  const dataset = process.env.SANITY_DATASET || "production";
  const apiVersion = process.env.SANITY_API_VERSION || "2024-10-01";
  const token = withToken ? process.env.SANITY_WRITE_TOKEN : undefined;
  return createClient({ projectId, dataset, apiVersion, token, useCdn });
}
