import { Router } from 'express';
import {
  createMeeting,
  getMyMeetings,
  getMeetingById,
  acceptMeeting,
  rejectMeeting,
  cancelMeeting,
} from '../controllers/meetingController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect); // every meeting route requires auth

/**
 * @swagger
 * /meetings:
 *   post:
 *     summary: Propose a meeting with another user
 *     tags: [Meetings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participantId, title, startTime, endTime]
 *             properties:
 *               participantId: { type: string }
 *               title: { type: string }
 *               notes: { type: string }
 *               startTime: { type: string, format: date-time }
 *               endTime: { type: string, format: date-time }
 *     responses:
 *       201: { description: Returns the created meeting }
 *       409: { description: Time slot conflicts with an existing meeting }
 *   get:
 *     summary: List meetings where you're the organizer or participant
 *     tags: [Meetings]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, accepted, rejected, cancelled] }
 *     responses:
 *       200: { description: "Returns the list of meetings" }
 */
router.post('/', createMeeting);
router.get('/', getMyMeetings);

/**
 * @swagger
 * /meetings/{id}:
 *   get:
 *     summary: Get a single meeting (must be organizer or participant)
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "Returns the meeting" }
 */
router.get('/:id', getMeetingById);

/**
 * @swagger
 * /meetings/{id}/accept:
 *   patch:
 *     summary: Accept a pending meeting (participant only)
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Returns the updated meeting }
 */
router.patch('/:id/accept', acceptMeeting);

/**
 * @swagger
 * /meetings/{id}/reject:
 *   patch:
 *     summary: Reject a pending meeting (participant only)
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Returns the updated meeting }
 */
router.patch('/:id/reject', rejectMeeting);

/**
 * @swagger
 * /meetings/{id}/cancel:
 *   patch:
 *     summary: Cancel a meeting (either party)
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Returns the updated meeting }
 */
router.patch('/:id/cancel', cancelMeeting);

export default router;
