// record-card 组件 — 列表与地图中的美食记录卡片
Component({
  properties: {
    name:        { type: String, value: "" },
    rating:      { type: Number, value: 0 },
    city:        { type: String, value: "" },
    address:     { type: String, value: "" },
    photo:       { type: String, value: "" },
    recordId:    { type: String, value: "" },
    dishName:    { type: String, value: "" },
    price:       { type: String, value: "" },
    reviewTitle: { type: String, value: "" },
    visitText:   { type: String, value: "" },
    visitCount:  { type: Number, value: 0 }
  },

  methods: {
    handleTap() {
      this.triggerEvent("tap", { id: this.properties.recordId });
    }
  }
});
