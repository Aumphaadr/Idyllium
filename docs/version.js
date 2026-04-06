// docs/version.js

(async function() {
    try {
        const scripts = document.getElementsByTagName('script');
        const currentScript = scripts[scripts.length - 1];
        const scriptPath = currentScript.src.substring(0, currentScript.src.lastIndexOf('/'));
        
        const versionJsonPath = scriptPath + '/version.json';
        
        const response = await fetch(versionJsonPath);
        const data = await response.json();
        const versionSpan = document.querySelector('.idyllium-version');
        if (versionSpan && versionSpan.textContent === 'v') {
            versionSpan.textContent = `v${data.version}`;
        }
    } catch (error) {
        console.warn('Failed to load version:', error);
        const versionSpan = document.querySelector('.idyllium-version');
        if (versionSpan && versionSpan.textContent === 'v') {
            versionSpan.textContent = 'v?.?.?';
        }
    }
})();