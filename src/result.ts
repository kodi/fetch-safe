export {
  type Result,
  type ResultTuple,
  type ResultObject,
  type Ok,
  type Err,
  type ChainResult,
  type ResultMatchHandlers,
  ok,
  err,
  chainResult,
} from "./result-core.js";

export {
  type FetchError,
  HttpError,
  NetworkError,
  ParseError,
  ValidationError,
  isHttpError,
  isNetworkError,
  isParseError,
  isValidationError,
} from "./errors.js";
