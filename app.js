App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d9gpzmaue4db74e03',
        traceUser: true
      });
    }
    this.globalData = {}
  }
});