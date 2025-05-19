// responseUtils.js

/**
 * 设置成功的 API 响应。
 * @param {object} ctx - Koa 上下文对象。
 * @param {*} data - 要在 'data' 字段中返回的负载。
 * @param {string} [message="请求成功"] - 成功消息。
 * @param {number} [statusCode=200] - HTTP 状态码。
 */
function setSuccessResponse(ctx, data, message = "请求成功", statusCode = 200) {
    ctx.status = statusCode;
    ctx.body = {
        code: statusCode, // 使用 HTTP 状态码作为业务状态码
        message: message,
        data: data
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
    ctx.status = statusCode;
    ctx.body = {
        code: statusCode, // 使用 HTTP 状态码作为业务状态码
        message: message,
        data: errorData // 对于一般错误，这里是 null；对于验证错误，可以是包含详情的对象
    };
}

module.exports = {
    setSuccessResponse,
    setErrorResponse
};
