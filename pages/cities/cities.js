const db = wx.cloud.database();
const app = getApp();
const region = require("../../utils/record-region");
const userRecords = require("../../utils/user-records");

Page({
  data: { cities: [] },
  onShow() { this.loadCities(); },
  async loadCities() {
    try {
      const res = await userRecords.getAll();
      const records = res.data || [];
      const cityMap = {};
      records.forEach(r => {
        const info = region.inferRecordRegion(r);
        const city = info.city;
        if (!city || city === region.UNKNOWN_CITY) return;
        if (!cityMap[city]) {
          cityMap[city] = {
            city,
            count: 0,
            lat: info.center.lat,
            lng: info.center.lng
          };
        }
        cityMap[city].count++;
      });
      this.setData({ cities: Object.values(cityMap).sort((a,b) => b.count - a.count) });
    } catch(e) { console.error(e); }
  },
  handleGoToCity(e) {
    const { city, lat, lng } = e.currentTarget.dataset;
    app.globalData.selectCity = city;
    app.globalData.selectCenter = { lat: Number(lat), lng: Number(lng) };
    wx.switchTab({ url: "/pages/index/index" });
  },
  handleGoAddRecord() { wx.navigateTo({ url: "/pages/add-record/add-record" }); }
});

