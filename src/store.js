import { create } from 'zustand';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// Define your default permissions and roles as before
const ALL_PERMISSIONS = { /* ... your ALL_PERMISSIONS object ... */ };
const DEFAULT_ROLE_PERMISSIONS = { /* ... your DEFAULT_ROLE_PERMISSIONS object ... */ };

export const useAppStore = create((set, get) => ({
  // --- STATE ---
  user: null,
  userRole: null,
  userPermissions: {},
  userStates: [],
  isAuthLoading: true,
  toast: { show: false, message: '', type: '' },

  // --- ACTIONS ---
  setToast: (toastConfig) => set({ toast: toastConfig }),
  
  // Auth action to check user status
  checkAuth: () => {
    set({ isAuthLoading: true });
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          let role, permissionsData, assignedState;

          if (!userSnap.exists() || !userSnap.data().role) {
            role = 'user';
            permissionsData = DEFAULT_ROLE_PERMISSIONS.user;
            await setDoc(userRef, {
              email: user.email,
              role: role,
              permissions: permissionsData,
              lastLogin: new Date(),
              assignedState: ''
            }, { merge: true });
            assignedState = '';
          } else {
            const data = userSnap.data();
            role = data.role;
            permissionsData = data.permissions || DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.user;
            permissionsData = { ...ALL_PERMISSIONS, ...permissionsData };
            assignedState = data.assignedState || '';
          }
          
          set({
            user,
            userRole: role,
            userPermissions: permissionsData, // You can add your derivation logic here if needed
            userStates: assignedState ? [assignedState] : [],
            isAuthLoading: false
          });
        } catch (error) {
          console.error("Error checking user role:", error);
          set({ user: null, userRole: 'user', userPermissions: DEFAULT_ROLE_PERMISSIONS.user, userStates: [], isAuthLoading: false });
        }
      } else {
        set({ user: null, userRole: null, userPermissions: {}, userStates: [], isAuthLoading: false });
      }
    });
  },
  
  // Logout action
  logout: async () => {
    await signOut(auth);
    set({ user: null, userRole: null, userPermissions: {}, userStates: [] });
  },
}));