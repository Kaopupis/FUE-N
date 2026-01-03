
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { CheckIn, RecoveryState, ActionType, Recommendation } from "../types";
import { Language } from "../translations";

export const geminiService = {
  async analyzeRecovery(currentCheckIn: CheckIn, history: CheckIn[], lang: Language): Promise<Recommendation> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      You are FUE-N, an empathetic recovery coach. Analyze the user's current signals and history.
      CRITICAL REQUIREMENT: You MUST provide all textual response fields (title, description, explanation, and affirmation) in ${lang === 'th' ? 'THAI language only' : 'ENGLISH language only'}.
      
      User Data:
      - Energy: ${currentCheckIn.energy}/10
      - Sleep: ${currentCheckIn.sleep}/10
      - Stress: ${currentCheckIn.stress}/10
      - Social Battery: ${currentCheckIn.social}/10
      - Mental Clarity: ${currentCheckIn.clarity}/10
      - Journal Note: "${currentCheckIn.journal}"
      
      Historical Context (last 7 entries):
      ${JSON.stringify(history.slice(0, 7))}

      Instructions:
      1. Determine current Recovery State: {Depleted, Overloaded, Flat, Stable, Recharging}.
      2. Choose one Action Type: {Rest, Calm, Connect, Move, Express}.
      3. Suggest exactly ONE micro-action (3-15 mins).
      4. Provide a gentle, non-diagnostic explanation.
      5. Generate a deeply soulful "Recovery Affirmation" that is EXACTLY 20 lines long.
         - Each line should be a separate, short, meaningful sentence or phrase.
         - It should feel like a long, meditative journey of self-love and healing.
         - The flow should move from acknowledging current pain to offering hope and permission to rest.
         - Use newlines (\\n) to separate exactly 20 lines.
      6. Tone: Calm, supportive, human. NO medical advice.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            state: { type: Type.STRING },
            actionType: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            durationMinutes: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
            affirmation: { type: Type.STRING }
          },
          required: ["state", "actionType", "title", "description", "durationMinutes", "explanation", "affirmation"]
        }
      }
    });

    try {
      const jsonStr = response.text || "{}";
      return JSON.parse(jsonStr) as Recommendation;
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      const fallbackAffirmationTh = [
        "ในห้วงเวลาที่ลมหายใจเริ่มเหนื่อยล้า",
        "ฉันขออนุญาตให้หัวใจได้วางภาระลง",
        "โลกภายนอกอาจหมุนไปอย่างรวดเร็ว",
        "แต่ในพื้นที่นี้ ฉันมีสิทธิ์ที่จะเดินช้าลง",
        "ร่างกายของฉันไม่ใช่เครื่องจักรที่ต้องทำงานตลอดเวลา",
        "มันคือบ้านที่ต้องการความอ่อนโยนและการดูแล",
        "ฉันยอมรับความอ่อนแอที่เกิดขึ้นในวันนี้",
        "โดยไม่ตัดสิน หรือตำหนิตนเองในความล้า",
        "ความมืดมิดของความเหนื่อยคือการเตรียมพร้อมรับแสงใหม่",
        "เหมือนแผ่นดินที่รอคอยหยาดฝนมาเยียวยา",
        "ฉันสูดลมหายใจเอาความเมตตาเข้าสู่เซลล์ทุกส่วน",
        "และปล่อยวางความคาดหวังที่กัดกินใจออกไป",
        "หนึ่งก้าวเล็กๆ ในการพักผ่อน มีค่ากว่าหมื่นก้าวที่ฝืนทน",
        "ฉันรักตัวเองได้ แม้ในวันที่ฉันทำอะไรไม่ได้เลย",
        "ความเงียบสงบคือยารักษาที่วิเศษที่สุด",
        "และฉันคู่ควรกับความสงบนั้นอย่างไม่มีเงื่อนไข",
        "พรุ่งนี้ยังมีเวลาให้เริ่มต้นใหม่เสมอ",
        "แต่ตอนนี้ คือเวลาของการโอบกอดจิตวิญญาณ",
        "ฉันปลอดภัย ฉันเป็นอิสระ และฉันกำลังฟื้นฟู",
        "ขอบคุณหัวใจที่ยังคงเต้นเพื่อฉันในทุกนาที"
      ].join('\n');

      const fallbackAffirmationEn = [
        "In this moment of quiet exhaustion,",
        "I give my heart full permission to rest.",
        "The world may keep moving fast,",
        "But here, I choose a gentler pace.",
        "My body is not a machine for production,",
        "It is a sacred vessel that needs care.",
        "I acknowledge the fatigue within me now,",
        "With kindness and without any judgment.",
        "The darkness of tiredness is a preparation,",
        "Like the earth waiting for healing rain.",
        "I breathe in compassion for my whole self,",
        "And exhale the weight of heavy expectations.",
        "A small pause is worth more than a forced run,",
        "I am worthy of love even when I do nothing.",
        "Silence is the most profound medicine I have,",
        "And I deserve this stillness unconditionally.",
        "Tomorrow will offer its own new beginning,",
        "But now is the time to embrace my soul.",
        "I am safe, I am free, and I am healing.",
        "Thank you, heart, for beating just for me."
      ].join('\n');

      return {
        state: RecoveryState.Stable,
        actionType: ActionType.Rest,
        title: lang === 'th' ? "หยุดพักสั้นๆ" : "Gentle Pause",
        description: lang === 'th' ? "หลับตาและหายใจเข้าลึกๆ" : "Close your eyes and breathe deeply.",
        durationMinutes: 3,
        explanation: lang === 'th' ? "การพักผ่อนคือจุดเริ่มต้นของการฟื้นฟู" : "Rest is the foundation of recovery.",
        affirmation: lang === 'th' ? fallbackAffirmationTh : fallbackAffirmationEn
      };
    }
  },

  async generateSpeech(text: string, lang: Language): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const voiceName = 'Charon'; 
    // Simplified prompt for faster processing, focusing on key attributes
    const instruction = lang === 'th' 
      ? `น้ำเสียงผู้ชาย อบอุ่น นุ่มนวล อ่านข้อความนี้ช้าๆ และเว้นจังหวะให้ผ่อนคลาย: ${text}` 
      : `Male voice, warm and soothing. Read this text slowly with relaxed pacing: ${text}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: instruction }] }],
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
    if (!base64Audio) throw new Error("No audio data received");
    return base64Audio;
  },

  async generateInsights(history: CheckIn[], lang: Language): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      Summarize the user's recovery patterns from the following history:
      ${JSON.stringify(history)}
      Language: Respond in ${lang === 'th' ? 'THAI' : 'ENGLISH'}.
      Limit to 3 short bullet points. Keep it reflective and non-judgmental.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });

    return response.text || "";
  }
};
