import mongoose, { Document, Schema, Types } from 'mongoose';

export type MeetingStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface IMeeting extends Document {
  organizer: Types.ObjectId;   // the user who proposed the meeting
  participant: Types.ObjectId; // the other party
  title: string;
  notes?: string;
  startTime: Date;
  endTime: Date;
  status: MeetingStatus;
  roomId: string; // used later to join the WebRTC video call room
  createdAt: Date;
}

const meetingSchema = new Schema<IMeeting>(
  {
    organizer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participant: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
    },
    roomId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// Speeds up conflict-detection queries and "my meetings" lookups
meetingSchema.index({ organizer: 1, startTime: 1 });
meetingSchema.index({ participant: 1, startTime: 1 });

meetingSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Meeting = mongoose.model<IMeeting>('Meeting', meetingSchema);
