"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ProjectsDashboard from "@/components/task-dashboard/ProjectsDashboard";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface ProjectSummary {
  id: string;
  name: string;
}

export default function ProjectTasksPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadProject = async () => {
      const userId = window.localStorage.getItem("userId");
      const token = window.localStorage.getItem("authToken");

      if (!userId) {
        if (mounted) {
          setError("User session not found. Please login again.");
        }
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/projects/${encodeURIComponent(
            params.projectId,
          )}?userId=${encodeURIComponent(userId)}`,
          {
            cache: "no-store",
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : undefined,
          },
        );

        if (!response.ok) {
          throw new Error(
            "Project not found or unavailable to your team",
          );
        }

        const current = (await response.json()) as ProjectSummary;

        if (mounted) {
          setProject(current);
        }
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load project",
          );
        }
      }
    };

    void loadProject();

    return () => {
      mounted = false;
    };
  }, [params.projectId]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-zinc-950">
        <div className="max-w-md text-center">
          <p className="text-sm text-gray-600 dark:text-zinc-300">
            {error}
          </p>

          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="mt-4 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-500 dark:bg-zinc-950 dark:text-zinc-400">
        Loading project…
      </div>
    );
  }

  return (
    <ProjectsDashboard
      projectId={project.id}
      projectName={project.name}
    />
  );
}

