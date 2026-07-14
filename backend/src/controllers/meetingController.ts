import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Meeting } from '../models/Meeting';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Checks whether `userId` already has a meeting overlapping [start, end).
// Overlap rule: existing.start < newEnd AND existing.end > newStart
// Only 'pending' and 'accepted' meetings count as real bookings - a
// rejected or cancelled meeting frees up the slot.
const hasConflict = async (
  userId: string,
  start: Date,
  end: Date,
  excludeMeetingId?: string
): Promise<boolean> => {
  const query: Record<string, unknown> = {
    $or: [{ organizer: userId }, { participant: userId }],
    status: { $in: ['pending', 'accepted'] },
    startTime: { $lt: end },
    endTime: { $gt: start },
  };
  if (excludeMeetingId) {
    query._id = { $ne: excludeMeetingId };
  }
  const conflict = await Meeting.findOne(query);
  return !!conflict;
};

// POST /api/meetings
export const createMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { participantId, title, notes, startTime, endTime } = req.body;

    if (!participantId || !title || !startTime || !endTime) {
      throw new AppError('participantId, title, startTime and endTime are required', 400);
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('startTime/endTime must be valid dates', 400);
    }
    if (end <= start) {
      throw new AppError('endTime must be after startTime', 400);
    }
    if (start < new Date()) {
      throw new AppError('Cannot schedule a meeting in the past', 400);
    }

    const participant = await User.findById(participantId);
    if (!participant) throw new AppError('Participant not found', 404);
    if (participantId === req.userId) {
      throw new AppError('You cannot schedule a meeting with yourself', 400);
    }

    // Check both parties' calendars - prevents double-booking either side
    const [organizerConflict, participantConflict] = await Promise.all([
      hasConflict(req.userId!, start, end),
      hasConflict(participantId, start, end),
    ]);

    if (organizerConflict) {
      throw new AppError('You already have a meeting during this time slot', 409);
    }
    if (participantConflict) {
      throw new AppError('The participant already has a meeting during this time slot', 409);
    }

    const meeting = await Meeting.create({
      organizer: req.userId,
      participant: participantId,
      title,
      notes,
      startTime: start,
      endTime: end,
      status: 'pending',
      roomId: crypto.randomUUID(),
    });

    const populated = await meeting.populate([
      { path: 'organizer', select: 'name avatarUrl role' },
      { path: 'participant', select: 'name avatarUrl role' },
    ]);

    res.status(201).json({ meeting: populated });
  } catch (err) {
    next(err);
  }
};

// GET /api/meetings  - all meetings where the current user is organizer or participant
export const getMyMeetings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {
      $or: [{ organizer: req.userId }, { participant: req.userId }],
    };
    if (status) filter.status = status;

    const meetings = await Meeting.find(filter)
      .sort({ startTime: 1 })
      .populate('organizer', 'name avatarUrl role')
      .populate('participant', 'name avatarUrl role');

    res.status(200).json({ meetings });
  } catch (err) {
    next(err);
  }
};

// GET /api/meetings/:id
export const getMeetingById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer', 'name avatarUrl role')
      .populate('participant', 'name avatarUrl role');

    if (!meeting) throw new AppError('Meeting not found', 404);

    const isParty =
      meeting.organizer._id.toString() === req.userId ||
      meeting.participant._id.toString() === req.userId;
    if (!isParty) throw new AppError('Forbidden', 403);

    res.status(200).json({ meeting });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/meetings/:id/accept  - only the invited participant can accept
export const acceptMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) throw new AppError('Meeting not found', 404);
    if (meeting.participant.toString() !== req.userId) {
      throw new AppError('Only the invited participant can accept this meeting', 403);
    }
    if (meeting.status !== 'pending') {
      throw new AppError(`Cannot accept a meeting with status "${meeting.status}"`, 400);
    }

    // Re-check for conflicts at accept time, in case something else got
    // booked in the meantime between invite and accept.
    const conflict = await hasConflict(
      req.userId!,
      meeting.startTime,
      meeting.endTime,
      meeting.id
    );
    if (conflict) {
      throw new AppError('This time slot is no longer available on your calendar', 409);
    }

    meeting.status = 'accepted';
    await meeting.save();

    res.status(200).json({ meeting });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/meetings/:id/reject
export const rejectMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) throw new AppError('Meeting not found', 404);
    if (meeting.participant.toString() !== req.userId) {
      throw new AppError('Only the invited participant can reject this meeting', 403);
    }
    if (meeting.status !== 'pending') {
      throw new AppError(`Cannot reject a meeting with status "${meeting.status}"`, 400);
    }

    meeting.status = 'rejected';
    await meeting.save();

    res.status(200).json({ meeting });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/meetings/:id/cancel  - either party can cancel an accepted/pending meeting
export const cancelMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) throw new AppError('Meeting not found', 404);

    const isParty =
      meeting.organizer.toString() === req.userId ||
      meeting.participant.toString() === req.userId;
    if (!isParty) throw new AppError('Forbidden', 403);

    if (!['pending', 'accepted'].includes(meeting.status)) {
      throw new AppError(`Cannot cancel a meeting with status "${meeting.status}"`, 400);
    }

    meeting.status = 'cancelled';
    await meeting.save();

    res.status(200).json({ meeting });
  } catch (err) {
    next(err);
  }
};
