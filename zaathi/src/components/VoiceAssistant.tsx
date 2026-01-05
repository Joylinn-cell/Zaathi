import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { Patient, Medicine, Reminder, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface VoiceAssistantProps {
  lang: Language;
  patients: Patient[];
  medicines: Medicine[];
  onPatientAdd: (name: string, age: number, condition: string) => void;
  onPatientDelete: (id: string) => void;
  onMedicineAdd: (pId: string, name: string, dosage: string, schedule: string, stock: number) => void;
  onReminderAdd: (pId: string, task: string, time: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ 
  lang, 
  patients, 
  medicines, 
  onPatientAdd, 
  onPatientDelete, 
  onMedicineAdd,
  onReminderAdd,
  isOpen, 
  onClose 
}) => {
  const [isActive, setIsActive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<{ role: string; text: string }[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const inputTranscription = useRef('');
  const outputTranscription = useRef('');

  const t = TRANSLATIONS[lang];

  const addDebugLog = (message: string) => {
    console.log('[DEBUG]', message);
    setDebugInfo(prev => `${message}\n${prev}`.slice(0, 500));
  };

  const stopSession = () => {
    sourcesRef.current.forEach(s => { 
      try { 
        s.stop(); 
        s.disconnect();
      } catch(e) {} 
    });
    sourcesRef.current.clear();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {}
      processorRef.current = null;
    }

    if (liveSessionRef.current) {
      liveSessionRef.current.then((session: any) => {
        try {
          session.close();
        } catch (e) {
          console.error('Error closing session:', e);
        }
      });
      liveSessionRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (outAudioContextRef.current && outAudioContextRef.current.state !== 'closed') {
      outAudioContextRef.current.close();
      outAudioContextRef.current = null;
    }

    setIsActive(false);
    nextStartTimeRef.current = 0;
  };

  const getFullLanguageName = (code: Language) => {
    const map: Record<Language, string> = {
      en: 'English',
      ml: 'Malayalam',
      hi: 'Hindi',
      ta: 'Tamil',
      kn: 'Kannada'
    };
    return map[code];
  };

  const getNativeLanguageName = (code: Language) => {
    const map: Record<Language, string> = {
      en: 'English',
      ml: 'മലയാളം',
      hi: 'हिन्दी',
      ta: 'தமிழ்',
      kn: 'ಕನ್ನಡ'
    };
    return map[code];
  };

  const startSession = async () => {
    setErrorMessage('');
    setDebugInfo('');
    
    try {
      addDebugLog('Initializing audio...');
      const warmupSuccess = await geminiService.warmUp();
      if (!warmupSuccess) {
        throw new Error('Failed to initialize audio system');
      }

      addDebugLog('Requesting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;
      addDebugLog('✅ Microphone granted');

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      // FIXED: More explicit function declarations with better descriptions
      const toolDeclarations: FunctionDeclaration[] = [
        {
          name: 'addPatient',
          description: 'Register a new patient in the system. Use this when user wants to add a patient.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              name: { 
                type: Type.STRING, 
                description: 'Full name of the patient' 
              },
              age: { 
                type: Type.NUMBER, 
                description: 'Age of the patient in years' 
              },
              condition: { 
                type: Type.STRING, 
                description: 'Medical condition or health issue of the patient' 
              },
            },
            required: ['name', 'age', 'condition'],
          },
        },
        {
          name: 'addMedicine',
          description: 'Add a medicine schedule for an existing patient. Use this when user wants to add medicine or medication.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              patientName: { 
                type: Type.STRING, 
                description: 'Name of the patient who needs this medicine' 
              },
              medicineName: { 
                type: Type.STRING, 
                description: 'Name of the medicine or medication' 
              },
              dosage: { 
                type: Type.STRING, 
                description: 'Dosage amount (e.g., "2 tablets", "5ml", "1 pill")' 
              },
              schedule: { 
                type: Type.STRING, 
                description: 'Time to take medicine in 24-hour format HH:MM (e.g., "09:00", "14:30", "21:00")' 
              },
              stock: { 
                type: Type.NUMBER, 
                description: 'Number of doses/pills/tablets available in stock' 
              },
            },
            required: ['patientName', 'medicineName', 'dosage', 'schedule', 'stock'],
          },
        },
        {
          name: 'setReminder',
          description: 'Set a reminder or alert for a patient. Use this for tasks like "check blood pressure", "doctor appointment", etc.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              patientName: { 
                type: Type.STRING, 
                description: 'Name of the patient for this reminder' 
              },
              task: { 
                type: Type.STRING, 
                description: 'Description of the task or reminder (e.g., "Check blood pressure", "Take temperature")' 
              },
              time: { 
                type: Type.STRING, 
                description: 'Time for the reminder in 24-hour format HH:MM (e.g., "10:00", "15:30")' 
              },
            },
            required: ['patientName', 'task', 'time'],
          },
        },
        {
          name: 'listStatus',
          description: 'Get a summary of all current patients in the system. Use when user asks "who are the patients" or "list patients".',
          parameters: {
            type: Type.OBJECT,
            properties: {},
          }
        }
      ];

      const fullLang = getFullLanguageName(lang);
      const nativeLang = getNativeLanguageName(lang);

      // FIXED: Better system instruction with clearer function usage guidelines
      const systemInstruction = `You are Zaathi, an AI Caregiver Companion assistant.

LANGUAGE: You speak ${fullLang} (${nativeLang}). Respond naturally in ${fullLang}.

CURRENT PATIENTS: ${patients.length > 0 ? patients.map(p => `${p.name} (age ${p.age})`).join(', ') : 'None yet'}

YOUR CAPABILITIES:
1. Register new patients - Use addPatient function
2. Add medicine schedules - Use addMedicine function  
3. Set reminders - Use setReminder function
4. Check patient list - Use listStatus function

IMPORTANT RULES:
- When user asks to add a patient, ALWAYS call addPatient function
- When user mentions medicine/medication/pills, ALWAYS call addMedicine function
- When user asks for reminders/alerts, ALWAYS call setReminder function
- After calling a function, confirm what you did in ${fullLang}
- Ask for missing information if needed (like age, time, dosage)
- Keep responses SHORT and CLEAR
- Use natural conversation flow

EXAMPLES OF WHAT TO DO:
User: "Add a patient named John, age 65, diabetic"
→ Call addPatient with name="John", age=65, condition="diabetic"
→ Say: "Okay, I've registered John as a patient"

User: "Set medicine aspirin 2 tablets at 9 AM for John"  
→ Call addMedicine with patientName="John", medicineName="aspirin", dosage="2 tablets", schedule="09:00", stock=(ask or estimate 30)
→ Say: "Done, aspirin scheduled for John at 9 AM"

User: "Remind me to check blood pressure at 3 PM for John"
→ Call setReminder with patientName="John", task="check blood pressure", time="15:00"
→ Say: "Reminder set for 3 PM"

RESPOND IMMEDIATELY. BE HELPFUL. USE FUNCTIONS WHEN APPROPRIATE.`;

      const config = {
        responseModalities: [Modality.AUDIO],
        tools: [{ functionDeclarations: toolDeclarations }],
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { 
              voiceName: lang === 'en' ? 'Zephyr' : 'Puck' 
            } 
          } 
        },
        systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      };

      addDebugLog('Connecting to Gemini Live...');

      // FIXED: Better session handling and tool response
      const sessionPromise = geminiService.connectLive(async (message: LiveServerMessage) => {
        // LOG ALL MESSAGES
        console.log('📩 Message received:', message);
        
        // Handle tool calls (function executions)
        if (message.toolCall) {
          addDebugLog(`🔧 Tool call received: ${message.toolCall.functionCalls?.length || 0} function(s)`);
          console.log('📞 TOOL CALL DETECTED:', message.toolCall);
          
          for (const fc of message.toolCall.functionCalls || []) {
            addDebugLog(`Executing: ${fc.name}`);
            console.log('🎯 Function call:', fc.name, 'Args:', fc.args);
            
            let result: any = { success: false, message: "Unknown error" };
            
            try {
              if (fc.name === 'addPatient') {
                const { name, age, condition } = fc.args as any;
                addDebugLog(`Adding patient: ${name}`);
                onPatientAdd(name, age, condition);
                result = { success: true, message: `Patient ${name} added successfully` };
                
              } else if (fc.name === 'addMedicine') {
                const { patientName, medicineName, dosage, schedule, stock } = fc.args as any;
                addDebugLog(`Adding medicine: ${medicineName} for ${patientName}`);
                
                const p = patients.find(x => 
                  x.name.toLowerCase().includes(patientName.toLowerCase()) || 
                  patientName.toLowerCase().includes(x.name.toLowerCase())
                );
                
                if (p) { 
                  onMedicineAdd(p.id, medicineName, dosage, schedule, stock || 30);
                  result = { success: true, message: `Medicine ${medicineName} scheduled for ${patientName} at ${schedule}` };
                } else { 
                  result = { success: false, message: `Patient ${patientName} not found. Please add the patient first.` };
                }
                
              } else if (fc.name === 'setReminder') {
                const { patientName, task, time } = fc.args as any;
                addDebugLog(`Setting reminder: ${task} for ${patientName}`);
                
                const p = patients.find(x => 
                  x.name.toLowerCase().includes(patientName.toLowerCase()) || 
                  patientName.toLowerCase().includes(x.name.toLowerCase())
                );
                
                if (p) { 
                  onReminderAdd(p.id, task, time);
                  result = { success: true, message: `Reminder "${task}" set for ${patientName} at ${time}` };
                } else { 
                  result = { success: false, message: `Patient ${patientName} not found. Please add the patient first.` };
                }
                
              } else if (fc.name === 'listStatus') {
                addDebugLog('Listing patients...');
                if (patients.length > 0) {
                  result = { 
                    success: true, 
                    patients: patients.map(p => ({ name: p.name, age: p.age, condition: p.condition })),
                    message: `Current patients: ${patients.map(p => p.name).join(', ')}`
                  };
                } else {
                  result = { success: true, message: "No patients registered yet." };
                }
              }
              
              addDebugLog(`✅ Result: ${result.message}`);
              
            } catch (error: any) {
              console.error('Function execution error:', error);
              result = { success: false, message: error.message || "Error executing function" };
              addDebugLog(`❌ Error: ${error.message}`);
            }

            // FIXED: Send tool response back to Gemini
            try {
              const session = await sessionPromise;
              await session.sendToolResponse({
                functionResponses: [{
                  id: fc.id,
                  name: fc.name,
                  response: result
                }]
              });
              addDebugLog('Tool response sent');
            } catch (err) {
              console.error('Failed to send tool response:', err);
              addDebugLog('❌ Failed to send tool response');
            }
          }
        }

        // Handle audio response
        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio && outAudioContextRef.current) {
          addDebugLog('🔊 Playing audio response');
          console.log('🔊 Audio response received, length:', base64Audio.length);
          try {
            const ctx = outAudioContextRef.current;
            const audioBuffer = await geminiService.decodeAudioChunk(base64Audio, ctx);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
            source.onended = () => sourcesRef.current.delete(source);
          } catch (err) {
            console.error('Audio playback error:', err);
          }
        }

        // Handle transcriptions
        if (message.serverContent?.inputTranscription) {
          inputTranscription.current += message.serverContent.inputTranscription.text;
          addDebugLog(`👤 User said: ${message.serverContent.inputTranscription.text}`);
          console.log('👤 USER:', message.serverContent.inputTranscription.text);
        }
        
        if (message.serverContent?.outputTranscription) {
          outputTranscription.current += message.serverContent.outputTranscription.text;
          addDebugLog(`🤖 AI said: ${message.serverContent.outputTranscription.text}`);
          console.log('🤖 AI:', message.serverContent.outputTranscription.text);
        }

        if (message.serverContent?.turnComplete) {
          if (inputTranscription.current || outputTranscription.current) {
            setTranscriptions(prev => [
              ...prev,
              ...(inputTranscription.current ? [{ role: 'user', text: inputTranscription.current }] : []),
              ...(outputTranscription.current ? [{ role: 'assistant', text: outputTranscription.current }] : [])
            ].slice(-10));
          }
          inputTranscription.current = '';
          outputTranscription.current = '';
          addDebugLog('Turn complete');
        }

        if (message.serverContent?.interrupted) {
          sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
          addDebugLog('Interrupted');
        }
      }, config);

      liveSessionRef.current = sessionPromise;
      
      // Connect microphone
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const scriptProcessor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = geminiService.createAudioBlob(inputData);
        sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob })).catch(console.error);
      };
      
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContextRef.current.destination);
      processorRef.current = scriptProcessor;
      
      setIsActive(true);
      addDebugLog('✅ Voice assistant active!');
      
    } catch (err: any) {
      console.error("Voice Assistant error:", err);
      
      let userMessage = 'Failed to start voice assistant. ';
      
      if (err.name === 'NotAllowedError') {
        userMessage += 'Microphone access was denied.';
      } else if (err.name === 'NotFoundError') {
        userMessage += 'No microphone found.';
      } else if (err.message?.includes('API key')) {
        userMessage += 'API key not configured.';
      } else {
        userMessage += err.message || 'Unknown error occurred.';
      }
      
      setErrorMessage(userMessage);
      addDebugLog(`❌ ${userMessage}`);
      stopSession();
    }
  };

  useEffect(() => {
    // Only stop session when modal closes, not on every render
    return () => {
      if (!isOpen) {
        console.log('Modal closed, stopping session...');
        stopSession();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[75vh]">
        <div className="bg-indigo-600 p-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full bg-white ${isActive ? 'animate-pulse' : 'opacity-30'}`}></div>
            <h3 className="font-bold text-xl">{t.forms.assistantTitle}</h3>
          </div>
          <button onClick={onClose} className="text-2xl">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
          {errorMessage && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 text-rose-700 font-medium text-sm">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Debug Panel - Remove this in production */}
          {debugInfo && (
            <details className="bg-slate-100 rounded-xl p-3 text-xs">
              <summary className="cursor-pointer font-bold text-slate-600">Debug Log</summary>
              <pre className="mt-2 text-slate-500 whitespace-pre-wrap">{debugInfo}</pre>
            </details>
          )}
          
          {transcriptions.length === 0 && !errorMessage && (
            <div className="text-center py-6 opacity-60">
              <div className="text-4xl mb-4">🤖</div>
              <p className="font-bold text-sm mb-4">{t.forms.trySaying}</p>
              <div className="text-xs space-y-2">
                <p className="bg-white p-3 rounded-xl border italic text-slate-600">
                  {t.forms.examplePhrase}
                </p>
                <p className="bg-white p-3 rounded-xl border italic text-slate-600">
                  "Add patient John, age 65, diabetic"
                </p>
                <p className="bg-white p-3 rounded-xl border italic text-slate-600">
                  "Set medicine aspirin 2 tablets at 9 AM for John"
                </p>
              </div>
            </div>
          )}
          
          {transcriptions.map((tMsg, i) => (
            <div key={i} className={`flex ${tMsg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${tMsg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border rounded-tl-none shadow-sm'}`}>
                {tMsg.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 bg-white border-t flex flex-col items-center gap-4">
          {!isActive ? (
            <button onClick={startSession} className="bg-indigo-600 text-white px-10 py-4 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition w-full">
              🎤 {t.forms.speak}
            </button>
          ) : (
            <button onClick={stopSession} className="text-rose-600 font-bold border-2 border-rose-100 px-6 py-2 rounded-xl w-full hover:bg-rose-50 transition">
              {t.forms.stop}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;