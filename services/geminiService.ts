
import { GoogleGenAI, Type, FunctionDeclaration, Schema } from "@google/genai";
import { DiaryEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Analysis Service ---

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    moodScore: { type: Type.NUMBER, description: "心情评分，范围 1 (糟糕) 到 10 (极好)。" },
    tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5个情感或话题标签（中文）。" },
    summary: { type: Type.STRING, description: "一句话总结日记内容（中文）。" },
    advice: { type: Type.STRING, description: "一句简短、温柔的建议或鼓励的话（中文）。" },
  },
  required: ["moodScore", "tags", "summary", "advice"],
};

export const analyzeDiaryEntry = async (text: string, attachments: string[] = []): Promise<Partial<DiaryEntry>> => {
  try {
    const parts: any[] = [];
    
    // Add attachments (images/video/audio) if available
    attachments.forEach(att => {
        // Regex to extract base64 data and mime type for images, video, and audio
        const match = att.match(/^data:(\w+\/[\w-.+]+);base64,(.+)$/);
        if (match) {
            parts.push({
                inlineData: {
                    mimeType: match[1],
                    data: match[2]
                }
            });
        }
    });

    // Add text prompt
    parts.push({ text: `分析这篇日记: "${text}"。如果提供了图片或视频，请结合视觉和听觉内容进行分析。` });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Use flash for multimodal analysis
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Analysis failed", error);
    return {
      moodScore: 5,
      tags: ["未知"],
      summary: "无法分析内容。",
      advice: "深呼吸，一切都会好起来的。",
    };
  }
};

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [
                { inlineData: { mimeType: mimeType, data: base64Audio } },
                { text: "请将这段音频准确转录为中文文本。直接输出内容，不要包含 markdown 格式或其他解释。" }
            ]
        }
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription failed", error);
    throw error;
  }
};

export const fetchDailyJoke = async (): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { text: "讲一个适合放在应用首页的简短幽默冷笑话。仅返回笑话内容，不包含标题或其他解释。" }
                ]
            },
        });
        return response.text?.trim() || "今天的天气真不错！(AI 似乎在发呆)";
    } catch (error) {
        console.error("Failed to fetch joke", error);
        return "如果你能看到这条消息，说明冷笑话正在赶来的路上。";
    }
}

// --- Chat Service ---

export const createChatSession = (historyContext: string) => {
  return ai.chats.create({
    model: "gemini-3-pro-preview",
    config: {
      systemInstruction: `你是一个温暖、富有同理心的心理健康助手。
      你可以访问用户的近期日记: ${historyContext || "用户暂时没有近期日记"}。
      请用中文回答，保持回答简洁、像朋友一样自然且支持性强。`,
    },
  });
};

// --- Live API Helpers ---

export const getLiveClient = () => ai.live;
