const { COLLECTION } = require("../../utils/constants");
const { formatDateTime } = require("../../utils/util");
const recordRegion = require("../../utils/record-region");
const userRecords = require("../../utils/user-records");
const db = wx.cloud.database();
const TAG_NAME_MAP = {
  breakfast:"早餐", lunch:"午餐", dinner:"晚餐", dessert:"甜品", drink:"饮品",
  snack:"小吃", hotpot:"火锅", bbq:"烧烤", musttry:"必吃", avoid:"踩雷"
};
Page({
  data: {
    id: "", name: "", address: "", rating: 0,
    dishName: "", price: "", reviewTitle: "",
    comment: "", images: [], tags: [], time: "",
    samePlaceRecords: [], samePlaceCount: 0,
    visitSectionTitle: "本次记录", visitCountText: "0 visits", visitTip: "本次记录已收录",
    lat: 0, lng: 0
  },
  onLoad(options) {
    if (options.id) { this.setData({ id: options.id }); this.loadDetail(); }
  },
  onShow() {
    // 已由 onLoad 加载，不再重复调用
  },
  async loadDetail() {
    try {
      const user = await userRecords.getCurrentUser({ interactive: true });
      const res = await db.collection(COLLECTION.RECORDS).doc(this.data.id).get();
      const r = res.data;
      const owner = r.userId || r.openid || r._openid || "";
      if (owner !== user.openid) {
        wx.showToast({ title: "无权查看该记录", icon: "none" });
        setTimeout(() => wx.navigateBack(), 900);
        return;
      }
      const allRes = await userRecords.getAll();
      const samePlaceRecords = this.getSamePlaceRecords(r, allRes.data || []);
      const allImages = this.getMergedImages(samePlaceRecords);
      const samePlaceCount = samePlaceRecords.length;
      this.setData({
        name: r.name, address: r.address,
        dishName: r.dishName || "",
        price: r.price || "",
        reviewTitle: r.reviewTitle || "",
        rating: r.rating, comment: r.comment || "",
        images: allImages, tags: (r.tags || []).map(tag => TAG_NAME_MAP[tag] || tag),
        time: r.createdAt ? formatDateTime(r.createdAt) : "",
        samePlaceRecords,
        samePlaceCount,
        visitSectionTitle: samePlaceCount > 1 ? "回访记录 · " + samePlaceCount + " 次" : "本次记录",
        visitCountText: samePlaceCount + " visits",
        visitTip: samePlaceCount > 1 ? "同一地点的回访记录已汇总展示" : "本次记录已收录",
        lat: r.location ? r.location.lat : 0,
        lng: r.location ? r.location.lng : 0
      });
    } catch(e) {
      if (e && (e.code === "LOGIN_REQUIRED" || e.message === "LOGIN_REQUIRED")) {
        wx.showToast({ title: "请先到我的页登录", icon: "none" });
        setTimeout(() => wx.switchTab({ url: "/pages/profile/profile" }), 900);
        return;
      }
      // 真机冷启动/网络抖动，最多重试2次
      const retryCount = this._retryCount || 0;
      if (retryCount < 2) {
        this._retryCount = retryCount + 1;
        setTimeout(() => this.loadDetail(), 1000 + retryCount * 1000);
        return;
      }
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },
  getSamePlaceRecords(currentRecord, records) {
    const sourceRecords = (records || []).slice();
    const hasCurrent = sourceRecords.some(item => item && item._id === currentRecord._id);
    if (!hasCurrent) sourceRecords.push(currentRecord);
    const currentAddress = this.normalizeText(currentRecord.address);
    const currentName = this.normalizeText(currentRecord.name);
    const currentCity = this.getRecordCity(currentRecord);
    return sourceRecords
      .filter(item => this.isSamePlace(currentRecord, item, currentAddress, currentName, currentCity))
      .sort((a, b) => this.getRecordTimeValue(a) - this.getRecordTimeValue(b))
      .map((item, index) => this.toVisitRecord(item, index));
  },
  isSamePlace(currentRecord, record, currentAddress, currentName, currentCity) {
    if (!record || !currentRecord) return false;
    if (record._id === currentRecord._id) return true;
    const address = this.normalizeText(record.address);
    if (this.isReliableAddress(currentAddress) && this.isReliableAddress(address)) {
      return currentAddress === address;
    }
    const name = this.normalizeText(record.name);
    const city = this.getRecordCity(record);
    return !!currentName && !!name && currentName === name && !!currentCity && currentCity === city;
  },
  isReliableAddress(address) {
    if (!address) return false;
    return address.indexOf("已选择位置") !== 0;
  },
  getRecordCity(record) {
    const info = recordRegion.inferRecordRegion(record || {});
    return info && info.city ? info.city : "";
  },
  normalizeText(value) {
    return String(value || "").trim();
  },
  getRecordTimeValue(record) {
    const time = record && record.createdAt ? new Date(record.createdAt).getTime() : 0;
    return isFinite(time) ? time : 0;
  },
  toVisitRecord(record, index) {
    return {
      _id: record._id || "",
      name: record.name || "",
      address: record.address || "",
      rating: Number(record.rating) || 0,
      dishName: record.dishName || "",
      price: record.price || "",
      reviewTitle: record.reviewTitle || "",
      comment: record.comment || "",
      tags: (record.tags || []).map(tag => TAG_NAME_MAP[tag] || tag),
      images: record.images || [],
      time: record.createdAt ? formatDateTime(record.createdAt) : "",
      visitIndex: index + 1
    };
  },
  getMergedImages(records) {
    const seen = {};
    const images = [];
    (records || []).forEach(record => {
      (record.images || []).forEach(src => {
        if (!src || seen[src]) return;
        seen[src] = true;
        images.push(src);
      });
    });
    return images;
  },
  handleGoEdit() { wx.navigateTo({ url: "/pages/add-record/add-record?id=" + this.data.id }); },
  handleNavigate() {
    wx.openLocation({
      latitude: parseFloat(this.data.lat),
      longitude: parseFloat(this.data.lng),
      name: this.data.name
    });
  },
  handleDelete() {
    wx.showModal({
      title: "确认删除",
      content: "确定要删除这条记录吗？",
      success: async (res) => {
        if (res.confirm) {
          try {
            const user = await userRecords.getCurrentUser({ interactive: true });
            const detail = await db.collection(COLLECTION.RECORDS).doc(this.data.id).get();
            const r = detail.data || {};
            const owner = r.userId || r.openid || r._openid || "";
            if (owner !== user.openid) {
              wx.showToast({ title: "无权删除", icon: "none" });
              return;
            }
            await db.collection(COLLECTION.RECORDS).doc(this.data.id).remove();
            wx.showToast({ title: "已删除" });
            setTimeout(() => wx.navigateBack(), 1500);
          } catch (e) {
            if (e && (e.code === "LOGIN_REQUIRED" || e.message === "LOGIN_REQUIRED")) {
              wx.showToast({ title: "请先到我的页登录", icon: "none" });
              setTimeout(() => wx.switchTab({ url: "/pages/profile/profile" }), 900);
              return;
            }
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      }
    });
  }
});
