import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { 
  Download, 
  ArrowLeft, 
  Edit3, 
  Save,
  Code,
  FileText,
  X,
  Check,
  Plus
} from 'lucide-react';
import { Resume, Pointer } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface ResumeViewerProps {
  resumeId: string;
  onBack: () => void;
}

export default function ResumeViewer({ resumeId, onBack }: ResumeViewerProps) {
  const [resume, setResume] = useState<Resume | null>(null);
  const [pointers, setPointers] = useState<Pointer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [headerOverrides, setHeaderOverrides] = useState<any>({});
  const [pointerOverrides, setPointerOverrides] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [customizedBullets, setCustomizedBullets] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    const fetchResume = async () => {
      if (!auth.currentUser) return;
      try {
        const resumeDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'resumes', resumeId));
        if (resumeDoc.exists()) {
          const data = resumeDoc.data() as Resume;
          setResume(data);
          setEditedContent(data.latexContent || null);
          setCustomizedBullets(data.customizedBullets || {});
          setHeaderOverrides(data.headerOverrides || {
            name: auth.currentUser?.displayName || '',
            email: auth.currentUser?.email || '',
            phone: '',
            linkedin: '',
            github: '',
            location: '',
            targetRole: data.targetRole || '',
            nameFontSize: 36
          });
          setPointerOverrides(data.overrides || {});
        }
      } catch (error) {
        console.error("Error fetching resume:", error);
      }
    };

    const fetchPointers = () => {
      if (!auth.currentUser) return;
      const q = query(collection(db, 'users', auth.currentUser.uid, 'pointers'), orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snapshot) => {
        setPointers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pointer)));
        setLoading(false);
      });
    };

    fetchResume();
    const unsub = fetchPointers();
    return unsub;
  }, [resumeId]);

  const handleSave = async () => {
    if (!auth.currentUser || !resume) return;
    setSaving(true);
    try {
      const resumeRef = doc(db, 'users', auth.currentUser.uid, 'resumes', resumeId);
      await updateDoc(resumeRef, {
        latexContent: editedContent,
        headerOverrides,
        overrides: pointerOverrides,
        customizedBullets
      });
      setIsEditing(false);
      setResume({
        ...resume,
        latexContent: editedContent,
        headerOverrides,
        overrides: pointerOverrides,
        customizedBullets
      });
    } catch (error) {
      console.error("Error saving resume:", error);
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = async () => {
    const element = document.getElementById('resume-preview');
    if (!element) return;
    
    setLoading(true);
    try {
      // Temporarily force dimensions for high quality capture
      const originalStyle = element.style.cssText;
      element.style.width = '794px'; // A4 width at 96 DPI
      element.style.minHeight = 'auto';
      element.style.padding = '40px';
      
      const canvas = await html2canvas(element, { 
        scale: 3, // Higher scale for better clarity
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('resume-preview');
          if (el) {
            el.style.width = '794px';
          }
        }
      });
      
      // Restore original style
      element.style.cssText = originalStyle;
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      
      // Handle multiple pages if height exceeds A4
      let heightLeft = finalHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', (pdfWidth - finalWidth) / 2, position, finalWidth, finalHeight);
      heightLeft -= pdfHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - finalHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', (pdfWidth - finalWidth) / 2, position, finalWidth, finalHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`${resume?.name || 'resume'}.pdf`);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("Failed to generate PDF. Please try again or use a different browser.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-stone-900"></div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500 mb-4">Resume not found.</p>
        <button onClick={onBack} className="text-stone-900 font-bold underline">Go Back</button>
      </div>
    );
  }

  const selectedPointers = pointers.filter(p => resume.pointerIds.includes(p.id));

  const PointerEditor = ({ id, data }: { id: string, data: any }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
      <div className="absolute -left-12 top-0 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button 
          onClick={() => setIsOpen(true)}
          className="p-2 bg-white border border-stone-200 rounded-full shadow-sm hover:bg-stone-50 text-stone-400 hover:text-stone-900"
          title="Edit Entry Details"
        >
          <Edit3 className="w-4 h-4" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
              >
                <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg">Edit Entry Details</h3>
                  <button onClick={() => setIsOpen(false)} className="text-stone-400 hover:text-stone-900">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Title / Organization</label>
                    <input 
                      type="text"
                      className="w-full p-2 border border-stone-200 rounded focus:ring-1 focus:ring-stone-900 outline-none"
                      value={data.title}
                      onChange={e => updatePointerOverride(id, 'title', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Description / Role</label>
                    <input 
                      type="text"
                      className="w-full p-2 border border-stone-200 rounded focus:ring-1 focus:ring-stone-900 outline-none"
                      value={data.description}
                      onChange={e => updatePointerOverride(id, 'description', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Start Date</label>
                      <input 
                        type="text"
                        placeholder="e.g. Jan 2020"
                        className="w-full p-2 border border-stone-200 rounded focus:ring-1 focus:ring-stone-900 outline-none"
                        value={data.startDate || ''}
                        onChange={e => updatePointerOverride(id, 'startDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">End Date</label>
                      <input 
                        type="text"
                        placeholder="e.g. Dec 2022"
                        disabled={data.isCurrent}
                        className="w-full p-2 border border-stone-200 rounded focus:ring-1 focus:ring-stone-900 outline-none disabled:bg-stone-50 disabled:text-stone-400"
                        value={data.endDate || ''}
                        onChange={e => updatePointerOverride(id, 'endDate', e.target.value)}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${data.isCurrent ? 'bg-stone-900 border-stone-900' : 'border-stone-300 group-hover:border-stone-900'}`}>
                      {data.isCurrent && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input 
                      type="checkbox"
                      className="hidden"
                      checked={data.isCurrent || false}
                      onChange={e => updatePointerOverride(id, 'isCurrent', e.target.checked)}
                    />
                    <span className="text-sm font-medium text-stone-600">I currently work/study here</span>
                  </label>
                </div>

                <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-end">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="bg-stone-900 text-white px-6 py-2 rounded font-bold hover:bg-stone-800 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const getPointerData = (id: string) => {
    const original = pointers.find(p => p.id === id);
    const override = pointerOverrides[id] || {};
    return {
      title: override.title !== undefined ? override.title : original?.title,
      description: override.description !== undefined ? override.description : original?.description,
      startDate: override.startDate !== undefined ? override.startDate : original?.startDate,
      endDate: override.endDate !== undefined ? override.endDate : original?.endDate,
      isCurrent: override.isCurrent !== undefined ? override.isCurrent : original?.isCurrent,
      bulletPoints: customizedBullets[id] || original?.bulletPoints || [],
      level: original?.level
    };
  };

  const updatePointerOverride = (id: string, field: string, value: any) => {
    setPointerOverrides((prev: any) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-2 font-bold text-stone-500 hover:text-stone-900 transition-all text-sm">
          <ArrowLeft className="w-5 h-5" /> Back to List
        </button>
        <div className="flex flex-col sm:flex-row gap-3">
          {isEditing ? (
            <>
              <button 
                onClick={() => setIsEditing(false)} 
                className="bg-white border border-stone-200 px-4 py-2 font-bold flex items-center justify-center gap-2 hover:bg-stone-50 text-sm"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="bg-stone-900 text-white px-4 py-2 font-bold flex items-center justify-center gap-2 hover:bg-stone-800 disabled:bg-stone-400 text-sm"
              >
                {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setIsEditing(true)} 
                className="bg-white border border-stone-900 px-4 py-2 font-bold flex items-center justify-center gap-2 hover:bg-stone-50 text-sm"
              >
                <Edit3 className="w-4 h-4" /> Edit
              </button>
              {resume.templateId === 'latex' && (
                <button 
                  onClick={() => {
                    const blob = new Blob([editedContent || ''], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${resume.name}.tex`;
                    a.click();
                  }} 
                  className="bg-white border border-stone-900 px-4 py-2 font-bold flex items-center justify-center gap-2 hover:bg-stone-50 text-sm"
                >
                  <Code className="w-4 h-4" /> LaTeX
                </button>
              )}
              <button 
                onClick={exportPDF} 
                className="bg-stone-900 text-white px-4 py-2 font-bold flex items-center justify-center gap-2 hover:bg-stone-800 text-sm"
              >
                <Download className="w-4 h-4" /> PDF
              </button>
            </>
          )}
        </div>
      </header>

      <div className="bg-white border border-stone-900 p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
        {isEditing ? (
          <div className="space-y-8 mb-8 pb-8 border-b border-stone-100">
            <h2 className="text-xl font-bold font-serif italic">Edit Header Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Full Name</label>
                <input 
                  type="text" 
                  className="w-full border-stone-900 p-2 text-sm"
                  value={headerOverrides.name}
                  onChange={e => setHeaderOverrides({...headerOverrides, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Email</label>
                <input 
                  type="email" 
                  className="w-full border-stone-900 p-2 text-sm"
                  value={headerOverrides.email}
                  onChange={e => setHeaderOverrides({...headerOverrides, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Phone</label>
                <input 
                  type="text" 
                  className="w-full border-stone-900 p-2 text-sm"
                  value={headerOverrides.phone}
                  onChange={e => setHeaderOverrides({...headerOverrides, phone: e.target.value})}
                  placeholder="e.g. +1 234 567 890"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Location</label>
                <input 
                  type="text" 
                  className="w-full border-stone-900 p-2 text-sm"
                  value={headerOverrides.location}
                  onChange={e => setHeaderOverrides({...headerOverrides, location: e.target.value})}
                  placeholder="e.g. Mumbai, India"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">LinkedIn</label>
                <input 
                  type="text" 
                  className="w-full border-stone-900 p-2 text-sm"
                  value={headerOverrides.linkedin}
                  onChange={e => setHeaderOverrides({...headerOverrides, linkedin: e.target.value})}
                  placeholder="linkedin.com/in/username"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">GitHub</label>
                <input 
                  type="text" 
                  className="w-full border-stone-900 p-2 text-sm"
                  value={headerOverrides.github}
                  onChange={e => setHeaderOverrides({...headerOverrides, github: e.target.value})}
                  placeholder="github.com/username"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Target Role / Headline</label>
                <input 
                  type="text" 
                  className="w-full border-stone-900 p-2 text-sm"
                  value={headerOverrides.targetRole}
                  onChange={e => setHeaderOverrides({...headerOverrides, targetRole: e.target.value})}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold font-serif italic">{resume.name}</h1>
              <p className="text-stone-500">{resume.targetRole}</p>
            </div>
            <div className="text-right text-xs font-bold text-stone-400 uppercase tracking-widest">
              Created on {new Date(resume.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Resume Content */}
        {resume.templateId === 'latex' && editedContent !== null ? (
          <div className="bg-stone-900 p-8 rounded-lg">
            <h3 className="text-white font-bold flex items-center gap-2 mb-4"><Code className="w-4 h-4" /> LaTeX Content</h3>
            {isEditing ? (
              <textarea 
                className="w-full h-[600px] bg-stone-800 text-stone-100 font-mono text-xs p-4 overflow-auto rounded focus:ring-1 focus:ring-stone-500 outline-none"
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
              />
            ) : (
              <pre className="w-full h-[600px] bg-stone-800 text-stone-100 font-mono text-xs p-4 overflow-auto rounded whitespace-pre-wrap">
                {editedContent}
              </pre>
            )}
          </div>
        ) : (
            <div id="resume-preview" className={`bg-white border border-[#f5f5f4] p-6 md:p-12 w-full min-h-[1122px] h-max text-[#1c1917] font-sans mx-auto overflow-visible ${resume.templateId === 'minimal' || resume.templateId === 'classic' ? 'font-serif' : ''}`}>
            {resume.templateId === 'modern' && (
              <>
                <header className="border-b-2 border-[#1c1917] pb-6 mb-8">
                  <h1 
                    className="font-bold uppercase tracking-tighter mb-2"
                    style={{ fontSize: `${headerOverrides.nameFontSize || 36}px` }}
                  >
                    {headerOverrides.name || auth.currentUser?.displayName}
                  </h1>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-[#78716c] uppercase tracking-widest">
                    <span>{headerOverrides.email || auth.currentUser?.email}</span>
                    {headerOverrides.phone && <span>• {headerOverrides.phone}</span>}
                    {headerOverrides.location && <span>• {headerOverrides.location}</span>}
                    {headerOverrides.linkedin && <span>• {headerOverrides.linkedin}</span>}
                    {headerOverrides.github && <span>• {headerOverrides.github}</span>}
                    <span>• {headerOverrides.targetRole || resume.targetRole}</span>
                  </div>
                </header>

                <div className="space-y-8">
                  {['Education', 'Work', 'Internship', 'Project', 'Skill', 'Extracurricular', 'Achievement', 'Hobby'].map(category => {
                    const categoryPointers = resume.pointerIds.filter(id => {
                      const p = pointers.find(ptr => ptr.id === id);
                      return p?.category === category;
                    });
                    if (categoryPointers.length === 0) return null;

                    return (
                      <section key={category} className="page-break-inside-avoid">
                        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#a8a29e] mb-4">
                          {category === 'Work' ? 'Professional Experience' : category}
                        </h2>
                        <div className="space-y-6">
                          {categoryPointers.map(id => {
                            const data = getPointerData(id);
                            return (
                              <div key={id} className="group relative">
                                {isEditing && <PointerEditor id={id} data={data} />}
                                <div className="flex justify-between items-baseline mb-1">
                                  <div className="flex items-baseline gap-2">
                                    <h3 className="font-bold text-lg">{data.title}</h3>
                                    {data.level && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded uppercase tracking-wider">
                                        {data.level}
                                      </span>
                                    )}
                                  </div>
                                  {(data.startDate || data.endDate || data.isCurrent) && (
                                    <span className="text-xs font-bold text-[#a8a29e]">
                                      {data.startDate} {data.startDate && (data.endDate || data.isCurrent) ? '—' : ''} {data.isCurrent ? 'Present' : data.endDate}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-bold text-[#78716c] uppercase mb-2">{data.description}</p>
                                <ul className="space-y-1">
                                  {data.bulletPoints.map((bullet, i) => (
                                    <li key={i} className="text-sm leading-relaxed flex gap-2">
                                      <span className="font-bold">•</span>
                                      {isEditing ? (
                                        <textarea 
                                          className="flex-1 border-none focus:ring-1 focus:ring-stone-100 p-1 -m-1 text-sm min-h-[20px] resize-none rounded transition-all"
                                          value={bullet}
                                          rows={bullet.split('\n').length || 1}
                                          onChange={e => {
                                            const newBullets = [...data.bulletPoints];
                                            newBullets[i] = e.target.value;
                                            setCustomizedBullets(prev => ({ ...prev, [id]: newBullets }));
                                          }}
                                        />
                                      ) : (
                                        <span>{bullet}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            )}

            {resume.templateId === 'minimal' && (
              <div className="flex flex-col items-center">
                <header className="text-center mb-12">
                  <h1 
                    className="font-light tracking-[0.3em] uppercase mb-4"
                    style={{ fontSize: `${headerOverrides.nameFontSize || 30}px` }}
                  >
                    {headerOverrides.name || auth.currentUser?.displayName}
                  </h1>
                  
                  <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-bold text-[#a8a29e] uppercase tracking-widest mb-4">
                  </div>

                  <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-bold text-[#a8a29e] uppercase tracking-widest">
                    <span>{headerOverrides.email || auth.currentUser?.email}</span>
                    {headerOverrides.phone && <span>/ {headerOverrides.phone}</span>}
                    {headerOverrides.location && <span>/ {headerOverrides.location}</span>}
                    {headerOverrides.linkedin && <span>/ {headerOverrides.linkedin}</span>}
                    {headerOverrides.github && <span>/ {headerOverrides.github}</span>}
                    <span>/ {headerOverrides.targetRole || resume.targetRole}</span>
                  </div>
                </header>

                <div className="w-full max-w-2xl space-y-12">
                  {['Education', 'Work', 'Internship', 'Project', 'Skill', 'Extracurricular', 'Achievement', 'Hobby'].map(category => {
                    const categoryPointers = resume.pointerIds.filter(id => {
                      const p = pointers.find(ptr => ptr.id === id);
                      return p?.category === category;
                    });
                    if (categoryPointers.length === 0) return null;

                    return (
                      <section key={category} className="page-break-inside-avoid">
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#1c1917] mb-8 text-center border-b pb-2">
                          {category === 'Work' ? 'Professional Experience' : category === 'Extracurricular' ? 'Extracurricular Activities' : category}
                        </h2>
                        <div className="space-y-10">
                          {categoryPointers.map(id => {
                            const data = getPointerData(id);
                            return (
                              <div key={id} className="group relative">
                                {isEditing && <PointerEditor id={id} data={data} />}
                                <div className="text-center mb-4">
                                  <div className="flex justify-center items-center gap-2 mb-1">
                                    <h3 className="text-lg font-bold tracking-widest uppercase">{data.title}</h3>
                                    {data.level && (
                                      <span className="text-[9px] font-bold px-1 py-0.5 border border-stone-200 text-stone-400 rounded uppercase tracking-widest">
                                        {data.level}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] font-bold text-[#a8a29e] uppercase tracking-widest mt-1">
                                    {data.description} {data.description && (data.startDate || data.endDate || data.isCurrent) ? '•' : ''} {data.startDate} {data.startDate && (data.endDate || data.isCurrent) ? '—' : ''} {data.isCurrent ? 'Present' : data.endDate}
                                  </p>
                                </div>
                                <ul className="space-y-2">
                                  {data.bulletPoints.map((bullet, i) => (
                                    <li key={i} className="text-sm leading-relaxed text-stone-600 text-center italic">
                                      {isEditing ? (
                                        <textarea 
                                          className="w-full border-none focus:ring-1 focus:ring-stone-100 p-1 -m-1 text-sm min-h-[20px] resize-none text-center bg-transparent rounded transition-all"
                                          value={bullet}
                                          rows={bullet.split('\n').length || 1}
                                          onChange={e => {
                                            const newBullets = [...data.bulletPoints];
                                            newBullets[i] = e.target.value;
                                            setCustomizedBullets(prev => ({ ...prev, [id]: newBullets }));
                                          }}
                                        />
                                      ) : (
                                        <span>{bullet}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            )}

            {resume.templateId === 'classic' && (
              <div className="max-w-3xl mx-auto">
                <header className="text-center border-b-4 border-stone-900 pb-6 mb-8">
                  <h1 
                    className="font-bold mb-4"
                    style={{ fontSize: `${headerOverrides.nameFontSize || 48}px` }}
                  >
                    {headerOverrides.name || auth.currentUser?.displayName}
                  </h1>
                  
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-bold uppercase mb-4">
                  </div>

                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-bold uppercase">
                    <span>{headerOverrides.email || auth.currentUser?.email}</span>
                    {headerOverrides.phone && <span>| {headerOverrides.phone}</span>}
                    {headerOverrides.location && <span>| {headerOverrides.location}</span>}
                    {headerOverrides.linkedin && <span>| {headerOverrides.linkedin}</span>}
                    {headerOverrides.github && <span>| {headerOverrides.github}</span>}
                    <span>| {headerOverrides.targetRole || resume.targetRole}</span>
                  </div>
                </header>

                <div className="space-y-8">
                  {['Education', 'Work', 'Internship', 'Project', 'Skill', 'Extracurricular', 'Achievement', 'Hobby'].map(category => {
                    const categoryPointers = resume.pointerIds.filter(id => {
                      const p = pointers.find(ptr => ptr.id === id);
                      return p?.category === category;
                    });
                    if (categoryPointers.length === 0) return null;

                    return (
                      <section key={category} className="page-break-inside-avoid">
                        <h2 className="text-lg font-bold uppercase border-b-2 border-stone-900 mb-4">
                          {category === 'Work' ? 'Professional Experience' : category === 'Extracurricular' ? 'Extracurricular Activities' : category}
                        </h2>
                        <div className="space-y-6">
                          {categoryPointers.map(id => {
                            const data = getPointerData(id);
                            return (
                              <div key={id} className="group relative">
                                {isEditing && <PointerEditor id={id} data={data} />}
                                <div className="flex justify-between items-start mb-1">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-bold text-base">{data.title}</h3>
                                      {data.level && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded uppercase tracking-wider">
                                          {data.level}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm italic">{data.description}</p>
                                  </div>
                                  {(data.startDate || data.endDate || data.isCurrent) && (
                                    <span className="text-sm font-bold">
                                      {data.startDate} {data.startDate && (data.endDate || data.isCurrent) ? '—' : ''} {data.isCurrent ? 'Present' : data.endDate}
                                    </span>
                                  )}
                                </div>
                                <ul className="space-y-1 ml-4">
                                  {data.bulletPoints.map((bullet, i) => (
                                    <li key={i} className="text-sm leading-relaxed list-disc">
                                      {isEditing ? (
                                        <textarea 
                                          className="w-full border-none focus:ring-1 focus:ring-stone-100 p-1 -m-1 text-sm min-h-[20px] resize-none bg-transparent rounded transition-all"
                                          value={bullet}
                                          rows={bullet.split('\n').length || 1}
                                          onChange={e => {
                                            const newBullets = [...data.bulletPoints];
                                            newBullets[i] = e.target.value;
                                            setCustomizedBullets(prev => ({ ...prev, [id]: newBullets }));
                                          }}
                                        />
                                      ) : (
                                        <span>{bullet}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            )}

            {resume.templateId === 'executive' && (
              <div className="flex gap-8 min-h-[1000px]">
                <aside className="w-1/3 border-r border-stone-200 pr-8">
                  <div className="mb-8">
                    <h1 
                      className="font-bold text-stone-900 mb-2"
                      style={{ fontSize: `${headerOverrides.nameFontSize || 24}px` }}
                    >
                      {headerOverrides.name || auth.currentUser?.displayName}
                    </h1>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{headerOverrides.targetRole || resume.targetRole}</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-300 mb-2">Personal Info</h4>
                      <div className="space-y-1 text-xs text-stone-600">
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-300 mb-2">Contact</h4>
                      <div className="space-y-1 text-xs text-stone-600">
                        <p className="break-all">{headerOverrides.email || auth.currentUser?.email}</p>
                        {headerOverrides.phone && <p>{headerOverrides.phone}</p>}
                        {headerOverrides.location && <p>{headerOverrides.location}</p>}
                        {headerOverrides.linkedin && <p className="break-all">{headerOverrides.linkedin}</p>}
                        {headerOverrides.github && <p className="break-all">{headerOverrides.github}</p>}
                      </div>
                    </div>

                    {/* Sidebar Skills & Extracurriculars */}
                    {['Skill', 'Achievement', 'Extracurricular', 'Hobby'].map(category => {
                      const categoryPointers = resume.pointerIds.filter(id => {
                        const p = pointers.find(ptr => ptr.id === id);
                        return p?.category === category;
                      });
                      if (categoryPointers.length === 0) return null;

                      return (
                        <div key={category}>
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-300 mb-2">
                            {category === 'Achievement' ? 'Achievements' : category === 'Extracurricular' ? 'Activities' : category === 'Hobby' ? 'Interests' : 'Skills'}
                          </h4>
                          <div className="space-y-3">
                            {categoryPointers.map(id => {
                              const data = getPointerData(id);
                              return (
                                <div key={id} className="relative group">
                                  {isEditing && <PointerEditor id={id} data={data} />}
                                  <div className="flex justify-between items-baseline">
                                    <p className="text-xs font-bold text-stone-800">{data.title}</p>
                                    {data.level && <span className="text-[9px] text-stone-400 font-bold uppercase">{data.level}</span>}
                                  </div>
                                  <p className="text-[10px] text-stone-500 leading-tight">{data.description}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </aside>
                <main className="flex-1 space-y-8">
                  {['Education', 'Work', 'Internship', 'Project', 'Extracurricular'].map(category => {
                    const categoryPointers = resume.pointerIds.filter(id => {
                      const p = pointers.find(ptr => ptr.id === id);
                      return p?.category === category;
                    });
                    if (categoryPointers.length === 0) return null;

                    return (
                      <section key={category} className="page-break-inside-avoid">
                        <h2 className="text-sm font-bold uppercase tracking-widest border-b-2 border-stone-900 pb-1 mb-6">
                          {category === 'Work' ? 'Professional Experience' : category === 'Extracurricular' ? 'Extracurricular Activities' : category}
                        </h2>
                        <div className="space-y-8">
                          {categoryPointers.map(id => {
                            const data = getPointerData(id);
                            return (
                              <div key={id} className="group relative">
                                {isEditing && <PointerEditor id={id} data={data} />}
                                <div className="mb-2">
                                  <h3 className="font-bold text-sm">{data.title}</h3>
                                  <div className="flex justify-between text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                                    <span>{data.description}</span>
                                    {(data.startDate || data.endDate || data.isCurrent) && (
                                      <span>{data.startDate} {data.startDate && (data.endDate || data.isCurrent) ? '—' : ''} {data.isCurrent ? 'Present' : data.endDate}</span>
                                    )}
                                  </div>
                                </div>
                                <ul className="space-y-1">
                                  {data.bulletPoints.map((bullet, i) => (
                                    <li key={i} className="text-xs leading-relaxed flex gap-2">
                                      <span className="text-stone-300">■</span>
                                      {isEditing ? (
                                        <textarea 
                                          className="flex-1 border-none focus:ring-1 focus:ring-stone-100 p-1 -m-1 text-xs min-h-[20px] resize-none bg-transparent rounded transition-all"
                                          value={bullet}
                                          rows={bullet.split('\n').length || 1}
                                          onChange={e => {
                                            const newBullets = [...data.bulletPoints];
                                            newBullets[i] = e.target.value;
                                            setCustomizedBullets(prev => ({ ...prev, [id]: newBullets }));
                                          }}
                                        />
                                      ) : (
                                        <span>{bullet}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </main>
              </div>
            )}

            {resume.templateId === 'creative' && (
              <div className="relative">
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-[#1c1917] opacity-5 rounded-full" />
                <header className="relative mb-12">
                  <h1 className="text-5xl font-black tracking-tighter text-[#1c1917] mb-2">{headerOverrides.name || auth.currentUser?.displayName}</h1>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="h-px w-12 bg-[#1c1917]" />
                    <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#78716c]">{headerOverrides.targetRole || resume.targetRole}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-[#a8a29e]">
                    <span>{headerOverrides.email || auth.currentUser?.email}</span>
                    {headerOverrides.phone && <span>• {headerOverrides.phone}</span>}
                    {headerOverrides.location && <span>• {headerOverrides.location}</span>}
                    {headerOverrides.linkedin && <span>• {headerOverrides.linkedin}</span>}
                    {headerOverrides.github && <span>• {headerOverrides.github}</span>}
                  </div>
                </header>

                <div className="space-y-12">
                  {['Education', 'Work', 'Internship', 'Project', 'Skill', 'Extracurricular', 'Achievement', 'Hobby'].map(category => {
                    const categoryPointers = resume.pointerIds.filter(id => {
                      const p = pointers.find(ptr => ptr.id === id);
                      return p?.category === category;
                    });
                    if (categoryPointers.length === 0) return null;

                    return (
                      <section key={category}>
                        <h2 className="text-xl font-black italic mb-6 flex items-center gap-4">
                          {category === 'Work' ? 'Professional Experience' : category === 'Extracurricular' ? 'Extracurricular Activities' : category} <span className="h-px flex-1 bg-stone-100" />
                        </h2>
                        <div className="space-y-10">
                          {categoryPointers.map(id => {
                            const data = getPointerData(id);
                            return (
                              <div key={id} className="group relative">
                                {isEditing && <PointerEditor id={id} data={data} />}
                                <div className="relative pl-6 border-l-2 border-stone-900">
                                  <div className="absolute -left-[9px] top-0 w-4 h-4 bg-white border-2 border-stone-900 rounded-full" />
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <h3 className="font-bold text-lg leading-none">{data.title}</h3>
                                      <p className="text-xs font-bold text-[#78716c] mt-1">{data.description}</p>
                                    </div>
                                    {(data.startDate || data.endDate || data.isCurrent) && (
                                      <span className="text-[10px] font-mono bg-stone-100 px-2 py-1">
                                        {data.startDate} {data.startDate && (data.endDate || data.isCurrent) ? '—' : ''} {data.isCurrent ? 'Present' : data.endDate}
                                      </span>
                                    )}
                                  </div>
                                  <ul className="space-y-2">
                                    {data.bulletPoints.map((bullet, i) => (
                                      <li key={i} className="text-sm leading-snug text-stone-600">
                                        {isEditing ? (
                                          <textarea 
                                            className="w-full border-none focus:ring-1 focus:ring-stone-100 p-1 -m-1 text-sm min-h-[20px] resize-none bg-transparent rounded transition-all"
                                            value={bullet}
                                            rows={bullet.split('\n').length || 1}
                                            onChange={e => {
                                              const newBullets = [...data.bulletPoints];
                                              newBullets[i] = e.target.value;
                                              setCustomizedBullets(prev => ({ ...prev, [id]: newBullets }));
                                            }}
                                          />
                                        ) : (
                                          <span>{bullet}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
