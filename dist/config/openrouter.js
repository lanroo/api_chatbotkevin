"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openRouter = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = "https://openrouter.ai/api/v1";
exports.openRouter = {
    async generateResponse(message) {
        try {
            const response = await fetch(`${BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "google/gemini-pro",
                    messages: [{ role: "user", content: message }],
                }),
            });
            const data = await response.json();
            return data.choices[0].message.content;
        }
        catch (error) {
            console.error("OpenRouter Error:", error);
            throw error;
        }
    },
};
