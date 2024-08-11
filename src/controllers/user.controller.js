import { asyncHandler } from "../utils/asyncHandlers.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Refactor code to declare options globally due to frequent use
const options = {
  httpOnly: true, // Now cookies are only modifiable from the server only
  secure: true,
};

const generateAccessRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Saving refresh token into db
    user.refreshToken = refreshToken;
    // Mongodb methods kick in and need password, we need to make it false
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access or refresh tokens.",
      error
    );
  }
};

// Controller for registering user
const registerUser = asyncHandler(async (req, res) => {
  // res.status(200).json({
  //   message: "OK",
  // });
  // TODO:
  // Get user details from frontend
  // Validation - not empty
  // Check if user already exists: username , email
  // Check for images, check for avatar
  // Upload them to cloudinary, is avatar uploaded to cloudianry
  // Create user object - create entry in db
  // Remove password and refresh token field from response
  // Check for user creation (created or null response)
  // return response

  const { fullName, email, username, password } = req.body;
  // console.log("Email: ", email);

  // Validation
  if (
    [fullName, email, username, password].some((field) => {
      return field?.trim() === "";
    })
  ) {
    // 400: bad request
    throw new ApiError(400, "All fields are compulsory");
  }

  // Validation -> Check if user already exists
  // User.findOne({ username });
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  // Create object
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // Sending response on success
  // return res.status(201).json({ createdUser });
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

// Controller for login functionality
const loginUser = asyncHandler(async (req, res) => {
  // TODO:
  // req body -> data
  // username or email
  // find the user
  // password check
  // generate access and refresh token
  // Send cookie (secure)
  // Send response

  const { email, username, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({ $or: [{ email }, { username }] });

  if (!user) {
    throw new ApiError(400, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessRefreshTokens(
    user._id
  );

  // console.log(accessToken);
  // console.log(refreshToken);
  // TODO:
  // Sending in cookies
  // Either make another db request or update the object
  // Decide if that operation is expensive

  // const loggedInUser = await User.findById(user._id).select(
  //   "-password -refreshToken"
  // );

  // console.log(user);

  const {
    password: userPassword,
    refreshToken: userRefreshToken,
    ...loggedInUser
  } = user.toObject();

  // console.log(userPassword);
  // console.log(userRefreshToken);
  // console.log(loggedInUser);
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken, // To handle the case if user wants to store tokens in local storage
        },
        "User logged in successfully"
      )
    );
});

// Controller for logout functionalilty
const logoutUser = asyncHandler(async (req, res) => {
  // Todos
  // Remove cookies
  // Clear refresh token
  // req.user came from middleware
  await User.findByIdAndUpdate(
    req.user._id,
    //What to update
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );

  // Clear cookies

  return res
    .status(200)
    .clearCookie("accessToken", options) //From cookie parser
    .clearCookie("refreshCookie", options)
    .json(new ApiResponse(200, {}, "User logged outs"));
});

// Controller to refresh access token
const refreshAccessToken = asyncHandler(async (req, res) => {
  // Lets access refresh token from cookies or body(mobile app)
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.ACCESS_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, newRefreshToken } = await generateAccessRefreshTokens(
      user._id
    );

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            newRefreshToken,
          },
          "Access Token Refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }
});

// Controller to change current password
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // req.user has id because the the user is already logged in. Otherwise changing password is not possible
  const user = await User.findById(req.user?._id);
  // await becuase isPasswordCorrect is an async function
  const isPassCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPassCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false }); // this will trigger the pre-save hook in user model

  return res.status(
    (200).json(new ApiResponse(200, {}, "Password changed successfully"))
  );
});

// Controller to fetch current user
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(200, req.user, "Current user fetched successfully"); // In out auth middleware we injected user into this.user. So, when this middleware runs on request, it injects the whole user in it. Therefore, we have acess to user in req
});

// Controller to update information
const updateAcountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are requried");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
        // email: email,
      },

      // This is so that the info after update could return
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

//Controller to update Avatar
const updateUserAvatar = asyncHandler(async (req, res) => {
  // Got through multer middleware -> req.file
  const avatarLocalPath = req.file?._id; // using .files and not .files

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar to cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  // TODO: Delete old avatar

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

// Controller to update Cover Image
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const CoverImageLocalPath = req.file?._id;

  if (!CoverImageLocalPath) {
    throw new ApiError(400, "Cover image is missing");
  }

  const coverImage = await uploadOnCloudinary(avatarLocalPath);
  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading cover image to cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfie = asyncHandler(async (req, res) => {
  // We will go to the user's profile to get channel profiel
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  // User.find({ username });
  const channel = await User.aggregate([
    {
      $match: {
        username: useername?.toLowerCase(),
      },
    },
    {
      $lookup: {
        // In mongodb it becomes lowercase and plural
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        // In mongodb it becomes lowercase and plural
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $condition: {
            // To send flag to front end
            if: {
              // in can look into both objects and arrays
              $in: [req.user?._id, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
      },
    },
  ]);

  // console.log(channel);

  if (!channel?.length) {
    console.log(404, "Channel does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
  // end method getUserChannelProfie
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
                // For frontend's ease
                {
                  $addFields: {
                    owner: {
                      $first: "$owner",
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAcountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfie,
  getWatchHistory,
};
