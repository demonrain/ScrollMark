import { getMessage } from "./i18n/index.js";

document.addEventListener("DOMContentLoaded", function () {
  // 获取DOM元素
  const folderTree = document.getElementById("folder-tree");
  const bookmarkList = document.getElementById("bookmark-list");
  const breadcrumb = document.getElementById("breadcrumb");
  const searchInput = document.getElementById("search-input");
  const searchButton = document.getElementById("search-button");
  const settingsButton = document.getElementById("settings-button");
  const settingsPanel = document.getElementById("settings-panel");
  const closeSettings = document.getElementById("close-settings");
  const saveSettings = document.getElementById("save-settings");
  const resetSettings = document.getElementById("reset-settings");
  const columnLayout = document.getElementById("column-layout");
  const clearRecent = document.getElementById("clear-recent");
  const searchDelay = document.getElementById("search-delay");
  const manageBookmarks = document.getElementById("manage-bookmarks");

  // 存储书签数据
  let bookmarkData = {};
  let currentFolder = "0"; // 根文件夹ID
  let previousFolder = "0"; // 保存切换到常用书签前的位置

  let searchTimeout = null;
  let currentContextMenu = null; // 添加全局变量跟踪当前右键菜单

  // 默认设置
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

  // 当前设置
  let settings = Object.assign({}, defaultSettings);

  let rootFolderTitle = getI18nMessage("rootFolder");
  let breadcrumbPath = [{ id: "0", title: rootFolderTitle }];

  // 获取i18n消息
  function getI18nMessage(key) {
    return getMessage(key, settings);
  }

  // 更新界面文本
  function updateUIText() {
    // 更新所有带有 data-i18n 属性的元素
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      element.textContent = getI18nMessage(key);
    });

    // 更新所有带有 data-i18n-placeholder 属性的元素
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      const key = element.getAttribute("data-i18n-placeholder");
      element.placeholder = getI18nMessage(key);
    });

    // 更新所有带有 data-i18n-title 属性的元素
    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      const key = element.getAttribute("data-i18n-title");
      element.title = getI18nMessage(key);
    });
  }

  // 添加防抖函数
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // 修改语言切换事件
  function addLanguageSettings() {
    const settingsGroup = document.querySelector(".settings-group");
    const languageItem = document.createElement("div");
    languageItem.className = "settings-item";
    languageItem.innerHTML = `
      <label for="language" data-i18n="language"></label>
      <select id="language">
        <option value="auto" data-i18n="auto"></option>
        <option value="en">English</option>
        <option value="zh_CN">简体中文</option>
      </select>
    `;
    settingsGroup.appendChild(languageItem);

    // 设置当前语言
    const languageSelect = document.getElementById("language");
    languageSelect.value = settings.language;

    // 更新语言选择器的文本
    updateUIText();

    // 添加语言切换事件
    languageSelect.addEventListener("change", function () {
      const newLanguage = this.value;
      if (newLanguage !== settings.language) {
        settings.language = newLanguage;
        saveSettingsQuietly();
        updateUIText();
        // 重新渲染当前文件夹内容
        renderFolderContent(currentFolder);
        //重新渲染面包屑
        updateBreadcrumb(currentFolder);
        showNotification("languageChanged");
      }
    });
  }

  // 初始化
  init();

  // 初始化函数
  function init() {
    console.log("初始化开始");

    // 加载设置
    loadSettings(function () {
      // 应用加载的设置
      applySettings();

      // 获取所有书签
      chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
        // 处理书签树
        processBookmarks(bookmarkTreeNodes);

        // 调试信息
        console.log("书签数据:", bookmarkData);

        // 渲染根文件夹内容
        const startFolder = settings.rememberLastFolder
          ? settings.lastFolderId
          : "0";
        renderFolderContent(startFolder);
      });

      // 更新界面文本
      updateUIText();

      // 添加语言设置
      addLanguageSettings();

      // 初始化侧边栏拖拽
      initSidebarResize();
    });

    // 添加搜索事件监听
    searchButton.addEventListener("click", performSearch);
    searchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        performSearch();
      }
    });

    // 添加设置相关事件监听
    settingsButton.addEventListener("click", toggleSettings);
    closeSettings.addEventListener("click", toggleSettings);
    saveSettings.addEventListener("click", saveUserSettings);
    resetSettings.addEventListener("click", resetUserSettings);
    clearRecent.addEventListener("click", clearRecentBookmarks);

    // 添加书签点击事件监听
    document.addEventListener("click", function (e) {
      const bookmarkItem = e.target.closest(".bookmark-item");
      if (bookmarkItem && bookmarkItem.href) {
        // 处理特殊URL
        if (bookmarkItem.href.startsWith("chrome://")) {
          e.preventDefault();
          chrome.tabs.create({ url: bookmarkItem.href });
          return;
        }

        addToRecentBookmarks({
          id: bookmarkItem.dataset.bookmarkId,
          title: bookmarkItem.querySelector(".bookmark-title").textContent,
          url: bookmarkItem.href,
          favicon: bookmarkItem.querySelector(".bookmark-icon").src,
        });
      }
    });

    // 添加常用书签点击事件
    document
      .querySelector(".quick-links .folder-item")
      .addEventListener("click", function () {
        renderFolderContent("recent");
      });

    // 添加搜索事件监听
    searchInput.addEventListener("input", function () {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      searchTimeout = setTimeout(performSearch, settings.searchDelay * 1000);
    });

    // 添加书签管理按钮点击事件
    manageBookmarks.addEventListener("click", function () {
      chrome.tabs.create({ url: "chrome://bookmarks" });
    });
  }

  // 加载设置
  function loadSettings(callback) {
    console.log("开始加载设置");

    // 从Chrome存储中加载设置
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get("markleSettings", function (result) {
        console.log("从Chrome存储加载的设置:", result);

        if (result && result.markleSettings) {
          settings = Object.assign({}, defaultSettings, result.markleSettings);
          console.log("合并后的设置:", settings);
          updateSettingsUI();
        } else {
          console.log("未找到已保存的设置，使用默认设置");
        }

        if (callback) callback();
      });
    } else {
      // 如果无法访问存储，使用本地存储
      const savedSettings = localStorage.getItem("markleSettings");
      console.log("从本地存储加载的设置:", savedSettings);

      if (savedSettings) {
        try {
          settings = Object.assign(
            {},
            defaultSettings,
            JSON.parse(savedSettings)
          );
          console.log("合并后的设置:", settings);
          updateSettingsUI();
        } catch (e) {
          console.error("解析设置时出错:", e);
        }
      } else {
        console.log("未找到已保存的设置，使用默认设置");
      }

      if (callback) callback();
    }
  }

  // 更新设置UI
  function updateSettingsUI() {
    columnLayout.value = settings.columnLayout;
    searchDelay.value = settings.searchDelay;
  }

  // 应用设置
  function applySettings() {
    // 设置书签列数
    bookmarkList.className = "bookmark-list " + settings.columnLayout;

    // 应用侧边栏宽度
    const sidebar = document.querySelector(".sidebar");
    if (sidebar && settings.sidebarWidth) {
      sidebar.style.width = settings.sidebarWidth + "px";
    }
  }

  // 初始化侧边栏拖拽功能
  function initSidebarResize() {
    const sidebar = document.querySelector(".sidebar");
    let isResizing = false;
    let startX;
    let startWidth;

    function startResize(e) {
      // 只在侧边栏右边缘4px范围内启动拖拽
      const mouseX = e.clientX;
      const sidebarRect = sidebar.getBoundingClientRect();
      const threshold = 4;

      if (
        mouseX >= sidebarRect.right - threshold &&
        mouseX <= sidebarRect.right
      ) {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(getComputedStyle(sidebar).width, 10);
        sidebar.classList.add("dragging");
      }
    }

    function stopResize() {
      if (isResizing) {
        isResizing = false;
        sidebar.classList.remove("dragging");

        // 保存新的宽度到设置
        settings.sidebarWidth = parseInt(sidebar.style.width);
        saveSettingsQuietly();
      }
    }

    function resize(e) {
      if (!isResizing) return;

      const width = startWidth + (e.clientX - startX);
      const minWidth = 180;
      const maxWidth = window.innerWidth * 0.5;

      if (width >= minWidth && width <= maxWidth) {
        sidebar.style.width = width + "px";
      }
    }

    sidebar.addEventListener("mousedown", startResize);
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResize);
    document.addEventListener("mouseleave", stopResize);
  }

  // 保存设置到存储
  function saveUserSettings() {
    const newColumnLayout = columnLayout.value;
    const newRememberLastFolder = true; // 始终为 true
    const newSearchDelay = Math.max(
      0,
      Math.min(5, parseFloat(searchDelay.value) || defaultSettings.searchDelay)
    );

    // 检查是否有变化
    const layoutChanged = newColumnLayout !== settings.columnLayout;
    const rememberChanged =
      newRememberLastFolder !== settings.rememberLastFolder;
    const searchDelayChanged = newSearchDelay !== settings.searchDelay;

    // 更新设置对象
    settings.columnLayout = newColumnLayout;
    settings.rememberLastFolder = newRememberLastFolder;
    settings.searchDelay = newSearchDelay;

    // 如果取消记住位置，重置lastFolderId
    if (!newRememberLastFolder) {
      settings.lastFolderId = "0";
    }

    // 保存到存储
    chrome.storage.local.set({ markleSettings: settings }, function () {
      // 应用新的设置
      applySettings();
      showNotification("settingsSaved");
      toggleSettings(); // 关闭设置面板
    });
  }

  // 重置设置
  function resetUserSettings() {
    // 保存当前的常用书签
    const currentRecentBookmarks = settings.recentBookmarks;

    // 重置其他设置
    settings = Object.assign({}, defaultSettings, {
      recentBookmarks: currentRecentBookmarks,
      language: "auto", // 确保语言设置为 auto
    });

    // 更新设置UI
    updateSettingsUI();

    // 更新语言选择器
    const languageSelect = document.getElementById("language");
    if (languageSelect) {
      languageSelect.value = "auto";
    }

    // 更新界面文本
    updateUIText();

    // 保存到Chrome存储
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ markleSettings: settings }, function () {
        console.log("设置已重置（保留常用书签）");
        showNotification("settingsSaved");
        // 重新渲染当前文件夹内容
        renderFolderContent(currentFolder);
      });
    } else {
      // 如果无法访问存储，使用本地存储
      localStorage.setItem("markleSettings", JSON.stringify(settings));
      // 重新渲染当前文件夹内容
      renderFolderContent(currentFolder);
    }

    // 应用设置
    applySettings();
  }

  // 切换设置面板
  function toggleSettings(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const isVisible = settingsPanel.classList.contains("show");
    if (!isVisible) {
      settingsPanel.classList.add("show");
      updateSettingsUI();
    } else {
      settingsPanel.classList.remove("show");
    }
  }

  // 移除旧的事件监听器
  document.removeEventListener("mousedown", toggleSettings);
  settingsPanel.removeEventListener("mousedown", toggleSettings);

  // 更新事件监听器
  document.addEventListener("mousedown", function (e) {
    if (
      settingsPanel.classList.contains("show") &&
      !settingsPanel.contains(e.target) &&
      !settingsButton.contains(e.target)
    ) {
      toggleSettings();
    }
  });

  // 阻止设置面板内的点击事件冒泡
  settingsPanel.addEventListener("mousedown", function (e) {
    e.stopPropagation();
  });

  // 处理书签数据
  function processBookmarks(bookmarkNodes) {
    // 初始化根文件夹
    const message = getI18nMessage("rootFolder");
    bookmarkData["0"] = {
      id: "0",
      title: message,
      children: [],
      bookmarks: [],
      parentId: null,
    };

    // Chrome书签树的特殊结构处理
    if (bookmarkNodes && bookmarkNodes.length > 0) {
      const rootNode = bookmarkNodes[0];

      // 处理根节点的所有子节点
      if (rootNode.children) {
        rootNode.children.forEach((child) => {
          // 处理书签栏和其他书签文件夹
          if (child.children) {
            // 直接将书签栏和其他书签文件夹添加到根目录
            bookmarkData["0"].children.push({
              id: child.id,
              title: child.title || "未命名文件夹",
            });
            // 存储文件夹数据
            bookmarkData[child.id] = {
              id: child.id,
              title: child.title || "未命名文件夹",
              children: [],
              bookmarks: [],
              parentId: "0",
            };
            // 处理子节点
            child.children.forEach((subChild) => {
              processNode(subChild, child.id);
            });
          }
        });
      }
    }
  }

  // 处理单个节点
  function processNode(node, parentId) {
    // 如果是文件夹
    if (node.children) {
      // 创建文件夹对象
      const folder = {
        id: node.id,
        title: node.title || "未命名文件夹",
        children: [],
        bookmarks: [],
        parentId: parentId,
      };

      // 添加到父文件夹的子文件夹列表
      if (bookmarkData[parentId]) {
        bookmarkData[parentId].children.push({
          id: node.id,
          title: node.title || "未命名文件夹",
        });
      }

      // 存储文件夹数据
      bookmarkData[node.id] = folder;

      // 递归处理子节点
      for (let i = 0; i < node.children.length; i++) {
        processNode(node.children[i], node.id);
      }
    }
    // 如果是书签
    else if (node.url) {
      const bookmark = {
        id: node.id,
        title: node.title || "未命名书签",
        url: node.url,
        favicon: getFaviconUrl(node.url),
      };

      // 添加到父文件夹的书签列表
      if (bookmarkData[parentId]) {
        bookmarkData[parentId].bookmarks.push(bookmark);
      }
    }
  }

  // 获取网站favicon的URL
  function getFaviconUrl(url) {
    try {
      // 处理特殊URL
      if (url.startsWith("chrome://")) {
        return "images/chrome-icon.png"; // 使用一个默认的Chrome图标
      }

      const urlObj = new URL(url);
      // 使用 Google 的 favicon 服务
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch (e) {
      return "images/default-icon.png";
    }
  }

  // 渲染文件夹内容
  function renderFolderContent(folderId) {
    // 如果是切换到常用书签视图，保存当前位置
    if (folderId === "recent") {
      if (currentFolder === "recent") {
        // 如果已经在常用书签视图，则返回上一级
        renderFolderContent(previousFolder);
        return;
      }
      previousFolder = currentFolder;
    }

    currentFolder = folderId;

    // 清空书签列表
    bookmarkList.innerHTML = "";

    // 如果是常用书签视图
    if (folderId === "recent") {
      updateBreadcrumb("recent");
      renderRecentBookmarks();
      // 显示返回按钮，使用之前保存的位置
      const backButton = document.createElement("div");
      backButton.className = "folder-item";
      const message = getI18nMessage("backToParent");
      backButton.innerHTML = `
        <span class="folder-icon"><i class="fas fa-arrow-left"></i></span>
        <span class="folder-name">${message}</span>
      `;
      backButton.addEventListener("click", () => {
        renderFolderContent(previousFolder);
      });
      folderTree.innerHTML = "";
      folderTree.appendChild(backButton);
      return;
    }

    // 保存当前文件夹ID（仅在非常用书签视图时）
    if (folderId !== "recent") {
      saveCurrentFolder(folderId);
    }

    // 调试信息
    console.log("渲染文件夹:", folderId);
    console.log("文件夹数据:", bookmarkData[folderId]);

    // 更新面包屑
    updateBreadcrumb(folderId);

    // 渲染文件夹树
    renderFolderTree(folderId);

    // 渲染书签列表
    renderBookmarks(folderId);
  }

  // 更新面包屑导航
  function updateBreadcrumb(folderId) {
    if (folderId === "0") {
      const message = getI18nMessage("rootFolder");
      breadcrumb.innerHTML = `<span class="breadcrumb-item active">${message}</span>`;
      breadcrumbPath = [{ id: "0", title: message }];
      return;
    }

    if (folderId === "recent") {
      const message = getI18nMessage("recentBookmarks");
      breadcrumb.innerHTML = `<span class="breadcrumb-item active">${message}</span>`;
      breadcrumbPath = [{ id: "recent", title: message }];
      return;
    }

    // 查找当前文件夹在面包屑中的位置
    const index = breadcrumbPath.findIndex((item) => item.id === folderId);

    // 如果找到，截断面包屑到该位置
    if (index !== -1) {
      breadcrumbPath = breadcrumbPath.slice(0, index + 1);
    }
    // 如果没找到，添加到面包屑路径
    else {
      // 构建从根到当前文件夹的路径
      const newPath = [];
      let currentId = folderId;

      while (currentId) {
        const folder = bookmarkData[currentId];
        if (folder) {
          newPath.unshift({ id: folder.id, title: folder.title });
          currentId = folder.parentId;
        } else {
          break;
        }
      }

      breadcrumbPath = newPath;
    }

    // 渲染面包屑
    breadcrumb.innerHTML = "";

    breadcrumbPath.forEach((item, index) => {
      const span = document.createElement("span");
      span.className = "breadcrumb-item";
      span.textContent = item.title;
      span.dataset.id = item.id;

      if (item.id === folderId) {
        span.classList.add("active");
      }

      span.addEventListener("click", function () {
        renderFolderContent(item.id);
      });

      breadcrumb.appendChild(span);

      // 添加分隔符（除了最后一项）
      if (index < breadcrumbPath.length - 1) {
        const separator = document.createElement("span");
        separator.className = "breadcrumb-separator";
        separator.textContent = " > ";
        breadcrumb.appendChild(separator);
      }
    });
  }

  // 渲染文件夹树
  function renderFolderTree(folderId) {
    folderTree.innerHTML = "";

    const folder = bookmarkData[folderId];
    if (!folder) {
      console.error("找不到文件夹:", folderId);
      return;
    }

    // 渲染子文件夹
    folder.children.forEach((child) => {
      const folderItem = document.createElement("div");
      folderItem.className = "folder-item";
      folderItem.dataset.id = child.id;

      // 添加图标
      const icon = document.createElement("span");
      icon.className = "folder-icon";
      icon.innerHTML = '<i class="fas fa-folder"></i>';

      // 添加文件夹名称
      const name = document.createElement("span");
      name.className = "folder-name";
      name.textContent = child.title;

      folderItem.appendChild(icon);
      folderItem.appendChild(name);

      // 添加点击事件
      folderItem.addEventListener("click", function () {
        renderFolderContent(child.id);
      });

      folderTree.appendChild(folderItem);
    });

    // 如果没有子文件夹
    if (folder.children.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "no-folders";
      const message = getI18nMessage("noFolders");
      emptyMessage.textContent = message;
      folderTree.appendChild(emptyMessage);
    }
  }

  // 渲染书签列表
  function renderBookmarks(folderId) {
    bookmarkList.innerHTML = "";

    const folder = bookmarkData[folderId];
    if (!folder) {
      console.error("找不到文件夹:", folderId);
      return;
    }

    console.log("渲染书签列表:", folder.bookmarks.length);

    // 渲染书签
    folder.bookmarks.forEach((bookmark) => {
      const bookmarkItem = createBookmarkElement(bookmark);
      bookmarkList.appendChild(bookmarkItem);
    });

    // 如果没有书签
    if (folder.bookmarks.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "no-bookmarks";
      const message = getI18nMessage("noBookmarks");
      emptyMessage.textContent = message;
      bookmarkList.appendChild(emptyMessage);
    }
  }

  // 创建书签元素
  function createBookmarkElement(bookmark) {
    const bookmarkItem = document.createElement("a");
    bookmarkItem.className = "bookmark-item";
    bookmarkItem.href = bookmark.url;
    bookmarkItem.target = "_blank";
    bookmarkItem.dataset.bookmarkId = bookmark.id;

    // 添加右键菜单事件
    bookmarkItem.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      const bookmarkId = this.dataset.bookmarkId;

      // 移除已存在的右键菜单
      if (currentContextMenu && document.body.contains(currentContextMenu)) {
        document.body.removeChild(currentContextMenu);
      }

      // 创建右键菜单
      const contextMenu = document.createElement("div");
      currentContextMenu = contextMenu;
      contextMenu.className = "context-menu";
      contextMenu.innerHTML = `
        <div class="menu-item" data-action="new-tab">在新标签页中打开</div>
        <div class="menu-item" data-action="new-window">在新窗口中打开</div>
        <div class="menu-item" data-action="incognito">在隐身窗口中打开</div>
        <div class="separator"></div>
        <div class="menu-item" data-action="edit">编辑...</div>
        <div class="menu-item" data-action="delete">删除</div>
      `;

      // 设置菜单位置
      contextMenu.style.position = "fixed";

      // 先添加到文档中以获取尺寸
      document.body.appendChild(contextMenu);

      // 计算合适的位置
      const menuRect = contextMenu.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // 确保右边界不超出窗口
      let left = e.clientX;
      if (left + menuRect.width > windowWidth) {
        left = windowWidth - menuRect.width - 5;
      }

      // 确保下边界不超出窗口
      let top = e.clientY;
      if (top + menuRect.height > windowHeight) {
        top = windowHeight - menuRect.height - 5;
      }

      // 应用计算后的位置
      contextMenu.style.left = left + "px";
      contextMenu.style.top = top + "px";

      // 添加菜单项点击事件
      contextMenu.addEventListener("click", function (e) {
        const action = e.target.dataset.action;
        if (!action) return;

        switch (action) {
          case "new-tab":
            chrome.tabs.create({ url: bookmark.url });
            addToRecentBookmarks(bookmark);
            break;
          case "new-window":
            chrome.windows.create({ url: bookmark.url });
            addToRecentBookmarks(bookmark);
            break;
          case "incognito":
            chrome.windows.create({ url: bookmark.url, incognito: true });
            break;
          case "edit":
            // 创建编辑对话框
            const editDialog = document.createElement("div");
            editDialog.className = "edit-dialog";
            editDialog.innerHTML = `
              <div class="edit-dialog-content">
                <h3>编辑书签</h3>
                <div class="edit-item">
                  <label>名称</label>
                  <input type="text" id="edit-title" value="${bookmark.title}">
                </div>
                <div class="edit-item">
                  <label>网址</label>
                  <input type="text" id="edit-url" value="${bookmark.url}">
                </div>
                <div class="edit-actions">
                  <button class="cancel-edit">取消</button>
                  <button class="save-edit">保存</button>
                </div>
              </div>
            `;

            document.body.appendChild(editDialog);

            // 添加编辑对话框事件处理
            const cancelEdit = editDialog.querySelector(".cancel-edit");
            const saveEdit = editDialog.querySelector(".save-edit");

            cancelEdit.addEventListener("click", () => {
              document.body.removeChild(editDialog);
            });

            saveEdit.addEventListener("click", () => {
              const newTitle = document
                .getElementById("edit-title")
                .value.trim();
              const newUrl = document.getElementById("edit-url").value.trim();

              if (newTitle && newUrl) {
                chrome.bookmarks.update(
                  bookmarkId,
                  {
                    title: newTitle,
                    url: newUrl,
                  },
                  (result) => {
                    if (chrome.runtime.lastError) {
                      showNotification(
                        "保存失败：" + chrome.runtime.lastError.message
                      );
                    } else {
                      showNotification("bookmarkUpdated");
                      document.body.removeChild(editDialog);
                      // 更新本地数据
                      const folder = bookmarkData[currentFolder];
                      if (folder) {
                        const bookmarkIndex = folder.bookmarks.findIndex(
                          (b) => b.id === bookmarkId
                        );
                        if (bookmarkIndex !== -1) {
                          folder.bookmarks[bookmarkIndex].title = newTitle;
                          folder.bookmarks[bookmarkIndex].url = newUrl;
                        }
                      }
                      renderFolderContent(currentFolder);
                    }
                  }
                );
              } else {
                showNotification("标题和网址不能为空");
              }
            });
            break;
          case "delete":
            if (confirm("确定要删除这个书签吗？")) {
              chrome.bookmarks.remove(bookmarkId, function () {
                // 从本地数据中删除书签
                const folder = bookmarkData[currentFolder];
                if (folder) {
                  folder.bookmarks = folder.bookmarks.filter(
                    (b) => b.id !== bookmarkId
                  );
                }
                showNotification("bookmarkDeleted");
                renderFolderContent(currentFolder);
              });
            }
            break;
        }
        document.body.removeChild(contextMenu);
      });

      // 点击其他地方关闭菜单
      document.addEventListener("click", function closeMenu() {
        if (document.body.contains(contextMenu)) {
          document.body.removeChild(contextMenu);
        }
        document.removeEventListener("click", closeMenu);
      });

      document.body.appendChild(contextMenu);
    });

    // 创建图标
    const icon = document.createElement("img");
    icon.className = "bookmark-icon";
    icon.src = bookmark.favicon;
    icon.onerror = function () {
      // 如果Chrome的favicon服务加载失败，尝试使用网站自己的favicon
      try {
        const urlObj = new URL(bookmark.url);
        this.src = urlObj.origin + "/favicon.ico";

        // 如果网站自己的favicon也加载失败，使用默认图标
        this.onerror = function () {
          this.src = "images/default-icon.png";
        };
      } catch (e) {
        this.src = "images/default-icon.png";
      }
    };

    // 创建书签信息容器
    const info = document.createElement("div");
    info.className = "bookmark-info";

    // 创建标题
    const title = document.createElement("div");
    title.className = "bookmark-title";
    title.textContent = bookmark.title;

    // 创建URL
    const url = document.createElement("div");
    url.className = "bookmark-url";
    try {
      url.textContent = new URL(bookmark.url).hostname;
    } catch (e) {
      url.textContent = bookmark.url;
    }

    // 组装元素
    info.appendChild(title);
    info.appendChild(url);

    bookmarkItem.appendChild(icon);
    bookmarkItem.appendChild(info);

    return bookmarkItem;
  }

  // 执行搜索
  function performSearch() {
    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
      // 如果搜索框为空，返回当前文件夹视图
      renderFolderContent(currentFolder);
      return;
    }

    // 清空书签列表
    bookmarkList.innerHTML = "";

    // 创建搜索结果头部
    const header = document.createElement("div");
    header.className = "search-results-header";
    header.textContent = `搜索结果: "${query}"`;
    bookmarkList.appendChild(header);

    // 搜索结果
    let results = [];

    // 搜索所有书签
    for (const folderId in bookmarkData) {
      const folder = bookmarkData[folderId];

      folder.bookmarks.forEach((bookmark) => {
        if (
          bookmark.title.toLowerCase().includes(query) ||
          bookmark.url.toLowerCase().includes(query)
        ) {
          results.push(bookmark);
        }
      });
    }

    // 显示搜索结果
    if (results.length > 0) {
      results.forEach((bookmark) => {
        const bookmarkItem = createBookmarkElement(bookmark);
        bookmarkList.appendChild(bookmarkItem);
      });
    } else {
      const noResults = document.createElement("div");
      noResults.className = "no-results";
      noResults.textContent = "没有找到匹配的书签";
      bookmarkList.appendChild(noResults);
    }
  }

  // 显示通知
  function showNotification(messageKey) {
    const message = getI18nMessage(messageKey);
    console.log("显示通知:", message);

    // 先移除可能存在的旧通知
    const oldNotification = document.querySelector(".notification");
    if (oldNotification) {
      document.body.removeChild(oldNotification);
    }

    const notification = document.createElement("div");
    notification.className = "notification";
    notification.textContent = message;

    document.body.appendChild(notification);

    // 3秒后自动消失
    setTimeout(function () {
      notification.classList.add("fade-out");
      setTimeout(function () {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 500);
    }, 3000);
  }

  // 保存设置到存储（静默保存，不显示面板和通知）
  function saveSettingsQuietly() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ markleSettings: settings }, function () {
        console.log("设置已静默保存到Chrome存储");
      });
    } else {
      localStorage.setItem("markleSettings", JSON.stringify(settings));
      console.log("设置已静默保存到本地存储");
    }
  }

  // 添加到最近使用的书签
  function addToRecentBookmarks(bookmark) {
    // 移除可能存在的重复项
    settings.recentBookmarks = settings.recentBookmarks.filter(
      (b) => b.url !== bookmark.url
    );

    // 添加到开头
    settings.recentBookmarks.unshift(bookmark);

    // 限制数量
    if (settings.recentBookmarks.length > settings.maxRecentBookmarks) {
      settings.recentBookmarks = settings.recentBookmarks.slice(
        0,
        settings.maxRecentBookmarks
      );
    }

    // 静默保存设置
    saveSettingsQuietly();

    // 如果当前在常用书签视图，刷新显示
    if (currentFolder === "recent") {
      renderRecentBookmarks();
    }
  }

  // 渲染最近使用的书签
  function renderRecentBookmarks() {
    bookmarkList.innerHTML = "";

    if (settings.recentBookmarks.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "no-bookmarks";
      const message = getI18nMessage("noRecentBookmarks");
      emptyMessage.textContent = message;
      bookmarkList.appendChild(emptyMessage);
      return;
    }

    settings.recentBookmarks.forEach((bookmark) => {
      const bookmarkItem = createBookmarkElement(bookmark);
      bookmarkItem.style.position = "relative";

      // 添加删除按钮
      const removeButton = document.createElement("span");
      removeButton.className = "remove-recent";
      removeButton.innerHTML = '<i class="fas fa-times"></i>';
      const message = getI18nMessage("removeFromRecentBookmarks");
      removeButton.title = message;

      removeButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 从常用书签中移除
        settings.recentBookmarks = settings.recentBookmarks.filter(
          (b) => b.url !== bookmark.url
        );

        // 保存设置
        saveSettingsQuietly();

        // 重新渲染
        renderRecentBookmarks();
        showNotification("bookmarkDeleted");
      });

      bookmarkItem.appendChild(removeButton);
      bookmarkList.appendChild(bookmarkItem);
    });
  }

  // 清空最近使用的书签
  function clearRecentBookmarks() {
    settings.recentBookmarks = [];
    saveSettingsQuietly();
    if (currentFolder === "recent") {
      renderRecentBookmarks();
    }
    showNotification("clearRecentBookmarks");
  }

  // 保存当前文件夹ID
  function saveCurrentFolder(folderId) {
    if (settings.rememberLastFolder && folderId !== "recent") {
      settings.lastFolderId = folderId;
      saveSettingsQuietly();
    }
  }

  // 添加右键菜单
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "resetSettings",
      title: "重置设置",
      contexts: ["action"], // "action" 表示扩展图标的右键菜单
    });
  });

  // 处理右键菜单点击
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "resetSettings") {
      // 重置设置
      settings = Object.assign({}, defaultSettings);

      // 保存到存储
      chrome.storage.local.set({ markleSettings: settings }, () => {
        // 关闭所有插件窗口
        chrome.windows.getAll({ windowTypes: ["popup"] }, (windows) => {
          windows.forEach((window) => {
            chrome.windows.remove(window.id);
          });
        });
      });
    }
  });

  // 修改 CSS 中的最小尺寸
  document.documentElement.style.setProperty(
    "--min-width",
    defaultSettings.minWidth + "px"
  );
  document.documentElement.style.setProperty(
    "--min-height",
    defaultSettings.minHeight + "px"
  );
});
