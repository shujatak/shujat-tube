// require("dotenv").config();

import dotevn from "dotenv";
dotevn.config({
  path: "./env",
});
import express from "express";
const app = express();
import connectDB from "./db/index.js";

connectDB();

// Approach 1: Connecting db in index.js
/*
import mongoose from "mongoose";
import { DB_NAME } from "./constants";*/
/*(async () => {
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
