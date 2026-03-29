import { GoogleGenAI } from "@google/genai";
import { Guide } from "../firebase";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getEquipmentRecommendation(heroName: string, traits: string[], enemyContext: string = "", guides: Guide[] = []) {
  const model = "gemini-3-flash-preview";
  
  const guidesContext = guides.length > 0 
    ? `\n以下是来自社区/玩家的独家攻略（RAG 检索内容）：\n${guides.map(g => `- ${g.title}: ${g.content}`).join('\n')}\n请参考这些攻略中的思路，结合你的专业分析给出最终建议。`
    : "";

  const prompt = `
    你是一个《云顶之弈/金铲铲之战》的顶级职业选手，对所有赛季（包括当前的 S16 英雄联盟传奇、经典的 S1 时空裂痕、以及回归的 S4.5 瑞兽闹新春）都有极深的理解。
    
    请为英雄【${heroName}】在【${traits.join(' + ')}】羁绊环境下推荐最合适的3件装备。
    注意：该英雄属于【${guides.length > 0 ? guides[0].heroName : heroName}】所在的特定赛季，请根据该赛季的装备数值和机制进行分析。
    
    ${enemyContext ? `当前敌方阵容特点是：${enemyContext}。请根据这个情况调整推荐，侧重于如何克制对手（例如：对付高护甲出轻语，对付高回复出重伤）。` : "请提供该英雄在该赛季环境下的常规最强神装。"}
    
    ${guidesContext}

    请以 JSON 格式返回，包含以下字段：
    - recommendations: 一个包含3个对象的数组，每个对象有 name (装备名称), id (装备ID，如 101, 308 等，用于匹配官方图片) 和 reason (推荐理由，需结合羁绊和赛季机制)。
    - strategy: 一段简短的文字，解释整体的出装思路，以及该英雄在阵容中的定位。
    - counter_tip: 针对当前敌方特点的克制建议，或该英雄的进阶操作技巧。
    
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

export async function analyzeHero(hero: any, season: string) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    你是一个《云顶之弈/金铲铲之战》的顶级职业选手，对所有赛季（包括当前的 S16 英雄联盟传奇、经典的 S1 时空裂痕、以及回归的 S4.5 瑞兽闹新春）都有极深的理解。
    
    请对英雄【${hero.name}】在【${season}】赛季中的表现进行深度分析。
    
    分析内容应包括：
    1. 英雄定位：该英雄在阵容中扮演什么角色（主C、副C、坦克、辅助等）。
    2. 核心优势：为什么在当前赛季中选择他。
    3. 推荐装备：推荐3件最核心的装备，并详细解释每一件装备对该英雄的具体提升（结合技能机制）。
    4. 阵容搭配建议：最适合与哪些羁绊或英雄搭配。
    
    请以 JSON 格式返回，包含以下字段：
    - role: 英雄定位
    - strengths: 核心优势（字符串）
    - recommendations: 一个包含3个对象的数组，每个对象有 name (装备名称), id (装备ID，如 101, 308 等) 和 reason (详细推荐理由)。
    - synergy_tips: 阵容搭配建议（字符串）
    
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
      error: "无法获取分析结果，请稍后再试。",
      role: "",
      strengths: "",
      recommendations: [],
      synergy_tips: ""
    };
  }
}
