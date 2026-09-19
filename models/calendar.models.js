const mongoose = require("mongoose");

const calendarSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
      unique: true,
      index: true,
    },

    events: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Calendar",
  calendarSchema
);