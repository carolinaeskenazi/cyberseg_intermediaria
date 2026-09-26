(() => {

    if (window.__privacyGuardCanvasMonitor) {
        return;
    }

    window.__privacyGuardCanvasMonitor = true;

   function reportCanvasOperation(operation) {

        let stack = null;

        try {
            stack = new Error().stack;
        } catch (error) {
            stack = null;
        }

        window.postMessage({
            source: "privacy-guard",
            type: "canvas-operation",
            operation: operation,
            timestamp: Date.now(),
            stack: stack
        }, "*");
    }

    // ==========================================
    // toDataURL()
    // ==========================================

    const originalToDataURL =
        HTMLCanvasElement.prototype.toDataURL;

    HTMLCanvasElement.prototype.toDataURL =
        function (...args) {

            reportCanvasOperation("toDataURL");

            return originalToDataURL.apply(
                this,
                args
            );
        };


    // ==========================================
    // toBlob()
    // ==========================================

    const originalToBlob =
        HTMLCanvasElement.prototype.toBlob;

    HTMLCanvasElement.prototype.toBlob =
        function (...args) {

            reportCanvasOperation("toBlob");

            return originalToBlob.apply(
                this,
                args
            );
        };


    // ==========================================
    // getImageData()
    // ==========================================

    const originalGetImageData =
        CanvasRenderingContext2D.prototype.getImageData;

    CanvasRenderingContext2D.prototype.getImageData =
        function (...args) {

            reportCanvasOperation("getImageData");

            return originalGetImageData.apply(
                this,
                args
            );
        };

})();