require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Profile = require(
  "./models/profiles.models"
);

const username = (
  process.env.ADMIN_USERNAME ||
  "admin"
)
  .trim()
  .toLowerCase();

const email = (
  process.env.ADMIN_EMAIL ||
  "admin@calendar.local"
)
  .trim()
  .toLowerCase();

const name = (
  process.env.ADMIN_NAME ||
  "Administrator"
).trim();

const password =
  process.env.ADMIN_PASSWORD;


// --------------------------------------------------
// VALIDATE ENVIRONMENT
// --------------------------------------------------

if (!process.env.MONGO_URI) {
  throw new Error(
    "MONGO_URI is not configured."
  );
}

if (!password) {
  throw new Error(
    "ADMIN_PASSWORD is not configured."
  );
}

if (password.length < 8) {
  throw new Error(
    "ADMIN_PASSWORD must be at least 8 characters."
  );
}


// --------------------------------------------------
// CREATE / UPDATE ADMIN
// --------------------------------------------------

const createAdmin = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI
    );

    const existingByUsername =
      await Profile.findOne({
        username,
      });

    const existingByEmail =
      await Profile.findOne({
        email,
      });

    if (
      existingByEmail &&
      (!existingByUsername ||
        existingByEmail._id.toString() !==
          existingByUsername._id.toString())
    ) {
      throw new Error(
        `The admin email ${email} is already assigned to another account.`
      );
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        12
      );

    const profile =
      await Profile.findOneAndUpdate(
        { username },
        {
          name,
          email,
          username,
          password: hashedPassword,
          admin: true,
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

    console.log(
      "Admin account is ready."
    );

    console.log(
      `Username: ${profile.username}`
    );

    console.log(
      `Email: ${profile.email}`
    );

    console.log(
      `Admin: ${profile.admin}`
    );
  } catch (error) {
    console.error(
      "Unable to create admin account:",
      error.message
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();