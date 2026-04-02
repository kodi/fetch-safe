export {
  type Result,
  type ResultTuple,
  type ResultObject,
  type Ok,
  type Err,
  type ChainResult,
  ok,
  err,
  chainResult,
} from "./result-core.js";

export { type FetchError, HttpError, NetworkError, ParseError, ValidationError } from "./errors.js";
