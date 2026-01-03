
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Slider } from './components/Slider';
import { SafetyGuard } from './components/SafetyGuard';
import { storage } from './services/storage';
import { geminiService } from './services/gemini';
import { CheckIn, RecoveryState, ActionType, Recommendation } from './types';
import { translations, Language } from './translations';

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
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

// Helper to wrap PCM in a WAV header for download
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const bufferLength = buffer.length;
  const dataSize = bufferLength * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  const offset = 44;
  const channelData = buffer.getChannelData(0); // Assuming mono for this app
  for (let i = 0; i < bufferLength; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset + (i * 2), sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('th');
  const t = translations[lang];

  const [activeTab, setActiveTab] = useState<'checkin' | 'plan' | 'insights'>('checkin');
  const [energy, setEnergy] = useState(5);
  const [sleep, setSleep] = useState(5);
  const [stress, setStress] = useState(5);
  const [social, setSocial] = useState(5);
  const [clarity, setClarity] = useState(5);
  const [journal, setJournal] = useState('');
  
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isFetchingAudio, setIsFetchingAudio] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const ttsAudioContext = useRef<AudioContext | null>(null);
  const ttsSource = useRef<AudioBufferSourceNode | null>(null);
  const currentAudioBuffer = useRef<AudioBuffer | null>(null);
  const audioFetchPromise = useRef<Promise<AudioBuffer | null> | null>(null);

  useEffect(() => {
    const loadedHistory = storage.getCheckIns();
    setHistory(loadedHistory);
    const lastRec = storage.getLatestRecommendation();
    setRecommendation(lastRec);
    
    // Prefetch audio for the latest recommendation on mount
    if (lastRec) {
      triggerAudioPrefetch(lastRec);
    }

    if (loadedHistory.length >= 3) {
      geminiService.generateInsights(loadedHistory, lang).then(setAiInsight);
    }

    return () => {
      if (ttsSource.current) {
        try { ttsSource.current.stop(); } catch(e) {}
      }
      if (ttsAudioContext.current) ttsAudioContext.current.close();
    };
  }, []);

  useEffect(() => {
    if (history.length >= 3) {
      geminiService.generateInsights(history, lang).then(setAiInsight);
    }
  }, [lang, history.length]);

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'th' : 'en');
  };

  const triggerAudioPrefetch = (rec: Recommendation) => {
    currentAudioBuffer.current = null;
    audioFetchPromise.current = (async () => {
      try {
        if (!ttsAudioContext.current) {
          ttsAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        const speechText = `${rec.affirmation}. ${rec.title}. ${rec.description}. ${lang === 'th' ? 'ทำไมสิ่งนี้ถึงช่วยคุณ' : 'Why this helps'}: ${rec.explanation}`;
        const base64Audio = await geminiService.generateSpeech(speechText, lang);
        
        const buffer = await decodeAudioData(
          decodeBase64(base64Audio),
          ttsAudioContext.current,
          24000,
          1
        );
        currentAudioBuffer.current = buffer;
        return buffer;
      } catch (err) {
        console.error("Prefetch failed", err);
        return null;
      }
    })();
  };

  const prepareAudio = async (): Promise<AudioBuffer | null> => {
    if (currentAudioBuffer.current) return currentAudioBuffer.current;
    if (audioFetchPromise.current) return await audioFetchPromise.current;
    
    // If no promise or buffer exists, trigger one (should not happen with prefetch logic)
    if (recommendation) {
      triggerAudioPrefetch(recommendation);
      return await audioFetchPromise.current;
    }
    return null;
  };

  const handleSpeakPlan = async () => {
    if (isSpeaking) {
      if (ttsSource.current) {
        try { ttsSource.current.stop(); } catch(e) {}
        ttsSource.current = null;
      }
      setIsSpeaking(false);
      return;
    }

    if (!recommendation || isFetchingAudio) return;

    try {
      setIsFetchingAudio(true);
      
      // Ensure context is resumed on user click
      if (ttsAudioContext.current && ttsAudioContext.current.state === 'suspended') {
        await ttsAudioContext.current.resume();
      }

      const audioBuffer = await prepareAudio();
      if (!audioBuffer || !ttsAudioContext.current) throw new Error("Audio buffer unavailable");

      const source = ttsAudioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ttsAudioContext.current.destination);
      source.onended = () => {
        setIsSpeaking(false);
        ttsSource.current = null;
      };
      
      ttsSource.current = source;
      setIsFetchingAudio(false);
      setIsSpeaking(true);
      source.start();
    } catch (error) {
      console.error("Speech error:", error);
      setIsFetchingAudio(false);
      setIsSpeaking(false);
    }
  };

  const handleDownloadAudio = async () => {
    if (!recommendation || isDownloading) return;
    try {
      setIsDownloading(true);
      const audioBuffer = await prepareAudio();
      if (!audioBuffer) throw new Error("Audio buffer unavailable");

      const wavBlob = audioBufferToWav(audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fuen-recovery-${recommendation.state.toLowerCase()}-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCheckIn = async () => {
    const crisisKeywords = ['suicide', 'kill myself', 'hurt myself', 'end it all', 'die', 'ฆ่าตัวตาย', 'อยากตาย', 'ทำร้ายตัวเอง'];
    if (crisisKeywords.some(keyword => journal.toLowerCase().includes(keyword))) {
      setIsSafetyOpen(true);
      return;
    }

    setIsAnalyzing(true);
    const newCheckIn: CheckIn = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US'),
      energy, sleep, stress, social, clarity, journal
    };

    try {
      const rec = await geminiService.analyzeRecovery(newCheckIn, history, lang);
      storage.saveCheckIn(newCheckIn);
      storage.saveRecommendation(rec);
      
      // CRITICAL: Set recommendation first, THEN trigger background prefetch
      setRecommendation(rec);
      triggerAudioPrefetch(rec);
      
      setHistory(prev => [newCheckIn, ...prev]);
      setActiveTab('plan');
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const chartData = useMemo(() => {
    return [...history].reverse().map(h => ({
      date: h.date,
      energy: h.energy,
      stress: h.stress,
      sleep: h.sleep
    }));
  }, [history]);

  return (
    <div className="min-h-screen gradient-bg text-slate-900 pb-24">
      <SafetyGuard isOpen={isSafetyOpen} onClose={() => setIsSafetyOpen(false)} lang={lang} />
      
      <header className="px-6 pt-12 pb-6 max-w-2xl mx-auto flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 mb-2">
            {lang === 'th' ? 'ฟื้น' : 'FUE-N'} 
            <span className="text-emerald-600 font-light ml-2 text-2xl">
              {lang === 'th' ? 'FUE-N' : 'ฟื้น'}
            </span>
          </h1>
          <p className="text-slate-500 font-light leading-relaxed max-w-md">{t.app_subtitle}</p>
        </div>
        <button 
          onClick={toggleLanguage}
          className="px-3 py-1.5 bg-white rounded-full border border-slate-200 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors"
        >
          {lang === 'en' ? 'ไทย 🇹🇭' : 'EN 🇺🇸'}
        </button>
      </header>

      <main className="px-6 max-w-2xl mx-auto space-y-8">
        <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-slate-200 shadow-sm">
          {(['checkin', 'plan', 'insights'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t[`tab_${tab === 'checkin' ? 'pulse' : tab === 'plan' ? 'action' : 'insights'}` as keyof typeof t]}
            </button>
          ))}
        </div>

        {activeTab === 'checkin' && (
          <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-semibold text-slate-900 mb-8">{t.checkin_title}</h2>
            <Slider label={t.slider_energy} value={energy} onChange={setEnergy} minLabel={t.min_energy} maxLabel={t.max_energy} icon="⚡" />
            <Slider label={t.slider_sleep} value={sleep} onChange={setSleep} minLabel={t.min_sleep} maxLabel={t.max_sleep} icon="🌙" />
            <Slider label={t.slider_stress} value={stress} onChange={setStress} minLabel={t.min_stress} maxLabel={t.max_stress} icon="🌊" />
            <Slider label={t.slider_social} value={social} onChange={setSocial} minLabel={t.min_social} maxLabel={t.max_social} icon="🤝" />
            <Slider label={t.slider_clarity} value={clarity} onChange={setClarity} minLabel={t.min_clarity} maxLabel={t.max_clarity} icon="✨" />
            
            <div className="space-y-3 mt-8">
              <label className="text-sm font-medium text-slate-700">{t.journal_label}</label>
              <textarea
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                placeholder={t.journal_placeholder}
                className="w-full h-32 p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none text-sm"
              />
            </div>

            <button
              onClick={handleCheckIn}
              disabled={isAnalyzing}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold mt-8 hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t.btn_analyzing}
                </>
              ) : t.btn_generate}
            </button>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!recommendation ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-slate-500">{t.plan_empty}</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 relative overflow-hidden">
                  {/* Top Header Section with Status and Buttons */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        {t.state_label}: {t.states[recommendation.state as keyof typeof t.states] || recommendation.state}
                      </span>
                      <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                        {recommendation.durationMinutes} {t.duration_unit}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button 
                        onClick={handleSpeakPlan}
                        disabled={isFetchingAudio}
                        className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all text-sm font-semibold ${
                          isSpeaking 
                            ? 'bg-emerald-500 text-white shadow-lg animate-pulse' 
                            : isFetchingAudio 
                              ? 'bg-slate-100 text-slate-400 cursor-wait'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        {isFetchingAudio ? (
                           <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                        ) : isSpeaking ? (
                          <div className="flex gap-0.5 items-end h-3">
                            <div className="w-1 bg-white animate-bounce" style={{height: '60%', animationDuration: '0.6s'}}></div>
                            <div className="w-1 bg-white animate-bounce" style={{height: '100%', animationDuration: '0.8s'}}></div>
                            <div className="w-1 bg-white animate-bounce" style={{height: '40%', animationDuration: '0.7s'}}></div>
                          </div>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.984 3.984 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span>{isFetchingAudio ? '...' : isSpeaking ? (lang === 'th' ? "หยุดฟัง" : "STOP") : (lang === 'th' ? "ฟัง" : "LISTEN")}</span>
                      </button>

                      <button 
                        onClick={handleDownloadAudio}
                        disabled={isDownloading || isFetchingAudio}
                        className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all text-sm font-semibold border ${
                          isDownloading 
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600 shadow-sm'
                        }`}
                      >
                        {isDownloading ? (
                          <div className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                        <span>{isDownloading ? t.btn_downloading : t.btn_download}</span>
                      </button>
                    </div>
                  </div>

                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">{recommendation.title}</h2>
                    <p className="text-lg text-slate-600 leading-relaxed">{recommendation.description}</p>
                  </div>

                  {/* Affirmation Card */}
                  <div className="bg-emerald-50/70 rounded-[2rem] p-8 sm:p-12 border border-emerald-100 mb-8 relative overflow-hidden shadow-inner flex flex-col items-center text-center">
                    <div className="absolute top-4 left-6 text-emerald-200 opacity-50">
                      <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21C21.017 22.1046 20.1216 23 19.017 23H16.017C14.9124 23 14.017 22.1046 14.017 21ZM14.017 12L14.017 9C14.017 7.89543 14.9124 7 16.017 7H19.017C20.1216 7 21.017 7.89543 21.017 9V12C21.017 13.1046 20.1216 14 19.017 14H16.017C14.9124 14 14.017 13.1046 14.017 12ZM3.01697 21L3.01697 18C3.01697 16.8954 3.9124 16 5.01697 16H8.01697C9.12154 16 10.017 16.8954 10.017 18V21C10.017 22.1046 9.12154 23 8.01697 23H5.01697C3.9124 23 3.01697 22.1046 3.01697 21ZM3.01697 12L3.01697 9C3.01697 7.89543 3.9124 7 5.01697 7H8.01697C9.12154 7 10.017 7.89543 10.017 9V12C10.017 13.1046 9.12154 14 8.01697 14H5.01697C3.9124 14 3.01697 13.1046 3.01697 12Z" />
                      </svg>
                    </div>
                    <h3 className="text-[10px] font-bold text-emerald-700 uppercase tracking-[0.4em] mb-10">
                       {t.affirmation_title}
                    </h3>
                    <div className="relative z-10 w-full">
                      <p className="text-base sm:text-lg font-light text-slate-800 italic leading-[1.8] whitespace-pre-wrap max-w-xl mx-auto">
                        {recommendation.affirmation}
                      </p>
                    </div>
                    <div className="mt-10 w-16 h-1 bg-emerald-200/40 rounded-full"></div>
                  </div>
                  
                  <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                      <span className="text-emerald-500">✨</span> {t.why_helps}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed italic">"{recommendation.explanation}"</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">{t.insights_trends}</h3>
              {history.length < 2 ? (
                <p className="text-sm text-slate-400 italic text-center py-12">{t.insights_no_data}</p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" hide />
                      <YAxis domain={[0, 10]} hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Line type="monotone" dataKey="energy" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="stress" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">{t.insights_reflections}</h3>
              <div className="bg-slate-50 rounded-2xl p-6 min-h-[100px] flex items-center">
                {aiInsight ? (
                  <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {aiInsight}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic text-center w-full">{t.insights_no_data}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 px-2">{t.history_title}</h3>
              {history.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.date}</span>
                    <div className="flex gap-2">
                      <div className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full">E: {item.energy}</div>
                      <div className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-full">S: {item.stress}</div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2 italic">
                    {item.journal || t.history_no_notes}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
