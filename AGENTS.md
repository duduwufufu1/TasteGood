# TasteGood — 微信小程序

## 项目简介

美食推荐/记录小程序，带地图选址、城市选择、评分记录、图片上传等功能。

## 项目结构

```
TasteGood/
├── pages/
│   ├── index/          # 地图首页（tab: 地图）
│   ├── cities/         # 城市选择页（tab: 城市）
│   ├── add-record/     # 添加记录页
│   ├── detail/         # 详情页
│   ├── list/           # 列表页（tab: 列表）
│   └── profile/        # 个人中心（tab: 我的）
├── components/
│   ├── city-picker/    # 城市选择器
│   ├── record-card/    # 记录卡片
│   └── star-rating/    # 星级评分
├── utils/              # 工具函数
├── images/             # 图片资源
├── cloudfunctions/     # 云函数
│   ├── login/          # 登录
│   └── records/        # 记录操作
├── i18n/               # 国际化
└── scripts/            # 构建脚本
```

## 微信小程序开发规范

- 使用原生小程序框架（非 uni-app / Taro）
- 页面目录四件套: `.js` / `.wxml` / `.wxss` / `.json`
- 组件用 `Component()` 构造，页面用 `Page()` 构造
- 数据绑定用 `this.setData()`，避免直接修改 `this.data`
- 事件处理用 `handleXxx` 命名，在 `methods` 中定义
- 网络请求优先使用云函数（`wx.cloud.callFunction`）
- 样式使用 `rpx` 单位，设计稿以 750px 为准
- 图片资源放 `images/`，图标用 base64 或字体图标

## API 和数据

- 数据存储在微信云开发数据库
- 云函数处理数据读写和鉴权
- 用户登录使用 `wx.cloud.callFunction({ name: 'login' })`
- 涉及位置信息使用 `wx.chooseLocation` 和 `wx.getLocation`

## 当前功能

- [x] 地图模式浏览美食记录
- [x] 按城市筛选
- [x] 添加美食记录（含地理位置、图片、评分）
- [x] 美食详情页
- [x] 列表模式浏览
- [x] 个人中心
- [x] 星级评分组件
- [x] 中国地图城市选择
- [x] 国际化支持 (i18n)
