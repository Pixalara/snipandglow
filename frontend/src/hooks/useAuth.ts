// PingFlow — Auth Hook
// Listens to Firebase auth state, resolves role (admin/employee), loads gym profile

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { auth, db, isDemo } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { logActivity } from '@/services/audit.service';
import type { Gym, UserRole, Branch } from '@/types';

async function loadBranches(gymId: string): Promise<Branch[]> {
  try {
    const q = query(collection(db, 'gyms', gymId, 'branches'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch));
  } catch {
    return [];
  }
}

async function resolveUserProfile(uid: string) {
  // 1. Check if user is a gym admin (has their own gym doc)
  const gymDoc = await getDoc(doc(db, 'gyms', uid));
  if (gymDoc.exists()) {
    const gymData = { id: gymDoc.id, ...gymDoc.data() } as Gym;
    return { gym: gymData, role: 'admin' as UserRole, gymId: uid };
  }

  // 2. Check if user is an employee via lookup doc
  const linkDoc = await getDoc(doc(db, 'employeeLinks', uid));
  if (linkDoc.exists()) {
    const linkData = linkDoc.data();
    const adminGymId = linkData?.gymId;
    if (adminGymId) {
      const adminGymDoc = await getDoc(doc(db, 'gyms', adminGymId));
      if (adminGymDoc.exists()) {
        const gymData = { id: adminGymDoc.id, ...adminGymDoc.data() } as Gym;
        // Override ownerName with employee's name for display purposes
        const employeeName = linkData?.name;
        if (employeeName) {
          gymData.ownerName = employeeName;
        }
        return { gym: gymData, role: (linkData?.role || 'employee') as UserRole, gymId: adminGymId };
      }
    }
  }

  // 3. Not onboarded yet
  return { gym: null, role: 'admin' as UserRole, gymId: null };
}

export function useAuth() {
  const { setUser, setGym, setRole, setGymId, setBranches, setActiveBranchId, setIsLoading, setIsWhatsAppVerified } = useAuthStore();

  useEffect(() => {
    if (isDemo) {
      const timeout = setTimeout(() => setIsLoading(false), 500);
      try {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          clearTimeout(timeout);
          if (firebaseUser) {
            setUser({
              uid: firebaseUser.uid,
              phoneNumber: firebaseUser.phoneNumber,
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL,
              displayName: firebaseUser.displayName,
            });
            try {
              const { gym, role, gymId } = await resolveUserProfile(firebaseUser.uid);
              setGym(gym);
              setRole(role);
              setGymId(gymId);
            } catch (error) {
              console.error('Failed to load profile:', error);
              setGym(null);
            }
          } else {
            setUser(null);
            setGym(null);
            setRole('admin');
            setGymId(null);
          }
          setIsLoading(false);
        });
        return () => { clearTimeout(timeout); unsubscribe(); };
      } catch {
        setIsLoading(false);
        return () => clearTimeout(timeout);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          phoneNumber: firebaseUser.phoneNumber,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          displayName: firebaseUser.displayName,
        });
        try {
          const { gym, role, gymId } = await resolveUserProfile(firebaseUser.uid);
          setGym(gym);
          setRole(role);
          setGymId(gymId);
          if (gym) {
            // Track WhatsApp verification status
            setIsWhatsAppVerified(gym.isWhatsAppVerified === true);
            // Load branches
            const branches = await loadBranches(gymId!);
            setBranches(branches);
            // Set active branch to the default or first one
            const defaultBranch = branches.find(b => b.isDefault) || branches[0];
            setActiveBranchId(gym.activeBranchId || defaultBranch?.id || null);
            // Defer login audit to next tick so store is updated
            setTimeout(() => logActivity('LOGIN', `Logged in to ${gym.name}`), 100);
          }
        } catch (error) {
          console.error('Failed to load profile:', error);
          setGym(null);
        }
      } else {
        setUser(null);
        setGym(null);
        setRole('admin');
        setGymId(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setGym, setRole, setGymId, setIsLoading]);

  return useAuthStore();
}
