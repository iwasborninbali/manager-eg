"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as firebaseAuth from 'firebase/auth';
import { GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Import Firestore functions
import { auth, db } from '../firebase/config'; // Import auth and db
import { Timestamp } from 'firebase/firestore'; // Import Timestamp type

// Define a type for our custom user data from Firestore
export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  first_name?: string; // Added optional first name
  last_name?: string;  // Added optional last name
  createdAt?: Timestamp; // Use Timestamp type from Firebase
  role?: string[]; // Changed type to array of strings
  // Add other fields from your Firestore user document as needed
}

interface AuthContextType {
  user: User | null; // Firebase Auth user
  userData: UserData | null; // User data from Firestore
  loading: boolean;
  googleSignIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null); // State for Firestore data
  const [loading, setLoading] = useState(true);

  const googleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google: ", error);
    }
  };

  const logOut = async () => {
    try {
      await firebaseAuth.signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // User is signed in, fetch their data from Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            // Combine Auth data with Firestore data if needed, or just use Firestore data
            setUserData({ uid: currentUser.uid, ...docSnap.data() } as UserData);
            console.log("User data loaded:", docSnap.data());
          } else {
            // Handle case where user exists in Auth but not Firestore (optional)
            console.log("No user data found in Firestore for UID:", currentUser.uid);
            // You might want to create a Firestore record here if it's missing
            // For now, set userData to null or a default structure
            setUserData(null); // Or set a default user data structure
          }
        } catch (error) {
          console.error("Error fetching user data from Firestore:", error);
          setUserData(null); // Clear data on error
        }
      } else {
        // User is signed out
        setUserData(null);
      }
      setLoading(false);
    });
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Dependency array is empty, runs once on mount

  return (
    // Provide userData in the context value
    <AuthContext.Provider value={{ user, userData, loading, googleSignIn, logOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 