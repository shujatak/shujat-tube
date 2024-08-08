import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandlers.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  // Req has access to cookies due to cookie-parse
  // But the user maybe sending a custom header, so the token may not be there
  // Authorization header comes often
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthroized request");
    }

    // Sometimes jwt needs await aswell. Check
    const decodedTokenInformation = await jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );

    //._id is coming from User mode where in generateAccessToken we named it _id
    const user = await User.findById(decodedTokenInformation?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Cannot find user to logout");
  }
});
