import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./Calendar.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const TOKEN_KEY = "profile_auth_token";

const getAuthConfig = () => {
  const token = localStorage.getItem(TOKEN_KEY);

  return token
    ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    : {};
};

const getDateKey = (date) => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (dateKey) => {
  if (!dateKey) return "";

  const [
    year,
    month,
    day,
  ] = dateKey.split("-");

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return date.toLocaleDateString(
    undefined,
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  );
};

const normalizeTime = (time) => {
  if (time === null || time === undefined) return "";

  const value = String(time).trim();

  if (!value) return "";

  const twentyFourHourMatch = value.match(
    /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/
  );

  if (twentyFourHourMatch) {
    return `${twentyFourHourMatch[1]}:${twentyFourHourMatch[2]}`;
  }

  const twelveHourMatch = value.match(
    /^(1[0-2]|0?[1-9]):([0-5]\d)\s*([AaPp][Mm])$/
  );

  if (twelveHourMatch) {
    let hours = Number(
      twelveHourMatch[1]
    );

    const minutes =
      twelveHourMatch[2];

    const period =
      twelveHourMatch[3].toUpperCase();

    if (
      period === "AM" &&
      hours === 12
    ) {
      hours = 0;
    }

    if (
      period === "PM" &&
      hours !== 12
    ) {
      hours += 12;
    }

    return `${String(hours).padStart(
      2,
      "0"
    )}:${minutes}`;
  }

  return "";
};

const parseTimeParts = (time) => {
  const normalized =
    normalizeTime(time);

  if (!normalized) {
    return {
      hour: "",
      minute: "",
      period: "",
    };
  }

  const [
    rawHours,
    minute,
  ] = normalized
    .split(":")
    .map(Number);

  return {
    hour: String(
      rawHours % 12 || 12
    ),
    minute: String(
      minute
    ).padStart(2, "0"),
    period:
      rawHours >= 12
        ? "PM"
        : "AM",
  };
};

const buildTime = (
  hour,
  minute,
  period
) => {
  if (
    !hour ||
    !minute ||
    !period
  ) {
    return "";
  }

  let hours = Number(hour);

  if (
    period === "AM" &&
    hours === 12
  ) {
    hours = 0;
  }

  if (
    period === "PM" &&
    hours !== 12
  ) {
    hours += 12;
  }

  return `${String(hours).padStart(
    2,
    "0"
  )}:${String(minute).padStart(
    2,
    "0"
  )}`;
};

const HOUR_OPTIONS = Array.from(
  { length: 12 },
  (_, index) =>
    String(index + 1)
);

const MINUTE_OPTIONS = [
  "00",
  "15",
  "30",
  "45",
];

const PERIOD_OPTIONS = [
  "AM",
  "PM",
];

const TIME_ZONE_OPTIONS = [
  {
    value: "America/New_York",
    label: "Eastern Time (ET)",
  },
  {
    value: "America/Chicago",
    label: "Central Time (CT)",
  },
  {
    value: "America/Denver",
    label: "Mountain Time (MT)",
  },
  {
    value: "America/Los_Angeles",
    label: "Pacific Time (PT)",
  },
  {
    value: "America/Anchorage",
    label: "Alaska Time (AKT)",
  },
  {
    value: "Pacific/Honolulu",
    label: "Hawaii Time (HT)",
  },
  {
    value: "UTC",
    label: "Coordinated Universal Time (UTC)",
  },
];

const formatTimeZoneForDisplay = (
  timeZone
) => {
  if (!timeZone) return "";

  const zone =
    TIME_ZONE_OPTIONS.find(
      (option) =>
        option.value === timeZone
    );

  return zone
    ? zone.label
    : timeZone;
};

const formatTimeForDisplay = (
  time
) => {
  if (!time) return "";

  const normalizedTime =
    normalizeTime(time);

  if (!normalizedTime) {
    return time;
  }

  const [
    hours,
    minutes,
  ] = normalizedTime
    .split(":")
    .map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return time;
  }

  const period =
    hours >= 12 ? "PM" : "AM";

  const displayHours =
    hours % 12 || 12;

  return `${displayHours}:${String(
    minutes
  ).padStart(2, "0")} ${period}`;
};

function Calendar({
  profile,
  onBackToProfile,
  onLogout,
  viewedUser = null,
  darkMode,
  onToggleNightMode,
}) {
  const today = new Date();

  const calendarProfile =
    viewedUser || profile;

  const isAdminEditingAnotherCalendar =
    Boolean(
      viewedUser &&
        profile?.admin === true &&
        String(viewedUser?._id) !==
          String(profile?._id)
    );

  const [
    currentDate,
    setCurrentDate,
  ] = useState(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    )
  );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    getDateKey(today)
  );

  const [
    events,
    setEvents,
  ] = useState({});

  const [
    loadingEvents,
    setLoadingEvents,
  ] = useState(true);

  const [
    savingEvent,
    setSavingEvent,
  ] = useState(false);

  const [
    calendarError,
    setCalendarError,
  ] = useState("");

  const [
    eventTitle,
    setEventTitle,
  ] = useState("");

  const [
    timeHour,
    setTimeHour,
  ] = useState("");

  const [
    timeMinute,
    setTimeMinute,
  ] = useState("");

  const [
    timePeriod,
    setTimePeriod,
  ] = useState("");

  const [
    timeZone,
    setTimeZone,
  ] = useState("");

  const [
    eventDescription,
    setEventDescription,
  ] = useState("");

  const [
    selectedEvent,
    setSelectedEvent,
  ] = useState(null);

  const [
    editingEventId,
    setEditingEventId,
  ] = useState(null);

  const calendarChangeVersion =
    useRef(0);

  const calendarRequestId =
    useRef(0);

  const calendarMutationInProgress =
    useRef(false);

  const resetEventForm = () => {
    setEditingEventId(null);
    setEventTitle("");
    setTimeHour("");
    setTimeMinute("");
    setTimePeriod("");
    setTimeZone("");
    setEventDescription("");
  };

  useEffect(() => {
    let isMounted = true;
    let isFirstLoad = true;

    const loadCalendar = async () => {
      if (
        calendarMutationInProgress.current
      ) {
        return;
      }

      const userId =
        calendarProfile?._id ||
        calendarProfile?.id;

      if (!userId) {
        if (isMounted) {
          setEvents({});
          setLoadingEvents(false);
          setCalendarError(
            "Unable to determine the calendar owner."
          );
        }

        return;
      }

      const requestId =
        ++calendarRequestId.current;

      const requestVersion =
        calendarChangeVersion.current;

      if (isFirstLoad) {
        setLoadingEvents(true);
      }

      setCalendarError("");

      try {
        const encodedUserId =
          encodeURIComponent(userId);

        const endpoint =
          isAdminEditingAnotherCalendar
            ? `${API_URL}/calendar/${encodedUserId}`
            : `${API_URL}/calendar/me`;

        const authConfig =
          getAuthConfig();

        const response =
          await axios.get(
            `${endpoint}?t=${Date.now()}`,
            {
              ...authConfig,
              headers: {
                ...authConfig.headers,
                "Cache-Control":
                  "no-cache, no-store, max-age=0",
                Pragma: "no-cache",
              },
            }
          );

        if (
          !isMounted ||
          requestId !==
            calendarRequestId.current ||
          requestVersion !==
            calendarChangeVersion.current
        ) {
          return;
        }

        setEvents(
          response.data.events || {}
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error(
          "Load calendar error:",
          error
        );

        if (isFirstLoad) {
          setEvents({});
        }

        setCalendarError(
          error.response?.data
            ?.message ||
            "Unable to load calendar."
        );
      } finally {
        if (isMounted) {
          setLoadingEvents(false);
          isFirstLoad = false;
        }
      }
    };

    loadCalendar();

    const refreshInterval =
      window.setInterval(
        loadCalendar,
        10000
      );

    const handleWindowFocus = () =>
      loadCalendar();

    window.addEventListener(
      "focus",
      handleWindowFocus
    );

    resetEventForm();
    setSelectedEvent(null);

    return () => {
      isMounted = false;

      window.clearInterval(
        refreshInterval
      );

      window.removeEventListener(
        "focus",
        handleWindowFocus
      );
    };
  }, [
    calendarProfile?._id,
    calendarProfile?.id,
    isAdminEditingAnotherCalendar,
  ]);

  const getDaysInMonth = () => {
    const year =
      currentDate.getFullYear();

    const month =
      currentDate.getMonth();

    const firstDay = new Date(
      year,
      month,
      1
    );

    const lastDay = new Date(
      year,
      month + 1,
      0
    );

    const days = [];

    for (
      let i = 0;
      i < firstDay.getDay();
      i += 1
    ) {
      days.push(null);
    }

    for (
      let day = 1;
      day <= lastDay.getDate();
      day += 1
    ) {
      days.push(
        new Date(
          year,
          month,
          day
        )
      );
    }

    return days;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(
      (previousDate) =>
        new Date(
          previousDate.getFullYear(),
          previousDate.getMonth() - 1,
          1
        )
    );
  };

  const goToNextMonth = () => {
    setCurrentDate(
      (previousDate) =>
        new Date(
          previousDate.getFullYear(),
          previousDate.getMonth() + 1,
          1
        )
    );
  };

  const goToToday = () => {
    const now = new Date();

    setCurrentDate(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )
    );

    setSelectedDate(
      getDateKey(now)
    );
  };

  const getEventsForDate = (
    dateKey
  ) => {
    const dateEvents =
      events?.[dateKey];

    return Array.isArray(dateEvents)
      ? dateEvents
      : [];
  };

  const getEventId = (event) => {
    return (
      event?._id ||
      event?.id ||
      event?.eventId
    );
  };

  const canEditEvent = (event) => {
    if (!event) {
      return false;
    }

    // Administrators can manage tasks on every calendar, including
    // tasks created or previously modified by another user/admin.
    if (profile?.admin === true) {
      return true;
    }

    // Regular users can manage tasks on their own calendar.
    const eventUserId =
      event.userId ||
      event.user?._id ||
      event.createdBy?._id ||
      event.createdBy;

    if (!eventUserId) {
      return true;
    }

    return (
      String(eventUserId) ===
      String(
        profile?._id ||
          profile?.id
      )
    );
  };

  const saveEvent = async (
    submitEvent
  ) => {
    submitEvent.preventDefault();

    if (!selectedDate) {
      return;
    }

    if (!eventTitle.trim()) {
      setCalendarError(
        "Please enter a task title."
      );
      return;
    }

    const builtTime = buildTime(
      timeHour,
      timeMinute,
      timePeriod
    );

    const eventPayload = {
      title: eventTitle.trim(),
      time: builtTime,
      timeZone: timeZone || "",
      description:
        eventDescription.trim(),
    };

    const userId =
      calendarProfile?._id ||
      calendarProfile?.id;

    if (!userId) {
      setCalendarError(
        "Unable to determine the calendar owner."
      );
      return;
    }

    const eventId =
      editingEventId;

    const isEditing =
      Boolean(eventId);

    setSavingEvent(true);
    setCalendarError("");

    calendarMutationInProgress.current =
      true;

    calendarChangeVersion.current +=
      1;

    try {
      const encodedUserId =
        encodeURIComponent(userId);

      const authConfig =
        getAuthConfig();

      let response;

      if (
        isAdminEditingAnotherCalendar
      ) {
        if (isEditing) {
          response =
            await axios.put(
              `${API_URL}/calendar/${encodedUserId}/events/${encodeURIComponent(
                eventId
              )}`,
              {
                date: selectedDate,
                ...eventPayload,
              },
              authConfig
            );
        } else {
          response =
            await axios.post(
              `${API_URL}/calendar/${encodedUserId}/events`,
              {
                date: selectedDate,
                ...eventPayload,
              },
              authConfig
            );
        }
      } else if (isEditing) {
        response =
          await axios.put(
            `${API_URL}/calendar/${encodedUserId}/events/${encodeURIComponent(
              eventId
            )}`,
            {
              date: selectedDate,
              ...eventPayload,
            },
            authConfig
          );
      } else {
        response =
          await axios.post(
            `${API_URL}/calendar/${encodedUserId}/events`,
            {
              date: selectedDate,
              ...eventPayload,
            },
            authConfig
          );
      }

      if (
        response?.data?.events
      ) {
        setEvents(
          response.data.events
        );
      } else {
        const refreshedResponse =
          await axios.get(
            `${API_URL}/calendar/${
              isAdminEditingAnotherCalendar
                ? encodedUserId
                : "me"
            }?t=${Date.now()}`,
            {
              ...authConfig,
              headers: {
                ...authConfig.headers,
                "Cache-Control":
                  "no-cache, no-store, max-age=0",
                Pragma: "no-cache",
              },
            }
          );

        setEvents(
          refreshedResponse.data
            .events || {}
        );
      }

      resetEventForm();
      setSelectedEvent(null);
    } catch (error) {
      console.error(
        "Save calendar event error:",
        error
      );

      setCalendarError(
        error.response?.data
          ?.message ||
          "Unable to save the task."
      );
    } finally {
      calendarMutationInProgress.current =
        false;

      setSavingEvent(false);
    }
  };

  const editEvent = (event) => {
    if (!canEditEvent(event)) {
      return;
    }

    const eventId =
      getEventId(event);

    if (!eventId) {
      setCalendarError(
        "Unable to determine the task ID."
      );
      return;
    }

    setEditingEventId(
      eventId
    );

    setEventTitle(
      event.title || ""
    );

    const timeParts =
      parseTimeParts(
        event.time
      );

    setTimeHour(
      timeParts.hour
    );

    setTimeMinute(
      timeParts.minute
    );

    setTimePeriod(
      timeParts.period
    );

    setTimeZone(
      event.timeZone || ""
    );

    setEventDescription(
      event.description || ""
    );

    setSelectedEvent(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const deleteEvent = async (
    dateKey,
    eventId
  ) => {
    if (!eventId) {
      return;
    }

    const eventToDelete =
      getEventsForDate(
        dateKey
      ).find(
        (event) =>
          String(
            getEventId(event)
          ) ===
          String(eventId)
      );

    if (
      !eventToDelete ||
      !canEditEvent(
        eventToDelete
      )
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this task?"
      );

    if (!confirmed) {
      return;
    }

    const userId =
      calendarProfile?._id ||
      calendarProfile?.id;

    if (!userId) {
      return;
    }

    setSavingEvent(true);
    setCalendarError("");

    calendarMutationInProgress.current =
      true;

    calendarChangeVersion.current +=
      1;

    try {
      const encodedUserId =
        encodeURIComponent(userId);

      const encodedEventId =
        encodeURIComponent(
          eventId
        );

      const authConfig =
        getAuthConfig();

      let endpoint;

      if (
        isAdminEditingAnotherCalendar
      ) {
        endpoint = `${API_URL}/calendar/${encodedUserId}/events/${encodedEventId}`;
      } else {
        endpoint = `${API_URL}/calendar/${encodedUserId}/events/${encodedEventId}`;
      }

      const response =
        await axios.delete(
          endpoint,
          {
            ...authConfig,
            data: {
              date: dateKey,
            },
          }
        );

      if (
        response?.data?.events
      ) {
        setEvents(
          response.data.events
        );
      } else {
        const refreshedResponse =
          await axios.get(
            `${API_URL}/calendar/${
              isAdminEditingAnotherCalendar
                ? encodedUserId
                : "me"
            }?t=${Date.now()}`,
            {
              ...authConfig,
              headers: {
                ...authConfig.headers,
                "Cache-Control":
                  "no-cache, no-store, max-age=0",
                Pragma: "no-cache",
              },
            }
          );

        setEvents(
          refreshedResponse.data
            .events || {}
        );
      }

      setSelectedEvent(null);

      if (
        editingEventId &&
        String(editingEventId) ===
          String(eventId)
      ) {
        resetEventForm();
      }
    } catch (error) {
      console.error(
        "Delete calendar event error:",
        error
      );

      setCalendarError(
        error.response?.data
          ?.message ||
          "Unable to delete the task."
      );
    } finally {
      calendarMutationInProgress.current =
        false;

      setSavingEvent(false);
    }
  };

  const days =
    getDaysInMonth();

  const monthLabel =
    currentDate.toLocaleDateString(
      undefined,
      {
        month: "long",
        year: "numeric",
      }
    );

  const selectedDateEvents =
    getEventsForDate(
      selectedDate
    );

  const calendarOwnerName =
    calendarProfile?.name ||
    calendarProfile?.username ||
    "User";

  const isToday = (date) =>
    date &&
    getDateKey(date) ===
      getDateKey(today);

  const isSelected = (date) =>
    date &&
    getDateKey(date) ===
      selectedDate;

  return (
    <main
      className={`calendar-page ${
        darkMode ? "dark-mode" : ""
      }`}
    >
      <header className="calendar-page-header">
        <div className="calendar-page-heading">
          <button
            type="button"
            className="secondary-button back-button"
            onClick={
              onBackToProfile
            }
          >
            ← Back
          </button>

          <div>
            <p className="calendar-eyebrow">
              Schedule
            </p>

            <h1>
              {isAdminEditingAnotherCalendar
                ? `${calendarOwnerName}'s Calendar`
                : "Calendar"}
            </h1>

            <p className="calendar-subtitle">
              Manage tasks and events
              from one place.
            </p>
          </div>
        </div>

        <div className="calendar-header-actions">
          {onToggleNightMode && (
            <button
              type="button"
              className="secondary-button"
              onClick={
                onToggleNightMode
              }
            >
              {darkMode
                ? "☀ Light"
                : "☾ Dark"}
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              className="secondary-button"
              onClick={onLogout}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {calendarError && (
        <div
          className="calendar-alert"
          role="alert"
        >
          {calendarError}
        </div>
      )}

      {isAdminEditingAnotherCalendar && (
        <div className="admin-calendar-banner">
          <strong>
            Admin mode:
          </strong>{" "}
          You are viewing and editing
          another user's calendar.
        </div>
      )}

      <div className="calendar-layout">
        <section className="calendar-card">
          <div className="calendar-card-header">
            <div>
              <p className="section-label">
                Monthly view
              </p>

              <h2>
                {monthLabel}
              </h2>
            </div>

            <div className="calendar-navigation">
              <button
                type="button"
                className="secondary-button"
                onClick={
                  goToPreviousMonth
                }
                aria-label="Previous month"
              >
                ←
              </button>

              <button
                type="button"
                className="secondary-button today-button"
                onClick={goToToday}
              >
                Today
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={
                  goToNextMonth
                }
                aria-label="Next month"
              >
                →
              </button>
            </div>
          </div>

          <div className="calendar-weekdays">
            {[
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
            ].map((day) => (
              <div
                key={day}
                className="calendar-weekday"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {days.map(
              (date, index) => {
                if (!date) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="calendar-day empty"
                    />
                  );
                }

                const dateKey =
                  getDateKey(date);

                const dayEvents =
                  getEventsForDate(
                    dateKey
                  );

                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={`calendar-day ${
                      isSelected(date)
                        ? "selected"
                        : ""
                    } ${
                      isToday(date)
                        ? "today"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedDate(
                        dateKey
                      );
                      setSelectedEvent(
                        null
                      );
                    }}
                  >
                    <span className="calendar-day-number">
                      {date.getDate()}
                    </span>

                    <div className="calendar-day-events">
                      {dayEvents
                        .slice(0, 3)
                        .map(
                          (event) => (
                            <span
                              key={
                                getEventId(
                                  event
                                ) ||
                                `${dateKey}-${event.title}`
                              }
                              className="calendar-event-preview"
                              title={
                                event.title
                              }
                            >
                              {event.title}
                            </span>
                          )
                        )}

                      {dayEvents.length >
                        3 && (
                        <span className="calendar-event-more">
                          +
                          {dayEvents.length -
                            3}{" "}
                          more
                        </span>
                      )}
                    </div>
                  </button>
                );
              }
            )}
          </div>
        </section>

        <aside className="calendar-sidebar">
          <section className="calendar-sidebar-card selected-date-card">
            <div className="sidebar-card-header">
              <div>
                <p className="section-label">
                  Selected date
                </p>

                <h2>
                  {formatDateForDisplay(
                    selectedDate
                  )}
                </h2>
              </div>

              <span className="task-count">
                {
                  selectedDateEvents.length
                }
              </span>
            </div>

            {loadingEvents ? (
              <div className="calendar-loading">
                Loading tasks...
              </div>
            ) : selectedDateEvents.length ===
              0 ? (
              <div className="empty-task-state">
                <p>
                  No tasks scheduled for
                  this day.
                </p>

                <span>
                  Use the form below to
                  add a task.
                </span>
              </div>
            ) : (
              <div className="selected-date-events">
                {selectedDateEvents.map(
                  (event) => (
                    <button
                      type="button"
                      className="task-card"
                      key={
                        getEventId(
                          event
                        ) ||
                        `${selectedDate}-${event.title}`
                      }
                      onClick={() =>
                        setSelectedEvent(
                          event
                        )
                      }
                    >
                      <div className="task-card-main">
                        <h3>
                          {event.title}
                        </h3>

                        {event.time && (
                          <span className="task-time">
                            {formatTimeForDisplay(
                              event.time
                            )}
                          </span>
                        )}
                      </div>

                      {event.description && (
                        <p>
                          {
                            event.description
                          }
                        </p>
                      )}

                      {(event.adminAssigned ===
                        true ||
                        event.adminModified ===
                          true) && (
                        <span className="task-status-label">
                          {event.adminAssigned ===
                          true
                            ? "Assigned by Admin"
                            : "Modified by Admin"}
                        </span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </section>

          <section className="calendar-sidebar-card event-form-card">
            <div className="sidebar-card-header">
              <div>
                <p className="section-label">
                  {editingEventId
                    ? "Edit task"
                    : "New task"}
                </p>

                <h2>
                  {editingEventId
                    ? "Update Task"
                    : "Add a Task"}
                </h2>
              </div>
            </div>

            <form
              className="event-form"
              onSubmit={saveEvent}
            >
              <div className="form-field">
                <label htmlFor="event-title">
                  Task Title
                </label>

                <input
                  id="event-title"
                  type="text"
                  value={eventTitle}
                  onChange={(event) =>
                    setEventTitle(
                      event.target.value
                    )
                  }
                  placeholder="Enter task title"
                  maxLength={200}
                  required
                />
              </div>

              <div className="form-field">
                <label>
                  Time
                </label>

                <div className="time-selects">
                  <select
                    value={timeHour}
                    onChange={(
                      event
                    ) =>
                      setTimeHour(
                        event.target
                          .value
                      )
                    }
                    aria-label="Hour"
                  >
                    <option value="">
                      Hour
                    </option>

                    {HOUR_OPTIONS.map(
                      (hour) => (
                        <option
                          key={hour}
                          value={hour}
                        >
                          {hour}
                        </option>
                      )
                    )}
                  </select>

                  <select
                    value={timeMinute}
                    onChange={(
                      event
                    ) =>
                      setTimeMinute(
                        event.target
                          .value
                      )
                    }
                    aria-label="Minute"
                  >
                    <option value="">
                      Minute
                    </option>

                    {MINUTE_OPTIONS.map(
                      (minute) => (
                        <option
                          key={minute}
                          value={minute}
                        >
                          {minute}
                        </option>
                      )
                    )}
                  </select>

                  <select
                    value={timePeriod}
                    onChange={(
                      event
                    ) =>
                      setTimePeriod(
                        event.target
                          .value
                      )
                    }
                    aria-label="AM or PM"
                  >
                    <option value="">
                      AM/PM
                    </option>

                    {PERIOD_OPTIONS.map(
                      (period) => (
                        <option
                          key={period}
                          value={period}
                        >
                          {period}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="event-time-zone">
                  Time Zone
                </label>

                <select
                  id="event-time-zone"
                  value={timeZone}
                  onChange={(event) =>
                    setTimeZone(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select time zone
                  </option>

                  {TIME_ZONE_OPTIONS.map(
                    (zone) => (
                      <option
                        key={zone.value}
                        value={zone.value}
                      >
                        {zone.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="event-description">
                  Description
                </label>

                <textarea
                  id="event-description"
                  value={
                    eventDescription
                  }
                  onChange={(event) =>
                    setEventDescription(
                      event.target
                        .value
                    )
                  }
                  placeholder="Add details about this task..."
                  maxLength={2000}
                  rows={5}
                />

                <small className="field-hint">
                  {
                    eventDescription.length
                  }
                  /2000 characters
                </small>
              </div>

              <div className="event-form-buttons">
                <button
                  type="submit"
                  disabled={
                    savingEvent
                  }
                >
                  {savingEvent
                    ? "Saving..."
                    : editingEventId
                      ? "Update Event"
                      : "Add Event"}
                </button>

                {editingEventId && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      resetEventForm
                    }
                    disabled={
                      savingEvent
                    }
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
        </aside>
      </div>

      {selectedEvent && (
        <div
          className="event-details-overlay"
          role="presentation"
          onClick={() =>
            setSelectedEvent(null)
          }
        >
          <section
            className="event-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-details-title"
            onClick={(
              clickEvent
            ) =>
              clickEvent.stopPropagation()
            }
          >
            <div className="event-details-header">
              <div>
                <p className="event-details-label">
                  Task Details
                </p>

                <h2 id="event-details-title">
                  {
                    selectedEvent.title
                  }
                </h2>
              </div>

              <button
                type="button"
                className="secondary-button event-details-close"
                onClick={() =>
                  setSelectedEvent(
                    null
                  )
                }
                aria-label="Close task details"
              >
                ×
              </button>
            </div>

            {selectedEvent.time && (
              <p className="event-details-time">
                <strong>
                  Time:
                </strong>{" "}
                {formatTimeForDisplay(
                  selectedEvent.time
                )}

                {selectedEvent.timeZone && (
                  <>
                    {" "}
                    (
                    {formatTimeZoneForDisplay(
                      selectedEvent.timeZone
                    )}
                    )
                  </>
                )}
              </p>
            )}

            <div className="event-details-description">
              <h3>
                Description
              </h3>

              {selectedEvent.description ? (
                <p>
                  {
                    selectedEvent.description
                  }
                </p>
              ) : (
                <p className="no-description">
                  No description was
                  added to this task.
                </p>
              )}
            </div>

            {!isAdminEditingAnotherCalendar &&
              selectedEvent.adminAssigned ===
                true && (
                <p className="admin-assigned-label">
                  Assigned by Admin — read
                  only
                </p>
              )}

            {!isAdminEditingAnotherCalendar &&
              selectedEvent.adminAssigned !==
                true &&
              selectedEvent.adminModified ===
                true && (
                <p className="admin-assigned-label">
                  Modified by Admin — read
                  only
                </p>
              )}

            <div className="event-details-actions">
              {canEditEvent(
                selectedEvent
              ) && (
                <button
                  type="button"
                  onClick={() =>
                    editEvent(
                      selectedEvent
                    )
                  }
                >
                  Edit Task
                </button>
              )}

              {canEditEvent(
                selectedEvent
              ) && (
                <button
                  type="button"
                  className="danger-button"
                  onClick={() =>
                    deleteEvent(
                      selectedDate,
                      getEventId(
                        selectedEvent
                      )
                    )
                  }
                  disabled={
                    savingEvent
                  }
                >
                  {savingEvent
                    ? "Deleting..."
                    : "Delete Task"}
                </button>
              )}

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setSelectedEvent(
                    null
                  )
                }
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Calendar;