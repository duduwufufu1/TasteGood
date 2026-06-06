const { CLOUD_ENV } = require("./utils/config");

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: CLOUD_ENV,
        traceUser: true
      });
    }
    this.globalData = {}
  }
});