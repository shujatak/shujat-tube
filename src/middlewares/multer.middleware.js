import multer from "multer";

const storage = multer.diskStorage({
  // multer has this file
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname);
  },
});

// export const upload = multer({ storage: storage });
export const upload = multer({ storage });
