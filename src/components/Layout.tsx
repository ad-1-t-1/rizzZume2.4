import React from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { 
  LayoutDashboard, 
  Library, 
  FileText, 
  LogOut, 
  User as UserIcon,
  Sparkles,
  BookOpen,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { UserProfile } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  setCurrentView: (view: any) => void;
  profile: UserProfile | null;
}

export default function Layout({ children, currentView, setCurrentView, profile }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'library', label: 'Pointer Library', icon: Library },
    { id: 'portfolio', label: 'Work Portfolio', icon: BookOpen },
    { id: 'resumes', label: 'Resumes', icon: FileText },
    { id: 'builder', label: 'Resume Builder', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-stone-900 p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-stone-900" />
          <span className="text-xl font-bold italic font-serif">rizzZume</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 border border-stone-900 bg-white"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 border-r border-stone-900 flex flex-col bg-white z-50 transition-all duration-300 md:relative md:translate-x-0 shadow-2xl md:shadow-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}>
        <div className="hidden p-6 border-b border-stone-900 md:flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-stone-900 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="text-xl font-bold italic font-serif whitespace-nowrap">rizzZume</span>}
          </div>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 hover:bg-stone-100 rounded transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id);
                setIsSidebarOpen(false);
              }}
              title={isSidebarCollapsed ? item.label : ''}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 font-medium transition-all group relative",
                currentView === item.id 
                  ? "bg-stone-900 text-white shadow-[4px_4px_0px_0px_rgba(20,20,20,0.3)]" 
                  : "text-stone-600 hover:bg-stone-50",
                isSidebarCollapsed && "justify-center px-0"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", currentView === item.id ? "text-white" : "text-stone-400 group-hover:text-stone-900")} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
              {isSidebarCollapsed && currentView === item.id && (
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-white" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-stone-200">
          <div className={cn(
            "flex items-center gap-3 p-2 mb-4 bg-stone-50 border border-stone-100 rounded-lg",
            isSidebarCollapsed && "justify-center p-1"
          )}>
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="w-8 h-8 rounded-full border border-stone-900 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center border border-stone-900 flex-shrink-0">
                <UserIcon className="w-4 h-4 text-stone-400" />
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{profile?.displayName || 'User'}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-tighter truncate">{profile?.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => signOut(auth)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2 text-stone-500 hover:text-red-600 transition-colors text-sm font-bold uppercase tracking-widest",
              isSidebarCollapsed && "justify-center px-0"
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto w-full">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
