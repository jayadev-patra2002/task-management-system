"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  Share2,
  FolderKanban,
  LayoutGrid,
  Moon,
  Settings,
  Sun,
  UserPlus,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [themeMenuPosition, setThemeMenuPosition] = useState({ top: 0, left: 0 });
  const [isColorModeMenuOpen, setIsColorModeMenuOpen] = useState(false);
  const [colorModeMenuPosition, setColorModeMenuPosition] = useState({ top: 0, left: 0 });
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("appTheme") === "dark" ? "dark" : "light";
  });
  const [accentColor, setAccentColor] = useState<"Amber" | "Blue" | "Pink" | "Rose" | "Emerald" | "Black">(() => {
    if (typeof window === "undefined") return "Pink";
    const stored = localStorage.getItem("accentColor");
    return ["Amber", "Blue", "Pink", "Rose", "Emerald", "Black"].includes(stored || "")
      ? (stored as "Amber" | "Blue" | "Pink" | "Rose" | "Emerald" | "Black")
      : "Pink";
  });
  const [copied, setCopied] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const [userProfile, setUserProfile] = useState({
    displayName: "Dexter",
    displayInitial: "D",
    userImage: null as string | null,
  });

  const [userEmail, setUserEmail] = useState("Dexter@gmail.com");

  const [teamName, setTeamName] = useState("My Workspace");
  const [inviteCode, setInviteCode] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api";
  const fetchTeamMembers = async () => {
    setLoadingMembers(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/auth/team/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setTeamMembers(data);
      }
    } catch (error) {
      console.error("Failed to fetch team members:", error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleThemeChange = (theme: "light" | "dark") => {
    setCurrentTheme(theme);
    localStorage.setItem("appTheme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    setIsThemeMenuOpen(false);
  };

  const colorOptions = [
    { name: "Amber", colorClass: "bg-amber-500" },
    { name: "Blue", colorClass: "bg-purple-600" },
    { name: "Pink", colorClass: "bg-pink-500" },
    { name: "Rose", colorClass: "bg-rose-500" },
    { name: "Emerald", colorClass: "bg-emerald-500" },
    { name: "Black", colorClass: "bg-slate-900 dark:bg-zinc-100" },
  ] as const;

  const accentPalette = {
    Amber: { value: "#f59e0b", hover: "#d97706", foreground: "#ffffff" },
    Blue: { value: "#9333ea", hover: "#7e22ce", foreground: "#ffffff" },
    Pink: { value: "#ec4899", hover: "#db2777", foreground: "#ffffff" },
    Rose: { value: "#f43f5e", hover: "#e11d48", foreground: "#ffffff" },
    Emerald: { value: "#10b981", hover: "#059669", foreground: "#ffffff" },
    Black: { value: "#0f172a", hover: "#020617", foreground: "#ffffff" },
  } as const;

  const applyAccentToDocument = (color: typeof colorOptions[number]["name"]) => {
    const palette = accentPalette[color];
    document.documentElement.style.setProperty("--app-accent", palette.value);
    document.documentElement.style.setProperty("--app-accent-hover", palette.hover);
    document.documentElement.style.setProperty("--app-accent-foreground", palette.foreground);
  };

  const handleColorModeChange = (color: typeof colorOptions[number]["name"]) => {
    setAccentColor(color);
    localStorage.setItem("accentColor", color);
    applyAccentToDocument(color);
    window.dispatchEvent(new CustomEvent("accent-color-change", { detail: color }));
    setIsColorModeMenuOpen(false);
  };

  const accentColorClass = colorOptions.find((item) => item.name === accentColor)?.colorClass ?? "bg-pink-500";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", currentTheme === "dark");
  }, [currentTheme]);

  useEffect(() => {
    applyAccentToDocument(accentColor);
  }, [accentColor]);

  useEffect(() => {
    const handleAuthAndProfile = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");

        if (urlToken) {
          localStorage.setItem("authToken", urlToken);
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const token = localStorage.getItem("authToken");

        const storedTeamName = localStorage.getItem("teamName");
        if (storedTeamName) setTeamName(storedTeamName);

        const storedInviteCode = localStorage.getItem("inviteCode");
        if (storedInviteCode) setInviteCode(storedInviteCode);

        const storedIsOwner = localStorage.getItem("isOwner") === "true";
        setIsOwner(storedIsOwner);

        if (token === "guest-token-default") {
          setUserProfile({
            displayName: "Dexter",
            displayInitial: "D",
            userImage: null,
          });
          setUserEmail("dexter@guest.com");
          setTeamName("Guest Workspace");
          return;
        }

        if (token && token.startsWith("google-token-")) {
          try {
            const response = await fetch(`${API_URL}/auth/profile`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            const data = await response.json();

            if (data && !data.error && data.email) {
              const emailName = data.email.split("@")[0];
              const formattedName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
              const finalName = data.name || formattedName;
              const finalAvatar = data.avatar || null;

              localStorage.setItem("userEmail", data.email);
              localStorage.setItem("userName", finalName);
              setUserEmail(data.email);

              if (finalAvatar) {
                localStorage.setItem("userAvatar", finalAvatar);
              } else {
                localStorage.removeItem("userAvatar");
              }

              if (data.teamId) {
                localStorage.setItem("teamId", data.teamId);
                const activeTeamName = data.teamName || "My Workspace";
                localStorage.setItem("teamName", activeTeamName);
                setTeamName(activeTeamName);

                // Precise check if current user is the owner/creator of the team
                const userIsOwner = Boolean(data.isOwner);
                setIsOwner(userIsOwner);

                if (userIsOwner) {
                  localStorage.setItem("isOwner", "true");
                  if (data.inviteCode) {
                    localStorage.setItem("inviteCode", data.inviteCode);
                    setInviteCode(data.inviteCode);
                  } else {
                    localStorage.removeItem("inviteCode");
                    setInviteCode("");
                  }
                } else {
                  localStorage.removeItem("isOwner");
                  localStorage.removeItem("inviteCode");
                  setInviteCode("");
                }
              } else {
                localStorage.removeItem("teamId");
                localStorage.removeItem("teamName");
                localStorage.removeItem("inviteCode");
                localStorage.removeItem("isOwner");
                setTeamName("My Workspace");
                setInviteCode("");
                setIsOwner(false);
              }

              setUserProfile({
                displayName: finalName,
                displayInitial: finalName.charAt(0).toUpperCase(),
                userImage: finalAvatar,
              });

              if (data.teamId) {
                fetchTeamMembers();
              }
              return;
            }
          } catch (error) {
            console.error("Failed to fetch Google profile:", error);
          }
        }

        const storedName = localStorage.getItem("userName");
        const storedEmail = localStorage.getItem("userEmail");
        const storedAvatar = localStorage.getItem("userAvatar");

        if (storedName) {
          setUserProfile({
            displayName: storedName,
            displayInitial: storedName.charAt(0).toUpperCase(),
            userImage: storedAvatar || null,
          });
        }

        if (storedEmail) {
          setUserEmail(storedEmail);
        }

        if (localStorage.getItem("teamId")) {
          fetchTeamMembers();
        }
      } catch (error) {
        console.error("Sidebar authentication error:", error);
      }
    };

    handleAuthAndProfile();
  }, []);

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
const handleShareWorkspace = async () => {
  if (!inviteCode) return;

  const shareUrl = `${window.location.origin}/join?inviteCode=${encodeURIComponent(
    inviteCode,
  )}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: `${teamName} Workspace`,
        text: `Join my ${teamName} workspace using this invite code: ${inviteCode}`,
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  } catch (error) {
    // User closing the native share sheet is not an error.
    if ((error as DOMException)?.name !== "AbortError") {
      console.error("Failed to share workspace:", error);
    }
  }
};
  const handleAvatarError = () => {
    localStorage.removeItem("userAvatar");
    setUserProfile((previous) => ({ ...previous, userImage: null }));
  };

  const goToTasks = () => router.push("/tasks");
  const goToProjects = () => router.push("/projects");

// Updated code
const isTasksPage =
  pathname === "/tasks" || pathname.startsWith("/projects/");
  
const isProjectsPage = pathname === "/projects";

  return (
    <aside className="flex h-full w-full flex-col bg-white px-5 pt-5 dark:bg-zinc-950 overflow-y-auto">
      {/* ======================================================
          USER PROFILE & DROPDOWN MENU
      ====================================================== */}
      <div className="relative flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => {
            setIsAccountMenuOpen((prev) => !prev);
            setIsProfileMenuOpen(false);
          }}
          className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-gray-50 dark:hover:bg-zinc-900"
          aria-label="Open profile menu"
          aria-expanded={isAccountMenuOpen}
        >
          {userProfile.userImage ? (
            <img
              src={userProfile.userImage}
              alt={userProfile.displayName}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
              onError={handleAvatarError}
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700 dark:bg-zinc-800 dark:text-white">
              {userProfile.displayInitial}
            </div>
          )}
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {userProfile.displayName}
          </span>
        </button>

        {/* Existing workspace-members/invite menu remains on the chevron. */}
        <button
          type="button"
          onClick={() => {
            setIsProfileMenuOpen((prev) => {
              const nextState = !prev;
              if (nextState && teamMembers.length === 0) {
                fetchTeamMembers();
              }
              return nextState;
            });
            setIsAccountMenuOpen(false);
          }}
          className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          aria-label="Workspace options"
        >
          <ChevronsUpDown className="h-4 w-4" />
        </button>

        {/* New profile card: only profile information for now. */}
        {isAccountMenuOpen && (
          <div className="absolute left-0 top-11 z-50 w-[215px] rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col items-center text-center">
              {userProfile.userImage ? (
                <img
                  src={userProfile.userImage}
                  alt={userProfile.displayName}
                  className="h-14 w-14 rounded-full object-cover"
                  onError={handleAvatarError}
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-lg font-semibold text-gray-700 dark:bg-zinc-800 dark:text-white">
                  {userProfile.displayInitial}
                </div>
              )}

              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                {userProfile.displayName}
              </p>
              <p className="mt-0.5 max-w-full truncate text-xs text-gray-500 dark:text-zinc-400">
                {userEmail}
              </p>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-3 dark:border-zinc-800">
              <div className="relative space-y-1">
                <div className="relative">
                  <button
                    type="button"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setThemeMenuPosition({ top: rect.top, left: rect.right + 8 });
                      setIsThemeMenuOpen((prev) => !prev);
                      setIsColorModeMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <Sun className="h-3.5 w-3.5 text-gray-500 dark:text-zinc-400" />
                      <span>Change Theme</span>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isThemeMenuOpen ? "rotate-90" : ""}`} />
                  </button>

                  {isThemeMenuOpen && (
                    <div
                      className="fixed z-[9999] w-36 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
                      style={{ top: themeMenuPosition.top, left: themeMenuPosition.left }}
                    >
                      <p className="px-2 py-1 text-[10px] font-medium text-gray-400">Theme</p>
                      <button
                        type="button"
                        onClick={() => handleThemeChange("light")}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-800"
                      >
                        <div className="flex items-center gap-2">
                          <Sun className="h-3.5 w-3.5 text-gray-400" />
                          <span>Light</span>
                        </div>
                        {currentTheme === "light" && <Check className="h-3.5 w-3.5 text-gray-700 dark:text-white" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleThemeChange("dark")}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-800"
                      >
                        <div className="flex items-center gap-2">
                          <Moon className="h-3.5 w-3.5 text-gray-400" />
                          <span>Dark</span>
                        </div>
                        {currentTheme === "dark" && <Check className="h-3.5 w-3.5 text-gray-700 dark:text-white" />}
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setColorModeMenuPosition({ top: rect.top, left: rect.right + 8 });
                      setIsColorModeMenuOpen((prev) => !prev);
                      setIsThemeMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-3.5 w-3.5 rounded-sm ${accentColorClass}`} />
                      <span>Color Mode</span>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isColorModeMenuOpen ? "rotate-90" : ""}`} />
                  </button>

                  {isColorModeMenuOpen && (
                    <div
                      className="fixed z-[9999] w-40 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
                      style={{ top: colorModeMenuPosition.top, left: colorModeMenuPosition.left }}
                    >
                      <p className="px-2.5 py-1 text-[10px] font-medium text-gray-400">Color Mode</p>
                      {colorOptions.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => handleColorModeChange(item.name)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-800"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`h-3.5 w-3.5 rounded ${item.colorClass}`} />
                            <span>{item.name}</span>
                          </div>
                          {accentColor === item.name && <Check className="h-3.5 w-3.5 text-gray-700 dark:text-white" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsThemeMenuOpen(false);
                    setIsColorModeMenuOpen(false);
                    setIsAccountMenuOpen(false);
                    router.push("/profile");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="h-3.5 w-3.5 text-gray-500 dark:text-zinc-400" />
                    <span>Settings</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            DROPDOWN POPUP: INVITE CODE & WORKSPACE MEMBERS
        ==================================================== */}
        {isProfileMenuOpen && (
          <div className="absolute left-3 right-3 top-11 z-55 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            
            {/* Invite Code Section (Only shown if the user is the owner/creator) */}
            {isOwner && inviteCode && (
              <div className="mb-3.5 border-b border-gray-100 pb-3.5 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  <UserPlus className="h-3.5 w-3.5 text-gray-400" />
                  <span>Workspace Invite Code</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 p-2 dark:bg-zinc-800">
                  <span className="font-mono text-[11px] font-bold tracking-tight text-gray-800 dark:text-zinc-200 truncate select-all flex-1" title={inviteCode}>
                    {inviteCode}
                  </span>
                  <button
  type="button"
  onClick={handleShareWorkspace}
  className="flex shrink-0 items-center justify-center rounded-lg bg-white p-2 text-gray-700 shadow-sm transition-all hover:bg-gray-100 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
  title="Share workspace"
>
  <Share2 className="h-4 w-4 text-gray-500 dark:text-zinc-300" />
</button>
                </div>
              </div>
            )}

            {/* Workspace Members Section */}
            <p className="px-1 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Workspace Members
            </p>

            {loadingMembers ? (
              <div className="px-1 py-2 text-xs text-gray-500 dark:text-zinc-400">
                Loading members...
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="px-1 py-2 text-xs text-gray-500 dark:text-zinc-400">
                No members found
              </div>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {member.avatar ? (
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="h-6 w-6 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 dark:bg-zinc-700 dark:text-white">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-800 dark:text-zinc-200">
                        {member.name}
                      </p>
                      <p className="truncate text-[10px] text-gray-500 dark:text-zinc-400">
                        {member.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          
          </div>
        )}
      </div>

      {/* ======================================================
          WORKSPACE & NAVIGATION
      ====================================================== */}
      <div className="mt-7">
        <button
          type="button"
          onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
          className="mb-2 flex w-full items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 transition-colors hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <span className="truncate">{teamName}</span>
          {isWorkspaceOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
        </button>

        {isWorkspaceOpen && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={goToTasks}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-colors ${
                isTasksPage
                  ? "bg-gray-100 font-medium text-gray-900 dark:bg-zinc-800 dark:text-white"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
              }`}
            >
              <LayoutGrid className={`h-4 w-4 ${isTasksPage ? "text-gray-800 dark:text-white" : "text-gray-500 dark:text-zinc-400"}`} />
              <span>Tasks</span>
            </button>

            <button
              type="button"
              onClick={goToProjects}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-colors ${
                isProjectsPage
                  ? "bg-gray-100 font-medium text-gray-900 dark:bg-zinc-800 dark:text-white"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
              }`}
            >
              <FolderKanban className={`h-4 w-4 ${isProjectsPage ? "text-gray-800 dark:text-white" : "text-gray-500 dark:text-zinc-400"}`} />
              <span>Projects</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
