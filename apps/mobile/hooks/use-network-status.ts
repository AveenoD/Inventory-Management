import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

export function useNetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const apply = (state: NetInfoState) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    };
    const sub = NetInfo.addEventListener(apply);
    void NetInfo.fetch().then(apply);
    return () => sub();
  }, []);

  return { online };
}
