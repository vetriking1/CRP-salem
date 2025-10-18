// This is a test file to verify that the template functionality works properly
// It's not part of the actual implementation, just for testing purposes

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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { X, AlertTriangle } from "lucide-react";
import { AutoAssignmentService } from "@/services/autoAssignmentService";
import { NotificationService } from "@/services/notificationService";
import {
  calculateDueDateInfo,
  getDueDateStatusText,
  shouldUpdatePriority,
  type Priority,
} from "@/utils/dueDateUtils";

interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  estimated_hours?: number;
  default_role?: string;
  task_team?: string;
}

interface SubtaskTemplate {
  id: string;
  title: string;
  description?: string;
  sort_order?: number;
  task_template_id?: string;
}

interface TeamType {
  id: string;
  name: string;
}

// This is a simplified test version based on the modifications made to CreateTask.tsx
const TestTemplateFunctionality = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [teams, setTeams] = useState<TeamType[]>([]);
  const [subtasks, setSubtasks] = useState<SubtaskTemplate[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    difficulty: "easy",
    estimated_hours: "",
    due_date: "",
    template_id: "",
    team_id: "",
  });
  const [priorityAdjusted, setPriorityAdjusted] = useState(false);

  // State for custom task templates
  const [customTaskTemplates, setCustomTaskTemplates] = useState<TaskTemplate[]>([]);
  const [newTaskTemplateName, setNewTaskTemplateName] = useState("");
  const [newTaskTemplateDescription, setNewTaskTemplateDescription] = useState("");
  const [newTaskTemplateHours, setNewTaskTemplateHours] = useState("");
  const [newTaskTemplateRole, setNewTaskTemplateRole] = useState("");
  const [showCustomTaskTemplateForm, setShowCustomTaskTemplateForm] = useState(false);
  
  // State for custom subtask templates
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDescription, setNewSubtaskDescription] = useState("");
  const [customSubtasks, setCustomSubtasks] = useState<SubtaskTemplate[]>([]);
  const [showCustomSubtaskForm, setShowCustomSubtaskForm] = useState(false);
  const [selectedTaskTemplateForSubtask, setSelectedTaskTemplateForSubtask] = useState("");

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (formData.team_id) {
      fetchTaskTemplates(formData.team_id);
    } else {
      setTaskTemplates([]);
    }
  }, [formData.team_id]);

  useEffect(() => {
    if (formData.template_id) {
      fetchSubtaskTemplates(formData.template_id);
    } else {
      setSubtasks([]);
    }
  }, [formData.template_id]);

  const fetchTaskTemplates = async (teamId: string) => {
    const { data } = await supabase
      .from("task_templates")
      .select("*")
      .eq("task_team", teamId)
      .order("name");
    if (data) {
      setTaskTemplates(data as TaskTemplate[]);
    } else {
      setTaskTemplates([]);
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

  const handleRemoveSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.filter((subtask) => subtask.id !== subtaskId));
  };

  const handleDueDateChange = (date: string) => {
    setFormData({ ...formData, due_date: date });

    if (date) {
      const dueDateInfo = calculateDueDateInfo(
        date,
        formData.priority as Priority
      );
      const shouldAdjust = shouldUpdatePriority(
        formData.priority as Priority,
        dueDateInfo.suggestedPriority
      );

      if (shouldAdjust) {
        setFormData((prev) => ({
          ...prev,
          priority: dueDateInfo.suggestedPriority,
        }));
        setPriorityAdjusted(true);
      } else {
        setPriorityAdjusted(false);
      }
    } else {
      setPriorityAdjusted(false);
    }
  };

  const handlePriorityChange = (priority: string) => {
    setFormData({ ...formData, priority });
    setPriorityAdjusted(false); // Reset auto-adjustment flag when manually changed
  };

  const dueDateInfo = formData.due_date
    ? calculateDueDateInfo(formData.due_date, formData.priority as Priority)
    : null;

  const createTaskTemplate = async () => {
    if (!newTaskTemplateName.trim()) {
      toast({
        title: "Error",
        description: "Task template name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user profile
      const { data: userProfile } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!userProfile) throw new Error("User profile not found");

      // Create the new task template
      const { data: newTemplate, error: templateError } = await supabase
        .from("task_templates")
        .insert([{
          name: newTaskTemplateName,
          description: newTaskTemplateDescription,
          estimated_hours: parseFloat(newTaskTemplateHours) || 0,
          default_role: newTaskTemplateRole || null,
          task_team: formData.team_id || null, // Associate with the selected team
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (templateError) throw templateError;

      // Add to local state
      setCustomTaskTemplates(prev => [...prev, newTemplate]);
      
      // Clear form
      setNewTaskTemplateName("");
      setNewTaskTemplateDescription("");
      setNewTaskTemplateHours("");
      setNewTaskTemplateRole("");
      setShowCustomTaskTemplateForm(false);
      
      toast({
        title: "Success",
        description: "Task template created successfully",
      });
      
      // Refresh the templates list for the selected team
      if (formData.team_id) {
        fetchTaskTemplates(formData.team_id);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const createSubtaskTemplate = async () => {
    if (!newSubtaskTitle.trim()) {
      toast({
        title: "Error",
        description: "Subtask template title is required",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTaskTemplateForSubtask) {
      toast({
        title: "Error",
        description: "Please select a task template for the subtask",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user profile
      const { data: userProfile } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!userProfile) throw new Error("User profile not found");

      // Create the new subtask template
      const { data: newSubtaskTemplate, error: subtaskError } = await supabase
        .from("subtask_templates")
        .insert([{
          title: newSubtaskTitle,
          description: newSubtaskDescription,
          task_template_id: selectedTaskTemplateForSubtask,
        }])
        .select()
        .single();

      if (subtaskError) throw subtaskError;

      // Add to local state
      setCustomSubtasks(prev => [...prev, newSubtaskTemplate]);
      
      // Clear form
      setNewSubtaskTitle("");
      setNewSubtaskDescription("");
      
      toast({
        title: "Success",
        description: "Subtask template created successfully",
      });
      
      // Refresh the subtask templates for the selected template
      if (selectedTaskTemplateForSubtask) {
        fetchSubtaskTemplates(selectedTaskTemplateForSubtask);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
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
      // Normalize fields to match DB enums and types
      const normalizedPriority = (
        formData.priority === "urgent" ? "high" : formData.priority
      ) as "low" | "medium" | "high";
      const normalizedDueDate = formData.due_date
        ? new Date(formData.due_date).toISOString()
        : null;
      const taskPayload = {
        title: formData.title,
        description: formData.description,
        priority: normalizedPriority,
        difficulty: formData.difficulty as "easy" | "medium" | "hard",
        estimated_hours: parseFloat(formData.estimated_hours) || 0,
        due_date: normalizedDueDate,
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

      if (taskError) {
        console.error("Task insert error", taskError, { taskPayload });
        throw taskError;
      }

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

      // NEW: Store URL directly in attachments table
      if (attachmentUrl.trim() && attachmentName.trim()) {
        await supabase.from("attachments").insert({
          task_id: task.id,
          file_name: attachmentName,
          file_path: attachmentUrl,
          file_type: "url",
          file_size: 0,
          uploaded_by: userProfile.id,
        });
      }

      // After creating the task, try to auto-assign if a team was selected
      if (task && formData.team_id) {
        try {
          const assignmentResult = await AutoAssignmentService.assignTask(
            task.id,
            {
              teamId: formData.team_id,
              difficulty: formData.difficulty as "easy" | "medium" | "hard",
              estimatedHours: parseFloat(formData.estimated_hours) || 0,
              priority: normalizedPriority as "low" | "medium" | "high",
              assignedBy: userProfile.id,
            }
          );

          if (!assignmentResult.success) {
            console.warn("Auto-assignment failed:", assignmentResult.error);
          }
        } catch (assignErr: unknown) {
          console.error("Auto-assignment error:", assignErr);
        }

        // Notify team managers about the new task
        try {
          await NotificationService.notifyTeamManagersOnTaskCreation(
            task.id,
            task.title,
            formData.team_id,
            userProfile.id
          );
        } catch (notifyErr: unknown) {
          console.error("Notification error:", notifyErr);
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
                required
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter task description"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team">Team *</Label>
              <Select
                value={formData.team_id}
                required
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    team_id: value,
                    template_id: "",   // Reset template when team changes
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.team_id && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="template">Task Template *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCustomTaskTemplateForm(true)}
                  >
                    Create Custom Template
                  </Button>
                </div>
                
                <Select
                  value={formData.template_id}
                  required
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
            )}

            {/* Custom Task Template Creation Dialog */}
            <Dialog open={showCustomTaskTemplateForm} onOpenChange={setShowCustomTaskTemplateForm}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Custom Task Template</DialogTitle>
                  <DialogDescription>
                    Define a new task template that can be reused for similar tasks
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="taskTemplateName">Template Name *</Label>
                    <Input
                      id="taskTemplateName"
                      value={newTaskTemplateName}
                      onChange={(e) => setNewTaskTemplateName(e.target.value)}
                      placeholder="Enter template name"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="taskTemplateDescription">Description</Label>
                    <Textarea
                      id="taskTemplateDescription"
                      value={newTaskTemplateDescription}
                      onChange={(e) => setNewTaskTemplateDescription(e.target.value)}
                      placeholder="Enter template description"
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estimatedHours">Estimated Hours</Label>
                      <Input
                        id="estimatedHours"
                        type="number"
                        step="0.5"
                        value={newTaskTemplateHours}
                        onChange={(e) => setNewTaskTemplateHours(e.target.value)}
                        placeholder="e.g., 8"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="defaultRole">Default Role</Label>
                      <Select
                        value={newTaskTemplateRole}
                        onValueChange={setNewTaskTemplateRole}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="data_collector">Data Collector</SelectItem>
                          <SelectItem value="senior">Senior</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCustomTaskTemplateForm(false);
                        setNewTaskTemplateName("");
                        setNewTaskTemplateDescription("");
                        setNewTaskTemplateHours("");
                        setNewTaskTemplateRole("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={createTaskTemplate}
                    >
                      Create Template
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {formData.template_id && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Subtasks from Template</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTaskTemplateForSubtask(formData.template_id);
                      setShowCustomSubtaskForm(true);
                    }}
                  >
                    Create Custom Subtask
                  </Button>
                </div>
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

            {/* Custom Subtask Template Creation Dialog */}
            <Dialog open={showCustomSubtaskForm} onOpenChange={setShowCustomSubtaskForm}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Custom Subtask Template</DialogTitle>
                  <DialogDescription>
                    Define a new subtask template that can be used in task templates
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="subtaskTitle">Subtask Title *</Label>
                    <Input
                      id="subtaskTitle"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Enter subtask title"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subtaskDescription">Description</Label>
                    <Textarea
                      id="subtaskDescription"
                      value={newSubtaskDescription}
                      onChange={(e) => setNewSubtaskDescription(e.target.value)}
                      placeholder="Enter subtask description"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCustomSubtaskForm(false);
                        setNewSubtaskTitle("");
                        setNewSubtaskDescription("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={createSubtaskTemplate}
                    >
                      Create Subtask Template
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <div className="space-y-2">
                  <Select
                    value={formData.priority}
                    onValueChange={handlePriorityChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  {priorityAdjusted && (
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Priority auto-adjusted based on due date</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(value) =>
                    setFormData({ ...formData, difficulty: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <div className="space-y-2">
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    required
                    onChange={(e) => handleDueDateChange(e.target.value)}
                  />
                  {dueDateInfo && dueDateInfo.status !== "normal" && (
                    <div
                      className={`flex items-center gap-2 text-sm ${
                        dueDateInfo.isOverdue
                          ? "text-red-600"
                          : dueDateInfo.isDueToday
                          ? "text-orange-600"
                          : "text-blue-600"
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <span>{getDueDateStatusText(dueDateInfo)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachment">Attachments (URL)</Label>
              <div className="space-y-3">
                <div>
                  <Label
                    htmlFor="attachmentName"
                    className="text-sm text-muted-foreground"
                  >
                    File/Document Name
                  </Label>
                  <Input
                    id="attachmentName"
                    value={attachmentName}
                    onChange={(e) => setAttachmentName(e.target.value)}
                    placeholder="e.g., Design Mockup, Requirements Doc"
                    required={attachmentUrl ? true : false}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="attachmentUrl"
                    className="text-sm text-muted-foreground"
                  >
                    File URL
                  </Label>
                  <Input
                    id="attachmentUrl"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    placeholder="https://example.com/file.pdf"
                    required={attachmentName ? true : false}
                    type="url"
                  />
                </div>
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

export default TestTemplateFunctionality;