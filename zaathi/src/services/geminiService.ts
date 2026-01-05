import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";

// FIXED: In browser apps, environment variables need to be accessed differently
// For Vite: import.meta.env.VITE_API_KEY
// For Create React App: process.env.REACT_APP_API_KEY
// For Next.js: process.env.NEXT_PUBLIC_API_KEY
const getApiKey = () => {
  // For Vite projects
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore - Vite env is available at runtime
      return import.meta.env.VITE_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '';
    }
  } catch (e) {
    console.error('Error accessing import.meta.env:', e);
  }
  
  // Fallback for CRA
  if (typeof process !== 'undefined' && process.env) {
    return process.env.REACT_APP_API_KEY || process.env.REACT_APP_GOOGLE_API_KEY || '';
  }
  
  return '';
};

// Singleton AudioContext for better stability across the application
let sharedAudioCtx: AudioContext | null = null;

const initAudioContext = async () => {
  if (!sharedAudioCtx) {
    // FIXED: Added error handling and browser compatibility
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported in this browser');
      }
      sharedAudioCtx = new AudioContextClass({ sampleRate: 24000 });
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
      throw error;
    }
  }
  if (sharedAudioCtx.state === 'suspended') {
    await sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
};

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const geminiService = {
  /**
   * MUST be called inside a direct user click handler to unlock browser audio.
   */
  async warmUp() {
    try {
      await initAudioContext();
      return true;
    } catch (error) {
      console.error('Audio warmup failed:', error);
      return false;
    }
  },

  async speak(text: string, voiceName: 'Kore' | 'Puck' | 'Zephyr' = 'Kore') {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error('API key not found. Please set VITE_API_KEY in your .env file');
      return;
    }
    
    try {
      const ctx = await initAudioContext();

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Convert this text to speech using a warm, professional caregiver tone. 
      Read the text exactly as written. If it contains Hindi, Tamil, Kannada, or Malayalam, use flawless native pronunciation. 
      Do NOT translate. Just read the following text:
      
      "${text}"`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (ctx.state === 'suspended') await ctx.resume();

        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    } catch (error) {
      console.error("TTS Error:", error);
    }
  },

  async ask(prompt: string, context: string) {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error('API key not found');
      return "AI service unavailable.";
    }
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          systemInstruction: `You are Zaathi, a highly professional caregiver companion. You provide medical advice with extreme caution. Always advise consulting a doctor for critical issues. Be empathetic and clear. Context: ${context}`,
        }
      });
      return response.text || "I'm sorry, I couldn't process that.";
    } catch (error) {
      console.error("Chat Error:", error);
      return "Something went wrong.";
    }
  },

  connectLive(onMessage: (msg: LiveServerMessage) => void, config: any) {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error('API key not found');
      throw new Error('API key required for live connection');
    }
    
    console.log('🔌 Attempting to connect to Gemini Live...');
    console.log('📝 Model: gemini-2.5-flash-native-audio-preview-09-2025');
    
    const ai = new GoogleGenAI({ apiKey });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config,
      callbacks: {
        onopen: () => {
          console.log('✅ Live connected successfully');
          console.log('🟢 WebSocket is OPEN and ready');
        },
        onmessage: onMessage,
        onerror: (e) => {
          console.error('❌ Live connection error:', e);
          if (e.message) console.error('Error message:', e.message);
          if ((e as any).code) console.error('Error code:', (e as any).code);
        },
        onclose: (event) => {
          console.log('🔴 Live connection closed');
          if (event) {
            console.log('Close code:', event.code);
            console.log('Close reason:', event.reason);
            console.log('Was clean:', event.wasClean);
          }
        },
      }
    });
  },

  createAudioBlob(data: Float32Array): { data: string, mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  },

  async decodeAudioChunk(base64: string, ctx: AudioContext) {
    return decodeAudioData(decode(base64), ctx, 24000, 1);
  }
};