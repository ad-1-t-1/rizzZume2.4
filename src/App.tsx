import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PointerLibrary from './components/PointerLibrary';
import ResumeBuilder from './components/ResumeBuilder';
import ResumeViewer from './components/ResumeViewer';
import ResumeList from './components/ResumeList';
import WorkPortfolio from './components/WorkPortfolio';
import { UserProfile } from './types';

import { handleFirestoreError, OperationType } from './utils/errorHandlers';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'library' | 'portfolio' | 'builder' | 'viewer' | 'resumes'>('dashboard');
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              photoURL: user.photoURL || '',
              createdAt: new Date().toISOString(),
            };
            try {
              await setDoc(doc(db, 'users', user.uid), newProfile);
              setProfile(newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user?.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-stone-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <Layout currentView={currentView} setCurrentView={setCurrentView} profile={profile}>
      {currentView === 'dashboard' && (
        <Dashboard 
          setCurrentView={setCurrentView} 
          onViewResume={(id) => {
            setSelectedResumeId(id);
            setCurrentView('viewer');
          }} 
        />
      )}
      {currentView === 'library' && <PointerLibrary />}
      {currentView === 'portfolio' && <WorkPortfolio />}
      {currentView === 'builder' && <ResumeBuilder />}
      {currentView === 'resumes' && (
        <ResumeList 
          onBack={() => setCurrentView('dashboard')} 
          onViewResume={(id) => {
            setSelectedResumeId(id);
            setCurrentView('viewer');
          }}
        />
      )}
      {currentView === 'viewer' && selectedResumeId && (
        <ResumeViewer 
          resumeId={selectedResumeId} 
          onBack={() => setCurrentView('dashboard')} 
        />
      )}
    </Layout>
  );
}
