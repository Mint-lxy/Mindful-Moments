
import { GoogleGenAI, Type, FunctionDeclaration, Schema } from "@google/genai";
import { DiaryEntry, AIConfig } from "../types";

// Default instance for system features (Joke, Audio, Default Gemini)
const defaultAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper: DeepSeek API Call ---
const callDeepSeek = async (messages: any[], apiKey: string, jsonMode: boolean = false) => {
    try {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: messages,
                stream: false,
                response_format: jsonMode ? { type: "json_object" } : { type: "text" },
                temperature: 1.3
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`DeepSeek API Error: ${err}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("DeepSeek Call Failed", error);
        throw error;
    }
};

// --- Helper: SiliconFlow API Call ---
const callSiliconFlow = async (messages: any[], apiKey: string, model: string, jsonMode: boolean = false) => {
    try {
        // Default to a popular model if none provided
        const targetModel = model || "deepseek-ai/DeepSeek-V3";
        
        const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: targetModel,
                messages: messages,
                stream: false,
                response_format: jsonMode ? { type: "json_object" } : { type: "text" },
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`SiliconFlow API Error: ${err}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("SiliconFlow Call Failed", error);
        throw error;
    }
};

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

export const analyzeDiaryEntry = async (text: string, attachments: string[] = [], config?: AIConfig): Promise<Partial<DiaryEntry>> => {
  // If attachments exist, force Gemini because 3rd party APIs here are treated as text-only for simplicity
  const hasAttachments = attachments.length > 0;
  
  const provider = config?.provider || 'Gemini';
  const apiKey = config?.apiKey;
  
  // Determine if we should use a 3rd party provider
  const useDeepSeek = provider === 'DeepSeek' && apiKey && !hasAttachments;
  const useSiliconFlow = provider === 'SiliconFlow' && apiKey && !hasAttachments;

  try {
    const systemPrompt = `你是一个专业的心理分析助手。请分析用户的日记。
        请严格按照以下 JSON 格式返回结果：
        {
            "moodScore": number (1-10),
            "tags": string[] (3-5个中文标签),
            "summary": string (一句话中文总结),
            "advice": string (一句温柔的建议)
        }`;

    if (useDeepSeek && apiKey) {
        const content = await callDeepSeek(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ],
            apiKey,
            true // JSON Mode
        );
        return JSON.parse(content);

    } else if (useSiliconFlow && apiKey) {
        const content = await callSiliconFlow(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ],
            apiKey,
            config.model || "deepseek-ai/DeepSeek-V3",
            true // JSON Mode
        );
        return JSON.parse(content);
        
    } else {
        // --- Gemini Path (Default or Fallback for Attachments) ---
        const client = (provider === 'Gemini' && apiKey) 
            ? new GoogleGenAI({ apiKey: apiKey }) 
            : defaultAi;

        const parts: any[] = [];
        
        // Add attachments
        attachments.forEach(att => {
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

        // Add note if we fell back to Gemini due to attachments
        let promptText = `分析这篇日记: "${text}"。`;
        if (hasAttachments && (provider === 'DeepSeek' || provider === 'SiliconFlow')) {
            promptText += " (注意：由于包含图片/视频，已自动切换回 Gemini 进行多模态分析)";
        }

        parts.push({ text: promptText });

        const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: analysisSchema,
            },
        });

        if (response.text) {
            return JSON.parse(response.text);
        }
        throw new Error("No response text from Gemini");
    }
  } catch (error) {
    console.error("Analysis failed", error);
    return {
      moodScore: 5,
      tags: ["分析中断"],
      summary: "暂时无法分析内容。",
      advice: "记录本身就是一种疗愈。",
    };
  }
};

export const transcribeAudio = async (base64Audio: string, mimeType: string, config?: AIConfig): Promise<string> => {
  // Transcription always uses Gemini Flash for native efficiency
  const client = config?.provider === 'Gemini' && config.apiKey 
            ? new GoogleGenAI({ apiKey: config.apiKey }) 
            : defaultAi;
            
  try {
    const response = await client.models.generateContent({
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
    // Joke always uses default system key (Gemini) for stability
    try {
        const response = await defaultAi.models.generateContent({
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

export class MultiProviderChat {
    private provider: 'Gemini' | 'DeepSeek' | 'SiliconFlow';
    private apiKey?: string;
    private customModel?: string;
    private geminiChat: any;
    private chatHistory: any[];
    private systemInstruction: string;

    constructor(context: string, config?: AIConfig) {
        this.provider = config?.provider || 'Gemini';
        this.apiKey = config?.apiKey;
        this.customModel = config?.model;
        
        this.systemInstruction = `你是一个温暖、富有同理心的心理健康助手。
        你可以访问用户的近期日记: ${context || "用户暂时没有近期日记"}。
        请用中文回答，保持回答简洁、像朋友一样自然且支持性强。`;

        if (this.provider === 'Gemini') {
            const client = this.apiKey ? new GoogleGenAI({ apiKey: this.apiKey }) : defaultAi;
            this.geminiChat = client.chats.create({
                model: "gemini-3-pro-preview",
                config: { systemInstruction: this.systemInstruction },
            });
        } else {
            // DeepSeek & SiliconFlow Initialization
            this.chatHistory = [
                { role: "system", content: this.systemInstruction }
            ];
        }
    }

    async sendMessage(message: string): Promise<string> {
        if (this.provider === 'Gemini') {
            const result = await this.geminiChat.sendMessage({ message });
            return result.text;
        } else if (this.provider === 'DeepSeek') {
            this.chatHistory.push({ role: "user", content: message });
            try {
                const responseText = await callDeepSeek(this.chatHistory, this.apiKey!);
                this.chatHistory.push({ role: "assistant", content: responseText });
                return responseText;
            } catch (e) {
                console.error("DeepSeek Chat Error", e);
                return "连接 DeepSeek 时出现问题，请检查 API Key。";
            }
        } else if (this.provider === 'SiliconFlow') {
            this.chatHistory.push({ role: "user", content: message });
            try {
                const responseText = await callSiliconFlow(this.chatHistory, this.apiKey!, this.customModel!);
                this.chatHistory.push({ role: "assistant", content: responseText });
                return responseText;
            } catch (e) {
                console.error("SiliconFlow Chat Error", e);
                return "连接 SiliconFlow 时出现问题，请检查配置。";
            }
        }
        return "配置错误";
    }
}

export const createChatSession = (historyContext: string, config?: AIConfig) => {
    return new MultiProviderChat(historyContext, config);
};

// --- Live API Helpers ---

export const getLiveClient = () => defaultAi.live;
