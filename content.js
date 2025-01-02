// content.js
let globalRequest;
const HEADER_NAME = 6;
let port;
let currentProfile = null;
let profilePrefix;
const WIKIPEDIA_CHECK_IMAGE = "//wikipedia.org/static/images/project-logos/enwiki.png";

try {
  port = chrome.runtime.connect({ name: "3" });
  port.onMessage.addListener(msg => {
    if (msg.type === 4) {
      if (typeof msg.profile === "undefined") {
        window.location.reload();
      }
      setProfile(msg.profile);
    }
  });
  port.postMessage({ type: "3" });
  port.onDisconnect.addListener(() => {
    // No-op
  });
} catch (err) {
  // If port is not available
}
if (!port) {
  throw new Error("Port not found");
}

function getCurrentTime() {
  return new Date().getTime();
}

const HASH_KEY = "a8";

// Instead of injecting inline scripts, use chrome.scripting from background.js or content scripts
chrome.runtime.sendMessage({ type: "injectCookieInterceptors" });

// If you need to do it from this script, do:
function injectCookieInterceptors() {
  chrome.scripting.executeScript({
    target: { allFrames: true },
    files: ["cookieInterceptors.js"]
  });
}

// If needed, similarly for titleInterceptors
function enableTitleInterception() {
  chrome.scripting.executeScript({
    target: { allFrames: true },
    files: ["titleInterceptors.js"]
  });
}

function setProfile(profile) {
  if (profile !== null) {
    currentProfile = profile;
    profilePrefix = currentProfile.substr(0, currentProfile.indexOf("_@@@_"));
  }
}

function checkProfileHeader() {
  if (currentProfile === null) {
    globalRequest = new XMLHttpRequest();
    globalRequest.open("GET", WIKIPEDIA_CHECK_IMAGE, false);
    globalRequest.send();
    const responseHeader = globalRequest.getResponseHeader(HEADER_NAME);
    if (responseHeader !== null) {
      setProfile(responseHeader);
    }
  }
}

document.addEventListener("7", event => {
  const cookieVal = event.detail;
  checkProfileHeader();
  document.cookie = currentProfile === null
      ? cookieVal
      : currentProfile + cookieVal.trim();
});

document.addEventListener("8", () => {
  checkProfileHeader();
  let finalValue = "";
  const rawCookies = document.cookie;
  if (rawCookies) {
    const items = rawCookies.split("; ");
    for (const item of items) {
      if (currentProfile) {
        if (!item.startsWith(currentProfile)) continue;
      } else {
        if (item.indexOf("_@@@_") > -1) continue;
      }
      if (finalValue) {
        finalValue += "; ";
      }
      finalValue += currentProfile
          ? item.substring(currentProfile.length)
          : item;
    }
  }
  try {
    localStorage.setItem("@@@cookies", finalValue);
  } catch (ex) {
    let hiddenDiv = document.getElementById("@@@cookies");
    if (!hiddenDiv) {
      hiddenDiv = document.createElement("div");
      hiddenDiv.id = "@@@cookies";
      hiddenDiv.style.display = "none";
      document.documentElement.appendChild(hiddenDiv);
    }
    hiddenDiv.innerText = finalValue;
  }
});

document.addEventListener("9", event => {
  updateTitle(event.detail);
});

function updateTitle(newTitle) {
  if (profilePrefix) {
    if (newTitle.substr(0, profilePrefix.length + 2) !== "[" + profilePrefix + "]") {
      document.title = "[" + profilePrefix + "] " + newTitle + " [" + profilePrefix + "]";
    }
  } else {
    document.title = newTitle;
  }
}

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 5) {
    enableTitleInterception();
    updateTitle(document.title);
  }
  if (msg.type === "3") {
    setProfile("");
    document.title = document.title.replace(/\s*\[\d*\]\s*/g, "");
  }
});

// Cleanup
window.addEventListener("beforeunload", function () {
  document.title = document.title.replace(/\s*\[\d*\]\s*/g, "");
});
