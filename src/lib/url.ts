type LocationLike = Pick<Location, "href" | "pathname" | "search">;
type HistoryLike = Pick<History, "replaceState" | "state">;

/** Remove an empty fragment without disturbing real anchors or auth callback fragments. */
export function removeBareHash(location: LocationLike, history: HistoryLike): boolean {
  if (!location.href.endsWith("#")) return false;

  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  return true;
}
