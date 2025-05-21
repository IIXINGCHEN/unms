// script.js

// --- Function Definitions ---

// Theme toggling function
const toggleDarkMode = (darkModeMediaQuery) => {
    const themeToggle = document.getElementById('themeToggle');
    if (document.documentElement && themeToggle) {
        if (darkModeMediaQuery.matches) {
            document.documentElement.classList.add("dark-mode");
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.documentElement.classList.remove("dark-mode");
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }
};

// Social link function
const socialJump = (type) => {
    let url = '';
    switch (type) {
        case "github":
            url = "https://github.com/imsyy/UNM-Server-AXC"; // 请替换为您的实际仓库地址
            break;
        case "home":
            url = "https://www.imsyy.top/"; // 请替换为您的主页
            break;
        case "email":
            window.location.href = "mailto:imsyy@foxmail.com"; // 请替换为您的邮箱
            return;
        default:
            return;
    }
    if (url) {
        window.open(url, "_blank");
    }
};

// Helper: Display Loading state
function displayLoading(container) {
    if (!container) return;
    container.innerHTML = `
                <div class="loading-indicator">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>正在请求...</span>
                </div>`;
    container.style.display = 'block';
}

// Helper: Display error message
function displayError(container, message, details = '') {
    if (!container) return;
    const safeMessage = String(message).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeDetails = typeof details === 'string' ? details.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
    container.innerHTML = `
                <div class="error-message-box">
                    <strong>错误</strong>
                    <p>${safeMessage}</p>
                    ${details ? `<p><small>${safeDetails}</small></p>` : ''}
                </div>`;
    container.style.display = 'block';
}

// Recursive renderer for JSON objects into DL/DT/DD structure
function renderJsonObject(obj, parentElement) {
    if (!parentElement || typeof obj !== 'object' || obj === null) return;

    for (const key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) {
            const value = obj[key];

            const dt = document.createElement('dt');
            dt.className = 'result-dt';
            dt.textContent = key;

            const dd = document.createElement('dd');
            dd.className = 'result-dd';

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                const nestedDl = document.createElement('dl');
                nestedDl.className = 'result-dl nested';
                renderJsonObject(value, nestedDl);
                dd.appendChild(nestedDl);
            } else if (Array.isArray(value)) {
                const list = document.createElement('ul');
                value.forEach((item) => {
                    const li = document.createElement('li');
                    if (typeof item === 'object' && item !== null) {
                        const nestedDl = document.createElement('dl');
                        nestedDl.className = 'result-dl nested';
                        renderJsonObject(item, nestedDl);
                        li.appendChild(nestedDl);
                    } else {
                        li.innerHTML = formatJsonValue(item);
                    }
                    list.appendChild(li);
                });
                dd.appendChild(list);
            } else {
                dd.innerHTML = formatJsonValue(value);
            }

            parentElement.appendChild(dt);
            parentElement.appendChild(dd);
        }
    }
}

// Helper to format primitive JSON values with appropriate class
function formatJsonValue(value) {
    const escapeHtml = (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    if (typeof value === 'string') {
        return `<span class="json-string">"${escapeHtml(value)}"</span>`;
    } else if (typeof value === 'number') {
        return `<span class="json-number">${value}</span>`;
    } else if (typeof value === 'boolean') {
        return `<span class="json-boolean">${value}</span>`;
    } else if (value === null) {
        return `<span class="json-null">null</span>`;
    } else {
        return escapeHtml(String(value));
    }
}

// Updated displayResult function using the recursive renderer
function displayResult(container, apiResponse) {
    if (!container) return;
    container.innerHTML = '';
    const dl = document.createElement('dl');
    dl.className = 'result-dl';
    try {
        if (apiResponse && typeof apiResponse.code !== 'undefined' && typeof apiResponse.message !== 'undefined') {
            renderJsonObject(apiResponse, dl);
        } else {
            console.warn("Displaying result with non-standard structure:", apiResponse);
            renderJsonObject(apiResponse, dl);
        }
        container.appendChild(dl);
    } catch (e) {
        console.error("Error rendering JSON object:", e);
        displayError(container, "客户端渲染数据时出错", e.message);
    }
    container.style.display = 'block';
}

// Test button click function for index.html
// Эта функция должна быть в глобальной области видимости, чтобы ее можно было вызвать из onclick
const clickFunction = () => {
    const resultContainer = document.getElementById('test-result-container');
    if (!resultContainer) {
        console.warn("Result container 'test-result-container' not found for clickFunction.");
        alert("错误：无法找到用于显示结果的容器。"); // User-facing alert
        return;
    }

    displayLoading(resultContainer);

    // API /test 接口是 GET 请求，不需要 body
    fetch('/test') // 假设 index.html 和 API 服务在同一域名下，所以相对路径 '/test' 可用
        .then(response => {
            // 尝试将所有响应都解析为JSON，因为我们的API应该始终返回JSON
            return response.json().then(data => {
                if (response.ok) {
                    // HTTP 状态码为 2xx
                    // data 此时应该是 { code, message, data: payload }
                    displayResult(resultContainer, data);
                } else {
                    // HTTP 状态码不是 2xx，但仍然是JSON格式的错误信息
                    // data 此时应该是 { code, message, data: errorDetails }
                    const errorMessage = data.message || `请求失败 (状态码: ${response.status})`;
                    const errorDetailsString = data.data ? JSON.stringify(data.data) : null;
                    displayError(resultContainer, errorMessage, errorDetailsString);
                }
            }).catch(jsonError => {
                // 如果 response.json() 解析失败 (例如响应体不是有效的JSON)
                console.error("JSON Parsing Error or Non-JSON response:", jsonError, response);
                // 尝试读取原始文本响应以提供更多上下文
                return response.text().then(textData => {
                    displayError(resultContainer,
                        `服务器响应格式错误 (状态码: ${response.status})`,
                        `未能解析JSON。原始响应 (部分): ${textData.substring(0, 200)}...`);
                });
            });
        })
        .catch(networkError => {
            // 网络错误或其他 fetch 本身的错误
            console.error("Fetch Network Error:", networkError);
            displayError(resultContainer, "网络请求错误", networkError.message);
        });
};


// Create floating particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    const particleCount = 20;
    particlesContainer.innerHTML = '';

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 6 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.bottom = `-${size}px`;
        const duration = Math.random() * 10 + 10;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${Math.random() * 10}s`;
        particlesContainer.appendChild(particle);
    }
}


// --- Initialization Logic ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed."); // 统一日志消息
    const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const themeToggle = document.getElementById('themeToggle');

    toggleDarkMode(darkModeMediaQuery);

    if (darkModeMediaQuery.addEventListener) {
        darkModeMediaQuery.addEventListener('change', () => toggleDarkMode(darkModeMediaQuery));
    } else if (darkModeMediaQuery.addListener) {
        darkModeMediaQuery.addListener(() => toggleDarkMode(darkModeMediaQuery));
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark-mode');
            if (document.documentElement.classList.contains('dark-mode')) {
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            }
        });
    } else {
        console.warn("Theme toggle button not found");
    }

    createParticles();

    // --- Dynamically update domain placeholders in API examples (for api-docs.html) ---
    // This part is more relevant for api-docs.html. If index.html doesn't have these placeholders, it's fine.
    const currentOrigin = window.location.origin;

    const textDomainPlaceholders = document.querySelectorAll('span.domain-placeholder');
    textDomainPlaceholders.forEach(span => {
        if (span.textContent.trim() === '[你的域名]') {
            span.textContent = currentOrigin;
            span.style.color = 'inherit';
            span.style.fontStyle = 'normal';
        }
    });

    const apiExampleLinks = document.querySelectorAll('a.api-example-link');
    apiExampleLinks.forEach(link => {
        let href = link.getAttribute('href');
        if (href && href.startsWith('[你的域名]')) {
            link.setAttribute('href', href.replace('[你的域名]', currentOrigin));
        }
    });
    // --- End of dynamic domain update ---

    const githubLinkMain = document.getElementById('viewOnGithub'); // Assuming main.html also might have this
    if (githubLinkMain && githubLinkMain.href.includes("your-repo/unm-server")) {
        githubLinkMain.href = "https://github.com/imsyy/UNM-Server-AXC";
    }

    // 添加事件监听器，替代内联事件处理器
    const testApiButton = document.getElementById('test-api-button');
    if (testApiButton) {
        testApiButton.addEventListener('click', clickFunction);
    }

    const apiDocsButton = document.getElementById('api-docs-button');
    if (apiDocsButton) {
        apiDocsButton.addEventListener('click', () => {
            window.location.href = '/api-docs.html';
        });
    }

    // 添加社交媒体图标的事件监听器
    const socialGithub = document.getElementById('social-github');
    const socialHome = document.getElementById('social-home');
    const socialEmail = document.getElementById('social-email');

    if (socialGithub) {
        socialGithub.addEventListener('click', () => socialJump('github'));
    }
    if (socialHome) {
        socialHome.addEventListener('click', () => socialJump('home'));
    }
    if (socialEmail) {
        socialEmail.addEventListener('click', () => socialJump('email'));
    }
});
