// cookieInterceptors.js
(() => {
    const CustomEvt = CustomEvent;

    document.__defineSetter__("cookie", (cookieVal) => {
        const evt = new CustomEvt("7", { detail: cookieVal });
        document.dispatchEvent(evt);
    });

    document.__defineGetter__("cookie", () => {
        const evt = new CustomEvt("8");
        document.dispatchEvent(evt);
        let storedCookies;
        try {
            storedCookies = localStorage.getItem("@@@cookies");
            localStorage.removeItem("@@@cookies");
        } catch (ex) {
            const div = document.getElementById("@@@cookies");
            storedCookies = div ? div.innerText : "";
        }
        return storedCookies;
    });
})();
