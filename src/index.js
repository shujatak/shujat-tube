// require("dotenv").config();
import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});
import app from "./app.js";

import connectDB from "./db/index.js";

connectDB()
  .then(() => {
    app.on("error", (error) => {
      console.log("ERROR in express:", error);
      throw error;
    });
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running at the port: ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.log(`MONGODB connection failed!!! ${error}`);
  });

// Approach 1: Connecting db in index.js
/*
import mongoose from "mongoose";
import { DB_NAME } from "./constants";
(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    // This is part of express
    app.on("error", (error) => {
      console.log("ERROR: ", error);
      throw error;
    });

    app.listen(process.env.PORT, () => {
      console.log(`App is listening on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.error("ERROR: ", error);
    throw error;
  }
})();
*/
