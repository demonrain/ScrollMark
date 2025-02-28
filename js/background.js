// 添加右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "resetSettings",
    title: "重置设置",
    contexts: ["action"],
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "resetSettings") {
    // 重置设置
    const defaultSettings = {
      columnLayout: "multi-column",
      rememberLastFolder: true,
      lastFolderId: "0",
      recentBookmarks: [],
      maxRecentBookmarks: 10,
      searchDelay: 0.2,
      sidebarWidth: 220,
      language: "auto",
    };

    // 保存到存储
    chrome.storage.local.set({ markleSettings: defaultSettings }, () => {
      // 关闭所有插件窗口
      chrome.windows.getAll({ windowTypes: ["popup"] }, (windows) => {
        windows.forEach((window) => {
          chrome.windows.remove(window.id);
        });
      });
    });
  }
});
