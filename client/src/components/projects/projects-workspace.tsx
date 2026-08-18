"use client";

import {
    CalendarDays,
    Check,
    ChevronRight,
    CircleAlert,
    CircleDot,
    Columns3,
    Ellipsis,
    Filter,
    FolderKanban,
    LayoutPanelLeft,
    Pencil,
    Plus,
    Search,
    SignalHigh,
    SignalLow,
    SignalMedium,
    Trash2,
    UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import Sidebar from "@/components/shared/sidebar";

import {
    emptyProjectForm,
    ProjectFormValues,
    ProjectItem,
    ProjectPriority,
    TeamMember,
} from "../../types/project-types";
import ProjectFormModal from "./project-form-modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function PriorityBadge({ priority }: { priority: ProjectPriority }) {
  switch (priority) {
    case "Urgent":
      return <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-red-500"><SignalHigh className="h-3 w-3 shrink-0" />Urgent</span>;
    case "High":
      return <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-orange-500"><SignalHigh className="h-3 w-3 shrink-0" />High</span>;
    case "Medium":
      return <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-amber-500"><SignalMedium className="h-3 w-3 shrink-0" />Medium</span>;
    case "Low":
      return <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-gray-400"><SignalLow className="h-3 w-3 shrink-0" />Low</span>;
    case "No Priority":
    default:
      return <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-gray-400"><SignalLow className="h-3 w-3 shrink-0" />No Priority</span>;
  }
}

const projectPriorities: ProjectPriority[] = [
  "No Priority",
  "Urgent",
  "High",
  "Medium",
  "Low",
];

type VisibleColumns = {
  status: boolean;
  priority: boolean;
  lead: boolean;
  dueDate: boolean;
};

type DueDateFilter = "all" | "overdue" | "upcoming" | "none";
type ProjectStatusFilter = "all" | string;

interface ProjectsWorkspaceProps {
  projectId?: string;
}

function formatDateForPicker(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 3) return "";

  const [day, monthName, year] = parts;
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };

  const month = months[monthName];
  if (!month || !/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(day)) {
    return "";
  }

  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function formatDateForStorage(value: string | null | undefined): string {
  if (!value) return "";

  const trimmed = value.trim();

  // HTML <input type="date"> already gives YYYY-MM-DD.
  // Send this exact format to the backend so parseDueDate()
  // can convert it to Prisma DateTime.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Also accept an ISO DateTime if one is ever passed in.
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // Backward compatibility for "25 Aug 2026".
  const match = trimmed.match(
    /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/,
  );

  if (!match) return "";

  const [, day, monthName, year] = match;

  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  const month = months[monthName];

  if (!month) return "";

  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function formatDate(value: string | null) {
  if (!value) return "No due date";

  const pickerValue = formatDateForPicker(value);
  if (!pickerValue) return value;

  const date = new Date(`${pickerValue}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function getLeadId(lead: unknown): string {
  if (typeof lead === "string") return lead;

  if (typeof lead === "object" && lead !== null) {
    const value = lead as { id?: unknown };
    return typeof value.id === "string" ? value.id : "";
  }

  return "";
}

function getLeadName(lead: unknown, members: TeamMember[] = []): string {
  if (typeof lead === "string") {
    const member = members.find((item) => item.id === lead);
    return member?.name || member?.email || "Unassigned";
  }

  if (typeof lead === "object" && lead !== null) {
    const value = lead as { id?: unknown; name?: unknown; email?: unknown };

    if (typeof value.name === "string" && value.name) return value.name;
    if (typeof value.email === "string" && value.email) return value.email;

    if (typeof value.id === "string") {
      const member = members.find((item) => item.id === value.id);
      return member?.name || member?.email || "Unassigned";
    }
  }

  return "Unassigned";
}

function initials(value: string | null | undefined) {
  if (!value) {
    return "+";
  }

  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

async function getApiError(response: Response, fallback: string) {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const data = body as Record<string, unknown>;
      if (typeof data.message === "string") {
        return data.message;
      }
      if (typeof data.error === "string") {
        return data.error;
      }
    }
  } catch {
    // A non-JSON response still gets the friendly fallback message.
  }

  return fallback;
}

export default function ProjectsWorkspace({ projectId }: ProjectsWorkspaceProps) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    status: true,
    priority: true,
    lead: true,
    dueDate: true,
  });
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<ProjectPriority | "all">(
    "all",
  );
  const [leadFilter, setLeadFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>("all");
  const [isFieldsOpen, setIsFieldsOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [formValues, setFormValues] = useState<ProjectFormValues>(emptyProjectForm);
  const [isSaving, setIsSaving] = useState(false);

  const fieldsRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  const loadWorkspaceData = useCallback(async () => {
    const userId = window.localStorage.getItem("userId");
    const token = window.localStorage.getItem("authToken");

    if (!userId) {
      setError("Sign in with a workspace account before viewing projects.");
      setIsLoading(false);
      return;
    }

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    setIsLoading(true);
    setError("");

    try {
      const [projectResponse, membersResponse] = await Promise.all([
        fetch(
          projectId
            ? `${API_URL}/projects/${encodeURIComponent(projectId)}?userId=${encodeURIComponent(userId)}`
            : `${API_URL}/projects?userId=${encodeURIComponent(userId)}`,
          { cache: "no-store", headers },
        ),
        fetch(`${API_URL}/auth/team/members`, { cache: "no-store", headers }),
      ]);

      if (!projectResponse.ok) {
        throw new Error(
          await getApiError(projectResponse, "Unable to load projects"),
        );
      }

      const projectData: unknown = await projectResponse.json();
      if (projectId) {
        if (typeof projectData !== "object" || projectData === null) {
          throw new Error("The project response was invalid");
        }
        setProject(projectData as ProjectItem);
      } else if (Array.isArray(projectData)) {
        setProjects(projectData as ProjectItem[]);
      } else {
        throw new Error("The projects response was invalid");
      }

      if (membersResponse.ok) {
        const membersData: unknown = await membersResponse.json();
        setMembers(Array.isArray(membersData) ? (membersData as TeamMember[]) : []);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load projects",
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadWorkspaceData();
  }, 0);

  return () => {
    window.clearTimeout(timer);
  };
}, [loadWorkspaceData]);
  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Element | null;

      if (!fieldsRef.current?.contains(target)) {
        setIsFieldsOpen(false);
      }

      if (!filtersRef.current?.contains(target)) {
        setIsFilterOpen(false);
      }

      if (!target?.closest("[data-project-action-menu]")) {
        setActionMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, []);

  const filteredProjects = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekValue = nextWeek.toISOString().slice(0, 10);
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return projects.filter((item) => {
      const leadId = getLeadId(item.lead);
      const leadName = getLeadName(item.lead, members);
      const normalizedDueDate = formatDateForPicker(item.dueDate);

      const matchesSearch =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        leadName.toLowerCase().includes(normalizedQuery);

      const normalizedStatus = item.status?.trim() || "To Do";

      const matchesStatus =
        statusFilter === "all" || normalizedStatus === statusFilter;

      const matchesPriority =
        priorityFilter === "all" || item.priority === priorityFilter;

      const matchesLead =
        leadFilter === "all" ||
        (leadFilter === "unassigned" ? !leadId : leadId === leadFilter);

      const matchesDueDate =
        dueDateFilter === "all" ||
        (dueDateFilter === "none" && !normalizedDueDate) ||
        (dueDateFilter === "overdue" &&
          Boolean(normalizedDueDate && normalizedDueDate < today)) ||
        (dueDateFilter === "upcoming" &&
          Boolean(
            normalizedDueDate &&
            normalizedDueDate >= today &&
            normalizedDueDate <= nextWeekValue,
          ));

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesLead &&
        matchesDueDate
      );
    });
  }, [
    dueDateFilter,
    leadFilter,
    members,
    priorityFilter,
    projects,
    searchQuery,
    statusFilter,
  ]);

  const hasFilters =
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    leadFilter !== "all" ||
    dueDateFilter !== "all";

  const openCreateForm = () => {
    setEditingProject(null);
    setFormValues(emptyProjectForm);
    setIsFormOpen(true);
  };

  const openEditForm = (item: ProjectItem) => {
    setEditingProject(item);

    setFormValues({
      name: item.name,
      priority: item.priority,
      leadId: getLeadId(item.lead),
      dueDate: formatDateForPicker(item.dueDate),
      status: item.status || "To Do",
    });

    setIsFormOpen(true);
    setActionMenuId(null);
  };

  const closeForm = () => {
    if (!isSaving) {
      setIsFormOpen(false);
      setEditingProject(null);
    }
  };

  const saveProject = async () => {
    const userId = window.localStorage.getItem("userId");
    const token = window.localStorage.getItem("authToken");
    if (!userId) {
      setError("Your session is missing a user ID. Please sign in again.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(
        editingProject
          ? `${API_URL}/projects/${encodeURIComponent(editingProject.id)}`
          : `${API_URL}/projects`,
        {
          method: editingProject ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            userId,
            name: formValues.name,
            priority: formValues.priority,
            status: formValues.status,
            lead: formValues.leadId || null,
            dueDate: formatDateForStorage(formValues.dueDate),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await getApiError(response, "Unable to save project"));
      }

      const savedProject = (await response.json()) as ProjectItem;
      setProjects((current) => {
        const exists = current.some((item) => item.id === savedProject.id);
        return exists
          ? current.map((item) => (item.id === savedProject.id ? savedProject : item))
          : [savedProject, ...current];
      });
      setProject(savedProject);
      setIsFormOpen(false);
      setEditingProject(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save project",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProject = async (item: ProjectItem) => {
    if (!window.confirm(`Delete “${item.name}”? Tasks will remain, but no longer belong to this project.`)) {
      return;
    }

    const userId = window.localStorage.getItem("userId");
    const token = window.localStorage.getItem("authToken");
    if (!userId) {
      setError("Your session is missing a user ID. Please sign in again.");
      return;
    }

    setActionMenuId(null);
    try {
      const response = await fetch(`${API_URL}/projects/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(await getApiError(response, "Unable to delete project"));
      }

      setProjects((current) => current.filter((entry) => entry.id !== item.id));
      if (projectId === item.id) {
        router.push("/projects");
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete project",
      );
    }
  };

  const toggleColumn = (key: keyof VisibleColumns) => {
    setVisibleColumns((current) => ({ ...current, [key]: !current[key] }));
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setLeadFilter("all");
    setDueDateFilter("all");
  };

  const content = projectId ? (
    <ProjectDetail
      project={project}
      isLoading={isLoading}
      error={error}
      onBack={() => router.push("/projects")}
      onEdit={() => project && openEditForm(project)}
      onDelete={() => project && void deleteProject(project)}
    />
  ) : (
    <ProjectList
      projects={filteredProjects}
      isLoading={isLoading}
      error={error}
      searchQuery={searchQuery}
      visibleColumns={visibleColumns}
      statusFilter={statusFilter}
      priorityFilter={priorityFilter}
      leadFilter={leadFilter}
      dueDateFilter={dueDateFilter}
      hasFilters={hasFilters}
      actionMenuId={actionMenuId}
      fieldsRef={fieldsRef}
      filtersRef={filtersRef}
      members={members}
      onSearchChange={setSearchQuery}
      onToggleFields={() => setIsFieldsOpen((current) => !current)}
      isFieldsOpen={isFieldsOpen}
      onToggleColumn={toggleColumn}
      onToggleFilter={() => setIsFilterOpen((current) => !current)}
      isFilterOpen={isFilterOpen}
      onStatusFilterChange={setStatusFilter}
      onPriorityFilterChange={setPriorityFilter}
      onLeadFilterChange={setLeadFilter}
      onDueDateFilterChange={setDueDateFilter}
      onClearFilters={resetFilters}
      onCreate={openCreateForm}
      onSelect={(item) => router.push(`/projects/${item.id}`)}
      onToggleActions={(id) => setActionMenuId((current) => (current === id ? null : id))}
      onEdit={openEditForm}
      onDelete={(item) => void deleteProject(item)}
    />
  );

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-white text-gray-800 dark:bg-zinc-950 dark:text-zinc-100">
      <div
        className={`shrink-0 overflow-hidden border-r border-gray-200 transition-all duration-300 dark:border-zinc-800 ${
          isSidebarOpen
            ? "w-64 max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:h-screen max-lg:shadow-2xl"
            : "w-0 border-r-0"
        }`}
      >
        <div className="h-full w-64">
          <Sidebar />
        </div>
      </div>

      <main className="flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
        <header className="flex h-[70px] shrink-0 items-center gap-3 border-b border-gray-200 px-3 sm:gap-4 sm:px-5 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((current) => !current)}
            className="relative z-[70] shrink-0 rounded-md p-1.5 text-gray-600 transition hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <LayoutPanelLeft className="h-4 w-4" />
          </button>
          {projectId && project ? (
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="text-gray-500 transition hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
              >
                Projects
              </button>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="truncate font-medium text-gray-900 dark:text-white">
                {project.name}
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">Projects</span>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8">{content}</div>
      </main>

      <ProjectFormModal
        isOpen={isFormOpen}
        isSaving={isSaving}
        values={formValues}
        members={members}
        mode={editingProject ? "edit" : "create"}
        onChange={setFormValues}
        onClose={closeForm}
        onSubmit={() => void saveProject()}
      />
    </div>
  );
}

interface ProjectListProps {
  projects: ProjectItem[];
  isLoading: boolean;
  error: string;
  searchQuery: string;
  visibleColumns: VisibleColumns;
  statusFilter: ProjectStatusFilter;
  priorityFilter: ProjectPriority | "all";
  leadFilter: string;
  dueDateFilter: DueDateFilter;
  hasFilters: boolean;
  actionMenuId: string | null;
  fieldsRef: React.RefObject<HTMLDivElement | null>;
  filtersRef: React.RefObject<HTMLDivElement | null>;
  members: TeamMember[];
  isFieldsOpen: boolean;
  isFilterOpen: boolean;
  onSearchChange: (value: string) => void;
  onToggleFields: () => void;
  onToggleColumn: (key: keyof VisibleColumns) => void;
  onToggleFilter: () => void;
  onStatusFilterChange: (value: ProjectStatusFilter) => void;
  onPriorityFilterChange: (value: ProjectPriority | "all") => void;
  onLeadFilterChange: (value: string) => void;
  onDueDateFilterChange: (value: DueDateFilter) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  onSelect: (project: ProjectItem) => void;
  onToggleActions: (id: string) => void;
  onEdit: (project: ProjectItem) => void;
  onDelete: (project: ProjectItem) => void;
}

function ProjectList({
  projects,
  isLoading,
  error,
  searchQuery,
  visibleColumns,
  statusFilter,
  priorityFilter,
  leadFilter,
  dueDateFilter,
  hasFilters,
  actionMenuId,
  fieldsRef,
  filtersRef,
  members,
  isFieldsOpen,
  isFilterOpen,
  onSearchChange,
  onToggleFields,
  onToggleColumn,
  onToggleFilter,
  onStatusFilterChange,
  onPriorityFilterChange,
  onLeadFilterChange,
  onDueDateFilterChange,
  onClearFilters,
  onCreate,
  onSelect,
  onToggleActions,
  onEdit,
  onDelete,
}: ProjectListProps) {
  const tableColumnCount =
    1 +
    Number(visibleColumns.status) +
    Number(visibleColumns.priority) +
    Number(visibleColumns.lead) +
    Number(visibleColumns.dueDate) +
    1;

  const statusOptions = Array.from(
    new Set(
      projects.map((item) => item.status?.trim() || "To Do"),
    ),
  );

  const [openFilterSubmenu, setOpenFilterSubmenu] = useState<
    "status" | "priority" | "members" | "dueDate" | null
  >(null);

  const closeFilterSubmenu = () => setOpenFilterSubmenu(null);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">Projects</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex h-9 items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-gray-500" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search projects"
              className="w-44 rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[var(--app-accent)] sm:w-52 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </label>

          <div className="relative" ref={fieldsRef}>
            <button
              type="button"
              onClick={onToggleFields}
              className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${
                isFieldsOpen
                  ? "border-gray-300 bg-gray-50 text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" />
              Fields
            </button>

            {isFieldsOpen && (
              <div
                className="absolute right-0 top-11 z-30 w-[198px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-zinc-900"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="px-2.5 py-2 text-[11px] font-medium text-gray-400 dark:text-zinc-500">
                  Fields
                </div>

                {(
                  [
                    ["status", "Status", CircleDot],
                    ["priority", "Priority", SignalHigh],
                    ["lead", "Members", UsersRound],
                    ["dueDate", "Due Date", CalendarDays],
                  ] as Array<
                    [
                      keyof VisibleColumns,
                      string,
                      React.ComponentType<{ className?: string }>,
                    ]
                  >
                ).map(([key, label, Icon]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => onToggleColumn(key)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-gray-700 transition hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                      {label}
                    </span>

                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-[4px] border transition ${
                        visibleColumns[key]
                          ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-foreground)]"
                          : "border-gray-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
                      }`}
                    >
                      {visibleColumns[key] && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={filtersRef}>
            <button
              type="button"
              onClick={() => {
                onToggleFilter();
                setOpenFilterSubmenu(null);
              }}
              className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${
                hasFilters
                  ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                  : isFilterOpen
                    ? "border-gray-300 bg-gray-50 text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              
            </button>

            {isFilterOpen && (
              <div
                className="absolute right-0 top-11 z-30 flex"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="w-[194px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-zinc-900">
                  {(
                    [
                      ["status", "Status", CircleDot],
                      ["priority", "Priority", SignalHigh],
                      ["members", "Members", UsersRound],
                      ["dueDate", "Due Date", CalendarDays],
                    ] as Array<
                      [
                        "status" | "priority" | "members" | "dueDate",
                        string,
                        React.ComponentType<{ className?: string }>,
                      ]
                    >
                  ).map(([key, label, Icon]) => {
                    const active =
                      openFilterSubmenu === key ||
                      (key === "status" && statusFilter !== "all") ||
                      (key === "priority" && priorityFilter !== "all") ||
                      (key === "members" && leadFilter !== "all") ||
                      (key === "dueDate" && dueDateFilter !== "all");

                    return (
                      <button
                        type="button"
                        key={key}
                        onMouseEnter={() => setOpenFilterSubmenu(key)}
                        onClick={() =>
                          setOpenFilterSubmenu((current) =>
                            current === key ? null : key,
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2.5 text-left text-[13px] transition ${
                          active
                            ? "bg-gray-50 text-gray-900 dark:bg-zinc-800 dark:text-white"
                            : "text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                          {label}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                    );
                  })}

                  {hasFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearFilters();
                        closeFilterSubmenu();
                      }}
                      className="mt-1 flex w-full items-center rounded-lg px-2.5 py-2 text-[11px] font-medium text-[var(--app-accent)] hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>

                {openFilterSubmenu && (
                  <div
                    className="ml-1 w-[194px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-zinc-900"
                    onMouseLeave={closeFilterSubmenu}
                  >
                    {openFilterSubmenu === "status" && (
                      <>
                        <FilterOption
                          label="All"
                          active={statusFilter === "all"}
                          onClick={() => {
                            onStatusFilterChange("all");
                            closeFilterSubmenu();
                          }}
                        />
                        {statusOptions.map((status) => (
                          <FilterOption
                            key={status}
                            label={status}
                            active={statusFilter === status}
                            onClick={() => {
                              onStatusFilterChange(status);
                              closeFilterSubmenu();
                            }}
                          />
                        ))}
                      </>
                    )}

                    {openFilterSubmenu === "priority" && (
                      <>
                        <FilterOption
                          label="No Priority"
                          active={priorityFilter === "No Priority"}
                          priority="No Priority"
                          onClick={() => {
                            onPriorityFilterChange("No Priority");
                            closeFilterSubmenu();
                          }}
                        />
                        <FilterOption
                          label="Urgent"
                          active={priorityFilter === "Urgent"}
                          priority="Urgent"
                          onClick={() => {
                            onPriorityFilterChange("Urgent");
                            closeFilterSubmenu();
                          }}
                        />
                        <FilterOption
                          label="High"
                          active={priorityFilter === "High"}
                          priority="High"
                          onClick={() => {
                            onPriorityFilterChange("High");
                            closeFilterSubmenu();
                          }}
                        />
                        <FilterOption
                          label="Medium"
                          active={priorityFilter === "Medium"}
                          priority="Medium"
                          onClick={() => {
                            onPriorityFilterChange("Medium");
                            closeFilterSubmenu();
                          }}
                        />
                        <FilterOption
                          label="Low"
                          active={priorityFilter === "Low"}
                          priority="Low"
                          onClick={() => {
                            onPriorityFilterChange("Low");
                            closeFilterSubmenu();
                          }}
                        />
                        <FilterOption
                          label="All priorities"
                          active={priorityFilter === "all"}
                          onClick={() => {
                            onPriorityFilterChange("all");
                            closeFilterSubmenu();
                          }}
                        />
                      </>
                    )}

                    {openFilterSubmenu === "members" && (
                      <>
                        <FilterOption
                          label="All members"
                          active={leadFilter === "all"}
                          onClick={() => {
                            onLeadFilterChange("all");
                            closeFilterSubmenu();
                          }}
                        />
                        <FilterOption
                          label="No lead"
                          active={leadFilter === "unassigned"}
                          onClick={() => {
                            onLeadFilterChange("unassigned");
                            closeFilterSubmenu();
                          }}
                        />
                        {members.map((member) => (
                          <FilterOption
                            key={member.id}
                            label={member.name || member.email}
                            active={leadFilter === member.id}
                            onClick={() => {
                              onLeadFilterChange(member.id);
                              closeFilterSubmenu();
                            }}
                          />
                        ))}
                      </>
                    )}

                    {openFilterSubmenu === "dueDate" && (
                      <>
                        <FilterOption
                          label="All due dates"
                          active={dueDateFilter === "all"}
                          onClick={() => {
                            onDueDateFilterChange("all");
                            closeFilterSubmenu();
                          }}
                        />
                        <FilterOption
                          label="Overdue"
                          active={dueDateFilter === "overdue"}
                          onClick={() => {
                            onDueDateFilterChange("overdue");
                            closeFilterSubmenu();
                          }}
                        />
                        <FilterOption
                          label="Next 7 days"
                          active={dueDateFilter === "upcoming"}
                          onClick={() => {
                            onDueDateFilterChange("upcoming");
                            closeFilterSubmenu();
                          }}
                        />
                        <FilterOption
                          label="No due date"
                          active={dueDateFilter === "none"}
                          onClick={() => {
                            onDueDateFilterChange("none");
                            closeFilterSubmenu();
                          }}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button type="button" onClick={onCreate} className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-3 text-xs font-semibold text-[var(--app-accent-foreground)] transition hover:bg-[var(--app-accent-hover)]">
            <Plus className="h-3.5 w-3.5" />
            Add project
          </button>
        </div>
      </div>

      {error && <InlineError message={error} />}

      <div className="overflow-visible rounded-xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50/80 text-xs font-medium text-gray-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-3 font-medium sm:px-4">Projects</th>
                {visibleColumns.status && <th className="px-3 py-3 font-medium">Status</th>}
                {visibleColumns.priority && <th className="px-3 py-3 font-medium">Priority</th>}
                {visibleColumns.lead && <th className="px-3 py-3 font-medium">Lead</th>}
                {visibleColumns.dueDate && <th className="px-3 py-3 font-medium">Due date</th>}
                <th className="px-3 py-3 text-right font-medium sm:px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {isLoading ? (
                <tr><td colSpan={tableColumnCount} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-zinc-400">Loading projects...</td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={tableColumnCount} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-zinc-400">No projects match these filters.</td></tr>
              ) : (
                projects.map((item) => (
                  <ProjectRow
                    key={item.id}
                    project={item}
                    members={members}
                    visibleColumns={visibleColumns}
                    isActionsOpen={actionMenuId === item.id}
                    onSelect={() => onSelect(item)}
                    onToggleActions={() => onToggleActions(item.id)}
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item)}
                  />
                ))
              )}
              <tr>
                <td colSpan={tableColumnCount}>
                  <button type="button" onClick={onCreate} className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-900">
                    <Plus className="h-3.5 w-3.5" />
                    Add project
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterOption({
  label,
  active,
  onClick,
  priority,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  priority?: ProjectPriority;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-left text-[13px] transition ${
        active
          ? "bg-gray-50 text-gray-900 dark:bg-zinc-800 dark:text-white"
          : "text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {priority ? (
        <PriorityBadge priority={priority} />
      ) : (
        <span className="truncate">{label}</span>
      )}

      {active && (
        <Check className="h-3.5 w-3.5 shrink-0 text-gray-700 dark:text-zinc-200" />
      )}
    </button>
  );
}

function ProjectRow({
  project,
  members,
  visibleColumns,
  isActionsOpen,
  onSelect,
  onToggleActions,
  onEdit,
  onDelete,
}: {
  project: ProjectItem;
  members: TeamMember[];
  visibleColumns: VisibleColumns;
  isActionsOpen: boolean;
  onSelect: () => void;
  onToggleActions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const leadName = getLeadName(project.lead, members);

  return (
    <tr
      className="group cursor-pointer transition hover:bg-gray-50/70 dark:hover:bg-zinc-900/60"
      onClick={onSelect}
    >
      <td className="px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white">
            {project.name}
          </span>
          {project.taskCount > 0 && (
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
              {project.taskCount}
            </span>
          )}
        </div>
      </td>

      {visibleColumns.status && (
        <td className="px-3 py-3">
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 dark:bg-zinc-800 dark:text-zinc-200">
            {project.status || "To Do"}
          </span>
        </td>
      )}

      {visibleColumns.priority && (
        <td className="px-3 py-3">
          <PriorityBadge priority={project.priority} />
        </td>
      )}

      {visibleColumns.lead && (
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
              {initials(leadName)}
            </span>
            <span className="max-w-32 truncate text-xs text-gray-600 dark:text-zinc-300">
              {leadName === "Unassigned" ? "—" : leadName}
            </span>
          </div>
        </td>
      )}

      {visibleColumns.dueDate && (
        <td className="px-3 py-3 text-xs text-gray-600 dark:text-zinc-300">
          {formatDate(project.dueDate)}
        </td>
      )}

      <td
        className="relative px-3 py-3 text-right sm:px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onToggleActions}
          aria-label={`Actions for ${project.name}`}
          className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <Ellipsis className="h-4 w-4" />
        </button>

        {isActionsOpen && (
          <div
            data-project-action-menu
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            className="absolute right-4 top-9 z-20 w-32 rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={onEdit}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function ProjectDetail({ project, isLoading, error, onBack, onEdit, onDelete }: { project: ProjectItem | null; isLoading: boolean; error: string; onBack: () => void; onEdit: () => void; onDelete: () => void }) {
  if (isLoading) return <div className="mx-auto max-w-5xl py-12 text-sm text-gray-500 dark:text-zinc-400">Loading project...</div>;
  if (error || !project) return <div className="mx-auto max-w-5xl"><InlineError message={error || "Project not found."} /><button type="button" onClick={onBack} className="mt-4 text-sm font-medium text-[var(--app-accent)]">Back to projects</button></div>;

  const leadName = getLeadName(project.lead);
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="mb-2 text-xs font-medium text-gray-500 dark:text-zinc-400">Project overview</p><h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{project.name}</h1></div><div className="flex gap-2"><button type="button" onClick={onEdit} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"><Pencil className="h-3.5 w-3.5" />Edit</button><button type="button" onClick={onDelete} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"><Trash2 className="h-3.5 w-3.5" />Delete</button></div></div>
      <div className="grid gap-4 md:grid-cols-4"><DetailCard label="Status"><span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 dark:bg-zinc-800 dark:text-zinc-200">{project.status || "To Do"}</span></DetailCard><DetailCard label="Priority"><PriorityBadge priority={project.priority} /></DetailCard><DetailCard label="Lead"><div className="flex items-center gap-2">{project.lead?.avatar ? <img src={project.lead.avatar} alt={leadName} className="h-6 w-6 rounded-full object-cover" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">{initials(leadName)}</span>}<span>{leadName}</span></div></DetailCard><DetailCard label="Due date">{formatDate(project.dueDate)}</DetailCard></div>
      <div className="mt-7 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"><div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-zinc-800"><div className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-gray-500" /><h2 className="text-sm font-semibold text-gray-900 dark:text-white">Project tasks</h2></div><span className="text-xs text-gray-500 dark:text-zinc-400">{project.taskCount} total</span></div>{project.tasks.length === 0 ? <div className="px-4 py-10 text-center text-sm text-gray-500 dark:text-zinc-400">No tasks have been added to this project yet.</div> : <div className="divide-y divide-gray-100 dark:divide-zinc-800">{project.tasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"><div><p className="font-medium text-gray-900 dark:text-white">{task.title}</p><p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{task.assignee || "Unassigned"}</p></div><div className="flex items-center gap-4 text-xs text-gray-500 dark:text-zinc-400"><span>{task.status}</span><span>{formatDate(task.dueDate)}</span></div></div>)}</div>}</div>
    </div>
  );
}

function DetailCard({ label, children }: { label: string; children: React.ReactNode }) { return <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"><p className="mb-2 text-xs font-medium text-gray-500 dark:text-zinc-400">{label}</p><div className="text-sm text-gray-900 dark:text-white">{children}</div></div>; }
function InlineError({ message }: { message: string }) { return <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>; }