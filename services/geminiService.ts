
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TrackMetadata, MoodPreset } from "../types";

const getApiKey = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('gemini_api_key') || process.env.API_KEY || '';
    }
  } catch (e) {}
  return process.env.API_KEY || '';
};

export const generateTrackConcept = async (prompt: string, preset?: MoodPreset): Promise<TrackMetadata> => {
  // Create instance right before use to get updated API key from localStorage
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const model = 'gemini-3-flash-preview';
  
  const systemInstruction = `
    You are an expert Lo-Fi music producer. 
    Generate a musical "DNA" for a procedural Lo-Fi track.
    - BPM: 70-85.
    - IntroText: A warm, short radio-host style intro.
    - Musical Parameters: Provide a key and scale.
    - Chord Progression: Exactly 4 soulful chords (e.g. Cmaj7, Am9).
    - Melody Complexity: How dense the generative lead should be (0.2 for chill, 0.7 for upbeat).
  `;

  const response = await ai.models.generateContent({
    model,
    contents: `User Request: ${prompt || (preset || 'Relaxing Vibes')}`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          bpm: { type: Type.NUMBER },
          mood: { type: Type.STRING },
          color: { type: Type.STRING },
          introText: { type: Type.STRING },
          musicalParameters: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING },
              scaleType: { type: Type.STRING, enum: ['major', 'minor', 'pentatonic'] },
              chordProgression: { type: Type.ARRAY, items: { type: Type.STRING } },
              filterCutoff: { type: Type.NUMBER },
              reverbWet: { type: Type.NUMBER },
              melodyComplexity: { type: Type.NUMBER }
            },
            required: ["key", "scaleType", "chordProgression", "filterCutoff", "reverbWet", "melodyComplexity"]
          }
        },
        required: ["name", "bpm", "mood", "color", "introText", "musicalParameters"]
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  return {
    ...data,
    id: Math.random().toString(36).substr(2, 9),
    artist: "Gemini AI"
  };
};

export const generateVoiceIntro = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const model = 'gemini-2.5-flash-preview-tts';
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: `Say warmly: ${text}` }] }],
    config: {
      // Fixed: Use Modality.AUDIO from @google/genai
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio || '';
};
