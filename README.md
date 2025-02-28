# ScrollMark 横趣书签 - Chrome 书签管理插件

[![Release](https://img.shields.io/github/v/release/demonrain/ScrollMark)](https://github.com/demonrain/ScrollMark/releases)
[![License](https://img.shields.io/github/license/demonrain/ScrollMark)](https://github.com/demonrain/ScrollMark/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/demonrain/ScrollMark)](https://github.com/demonrain/ScrollMark/stargazers)

[English](./README_EN.md) | 简体中文

> 一个简洁优雅的 Chrome 书签管理插件，提供更直观的书签管理体验。

## 功能特点

- **多语言支持**：支持中文和英文界面，可自动识别浏览器语言或手动切换
- **层级导航**：通过面包屑和文件夹树轻松浏览书签层级
- **简洁列表视图**：以列表形式展示书签，显示网站图标和域名
- **搜索功能**：快速搜索所有书签，支持标题和网址搜索
- **常用书签**：自动记录最近使用的书签，快速访问
- **自定义布局**：支持单列、双列、三列显示模式
- **右键菜单**：支持在新标签页、新窗口或隐身窗口中打开书签
- **界面定制**：可调整侧边栏宽度，支持设置记忆功能
- **美观界面**：简洁现代的用户界面设计

## 使用方法

1. 安装插件后，点击 Chrome 工具栏中的插件图标
2. 在弹出的窗口中，左侧显示当前文件夹的子文件夹
3. 点击文件夹名称进入该文件夹
4. 右侧显示当前文件夹中的书签
5. 使用顶部的面包屑导航返回上级文件夹
6. 使用搜索框搜索所有书签
7. 点击常用书签查看最近使用的书签

## 界面说明

- **顶部栏**：
  - 插件名称和版本信息
  - 搜索框：支持实时搜索
  - 设置按钮：打开设置面板
- **导航区**：
  - 面包屑导航：显示当前位置的层级路径
  - 文件夹树：显示当前文件夹的子文件夹
- **内容区**：
  - 书签列表：显示当前文件夹的书签
  - 支持多列布局
  - 显示网站图标和域名
- **设置面板**：
  - 界面设置：布局、语言等
  - 书签管理：清理和维护功能
  - 其他选项：搜索延迟等

## 设置选项

- **布局设置**：
  - 书签列数：单列/双列/三列显示
  - 侧边栏宽度：可拖动调整
- **语言设置**：
  - 自动：跟随浏览器语言
  - 中文：简体中文界面
  - English：英文界面
- **搜索设置**：
  - 搜索延迟：调整搜索响应的灵敏度
- **书签管理**：
  - 书签管理器：快速访问 Chrome 的书签管理器
  - 常用书签：清空常用书签记录

## 快捷操作

- **书签操作**：
  - 左键点击：在新标签页打开书签
  - 右键菜单：提供更多打开方式和编辑选项
- **文件夹操作**：
  - 点击文件夹：进入文件夹
  - 点击面包屑：快速返回上级目录
- **界面调整**：
  - 拖动侧边栏：调整文件夹树的宽度
  - 切换视图：在设置中更改列数

## 安装方法

1. 下载或克隆本仓库到本地
2. 打开 Chrome 浏览器，进入扩展程序页面（chrome://extensions/）
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目文件夹

## 技术栈

- **前端**：
  - 原生 JavaScript (ES6+)
  - HTML5 / CSS3
  - Chrome Extension API
- **存储**：
  - Chrome Storage API
  - 本地存储（LocalStorage）备选
- **国际化**：
  - Chrome i18n API
  - 自定义语言切换实现

## 开发说明

本插件使用纯 HTML、CSS 和 JavaScript 开发，主要文件结构：

```
├── manifest.json    // 插件配置文件
├── popup.html      // 插件主界面
├── css/
│   └── styles.css  // 样式文件
├── js/
│   ├── popup.js    // 主要功能实现
│   ├── background.js // 后台脚本
│   └── i18n/       // 国际化文件
├── _locales/      // 语言包
└── images/        // 图标和资源
```

## 联系作者

- **Email**: demonrain@vip.qq.com
- **微信**: demonrain
- **GitHub**: [@demonrain](https://github.com/demonrain)

## 支持项目

如果您觉得这个项目对您有帮助，欢迎打赏支持！

<div align="center" style="display: flex; flex-direction: row; align-items: center;">
  <div style="display: flex; flex-direction: column; align-items: center;">
    <img src="./images/wechat_pay.png" alt="微信打赏" width="200"/>
    <div>微信打赏</div>
  </div>
  <div style="display: flex; flex-direction: column; align-items: center; margin-left: 20px;">
    <img src="./images/alipay.png" alt="支付宝打赏" width="200"/>
    <div>支付宝打赏</div>
  </div>
</div>

## 许可证

[MIT License](./LICENSE)
