const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config();

const profileRoutes =
  require("./routes/profileRoutes");

const calendarRoutes =
  require("./routes/calendarRoutes");

const app = express();


// --------------------------------------------------
// ENVIRONMENT
// --------------------------------------------------

const requiredEnvironmentVariables = [
  "MONGO_URI",
  "JWT_SECRET",
];

for (
  const variable
  of requiredEnvironmentVariables
) {
  if (!process.env[variable]) {
    console.error(
      `${variable} is not configured.`
    );

    process.exit(1);
  }
}


// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      "http://localhost:5173",

    credentials: true,
  })
);

app.use(
  express.json({
    limit: "100kb",
  })
);


// --------------------------------------------------
// TEST
// --------------------------------------------------

app.get(
  "/api/test",
  (req, res) => {
    res.status(200).json({
      message:
        "Hello from the MERN Backend!",
    });
  }
);


// --------------------------------------------------
// ROUTES
// --------------------------------------------------

app.use(
  "/api/profiles",
  profileRoutes
);

app.use(
  "/api/calendar",
  calendarRoutes
);


// --------------------------------------------------
// 404
// --------------------------------------------------

app.use(
  (req, res) => {
    res.status(404).json({
      message:
        "Route not found.",
    });
  }
);


// --------------------------------------------------
// ERROR
// --------------------------------------------------

app.use(
  (err, req, res, next) => {
    console.error(err);

    res.status(500).json({
      message:
        "Internal server error.",
    });
  }
);


// --------------------------------------------------
// DATABASE / SERVER
// --------------------------------------------------

const PORT =
  process.env.PORT || 5000;

const startServer =
  async () => {
    try {
      await mongoose.connect(
        process.env.MONGO_URI
      );

      console.log(
        "MongoDB Database Connected Successfully"
      );

      app.listen(
        PORT,
        () => {
          console.log(
            `Server running on port ${PORT}`
          );
        }
      );

    } catch (error) {
      console.error(
        "MongoDB connection failed:",
        error.message
      );

      process.exit(1);
    }
  };

startServer();