import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { motion } from 'motion/react';
import { 
  Plus, 
  History, 
  FileText, 
  ArrowRight,
  Briefcase,
  GraduationCap,
  Award,
  Code,
  Sparkles
} from 'lucide-react';
import { Pointer, Resume } from '../types';
import { format } from 'date-fns';

interface DashboardProps {
  setCurrentView: (view: any) => void;
  onViewResume: (id: string) => void;
}

export default function Dashboard({ setCurrentView, onViewResume }: DashboardProps) {
  const [recentPointers, setRecentPointers] = useState<Pointer[]>([]);
  const [recentResumes, setRecentResumes] = useState<Resume[]>([]);
  const [totalPointers, setTotalPointers] = useState(0);
  const [totalResumes, setTotalResumes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Total counts
    const allPointersQuery = query(collection(db, 'users', auth.currentUser.uid, 'pointers'));
    const allResumesQuery = query(collection(db, 'users', auth.currentUser.uid, 'resumes'));

    const unsubTotalPointers = onSnapshot(allPointersQuery, (snapshot) => {
      setTotalPointers(snapshot.size);
    });

    const unsubTotalResumes = onSnapshot(allResumesQuery, (snapshot) => {
      setTotalResumes(snapshot.size);
    });

    // Recent items
    const pointersQuery = query(
      collection(db, 'users', auth.currentUser.uid, 'pointers'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const resumesQuery = query(
      collection(db, 'users', auth.currentUser.uid, 'resumes'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const unsubPointers = onSnapshot(pointersQuery, (snapshot) => {
      setRecentPointers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pointer)));
    });

    const unsubResumes = onSnapshot(resumesQuery, (snapshot) => {
      setRecentResumes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resume)));
      setLoading(false);
    });

    return () => {
      unsubTotalPointers();
      unsubTotalResumes();
      unsubPointers();
      unsubResumes();
    };
  }, []);

  const stats = [
    { label: 'Total Pointers', value: totalPointers, icon: History, action: () => setCurrentView('library') },
    { label: 'Resumes Built', value: totalResumes, icon: FileText, action: () => setCurrentView('resumes') },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold font-serif italic mb-2">Welcome back.</h1>
          <p className="text-stone-500">Your career memory is safe and structured.</p>
        </div>
        <button
          onClick={() => setCurrentView('builder')}
          className="w-full md:w-auto bg-stone-900 text-white px-6 py-3 font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,0.3)]"
        >
          <Plus className="w-5 h-5" />
          Build New Resume
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            onClick={stat.action}
            className="bg-white border border-stone-900 p-6 flex items-center justify-between cursor-pointer hover:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all"
          >
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-1">{stat.label}</p>
              <p className="text-3xl font-bold">{stat.value}</p>
            </div>
            <stat.icon className="w-8 h-8 text-stone-200" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Pointers */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold font-serif italic">Recent Pointers</h2>
            <button 
              onClick={() => setCurrentView('library')}
              className="text-sm font-bold text-stone-500 hover:text-stone-900 flex items-center gap-1"
            >
              View Library <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {recentPointers.length === 0 ? (
              <div className="bg-white border border-dashed border-stone-300 p-12 text-center">
                <p className="text-stone-400">No pointers added yet.</p>
                <button 
                  onClick={() => setCurrentView('library')}
                  className="mt-4 text-stone-900 font-bold underline"
                >
                  Add your first experience
                </button>
              </div>
            ) : (
              recentPointers.map((pointer) => (
                <motion.div 
                  key={pointer.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setCurrentView('library')}
                  className="bg-white border border-stone-900 p-4 flex items-center gap-4 hover:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 bg-stone-50 border border-stone-200 flex items-center justify-center">
                    {pointer.category === 'Work' && <Briefcase className="w-5 h-5" />}
                    {pointer.category === 'Internship' && <Briefcase className="w-5 h-5 text-stone-400" />}
                    {pointer.category === 'Project' && <Code className="w-5 h-5" />}
                    {pointer.category === 'Achievement' && <Award className="w-5 h-5" />}
                    {pointer.category === 'Skill' && <Sparkles className="w-5 h-5" />}
                    {pointer.category === 'Hobby' && <Sparkles className="w-5 h-5 text-stone-300" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{pointer.title}</h3>
                    <p className="text-xs text-stone-500">{pointer.category} • {pointer.startDate} - {pointer.isCurrent ? 'Present' : pointer.endDate}</p>
                  </div>
                  <div className="text-xs font-mono text-stone-300">
                    {format(new Date(pointer.createdAt), 'MMM d')}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Recent Resumes */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold font-serif italic">Recent Resumes</h2>
            <button 
              onClick={() => setCurrentView('resumes')}
              className="text-sm font-bold text-stone-500 hover:text-stone-900 flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {recentResumes.length === 0 ? (
              <div className="bg-white border border-dashed border-stone-300 p-12 text-center">
                <p className="text-stone-400">No resumes yet.</p>
              </div>
            ) : (
              recentResumes.map((resume) => (
                <div 
                  key={resume.id} 
                  onClick={() => onViewResume(resume.id)}
                  className="bg-white border border-stone-900 p-4 hover:bg-stone-50 cursor-pointer transition-colors group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold group-hover:text-stone-600 transition-colors">{resume.name}</h3>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                  </div>
                  <p className="text-xs text-stone-500 mb-3">{resume.targetRole}</p>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-stone-400">
                    <span>{format(new Date(resume.createdAt), 'MMM d, yyyy')}</span>
                    <FileText className="w-3 h-3" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
