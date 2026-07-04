const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const provider = process.env.AI_PROVIDER || 'groq';

async function generateServerStructure(promptText) {
    const systemPrompt = `User ke instructions ko structured JSON mein convert karo — roles (name, color, permissions list) aur channels (name, type: text/voice, category) ke arrays ke sath. Sirf JSON return karo, kuch aur nahi. Return the response strictly as valid JSON without markdown formatting like \`\`\`json. The structure should exactly match:
{
  "roles": [
    { "name": "Role Name", "color": "#FF0000", "permissions": ["Administrator"] }
  ],
  "categories": [
    {
      "name": "Category Name",
      "channels": [
        { "name": "channel-name", "type": "text" },
        { "name": "Voice Channel", "type": "voice" }
      ]
    }
  ]
}`;

    try {
        let jsonString = '';

        if (provider === 'groq') {
            const groqOpenai = new OpenAI({ 
                baseURL: "https://api.groq.com/openai/v1",
                apiKey: process.env.GROQ_API_KEY,
                timeout: 30000,
                maxRetries: 2
            });
            const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

            try {
                console.log(`Trying Groq...`);
                const response = await groqOpenai.chat.completions.create({
                    model: groqModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: promptText }
                    ],
                    temperature: 0.1,
                    stream: false,
                });
                
                const content = response.choices[0].message.content;
                if (!content.match(/\{[\s\S]*\}/)) {
                    throw new Error(`Invalid format from Groq`);
                }
                jsonString = content;
            } catch (groqErr) {
                console.log(`Groq failed: ${groqErr.message}, trying OpenRouter backup...`);
                
                const openRouterOpenai = new OpenAI({ 
                    baseURL: "https://openrouter.ai/api/v1",
                    apiKey: process.env.OPENROUTER_API_KEY,
                    timeout: 30000,
                    maxRetries: 2
                });
                const orModel = process.env.OPENROUTER_MODEL || "google/gemma-3-27b-it:free";
                
                try {
                    const response = await openRouterOpenai.chat.completions.create({
                        model: orModel,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: promptText }
                        ],
                        temperature: 0.1,
                        stream: false,
                    });
                    
                    const content = response.choices[0].message.content;
                    if (!content.match(/\{[\s\S]*\}/)) {
                        throw new Error(`Invalid format from OpenRouter`);
                    }
                    console.log(`OpenRouter succeeded`);
                    jsonString = content;
                } catch (orErr) {
                    console.log(`Both failed. OpenRouter error: ${orErr.message}`);
                    throw new Error("AI service unavailable right now, please try again in a moment");
                }
            }
        } else {
            throw new Error('Invalid AI_PROVIDER in .env. Please set it to groq.');
        }

        console.log('Raw AI Response:', jsonString);

        // Extract JSON portion between { and }
        const match = jsonString.match(/\{[\s\S]*\}/);
        if (!match) {
            throw new Error('AI response format issue, try again');
        }
        
        const cleanedJson = match[0];
        
        try {
            return JSON.parse(cleanedJson);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            throw new Error('AI response format issue, try again');
        }

    } catch (error) {
        console.error('AI Generation Error:', error);
        if (error.message === 'AI response format issue, try again' || error.message === 'API key invalid — .env check karo') {
            throw error;
        }
        throw new Error('AI could not generate a valid structure. Please try again.');
    }
}

async function generateServerModification(currentStructure, promptText) {
    const systemPrompt = `Aapko ek current Discord server ka JSON structure diya gaya hai aur user ke kuch instructions diye gaye hain.
Aapka kaam ye hai ki user ki requirement puri karne ke liye JO NAYE ROLES YA CHANNELS ADD KARNE HAIN, SIRF WOHI RETURN KAREIN.
Purane roles ya channels jo already exist karte hain, unhe output mein mat include karein jab tak ki unhe change na karna ho (currently hum sirf add support kar rahe hain).
Return the response strictly as valid JSON without markdown formatting. The structure should exactly match:
{
  "roles": [
    { "name": "New Role Name", "color": "#FF0000", "permissions": ["Administrator"] }
  ],
  "categories": [
    {
      "name": "New Category Name (or existing category name to add channels to)",
      "channels": [
        { "name": "new-channel-name", "type": "text" }
      ]
    }
  ]
}

CURRENT SERVER STRUCTURE:
${JSON.stringify(currentStructure, null, 2)}`;

    try {
        let jsonString = '';

        if (provider === 'groq') {
            const groqOpenai = new OpenAI({ 
                baseURL: "https://api.groq.com/openai/v1",
                apiKey: process.env.GROQ_API_KEY,
                timeout: 30000,
                maxRetries: 2
            });
            const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

            try {
                console.log(`Trying Groq for modification...`);
                const response = await groqOpenai.chat.completions.create({
                    model: groqModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: promptText }
                    ],
                    temperature: 0.1,
                    stream: false,
                });
                
                const content = response.choices[0].message.content;
                if (!content.match(/\{[\s\S]*\}/)) {
                    throw new Error(`Invalid format from Groq`);
                }
                jsonString = content;
            } catch (groqErr) {
                console.log(`Groq failed: ${groqErr.message}, trying OpenRouter backup...`);
                
                const openRouterOpenai = new OpenAI({ 
                    baseURL: "https://openrouter.ai/api/v1",
                    apiKey: process.env.OPENROUTER_API_KEY,
                    timeout: 30000,
                    maxRetries: 2
                });
                const orModel = process.env.OPENROUTER_MODEL || "google/gemma-3-27b-it:free";
                
                try {
                    const response = await openRouterOpenai.chat.completions.create({
                        model: orModel,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: promptText }
                        ],
                        temperature: 0.1,
                        stream: false,
                    });
                    
                    const content = response.choices[0].message.content;
                    if (!content.match(/\{[\s\S]*\}/)) {
                        throw new Error(`Invalid format from OpenRouter`);
                    }
                    console.log(`OpenRouter succeeded`);
                    jsonString = content;
                } catch (orErr) {
                    throw new Error("AI service unavailable right now, please try again in a moment");
                }
            }
        } else {
            throw new Error('Invalid AI_PROVIDER in .env. Please set it to groq.');
        }

        console.log('Raw AI Response:', jsonString);

        const match = jsonString.match(/\{[\s\S]*\}/);
        if (!match) {
            throw new Error('AI response format issue, try again');
        }
        
        const cleanedJson = match[0];
        return JSON.parse(cleanedJson);

    } catch (error) {
        console.error('AI Modification Generation Error:', error);
        throw new Error('AI could not generate a valid modification structure. Please try again.');
    }
}

module.exports = { generateServerStructure, generateServerModification };
