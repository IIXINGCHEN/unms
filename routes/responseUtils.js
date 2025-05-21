// responseUtils.js

// 根据环境决定是否美化 JSON 输出
// 在开发环境中使用美化输出以便于调试
// 在生产环境中使用紧凑格式以减少响应体积
const spaces = process.env.NODE_ENV === 'production' ? null : 2;

/**
 * 设置成功的 API 响应。
 * @param {object} ctx - Koa 上下文对象。
 * @param {*} data - 要在 'data' 字段中返回的负载。
 * @param {string} [message="请求成功"] - 成功消息。
 * @param {number} [statusCode=200] - HTTP 状态码。
 */
function setSuccessResponse(ctx, data, message = "请求成功", statusCode = 200) {
    // 构建完整的响应对象
    const responseObject = {
        code: statusCode,    // 使用 HTTP 状态码作为业务状态码
        message: message,    // 设置成功消息
        data: data           // 设置数据负载
    };
    // 显式设置响应类型为 JSON
    ctx.type = 'json';
    // 设置 HTTP 状态码
    ctx.status = statusCode;
    // 将响应对象字符串化（始终美化）并设置为响应体
    ctx.body = JSON.stringify(responseObject, null, spaces);
}

/**
 * 设置错误的 API 响应。
 * @param {object} ctx - Koa 上下文对象。
 * @param {string} message - 错误消息。
 * @param {number} statusCode - HTTP 状态码。
 * @param {*} [errorData=null] - 要在 'data' 字段中返回的错误详情负载 (例如验证错误详情)。
 */
function setErrorResponse(ctx, message, statusCode, errorData = null) {
    // 构建完整的响应对象
    const responseObject = {
        code: statusCode,    // 使用 HTTP 状态码作为业务状态码
        message: message,    // 设置错误消息
        data: errorData      // 设置错误数据负载 (通常为 null，或包含错误详情的对象)
    };
    // 显式设置响应类型为 JSON
    ctx.type = 'json';
    // 设置 HTTP 状态码
    ctx.status = statusCode;
    // 将响应对象字符串化（始终美化）并设置为响应体
    ctx.body = JSON.stringify(responseObject, null, spaces);
}

// 导出这两个工具函数
module.exports = {
    setSuccessResponse,
    setErrorResponse
};
