"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.rateLimiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || "900000"),
    max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
    message: { error: "Too many requests, please try again later" },
    keyGenerator: (req) => {
        var _a;
        return ((_a = req.tenant) === null || _a === void 0 ? void 0 : _a.id) || req.ip;
    },
});
