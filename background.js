// background.js
let siteCookieState = {},
    identityMap = {},
    tabOriginState = {};

chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: "duplicatePage",
    title: "Duplicate Page in New Identity",
    contexts: ["page", "image"]
  });
  chrome.contextMenus.create({
    id: "openLinkIdentity",
    title: "Open Link in New Identity",
    contexts: ["link"]
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "duplicatePage") {
    handleContextClick(info);
  } else if (info.menuItemId === "openLinkIdentity") {
    handleContextClick(info);
  }
});

function handleContextClick(e) {
  const fileUrl = e.linkUrl || e.pageUrl;
  chrome.tabs.create({ url: fileUrl }, async (props) => {
    if (!props || props.id < 0) return;
    setTabIdentity(props.id, `${props.id}_@@@_`);
    // Instead of inline script injection, use chrome.scripting
    await chrome.scripting.executeScript({
      target: { tabId: props.id, allFrames: true },
      files: ["cookieInterceptors.js"]
    });
  });
}

let installDate, usageCount, userId, midValue, storedVersion, wasInstalled;

chrome.action.onClicked.addListener(() => {
  usageCount++;
  chrome.storage.sync.set({ use: usageCount });
  chrome.tabs.create({}, async (props) => {
    if (!props || props.id < 0) return;
    setTabIdentity(props.id, `${props.id}_@@@_`);
    await chrome.scripting.executeScript({
      target: { tabId: props.id, allFrames: true },
      files: ["cookieInterceptors.js"]
    });
  });
});

chrome.runtime.onInstalled.addListener(details => {
  chrome.storage.sync.get("date", data => {
    installDate = data.date;
    if (!installDate) {
      installDate = Date.now();
      data.date = installDate;
      chrome.storage.sync.set(data);
    }
  });
  chrome.storage.sync.get("use", data => {
    usageCount = data.use || 0;
    if (!data.use) {
      chrome.storage.sync.set({ use: usageCount });
    }
  });
  chrome.storage.sync.get("uid", data => {
    userId = data.uid;
    if (!userId) {
      userId = generateId();
      chrome.storage.sync.set({ uid: userId });
    }
  });
  chrome.storage.local.get("mid", data => {
    if (!data.mid) {
      data.mid = generateId();
      chrome.storage.local.set(data);
    }
    midValue = data.mid;
  });
  chrome.storage.local.get("orgVersion", data => {
    if (!data.orgVersion) {
      data.orgVersion = chrome.runtime.getManifest().version;
      chrome.storage.local.set(data);
    }
    storedVersion = data.orgVersion;
  });
  chrome.storage.local.get("mid", data => {
    if (!data.mid) {
      data.mid = generateId();
      chrome.storage.local.set(data);
    }
    midValue = data.mid;
  });
  chrome.storage.local.get("install", data => {
    wasInstalled = data.install;
  });
  chrome.storage.sync.get(() => handleInstall(details));
});

function handleInstall(details) {
  if (details.reason === "update") {
    if (details.previousVersion !== chrome.runtime.getManifest().version) {
      // y("update&ce_previousVersion=" + details.previousVersion);
    }
  }
  if (details.reason === "install") {
    const daysPassed = Math.floor((Date.now() - installDate) / 864e5);
    if (!(daysPassed || wasInstalled)) {
      chrome.tabs.query({ url: "https://chrome.google.com/webstore*" }, tabs => {
        if (tabs && tabs[0]) {
          const currentTab = tabs[0];
          if (currentTab.openerTabId) {
            chrome.tabs.get(currentTab.openerTabId, () => {
              // y("install&ce_url=" + currentTab.url + "&ce_referrer=" + loc.url);
            });
          } else {
            // y("install&ce_url=" + currentTab.url);
          }
        } else {
          // y("install");
        }
      });
    }
  }
}

function generateId() {
  return ("000000000000" + (Math.random() * 36 ** 12).toString(36)).slice(-12);
}

function removeCookies(prefix) {
  chrome.cookies.getAll({}, allCookies => {
    for (let cookie of allCookies) {
      const { name, secure, domain, path } = cookie;
      if (
          !(prefix === null && name.includes("@@@")) &&
          !(prefix === "" && !name.includes("@@@")) &&
          !(prefix && !name.startsWith(prefix))
      ) {
        chrome.cookies.remove({
          url: `${secure ? "https://" : "http://"}${domain}${path}`,
          name
        });
      }
    }
  });
}

function checkCookies() {
  chrome.cookies.getAll({}, all => {
    for (let cookie of all) {
      const cookieName = cookie.name;
      if (cookieName.includes("_@@@_")) {
        const base = `${cookieName.slice(0, cookieName.indexOf("_@@@_"))}_@@@_`;
        if (Object.values(identityMap).includes(base)) return;
      }
    }
  });
}

chrome.tabs.onReplaced.addListener((oldId, newId) => {
  const identity = getTabIdentity(newId);
  setTabIdentity(oldId, identity);
  delete identityMap[newId];
  updateBadge(oldId, identity);
});

chrome.tabs.onRemoved.addListener(tabId => {
  const currentIdentity = getTabIdentity(tabId);
  if (currentIdentity) {
    delete identityMap[tabId];
    if (!Object.values(identityMap).includes(currentIdentity)) {
      removeCookies(currentIdentity);
    }
  }
  delete tabOriginState[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, _, info) => {
  if (info.status === "loading") {
    setTabIdentity(tabId, getTabIdentity(tabId));
  }
});

chrome.tabs.onCreated.addListener(tab => {
  if (!tab) return;
  const newTabId = tab.id;
  if (newTabId >= 0) {
    if (!tab.openerTabId) {
      let currentWinId = tab.windowId;
      if (currentWindow && activeTab && currentWindow !== currentWinId) {
        currentWinId = getTabIdentity(activeTab);
        setTabIdentity(newTabId, currentWinId);
        tabOriginState[newTabId] = true;
        return;
      }
    }
    const url = tab.pendingUrl || tab.url;
    if (tab.openerTabId && !url.startsWith("chrome")) {
      const originIdentity = getTabIdentity(tab.openerTabId);
      setTabIdentity(newTabId, originIdentity);
      if (typeof tabOriginState[newTabId] === "undefined") {
        tabOriginState[newTabId] = tab.openerTabId;
      }
    } else {
      tabOriginState[newTabId] = true;
    }
  }
});

let currentWindow;
chrome.windows.getCurrent({}, w => handleWindowFocus(w.id));
chrome.windows.onFocusChanged.addListener(handleWindowFocus);

function handleWindowFocus(windowId) {
  if (windowId && windowId > -1) {
    chrome.windows.get(windowId, {}, w => {
      if (w && w.type === "normal") {
        currentWindow = windowId;
        chrome.tabs.query({ active: true, windowId: currentWindow }, res => {
          if (res[0]) activeTab = res[0].id;
        });
      }
    });
  }
}

let activeTab;
chrome.tabs.onActivated.addListener(info => handleWindowFocus(info.windowId));

function getTabIdentity(tabId) {
  return tabId < 1
      ? ""
      : siteCookieState[tabId] || !identityMap[tabId]
          ? ""
          : identityMap[tabId];
}

function setTabIdentity(tabId, identity) {
  if (identity) {
    identityMap[tabId] = identity;
    updateBadge(tabId, identity);
  }
}

function updateBadge(tabId, identity) {
  if (identity !== undefined) {
    const obj = {
      text: identity.slice(0, identity.indexOf("_@@@_")),
      tabId
    };
    chrome.action.setBadgeBackgroundColor({ color: "#006600", tabId });
    chrome.action.setBadgeText(obj);
  }
}
