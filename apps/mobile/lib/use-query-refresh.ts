import { useCallback } from "react";

export function useQueryRefresh(refetch: () => unknown, isFetching: boolean) {
  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);
  return { refreshing: isFetching, onRefresh };
}
