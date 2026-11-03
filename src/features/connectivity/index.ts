export {
  useConnectivityStore,
  recordConnectivityFailure,
} from "./store/connectivityStore";
export type { FailureEntry } from "./store/connectivityStore";
export {
  isConnectivityFailure,
  isPlaybackPath,
  statusOf,
  stripQuery,
} from "./lib/failureKind";
