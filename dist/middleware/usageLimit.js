"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageLimitMiddleware = void 0;
const TenantService_1 = require("../services/TenantService");
const tenantService = new TenantService_1.TenantService();
const usageLimitMiddleware = async (req, res, next) => {
    var _a;
    try {
        const tenantId = (_a = req.tenant) === null || _a === void 0 ? void 0 : _a.id;
        if (!tenantId) {
            return res.status(401).json({ error: "Tenant not found" });
        }
        const { hasReachedLimit, limits } = await tenantService.checkUsageLimits(tenantId);
        if (hasReachedLimit) {
            await tenantService.logUsage(tenantId, "limit_exceeded", 1, {
                limits,
                endpoint: req.path,
            });
            return res.status(429).json({
                error: "Usage limit exceeded",
                limits,
            });
        }
        next();
    }
    catch (error) {
        console.error("Error checking usage limits:", error);
        next(error);
    }
};
exports.usageLimitMiddleware = usageLimitMiddleware;
