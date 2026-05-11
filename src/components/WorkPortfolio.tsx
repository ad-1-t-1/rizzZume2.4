import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  FileText, 
  Upload, 
  Trash2, 
  AlertCircle,
  File,
  Search,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { WorkDocument } from '../types';
import { motion, AnimatePresence } from 'motion/react';

// Using a simplified version of text extraction for now
async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  
  if (fileType === 'application/pdf') {
    // For PDF, we'd ideally use pdfjs-dist, but let's assume text extraction for now
    // or provide a placeholder for the user to paste text if extraction fails.
    return "Extracted PDF content would go here. In a real app, we'd use a PDF parser.";
  }
  
  if (fileType.startsWith('image/')) {
    return "Extracted Image text would go here. In a real app, we'd use OCR.";
  }
  
  if (fileType === 'text/plain') {
    return await file.text();
  }

  return "Unsupported file type for automatic extraction.";
}

export default function WorkPortfolio() {
  const [documents, setDocuments] = useState<WorkDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'work_documents'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkDocument)));
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !auth.currentUser) return;

    setUploading(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Basic size check (5MB)
        if (file.size > 5 * 1024 * 1024) {
          setError(`File ${file.name} is too large. Max 5MB.`);
          continue;
        }

        const content = await extractTextFromFile(file);
        
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'work_documents'), {
          userId: auth.currentUser.uid,
          title: file.name.split('.')[0],
          fileName: file.name,
          fileType: file.type,
          content: content,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to process file. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth.currentUser || !window.confirm("Are you sure you want to delete this document?")) return;
    
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'work_documents', id));
    } catch (err) {
      console.error("Delete error:", err);
      setError("Failed to delete document.");
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold font-serif italic mb-2">Work Portfolio</h1>
          <p className="text-stone-500 text-sm">Dump documents of your work. AI refers to these for building resumes.</p>
        </div>
        <div className="w-full md:w-auto">
          <label className="bg-stone-900 text-white px-6 py-3 font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,0.3)] cursor-pointer text-sm">
            <Upload className="w-5 h-5" />
            {uploading ? 'Processing...' : 'Upload Evidence'}
            <input 
              type="file" 
              className="hidden" 
              multiple 
              accept=".pdf,.txt,.doc,.docx,image/*"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 text-red-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300" />
          <input 
            type="text" 
            placeholder="Search documents..."
            className="w-full bg-white border border-stone-900 pl-12 pr-4 py-3 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-stone-100 animate-pulse border border-stone-200"></div>
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 p-20 text-center">
          <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-300 border border-stone-100">
            <BookOpen className="w-8 h-8" />
          </div>
          <p className="text-stone-400 max-w-md mx-auto">
            Your portfolio is empty. Upload project reports, design documents, or code samples to help the AI understand your work better.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredDocs.map((doc) => (
              <motion.div 
                key={doc.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-stone-900 p-6 flex flex-col justify-between group hover:shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] transition-all"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-stone-50 border border-stone-200 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-stone-400" />
                    </div>
                    <button 
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-stone-600 transition-colors">{doc.title}</h3>
                  <p className="text-xs text-stone-400 font-mono mb-4">{doc.fileName}</p>
                </div>
                
                <div className="pt-4 border-t border-stone-100 flex justify-between items-center">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                     {fileTypeToLabel(doc.fileType)}
                   </span>
                   <div className="flex items-center gap-1 text-xs font-bold text-stone-900 group-hover:translate-x-1 transition-transform">
                      Reference Only <ExternalLink className="w-3 h-3" />
                   </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function fileTypeToLabel(type: string) {
  if (type.includes('pdf')) return 'PDF Document';
  if (type.includes('image')) return 'Image / OCR';
  if (type.includes('text')) return 'Text File';
  if (type.includes('word')) return 'Word Doc';
  return 'Document';
}
