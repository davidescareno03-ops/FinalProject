const mongoose = require("mongoose");

const profileSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      password: {
        type: String,
        required: true,
        select: false,
      },

      admin: {
        type: Boolean,
        default: false,
      },
    },

    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Profile",
    profileSchema
  );