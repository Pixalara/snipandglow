// PingFlow — Global Wallet Hook
// Real-time wallet balance tracking from Firestore

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';

export function useWallet() {
  const { user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setBalance(0);
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'gyms', user.uid),
      (snap) => {
        const data = snap.data();
        setBalance(data?.walletBalance ?? 0);
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );

    return unsubscribe;
  }, [user?.uid]);

  return { balance, isLoading };
}
