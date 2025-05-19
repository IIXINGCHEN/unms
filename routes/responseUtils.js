// responseUtils.js

/**
 * 设置成功的 API 响应。
 * @param {object} ctx - Koa 上下文对象。
 * @param {*} data - 要在 'data' 字段中返回的负载。
 * @param {string} [message="请求成功"] - 成功消息。
 * @param {number} [statusCode=200] - HTTP 状态码。
 */
function setSuccessResponse(ctx, data, message = "请求成功", statusCode = 200) {
    ctx.status = statusCode; // 设置 HTTP 状态码
    ctx.body = {
        code: statusCode,    // 使用 HTTP 状态码作为业务状态码
        message: message,    // 设置成功消息
        data: data           // 设置数据负载
    };
}

/**
 * 设置错误的 API 响应。
 * @param {object} ctx - Koa 上下文对象。
 * @param {string} message - 错误消息。
 * @param {number} statusCode - HTTP 状态码。
 * @param {*} [errorData=null] - 要在 'data' 字段中返回的错误详情负载 (例如验证错误详情)。
 */
function setErrorResponse(ctx, message, statusCode, errorData = null) {
    ctx.status = statusCode; // 设置 HTTP 状态码
    ctx.body = {
        code: statusCode,    // 使用 HTTP 状态码作为业务状态码
        message: message,    // 设置错误消息
        data: errorData      // 设置错误数据负载 (通常为 null，或包含错误详情的对象)
    };
}

// 导出这两个工具函数
module.exports = {
    setSuccessResponse,
    setErrorResponse
};
