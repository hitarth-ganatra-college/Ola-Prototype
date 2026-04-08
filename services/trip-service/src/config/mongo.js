import mongoose from "mongoose";

export async function connectMongo() {
  const uri = process.env.MONGO_URI || "mongodb://root:rootpass@localhost:27017/velocity?authSource=admin";
  await mongoose.connect(uri);
  console.log("[Mongo] Connected");
}
