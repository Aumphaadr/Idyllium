// docs/version.js

(async function() {
    try {
        const scripts = document.getElementsByTagName('script');
        const currentScript = scripts[scripts.length - 1];
        const scriptUrl = currentScript.src;
        
        const scriptDir = scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);

        const versionUrl = scriptDir + 'version.json';
        
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
