(() => {

    // ==========================================
    // ENVIO DE EVENTOS DE CANVAS
    // ==========================================

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
    // CANVAS — toDataURL()
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
    // CANVAS — toBlob()
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
    // CANVAS — getImageData()
    // ==========================================

    const originalGetImageData =
        CanvasRenderingContext2D.prototype.getImageData;

    CanvasRenderingContext2D.prototype.getImageData =
        function (...args) {

            reportCanvasOperation(
                "getImageData"
            );

            return originalGetImageData.apply(
                this,
                args
            );
        };


    // ==========================================
    // WEBSOCKET / INDICADOR DE HOOK
    // ==========================================

    const OriginalWebSocket =
        window.WebSocket;


    window.WebSocket =
        function (...args) {

            const url =
                args[0];

            let stack = null;

            try {
                stack =
                    new Error().stack;
            } catch (error) {
                stack = null;
            }


            window.postMessage({
                source: "privacy-guard",
                type: "websocket-operation",
                url: String(url),
                timestamp: Date.now(),
                stack: stack
            }, "*");


            return new OriginalWebSocket(
                ...args
            );
        };


    /*
     * Mantém propriedades importantes da
     * implementação original de WebSocket.
     */

    window.WebSocket.prototype =
        OriginalWebSocket.prototype;

    window.WebSocket.CONNECTING =
        OriginalWebSocket.CONNECTING;

    window.WebSocket.OPEN =
        OriginalWebSocket.OPEN;

    window.WebSocket.CLOSING =
        OriginalWebSocket.CLOSING;

    window.WebSocket.CLOSED =
        OriginalWebSocket.CLOSED;

})();