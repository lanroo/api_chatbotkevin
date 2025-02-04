"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routes = void 0;
const express_1 = require("express");
const tenants_routes_1 = __importDefault(require("./tenants.routes"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const chat_routes_1 = __importDefault(require("./chat.routes"));
const analytics_routes_1 = __importDefault(require("./analytics.routes"));
const routes = (0, express_1.Router)();
exports.routes = routes;
routes.use("/tenants", tenants_routes_1.default);
routes.use("/auth", auth_routes_1.default);
routes.use("/chat", chat_routes_1.default);
routes.use("/analytics", analytics_routes_1.default);
