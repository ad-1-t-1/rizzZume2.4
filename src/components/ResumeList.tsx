import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { 
  FileText, 
  Search, 
  Trash2, 
  ChevronLeft,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { Resume } from '../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmModal, Toast, ToastType } from './ui/Modals';

interface ResumeListProps {
  onBack: () => void;
  onViewResume: (id: string) => void;
}

export default function ResumeList({ onBack, onViewResume }: ResumeListProps) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'users', auth.currentUser.uid, 'resumes'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setResumes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resume)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredResumes = resumes.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.targetRole.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'resumes', id));
      showToast('Resume deleted successfully');
    } catch (error) {
      showToast('Failed to delete resume', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-serif italic">All Resumes</h1>
            <p className="text-stone-500 text-sm">Manage your generated resumes.</p>
          </div>
        </div>
      </header>

      <div className="flex gap-4 items-center bg-white border border-stone-900 p-2">
        <div className="flex-1 flex items-center gap-2 px-3">
          <Search className="w-4 h-4 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search resumes..." 
            className="w-full bg-transparent border-none focus:ring-0 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-40 bg-stone-100 animate-pulse border border-stone-200" />
          ))
        ) : filteredResumes.length === 0 ? (
          <div className="col-span-full bg-white border border-dashed border-stone-300 p-12 text-center">
            <p className="text-stone-400">No resumes found matching your search.</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredResumes.map((resume) => (
              <motion.div
                key={resume.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-stone-900 p-6 relative group hover:shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] transition-all flex flex-col justify-between h-48"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <FileText className="w-6 h-6 text-stone-300" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(resume.id); }}
                      className="p-1 text-stone-300 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-bold text-lg line-clamp-1">{resume.name}</h3>
                  <p className="text-xs text-stone-500 line-clamp-1">{resume.targetRole}</p>
                </div>

                <div className="flex justify-between items-end pt-4 border-t border-stone-100">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                    {format(new Date(resume.createdAt), 'MMM d, yyyy')}
                  </div>
                  <button 
                    onClick={() => onViewResume(resume.id)}
                    className="text-xs font-bold flex items-center gap-1 hover:text-stone-600 transition-colors"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <ConfirmModal 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Delete Resume"
        message="Are you sure you want to delete this resume? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
