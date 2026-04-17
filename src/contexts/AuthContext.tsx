import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, OperationType, SchoolAccount } from '../types';
import { handleFirestoreError } from '../lib/utils';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  schoolAccount: SchoolAccount | null;
  studentInfo: { name: string; class: string } | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithSchool: (username: string, password: string) => Promise<boolean>;
  setStudent: (name: string, className: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [schoolAccount, setSchoolAccount] = useState<SchoolAccount | null>(() => {
    const saved = localStorage.getItem('schoolAccount');
    return saved ? JSON.parse(saved) : null;
  });
  const [studentInfo, setStudentInfo] = useState<{ name: string; class: string } | null>(() => {
    const saved = localStorage.getItem('studentInfo');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Clear school account if logged in with Google
        setSchoolAccount(null);
        setStudentInfo(null);
        localStorage.removeItem('schoolAccount');
        localStorage.removeItem('studentInfo');
        
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            // Check if there's a pre-assigned role for this email
            const emailLower = user.email?.toLowerCase() || '';
            const tempId = `email_${emailLower.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const preDoc = await getDoc(doc(db, 'users', tempId));
            
            let finalRole: 'admin' | 'editor' | 'user' = user.email === 'nguyencam94@gmail.com' || user.email === 'modestman94@gmail.com' ? 'admin' : 'user';
            
            if (preDoc.exists()) {
              finalRole = preDoc.data().role;
              // Clean up temporary doc in the background
              deleteDoc(doc(db, 'users', tempId)).catch(e => console.error("Cleanup failed:", e));
            }

            const newProfile: UserProfile = {
              uid: user.uid,
              email: emailLower,
              role: finalRole,
            };
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        // User closed the popup or a previous request was cancelled, no action needed
        console.log('Login popup closed or cancelled');
      } else {
        console.error('Login error:', error);
        alert('Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại.');
      }
    }
  };

  const loginWithSchool = async (username: string, password: string): Promise<boolean> => {
    try {
      const q = query(
        collection(db, 'school_accounts'),
        where('username', '==', username),
        where('password', '==', password)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const account = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SchoolAccount;
        setSchoolAccount(account);
        localStorage.setItem('schoolAccount', JSON.stringify(account));
        // Logout Google if any
        if (user) await signOut(auth);
        return true;
      }
      return false;
    } catch (error) {
      console.error('School login error:', error);
      return false;
    }
  };

  const setStudent = (name: string, className: string) => {
    const info = { name, class: className };
    setStudentInfo(info);
    localStorage.setItem('studentInfo', JSON.stringify(info));
  };

  const logout = async () => {
    await signOut(auth);
    setSchoolAccount(null);
    setStudentInfo(null);
    localStorage.removeItem('schoolAccount');
    localStorage.removeItem('studentInfo');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      schoolAccount, 
      studentInfo, 
      loading, 
      login, 
      loginWithSchool, 
      setStudent, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
