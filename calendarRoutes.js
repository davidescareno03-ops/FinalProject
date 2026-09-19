const express = require("express");
const mongoose = require("mongoose");

const Profile = require("../models/profiles.models");
const Calendar = require("../models/calendar.models");

const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ==================================================
// VALIDATE EVENT INPUT
// ==================================================

const validateEventInput = (body = {}) => {
  const title =
    typeof body.title === "string"
      ? body.title.trim()
      : "";

  const rawTime =
    typeof body.time === "string"
      ? body.time.trim()
      : "";

  // Always store due times as local HH:MM values.
  // This prevents browser/locale formatting from changing
  // the value and also supports older 12-hour values.
  let time = "";

  const twentyFourHourMatch = rawTime.match(
    /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/
  );

  if (twentyFourHourMatch) {
    time = `${twentyFourHourMatch[1]}:${twentyFourHourMatch[2]}`;
  } else {
    const twelveHourMatch = rawTime.match(
      /^(1[0-2]|0?[1-9]):([0-5]\d)\s*([AaPp][Mm])$/
    );

    if (twelveHourMatch) {
      let hours = Number(twelveHourMatch[1]);
      const minutes = twelveHourMatch[2];
      const period = twelveHourMatch[3].toUpperCase();

      if (period === "AM" && hours === 12) {
        hours = 0;
      }

      if (period === "PM" && hours !== 12) {
        hours += 12;
      }

      time = `${String(hours).padStart(2, "0")}:${minutes}`;
    }
  }

  const timeZone =
    typeof body.timeZone === "string"
      ? body.timeZone.trim()
      : "";

  const description =
    typeof body.description === "string"
      ? body.description.trim()
      : "";

  if (!title) {
    return {
      error: "Event title is required.",
    };
  }

  if (title.length > 200) {
    return {
      error: "Event title must be 200 characters or less.",
    };
  }

  if (description.length > 2000) {
    return {
      error: "Event description must be 2000 characters or less.",
    };
  }

  // Due time remains a local HH:MM value and is optional.
  // Do NOT convert this through new Date() or UTC.
  if (time) {
    const minutes = Number(time.split(":")[1]);

    if (![0, 15, 30, 45].includes(minutes)) {
      return {
        error:
          "Due time minutes must be in 15-minute increments (00, 15, 30, or 45).",
      };
    }
  }

  if (rawTime && !time) {
    return {
      error:
        "Due time must be a valid time (for example, 2:30 PM or 14:30).",
    };
  }

  return {
    title,
    time,
    timeZone,
    description,
  };
};

// ==================================================
// VALIDATE DATE
// ==================================================

const validateDate = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  // Use an ISO/UTC date string instead of
  // new Date(year, month - 1, day).
  //
  // JavaScript treats years 0-99 specially when using
  // the numeric Date constructor, which could incorrectly
  // reject otherwise correctly formatted dates.
  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

// ==================================================
// HELPERS
// ==================================================

const getLoggedInUserId = (req) =>
  req.user?._id;

const getRequestedUserId = (req) =>
  req.params.userId;

const isAdmin = (req) =>
  req.user?.admin === true;

const isOwnCalendar = (
  req,
  userId
) =>
  String(getLoggedInUserId(req)) ===
  String(userId);

const hasCalendarAccess = (
  req,
  userId
) =>
  isOwnCalendar(req, userId) ||
  isAdmin(req);

const getCalendarEvents = (
  calendar
) => {
  if (
    !calendar?.events ||
    typeof calendar.events !== "object" ||
    Array.isArray(calendar.events)
  ) {
    return {};
  }

  return calendar.events;
};

const findCalendar = async (
  userId
) =>
  Calendar.findOne({
    userId,
  });

/*
 * Find the user's calendar or create it safely if it does not exist.
 *
 * Using an upsert prevents a race condition where two requests
 * could both see that a calendar does not exist and then both
 * attempt to create one.
 */
const findOrCreateCalendar =
  async (userId) =>
    Calendar.findOneAndUpdate(
      {
        userId,
      },
      {
        $setOnInsert: {
          userId,
          events: {},
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

const generateEventId = () =>
  `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

const findEvent = (
  events,
  date,
  eventId
) => {
  const dayEvents = Array.isArray(
    events[date]
  )
    ? events[date]
    : [];

  const eventIndex =
    dayEvents.findIndex(
      (calendarEvent) =>
        String(calendarEvent?.id) ===
        String(eventId)
    );

  return {
    dayEvents,
    eventIndex,
  };
};

const validateUserId = (
  userId
) =>
  Boolean(userId) &&
  mongoose.isValidObjectId(userId);

// ==================================================
// GET CURRENT USER CALENDAR
// ==================================================

router.get(
  "/me",
  authenticateToken,
  async (req, res) => {
    try {
      const calendar =
        await findCalendar(
          getLoggedInUserId(req)
        );

      return res.json({
        events:
          getCalendarEvents(
            calendar
          ),
      });
    } catch (error) {
      console.error(
        "GET /calendar/me error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to load calendar.",
      });
    }
  }
);

// ==================================================
// GET SPECIFIC USER CALENDAR
// ADMIN ONLY
// ==================================================

router.get(
  "/:userId",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const userId =
        getRequestedUserId(req);

      if (
        !validateUserId(userId)
      ) {
        return res.status(400).json({
          message:
            "Invalid user ID.",
        });
      }

      const user =
        await Profile.findById(
          userId
        )
          .select("_id")
          .lean();

      if (!user) {
        return res.status(404).json({
          message:
            "User could not be found.",
        });
      }

      const calendar =
        await findCalendar(
          userId
        );

      return res.json({
        events:
          getCalendarEvents(
            calendar
          ),
      });
    } catch (error) {
      console.error(
        "GET /calendar/:userId error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to load calendar.",
      });
    }
  }
);

// ==================================================
// CREATE EVENT
// ==================================================

router.post(
  "/:userId/events",
  authenticateToken,
  async (req, res) => {
    try {
      const requestedUserId =
        getRequestedUserId(req);

      if (
        !validateUserId(
          requestedUserId
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid user ID.",
        });
      }

      if (
        !hasCalendarAccess(
          req,
          requestedUserId
        )
      ) {
        return res.status(403).json({
          message:
            "You do not have permission to modify this calendar.",
        });
      }

      const validation =
        validateEventInput(
          req.body
        );

      if (validation.error) {
        return res.status(400).json({
          message:
            validation.error,
        });
      }

      const date =
        typeof req.body.date === "string"
          ? req.body.date.trim()
          : "";

      if (!validateDate(date)) {
        return res.status(400).json({
          message:
            "Event date must be a valid date in YYYY-MM-DD format.",
        });
      }

      const user =
        await Profile.findById(
          requestedUserId
        )
          .select("_id")
          .lean();

      if (!user) {
        return res.status(404).json({
          message:
            "User could not be found.",
        });
      }

      const calendar =
        await findOrCreateCalendar(
          requestedUserId
        );

      const events = {
        ...getCalendarEvents(
          calendar
        ),
      };

      const dayEvents =
        Array.isArray(
          events[date]
        )
          ? [...events[date]]
          : [];

      const ownCalendar =
        isOwnCalendar(
          req,
          requestedUserId
        );

      const newEvent = {
        id: generateEventId(),

        title:
          validation.title,

        // Store the exact HH:MM value
        // entered by the user.
        time:
          validation.time,

        timeZone:
          validation.timeZone,

        description:
          validation.description,

        createdBy:
          String(
            getLoggedInUserId(req)
          ),

        adminAssigned:
          !ownCalendar &&
          isAdmin(req),

        adminModified: false,
      };

      dayEvents.push(
        newEvent
      );

      events[date] =
        dayEvents;

      calendar.events =
        events;

      calendar.markModified(
        "events"
      );

      await calendar.save();

      return res.status(201).json({
        message:
          "Event created successfully.",

        events:
          getCalendarEvents(
            calendar
          ),

        event:
          newEvent,
      });
    } catch (error) {
      console.error(
        "POST /calendar/:userId/events error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to create event.",
      });
    }
  }
);

// ==================================================
// UPDATE EVENT
// ==================================================

router.put(
  "/:userId/events/:eventId",
  authenticateToken,
  async (req, res) => {
    try {
      const requestedUserId =
        getRequestedUserId(req);

      const eventId =
        req.params.eventId;

      if (
        !validateUserId(
          requestedUserId
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid user ID.",
        });
      }

      if (
        !hasCalendarAccess(
          req,
          requestedUserId
        )
      ) {
        return res.status(403).json({
          message:
            "You do not have permission to modify this calendar.",
        });
      }

      const validation =
        validateEventInput(
          req.body
        );

      if (validation.error) {
        return res.status(400).json({
          message:
            validation.error,
        });
      }

      const date =
        typeof req.body.date === "string"
          ? req.body.date.trim()
          : "";

      if (!validateDate(date)) {
        return res.status(400).json({
          message:
            "Event date must be a valid date in YYYY-MM-DD format.",
        });
      }

      const user =
        await Profile.findById(
          requestedUserId
        )
          .select("_id")
          .lean();

      if (!user) {
        return res.status(404).json({
          message:
            "User could not be found.",
        });
      }

      const calendar =
        await findCalendar(
          requestedUserId
        );

      if (!calendar) {
        return res.status(404).json({
          message:
            "Calendar could not be found.",
        });
      }

      const events = {
        ...getCalendarEvents(
          calendar
        ),
      };

      const {
        dayEvents,
        eventIndex,
      } = findEvent(
        events,
        date,
        eventId
      );

      if (
        eventIndex === -1
      ) {
        return res.status(404).json({
          message:
            "Event could not be found.",
        });
      }

      const existingEvent =
        dayEvents[eventIndex];

      const ownCalendar =
        isOwnCalendar(
          req,
          requestedUserId
        );

      if (
        ownCalendar &&
        !isAdmin(req) &&
        (
          existingEvent.adminAssigned ===
            true ||
          existingEvent.adminModified ===
            true
        )
      ) {
        return res.status(403).json({
          message:
            "You cannot edit an event assigned or modified by an administrator.",
        });
      }

      const wasModifiedByAdmin =
        isAdmin(req) &&
        !ownCalendar;

      const updatedEvent = {
        ...existingEvent,

        title:
          validation.title,

        // Replace the old time with
        // the exact new HH:MM value.
        time:
          validation.time,

        timeZone:
          validation.timeZone,

        description:
          validation.description,

        adminModified:
          existingEvent.adminModified ===
            true ||
          wasModifiedByAdmin,
      };

      dayEvents[eventIndex] =
        updatedEvent;

      events[date] =
        dayEvents;

      calendar.events =
        events;

      calendar.markModified(
        "events"
      );

      await calendar.save();

      return res.json({
        message:
          "Event updated successfully.",

        events:
          getCalendarEvents(
            calendar
          ),

        event:
          updatedEvent,
      });
    } catch (error) {
      console.error(
        "PUT /calendar/:userId/events/:eventId error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to update event.",
      });
    }
  }
);

// ==================================================
// DELETE EVENT
// ==================================================

router.delete(
  "/:userId/events/:eventId",
  authenticateToken,
  async (req, res) => {
    try {
      const requestedUserId =
        getRequestedUserId(req);

      const eventId =
        req.params.eventId;

      if (
        !validateUserId(
          requestedUserId
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid user ID.",
        });
      }

      if (
        !hasCalendarAccess(
          req,
          requestedUserId
        )
      ) {
        return res.status(403).json({
          message:
            "You do not have permission to modify this calendar.",
        });
      }

      const date =
        typeof req.body?.date === "string"
          ? req.body.date.trim()
          : "";

      if (!validateDate(date)) {
        return res.status(400).json({
          message:
            "Event date must be a valid date in YYYY-MM-DD format.",
        });
      }

      const user =
        await Profile.findById(
          requestedUserId
        )
          .select("_id")
          .lean();

      if (!user) {
        return res.status(404).json({
          message:
            "User could not be found.",
        });
      }

      const calendar =
        await findCalendar(
          requestedUserId
        );

      if (!calendar) {
        return res.status(404).json({
          message:
            "Calendar could not be found.",
        });
      }

      const events = {
        ...getCalendarEvents(
          calendar
        ),
      };

      const {
        dayEvents,
        eventIndex,
      } = findEvent(
        events,
        date,
        eventId
      );

      if (
        eventIndex === -1
      ) {
        return res.status(404).json({
          message:
            "Event could not be found.",
        });
      }

      // The calendar owner can delete any event on their
      // own calendar, including events assigned or modified
      // by an administrator. Administrators can delete
      // events from any user's calendar.
      dayEvents.splice(
        eventIndex,
        1
      );

      if (
        dayEvents.length === 0
      ) {
        delete events[date];
      } else {
        events[date] =
          dayEvents;
      }

      calendar.events =
        events;

      calendar.markModified(
        "events"
      );

      await calendar.save();

      return res.json({
        message:
          "Event deleted successfully.",

        events:
          getCalendarEvents(
            calendar
          ),
      });
    } catch (error) {
      console.error(
        "DELETE /calendar/:userId/events/:eventId error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to delete event.",
      });
    }
  }
);

module.exports = router;