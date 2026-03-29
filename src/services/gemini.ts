import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getEquipmentRecommendation(heroName: string, traits: string[], enemyContext: string = "") {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    你是一个《云顶之弈/金铲铲之战》的顶级职业选手。
    
    请为英雄【${heroName}】推荐最合适的3件装备。
    该英雄当前的羁绊/属性是：${traits.join(', ')}。
    
    ${enemyContext ? `当前敌方阵容特点是：${enemyContext}。请根据这个情况调整推荐，侧重于如何克制对手。` : "请提供常规的最强神装。"}
    
    请以 JSON 格式返回，包含以下字段：
    - recommendations: 一个包含3个对象的数组，每个对象有 name (装备名称) 和 reason (推荐理由)。
    - strategy: 一段简短的文字，解释整体的出装思路，结合英雄的羁绊属性。
    - counter_tip: 如果提供了敌方背景，请给出一个针对性的克制建议；如果没有，请给出一个通用的进阶技巧。
    
    只返回 JSON，不要有其他文字。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      error: "无法获取推荐，请稍后再试。",
      recommendations: [],
      strategy: "",
      counter_tip: ""
    };
  }
}
