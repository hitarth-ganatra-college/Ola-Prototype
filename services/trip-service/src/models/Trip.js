import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    trip_id: { type: String, required: true, unique: true, index: true },
    ride_id: { type: String, required: true },
    driver_id: { type: String, required: true },
    rider_id: { type: String },
    status: {
      type: String,
      enum: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "SYNCING"],
      default: "ACCEPTED",
    },
    accepted_at: Date,
    completed_at: Date,
    fare: Number,
    distance_km: Number,
  },
  { timestamps: true }
);

export const Trip = mongoose.model("Trip", tripSchema);
