import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  FileText, 
  Download,
  Search,
  AlertCircle,
  Code,
  Edit3,
  Save,
  X,
  Plus,
  BookOpen
} from 'lucide-react';
import { Pointer, Resume, WorkDocument } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeJobDescription, optimizeBullets, generateLaTeXResume, prepareForInterview } from '../services/gemini';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Toast, ToastType } from './ui/Modals';

export default function ResumeBuilder() {
  const [step, setStep] = useState(1);
  const [pointers, setPointers] = useState<Pointer[]>([]);
  const [workDocs, setWorkDocs] = useState<WorkDocument[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [resumeName, setResumeName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [latexTemplate, setLatexTemplate] = useState('');
  const [useLatex, setUseLatex] = useState(false);
  const [selectedWorkDocIds, setSelectedWorkDocIds] = useState<string[]>([]);
  
  // Contact Info
  const [phone, setPhone] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  const [location, setLocation] = useState('');
  const [nameFontSize, setNameFontSize] = useState(48);
  
  // AI Suggestions
  const [aiAnalysis, setAiAnalysis] = useState<{ suggestedPointerIds: string[], reasoning: string, skillGaps: string[] } | null>(null);
  const [selectedPointerIds, setSelectedPointerIds] = useState<string[]>([]);
  const [customizedBullets, setCustomizedBullets] = useState<Record<string, string[]>>({});
  const [optimizing, setOptimizing] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  
  // Final Result
  const [finalResumeContent, setFinalResumeContent] = useState<string | null>(null);
  const [interviewPrep, setInterviewPrep] = useState<{
    fitAnalysis: string,
    predictedQuestions: { question: string, suggestedAnswer: string, referenceEvidence: string }[],
    elevatorPitch: string,
    talkingPoints: string[]
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);

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

    const docsQ = query(collection(db, 'users', auth.currentUser.uid, 'work_documents'), orderBy('createdAt', 'desc'));
    const unsubDocs = onSnapshot(docsQ, (snapshot) => {
      setWorkDocs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkDocument)));
    });

    return () => {
      unsub();
      unsubDocs();
    };
  }, []);

  const handleAnalyze = async () => {
    if (!jobDescription || pointers.length === 0) return;
    setLoading(true);
    try {
      // Collect all documents: globally selected + any docs linked to any pointers
      const allLinkedDocIds = pointers.flatMap(p => p.documentIds || []);
      const selectedDocs = workDocs.filter(d => 
        selectedWorkDocIds.includes(d.id) || 
        allLinkedDocIds.includes(d.id)
      );
      const result = await analyzeJobDescription(jobDescription, pointers, selectedDocs);
      setAiAnalysis(result);
      setSelectedPointerIds(result.suggestedPointerIds);
      setStep(2);
    } catch (error) {
      console.error(error);
      showToast("AI Analysis failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizePointer = async (pointer: Pointer) => {
    setOptimizing(pointer.id);
    try {
      // Merge globally selected docs with pointer-specific docs
      const selectedDocs = workDocs.filter(d => 
        selectedWorkDocIds.includes(d.id) || 
        (pointer.documentIds && pointer.documentIds.includes(d.id))
      );
      const result = await optimizeBullets(targetRole, jobDescription, pointer, selectedDocs);
      setCustomizedBullets(prev => ({ ...prev, [pointer.id]: result.optimizedBullets }));
    } catch (error) {
      console.error(error);
    } finally {
      setOptimizing(null);
    }
  };

  const handleGenerateResume = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const selectedPointers = pointers.filter(p => selectedPointerIds.includes(p.id));
      
      let latex = null;
      if (useLatex && latexTemplate) {
        latex = await generateLaTeXResume(
          latexTemplate, 
          selectedPointers, 
          customizedBullets,
          {
            name: auth.currentUser.displayName || 'User',
            email: auth.currentUser.email || '',
            targetRole,
            phone,
            linkedin,
            github,
            location
          }
        );
        setFinalResumeContent(latex);
      } else {
        setFinalResumeContent(null); 
      }
      
      const resumeData = {
        userId: auth.currentUser.uid,
        name: resumeName || `Resume - ${targetRole}`,
        targetRole,
        jobDescription,
        templateId: useLatex ? 'latex' : selectedTemplate,
        pointerIds: selectedPointerIds,
        customizedBullets,
        headerOverrides: {
          name: auth.currentUser.displayName || '',
          nameFontSize,
          email: auth.currentUser.email || '',
          phone,
          linkedin,
          github,
          location,
          targetRole
        },
        latexContent: latex,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'resumes'), resumeData);
      showToast("Resume generated successfully!");
      setStep(4);
    } catch (error) {
      console.error(error);
      showToast("Failed to generate resume.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareInterview = async () => {
    setLoading(true);
    try {
      const selectedPointers = pointers.filter(p => selectedPointerIds.includes(p.id));
      const allLinkedDocIds = selectedPointers.flatMap(p => p.documentIds || []);
      const selectedDocs = workDocs.filter(d => 
        selectedWorkDocIds.includes(d.id) || 
        allLinkedDocIds.includes(d.id)
      );
      const result = await prepareForInterview(targetRole, jobDescription, selectedPointers, selectedDocs);
      setInterviewPrep(result);
      setStep(5);
    } catch (error) {
      console.error(error);
      showToast("Interview preparation failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    const element = document.getElementById('resume-preview');
    if (!element) {
      showToast("Resume preview not found.", "error");
      return;
    }
    
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
      
      pdf.save(`${resumeName || 'resume'}.pdf`);
      showToast("PDF downloaded successfully!");
    } catch (error) {
      console.error("PDF Export Error:", error);
      showToast("Failed to generate PDF.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Progress Stepper */}
      <div className="flex justify-between items-center bg-white border border-stone-900 p-4 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 flex items-center justify-center font-bold border ${step >= s ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-300 border-stone-200'}`}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < 5 && <div className={`w-12 h-px ${step > s ? 'bg-stone-900' : 'bg-stone-200'}`} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border border-stone-900 p-8 space-y-6"
          >
            <h2 className="text-3xl font-bold font-serif italic">What are we applying for?</h2>
            <div className="space-y-4">
              {/* Work Evidence Selection */}
              {workDocs.length > 0 && (
                <div className="mb-6 p-4 border border-stone-100 bg-stone-50">
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Include Work Evidence Context (Optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {workDocs.map(doc => (
                      <button
                        key={doc.id}
                        onClick={() => {
                          setSelectedWorkDocIds(prev => 
                            prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
                          );
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold border transition-all ${selectedWorkDocIds.includes(doc.id) ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200'}`}
                      >
                        <FileText className="w-3 h-3" />
                        {doc.title}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-stone-400 italic">AI will refer to selected documents to draw deeper conclusions and improve bullet points.</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Target Role</label>
                <input 
                  type="text" 
                  className="w-full border-stone-900 focus:ring-0 p-3 font-bold"
                  placeholder="e.g. Senior Frontend Engineer"
                  value={targetRole}
                  onChange={e => setTargetRole(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Job Description</label>
                <textarea 
                  className="w-full border-stone-900 focus:ring-0 p-3 min-h-[150px] text-sm"
                  placeholder="Paste the job requirements here..."
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400">Phone Number</label>
                  <input 
                    type="text" 
                    className="w-full border-stone-900 p-3 text-sm focus:ring-0 outline-none"
                    placeholder="+1 234 567 890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400">Location</label>
                  <input 
                    type="text" 
                    className="w-full border-stone-900 p-3 text-sm focus:ring-0 outline-none"
                    placeholder="City, Country"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400">LinkedIn URL</label>
                  <input 
                    type="text" 
                    className="w-full border-stone-900 p-3 text-sm focus:ring-0 outline-none"
                    placeholder="linkedin.com/in/username"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400">GitHub URL</label>
                  <input 
                    type="text" 
                    className="w-full border-stone-900 p-3 text-sm focus:ring-0 outline-none"
                    placeholder="github.com/username"
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400">Name Font Size (px)</label>
                  <input 
                    type="range" 
                    min="24"
                    max="72"
                    className="w-full accent-stone-900"
                    value={nameFontSize}
                    onChange={(e) => setNameFontSize(parseInt(e.target.value))}
                  />
                  <span className="text-[10px] font-bold text-stone-400">{nameFontSize}px</span>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100">
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 border-stone-900 text-stone-900 focus:ring-0"
                    checked={useLatex}
                    onChange={e => setUseLatex(e.target.checked)}
                  />
                  <span className="font-bold text-sm uppercase tracking-widest">Use LaTeX Template</span>
                </label>
                
                {useLatex && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold uppercase tracking-widest text-stone-400">LaTeX Code</label>
                      <button 
                        onClick={() => setLatexTemplate(`%-------------------------
% Resume in Latex
% Author : Jake Gutierrez
% License : MIT
%------------------------

\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\input{glyphtounicode}

\\pagestyle{fancy}
\\fancyhf{} % clear all header and footer fields
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\\pdfgentounicode=1

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%


\\begin{document}

%----------HEADING----------
\\begin{center}
    \\textbf{\\Huge \\scshape {Your Name}} \\\\ \\vspace{1pt}
    \\small 123-456-7890 $|$ \\href{mailto:email@example.com}{\\underline{email@example.com}} $|$ 
    \\href{https://linkedin.com/in/username}{\\underline{linkedin.com/in/username}} $|$
    \\href{https://github.com/username}{\\underline{github.com/username}}
\\end{center}


%-----------EXPERIENCE-----------
\\section{Experience}
  \\resumeSubHeadingListStart
    \\resumeSubheading
      {Company Name}{Location}
      {Job Title}{Dates}
      \\resumeItemListStart
        \\resumeItem{Example bullet point}
      \\resumeItemListEnd
  \\resumeSubHeadingListEnd


%-----------PROJECTS-----------
\\section{Projects}
    \\resumeSubHeadingListStart
      \\resumeProjectHeading
          {\\textbf{Project Name} $|$ \\emph{Technologies}}{Dates}
          \\resumeItemListStart
            \\resumeItem{Example bullet point}
          \\resumeItemListEnd
    \\resumeSubHeadingListEnd


%-----------PROGRAMMING SKILLS-----------
\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
     \\textbf{Languages}{: Java, Python, C/C++, SQL, JavaScript, HTML/CSS} \\\\
     \\textbf{Frameworks}{: React, Node.js, Flask, JUnit} \\\\
     \\textbf{Developer Tools}{: Git, Docker, Google Cloud Platform, VS Code} \\\\
     \\textbf{Libraries}{: pandas, NumPy, Matplotlib}
    }}
 \\end{itemize}


%-------------------------------------------
\\end{document}
`)}
                        className="text-[10px] font-bold text-stone-900 underline hover:text-stone-600"
                      >
                        Load Sample Template
                      </button>
                    </div>
                    <textarea 
                      className="w-full border-stone-900 focus:ring-0 p-3 min-h-[200px] font-mono text-xs bg-stone-50"
                      placeholder="\\documentclass{article}..."
                      value={latexTemplate}
                      onChange={e => setLatexTemplate(e.target.value)}
                    />
                  </motion.div>
                )}
              </div>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!targetRole || !jobDescription || loading}
              className="w-full bg-stone-900 text-white py-4 font-bold flex items-center justify-center gap-2 disabled:bg-stone-200"
            >
              {loading ? 'Analyzing...' : <><Sparkles className="w-5 h-5" /> Analyze with AI</>}
            </button>
          </motion.div>
        )}

        {step === 2 && aiAnalysis && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-stone-900 text-white p-6 shadow-[8px_8px_0px_0px_rgba(20,20,20,0.3)]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-stone-300" />
                <h3 className="font-bold uppercase tracking-widest text-xs">AI Recommendation</h3>
              </div>
              <p className="text-sm leading-relaxed opacity-90">{aiAnalysis.reasoning}</p>
              {aiAnalysis.skillGaps.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-stone-400">Skill Gaps Identified</p>
                  <div className="flex flex-wrap gap-2">
                    {aiAnalysis.skillGaps.map((gap, i) => (
                      <span key={i} className="text-[10px] bg-white/10 px-2 py-1 rounded">{gap}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

              <div className="flex justify-between items-center bg-white border border-stone-900 p-4 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex-wrap gap-4">
                <h3 className="text-xl font-bold font-serif italic">Select Experiences to Include</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedPointerIds(pointers.map(p => p.id))}
                    className="text-[10px] font-bold uppercase tracking-widest text-stone-900 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-stone-300">|</span>
                  <button 
                    onClick={() => setSelectedPointerIds([])}
                    className="text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pointers.map(pointer => (
                <div 
                  key={pointer.id}
                  onClick={() => {
                    setSelectedPointerIds(prev => 
                      prev.includes(pointer.id) ? prev.filter(id => id !== pointer.id) : [...prev, pointer.id]
                    );
                  }}
                  className={`p-4 border cursor-pointer transition-all flex items-center gap-4 ${selectedPointerIds.includes(pointer.id) ? 'border-stone-900 bg-white shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]' : 'border-stone-200 bg-stone-50 opacity-60'}`}
                >
                  <div className={`w-6 h-6 border flex items-center justify-center ${selectedPointerIds.includes(pointer.id) ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-300'}`}>
                    {selectedPointerIds.includes(pointer.id) && <Check className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">{pointer.title}</h4>
                    <p className="text-xs text-stone-500">{pointer.category} • {pointer.startDate}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(1)} className="font-bold text-stone-500 flex items-center gap-2">
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
              <button 
                onClick={() => setStep(3)} 
                disabled={selectedPointerIds.length === 0}
                className="bg-stone-900 text-white px-8 py-3 font-bold flex items-center gap-2 disabled:bg-stone-200"
              >
                Next Step <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <h2 className="text-3xl font-bold font-serif italic">Optimize Bullet Points</h2>
            <div className="space-y-6">
              {pointers.filter(p => selectedPointerIds.includes(p.id)).map(pointer => (
                <div key={pointer.id} className="bg-white border border-stone-900 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold">{pointer.title}</h4>
                      <p className="text-xs text-stone-500">{pointer.description}</p>
                    </div>
                    <button 
                      onClick={() => handleOptimizePointer(pointer)}
                      disabled={optimizing === pointer.id}
                      className="text-xs font-bold bg-stone-100 px-3 py-2 border border-stone-900 flex items-center gap-2 hover:bg-stone-200 transition-all"
                    >
                      {optimizing === pointer.id ? 'Optimizing...' : <><Sparkles className="w-3 h-3" /> AI Optimize</>}
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {(customizedBullets[pointer.id] || pointer.bulletPoints).map((bullet, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="font-bold text-stone-300">•</span>
                        <textarea 
                          className="flex-1 border-none focus:ring-0 p-0 text-sm min-h-[40px] resize-none"
                          value={bullet}
                          onChange={e => {
                            const newBullets = [...(customizedBullets[pointer.id] || pointer.bulletPoints)];
                            newBullets[i] = e.target.value;
                            setCustomizedBullets(prev => ({ ...prev, [pointer.id]: newBullets }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(2)} className="font-bold text-stone-500 flex items-center gap-2">
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
              <button 
                onClick={handleGenerateResume} 
                disabled={loading}
                className="bg-stone-900 text-white px-8 py-3 font-bold flex items-center gap-2"
              >
                {loading ? 'Generating...' : 'Generate Resume'} <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div 
            key="step4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold font-serif italic">Resume Ready.</h2>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsEditing(!isEditing)} 
                  className={`px-4 py-2 font-bold flex items-center gap-2 border border-stone-900 transition-all ${isEditing ? 'bg-stone-900 text-white' : 'bg-white text-stone-900'}`}
                >
                  {isEditing ? <><Save className="w-4 h-4" /> Save Changes</> : <><Edit3 className="w-4 h-4" /> Edit Content</>}
                </button>
                <button onClick={exportPDF} className="bg-white border border-stone-900 px-4 py-2 font-bold flex items-center gap-2 hover:bg-stone-50">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <button 
                  onClick={handlePrepareInterview} 
                  disabled={loading}
                  className="bg-stone-900 text-white px-4 py-2 font-bold flex items-center gap-2"
                >
                  {loading ? 'Analyzing...' : <><Sparkles className="w-4 h-4" /> Prepare Interview</>}
                </button>
              </div>
            </div>

            {/* Template Picker */}
            {!useLatex && (
              <div className="bg-white border border-stone-900 p-4 overflow-x-auto">
                <div className="flex gap-4 min-w-max">
                  {[
                    { id: 'modern', name: 'Modern' },
                    { id: 'minimal', name: 'Minimal' },
                    { id: 'classic', name: 'Classic' },
                    { id: 'executive', name: 'Executive' },
                    { id: 'creative', name: 'Creative' }
                  ].map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`px-6 py-2 font-bold text-xs uppercase tracking-widest border transition-all ${selectedTemplate === tpl.id ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-400 border-stone-200 hover:border-stone-900 hover:text-stone-900'}`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resume Preview / Editor */}
            <div className="relative">
              {useLatex && finalResumeContent ? (
                <div className="bg-stone-900 p-8 rounded-lg shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold flex items-center gap-2"><Code className="w-4 h-4" /> LaTeX Output</h3>
                  </div>
                  {isEditing ? (
                    <textarea 
                      className="w-full h-[600px] bg-stone-800 text-stone-100 font-mono text-xs p-4 border-none focus:ring-0 rounded"
                      value={finalResumeContent}
                      onChange={e => setFinalResumeContent(e.target.value)}
                    />
                  ) : (
                    <pre className="w-full h-[600px] bg-stone-800 text-stone-100 font-mono text-xs p-4 overflow-auto rounded whitespace-pre-wrap">
                      {finalResumeContent}
                    </pre>
                  )}
                </div>
              ) : (
                <div id="resume-preview" className={`bg-white shadow-2xl p-6 md:p-12 w-full min-h-[11in] h-max text-[#1c1917] font-sans mx-auto overflow-visible ${selectedTemplate === 'minimal' || selectedTemplate === 'classic' ? 'font-serif' : ''}`}>
                  {selectedTemplate === 'modern' && (
                    <>
                      <header className="border-b-2 border-[#1c1917] pb-6 mb-8">
                        <h1 className="text-2xl md:text-4xl font-bold uppercase tracking-tighter mb-2" style={{ fontSize: `${nameFontSize}px` }}>{auth.currentUser?.displayName}</h1>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] md:text-xs font-bold text-[#78716c] uppercase tracking-widest">
                          <span>{auth.currentUser?.email}</span>
                          {phone && <span>• {phone}</span>}
                          {location && <span>• {location}</span>}
                          {linkedin && <span>• {linkedin}</span>}
                          {github && <span>• {github}</span>}
                          <span>• {targetRole}</span>
                        </div>
                      </header>

                      <div className="space-y-8">
                        {['Education', 'Work', 'Internship', 'Project', 'Skill', 'Extracurricular', 'Achievement', 'Hobby'].map(category => {
                          const categoryPointers = pointers.filter(p => selectedPointerIds.includes(p.id) && p.category === category);
                          if (categoryPointers.length === 0) return null;

                          return (
                            <section key={category}>
                              <h2 className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-[#a8a29e] mb-4">
                                {category === 'Work' ? 'Professional Experience' : 
                                 category === 'Extracurricular' ? 'Extracurricular Activities' :
                                 category}
                              </h2>
                              <div className="space-y-6">
                                {categoryPointers.map(pointer => (
                                  <div key={pointer.id}>
                                    <div className="flex justify-between items-baseline mb-1">
                                      <h3 className="font-bold text-base md:text-lg">{pointer.title}</h3>
                                      <span className="text-[10px] md:text-xs font-bold text-[#a8a29e]">{pointer.startDate} — {pointer.isCurrent ? 'Present' : pointer.endDate}</span>
                                    </div>
                                    <p className="text-[10px] md:text-xs font-bold text-[#78716c] uppercase mb-2">{pointer.description}</p>
                                    <ul className="list-disc list-inside space-y-1">
                                      {(customizedBullets[pointer.id] || pointer.bulletPoints).map((bullet, i) => (
                                        <li key={i} className="text-xs md:text-sm leading-relaxed">
                                          {isEditing ? (
                                            <textarea 
                                              className="flex-1 w-full border-none focus:ring-0 p-0 text-xs md:text-sm min-h-[20px] resize-none"
                                              value={bullet}
                                              onChange={e => {
                                                const newBullets = [...(customizedBullets[pointer.id] || pointer.bulletPoints)];
                                                newBullets[i] = e.target.value;
                                                setCustomizedBullets(prev => ({ ...prev, [pointer.id]: newBullets }));
                                              }}
                                            />
                                          ) : (
                                            <span>{bullet}</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {selectedTemplate === 'minimal' && (
                    <div className="flex flex-col items-center">
                      <header className="text-center mb-12">
                        <h1 className="text-2xl md:text-3xl font-light tracking-[0.3em] uppercase mb-4" style={{ fontSize: `${nameFontSize}px` }}>{auth.currentUser?.displayName}</h1>
                        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[9px] md:text-[10px] font-bold text-[#a8a29e] uppercase tracking-widest">
                          <span>{auth.currentUser?.email}</span>
                          {phone && <span>/ {phone}</span>}
                          {location && <span>/ {location}</span>}
                          {linkedin && <span>/ {linkedin}</span>}
                          {github && <span>/ {github}</span>}
                          <span>/ {targetRole}</span>
                        </div>
                      </header>

                      <div className="w-full max-w-2xl space-y-12">
                        {['Education', 'Work', 'Internship', 'Project', 'Skill', 'Extracurricular', 'Achievement', 'Hobby'].map(category => {
                          const categoryPointers = pointers.filter(p => selectedPointerIds.includes(p.id) && p.category === category);
                          if (categoryPointers.length === 0) return null;

                          return (
                            <section key={category}>
                              <h2 className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.4em] text-[#1c1917] mb-8 text-center border-b pb-2">
                                {category === 'Work' ? 'Professional Experience' : 
                                 category === 'Extracurricular' ? 'Extracurricular Activities' :
                                 category}
                              </h2>
                              <div className="space-y-10">
                                {categoryPointers.map(pointer => (
                                  <div key={pointer.id} className="text-center">
                                    <h3 className="font-bold text-sm md:text-base mb-1">{pointer.title}</h3>
                                    <p className="text-[9px] md:text-[10px] font-bold text-[#a8a29e] uppercase tracking-widest mb-4">
                                      {pointer.description} • {pointer.startDate} — {pointer.isCurrent ? 'Present' : pointer.endDate}
                                    </p>
                                    <ul className="space-y-2 inline-block text-left">
                                      {(customizedBullets[pointer.id] || pointer.bulletPoints).map((bullet, i) => (
                                        <li key={i} className="text-xs md:text-sm leading-relaxed max-w-lg mx-auto">
                                          {isEditing ? (
                                            <textarea 
                                              className="w-full border-none focus:ring-0 p-0 text-xs md:text-sm min-h-[20px] resize-none text-center"
                                              value={bullet}
                                              onChange={e => {
                                                const newBullets = [...(customizedBullets[pointer.id] || pointer.bulletPoints)];
                                                newBullets[i] = e.target.value;
                                                setCustomizedBullets(prev => ({ ...prev, [pointer.id]: newBullets }));
                                              }}
                                            />
                                          ) : (
                                            <span className="block text-center">{bullet}</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedTemplate === 'classic' && (
                    <div className="font-serif">
                      <header className="border-b-4 border-double border-[#1c1917] pb-4 mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontSize: `${nameFontSize}px` }}>{auth.currentUser?.displayName}</h1>
                        <div className="flex justify-between items-end flex-wrap gap-2">
                          <p className="text-xs md:text-sm italic text-[#78716c]">{targetRole}</p>
                          <div className="text-[10px] md:text-xs font-bold text-right">
                            <p>{auth.currentUser?.email}</p>
                            <p>{[phone, location, linkedin, github].filter(Boolean).join(' | ')}</p>
                          </div>
                        </div>
                      </header>

                      <div className="space-y-8">
                        {['Education', 'Work', 'Internship', 'Project', 'Skill', 'Extracurricular', 'Achievement', 'Hobby'].map(category => {
                          const categoryPointers = pointers.filter(p => selectedPointerIds.includes(p.id) && p.category === category);
                          if (categoryPointers.length === 0) return null;

                          return (
                            <section key={category}>
                              <h2 className="text-base md:text-lg font-bold border-b border-[#1c1917] mb-4">
                                {category === 'Work' ? 'Professional Experience' : 
                                 category === 'Extracurricular' ? 'Extracurricular Activities' :
                                 category}
                              </h2>
                              <div className="space-y-6">
                                {categoryPointers.map(pointer => (
                                  <div key={pointer.id}>
                                    <div className="flex justify-between font-bold mb-1">
                                      <span className="text-sm md:text-base">{pointer.title}</span>
                                      <span className="text-[10px] md:text-sm">{pointer.startDate} — {pointer.isCurrent ? 'Present' : pointer.endDate}</span>
                                    </div>
                                    <p className="text-xs md:text-sm italic mb-2">{pointer.description}</p>
                                    <ul className="list-disc list-outside ml-4 space-y-1">
                                      {(customizedBullets[pointer.id] || pointer.bulletPoints).map((bullet, i) => (
                                        <li key={i} className="text-xs md:text-sm leading-tight">
                                          {isEditing ? (
                                            <textarea 
                                              className="w-full border-none focus:ring-0 p-0 text-xs md:text-sm min-h-[20px] resize-none"
                                              value={bullet}
                                              onChange={e => {
                                                const newBullets = [...(customizedBullets[pointer.id] || pointer.bulletPoints)];
                                                newBullets[i] = e.target.value;
                                                setCustomizedBullets(prev => ({ ...prev, [pointer.id]: newBullets }));
                                              }}
                                            />
                                          ) : (
                                            <span>{bullet}</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedTemplate === 'executive' && (
                    <div className="flex flex-col md:flex-row gap-8">
                      <aside className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-stone-200 pb-8 md:pb-0 md:pr-8">
                        <div className="mb-8">
                          <h1 className="text-xl md:text-2xl font-bold text-stone-900 mb-2" style={{ fontSize: `${nameFontSize/1.5}px` }}>{auth.currentUser?.displayName}</h1>
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{targetRole}</p>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-stone-300 mb-1">Contact</h4>
                            <div className="space-y-1 text-[10px] md:text-xs text-stone-600">
                              <p className="break-all">{auth.currentUser?.email}</p>
                              {phone && <p>{phone}</p>}
                              {location && <p>{location}</p>}
                              {linkedin && <p className="break-all">{linkedin}</p>}
                              {github && <p className="break-all">{github}</p>}
                            </div>
                          </div>
                        </div>
                      </aside>
                      <main className="flex-1 space-y-8">
                        {['Education', 'Work', 'Internship', 'Project', 'Skill', 'Extracurricular', 'Achievement', 'Hobby'].map(category => {
                          const categoryPointers = pointers.filter(p => selectedPointerIds.includes(p.id) && p.category === category);
                          if (categoryPointers.length === 0) return null;

                          return (
                            <section key={category}>
                              <h2 className="text-[10px] md:text-sm font-bold uppercase tracking-widest border-b-2 border-stone-900 pb-1 mb-6">
                                {category === 'Work' ? 'Professional Experience' : 
                                 category === 'Extracurricular' ? 'Extracurricular Activities' :
                                 category}
                              </h2>
                              <div className="space-y-8">
                                {categoryPointers.map(pointer => (
                                  <div key={pointer.id}>
                                    <div className="mb-2">
                                      <h3 className="font-bold text-xs md:text-sm">{pointer.title}</h3>
                                      <div className="flex justify-between text-[9px] md:text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                                        <span>{pointer.description}</span>
                                        <span>{pointer.startDate} — {pointer.isCurrent ? 'Present' : pointer.endDate}</span>
                                      </div>
                                    </div>
                                    <ul className="space-y-1">
                                      {(customizedBullets[pointer.id] || pointer.bulletPoints).map((bullet, i) => (
                                        <li key={i} className="text-[10px] md:text-xs leading-relaxed flex gap-2">
                                          <span className="text-stone-300">■</span>
                                          {isEditing ? (
                                            <textarea 
                                              className="flex-1 border-none focus:ring-0 p-0 text-[10px] md:text-xs min-h-[20px] resize-none"
                                              value={bullet}
                                              onChange={e => {
                                                const newBullets = [...(customizedBullets[pointer.id] || pointer.bulletPoints)];
                                                newBullets[i] = e.target.value;
                                                setCustomizedBullets(prev => ({ ...prev, [pointer.id]: newBullets }));
                                              }}
                                            />
                                          ) : (
                                            <span>{bullet}</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </section>
                          );
                        })}
                      </main>
                    </div>
                  )}

                  {selectedTemplate === 'creative' && (
                    <div className="relative">
                      <div className="absolute -top-12 -left-12 w-32 h-32 bg-[#1c1917] opacity-5 rounded-full" />
                      <header className="relative mb-8 md:mb-12">
                        <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-[#1c1917] mb-2" style={{ fontSize: `${nameFontSize}px` }}>{auth.currentUser?.displayName}</h1>
                        <div className="flex items-center gap-4 mb-4">
                          <span className="h-px w-12 bg-[#1c1917]" />
                          <p className="text-xs md:text-sm font-bold uppercase tracking-[0.3em] text-[#78716c]">{targetRole}</p>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] md:text-[10px] font-mono text-[#a8a29e]">
                          <span>{auth.currentUser?.email}</span>
                          {phone && <span>• {phone}</span>}
                          {location && <span>• {location}</span>}
                          {linkedin && <span>• {linkedin}</span>}
                          {github && <span>• {github}</span>}
                        </div>
                      </header>

                      <div className="space-y-8 md:space-y-12">
                        {['Education', 'Work', 'Internship', 'Project', 'Skill', 'Extracurricular', 'Achievement', 'Hobby'].map(category => {
                          const categoryPointers = pointers.filter(p => selectedPointerIds.includes(p.id) && p.category === category);
                          if (categoryPointers.length === 0) return null;

                          return (
                            <section key={category}>
                              <h2 className="text-lg md:text-xl font-black italic mb-6 flex items-center gap-4">
                                {category === 'Work' ? 'Professional Experience' : 
                                 category === 'Extracurricular' ? 'Extracurricular Activities' :
                                 category} <span className="h-px flex-1 bg-stone-100" />
                              </h2>
                              <div className="space-y-10">
                                {categoryPointers.map(pointer => (
                                  <div key={pointer.id} className="relative pl-6 border-l-2 border-stone-900">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 bg-white border-2 border-stone-900 rounded-full" />
                                    <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                                      <div>
                                        <h3 className="font-bold text-base md:text-lg leading-none">{pointer.title}</h3>
                                        <p className="text-[10px] md:text-xs font-bold text-[#78716c] mt-1">{pointer.description}</p>
                                      </div>
                                      <span className="text-[9px] md:text-[10px] font-mono bg-stone-100 px-2 py-1">{pointer.startDate} — {pointer.isCurrent ? 'Present' : pointer.endDate}</span>
                                    </div>
                                    <ul className="space-y-2">
                                      {(customizedBullets[pointer.id] || pointer.bulletPoints).map((bullet, i) => (
                                        <li key={i} className="text-xs md:text-sm leading-snug text-stone-600">
                                          {isEditing ? (
                                            <textarea 
                                              className="w-full border-none focus:ring-0 p-0 text-xs md:text-sm min-h-[20px] resize-none"
                                              value={bullet}
                                              onChange={e => {
                                                const newBullets = [...(customizedBullets[pointer.id] || pointer.bulletPoints)];
                                                newBullets[i] = e.target.value;
                                                setCustomizedBullets(prev => ({ ...prev, [pointer.id]: newBullets }));
                                              }}
                                            />
                                          ) : (
                                            <span>{bullet}</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
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
          </motion.div>
        )}

        {step === 5 && interviewPrep && (
          <motion.div
            key="step5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pb-12"
          >
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-bold font-serif italic">Interview Strategy</h2>
                <p className="text-stone-500">Based on your work evidence and the job requirements.</p>
              </div>
              <button 
                onClick={() => setStep(4)}
                className="text-stone-900 font-bold underline"
              >
                Back to Resume
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Analysis & Pitch */}
              <div className="space-y-8">
                <div className="bg-stone-900 text-white p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
                  <h3 className="font-bold uppercase tracking-[0.2em] text-xs text-stone-400 mb-4">Fit Analysis</h3>
                  <p className="text-lg font-serif italic leading-relaxed">{interviewPrep.fitAnalysis}</p>
                </div>

                <div className="bg-white border border-stone-900 p-8">
                  <h3 className="font-bold uppercase tracking-[0.2em] text-xs text-stone-400 mb-4">Elevator Pitch</h3>
                  <div className="p-4 bg-stone-50 border-l-4 border-stone-900 italic text-stone-700">
                    "{interviewPrep.elevatorPitch}"
                  </div>
                </div>

                <div className="bg-white border border-stone-900 p-8">
                  <h3 className="font-bold uppercase tracking-[0.2em] text-xs text-stone-400 mb-4">Evidence Talking Points</h3>
                  <ul className="space-y-4">
                    {interviewPrep.talkingPoints.map((point, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <div className="w-5 h-5 bg-stone-900 text-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                          {i + 1}
                        </div>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right Column: Predicted Questions */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-xl font-bold font-serif italic">Predicted Questions</h3>
                   <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">AI Generated</span>
                </div>
                {interviewPrep.predictedQuestions.map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white border border-stone-900 p-6 overflow-hidden hover:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all"
                  >
                    <div className="flex gap-4 items-start">
                      <AlertCircle className="w-5 h-5 text-stone-900 flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-bold text-lg mb-3 leading-tight">{item.question}</h4>
                        <div className="text-sm text-stone-600 mb-4 bg-stone-50 p-3 border-l-2 border-stone-200">
                          <span className="font-bold text-stone-900 uppercase text-[10px] tracking-widest block mb-1">Suggested Answer:</span>
                          {item.suggestedAnswer}
                        </div>
                        <div className="inline-flex items-center gap-2 px-2 py-1 bg-stone-100 border border-stone-200 text-[10px] font-bold text-stone-500 rounded uppercase tracking-tighter">
                          <BookOpen className="w-3 h-3" /> Source: {item.referenceEvidence}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="pt-12 border-t border-stone-200 text-center">
              <button 
                onClick={() => window.location.reload()}
                className="bg-stone-900 text-white px-12 py-4 font-bold hover:shadow-[8px_8px_0px_0px_rgba(20,20,20,0.5)] transition-all"
              >
                Finish Building
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
