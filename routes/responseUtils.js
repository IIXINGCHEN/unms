// responseUtils.js

// 2. 定义缩进空格数，根据 NODE_ENV 环境变量决定
// 在生产环境中，不使用缩进 (spaces = 0) 以减小响应体积
// 在其他环境 (如开发环境)，使用 2 个空格进行缩进以方便阅读
const spaces = process.env.NODE_ENV === 'production' ? 0 : 2;

/**
 * 设置成功的 API 响应。
 * @param {object} ctx - Koa 上下文对象。
 * @param {*} data - 要在 'data' 字段中返回的负载。
 * @param {string} [message="请求成功"] - 成功消息。
 * @param {number} [statusCode=200] - HTTP 状态码。
 */
function setSuccessResponse(ctx, data, message = "请求成功", statusCode = 200) {
    // 3.a. 构建完整的响应对象
    const responseObject = {
        code: statusCode,    // 使用 HTTP 状态码作为业务状态码
        message: message,    // 设置成功消息
        data: data           // 设置数据负载
    };
    // 3.b. 显式设置响应类型为 JSON
    ctx.type = 'json';
    // 3.c. 设置 HTTP 状态码
    ctx.status = statusCode;
    // 3.d. 将响应对象字符串化（根据环境美化或压缩）并设置为响应体
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
    // 4.a. 构建完整的响应对象
    const responseObject = {
        code: statusCode,    // 使用 HTTP 状态码作为业务状态码
        message: message,    // 设置错误消息
        data: errorData      // 设置错误数据负载 (通常为 null，或包含错误详情的对象)
    };
    // 4.b. 显式设置响应类型为 JSON
    ctx.type = 'json';
    // 4.c. 设置 HTTP 状态码
    ctx.status = statusCode;
    // 4.d. 将响应对象字符串化（根据环境美化或压缩）并设置为响应体
    ctx.body = JSON.stringify(responseObject, null, spaces);
}

// 导出这两个工具函数
module.exports = {
    setSuccessResponse,
    setErrorResponse
};
