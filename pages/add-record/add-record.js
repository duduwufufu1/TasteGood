const { COLLECTION, TAGS } = require("../../utils/constants");
const recordRegion = require("../../utils/record-region");
const userRecords = require("../../utils/user-records");
const db = wx.cloud.database();
const TENCENT_MAP_KEY = "IWHBZ-24MCH-MEADA-WHWGG-4UH2T-FCBZI";
const TAG_NAME_MAP = {};
TAGS.forEach(tag => { TAG_NAME_MAP[tag.key] = tag.name; });

Page({
  data: {
    id: "",
    isEdit: false,
    pickLat: 39.9042, pickLng: 116.4074, pickScale: 12,
    pickMarkers: [],
    address: "", name: "", rating: 0,
    customTag: "",
    selectedTags: [], comment: "", photos: [],
    submitting: false,
    province: "", city: "",
    TAGS,
    displayTags: TAGS.map(tag => Object.assign({}, tag, { active: false }))
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ id: options.id, isEdit: true });
      this.loadRecord();
      return;
    }
    this.initDefaultLocation();
  },

  initDefaultLocation() {
    const latitude = this.data.pickLat;
    const longitude = this.data.pickLng;
    this.setData({
      pickMarkers: [{ id: 0, latitude, longitude, iconPath: "/images/marker-pick.png", width: 44, height: 52 }]
    });
    this.determineRegion(latitude, longitude);
  },

  async loadRecord() {
    try {
      const user = await userRecords.getCurrentUser({ interactive: true });
      const res = await db.collection(COLLECTION.RECORDS).doc(this.data.id).get();
      const record = res.data || {};
      const owner = record.userId || record.openid || record._openid || "";
      if (owner !== user.openid) {
        wx.showToast({ title: "无权编辑该记录", icon: "none" });
        setTimeout(() => wx.navigateBack(), 900);
        return;
      }
      const location = record.location || { lat: this.data.pickLat, lng: this.data.pickLng };
      const lat = Number(location.lat || location.latitude || this.data.pickLat);
      const lng = Number(location.lng || location.longitude || this.data.pickLng);
      const info = recordRegion.inferRecordRegion(record);
      this.setData({
        name: record.name || "",
        address: record.address || "",
        rating: Number(record.rating) || 0,
        comment: record.comment || "",
        selectedTags: record.tags || [],
        photos: record.images || [],
        province: record.province || info.province,
        city: record.city || info.city,
        pickLat: lat,
        pickLng: lng,
        pickMarkers: [{ id: 0, latitude: lat, longitude: lng, iconPath: "/images/marker-pick.png", width: 44, height: 52 }]
      });
      this.refreshDisplayTags();
    } catch (e) {
      console.error(e);
      if (e && (e.code === "LOGIN_REQUIRED" || e.message === "LOGIN_REQUIRED")) {
        wx.showToast({ title: "请先到我的页登录", icon: "none" });
        setTimeout(() => wx.switchTab({ url: "/pages/profile/profile" }), 900);
        return;
      }
      wx.showToast({ title: "记录加载失败", icon: "none" });
      this.initDefaultLocation();
    }
  },

  // 从 REGIONS 数据确定省份和城市
  determineRegion(lat, lng) {
    const nearest = recordRegion.nearestRegion(lat, lng);
    this.setData({
      province: nearest ? nearest.province : "",
      city: nearest ? nearest.city : ""
    });
  },

  applyRegionFromText(text) {
    const value = String(text || "");
    if (!value) return false;
    const province = recordRegion.normalizeProvinceNameFromAddressStart(value);
    const city = recordRegion.normalizeCityNameFromAddressStart(value, province || this.data.province);
    const data = {};
    if (province) data.province = province;
    if (city) data.city = city;
    if (!data.province && city) {
      const cityInfo = recordRegion.getCityEntry(city);
      if (cityInfo) data.province = cityInfo.province;
    }
    if (!data.province && !data.city) return false;
    this.setData(data);
    return !!data.city;
  },

  reverseGeocode(lat, lng) {
    if (!TENCENT_MAP_KEY) return;
    wx.request({
      url: "https://apis.map.qq.com/ws/geocoder/v1/",
      data: { location: lat + "," + lng, key: TENCENT_MAP_KEY },
      success: (res) => {
        if (res.data && res.data.result) {
          const addr = res.data.result;
          this.setData({
            address: addr.address,
            province: addr.address_component ? recordRegion.normalizeProvinceName(addr.address_component.province) : this.data.province,
            city: addr.address_component ? recordRegion.normalizeCityName(addr.address_component.city) : this.data.city
          });
        }
      }
    });
  },

  onMapTap(e) {
    const { latitude, longitude } = e.detail;
    this.setData({
      pickLat: latitude, pickLng: longitude,
      address: "已选择位置 " + latitude.toFixed(4) + ", " + longitude.toFixed(4),
      pickMarkers: [{ id: 0, latitude, longitude, iconPath: "/images/marker-pick.png", width: 44, height: 52 }]
    });
    wx.showToast({ title: "位置已选定", icon: "none" });
    this.determineRegion(latitude, longitude);
    this.reverseGeocode(latitude, longitude);
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onCommentInput(e) { this.setData({ comment: e.detail.value }); },
  onCustomTagInput(e) { this.setData({ customTag: e.detail.value }); },
 onRatingChange(e) { this.setData({ rating: e.detail.rating }); },

  searchLocation() {
    wx.chooseLocation({
      latitude: this.data.pickLat,
      longitude: this.data.pickLng,
      success: (res) => {
        const latitude = Number(res.latitude);
        const longitude = Number(res.longitude);
        if (!isFinite(latitude) || !isFinite(longitude)) return;
        this.setData({
          pickLat: latitude,
          pickLng: longitude,
          pickScale: 15,
          name: this.data.name || res.name || "",
          address: res.address || res.name || ("已选择位置 " + latitude.toFixed(4) + ", " + longitude.toFixed(4)),
          pickMarkers: [{ id: 0, latitude, longitude, iconPath: "/images/marker-pick.png", width: 44, height: 52 }]
        });
        if (!this.applyRegionFromText(res.address || "")) {
          this.determineRegion(latitude, longitude);
        }
      },
      fail: (err) => {
        console.warn(err);
        wx.showToast({ title: "未选择位置", icon: "none" });
      }
    });
  },

  toggleTag(e) {
    const key = e.currentTarget.dataset.key;
    let sel = this.data.selectedTags;
    sel = sel.indexOf(key) !== -1 ? sel.filter(t => t !== key) : [...sel, key];
    this.setData({ selectedTags: sel }, () => this.refreshDisplayTags());
  },

  addCustomTag() {
    const tag = this.data.customTag.trim().replace(/^#/, "");
    if (!tag) { wx.showToast({ title: "请输入标签", icon: "none" }); return; }
    if (tag.length > 8) { wx.showToast({ title: "标签最多8个字", icon: "none" }); return; }
    if (this.data.selectedTags.includes(tag)) {
      this.setData({ customTag: "" });
      return;
    }
    this.setData({
      selectedTags: [...this.data.selectedTags, tag],
      customTag: ""
    }, () => this.refreshDisplayTags());
  },

  refreshDisplayTags() {
    const selectedMap = {};
    this.data.selectedTags.forEach(tag => { selectedMap[tag] = true; });
    const customTags = this.data.selectedTags
      .filter(tag => !TAG_NAME_MAP[tag])
      .map(tag => ({ key: tag, name: tag }));
    const displayTags = TAGS.concat(customTags).map(tag => {
      return Object.assign({}, tag, { active: !!selectedMap[tag.key] });
    });
    this.setData({ displayTags });
  },

  addPhoto() {
    wx.chooseImage({
      count: 9 - this.data.photos.length,
      sizeType: ["compressed"],
      sourceType: ["camera", "album"],
      success: (res) => {
        this.setData({ photos: [...this.data.photos, ...res.tempFilePaths].slice(0,9) });
      }
    });
  },

  removePhoto(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ photos: this.data.photos.filter((_, i) => i !== idx) });
  },

  async submit() {
    const { id, isEdit, name, rating, comment, selectedTags, photos, pickLat, pickLng, address, province, city } = this.data;
    if (!name) { wx.showToast({ title: "请输入店铺名称", icon: "none" }); return; }
    if (rating === 0) { wx.showToast({ title: "请评分", icon: "none" }); return; }

    this.setData({ submitting: true });

    try {
      const user = await userRecords.getCurrentUser({ interactive: true });
      let imgs = [];
      for (const photo of photos) {
        if (photo.indexOf("cloud://") === 0 || photo.indexOf("http://") === 0 || photo.indexOf("https://") === 0) {
          imgs.push(photo);
          continue;
        }
        const ext = photo.match(/\.(\w+)$/)?.[1] || "jpg";
        const cloudPath = "records/" + Date.now() + "_" + Math.random().toString(36).slice(2) + "." + ext;
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: photo });
        imgs.push(up.fileID);
      }

      const regionInfo = recordRegion.inferRecordRegion({
        address,
        province,
        city,
        location: { lat: pickLat, lng: pickLng }
      });

      const data = {
        name, address,
        province: regionInfo.province,
        city: regionInfo.city,
        location: { lat: pickLat, lng: pickLng },
        rating, comment, images: imgs, tags: selectedTags,
        updatedAt: new Date()
      };

      if (isEdit && id) {
        await db.collection(COLLECTION.RECORDS).doc(id).update({ data: userRecords.withOwner(data, user) });
      } else {
        await db.collection(COLLECTION.RECORDS).add({
          data: userRecords.withOwner(Object.assign({}, data, { createdAt: new Date() }), user)
        });
      }

      wx.showToast({ title: isEdit ? "修改成功" : "保存成功" });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch(e) {
      console.error(e);
      if (e && (e.code === "LOGIN_REQUIRED" || e.message === "LOGIN_REQUIRED")) {
        wx.showToast({ title: "请先到我的页登录", icon: "none" });
        setTimeout(() => wx.switchTab({ url: "/pages/profile/profile" }), 900);
        return;
      }
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
