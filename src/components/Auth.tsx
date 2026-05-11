import React from 'react';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { motion } from 'motion/react';
import { Sparkles, LogIn } from 'lucide-react';

export default function Auth() {
  const [error, setError] = React.useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  const handleLogin = async () => {
    setError(null);
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        setError("Login popup was blocked. Please enable popups for this site.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        setError("Login was cancelled.");
      } else {
        setError("Failed to sign in. Please check your connection and try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#E4E3E0] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white border border-stone-900 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] p-8 text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-stone-900 rounded-full">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-stone-900 mb-2 italic font-serif">rizzZume</h1>
        <p className="text-stone-600 mb-8">AI-powered career memory & resume generation.</p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-4 px-6 font-bold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingIn ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <LogIn className="w-5 h-5" />
          )}
          {isLoggingIn ? 'Connecting...' : 'Continue with Google'}
        </button>
        
        <div className="mt-8 pt-8 border-t border-stone-100 text-xs text-stone-400 uppercase tracking-widest">
          Secure • AI-Driven • Professional
        </div>
      </motion.div>
    </div>
  );
}
