import { del, getJson, patchJson, postJson, putJson } from "./json.js";
import { getText, head } from "./response.js";
import {
  delAs,
  delVoid,
  get,
  httpRequest,
  patch,
  post,
  put,
  type HttpJsonRequestOptions,
  type HttpRequestOptions,
  type ModeResult,
  type ResponseMode,
} from "./response-modes.js";
import type { FetchSafeFetch, RequestHook, RequestOptions, ResponseHook } from "./request.js";

export type ClientHeaders = HeadersInit | (() => HeadersInit | Promise<HeadersInit>);

export type ClientOptions = {
  /** Base URL prepended to relative request paths. */
  baseUrl?: string;
  /** Default headers, or a function for dynamic values like auth tokens. */
  headers?: ClientHeaders;
  /** Default request timeout in milliseconds. */
  timeout?: number;
  /** Custom fetch implementation shared by client calls. */
  fetch?: FetchSafeFetch;
  /** Called before each request after defaults and per-call options are merged. */
  onRequest?: RequestHook;
  /** Called after each HTTP response is received. */
  onResponse?: ResponseHook;
};

export type FetchSafeClient = ReturnType<typeof createClient>;

function joinUrl(baseUrl: string | undefined, url: string): string {
  if (!baseUrl || /^[a-z][a-z\d+.-]*:/i.test(url)) {
    return url;
  }

  return `${baseUrl.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}

function mergeHeaders(...headersList: Array<HeadersInit | undefined>): HeadersInit | undefined {
  const merged = new Headers();

  for (const headers of headersList) {
    if (!headers) {
      continue;
    }

    new Headers(headers).forEach((value, key) => {
      merged.set(key, value);
    });
  }

  return merged;
}

async function resolveClientHeaders(headers?: ClientHeaders): Promise<HeadersInit | undefined> {
  return typeof headers === "function" ? headers() : headers;
}

/** Create a reusable HTTP client with shared base URL, headers, timeout, hooks, and fetch. */
export function createClient(defaults: ClientOptions = {}) {
  async function withDefaults<T extends RequestOptions>(
    url: string,
    options?: T,
  ): Promise<[string, T & RequestOptions]> {
    const defaultHeaders = await resolveClientHeaders(defaults.headers);
    const mergedOptions = {
      ...options,
      timeout: options?.timeout ?? defaults.timeout,
      fetch: options?.fetch ?? defaults.fetch,
      onRequest: options?.onRequest ?? defaults.onRequest,
      onResponse: options?.onResponse ?? defaults.onResponse,
      headers: mergeHeaders(defaultHeaders, options?.headers),
    } as T & RequestOptions;

    return [joinUrl(defaults.baseUrl, url), mergedOptions];
  }

  return {
    async request<T = unknown, As extends ResponseMode = "json">(
      method: string,
      url: string,
      options?: HttpRequestOptions<T, As>,
    ) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return httpRequest<T, As>(method, fullUrl, mergedOptions as HttpRequestOptions<T, As>);
    },

    async get<T = unknown, As extends ResponseMode = "json">(
      url: string,
      options?: HttpRequestOptions<T, As>,
    ) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return get<T, As>(fullUrl, mergedOptions as HttpRequestOptions<T, As>);
    },

    async post<T = unknown, As extends ResponseMode = "json">(
      url: string,
      body?: unknown,
      options?: Omit<HttpJsonRequestOptions<T, As>, "body">,
    ) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return post<T, As>(
        fullUrl,
        body,
        mergedOptions as Omit<HttpJsonRequestOptions<T, As>, "body">,
      );
    },

    async put<T = unknown, As extends ResponseMode = "json">(
      url: string,
      body?: unknown,
      options?: Omit<HttpJsonRequestOptions<T, As>, "body">,
    ) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return put<T, As>(
        fullUrl,
        body,
        mergedOptions as Omit<HttpJsonRequestOptions<T, As>, "body">,
      );
    },

    async patch<T = unknown, As extends ResponseMode = "json">(
      url: string,
      body?: unknown,
      options?: Omit<HttpJsonRequestOptions<T, As>, "body">,
    ) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return patch<T, As>(
        fullUrl,
        body,
        mergedOptions as Omit<HttpJsonRequestOptions<T, As>, "body">,
      );
    },

    async del<T = unknown>(url: string, options?: RequestOptions<T>) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return del<T>(fullUrl, mergedOptions);
    },

    async delAs<T = unknown, As extends ResponseMode = "json">(
      url: string,
      options?: HttpRequestOptions<T, As>,
    ) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return delAs<T, As>(fullUrl, mergedOptions as HttpRequestOptions<T, As>);
    },

    async delVoid(url: string, options?: Omit<HttpRequestOptions<unknown, "void">, "as">) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return delVoid(fullUrl, mergedOptions);
    },

    async getJson<T = unknown>(url: string, options?: RequestOptions<T>) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return getJson<T>(fullUrl, mergedOptions);
    },

    async postJson<T = unknown>(url: string, body?: unknown, options?: RequestOptions<T>) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return postJson<T>(fullUrl, body, mergedOptions);
    },

    async putJson<T = unknown>(url: string, body?: unknown, options?: RequestOptions<T>) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return putJson<T>(fullUrl, body, mergedOptions);
    },

    async patchJson<T = unknown>(url: string, body?: unknown, options?: RequestOptions<T>) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return patchJson<T>(fullUrl, body, mergedOptions);
    },

    async getText(url: string, options?: RequestOptions) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return getText(fullUrl, mergedOptions);
    },

    async head(url: string, options?: RequestOptions) {
      const [fullUrl, mergedOptions] = await withDefaults(url, options);
      return head(fullUrl, mergedOptions);
    },
  };
}

export type { ModeResult, ResponseMode };
