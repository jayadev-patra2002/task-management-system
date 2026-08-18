"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, PlusCircle, LogIn } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
 const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("authToken");
      // 👈 Updated URL to match your NestJS Controller (@Controller("auth") + @Post("team/create"))
      const response = await fetch(`${API_URL}/auth/team/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: teamName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create team");
      }

      localStorage.setItem("teamId", data.teamId);
      localStorage.setItem("teamName", data.name);
      localStorage.setItem("inviteCode", data.inviteCode); // 👈 Save invite code
      router.replace("/tasks");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("authToken");
      // 👈 Updated URL to match your NestJS Controller (@Controller("auth") + @Post("team/join"))
      const response = await fetch(`${API_URL}/auth/team/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inviteCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to join team");
      }

      localStorage.setItem("teamId", data.teamId);
      localStorage.setItem("teamName", data.name);
      localStorage.setItem("inviteCode", data.inviteCode); // 👈 Save invite code
      router.replace("/tasks");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 mb-4">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome to Workspace
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Create a new team workspace or join an existing one to start collaborating.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        {mode === "choose" && (
          <div className="space-y-4">
            <button
              onClick={() => setMode("create")}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 font-medium transition-transform active:scale-[0.98]"
            >
              <PlusCircle className="h-5 w-5" />
              Create a New Team
            </button>
            <button
              onClick={() => setMode("join")}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-transparent text-gray-700 dark:text-zinc-200 py-3 font-medium transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              <LogIn className="h-5 w-5" />
              Join an Existing Team
            </button>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-2">
                Team Workspace Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Engineering Squad"
                required
                className="w-full rounded-xl border border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="w-1/3 rounded-xl border border-gray-300 dark:border-zinc-700 py-3 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Team"}
              </button>
            </div>
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={handleJoinTeam} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-2">
                Team Invite Code / ID
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Enter team code"
                required
                className="w-full rounded-xl border border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="w-1/3 rounded-xl border border-gray-300 dark:border-zinc-700 py-3 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Joining..." : "Join Team"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}