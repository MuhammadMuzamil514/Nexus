import { Router } from 'express';
import { getProfile, updateProfile, listProfiles } from '../controllers/profileController';
import { protect } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: List profiles, optionally filtered by role
 *     tags: [Profile]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [entrepreneur, investor] }
 *     responses:
 *       200: { description: "Returns the list of users" }
 *   put:
 *     summary: Update your own profile
 *     tags: [Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Any subset of profile fields (bio, startupName, investmentInterests, etc.)
 *     responses:
 *       200: { description: "Returns the user" }
 */
router.get('/', protect, listProfiles);      // GET /api/profile?role=investor
router.put('/', protect, updateProfile);      // PUT /api/profile  (self)

/**
 * @swagger
 * /profile/{id}:
 *   get:
 *     summary: View a public profile by user id
 *     tags: [Profile]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "Returns the user" }
 *       404: { description: User not found }
 */
router.get('/:id', getProfile);               // GET /api/profile/:id  (public)

export default router;
