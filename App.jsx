import { useEffect, useState } from "react";
import axios from "axios";
import Calendar from "./Calendar";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const TOKEN_KEY = "profile_auth_token";

const getStoredToken = () =>
  localStorage.getItem(TOKEN_KEY);

const THEME_KEY = "profile_night_mode";

const ThemeToggle = ({ darkMode, onToggle }) => (
  <button
    type="button"
    className="theme-toggle"
    onClick={onToggle}
    aria-label={
      darkMode
        ? "Switch to day mode"
        : "Switch to night mode"
    }
  >
    {darkMode ? "☀️ Day Mode" : "🌙 Night Mode"}
  </button>
);

const getAuthConfig = () => {
  const token = getStoredToken();

  return token
    ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    : {};
};

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem(THEME_KEY) === "true";
  });

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem(THEME_KEY, String(darkMode));
  }, [darkMode]);

  const toggleNightMode = () => {
    setDarkMode((current) => !current);
  };

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [createUsername, setCreateUsername] =
    useState("");
  const [createPassword, setCreatePassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [profile, setProfile] = useState(null);

  const [editingOwnProfile, setEditingOwnProfile] =
    useState(false);

  const [ownProfileForm, setOwnProfileForm] =
    useState({
      name: "",
      email: "",
      username: "",
      password: "",
    });

  const [savingOwnProfile, setSavingOwnProfile] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] =
    useState(true);

  const [
    showCreateProfile,
    setShowCreateProfile,
  ] = useState(false);

  const [currentPage, setCurrentPage] =
    useState("profile");

  // --------------------------------------------------
  // ADMIN STATE
  // --------------------------------------------------

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] =
    useState(null);
  const [showAdminUsers, setShowAdminUsers] =
    useState(false);
  const [loadingUsers, setLoadingUsers] =
    useState(false);
  const [adminError, setAdminError] =
    useState("");
  const [adminView, setAdminView] =
    useState(null);

  const [editingUser, setEditingUser] =
    useState(null);

  const [editUserForm, setEditUserForm] =
    useState({
      name: "",
      email: "",
      username: "",
      password: "",
    });

  const [savingUser, setSavingUser] =
    useState(false);
  const [deletingUserId, setDeletingUserId] =
    useState(null);

  // --------------------------------------------------
  // RESTORE SESSION
  // --------------------------------------------------

  useEffect(() => {
    const loadCurrentProfile = async () => {
      const token = getStoredToken();

      if (!token) {
        setCheckingSession(false);
        return;
      }

      try {
        const response = await axios.get(
          `${API_URL}/profiles/me`,
          getAuthConfig()
        );

        setProfile(
          response.data.profile ||
            response.data
        );
      } catch (error) {
        console.error(
          "Session check error:",
          error
        );

        localStorage.removeItem(
          TOKEN_KEY
        );

        setProfile(null);
      } finally {
        setCheckingSession(false);
      }
    };

    loadCurrentProfile();
  }, []);

  // --------------------------------------------------
  // LOGIN
  // --------------------------------------------------

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/profiles/login`,
        {
          username: username.trim(),
          password,
        }
      );

      if (!response.data.token) {
        throw new Error(
          "The server did not return an authentication token."
        );
      }

      localStorage.setItem(
        TOKEN_KEY,
        response.data.token
      );

      setProfile(response.data.profile);
      setPassword("");

      setCurrentPage("profile");
      setShowAdminUsers(false);
      setSelectedUser(null);
      setAdminView(null);
      setEditingUser(null);
      setAdminError("");
      setError("");
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setError(
        error.response?.data?.message ||
          error.message ||
          "Unable to log in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // CREATE PROFILE
  // --------------------------------------------------

  const handleCreateProfile = async (
    event
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !name.trim() ||
      !email.trim() ||
      !createUsername.trim()
    ) {
      setError(
        "Name, email, and username are required."
      );
      return;
    }

    if (
      createPassword !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    if (createPassword.length < 8) {
      setError(
        "Password must be at least 8 characters long."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/profiles/register`,
        {
          name: name.trim(),
          email: email.trim(),
          username:
            createUsername.trim(),
          password: createPassword,
        }
      );

      setSuccess(response.data.message);

      setUsername(
        createUsername.trim()
      );

      setName("");
      setEmail("");
      setCreateUsername("");
      setCreatePassword("");
      setConfirmPassword("");

      setShowCreateProfile(false);
    } catch (error) {
      console.error(
        "Create profile error:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Unable to create profile. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // EDIT OWN PROFILE
  // --------------------------------------------------

  const startEditOwnProfile = () => {
    if (!profile) {
      return;
    }

    setOwnProfileForm({
      name: profile.name || "",
      email: profile.email || "",
      username: profile.username || "",
      password: "",
    });

    setEditingOwnProfile(true);
    setError("");
    setSuccess("");
  };

  const cancelEditOwnProfile = () => {
    setEditingOwnProfile(false);

    setOwnProfileForm({
      name: "",
      email: "",
      username: "",
      password: "",
    });

    setError("");
  };

  const saveOwnProfile = async (event) => {
    event.preventDefault();

    if (
      !ownProfileForm.name.trim() ||
      !ownProfileForm.email.trim() ||
      !ownProfileForm.username.trim()
    ) {
      setError(
        "Name, email, and username are required."
      );
      return;
    }

    if (
      ownProfileForm.password &&
      ownProfileForm.password.length < 8
    ) {
      setError(
        "Password must be at least 8 characters long."
      );
      return;
    }

    setSavingOwnProfile(true);
    setError("");
    setSuccess("");

    try {
      const response = await axios.put(
        `${API_URL}/profiles/me`,
        {
          name: ownProfileForm.name.trim(),
          email: ownProfileForm.email.trim(),
          username:
            ownProfileForm.username.trim(),
          password:
            ownProfileForm.password,
        },
        getAuthConfig()
      );

      const updatedProfile =
        response.data.profile;

      setProfile(updatedProfile);
      setSuccess(
        response.data.message ||
          "Profile updated successfully."
      );

      setEditingOwnProfile(false);

      setOwnProfileForm({
        name: "",
        email: "",
        username: "",
        password: "",
      });
    } catch (error) {
      console.error(
        "Update own profile error:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Unable to update your profile."
      );
    } finally {
      setSavingOwnProfile(false);
    }
  };

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const handleLogout = () => {
    localStorage.removeItem(
      TOKEN_KEY
    );

    setProfile(null);
    setUsername("");
    setPassword("");
    setError("");
    setSuccess("");
    setEditingOwnProfile(false);
    setOwnProfileForm({
      name: "",
      email: "",
      username: "",
      password: "",
    });

    setCurrentPage("profile");

    setUsers([]);
    setSelectedUser(null);
    setShowAdminUsers(false);
    setAdminError("");
    setAdminView(null);
    setEditingUser(null);
    setDeletingUserId(null);

    setEditUserForm({
      name: "",
      email: "",
      username: "",
      password: "",
    });
  };

  // --------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------

  const openCalendar = () => {
    setCurrentPage("calendar");
    setAdminView(null);
  };

  const openProfile = () => {
    setCurrentPage("profile");
    setAdminView(null);
    setSelectedUser(null);
    setEditingUser(null);
    setAdminError("");
  };

  const showLoginForm = () => {
    setShowCreateProfile(false);
    setError("");
    setSuccess("");
  };

  const showCreateProfileForm = () => {
    setShowCreateProfile(true);
    setError("");
    setSuccess("");
  };

  // --------------------------------------------------
  // ADMIN - LOAD USERS
  // --------------------------------------------------

  const loadAllUsers = async () => {
    setLoadingUsers(true);
    setAdminError("");

    try {
      const response = await axios.get(
        `${API_URL}/profiles/all`,
        getAuthConfig()
      );

      const userList =
        Array.isArray(response.data)
          ? response.data
          : response.data.users || [];

      const otherUsers = userList.filter(
        (user) =>
          user._id !== profile?._id
      );

      setUsers(otherUsers);
      setShowAdminUsers(true);
    } catch (error) {
      console.error(
        "Load users error:",
        error
      );

      setAdminError(
        error.response?.data?.message ||
          "Unable to load users."
      );
    } finally {
      setLoadingUsers(false);
    }
  };

  // --------------------------------------------------
  // ADMIN - EDIT USER
  // --------------------------------------------------

  const startEditUser = (user) => {
    setSelectedUser(user);
    setEditingUser(user);
    setAdminView("profile");
    setCurrentPage("admin");

    setEditUserForm({
      name: user.name || "",
      email: user.email || "",
      username:
        user.username || "",
      password: "",
    });

    setAdminError("");
  };

  const saveUserChanges = async (
    event
  ) => {
    event.preventDefault();

    if (!editingUser) {
      return;
    }

    if (
      !editUserForm.name.trim() ||
      !editUserForm.email.trim() ||
      !editUserForm.username.trim()
    ) {
      setAdminError(
        "Name, email, and username are required."
      );
      return;
    }

    if (
      editUserForm.password &&
      editUserForm.password.length < 8
    ) {
      setAdminError(
        "Password must be at least 8 characters long."
      );
      return;
    }

    setSavingUser(true);
    setAdminError("");

    try {
      const response = await axios.put(
        `${API_URL}/profiles/${encodeURIComponent(
          editingUser._id
        )}`,
        {
          name: editUserForm.name.trim(),
          email:
            editUserForm.email.trim(),
          username:
            editUserForm.username.trim(),
          password:
            editUserForm.password,
        },
        getAuthConfig()
      );

      const updatedUser =
        response.data.profile;

      setUsers((previousUsers) =>
        previousUsers.map((user) =>
          user._id ===
          updatedUser._id
            ? updatedUser
            : user
        )
      );

      setSelectedUser(
        (previousUser) =>
          previousUser?._id ===
          updatedUser._id
            ? updatedUser
            : previousUser
      );

      if (
        profile?._id ===
        updatedUser._id
      ) {
        setProfile(updatedUser);
      }

      setEditingUser(null);

      setEditUserForm({
        name: "",
        email: "",
        username: "",
        password: "",
      });
    } catch (error) {
      console.error(
        "Update user error:",
        error
      );

      setAdminError(
        error.response?.data?.message ||
          "Unable to update user profile."
      );
    } finally {
      setSavingUser(false);
    }
  };

  // --------------------------------------------------
  // ADMIN - DELETE USER
  // --------------------------------------------------

  const deleteUser = async (user) => {
    const confirmed =
      window.confirm(
        `Delete ${
          user.name ||
          user.username
        }'s profile? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingUserId(user._id);
    setAdminError("");

    try {
      await axios.delete(
        `${API_URL}/profiles/${encodeURIComponent(
          user._id
        )}`,
        getAuthConfig()
      );

      setUsers((previousUsers) =>
        previousUsers.filter(
          (existingUser) =>
            existingUser._id !==
            user._id
        )
      );

      if (
        selectedUser?._id ===
        user._id
      ) {
        setSelectedUser(null);
        setAdminView(null);
        setCurrentPage("profile");
      }

      if (
        editingUser?._id ===
        user._id
      ) {
        setEditingUser(null);
      }
    } catch (error) {
      console.error(
        "Delete user error:",
        error
      );

      setAdminError(
        error.response?.data?.message ||
          "Unable to delete user profile."
      );
    } finally {
      setDeletingUserId(null);
    }
  };

  // --------------------------------------------------
  // ADMIN - VIEW PROFILE
  // --------------------------------------------------

  const viewUserProfile = (user) => {
    setSelectedUser(user);
    setAdminView("profile");
    setCurrentPage("admin");
  };

  // --------------------------------------------------
  // ADMIN - VIEW CALENDAR
  // --------------------------------------------------

  const viewUserCalendar = (user) => {
    setSelectedUser(user);
    setAdminView("calendar");
    setCurrentPage("admin");
  };

  // --------------------------------------------------
  // ADMIN - CLOSE VIEW
  // --------------------------------------------------

  const closeAdminView = () => {
    setSelectedUser(null);
    setAdminView(null);
    setEditingUser(null);
    setAdminError("");
    setCurrentPage("profile");
  };

  // --------------------------------------------------
  // SESSION CHECK
  // --------------------------------------------------

  if (checkingSession) {
    return (
      <main className="app">
        <section className="login-card">
          <ThemeToggle
            darkMode={darkMode}
            onToggle={toggleNightMode}
          />
          <p className="subtitle">
            Checking your session...
          </p>
        </section>
      </main>
    );
  }

  // ==================================================
  // ADMIN CALENDAR PAGE
  // ==================================================

  if (
    profile &&
    profile.admin === true &&
    currentPage === "admin" &&
    adminView === "calendar" &&
    selectedUser
  ) {
    return (
      <Calendar
        profile={profile}
        viewedUser={selectedUser}
        onBackToProfile={
          closeAdminView
        }
        onLogout={handleLogout}
        darkMode={darkMode}
        onToggleNightMode={toggleNightMode}
      />
    );
  }

  // ==================================================
  // ADMIN PAGE
  // ==================================================

  if (
    profile &&
    profile.admin === true &&
    currentPage === "admin"
  ) {
    return (
      <main className="app">
        <section className="login-card">
          <ThemeToggle
            darkMode={darkMode}
            onToggle={toggleNightMode}
          />

          <div className="profile-header">
            <button
              type="button"
              className="secondary-button"
              onClick={openProfile}
            >
              ← Back to My Profile
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </div>

          {adminView === "profile" &&
            selectedUser && (
              <div>
                <h1>
                  {editingUser
                    ? "Edit User Profile"
                    : "User Profile"}
                </h1>

                <p className="subtitle">
                  {editingUser
                    ? `Editing ${editingUser.username}`
                    : "Viewing another user's profile"}
                </p>

                {editingUser ? (
                  <form
                    onSubmit={
                      saveUserChanges
                    }
                  >
                    <div className="form-group">
                      <label htmlFor="admin-edit-name">
                        Name
                      </label>

                      <input
                        id="admin-edit-name"
                        type="text"
                        value={
                          editUserForm.name
                        }
                        onChange={(event) =>
                          setEditUserForm(
                            (previous) => ({
                              ...previous,
                              name: event.target.value,
                            })
                          )
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="admin-edit-email">
                        Email
                      </label>

                      <input
                        id="admin-edit-email"
                        type="email"
                        value={
                          editUserForm.email
                        }
                        onChange={(event) =>
                          setEditUserForm(
                            (previous) => ({
                              ...previous,
                              email: event.target.value,
                            })
                          )
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="admin-edit-username">
                        Username
                      </label>

                      <input
                        id="admin-edit-username"
                        type="text"
                        value={
                          editUserForm.username
                        }
                        onChange={(event) =>
                          setEditUserForm(
                            (previous) => ({
                              ...previous,
                              username:
                                event.target.value,
                            })
                          )
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="admin-edit-password">
                        New Password (optional)
                      </label>

                      <input
                        id="admin-edit-password"
                        type="password"
                        value={
                          editUserForm.password
                        }
                        onChange={(event) =>
                          setEditUserForm(
                            (previous) => ({
                              ...previous,
                              password:
                                event.target.value,
                            })
                          )
                        }
                        minLength={8}
                        placeholder="Leave blank to keep current password"
                      />
                    </div>

                    <p className="subtitle">
                      Admin status:{" "}
                      {selectedUser.admin
                        ? "Yes"
                        : "No"}
                    </p>

                    {adminError && (
                      <p className="error">
                        {adminError}
                      </p>
                    )}

                    <div className="profile-actions">
                      <button
                        type="submit"
                        disabled={
                          savingUser
                        }
                      >
                        {savingUser
                          ? "Saving..."
                          : "Save Changes"}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setEditingUser(
                            null
                          );
                          setAdminError("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="profile-info">
                      <p>
                        <strong>
                          Name:
                        </strong>{" "}
                        {selectedUser.name}
                      </p>

                      <p>
                        <strong>
                          Username:
                        </strong>{" "}
                        {
                          selectedUser.username
                        }
                      </p>

                      <p>
                        <strong>
                          Email:
                        </strong>{" "}
                        {selectedUser.email}
                      </p>

                      <p>
                        <strong>
                          Admin:
                        </strong>{" "}
                        {selectedUser.admin
                          ? "Yes"
                          : "No"}
                      </p>
                    </div>

                    <div className="profile-actions">
                      <button
                        type="button"
                        onClick={() =>
                          startEditUser(
                            selectedUser
                          )
                        }
                      >
                        Edit Profile
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={() =>
                          deleteUser(
                            selectedUser
                          )
                        }
                        disabled={
                          deletingUserId ===
                          selectedUser._id
                        }
                      >
                        {deletingUserId ===
                        selectedUser._id
                          ? "Deleting..."
                          : "Delete Profile"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          viewUserCalendar(
                            selectedUser
                          )
                        }
                      >
                        Manage Calendar
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={
                          closeAdminView
                        }
                      >
                        Back
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

          {adminView === null &&
            !selectedUser && (
              <div>
                <h1>
                  Administrator
                </h1>

                <p className="subtitle">
                  Select a user from your
                  profile to manage their
                  account.
                </p>

                <button
                  type="button"
                  onClick={openProfile}
                >
                  Back to My Profile
                </button>
              </div>
            )}
        </section>
      </main>
    );
  }

  // ==================================================
  // USER CALENDAR
  // ==================================================

  if (
    profile &&
    currentPage === "calendar"
  ) {
    return (
      <Calendar
        profile={profile}
        onBackToProfile={
          openProfile
        }
        onLogout={handleLogout}
        darkMode={darkMode}
        onToggleNightMode={toggleNightMode}
      />
    );
  }

  // ==================================================
  // PROFILE
  // ==================================================

  if (profile) {
    return (
      <main className="app">
        <section className="login-card">
          <ThemeToggle
            darkMode={darkMode}
            onToggle={toggleNightMode}
          />

          <h1>
            Welcome,{" "}
            {profile.name ||
              profile.username}
          </h1>

          <p className="subtitle">
            Your Profile
          </p>

          {editingOwnProfile ? (
            <form onSubmit={saveOwnProfile}>
              <div className="form-group">
                <label htmlFor="own-profile-name">
                  Name
                </label>

                <input
                  id="own-profile-name"
                  type="text"
                  value={ownProfileForm.name}
                  onChange={(event) =>
                    setOwnProfileForm(
                      (previous) => ({
                        ...previous,
                        name: event.target.value,
                      })
                    )
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="own-profile-email">
                  Email
                </label>

                <input
                  id="own-profile-email"
                  type="email"
                  value={ownProfileForm.email}
                  onChange={(event) =>
                    setOwnProfileForm(
                      (previous) => ({
                        ...previous,
                        email: event.target.value,
                      })
                    )
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="own-profile-username">
                  Username
                </label>

                <input
                  id="own-profile-username"
                  type="text"
                  value={ownProfileForm.username}
                  onChange={(event) =>
                    setOwnProfileForm(
                      (previous) => ({
                        ...previous,
                        username:
                          event.target.value,
                      })
                    )
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="own-profile-password">
                  New Password (optional)
                </label>

                <input
                  id="own-profile-password"
                  type="password"
                  value={ownProfileForm.password}
                  onChange={(event) =>
                    setOwnProfileForm(
                      (previous) => ({
                        ...previous,
                        password:
                          event.target.value,
                      })
                    )
                  }
                  minLength={8}
                  placeholder="Leave blank to keep current password"
                />
              </div>

              <p className="subtitle">
                Admin status:{" "}
                {profile.admin ? "Yes" : "No"}
              </p>

              {error && (
                <p className="error">
                  {error}
                </p>
              )}

              <div className="profile-actions">
                <button
                  type="submit"
                  disabled={savingOwnProfile}
                >
                  {savingOwnProfile
                    ? "Saving..."
                    : "Save Changes"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={cancelEditOwnProfile}
                  disabled={savingOwnProfile}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="profile-info">
                <p>
                  <strong>Name:</strong>{" "}
                  {profile.name}
                </p>

                <p>
                  <strong>
                    Username:
                  </strong>{" "}
                  {profile.username}
                </p>

                <p>
                  <strong>Email:</strong>{" "}
                  {profile.email}
                </p>

                <p>
                  <strong>Admin:</strong>{" "}
                  {profile.admin
                    ? "Yes"
                    : "No"}
                </p>
              </div>

              <div className="profile-actions">
                <button
                  type="button"
                  onClick={startEditOwnProfile}
                >
                  Edit My Profile
                </button>

                <button
                  type="button"
                  onClick={openCalendar}
                >
                  Open My Calendar
                </button>

            {profile.admin === true && (
              <button
                type="button"
                onClick={loadAllUsers}
                disabled={loadingUsers}
              >
                {loadingUsers
                  ? "Loading Users..."
                  : "View Other Users"}
              </button>
            )}

            <button
              type="button"
              className="secondary-button"
              onClick={handleLogout}
            >
              Log Out
            </button>
              </div>
            </>
          )}

          {profile.admin === true &&
            showAdminUsers && (
              <div className="admin-users">
                <hr />

                <h2>All Users</h2>

                <p className="subtitle">
                  Select a user to manage
                  their profile or calendar.
                </p>

                {adminError && (
                  <p className="error">
                    {adminError}
                  </p>
                )}

                {loadingUsers && (
                  <p className="subtitle">
                    Loading users...
                  </p>
                )}

                {!loadingUsers &&
                  users.length === 0 && (
                    <p>
                      No users were found.
                    </p>
                  )}

                {!loadingUsers &&
                  users.length > 0 && (
                    <div className="admin-user-list">
                      {users.map(
                        (user) => (
                          <div
                            className="admin-user-card"
                            key={
                              user._id
                            }
                          >
                            <h3>
                              {user.name}
                            </h3>

                            <p>
                              <strong>
                                Username:
                              </strong>{" "}
                              {
                                user.username
                              }
                            </p>

                            <p>
                              <strong>
                                Email:
                              </strong>{" "}
                              {user.email}
                            </p>

                            <p>
                              <strong>
                                Admin:
                              </strong>{" "}
                              {user.admin
                                ? "Yes"
                                : "No"}
                            </p>

                            <div className="profile-actions">
                              <button
                                type="button"
                                onClick={() =>
                                  viewUserProfile(
                                    user
                                  )
                                }
                              >
                                View Profile
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  viewUserCalendar(
                                    user
                                  )
                                }
                              >
                                Manage Calendar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  startEditUser(
                                    user
                                  )
                                }
                              >
                                Edit / Manage
                              </button>

                              <button
                                type="button"
                                className="danger-button"
                                onClick={() =>
                                  deleteUser(
                                    user
                                  )
                                }
                                disabled={
                                  deletingUserId ===
                                  user._id
                                }
                              >
                                {deletingUserId ===
                                user._id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
              </div>
            )}
        </section>
      </main>
    );
  }

  // ==================================================
  // CREATE PROFILE
  // ==================================================

  if (showCreateProfile) {
    return (
      <main className="app">
        <section className="login-card">
          <ThemeToggle
            darkMode={darkMode}
            onToggle={toggleNightMode}
          />

          <h1>Create Profile</h1>

          <p className="subtitle">
            Create a new account
          </p>

          <form
            onSubmit={
              handleCreateProfile
            }
          >
            <div className="form-group">
              <label htmlFor="name">
                Name
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="createUsername">
                Username
              </label>

              <input
                id="createUsername"
                type="text"
                value={
                  createUsername
                }
                onChange={(event) =>
                  setCreateUsername(
                    event.target.value
                  )
                }
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="createPassword">
                Password
              </label>

              <input
                id="createPassword"
                type="password"
                value={
                  createPassword
                }
                onChange={(event) =>
                  setCreatePassword(
                    event.target.value
                  )
                }
                minLength={8}
                autoComplete="new-password"
                required
              />

              <small>
                Password must be at least
                8 characters.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                value={
                  confirmPassword
                }
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <p className="error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Creating Profile..."
                : "Create Profile"}
            </button>
          </form>

          <div className="form-footer">
            <p>
              Already have an account?
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={
                showLoginForm
              }
            >
              Back to Login
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ==================================================
  // LOGIN
  // ==================================================

  return (
    <main className="app">
      <section className="login-card">
        <ThemeToggle
          darkMode={darkMode}
          onToggle={toggleNightMode}
        />

        <h1>Login</h1>

        <p className="subtitle">
          Sign in to your profile
        </p>

        {success && (
          <p className="success">
            {success}
          </p>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value
                )
              }
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Log In"}
          </button>
        </form>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="create-profile-section">
          <p>
            Don't have an account?
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={
              showCreateProfileForm
            }
          >
            Create Profile
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;