import { getJson, postJson, putJson, patchJson, del } from "./client/json.js";
import { getText, head } from "./client/response.js";

export { type Schema, type RequestOptions, type JsonRequestOptions } from "./client/request.js";
export { getJson, postJson, putJson, patchJson, del } from "./client/json.js";
export { getText, head } from "./client/response.js";

/** Convenience namespace for `http.getJson(...)` style usage. */
export const http = {
  getJson,
  postJson,
  putJson,
  patchJson,
  del,
  getText,
  head,
} as const;
