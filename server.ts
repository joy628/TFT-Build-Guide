import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. 智能爬虫接口
  app.post("/api/crawl", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      // 获取网页 HTML
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // 提取核心文本 (去除脚本和样式)
      $('script, style, nav, footer').remove();
      const rawText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 10000);

      // 使用 Gemini 提取结构化攻略
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        你是一个《云顶之弈/金铲铲之战》的攻略提取专家。
        
        以下是从网页抓取的原始文本内容：
        ---
        ${rawText}
        ---
        
        请从上述内容中提取出核心攻略信息，并以 JSON 格式返回：
        - title: 攻略标题 (如: S16 暴力安蓓萨出装)
        - heroName: 攻略针对的英雄名称 (如: 安蓓萨)
        - content: 核心出装思路和战术心得 (简明扼要)
        - tags: 关键词数组 (如: ["暴力输出", "后期核心"])
        
        如果文本中没有相关信息，请返回错误。只返回 JSON。
      `;

      const result = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const guideData = JSON.parse(result.text || "{}");
      res.json(guideData);

    } catch (error) {
      console.error("Crawl Error:", error);
      res.status(500).json({ error: "抓取或解析失败，请检查 URL 是否有效。" });
    }
  });

  // 2. Vite 预览中间件 (开发环境)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
