import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import type { NetworkReachability } from "./types";

function stateToReachability(state: NetInfoState): NetworkReachability {
  if (state.isConnected === false) return "offline";
  if (state.isConnected === true) {
    if (state.isInternetReachable === false) return "offline";
    return "online";
  }
  return "unknown";
}

/**
 * حالة الاتصال — تُحدَّث عند تغيّر الشبكة.
 */
export function useNetworkReachability(): NetworkReachability {
  const [reachability, setReachability] = useState<NetworkReachability>("unknown");

  useEffect(() => {
    let mounted = true;
    void NetInfo.fetch().then((s) => {
      if (mounted) setReachability(stateToReachability(s));
    });
    const unsub = NetInfo.addEventListener((s) => {
      setReachability(stateToReachability(s));
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return reachability;
}
