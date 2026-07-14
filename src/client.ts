import { getJson, postJson, putJson, patchJson, del } from "./client/json.js";
import { get, post, put, patch, httpRequest, delAs, delVoid } from "./client/response-modes.js";
import { getText, head } from "./client/response.js";

export {
  type Schema,
  type RequestOptions,
  type JsonRequestOptions,
  type FetchSafeFetch,
  type RequestHook,
  type ResponseHook,
} from "./client/request.js";
export { getJson, postJson, putJson, patchJson, del } from "./client/json.js";
export { getText, head } from "./client/response.js";
export {
  get,
  post,
  put,
  patch,
  httpRequest,
  delAs,
  delVoid,
  type HttpRequestOptions,
  type HttpJsonRequestOptions,
  type ModeResult,
  type ResponseMode,
} from "./client/response-modes.js";
export {
  createClient,
  type ClientHeaders,
  type ClientOptions,
  type FetchSafeClient,
} from "./client/factory.js";

/** Convenience namespace for `http.getJson(...)` style usage. */
export const http = {
  request: httpRequest,
  get,
  post,
  put,
  patch,
  getJson,
  postJson,
  putJson,
  patchJson,
  del,
  delAs,
  delVoid,
  getText,
  head,
} as const;
