import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ParsedQuestion {
  text: string;
  options: string[];
  correctOption: number;
  exerciseType: string;
  explanation?: string;
  difficulty: number;
  source?: string;
  passage?: string;
  passageId?: string;
  essayAnswer?: string;
  hint?: string;
  pedagogicalHint?: string;
}

const SYSTEM_PROMPT = `Parse ALL questions from the provided content into a structured list of English questions. 
Do not skip any questions. If there are 40 questions, parse all 40.
The content may contain multiple questions, sometimes grouped under a reading passage.

Rules:
1. For multiple-choice questions: Each must have exactly 4 options. correctOption is the 0-based index (0=A, 1=B, 2=C, 3=D).
2. For essay/short answer questions (tự luận): options should be an empty array, correctOption should be -1, and provide the correct answer in the essayAnswer field. If there is a starting phrase or hint (e.g., "I wish...", "She said..."), put it in the hint field.
3. difficulty should be 1 (Easy), 2 (Medium), or 3 (Hard) based on the content.
4. exerciseType must be one of: 'multiple_choice', 'fill_blank', 'error_find', 'synonym_antonym', 'pronunciation_stress', 'sentence_transformation', 'reorder', 'reading_comprehension', 'essay', 'other'.
5. If questions are part of a reading passage, extract the passage and assign a consistent passageId (e.g., "passage_1").
6. Provide a concise explanation for the correct answer in Vietnamese (max 50 words).
7. Provide a "pedagogicalHint" (gợi ý học tập) in Vietnamese for each question. This should be a subtle clue or strategy to help students solve the question without giving away the answer directly.
8. Use Markdown for formatting (e.g., **bold** for keywords).`;

const tryFixTruncatedJson = (json: string): string => {
  try {
    JSON.parse(json);
    return json;
  } catch (e) {
    let fixed = json.trim();
    
    // If it ends with a comma, remove it
    if (fixed.endsWith(',')) {
      fixed = fixed.slice(0, -1);
    }
    
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    
    for (let i = 0; i < fixed.length; i++) {
      if (fixed[i] === '"' && (i === 0 || fixed[i-1] !== '\\')) {
        inString = !inString;
      }
      if (!inString) {
        if (fixed[i] === '{') openBraces++;
        else if (fixed[i] === '}') openBraces--;
        else if (fixed[i] === '[') openBrackets++;
        else if (fixed[i] === ']') openBrackets--;
      }
    }
    
    if (inString) fixed += '"';
    while (openBraces > 0) { fixed += '}'; openBraces--; }
    while (openBrackets > 0) { fixed += ']'; openBrackets--; }
    
    try {
      JSON.parse(fixed);
      return fixed;
    } catch (e2) {
      // Try to find the last complete object
      const lastObjectEnd = fixed.lastIndexOf('}');
      if (lastObjectEnd !== -1) {
        let partial = fixed.slice(0, lastObjectEnd + 1);
        if (!partial.trim().endsWith(']')) partial += ']';
        try {
          JSON.parse(partial);
          return partial;
        } catch (e3) {
          return "[]";
        }
      }
      return "[]";
    }
  }
};

const RESPONSE_CONFIG = {
  responseMimeType: "application/json",
  maxOutputTokens: 8192, // High limit for large batches
  responseSchema: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "The question text." },
        options: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "Exactly 4 options."
        },
        correctOption: { type: Type.INTEGER, description: "Index of correct option (0-3). Use -1 for essay." },
        exerciseType: { 
          type: Type.STRING, 
          enum: ["multiple_choice", "fill_blank", "error_find", "synonym_antonym", "pronunciation_stress", "sentence_transformation", "reorder", "reading_comprehension", "essay", "other"],
          description: "The type of exercise." 
        },
        explanation: { type: Type.STRING, description: "Explanation for the answer." },
        source: { type: Type.STRING, description: "The source of the question if mentioned." },
        difficulty: { type: Type.INTEGER, description: "1, 2, or 3." },
        passage: { type: Type.STRING, description: "Reading passage text if applicable." },
        passageId: { type: Type.STRING, description: "Unique ID for the passage group." },
        essayAnswer: { type: Type.STRING, description: "The correct answer for essay/short answer questions." },
        hint: { type: Type.STRING, description: "The starting phrase or hint for essay questions (e.g., 'I wish...')." },
        pedagogicalHint: { type: Type.STRING, description: "A pedagogical hint in Vietnamese to help students solve the question." }
      },
      required: ["text", "options", "correctOption", "difficulty", "exerciseType"]
    }
  }
};

export const parseQuestionsFromText = async (rawText: string): Promise<ParsedQuestion[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${SYSTEM_PROMPT}\n\nRaw Text:\n${rawText}`,
    config: RESPONSE_CONFIG
  });

  try {
    const json = tryFixTruncatedJson(response.text || "[]");
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    return [];
  }
};

export const parseQuestionsFromFile = async (file: File): Promise<ParsedQuestion[]> => {
  const mimeType = file.type;
  
  // Handle DOCX separately by extracting text
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return parseQuestionsFromText(result.value);
  }

  // Handle PDF and Images directly with Gemini
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      { text: SYSTEM_PROMPT },
      { inlineData: { mimeType, data: base64Data } }
    ],
    config: RESPONSE_CONFIG
  });

  try {
    const json = tryFixTruncatedJson(response.text || "[]");
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to parse AI response from file:", e);
    return [];
  }
};

export const generatePedagogicalHint = async (questionText: string, options?: string[], exerciseType?: string): Promise<string> => {
  if (!questionText || !questionText.trim()) return "";
  
  const content = options && options.length > 0 
    ? `Question: ${questionText}\nOptions: ${options.join(", ")}\nType: ${exerciseType}`
    : `Question: ${questionText}\nType: ${exerciseType}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a subtle pedagogical hint (gợi ý học tập) in Vietnamese for the following English question. 
    The hint should provide a clue or strategy to help students solve the question without giving away the answer directly.
    Keep it concise (max 30 words).

    ${content}`,
  });

  return response.text?.trim() || "";
};

export const translateExplanation = async (text: string): Promise<string> => {
  if (!text || !text.trim()) return "";
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Translate the following English grammar explanation into clear, natural Vietnamese. Keep any Markdown formatting.
    
    Explanation:
    ${text}`,
  });

  return response.text?.trim() || text;
};
