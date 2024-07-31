import express from "express";
import cors from "cors";
// To perform CRUD ops on cookies, only server can deal with secure cookies
import cookieParser from "cookie-parser";

const app = express();
const LIMIT = "20kb";

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// No need to use body parser at this stage
app.use(
  express.json({
    limit: LIMIT,
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: LIMIT,
  })
);

// We have already made the public folder
app.use(express.static("public"));

app.use(cookieParser());

export default app;

// export {app}
