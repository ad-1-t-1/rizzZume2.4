import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set worker source for pdfjs - matching the version in package.json
// We use multiple CDNs as fallbacks
const DEFAULT_VERSION = '5.5.207';
const version = pdfjs.version || DEFAULT_VERSION;

try {
  // Try unpkg first
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('Failed to set PDF worker from unpkg, trying cdnjs...', e);
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
  } catch (e2) {
    console.error('Failed to set PDF worker from all CDNs', e2);
  }
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
}

export async function extractTextFromPDF(file: File): Promise<string> {
  console.log(`[PDF] Starting extraction for ${file.name} (size: ${file.size} bytes)`);
  try {
    const arrayBuffer = await file.arrayBuffer();
    console.log(`[PDF] ArrayBuffer created, length: ${arrayBuffer.byteLength}`);
    
    // Ensure worker is set before getting document
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
       pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    }

    let loadingTask;
    try {
      // Primary attempt: standard configuration
      loadingTask = pdfjs.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        // Adding verbosity for debugging
        verbosity: 1,
      });
    } catch (initError) {
      console.warn('[PDF] Primary initialization failed, trying fallback...', initError);
      // Fallback: simplest possible call
      loadingTask = pdfjs.getDocument(arrayBuffer);
    }
    
    console.log('[PDF] Loading task created, waiting for promise...');
    const pdf = await loadingTask.promise;
    console.log(`[PDF] Document loaded, pages: ${pdf.numPages}`);
    
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        console.log(`[PDF] Processing page ${i}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Extract text items safely
        const pageText = textContent.items
          .map((item: any) => {
            if (item && typeof item === 'object' && 'str' in item) {
              return item.str;
            }
            return '';
          })
          .join(' ');
        
        fullText += pageText + '\n';
        
        // Clean up page resources
        page.cleanup();
      } catch (pageError) {
        console.warn(`[PDF] Error processing page ${i}, skipping...`, pageError);
      }
    }

    console.log(`[PDF] Extraction complete, total text length: ${fullText.length}`);
    return fullText;
  } catch (error) {
    console.error('[PDF] Extraction failed:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`PDF Parse Error: ${msg}. Try converting the PDF to a Word document or plain text first.`);
  }
}

export async function extractTextFromDocx(file: File): Promise<string> {
  console.log(`[DOCX] Starting extraction for ${file.name} (size: ${file.size} bytes)`);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    console.log(`[DOCX] Extraction complete, total text length: ${result.value.length}`);
    if (result.messages.length > 0) {
      console.warn('[DOCX] Mammoth messages:', result.messages);
    }
    return result.value;
  } catch (error) {
    console.error('[DOCX] Extraction failed:', error);
    throw new Error(`DOCX Parse Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  console.log('File extension detected:', extension);
  
  if (extension === 'pdf') {
    return extractTextFromPDF(file);
  } else if (extension === 'docx') {
    return extractTextFromDocx(file);
  } else {
    console.log('Reading as plain text:', file.name);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        console.log('Successfully read text file, length:', result.length);
        resolve(result);
      };
      reader.onerror = (e) => {
        console.error('File reader error:', e);
        reject(new Error('Failed to read file as text.'));
      };
      reader.readAsText(file);
    });
  }
}
