import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.cloudname,
  api_key: process.env.cloud_API_KEY,
  api_secret: process.env.cloud_API_SECRET,
});

export default cloudinary;
