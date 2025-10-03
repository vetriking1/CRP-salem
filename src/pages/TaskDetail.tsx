import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Progress,
  Checkbox,
  Input,
  Avatar,
  List,
  Space,
  Divider,
  Spin,
  Modal,
  Select,
} from "antd";
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  UserOutlined,
  SendOutlined,
  PaperClipOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AutoAssignmentService } from "@/services/autoAssignmentService";
import { NotificationService } from "@/services/notificationService";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const { TextArea } = Input;

export default function TaskDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [task, setTask] = useState<any>(null);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [isAssigned, setIsAssigned] = useState(false);
  type PendingReason = "review" | "data_missing" | "clarity_needed";
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [pendingReason, setPendingReason] = useState<
    PendingReason | undefined
  >();
  const [pendingNotes, setPendingNotes] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [dataFiles, setDataFiles] = useState<FileList | null>(null);
  
  // Review workflow states
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [changeRequestModalOpen, setChangeRequestModalOpen] = useState(false);
  const [changeRequestNotes, setChangeRequestNotes] = useState<string>("");

  useEffect(() => {
    fetchTaskDetails();
  }, []);

  // Update isAssigned when userProfile or task changes
  useEffect(() => {
    if (task && userProfile) {
      const assigned = task.task_assignments?.some(
        (a: any) => a.user_id === userProfile?.id
      );
      setIsAssigned(assigned);
    }
  }, [task, userProfile]);

  const fetchTaskDetails = async () => {
    setLoading(true);
    try {
      // Fetch task
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select(
          `
          *,
          created_by_user:users!tasks_created_by_fkey(full_name, avatar_url),
          task_assignments(
            user_id,
            users!task_assignments_user_id_fkey(full_name, avatar_url, role)
          )
        `
        )
        .eq("id", id)
        .single();

      if (taskError) throw taskError;
      setTask(taskData);

      // Fetch subtasks
      const { data: subtasksData } = await supabase
        .from("subtasks")
        .select(
          `
          *,
          completed_by_user:users!subtasks_completed_by_fkey(full_name)
        `
        )
        .eq("task_id", id)
        .order("sort_order", { ascending: true });
      setSubtasks(subtasksData || []);

      // Fetch comments
      const { data: commentsData } = await supabase
        .from("comments")
        .select(
          `
          *,
          user:users(full_name, avatar_url, role)
        `
        )
        .eq("task_id", id)
        .order("created_at", { ascending: false });
      setComments(commentsData || []);

      // Fetch attachments
      const { data: attachmentsData } = await supabase
        .from("attachments")
        .select(
          `
          *,
          uploaded_by_user:users!attachments_uploaded_by_fkey(full_name)
        `
        )
        .eq("task_id", id)
        .order("uploaded_at", { ascending: false });
      setAttachments(attachmentsData || []);
    } catch (error) {
      console.error("Error fetching task details:", error);
      toast({
        title: "Error",
        description: "Failed to load task details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubtaskToggle = async (subtaskId: string, isDone: boolean) => {
    if (!isAssigned) {
      toast({
        title: "Not Authorized",
        description: "Only assigned users can mark subtasks",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update subtask status
      const { error } = await supabase
        .from("subtasks")
        .update({
          is_done: !isDone,
          completed_by: !isDone ? userProfile?.id : null,
          completed_at: !isDone ? new Date().toISOString() : null,
        })
        .eq("id", subtaskId);

      if (error) throw error;

      // If task status is "assigned", update it to "in_progress"
      if (task.status === "assigned" || "not_started") {
        const { error: taskUpdateError } = await supabase
          .from("tasks")
          .update({
            status: "in_progress",
          })
          .eq("id", id);
        
        if (taskUpdateError) throw taskUpdateError;
        
        // Send notifications to all assigned users and task creator
        const assignedUsers = task.task_assignments?.map((a: any) => a.user_id) || [];
        const allNotifyUsers = [...new Set([...assignedUsers, task.created_by])];
        
        await NotificationService.notifyTaskStatusChange(
          task.id,
          task.title,
          "assigned",
          "in_progress",
          allNotifyUsers.filter((userId) => userId !== userProfile?.id)
        );
      }

      toast({
        title: "Success",
        description: `Subtask ${!isDone ? "completed" : "reopened"}`,
      });

      fetchTaskDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSendComment = async () => {
    if (!comment.trim()) return;

    if (userProfile?.role === "admin") {
      toast({
        title: "Not Allowed",
        description: "Admins cannot add comments",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("comments").insert([
        {
          task_id: id,
          user_id: userProfile?.id,
          content: comment,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Comment added",
      });

      setComment("");
      fetchTaskDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const allSubtasksCompleted =
    subtasks.length === 0 || subtasks.every((s) => s.is_done);

  const handleMarkCompleted = async () => {
    if (!isAssigned) {
      toast({
        title: "Not Authorized",
        description: "Only assigned users can complete the task",
        variant: "destructive",
      });
      return;
    }
    if (!allSubtasksCompleted) {
      toast({
        title: "Cannot Complete",
        description: "Please complete all subtasks first",
        variant: "destructive",
      });
      return;
    }
    try {
      // Instead of marking as completed directly, mark for review
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "review",
          completed_at: new Date().toISOString(),
          pending_reason: null,
          pending_notes: null,
        })
        .eq("id", id);
      if (error) throw error;

      // Auto-assign to a senior or manager for review
      await assignForReview(String(id), task?.team_id || null);

      // Send notifications to all assigned users and task creator
      const assignedUsers =
        task.task_assignments?.map((a: any) => a.user_id) || [];
      const allNotifyUsers = [...new Set([...assignedUsers, task.created_by])];

      await NotificationService.notifyTaskStatusChange(
        task.id,
        task.title,
        task.status,
        "review",
        allNotifyUsers.filter((userId) => userId !== userProfile?.id)
      );

      toast({ title: "Success", description: "Task submitted for review" });
      fetchTaskDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  // Function to assign task to a senior or manager for review
  const assignForReview = async (taskId: string, teamId: string | null) => {
    if (!userProfile?.id || !teamId) return;
    
    try {
      // Store the current assignee before deactivating
      const { data: currentAssignments } = await supabase
        .from("task_assignments")
        .select("user_id")
        .eq("task_id", taskId)
        .eq("is_active", true);
        
      const currentAssigneeId = currentAssignments && currentAssignments.length > 0 
        ? currentAssignments[0].user_id 
        : null;
      
      // Deactivate current assignments
      await supabase
        .from("task_assignments")
        .update({ is_active: false })
        .eq("task_id", taskId)
        .eq("is_active", true);
      
      // Store the original assignee in task metadata
      await supabase
        .from("tasks")
        .update({ 
          metadata: { 
            original_assignee: currentAssigneeId,
            review_requested_at: new Date().toISOString()
          } 
        })
        .eq("id", taskId);
      
      // Use AutoAssignmentService to find a reviewer
      const assignmentResult = await AutoAssignmentService.assignForPending(
        taskId,
        teamId,
        "review", // Use the existing review assignment logic
        userProfile.id
      );

      if (!assignmentResult.success) {
        console.warn("Review assignment failed:", assignmentResult.error);
      }
    } catch (e) {
      console.error("Auto-assign for review failed", e);
    }
  };
  
  // Function to mark review as complete
  const handleReviewDone = async () => {
    if (!isAssigned) {
      toast({
        title: "Not Authorized",
        description: "Only assigned reviewers can approve tasks",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Update task status to completed
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "completed",
        })
        .eq("id", id);
      if (error) throw error;
      
      // Send notifications to all assigned users and task creator
      const assignedUsers =
        task.task_assignments?.map((a: any) => a.user_id) || [];
      const allNotifyUsers = [...new Set([...assignedUsers, task.created_by])];

      await NotificationService.notifyTaskStatusChange(
        task.id,
        task.title,
        "review",
        "completed",
        allNotifyUsers.filter((userId) => userId !== userProfile?.id)
      );
      
      toast({ title: "Success", description: "Review completed and task marked as done" });
      setReviewModalOpen(false);
      setReviewNotes("");
      fetchTaskDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  // Function to request changes after review
  const handleRequestChanges = async () => {
    if (!isAssigned) {
      toast({
        title: "Not Authorized",
        description: "Only assigned reviewers can request changes",
        variant: "destructive",
      });
      return;
    }
    
    if (!changeRequestNotes.trim()) {
      toast({
        title: "Missing Information",
        description: "Please specify what changes are needed",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Get the original assignee from task_assignments table (the assignee before the current reviewer)
      // We need to find the most recent non-active assignment (the one before the current active assignment)
      const { data: allAssignments } = await supabase
        .from("task_assignments")
        .select("user_id, assigned_at, is_active")
        .eq("task_id", id)
        .order("assigned_at", { ascending: false });
      
      if (!allAssignments || allAssignments.length === 0) {
        toast({
          title: "Error",
          description: "Could not find any task assignments",
          variant: "destructive",
        });
        return;
      }
      
      // Find the original assignee (the most recent non-active assignment before the current active one)
      const originalAssigneeId = allAssignments.find((assignment: any) => !assignment.is_active)?.user_id;
      
      if (!originalAssigneeId) {
        toast({
          title: "Error",
          description: "Could not find the original assignee",
          variant: "destructive",
        });
        return;
      }
      
      // Deactivate current assignments (reviewer)
      await supabase
        .from("task_assignments")
        .update({ is_active: false })
        .eq("task_id", id)
        .eq("is_active", true);
      
      // Create new assignment for the original assignee
      await supabase
        .from("task_assignments")
        .insert({
          task_id: id,
          user_id: originalAssigneeId,
          assigned_by: userProfile?.id,
          is_active: true,
        });
      
      // Add the change request as a subtask
      await supabase
        .from("subtasks")
        .insert({
          task_id: id,
          title: `Review changes: ${changeRequestNotes}`,
          description: `Changes requested by ${userProfile?.full_name} on ${new Date().toLocaleDateString()}`,
          is_done: false,
          sort_order: (subtasks.length + 1) * 10,
        });
      
      // Update task status back to in_progress
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "in_progress",
        })
        .eq("id", id);
      if (error) throw error; 
      
      // Send notifications
      await NotificationService.notifyTaskStatusChange(
        task.id,
        task.title,
        "review",
        "in_progress",
        [originalAssigneeId]
      );
      
      toast({ title: "Success", description: "Changes requested and task reassigned" });
      setChangeRequestModalOpen(false);
      setChangeRequestNotes("");
      fetchTaskDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePaymentCompleted = async () => {
    if (!isAssigned) {
      toast({
        title: "Not Authorized",
        description: "Only assigned users can mark payment as completed",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "delivered",
        })
        .eq("id", id);
      if (error) throw error;

      // Send notifications to all assigned users and task creator
      const assignedUsers =
        task.task_assignments?.map((a: any) => a.user_id) || [];
      const allNotifyUsers = [...new Set([...assignedUsers, task.created_by])];

      await NotificationService.notifyTaskStatusChange(
        task.id,
        task.title,
        "completed",
        "delivered",
        allNotifyUsers.filter((userId) => userId !== userProfile?.id)
      );

      toast({ title: "Success", description: "Payment completed and task delivered" });
      fetchTaskDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const setActiveAssignmentsFalse = async (taskId: string) => {
    await supabase
      .from("task_assignments")
      .update({ is_active: false })
      .eq("task_id", taskId)
      .eq("is_active", true);
  };

  const autoAssignForPending = async (
    taskId: string,
    teamId: string | null,
    reason: string
  ) => {
    if (!userProfile?.id) return;
    
    try {
      // For data_missing pending reason, assign to the task creator
      if (reason === "data_missing" && task.created_by) {
        // Deactivate current assignments
        await supabase
          .from("task_assignments")
          .update({ is_active: false })
          .eq("task_id", taskId)
          .eq("is_active", true);
          
        // Create new assignment for the task creator
        const { error: assignError } = await supabase
          .from("task_assignments")
          .insert({
            task_id: taskId,
            user_id: task.created_by,
            assigned_by: userProfile.id,
            is_active: true,
          });
          
        if (assignError) throw assignError;
        
        console.log(`Task assigned to creator (${task.created_by}) for data collection`);
      } 
      // For review and clarity_needed, use the AutoAssignmentService
      else if (teamId) {
        const assignmentResult = await AutoAssignmentService.assignForPending(
          taskId,
          teamId,
          reason,
          userProfile.id
        );

        if (!assignmentResult.success) {
          console.warn("Pending assignment failed:", assignmentResult.error);
        }
      }
    } catch (e) {
      console.error("Auto-assign pending failed", e);
    }
  };

  const handleConfirmPending = async () => {
    if (!isAssigned) {
      toast({
        title: "Not Authorized",
        description: "Only assigned users can update status",
        variant: "destructive",
      });
      return;
    }
    if (!pendingReason) {
      toast({ title: "Missing Reason", description: "Select a reason" });
      return;
    }
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "pending",
          pending_reason: pendingReason,
          pending_notes: pendingNotes || null,
        })
        .eq("id", id);
      if (error) throw error;

      await autoAssignForPending(
        String(id),
        task?.team_id || null,
        pendingReason
      );

      // Send notifications to task creator and team managers
      const assignedUsers =
        task.task_assignments?.map((a: any) => a.user_id) || [];
      const allNotifyUsers = [...new Set([...assignedUsers, task.created_by])];

      await NotificationService.notifyTaskStatusChange(
        task.id,
        task.title,
        task.status,
        "pending",
        allNotifyUsers.filter((userId) => userId !== userProfile?.id)
      );

      toast({ title: "Updated", description: "Task set to pending" });
      setPendingModalOpen(false);
      setPendingReason(undefined);
      setPendingNotes("");
      fetchTaskDetails();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleResumeFromPending = async () => {
    if (!isAssigned) {
      toast({
        title: "Not Authorized",
        description: "Only assigned users can resume the task",
        variant: "destructive",
      });
      return;
    }
    try {
      const previous = {
        status: task.status,
        pending_reason: task.pending_reason,
        pending_notes: task.pending_notes,
      };
      
      // 1) Fetch all assignments (latest first)
      const { data: assignments, error: fetchAssignErr } = await supabase
        .from("task_assignments")
        .select("id, user_id, assigned_at, is_active")
        .eq("task_id", id)
        .order("assigned_at", { ascending: false });
      if (fetchAssignErr) throw fetchAssignErr;

      // Find the current active assignment (the pending assignee)
      const currentActive = (assignments || []).find((a: any) => a.is_active);
      
      // Find the original assignee (the one before the pending assignee)
      // We need to find the most recent non-active assignment that isn't the current active one
      const originalAssignee = (assignments || [])
        .filter((a: any) => !a.is_active)
        .sort((a: any, b: any) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())[0];
      
      // For data_missing pending reason, completely remove all assignments
      if (task.pending_reason === "data_missing") {
        // Deactivate ALL assignments for this task
        await supabase
          .from("task_assignments")
          .update({ is_active: false })
          .eq("task_id", id);
        
        // Update task status to not_started since no one is assigned
        const { error } = await supabase
          .from("tasks")
          .update({
            status: "not_started",
            pending_reason: null,
            pending_notes: null,
          })
          .eq("id", id);
        if (error) throw error;
        
        // Add task history entry
        await supabase.from("task_history").insert({
          task_id: id,
          user_id: userProfile?.id,
          action: "resume_from_pending",
          old_value: { ...previous, removed_user_id: currentActive?.user_id },
          new_value: {
            status: "not_started",
            restored_user_id: null,
          },
          notes: "Task resumed from data collection; all assignments removed",
        });
      } 
      // For other pending reasons (review, clarity_needed), restore only the original assignee
      else {
        // Deactivate ALL assignments for this task first
        await supabase
          .from("task_assignments")
          .update({ is_active: false })
          .eq("task_id", id);

        // If there was an original assignee, reactivate only that one
        if (originalAssignee) {
          await supabase
            .from("task_assignments")
            .update({ is_active: true })
            .eq("id", originalAssignee.id);
            
          // Update task status to in_progress
          const { error } = await supabase
            .from("tasks")
            .update({
              status: "in_progress",
              pending_reason: null,
              pending_notes: null,
            })
            .eq("id", id);
          if (error) throw error;
            
          // Add task history entry
          await supabase.from("task_history").insert({
            task_id: id,
            user_id: userProfile?.id,
            action: "resume_from_pending",
            old_value: { ...previous, removed_user_id: currentActive?.user_id },
            new_value: {
              status: "in_progress",
              restored_user_id: originalAssignee?.user_id || null,
            },
            notes: "Task resumed from pending; original assignee restored",
          });
        } else {
          // No original assignee found, set to not_started
          const { error } = await supabase
            .from("tasks")
            .update({
              status: "not_started",
              pending_reason: null,
              pending_notes: null,
            })
            .eq("id", id);
          if (error) throw error;
            
          // Add task history entry
          await supabase.from("task_history").insert({
            task_id: id,
            user_id: userProfile?.id,
            action: "resume_from_pending",
            old_value: { ...previous, removed_user_id: currentActive?.user_id },
            new_value: {
              status: "not_started",
              restored_user_id: null,
            },
            notes: "Task resumed from pending; no original assignee found",
          });
        }
      }

      // Send notifications about status change
      const assignedUsers =
        task.task_assignments?.map((a: any) => a.user_id) || [];
      const allNotifyUsers = [...new Set([...assignedUsers, task.created_by])];

      await NotificationService.notifyTaskStatusChange(
        task.id,
        task.title,
        "pending",
        task.pending_reason === "data_missing" ? "not_started" : "in_progress",
        allNotifyUsers.filter((userId) => userId !== userProfile?.id)
      );

      toast({ 
        title: "Resumed", 
        description: task.pending_reason === "data_missing" 
          ? "Task moved to Not Started and unassigned" 
          : "Task moved to In Progress" 
      });
      fetchTaskDetails();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDataFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setDataFiles(e.target.files);
  };

  const handleUploadDataFiles = async () => {
    if (!dataFiles || dataFiles.length === 0) return;
    if (!userProfile?.id) return;
    setUploading(true);
    try {
      for (let i = 0; i < dataFiles.length; i++) {
        const file = dataFiles[i];
        const ext = file.name.split(".").pop();
        const path = `${userProfile.id}/${id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("task-attachments")
          .upload(path, file);
        if (uploadError) throw uploadError;
        await supabase.from("attachments").insert({
          task_id: id,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: userProfile.id,
        });
      }
      toast({ title: "Uploaded", description: "Files uploaded" });
      setDataFiles(null);
      fetchTaskDetails();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadAttachment = async (
    filePath: string,
    fileName: string
  ) => {
    try {
      const { data, error } = await supabase.storage
        .from("task-attachments")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center p-12">
        <h2 className="text-2xl font-bold">Task not found</h2>
        <Button onClick={() => navigate("/tasks")} className="mt-4">
          Back to Tasks
        </Button>
      </div>
    );
  }

  const statusColors: { [key: string]: string } = {
    not_started: "default",
    assigned: "cyan",
    in_progress: "processing",
    pending: "error",
    review: "warning",
    completed: "success",
    delivered: "purple",
    rejected: "error",
  };

  const priorityColors: { [key: string]: string } = {
    urgent: "error",
    high: "warning",
    medium: "processing",
    low: "default",
  };

  const progress =
    subtasks.length > 0
      ? Math.round(
          (subtasks.filter((s) => s.is_done).length / subtasks.length) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/tasks")}
          >
            Back to Tasks
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {task.title}
              </h1>
              <Tag color={priorityColors[task.priority]}>
                {task.priority?.toUpperCase()}
              </Tag>
              <Tag color={statusColors[task.status]}>
                {task.status?.replace("_", " ").toUpperCase()}
              </Tag>
            </div>
          </div>
        </div>
        {isAssigned && (
          <Space>
            {task.status === "in_progress" && (
              <Button
                type="primary"
                disabled={!allSubtasksCompleted}
                onClick={handleMarkCompleted}
              >
                Mark Completed
              </Button>
            )}
            {task.status === "review" && (
              <>
                {(userProfile?.role === "senior" || userProfile?.role === "manager" || userProfile?.role === "admin") && isAssigned && (
                  <>
                    <Button type="primary" onClick={() => setReviewModalOpen(true)}>
                      Review Done
                    </Button>
                    <Button onClick={() => setChangeRequestModalOpen(true)}>
                      Request Changes
                    </Button>
                  </>
                )}
              </>
            )}
            {task.status === "completed" && (
              <Button type="primary" onClick={handlePaymentCompleted}>
                Payment Done
              </Button>
            )}
            {![ "pending", "review", "completed", "delivered"].includes(task.status) && (
              <Button onClick={() => setPendingModalOpen(true)}>
                Set Pending
              </Button>
            )}
            {task.status === "pending" && (
              <Button onClick={() => handleResumeFromPending()}>
                Resume Task
              </Button>
            )}
          </Space>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Task Details">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Created By" span={2}>
                <Space>
                  <Avatar
                    src={task.created_by_user?.avatar_url}
                    icon={<UserOutlined />}
                  />
                  {task.created_by_user?.full_name || "Unknown"}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Created At">
                {dayjs(task.created_at).format("MMM DD, YYYY")}
              </Descriptions.Item>
              <Descriptions.Item label="Due Date">
                {task.due_date
                  ? dayjs(task.due_date).format("MMM DD, YYYY")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Estimated Hours">
                <ClockCircleOutlined /> {task.estimated_hours || 0} hours
              </Descriptions.Item>
              <Descriptions.Item label="Actual Hours">
                <ClockCircleOutlined /> {task.actual_hours || 0} hours
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>
                {task.description || "No description"}
              </Descriptions.Item>
              {task.pending_reason && (
                <Descriptions.Item label="Pending Reason">
                  {String(task.pending_reason)}
                </Descriptions.Item>
              )}
              {task.pending_notes && (
                <Descriptions.Item label="Pending Notes" span={2}>
                  {task.pending_notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          <Card
            title="Subtasks"
            extra={
              <Progress
                percent={progress}
                size="small"
                style={{ width: 200 }}
              />
            }
          >
            <List
              dataSource={subtasks}
              locale={{ emptyText: "No subtasks" }}
              renderItem={(subtask: any) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Checkbox
                        checked={subtask.is_done}
                        onChange={() =>
                          handleSubtaskToggle(subtask.id, subtask.is_done)
                        }
                        disabled={!isAssigned}
                      />
                    }
                    title={
                      <span
                        className={
                          subtask.is_done
                            ? "line-through text-muted-foreground"
                            : ""
                        }
                      >
                        {subtask.title}
                      </span>
                    }
                    description={subtask.description}
                  />
                  {subtask.is_done && (
                    <div className="text-xs text-muted-foreground">
                      Completed by {subtask.completed_by_user?.full_name} on{" "}
                      {dayjs(subtask.completed_at).format("MMM DD, YYYY")}
                    </div>
                  )}
                </List.Item>
              )}
            />
          </Card>

          <Card title="Comments">
            <Space direction="vertical" className="w-full">
              <List
                dataSource={comments}
                locale={{ emptyText: "No comments yet" }}
                renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          src={item.user?.avatar_url}
                          icon={<UserOutlined />}
                        />
                      }
                      title={
                        <Space>
                          <span>{item.user?.full_name}</span>
                          <Tag>{item.user?.role}</Tag>
                          <span className="text-xs text-muted-foreground">
                            {dayjs(item.created_at).fromNow()}
                          </span>
                        </Space>
                      }
                      description={item.content}
                    />
                  </List.Item>
                )}
              />

              {userProfile?.role !== "admin" && (
                <>
                  <Divider />
                  <Space.Compact className="w-full">
                    <TextArea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment..."
                      autoSize={{ minRows: 2, maxRows: 6 }}
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={handleSendComment}
                      disabled={!comment.trim()}
                    >
                      Send
                    </Button>
                  </Space.Compact>
                </>
              )}
            </Space>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Assigned To">
            <Space direction="vertical" className="w-full">
              {task.task_assignments?.map((assignment: any, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <Avatar
                    src={assignment.users?.avatar_url}
                    icon={<UserOutlined />}
                  />
                  <div>
                    <div className="font-medium">
                      {assignment.users?.full_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {assignment.users?.role}
                    </div>
                  </div>
                </div>
              ))}
              {task.task_assignments?.length === 0 && (
                <div className="text-center text-muted-foreground">
                  Unassigned
                </div>
              )}
            </Space>
          </Card>

          <Card
            title={
              <>
                <PaperClipOutlined /> Attachments
              </>
            }
          >
            <List
              dataSource={attachments}
              locale={{ emptyText: "No attachments" }}
              renderItem={(item: any) => (
                <List.Item
                  actions={[
                    <Button
                      icon={<DownloadOutlined />}
                      size="small"
                      onClick={() =>
                        handleDownloadAttachment(item.file_path, item.file_name)
                      }
                    >
                      Download
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={item.file_name}
                    description={
                      <div className="text-xs">
                        <div>{(item.file_size / 1024).toFixed(2)} KB</div>
                        <div>
                          by {item.uploaded_by_user?.full_name} on{" "}
                          {dayjs(item.uploaded_at).format("MMM DD, YYYY")}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
            {userProfile?.role === "data_collector" && (
              <div className="mt-4 space-y-3">
                <Divider />
                <div className="text-sm font-medium">Upload Data Files</div>
                <input type="file" multiple onChange={handleDataFilesChange} />
                <Button
                  type="primary"
                  onClick={handleUploadDataFiles}
                  disabled={uploading || !dataFiles || dataFiles.length === 0}
                >
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        title="Set Task to Pending"
        open={pendingModalOpen}
        onOk={handleConfirmPending}
        onCancel={() => setPendingModalOpen(false)}
        okText="Confirm"
      >
        <Space direction="vertical" className="w-full">
          <div>
            <div className="mb-1">Reason</div>
            <Select
              className="w-full"
              placeholder="Select reason"
              value={pendingReason}
              onChange={(v) => setPendingReason(v)}
              options={[
                { label: "Review", value: "review" },
                { label: "Data Missing", value: "data_missing" },
                { label: "Clarity Needed", value: "clarity_needed" },
              ]}
            />
          </div>
          <div>
            <div className="mb-1">Notes</div>
            <TextArea
              value={pendingNotes}
              onChange={(e) => setPendingNotes(e.target.value)}
              placeholder="Add details for pending"
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </div>
        </Space>
      </Modal>
      
      {/* Review Done Modal */}
      <Modal
        title="Complete Review"
        open={reviewModalOpen}
        onOk={handleReviewDone}
        onCancel={() => setReviewModalOpen(false)}
        okText="Mark as Completed"
      >
        {/* <Space direction="vertical" className="w-full">
          <div>
            <div className="mb-1">Review Notes (Optional)</div>
            <TextArea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add any notes about the review"
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </div>
        </Space> */}
      </Modal>

      {/* Change Request Modal */}
      <Modal
        title="Request Changes"
        open={changeRequestModalOpen}
        onOk={handleRequestChanges}
        onCancel={() => setChangeRequestModalOpen(false)}
        okText="Submit Changes"
      >
        <Space direction="vertical" className="w-full">
          <div>
            <div className="mb-1">Changes Required</div>
            <TextArea
              value={changeRequestNotes}
              onChange={(e) => setChangeRequestNotes(e.target.value)}
              placeholder="Describe what changes are needed"
              autoSize={{ minRows: 3, maxRows: 6 }}
              required
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
