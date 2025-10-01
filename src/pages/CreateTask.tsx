import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";

interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
}

interface SubtaskTemplate {
  id: string;
  title: string;
  description?: string;
  sort_order?: number;
}

interface TeamType {
  id: string;
  name: string;
}

const CreateTask = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [teams, setTeams] = useState<TeamType[]>([]);
  const [subtasks, setSubtasks] = useState<SubtaskTemplate[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    estimated_hours: "",
    due_date: "",
    template_id: "",
    team_id: "",
  });

  useEffect(() => {
    fetchTaskTemplates();
    fetchTeams();
  }, []);

  useEffect(() => {
    if (formData.template_id) {
      fetchSubtaskTemplates(formData.template_id);
    } else {
      setSubtasks([]);
    }
  }, [formData.template_id]);

  const fetchTaskTemplates = async () => {
    const { data } = await supabase
      .from("task_templates")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (data) {
      setTaskTemplates(data as TaskTemplate[]);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data } = await supabase
        .from("teams")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (data) setTeams(data as Array<{ id: string; name: string }>);
    } catch (err) {
      console.error("Error fetching teams", err);
    }
  };

  const fetchSubtaskTemplates = async (templateId: string) => {
    const { data } = await supabase
      .from("subtask_templates")
      .select("*")
      .eq("task_template_id", templateId)
      .order("sort_order");

    if (data) {
      setSubtasks(data as SubtaskTemplate[]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(e.target.files);
    }
  };

  const handleRemoveSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.filter((subtask) => subtask.id !== subtaskId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user profile
      const { data: userProfile } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!userProfile) throw new Error("User profile not found");

      // Create task
      // Insert task with team_id if provided
      const taskPayload = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority as "low" | "medium" | "high" | "urgent",
        estimated_hours: parseFloat(formData.estimated_hours) || 0,
        due_date: formData.due_date || null,
        created_by: userProfile.id,
        status: "not_started",
        template_id: formData.template_id || null,
        team_id: formData.team_id || null,
      } as const;

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert([taskPayload])
        .select()
        .single();

      if (taskError) throw taskError;

      // Create subtasks if any
      if (subtasks.length > 0) {
        const subtasksToCreate = subtasks.map((template) => ({
          task_id: task.id,
          title: template.title,
          description: template.description,
          sort_order: template.sort_order,
          is_done: false,
        }));

        await supabase.from("subtasks").insert(subtasksToCreate);
      }

      // Upload files if any
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileExt = file.name.split(".").pop();
          const fileName = `${userProfile.id}/${
            task.id
          }/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("task-attachments")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Create attachment record
          await supabase.from("attachments").insert({
            task_id: task.id,
            file_name: file.name,
            file_path: fileName,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: userProfile.id,
          });
        }
      }

      // After creating the task, try to auto-assign if a team was selected
      if (task && formData.team_id) {
        try {
          // 1) Get team member ids
          const { data: memberIds, error: memberIdsError } = await supabase
            .from("team_members")
            .select("user_id")
            .eq("team_id", formData.team_id);

          if (memberIdsError) throw memberIdsError;

          const userIds = (memberIds || [])
            .map((m: { user_id: string }) => m.user_id)
            .filter((id): id is string => !!id);

          if (userIds.length > 0) {
            // 2) Fetch users in team with workload
            const { data: usersData, error: usersError } = await supabase
              .from("users")
              .select("id, full_name, current_workload_hours, is_active")
              .in("id", userIds)
              .eq("is_active", true);

            if (usersError) throw usersError;

            // 3) Fetch active assignment counts for these users
            const { data: assignmentsData } = await supabase
              .from("task_assignments")
              .select("user_id")
              .eq("is_active", true)
              .in("user_id", userIds);

            const assignmentCounts: Record<string, number> = {};
            (assignmentsData || []).forEach((a: { user_id: string }) => {
              assignmentCounts[a.user_id] =
                (assignmentCounts[a.user_id] || 0) + 1;
            });

            // 4) Choose user with minimal (current_workload_hours + active assignments)
            let bestUserId: string | null = null;
            let bestScore = Number.POSITIVE_INFINITY;

            (usersData || []).forEach(
              (u: { id: string; current_workload_hours: number | string }) => {
                const current = Number(u.current_workload_hours || 0) || 0;
                const assigns = assignmentCounts[u.id] || 0;
                const score = current + assigns; // simple heuristic
                if (score < bestScore) {
                  bestScore = score;
                  bestUserId = u.id;
                }
              }
            );

            // 5) Create task_assignments record and update task status
            if (bestUserId) {
              const { error: assignError } = await supabase
                .from("task_assignments")
                .insert([
                  {
                    task_id: task.id,
                    user_id: bestUserId,
                    assigned_by: userProfile.id,
                    is_active: true,
                  },
                ]);

              if (assignError) throw assignError;

              await supabase
                .from("tasks")
                .update({ status: "assigned" })
                .eq("id", task.id);
            }
          }
        } catch (assignErr: unknown) {
          console.error("Auto-assignment error:", assignErr);
        }
      }

      toast({
        title: "Success",
        description: "Task created successfully",
      });

      navigate("/tasks");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Task</CardTitle>
          <CardDescription>
            Fill in the details to create a new task with attachments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                placeholder="Enter task title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter task description"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team">Team</Label>
              <Select
                value={formData.team_id}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    team_id: value === "none" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Task Template</Label>
              <Select
                value={formData.template_id}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    template_id: value === "none" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Template</SelectItem>
                  {taskTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {subtasks.length > 0 && (
              <div className="space-y-2">
                <Label>Subtasks from Template</Label>
                <div className="space-y-2 rounded-md border p-4">
                  {subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-center justify-between"
                    >
                      <span>{subtask.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSubtask(subtask.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_hours">Estimated Hours</Label>
                <Input
                  id="estimated_hours"
                  type="number"
                  step="0.5"
                  value={formData.estimated_hours}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      estimated_hours: e.target.value,
                    })
                  }
                  placeholder="8"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="files">Attachments</Label>
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <input
                  id="files"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="files" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload files or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {files
                      ? `${files.length} file(s) selected`
                      : "No files selected"}
                  </p>
                </label>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Task"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/tasks")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateTask;
