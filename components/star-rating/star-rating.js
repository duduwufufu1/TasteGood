Component({
  properties: {
    rating: { type: Number, value: 0 },
    size: { type: String, value: "d" }
  },

  data: {
    stars: [1, 2, 3, 4, 5]
  },

  methods: {
    handleTap(e) {
      const rating = Number(e.currentTarget.dataset.rating);
      this.triggerEvent("change", { rating });
    }
  }
});
