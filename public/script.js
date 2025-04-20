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
    switch (type) {
        case "github":
            window.open("https://github.com/imsyy", "_blank");
            break;
        case "home":
            window.open("https://www.imsyy.top/", "_blank");
            break;
        case "email":
            window.location.href = "mailto:noreply@imsyy.top";
            break;
        default:
            break;
    }
};

// Helper: Display Loading state
function displayLoading(container) {
    if (!container) return;
    container.innerHTML = `
                <div class="loading-indicator">
                    <i class="fa-solid fa-spinner fa-spin"></i> <!-- Added fa-spin -->
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
                    ${details ? `<p><small>${details}</small></p>` : ''}
                </div>`;
    container.style.display = 'block';
}

// Recursive renderer for JSON objects into DL/DT/DD structure
function renderJsonObject(obj, parentElement) {
    if (!parentElement) return;
    for (const key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) {
            const value = obj[key];

            const dt = document.createElement('dt');
            dt.className = 'result-dt';
            dt.textContent = key;

            const dd = document.createElement('dd');
            dd.className = 'result-dd';

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) { // Handle objects, not arrays here
                const nestedDl = document.createElement('dl');
                nestedDl.className = 'result-dl nested';
                renderJsonObject(value, nestedDl); // Recursive call
                dd.appendChild(nestedDl);
            } else if (Array.isArray(value)) { // Handle arrays
                // Simple array rendering for now, could be enhanced
                const list = document.createElement('ul');
                list.style.paddingLeft = '1.5rem'; // Indent array items
                list.style.listStyle = 'disc';
                value.forEach(item => {
                    const li = document.createElement('li');
                    if (typeof item === 'object' && item !== null) {
                        const nestedDl = document.createElement('dl');
                        nestedDl.className = 'result-dl nested';
                        renderJsonObject(item, nestedDl); // Recursive call for objects in array
                        li.appendChild(nestedDl);
                    } else {
                        li.innerHTML = formatJsonValue(item); // Format primitive values
                    }
                    list.appendChild(li);
                });
                dd.appendChild(list);

            } else {
                dd.innerHTML = formatJsonValue(value); // Format primitive values directly
            }

            parentElement.appendChild(dt);
            parentElement.appendChild(dd);
        }
    }
}

// Helper to format primitive JSON values with appropriate class
function formatJsonValue(value) {
    if (typeof value === 'string') {
        // Escape HTML in string values to prevent XSS
        const escapedValue = value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<span class="json-string">"${escapedValue}"</span>`;
    } else if (typeof value === 'number') {
        return `<span class="json-number">${value}</span>`;
    } else if (typeof value === 'boolean') {
        return `<span class="json-boolean">${value}</span>`;
    } else if (value === null) {
        return `<span class="json-null">null</span>`;
    } else {
        // Escape other potential values as well
        const escapedValue = String(value).replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return escapedValue;
    }
}


// Updated displayResult function using the recursive renderer
function displayResult(container, data) {
    if (!container) return;
    container.innerHTML = ''; // Clear previous content
    const dl = document.createElement('dl');
    dl.className = 'result-dl';
    try {
        renderJsonObject(data, dl); // Render the data into the dl
        container.appendChild(dl); // Append the populated dl
    } catch (e) {
        console.error("Error rendering JSON object:", e);
        displayError(container, "客户端渲染数据时出错");
    }
    container.style.display = 'block';
}

// Button click function (for index.html test button)
const clickFunction = () => {
    const resultContainer = document.getElementById('test-result-container');
    if (!resultContainer) {
        console.warn("Result container not found for clickFunction");
        return;
    }

    displayLoading(resultContainer);

    fetch('/test') // Make the API call
        .then(response => {
            if (response.ok) {
                // Try to parse as JSON
                return response.json()
                    .then(data => {
                        displayResult(resultContainer, data); // Use updated displayResult
                    })
                    .catch(jsonError => {
                        console.error("JSON Parsing Error:", jsonError);
                        // If JSON parsing fails but status was ok, show specific error
                        return response.text().then(textData => {
                            displayError(resultContainer, `服务器响应成功，但无法解析为JSON`, `响应内容: ${textData.substring(0, 100)}...`);
                        });
                    });
            } else {
                // Handle HTTP errors (like 404, 500)
                const statusText = `${response.status} ${response.statusText}`;
                return response.text().then(textData => { // Try to get error details from body
                    try {
                        // Attempt to parse error body as JSON for better display
                        const errorJson = JSON.parse(textData);
                        displayResult(resultContainer, { error: statusText, details: errorJson });
                    } catch (e) {
                        // If error body is not JSON, display as text
                        displayError(resultContainer, `请求失败: ${statusText}`, textData || "无详细错误信息");
                    }
                });
            }
        })
        .catch(networkError => {
            // Handle fetch/network errors
            console.error("Fetch Network Error:", networkError);
            displayError(resultContainer, "网络请求错误", networkError.message);
        });
};

// Create floating particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return; // Check if element exists
    const particleCount = 20;

    // Clear existing particles if any (e.g., during development hot-reloads)
    particlesContainer.innerHTML = '';

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        // Random size between 2px and 8px
        const size = Math.random() * 6 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        // Random position
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.bottom = `-${size}px`; // Start below the viewport

        // Random animation duration between 10s and 20s
        const duration = Math.random() * 10 + 10;
        particle.style.animationDuration = `${duration}s`;

        // Random delay
        particle.style.animationDelay = `${Math.random() * 10}s`;

        particlesContainer.appendChild(particle);
    }
}


// --- Initialization Logic ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed"); // Debug log
    const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const themeToggle = document.getElementById('themeToggle');

    // Set initial theme state
    toggleDarkMode(darkModeMediaQuery);

    // Add listener for changes in color scheme preference
    if (darkModeMediaQuery.addEventListener) {
        darkModeMediaQuery.addEventListener('change', () => toggleDarkMode(darkModeMediaQuery));
    } else if (darkModeMediaQuery.addListener) { // Fallback for older browsers
        darkModeMediaQuery.addListener(() => toggleDarkMode(darkModeMediaQuery));
    }

    // Theme toggle button click handler
    if (themeToggle) { // Check if toggle button exists
        themeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark-mode');
            // Update icon based on the new state
            if (document.documentElement.classList.contains('dark-mode')) {
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            }
        });
    } else {
        console.warn("Theme toggle button not found");
    }

    // Create floating particles
    createParticles();

    // --- Dynamically update domain placeholders in API examples ---
    const currentOrigin = window.location.origin;
    // Select placeholders within the api-docs-section or main content if needed
    const domainPlaceholders = document.querySelectorAll('.api-endpoint pre code .placeholder, main pre code .placeholder'); // Adjusted selector slightly if needed elsewhere

    if (domainPlaceholders.length > 0) {
        domainPlaceholders.forEach(placeholder => {
            if (placeholder.textContent === '[你的域名]') {
                placeholder.textContent = currentOrigin;
                // Reset styling to match normal code
                placeholder.style.color = 'inherit';
                placeholder.style.fontStyle = 'normal';
                // Optionally remove the class if it's no longer needed for selection
                // placeholder.classList.remove('placeholder');
            }
        });
    } else {
        // Only log this if we expect placeholders (e.g., on api-docs page)
        if (document.querySelector('.api-docs-section')) {
            console.warn("No domain placeholders found to update.");
        }
    }
    // --- End of dynamic domain update ---

});
