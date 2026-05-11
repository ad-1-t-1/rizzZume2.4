import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  Edit2,
  X,
  Upload,
  FileText,
  BookOpen,
  Link as LinkIcon,
  Check
} from 'lucide-react';
import { Pointer, Category, WorkDocument } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { extractPointersFromResume } from '../services/gemini';
import { extractTextFromFile, fileToBase64 } from '../utils/fileParser';
import { ConfirmModal, Toast, ToastType } from './ui/Modals';

export default function PointerLibrary() {
  const [pointers, setPointers] = useState<Pointer[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPointer, setEditingPointer] = useState<Pointer | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Category | 'All'>('All');
  const [isImporting, setIsImporting] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'users', auth.currentUser.uid, 'pointers'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setPointers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pointer)));
    });
    return unsub;
  }, []);

  const filteredPointers = pointers.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || 
                         p.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || p.category === filter;
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'pointers', id));
      showToast('Pointer deleted successfully');
    } catch (error) {
      showToast('Failed to delete pointer', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    console.log('Starting import process for file:', file.name, 'type:', file.type);
    setIsImporting(true);
    try {
      console.log('Extracting text from file...');
      let content = await extractTextFromFile(file);
      let extracted;

      if (!content || content.trim().length === 0) {
        console.log('No text extracted, attempting multimodal fallback...');
        // Gemini supports PDF and common image formats
        if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
          const base64 = await fileToBase64(file);
          extracted = await extractPointersFromResume({
            data: base64,
            mimeType: file.type || 'application/pdf'
          });
        } else {
          throw new Error("The file appears to be empty and is not a supported format for visual extraction (PDF or Image).");
        }
      } else {
        console.log('Text extracted successfully, length:', content.length);
        console.log('Sending text to AI for pointer extraction...');
        extracted = await extractPointersFromResume(content);
      }

      console.log('AI extraction complete, found:', extracted.length, 'pointers');
      
      if (!auth.currentUser) return;
      
      console.log('Saving extracted pointers to Firestore...');
      for (const p of extracted) {
        const path = `users/${auth.currentUser.uid}/pointers`;
        try {
          await addDoc(collection(db, path), {
            ...p,
            userId: auth.currentUser.uid,
            tags: [],
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          const errInfo = {
            error: err instanceof Error ? err.message : String(err),
            operationType: 'write',
            path: path,
            authInfo: {
              userId: auth.currentUser?.uid,
              email: auth.currentUser?.email,
            }
          };
          console.error('Firestore Permission Error:', JSON.stringify(errInfo));
          throw new Error(`Permission Error: ${err instanceof Error ? err.message : 'Missing or insufficient permissions'}. Please ensure you are logged in correctly.`);
        }
      }
      console.log('Import process finished successfully');
      showToast(`Successfully imported ${extracted.length} pointers from ${file.name}!`);
    } catch (error) {
      console.error('Import process failed:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Failed to import resume: ${errorMessage}`, 'error');
    } finally {
      setIsImporting(false);
      // Reset input
      e.target.value = '';
    }
  };

  return (
   <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-serif italic">Pointer Library</h1>
          <p className="text-stone-500 text-sm">Your career memory, structured for AI.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <label className="bg-white border border-stone-900 px-4 py-2 font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-stone-50 transition-all text-sm">
            <Upload className="w-4 h-4" />
            {isImporting ? 'Importing...' : 'Import'}
            <input type="file" className="hidden" onChange={handleImport} accept=".pdf,.docx,.txt" disabled={isImporting} />
          </label>
          <button
            onClick={() => { setEditingPointer(null); setIsFormOpen(true); }}
            className="bg-stone-900 text-white px-4 py-2 font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Pointer
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center bg-white border border-stone-900 p-2">
        <div className="flex-1 flex items-center gap-2 px-3 border-b md:border-b-0 md:border-r border-stone-100 pb-2 md:pb-0">
          <Search className="w-4 h-4 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search pointers..." 
            className="w-full bg-transparent border-none focus:ring-0 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="bg-transparent border-none focus:ring-0 text-sm font-bold pr-8 py-2 md:py-0"
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
        >
          <option value="All">All Categories</option>
          <option value="Work">Work</option>
          <option value="Internship">Internship</option>
          <option value="Project">Project</option>
          <option value="Achievement">Achievement</option>
          <option value="Education">Education</option>
          <option value="Skill">Skill</option>
          <option value="Extracurricular">Extracurricular</option>
          <option value="Hobby">Hobby</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence>
          {filteredPointers.map((pointer) => (
            <motion.div
              key={pointer.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-stone-900 p-6 relative group hover:shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-stone-100 border border-stone-900">
                  {pointer.category}
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setEditingPointer(pointer); setIsFormOpen(true); }}
                    className="p-1 text-stone-400 hover:text-stone-900 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirm(pointer.id)}
                    className="p-1 text-stone-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="text-xl font-bold mb-1">{pointer.title}</h3>
              <p className="text-sm text-stone-500 mb-4">{pointer.description}</p>
              
              <div className="space-y-2 mb-4">
                {pointer.bulletPoints.slice(0, 3).map((bullet, i) => (
                  <div key={i} className="flex gap-2 text-sm text-stone-600">
                    <span className="text-stone-900 font-bold">•</span>
                    <p className="line-clamp-1">{bullet}</p>
                  </div>
                ))}
                {pointer.bulletPoints.length > 3 && (
                  <p className="text-xs text-stone-400 font-bold italic">+{pointer.bulletPoints.length - 3} more bullets</p>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-stone-100 text-xs font-bold text-stone-400">
                <span>{pointer.startDate} — {pointer.isCurrent ? 'Present' : pointer.endDate}</span>
                {pointer.documentIds && pointer.documentIds.length > 0 && (
                  <div className="flex items-center gap-1 text-stone-900">
                    <FileText className="w-3 h-3" />
                    <span>{pointer.documentIds.length} Evidence</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {isFormOpen && (
        <PointerForm 
          pointer={editingPointer} 
          onClose={() => setIsFormOpen(false)} 
          showToast={showToast}
        />
      )}

      <ConfirmModal 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Delete Pointer"
        message="Are you sure you want to delete this career pointer? This action cannot be undone."
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

function PointerForm({ pointer, onClose, showToast }: { pointer: Pointer | null, onClose: () => void, showToast: (msg: string, type?: ToastType) => void }) {
  const [workDocs, setWorkDocs] = useState<WorkDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [formData, setFormData] = useState<Partial<Pointer>>(
    pointer || {
      title: '',
      description: '',
      category: 'Work',
      startDate: '',
      endDate: '',
      isCurrent: false,
      bulletPoints: [''],
      privateNotes: '',
      level: '',
      tags: [],
      documentIds: []
    }
  );

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'users', auth.currentUser.uid, 'work_documents'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setWorkDocs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkDocument)));
    });
    return unsub;
  }, []);

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setUploadingDoc(true);
    try {
      const content = await extractTextFromFile(file);
      const docRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'work_documents'), {
        userId: auth.currentUser.uid,
        title: file.name.split('.')[0],
        fileName: file.name,
        fileType: file.type,
        content: content,
        createdAt: new Date().toISOString()
      });

      setFormData(prev => ({
        ...prev,
        documentIds: [...(prev.documentIds || []), docRef.id]
      }));
      showToast(`Linked ${file.name} as evidence`);
    } catch (err) {
      console.error(err);
      showToast("Failed to upload evidence", "error");
    } finally {
      setUploadingDoc(false);
    }
  };

  const toggleDocSelection = (docId: string) => {
    setFormData(prev => {
      const currentIds = prev.documentIds || [];
      const isSelected = currentIds.includes(docId);
      return {
        ...prev,
        documentIds: isSelected 
          ? currentIds.filter(id => id !== docId)
          : [...currentIds, docId]
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const data = {
      ...formData,
      userId: auth.currentUser.uid,
      bulletPoints: formData.bulletPoints?.filter(b => b.trim() !== '') || [],
      createdAt: pointer?.createdAt || new Date().toISOString()
    };

    if (pointer) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'pointers', pointer.id), data);
      showToast('Pointer updated successfully');
    } else {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'pointers'), data);
      showToast('Pointer added successfully');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white border border-stone-900 w-full max-w-2xl max-h-[90vh] overflow-auto shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]"
      >
        <div className="p-6 border-b border-stone-900 flex justify-between items-center bg-stone-50">
          <h2 className="text-2xl font-bold font-serif italic">{pointer ? 'Edit Pointer' : 'New Pointer'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Title</label>
              <input 
                required
                type="text" 
                className="w-full border-stone-900 focus:ring-0 focus:border-stone-900 p-3 font-bold"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Senior Software Engineer"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Organization / Project Description</label>
              <input 
                required
                type="text" 
                className="w-full border-stone-900 focus:ring-0 focus:border-stone-900 p-3"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. Google Cloud Platform Team"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Category</label>
              <select 
                className="w-full border-stone-900 focus:ring-0 focus:border-stone-900 p-3 font-bold"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as any })}
              >
                <option value="Work">Work</option>
                <option value="Internship">Internship</option>
                <option value="Project">Project</option>
                <option value="Achievement">Achievement</option>
                <option value="Education">Education</option>
                <option value="Skill">Skill</option>
                <option value="Extracurricular">Extracurricular</option>
                <option value="Hobby">Hobby</option>
              </select>
            </div>

            {formData.category === 'Skill' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Skill Level / Proficiency</label>
                <input 
                  type="text" 
                  className="w-full border-stone-900 focus:ring-0 focus:border-stone-900 p-3"
                  value={formData.level || ''}
                  onChange={e => setFormData({ ...formData, level: e.target.value })}
                  placeholder="e.g. Expert, 90%, Intermediate"
                />
              </div>
            )}

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Timeline</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="month" 
                    className="flex-1 border-stone-900 focus:ring-0 focus:border-stone-900 p-2 text-sm"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  />
                  <span>—</span>
                  <input 
                    type="month" 
                    disabled={formData.isCurrent}
                    className="flex-1 border-stone-900 focus:ring-0 focus:border-stone-900 p-2 text-sm disabled:bg-stone-50 disabled:text-stone-300"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 pb-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 border-stone-900 text-stone-900 focus:ring-0"
                  checked={formData.isCurrent}
                  onChange={e => setFormData({ ...formData, isCurrent: e.target.checked })}
                />
                <span className="text-xs font-bold uppercase tracking-widest">Current</span>
              </label>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-400">Bullet Points</label>
              <button 
                type="button"
                onClick={() => setFormData({ ...formData, bulletPoints: [...(formData.bulletPoints || []), ''] })}
                className="text-xs font-bold text-stone-900 flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3 h-3" /> Add Bullet
              </button>
            </div>
            <div className="space-y-3">
              {formData.bulletPoints?.map((bullet, i) => (
                <div key={i} className="flex gap-2">
                  <span className="pt-3 font-bold text-stone-300">{i + 1}</span>
                  <textarea 
                    className="flex-1 border-stone-900 focus:ring-0 focus:border-stone-900 p-3 text-sm min-h-[80px]"
                    value={bullet}
                    onChange={e => {
                      const newBullets = [...(formData.bulletPoints || [])];
                      newBullets[i] = e.target.value;
                      setFormData({ ...formData, bulletPoints: newBullets });
                    }}
                    placeholder="Describe an achievement or responsibility..."
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      const newBullets = formData.bulletPoints?.filter((_, idx) => idx !== i);
                      setFormData({ ...formData, bulletPoints: newBullets });
                    }}
                    className="p-2 text-stone-300 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Private Notes (Optional)</label>
            <textarea 
              className="w-full border-stone-900 focus:ring-0 focus:border-stone-900 p-3 text-sm min-h-[100px]"
              value={formData.privateNotes}
              onChange={e => setFormData({ ...formData, privateNotes: e.target.value })}
              placeholder="Context for AI or yourself (not shown on resume)..."
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-400">Work Evidence Context</label>
              <label className="text-[10px] font-bold text-stone-900 flex items-center gap-1 cursor-pointer hover:underline">
                <Upload className="w-3 h-3" />
                {uploadingDoc ? 'Linking...' : 'Link New Document'}
                <input type="file" className="hidden" onChange={handleDocUpload} disabled={uploadingDoc} />
              </label>
            </div>
            
            <div className="max-h-40 overflow-y-auto border border-stone-200 p-2 space-y-1 bg-stone-50">
              {workDocs.length === 0 ? (
                <p className="text-[10px] text-stone-400 italic text-center py-4">No documents in portfolio. Link a new one above.</p>
              ) : (
                workDocs.map(doc => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => toggleDocSelection(doc.id)}
                    className={`w-full flex items-center justify-between p-2 text-xs transition-colors ${formData.documentIds?.includes(doc.id) ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-100'}`}
                  >
                    <div className="flex items-center gap-2">
                       <FileText className={`w-3 h-3 ${formData.documentIds?.includes(doc.id) ? 'text-stone-400' : 'text-stone-300'}`} />
                       <span className="line-clamp-1">{doc.title}</span>
                    </div>
                    {formData.documentIds?.includes(doc.id) && <Check className="w-3 h-3" />}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100 flex justify-end gap-4">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-3 font-bold text-stone-500 hover:text-stone-900 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="bg-stone-900 text-white px-8 py-3 font-bold shadow-[4px_4px_0px_0px_rgba(20,20,20,0.3)] hover:bg-stone-800 transition-all"
            >
              Save Pointer
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
