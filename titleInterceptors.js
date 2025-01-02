// titleInterceptors.js
(() => {
    const CustomEvt = CustomEvent;
    let originalTitle = document.title;

    document.__defineSetter__("title", (val) => {
        originalTitle = val;
        const evt = new CustomEvt("9", { detail: val });
        document.dispatchEvent(evt);
    });

    document.__defineGetter__("title", () => originalTitle);
})();
