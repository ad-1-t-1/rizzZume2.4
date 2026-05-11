import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const analyzeJobDescription = async (jobDescription: string, pointers: any[], workEvidence?: any[]) => {
  const evidenceContext = workEvidence && workEvidence.length > 0 
    ? `\n\nAdditional Work Evidence Context:\n${JSON.stringify(workEvidence.map(d => ({ title: d.title, content: d.content })))}`
    : "";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Analyze this job description and suggest which of the user's career pointers are most relevant.
      Use the additional work evidence context if provided to better understand the depth of their contributions.
      
      Job Description:
      ${jobDescription}
      
      User Pointers:
      ${JSON.stringify(pointers)}
      ${evidenceContext}
      
      Return a JSON object with:
      - suggestedPointerIds: string[]
      - reasoning: string
      - skillGaps: string[]
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedPointerIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          reasoning: { type: Type.STRING },
          skillGaps: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["suggestedPointerIds", "reasoning", "skillGaps"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const optimizeBullets = async (role: string, jobDescription: string, pointer: any, workEvidence?: any[]) => {
  const evidenceContext = workEvidence && workEvidence.length > 0 
    ? `\n\nAdditional Work Evidence Context:\n${JSON.stringify(workEvidence.map(d => ({ title: d.title, content: d.content })))}`
    : "";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Rewrite the bullet points for this experience to better match the target role and job description.
      Keep the facts true but emphasize relevant skills and keywords.
      If work evidence context is provided, use it to pull out specific, quantifiably impressive details or technical specifics that might not be in the original pointers.
      
      Target Role: ${role}
      Job Description: ${jobDescription}
      Experience: ${pointer.title} - ${pointer.description}
      Original Bullets: ${pointer.bulletPoints.join('\n')}
      ${evidenceContext}
      
      Return a JSON object with:
      - optimizedBullets: string[] (3-5 bullets)
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          optimizedBullets: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["optimizedBullets"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const extractPointersFromResume = async (resumeData: string | { data: string, mimeType: string }) => {
  const isMultimodal = typeof resumeData !== 'string';
  
  const contents = isMultimodal 
    ? {
        parts: [
          { inlineData: resumeData },
          { text: "Extract career experiences from this resume and convert them into structured pointers. Return a JSON array of pointers." }
        ]
      }
    : `
      Extract career experiences, skills, and extracurricular activities from this resume text and convert them into structured pointers.
      
      Resume Text:
      ${resumeData}
      
      Return a JSON array of pointers. Each pointer should have:
      - title: string (e.g., "Software Engineer", "Python", "Cricket")
      - description: string (e.g., "Google", "Proficient", "Captain of the team")
      - category: "Work" | "Internship" | "Project" | "Achievement" | "Skill" | "Hobby" | "Education" | "Extracurricular"
      - startDate: string (YYYY-MM)
      - endDate: string (YYYY-MM or "Present")
      - bulletPoints: string[]
      - level: string (Only for Skill category: e.g., "Beginner", "Intermediate", "Expert", "80%")
    `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            startDate: { type: Type.STRING },
            endDate: { type: Type.STRING },
            bulletPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            level: { type: Type.STRING }
          },
          required: ["title", "description", "category", "startDate", "endDate", "bulletPoints"]
        }
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateLaTeXResume = async (
  latexTemplate: string, 
  pointers: any[], 
  customizedBullets: Record<string, string[]>,
  userInfo: { 
    name: string; 
    email: string; 
    targetRole: string;
    phone?: string;
    linkedin?: string;
    github?: string;
    location?: string;
  }
) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `
      You are a highly intelligent LaTeX Resume Architect. Your goal is to intelligently map a user's career data into a provided LaTeX template, ensuring perfect placement and structural integrity.

      USER PROFILE:
      - Name: ${userInfo.name}
      - Target Role: ${userInfo.targetRole}
      - Email: ${userInfo.email}
      - Phone: ${userInfo.phone || 'Not provided'}
      - LinkedIn: ${userInfo.linkedin || 'Not provided'}
      - GitHub: ${userInfo.github || 'Not provided'}
      - Location: ${userInfo.location || 'Not provided'}

      USER DATA (Selected Pointers):
      ${JSON.stringify(pointers)}

      CUSTOMIZED BULLETS (Priority):
      ${JSON.stringify(customizedBullets)}

      INTELLIGENT MAPPING STRATEGY:
      1. TEMPLATE ANALYSIS: Scan the provided LaTeX template to identify key sections (e.g., Experience, Projects, Skills, Education, Extracurricular).
      2. CATEGORY MAPPING: 
         - Map pointers with category "Work" or "Internship" to the "Experience" or "Professional Experience" section.
         - Map pointers with category "Project" to the "Projects" section.
         - Map pointers with category "Skill" to the "Skills" section.
         - Map pointers with category "Education" to the "Education" section.
         - Map pointers with category "Extracurricular" to the "Extracurricular Activities" or "Leadership" section.
         - Map pointers with category "Achievement" to an "Awards" or "Achievements" section, or integrate into Experience if appropriate.
      3. PLACEHOLDER PURGE: Completely remove all example data (names, companies, dates, bullet points) present in the template.
      4. STRUCTURAL REPLICATION: For each user pointer in a category, replicate the exact LaTeX command block used for examples in that section (e.g., if the template uses \\resumeSubheading for jobs, use it for EVERY job the user has).
      5. CONTENT SELECTION: For bullet points, ALWAYS check the "CUSTOMIZED BULLETS" object first using the pointer ID. If customized bullets exist, use them exclusively. If not, use the pointer's original bulletPoints.
      6. HEADER PRECISION: Update the LaTeX header with the user's Name, Email, Phone, LinkedIn, GitHub, Location, and Target Role. Ensure contact info formatting matches the template's style.
      7. ROBUSTNESS: If a section exists in the template but the user has no data for it, remove the example content from that section. If the user has data for a category not explicitly in the template, find the most logical section to place it.

      LaTeX Template:
      ${latexTemplate}

      Return ONLY the final, compiled-ready LaTeX code. Do not include any markdown formatting or explanations.
    `,
  });

  return response.text;
};

export const prepareForInterview = async (role: string, jobDescription: string, pointers: any[], workEvidence: any[]) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Prepare the user for an interview for the following role.
      Use the job description, the user's career pointers, and their work evidence (e.g., project documents, reports) to draw deep conclusions about their fit, potential questions, and how to defend their work.
      
      Target Role: ${role}
      Job Description: ${jobDescription}
      
      User Pointers:
      ${JSON.stringify(pointers)}
      
      Work Evidence Context:
      ${JSON.stringify(workEvidence.map(d => ({ title: d.title, content: d.content })))}
      
      Return a JSON object with:
      - fitAnalysis: string (How the user matches the requirements)
      - predictedQuestions: { question: string, suggestedAnswer: string, referenceEvidence: string }[] (Predicted technical and behavioral questions)
      - elevatorPitch: string (A compelling intro for the user)
      - talkingPoints: string[] (Specific details from their work documents they should mention)
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fitAnalysis: { type: Type.STRING },
          predictedQuestions: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                suggestedAnswer: { type: Type.STRING },
                referenceEvidence: { type: Type.STRING }
              }
            }
          },
          elevatorPitch: { type: Type.STRING },
          talkingPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["fitAnalysis", "predictedQuestions", "elevatorPitch", "talkingPoints"]
      }
    }
  });

  return JSON.parse(response.text);
};
