// script.js

// --- Function Definitions ---

// Theme toggling function
const toggleDarkMode = (darkModeMediaQuery) => {
    const themeToggle = document.getElementById('themeToggle');
    if (document.documentElement && themeToggle) { // Check if elements exist
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
            // 请替换为您的 GitHub 项目地址或个人主页
            url = "https://github.com/imsyy/UNM-Server"; // 示例地址
            break;
        case "home":
            // 请替换为您的项目主页或个人主页
            url = "https://www.imsyy.top/"; // 示例地址
            break;
        case "email":
            window.location.href = "mailto:imsyy@foxmail.com"; // 请替换为您的邮箱
            return; // mailto:不需要新窗口
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
    container.innerHTML = `
                <div class="error-message-box">
                    <strong>错误</strong>
                    <p>${message}</p>
                    ${details ? `<p><small>${String(details).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</small></p>` : ''}
                </div>`;
    container.style.display = 'block';
}

// Recursive renderer for JSON objects into DL/DT/DD structure
function renderJsonObject(obj, parentElement) {
    if (!parentElement || typeof obj !== 'object' || obj === null) return; // Added null check for obj

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
                list.style.paddingLeft = '1.5rem';
                list.style.listStyle = 'disc'; // Or 'decimal' for numbered list
                value.forEach((item, index) => {
                    const li = document.createElement('li');
                    // Add a small visual indicator for array index if desired
                    // const indexSpan = document.createElement('span');
                    // indexSpan.textContent = `[${index}]: `;
                    // indexSpan.style.color = 'var(--text-color-gray)';
                    // li.appendChild(indexSpan);

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
        if (typeof unsafe !== 'string') return unsafe; // Only escape strings
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
        return escapeHtml(String(value)); // Fallback for other types
    }
}

// Updated displayResult function using the recursive renderer
function displayResult(container, data) {
    if (!container) return;
    container.innerHTML = ''; 
    const dl = document.createElement('dl');
    dl.className = 'result-dl';
    try {
        // Assuming `data` is the full API response { code, message, data: payload }
        // We want to display the `payload` (which is `data.data`) if the structure is consistent
        // Or display the whole object if it's an error or a different structure
        let dataToRender = data;
        if (data && typeof data.code !== 'undefined' && typeof data.message !== 'undefined') {
             // Render the standard {code, message, data} structure
            renderJsonObject(data, dl);
        } else {
            // Fallback for unexpected structures, render as is
            renderJsonObject(data, dl);
        }
        container.appendChild(dl);
    } catch (e) {
        console.error("Error rendering JSON object:", e);
        displayError(container, "客户端渲染数据时出错", e.message);
    }
    container.style.display = 'block';
}


// Button click function (for a general test button if you add one, e.g., to test /info)
// The original clickFunction was for /test specifically.
// This is an example for how the /info API could be called by a button on the page.
const testInfoApi = () => {
    const resultContainer = document.getElementById('test-result-container');
    if (!resultContainer) {
        console.warn("Result container not found for testInfoApi");
        return;
    }

    displayLoading(resultContainer);

    fetch(window.location.origin + '/info') // Use dynamic origin
        .then(response => {
            // First, check if response is ok, then try to parse JSON
            if (!response.ok) {
                // For non-ok responses, try to get text body for error details
                const statusText = `${response.status} ${response.statusText}`;
                return response.text().then(textData => {
                    // This Promise will reject, triggering the .catch for networkError or similar
                    throw new Error(`HTTP error ${statusText} - ${textData || "No details"}`); 
                });
            }
            return response.json(); // If ok, parse JSON
        })
        .then(data => { // This 'data' is the parsed JSON from a successful response
            displayResult(resultContainer, data); 
        })
        .catch(error => { // Catches network errors and errors thrown from !response.ok
            console.error("API Call Error:", error);
            // Attempt to parse error.message if it looks like our API error format
            // This part is tricky because error.message might not be JSON string.
            let errorDetails = error.message;
            try {
                 // Check if error.message is our structured error (less likely here)
                 // Or if we should just display the message as is.
            } catch (e) { /* ignore parsing error of the error message */ }
            displayError(resultContainer, "API 请求失败", errorDetails);
        });
};

// Create floating particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    const particleCount = 20;
    particlesContainer.innerHTML = ''; // Clear existing

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
    console.log("DOM fully loaded and parsed for API Docs");
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

    // --- Dynamically update domain placeholders in API examples ---
    const currentOrigin = window.location.origin;

    // 1. Update displayed domain text within <span> tags
    // Example HTML: <code><span class="domain-placeholder">[你的域名]</span>/info</code>
    const textDomainPlaceholders = document.querySelectorAll('span.domain-placeholder');
    textDomainPlaceholders.forEach(span => {
        if (span.textContent.trim() === '[你的域名]') {
            span.textContent = currentOrigin;
            // Optional: Adjust styling if the placeholder class was for more than just selection
            span.style.color = 'inherit'; // Or a specific color for the domain part
            span.style.fontStyle = 'normal';
        }
    });

    // 2. Update href attributes of API example links
    // Example HTML: <a class="api-example-link" href="[你的域名]/info" target="_blank">...</a>
    const apiExampleLinks = document.querySelectorAll('a.api-example-link');
    apiExampleLinks.forEach(link => {
        let href = link.getAttribute('href');
        if (href && href.includes('[你的域名]')) {
            link.setAttribute('href', href.replace(/\[你的域名\]/g, currentOrigin));
        }
    });
    // --- End of dynamic domain update ---

    // If there's a button on the main page to test an API (e.g., /info or /test)
    // Example: Give a button an ID "testApiButton" in your main HTML (not docs)
    // const mainPageTestButton = document.getElementById('testApiButton');
    // if (mainPageTestButton) {
    //     mainPageTestButton.addEventListener('click', testInfoApi); // or your original clickFunction for /test
    // }
    
    // Update GitHub link dynamically if needed (example)
    const githubLink = document.getElementById('viewOnGithub');
    if (githubLink && githubLink.href.includes("your-repo")) { // Check for placeholder
        githubLink.href = "https://github.com/imsyy/UNM-Server-AXC"; // Replace with actual repo
    }

});
