const db = wx.cloud.database();
const app = getApp();
const region = require("../../utils/record-region");
const userRecords = require("../../utils/user-records");

Page({
  data: { cities: [], totalRecords: 0, tastedCities: 0 },
  onShow() { this.loadCities(); },
  async loadCities() {
    try {
      const res = await userRecords.getAll();
      const records = res.data || [];
      const cityMap = {};
      for (const r of records) {
        const info = region.inferRecordRegion(r);
        const city = info.city;
        if (!city || city === region.UNKNOWN_CITY) continue;
        if (!cityMap[city]) {
          cityMap[city] = {
            city,
            count: 0,
            lat: info.center.lat,
            lng: info.center.lng,
            photos: []
          };
        }
        cityMap[city].count++;
        if (cityMap[city].photos.length < 3 && r.images && r.images[0]) {
          const photo = r.images[0];
          if (!cityMap[city].photos.includes(photo)) {
            cityMap[city].photos.push(photo);
          }
        }
      }
      // 将云文件 ID 下载为本地临时路径，供 image 组件显示
      const entries = Object.values(cityMap);
      await Promise.all(entries.map(async (city) => {
        if (city.photos.length > 0) {
          const downloadRes = await Promise.all(
            city.photos.map((fileID) => wx.cloud.downloadFile({ fileID }))
          );
          city.photos = downloadRes.map((r) => r.tempFilePath);
        }
      }));
      const cities = Object.values(cityMap).sort((a,b) => b.count - a.count);
      this.setData({
        cities,
        totalRecords: records.length,
        tastedCities: cities.length
      });
    } catch(e) { console.error(e); }
  },
  handleGoToCity(e) {
    const { city, lat, lng } = e.currentTarget.dataset;
    app.globalData.selectCity = city;
    app.globalData.selectCenter = { lat: Number(lat), lng: Number(lng) };
    wx.navigateTo({ url: "/pages/index/index" });
  },
  handleGoAddRecord() { wx.navigateTo({ url: "/pages/add-record/add-record" }); }
});
