// docs/version.js

(async function() {
    try {
        const scripts = document.getElementsByTagName('script');
        const currentScript = scripts[scripts.length - 1];
        let basePath = '';
        
        if (currentScript && currentScript.src) {
            const scriptUrl = currentScript.src;
            const lastSlash = scriptUrl.lastIndexOf('/');
            if (lastSlash !== -1) {
                basePath = scriptUrl.substring(0, lastSlash + 1);
            }
        }
        
        if (!basePath || !basePath.includes('/docs/')) {
            basePath = window.location.pathname.includes('/docs/') ? './' : '../';
        }
        
        const versionUrl = basePath + 'version.json';
        console.log('Loading version from:', versionUrl);
        
        const response = await fetch(versionUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        document.querySelectorAll('.idyllium-version').forEach(el => {
            if (el.textContent === 'v') {
                el.textContent = `v${data.version}`;
            }
        });
    } catch (error) {
        console.warn('Failed to load version:', error);
        document.querySelectorAll('.idyllium-version').forEach(el => {
            if (el.textContent === 'v') {
                el.textContent = 'v?.?.?';
            }
        });
    }
})();
