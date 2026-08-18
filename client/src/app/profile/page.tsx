"use client";

import {
  ArrowLeft,
  Check,
  Loader2,
  Moon,
  Pencil,
  Search,
  Square,
  Sun,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface UserProfile {
  userId: string;
  email: string;
  name: string | null;
  avatar: string | null;
  title: string | null;
  username: string | null;
  teamId: string | null;
  teamName: string | null;
  isOwner: boolean;
}

type NavKey = "profile" | "theme" | "color";
type ThemeMode = "light" | "dark";
type ColorTheme =
  | "Amber"
  | "Blue"
  | "Pink"
  | "Rose"
  | "Emerald"
  | "Black";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api";

const COLOR_OPTIONS: Array<{
  name: ColorTheme;
  swatch: string;
  preview: string;
}> = [
  {
    name: "Amber",
    swatch: "bg-amber-500",
    preview: "bg-amber-600",
  },
  {
    name: "Blue",
    swatch: "bg-blue-500",
    preview: "bg-blue-600",
  },
  {
    name: "Pink",
    swatch: "bg-pink-500",
    preview: "bg-pink-600",
  },
  {
    name: "Rose",
    swatch: "bg-rose-500",
    preview: "bg-rose-600",
  },
  {
    name: "Emerald",
    swatch: "bg-emerald-500",
    preview: "bg-emerald-600",
  },
  {
    name: "Black",
    swatch: "bg-slate-900",
    preview: "bg-slate-900",
  },
];

const DEFAULT_PROFILE: UserProfile = {
  userId: "",
  email: "",
  name: "",
  avatar: null,
  title: "",
  username: "",
  teamId: null,
  teamName: null,
  isOwner: false,
};

const getStoredTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "light";
  }

  return localStorage.getItem("theme") === "dark"
    ? "dark"
    : "light";
};

const getStoredColor = (): ColorTheme => {
  if (typeof window === "undefined") {
    return "Pink";
  }

  const value = localStorage.getItem(
    "accentColor",
  ) as ColorTheme | null;

  return COLOR_OPTIONS.some(
    (option) => option.name === value,
  )
    ? value!
    : "Pink";
};

interface ProfileSettingsProps {
  onBack?: () => void;
}

export default function ProfileSettings({
  onBack,
}: ProfileSettingsProps) {
  const router = useRouter();

  const [activeNav, setActiveNav] =
    useState<NavKey>("profile");

  const [profile, setProfile] =
    useState<UserProfile>(DEFAULT_PROFILE);

  const [draftProfile, setDraftProfile] =
    useState({
      name: "",
      title: "",
      username: "",
      email: "",
    });

  const [isEditingEmail, setIsEditingEmail] =
    useState(false);

  const [theme, setTheme] =
    useState<ThemeMode>(getStoredTheme);

  const [accentColor, setAccentColor] =
    useState<ColorTheme>(getStoredColor);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [leaving, setLeaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const activeColor = useMemo(
    () =>
      COLOR_OPTIONS.find(
        (option) =>
          option.name === accentColor,
      ) ?? COLOR_OPTIONS[2],
    [accentColor],
  );

  // =====================================================
  // LOAD PROFILE
  // =====================================================

  useEffect(() => {
    const token =
      localStorage.getItem("authToken");

    if (!token) {
      router.push("/");
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      setError("");
      setMessage("");

      try {
        const response = await fetch(
          `${API_URL}/auth/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        const data =
          await response.json();

        if (
          !response.ok ||
          data?.error
        ) {
          throw new Error(
            data?.error ||
              "Unable to load profile",
          );
        }

        const nextProfile: UserProfile = {
          userId: data.userId ?? "",
          email: data.email ?? "",
          name: data.name ?? "",
          avatar: data.avatar ?? null,
          title: data.title ?? "",
          username: data.username ?? "",
          teamId: data.teamId ?? null,
          teamName: data.teamName ?? null,
          isOwner: Boolean(data.isOwner),
        };

        setProfile(nextProfile);

        setDraftProfile({
          name: nextProfile.name ?? "",
          title: nextProfile.title ?? "",
          username:
            nextProfile.username ?? "",
          email: nextProfile.email ?? "",
        });

        setIsEditingEmail(false);

        if (nextProfile.name) {
          localStorage.setItem(
            "userName",
            nextProfile.name,
          );
        }

        if (nextProfile.email) {
          localStorage.setItem(
            "userEmail",
            nextProfile.email,
          );
        }

        if (nextProfile.avatar) {
          localStorage.setItem(
            "userAvatar",
            nextProfile.avatar,
          );
        }

        if (nextProfile.teamId) {
          localStorage.setItem(
            "teamId",
            nextProfile.teamId,
          );
        } else {
          localStorage.removeItem("teamId");
        }

        if (nextProfile.teamName) {
          localStorage.setItem(
            "teamName",
            nextProfile.teamName,
          );
        } else {
          localStorage.removeItem(
            "teamName",
          );
        }

        localStorage.setItem(
          "isOwner",
          String(nextProfile.isOwner),
        );
      } catch (err) {
        console.error(
          "Failed to load profile:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load profile",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [router]);

  // =====================================================
  // THEME
  // =====================================================

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      theme === "dark",
    );

    localStorage.setItem("theme", theme);
  }, [theme]);

  // =====================================================
  // ACCENT COLOR
  // =====================================================

  useEffect(() => {
    localStorage.setItem(
      "accentColor",
      accentColor,
    );
  }, [accentColor]);

  // =====================================================
  // SAVE PROFILE
  // =====================================================

  const saveProfile = async () => {
    const token =
      localStorage.getItem("authToken");

    if (!token) {
      setError(
        "Your session has expired. Please sign in again.",
      );
      return;
    }

    const normalizedEmail =
      draftProfile.email.trim().toLowerCase();

    if (
      normalizedEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail,
      )
    ) {
      setError(
        "Please enter a valid email address.",
      );
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/auth/profile`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: draftProfile.name.trim(),
            title: draftProfile.title.trim(),
            username:
              draftProfile.username.trim(),
            email: normalizedEmail,
          }),
        },
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        data?.error
      ) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to save profile",
        );
      }

      const nextProfile: UserProfile = {
        ...profile,
        userId:
          data.userId ??
          data.id ??
          profile.userId,
        email:
          data.email ??
          normalizedEmail,
        name:
          data.name ??
          draftProfile.name,
        avatar:
          data.avatar ??
          profile.avatar,
        title:
          data.title ??
          draftProfile.title,
        username:
          data.username ??
          draftProfile.username,
        teamId:
          data.teamId ??
          profile.teamId,
        teamName:
          data.teamName ??
          profile.teamName,
        isOwner:
          data.isOwner ??
          profile.isOwner,
      };

      setProfile(nextProfile);

      setDraftProfile({
        name: nextProfile.name ?? "",
        title: nextProfile.title ?? "",
        username:
          nextProfile.username ?? "",
        email: nextProfile.email ?? "",
      });

      setIsEditingEmail(false);

      if (nextProfile.name) {
        localStorage.setItem(
          "userName",
          nextProfile.name,
        );
      }

      if (nextProfile.email) {
        localStorage.setItem(
          "userEmail",
          nextProfile.email,
        );
      }

      setMessage(
        "Profile saved successfully.",
      );
    } catch (err) {
      console.error(
        "Failed to save profile:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save profile",
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // LEAVE WORKSPACE
  // =====================================================

  const leaveWorkspace = async () => {
    if (!profile.teamId) {
      setError(
        "You are not currently in a workspace.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Do you want to leave ${
        profile.teamName ||
        "this workspace"
      }?`,
    );

    if (!confirmed) {
      return;
    }

    const token =
      localStorage.getItem("authToken");

    if (!token) {
      setError(
        "Your session has expired. Please sign in again.",
      );
      return;
    }

    setLeaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/auth/team/leave`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Unable to leave workspace",
        );
      }

      // Keep authentication.
      // Only remove workspace-specific values.
      localStorage.removeItem("teamId");
      localStorage.removeItem(
        "teamName",
      );
      localStorage.removeItem(
        "isOwner",
      );
      localStorage.removeItem(
        "inviteCode",
      );

      setProfile((previous) => ({
        ...previous,
        teamId: null,
        teamName: null,
        isOwner: false,
      }));

      setMessage(
        "You left the workspace successfully.",
      );

      // Give the success message a moment
      // and then open workspace onboarding.
      window.setTimeout(() => {
        router.push("/");
      }, 500);
    } catch (err) {
      console.error(
        "Failed to leave workspace:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to leave workspace",
      );
    } finally {
      setLeaving(false);
    }
  };

  // =====================================================
  // SETTINGS NAVIGATION
  // =====================================================

  const filteredNav = useMemo(() => {
    const query =
      searchQuery
        .trim()
        .toLowerCase();

    const entries: Array<{
      key: NavKey;
      label: string;
    }> = [
      {
        key: "profile",
        label: "Profile",
      },
      {
        key: "theme",
        label: "Theme",
      },
      {
        key: "color",
        label: "Color",
      },
    ];

    if (!query) {
      return entries;
    }

    return entries.filter((entry) =>
      entry.label
        .toLowerCase()
        .includes(query),
    );
  }, [searchQuery]);

  return (
    <div className="flex min-h-screen w-full bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100 max-md:flex-col">
      {/* ===================================================
          SETTINGS SIDEBAR
      =================================================== */}

      <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 max-md:w-full max-md:border-b max-md:border-r-0 max-md:p-3">
        <div className="space-y-6">
          <button
            type="button"
            onClick={
              onBack ??
              (() => router.back())
            }
            className="flex items-center gap-2 text-xs font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />

            <input
              type="text"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Search"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-9 pr-3 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
            />
          </div>

          <nav className="space-y-1 max-md:flex max-md:gap-1 max-md:overflow-x-auto max-md:pb-1">
            {filteredNav.length ===
            0 ? (
              <p className="px-3 py-2 text-xs text-zinc-500">
                No settings found.
              </p>
            ) : (
              filteredNav.map(
                (entry) => {
                  const Icon =
                    entry.key ===
                    "profile"
                      ? User
                      : entry.key ===
                        "theme"
                      ? Sun
                      : Square;

                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() =>
                        setActiveNav(
                          entry.key,
                        )
                      }
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition max-md:w-auto max-md:min-w-max ${
                        activeNav ===
                        entry.key
                          ? "bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-white"
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 text-zinc-500" />
                      {entry.label}
                    </button>
                  );
                },
              )
            )}
          </nav>
        </div>
      </aside>

      {/* ===================================================
          MAIN
      =================================================== */}

      <main className="flex min-w-0 flex-1 justify-center overflow-y-auto px-6 pb-12 pt-16 dark:bg-zinc-950 md:px-12 max-md:w-full max-md:px-4 max-md:pb-8 max-md:pt-6">
        <div className="w-full max-w-3xl">
          {activeNav === "profile" && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">
                  Profile
                </h1>

                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Manage the profile
                  information used
                  across your
                  workspace.
                </p>
              </div>

              {message && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {message}
                </div>
              )}

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="mb-10 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {loading ? (
                  <div className="flex items-center gap-2 px-6 py-8 text-xs text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading profile...
                  </div>
                ) : (
                  <>
                    {/* Profile picture */}

                    <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
                      <span className="text-xs font-medium">
                        Profile picture
                      </span>

                      {profile.avatar ? (
                        <img
                          src={
                            profile.avatar
                          }
                          alt={
                            profile.name ||
                            "Profile"
                          }
                          className="h-10 w-10 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
                        />
                      ) : (
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${activeColor.preview}`}
                        >
                          {(
                            profile.name ||
                            profile.email ||
                            "U"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Email */}

                    <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
                      <div>
                        <span className="block text-xs font-medium">
                          Email
                        </span>

                        <span className="text-[11px] text-zinc-500">
                          Your account
                          email address
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEditingEmail ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="email"
                              value={
                                draftProfile.email
                              }
                              onChange={(
                                event,
                              ) =>
                                setDraftProfile(
                                  (
                                    previous,
                                  ) => ({
                                    ...previous,
                                    email:
                                      event
                                        .target
                                        .value,
                                  }),
                                )
                              }
                              className="w-56 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs outline-none transition focus:border-zinc-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-zinc-500 dark:focus:bg-zinc-800"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                setIsEditingEmail(
                                  false,
                                )
                              }
                              className="rounded-lg bg-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-600 dark:text-zinc-300">
                              {draftProfile.email ||
                                profile.email ||
                                "Not available"}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                setIsEditingEmail(
                                  true,
                                )
                              }
                              className="rounded-md p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              aria-label="Edit email"
                              title="Edit email"
                            >
                              <Pencil className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Full name */}

                    <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
                      <span className="text-xs font-medium">
                        Full name
                      </span>

                      <div className="w-64">
                        <input
                          type="text"
                          value={
                            draftProfile.name
                          }
                          onChange={(
                            event,
                          ) =>
                            setDraftProfile(
                              (
                                previous,
                              ) => ({
                                ...previous,
                                name:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs outline-none transition focus:border-zinc-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-zinc-500 dark:focus:bg-zinc-800"
                        />
                      </div>
                    </div>

                    {/* Title */}

                    <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
                      <div>
                        <span className="block text-xs font-medium">
                          Title
                        </span>

                        <span className="text-[11px] text-zinc-500">
                          Your job title
                          or role
                        </span>
                      </div>

                      <div className="w-64">
                        <input
                          type="text"
                          value={
                            draftProfile.title
                          }
                          onChange={(
                            event,
                          ) =>
                            setDraftProfile(
                              (
                                previous,
                              ) => ({
                                ...previous,
                                title:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs outline-none transition focus:border-zinc-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-zinc-500 dark:focus:bg-zinc-800"
                        />
                      </div>
                    </div>

                    {/* Username */}

                    <div className="flex items-center justify-between px-6 py-4">
                      <div>
                        <span className="block text-xs font-medium">
                          Username
                        </span>

                        <span className="text-[11px] text-zinc-500">
                          One word, like
                          a nickname or
                          first name
                        </span>
                      </div>

                      <div className="w-64">
                        <input
                          type="text"
                          value={
                            draftProfile.username
                          }
                          onChange={(
                            event,
                          ) =>
                            setDraftProfile(
                              (
                                previous,
                              ) => ({
                                ...previous,
                                username:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs outline-none transition focus:border-zinc-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-zinc-500 dark:focus:bg-zinc-800"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Save */}

              {!loading && (
                <div className="mb-10 flex justify-end">
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={saving}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${activeColor.preview}`}
                  >
                    {saving && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Save changes
                  </button>
                </div>
              )}

              {/* Workspace */}

              <div className="space-y-3">
                <h2 className="text-sm font-semibold">
                  Workspace access
                </h2>

                <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300">
                      {profile.teamName
                        ? `Leave ${profile.teamName}`
                        : "Workspace membership"}
                    </p>

                    <p className="mt-1 text-[11px] text-zinc-500">
                      {profile.teamName
                        ? "You will lose access to this workspace."
                        : "You are not currently a member of a workspace."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      leaveWorkspace
                    }
                    disabled={
                      leaving ||
                      !profile.teamId
                    }
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                  >
                    {leaving
                      ? "Leaving..."
                      : "Leave Workspace"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ===================================================
              THEME
          =================================================== */}

          {activeNav === "theme" && (
            <section>
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">
                  Theme
                </h1>

                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Choose how the application
                  should look.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {(
                  ["light", "dark"] as ThemeMode[]
                ).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      setTheme(mode)
                    }
                    className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-3 text-xs font-medium capitalize">
                      {mode === "light" ? (
                        <Sun className="h-4 w-4 text-zinc-500" />
                      ) : (
                        <Moon className="h-4 w-4 text-zinc-500" />
                      )}
                      {mode}
                    </span>

                    {theme === mode && (
                      <Check className="h-4 w-4 text-emerald-500" />
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ===================================================
              COLOR
          =================================================== */}

          {activeNav === "color" && (
            <section>
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">
                  Color
                </h1>

                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Choose the accent color
                  used by interactive UI
                  elements.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COLOR_OPTIONS.map(
                  (option) => (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() =>
                        setAccentColor(
                          option.name,
                        )
                      }
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    >
                      <span className="flex items-center gap-3 text-xs font-medium">
                        <span
                          className={`h-7 w-7 rounded-full ${option.swatch}`}
                        />
                        {option.name}
                      </span>

                      {accentColor ===
                        option.name && (
                        <Check className="h-4 w-4 text-emerald-500" />
                      )}
                    </button>
                  ),
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}