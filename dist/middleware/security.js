"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLimiter = exports.apiLimiter = exports.authLimiter = exports.requireHttps = exports.createRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => (0, express_rate_limit_1.default)({
    windowMs,
    max,
    message: {
        error: "Muitas requisições deste IP, por favor tente novamente mais tarde",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.createRateLimiter = createRateLimiter;
const requireHttps = (req, res, next) => {
    if (!req.secure &&
        req.get("x-forwarded-proto") !== "https" &&
        process.env.NODE_ENV === "production") {
        return res.redirect(`https://${req.get("host")}${req.url}`);
    }
    next();
};
exports.requireHttps = requireHttps;
exports.authLimiter = (0, exports.createRateLimiter)(15 * 60 * 1000, 5);
exports.apiLimiter = (0, exports.createRateLimiter)(60 * 1000, 30);
exports.defaultLimiter = (0, exports.createRateLimiter)();
