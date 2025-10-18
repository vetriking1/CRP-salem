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
import { SupabaseNotificationService } from "@/services/supabaseNotificationService";
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
  // const [dataFiles, setDataFiles] = useState<FileList | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");

  // Reassignment states
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Review workflow states
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [changeRequestModalOpen, setChangeRequestModalOpen] = useState(false);
  const [changeRequestNotes, setChangeRequestNotes] = useState<string>("");

  useEffect(() => {
    fetchTaskDetails();
  }, []);

  // Fetch available users when reassign modal opens
  useEffect(() => {
    if (reassignModalOpen && task?.team_id) {
      fetchAvailableUsers();
    }
  }, [reassignModalOpen, task?.team_id]);

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
            is_primary,
            is_active,
            users!task_assignments_user_id_fkey(full_name, avatar_url, role, tasks_completed_count)
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
        const assignedUsers =
          task.task_assignments?.map((a: any) => a.user_id) || [];
        const allNotifyUsers = [
          ...new Set([...assignedUsers, task.created_by]),
        ];

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

      // Refresh tasks list if available
      if ((window as any).refreshTasks) {
        (window as any).refreshTasks();
      }

      // Refresh dashboard if available
      if ((window as any).refreshDashboard) {
        (window as any).refreshDashboard();
      }
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

      // Refresh tasks list if available
      if ((window as any).refreshTasks) {
        (window as any).refreshTasks();
      }

      // Refresh dashboard if available
      if ((window as any).refreshDashboard) {
        (window as any).refreshDashboard();
      }
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

      // Refresh tasks list if available
      if ((window as any).refreshTasks) {
        (window as any).refreshTasks();
      }

      // Refresh dashboard if available
      if ((window as any).refreshDashboard) {
        (window as any).refreshDashboard();
      }
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

      const currentAssigneeId =
        currentAssignments && currentAssignments.length > 0
          ? currentAssignments[0].user_id
          : null;

      // Deactivate current assignments
      await supabase
        .from("task_assignments")
        .update({ is_active: false })
        .eq("task_id", taskId)
        .eq("is_active", true);

      // Store the original assignee in task metadata (commented out as metadata field doesn't exist)
      // await supabase
      //   .from("tasks")
      //   .update({
      //     metadata: {
      //       original_assignee: currentAssigneeId,
      //       review_requested_at: new Date().toISOString(),
      //     },
      //   })
      //   .eq("id", taskId);

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

      // Find the primary assignee and increment their tasks_completed_count
      const primaryAssignee = task.task_assignments?.find(
        (assignment: any) =>
          assignment.is_primary === true && assignment.is_active
      );

      if (primaryAssignee) {
        const { error: userUpdateError } = await supabase
          .from("users")
          .update({
            tasks_completed_count:
              (primaryAssignee.users?.tasks_completed_count || 0) + 1,
          })
          .eq("id", primaryAssignee.user_id);

        if (userUpdateError) {
          console.error(
            "Error updating tasks_completed_count:",
            userUpdateError
          );
        }
      }

      // Add task history entry for completion
      await supabase.from("task_history").insert({
        task_id: id,
        user_id: userProfile?.id,
        action: "task_completed",
        old_value: { status: "review" },
        new_value: { status: "completed" },
        notes: `Task completed after review by ${userProfile?.full_name}`,
      });

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

      toast({
        title: "Success",
        description: "Review completed and task marked as done",
      });
      setReviewModalOpen(false);
      setReviewNotes("");
      fetchTaskDetails();

      // Refresh tasks list if available
      if ((window as any).refreshTasks) {
        (window as any).refreshTasks();
      }

      // Refresh dashboard if available
      if ((window as any).refreshDashboard) {
        (window as any).refreshDashboard();
      }
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
      const originalAssigneeId = allAssignments.find(
        (assignment: any) => !assignment.is_active
      )?.user_id;

      if (!originalAssigneeId) {
        toast({
          title: "Error",
          description: "Could not find the original assignee",
          variant: "destructive",
        });
        return;
      }

      // Check if the original assignee is the same as current reviewer
      const { data: currentActiveAssignments } = await supabase
        .from("task_assignments")
        .select("user_id, is_primary")
        .eq("task_id", id)
        .eq("is_active", true);

      const currentReviewerId = currentActiveAssignments?.find(
        (a) => !a.is_primary
      )?.user_id;
      const isSamePerson = originalAssigneeId === currentReviewerId;

      if (isSamePerson) {
        // Same person for both roles - just update their assignment to primary
        await supabase
          .from("task_assignments")
          .update({ is_primary: true })
          .eq("task_id", id)
          .eq("user_id", originalAssigneeId)
          .eq("is_active", true);
      } else {
        // Different people - deactivate reviewer and restore original assignee
        await supabase
          .from("task_assignments")
          .update({ is_active: false })
          .eq("task_id", id)
          .eq("is_active", true);

        // Create new assignment for the original assignee (restore as primary)
        await supabase.from("task_assignments").insert({
          task_id: id,
          user_id: originalAssigneeId,
          assigned_by: userProfile?.id,
          is_active: true,
          is_primary: true,
        });
      }

      // Add the change request as a subtask
      await supabase.from("subtasks").insert({
        task_id: id,
        title: `Review changes: ${changeRequestNotes}`,
        description: `Changes requested by ${
          userProfile?.full_name
        } on ${new Date().toLocaleDateString()}`,
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

      toast({
        title: "Success",
        description: "Changes requested and task reassigned",
      });
      setChangeRequestModalOpen(false);
      setChangeRequestNotes("");
      fetchTaskDetails();

      // Refresh tasks list if available
      if ((window as any).refreshTasks) {
        (window as any).refreshTasks();
      }

      // Refresh dashboard if available
      if ((window as any).refreshDashboard) {
        (window as any).refreshDashboard();
      }
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

      // Find the primary assignee and increment their tasks_delivered_count
      const primaryAssignee = task.task_assignments?.find(
        (assignment: any) =>
          assignment.is_primary === true && assignment.is_active
      );

      if (primaryAssignee) {
        const { error: userUpdateError } = await supabase
          .from("users")
          .update({
            tasks_delivered_count:
              (primaryAssignee.users?.tasks_delivered_count || 0) + 1,
          })
          .eq("id", primaryAssignee.user_id);

        if (userUpdateError) {
          console.error(
            "Error updating tasks_delivered_count:",
            userUpdateError
          );
        }
      }

      // Add task history entry for delivery
      await supabase.from("task_history").insert({
        task_id: id,
        user_id: userProfile?.id,
        action: "task_delivered",
        old_value: { status: "completed" },
        new_value: { status: "delivered" },
        notes: `Task delivered by ${userProfile?.full_name}`,
      });

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

      toast({
        title: "Success",
        description: "Payment completed and task delivered",
      });
      fetchTaskDetails();

      // Refresh tasks list if available
      if ((window as any).refreshTasks) {
        (window as any).refreshTasks();
      }

      // Refresh dashboard if available
      if ((window as any).refreshDashboard) {
        (window as any).refreshDashboard();
      }
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
        // Check if task creator is already assigned
        const { data: existingAssignments } = await supabase
          .from("task_assignments")
          .select("user_id, is_primary")
          .eq("task_id", taskId)
          .eq("is_active", true);

        const isCreatorAlreadyAssigned = existingAssignments?.some(
          (a: any) => a.user_id === task.created_by
        );

        if (isCreatorAlreadyAssigned) {
          // Creator is already assigned - add a secondary assignment for pending issue
          const { error: assignError } = await supabase
            .from("task_assignments")
            .insert({
              task_id: taskId,
              user_id: task.created_by,
              assigned_by: userProfile.id,
              is_active: true,
              is_primary: false, // Secondary for handling pending issue
            });
          if (assignError) throw assignError;
        } else {
          // Creator not assigned - deactivate current and assign creator for pending
          await supabase
            .from("task_assignments")
            .update({ is_active: false })
            .eq("task_id", taskId)
            .eq("is_active", true);

          const { error: assignError } = await supabase
            .from("task_assignments")
            .insert({
              task_id: taskId,
              user_id: task.created_by,
              assigned_by: userProfile.id,
              is_active: true,
              is_primary: false,
            });
          if (assignError) throw assignError;
        }

        console.log(
          `Task assigned to creator (${task.created_by}) for data collection`
        );
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

      // Add a comment documenting why the task was set to pending
      try {
        const commentContent = `Marked as pending: ${String(
          pendingReason
        ).replace("_", " ")}${pendingNotes ? ` — Notes: ${pendingNotes}` : ""}`;

        const { error: commentError } = await supabase.from("comments").insert([
          {
            task_id: id,
            user_id: userProfile?.id,
            content: commentContent,
          },
        ]);

        if (commentError) {
          console.warn("Failed to insert pending comment:", commentError);
        } else {
          // Also add a task history entry for auditing
          try {
            await supabase.from("task_history").insert({
              task_id: id,
              user_id: userProfile?.id,
              action: "set_pending",
              old_value: { status: task?.status },
              new_value: {
                status: "pending",
                pending_reason: pendingReason,
                pending_notes: pendingNotes || null,
              },
              notes: commentContent,
            });
          } catch (histErr) {
            console.warn("Failed to insert task_history for pending:", histErr);
          }
        }
      } catch (e) {
        console.warn("Unexpected error adding pending comment/history", e);
      }

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

      // Refresh tasks list if available
      if ((window as any).refreshTasks) {
        (window as any).refreshTasks();
      }

      // Refresh dashboard if available
      if ((window as any).refreshDashboard) {
        (window as any).refreshDashboard();
      }
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

      // 1) Fetch all assignments (latest first) - using * to get all fields
      const { data: assignments, error: fetchAssignErr } = await supabase
        .from("task_assignments")
        .select("*")
        .eq("task_id", id)
        .order("assigned_at", { ascending: false });

      if (fetchAssignErr) {
        console.error("Error fetching assignments:", fetchAssignErr);
        throw fetchAssignErr;
      }

      console.log("All assignments:", assignments);

      // Find the current active assignment (the pending assignee)
      const currentActive = (assignments || []).find((a: any) => a.is_active);
      console.log("Current active assignment:", currentActive);

      // Find the original primary worker by looking for the most recent primary assignment that is currently inactive
      // This could be the original assignee who was replaced when the task went to pending
      const sortedAssignments = [...(assignments || [])].sort(
        (a, b) =>
          new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
      );

      // Look for the primary assignee that was deactivated when the task went to pending
      let originalAssignee = sortedAssignments.find(
        (a: any) => a.is_primary === true && !a.is_active
      );

      // If no primary assignee found among inactive ones, pick the first primary assignee ever made
      if (!originalAssignee) {
        originalAssignee = sortedAssignments.find(
          (a: any) => a.is_primary === true
        );
      }

      console.log("Original assignee found:", originalAssignee);

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
        // For other pending reasons, restore the original assignee.

        if (originalAssignee) {
          console.log("Restoring original assignee:", originalAssignee.user_id);

          // Step 1: Find all active assignments for this task to track who needs their count updated
          const { data: activeAssignments, error: activeAssignmentsError } =
            await supabase
              .from("task_assignments")
              .select("user_id")
              .eq("task_id", id)
              .eq("is_active", true);

          if (activeAssignmentsError) {
            console.error(
              "Error fetching active assignments:",
              activeAssignmentsError
            );
            throw activeAssignmentsError;
          }

          // Step 2: Deactivate all current active assignments for this task first
          const { error: deactivateError } = await supabase
            .from("task_assignments")
            .update({ is_active: false })
            .eq("task_id", id)
            .eq("is_active", true);

          if (deactivateError) {
            console.error(
              "Error deactivating current assignments:",
              deactivateError
            );
            throw deactivateError;
          }

          // Step 3: Check if original assignee already has an inactive assignment record
          const {
            data: originalAssigneeAssignment,
            error: findAssignmentError,
          } = await supabase
            .from("task_assignments")
            .select("*")
            .eq("task_id", id)
            .eq("user_id", originalAssignee.user_id)
            .limit(1)
            .single(); // Using single() as we expect only one record per user for a task

          if (findAssignmentError && findAssignmentError.code !== "PGRST116") {
            // PGRST116 is "Results contain 0 rows"
            console.error(
              "Error finding original assignee's assignment:",
              findAssignmentError
            );
            throw findAssignmentError;
          }

          // Step 4: If original assignee has an existing assignment record (inactive), reactivate it
          if (originalAssigneeAssignment) {
            const { error: updateError } = await supabase
              .from("task_assignments")
              .update({
                is_active: true,
                is_primary: true,
              })
              .eq("task_id", id)
              .eq("user_id", originalAssignee.user_id);

            if (updateError) {
              console.error("Error updating original assignee:", updateError);
              throw updateError;
            }
          } else {
            // Step 4b: If no existing assignment record exists, create a new primary assignment
            const { error: insertError } = await supabase
              .from("task_assignments")
              .insert({
                task_id: id,
                user_id: originalAssignee.user_id,
                assigned_by: userProfile?.id,
                is_active: true,
                is_primary: true,
              });

            if (insertError) {
              console.error(
                "Error creating new assignment for original assignee:",
                insertError
              );
              throw insertError;
            }
          }

          console.log(
            "Successfully restored assignment for user:",
            originalAssignee.user_id
          );

          // Step 5: Update task status back to in_progress
          const { error: updateTaskError } = await supabase
            .from("tasks")
            .update({
              status: "in_progress",
              pending_reason: null,
              pending_notes: null,
            })
            .eq("id", id);

          if (updateTaskError) {
            console.error("Error updating task status:", updateTaskError);
            throw updateTaskError;
          }

          // Step 6: Add task history entry
          await supabase.from("task_history").insert({
            task_id: id,
            user_id: userProfile?.id,
            action: "resume_from_pending",
            old_value: previous,
            new_value: {
              status: "in_progress",
              restored_user_id: originalAssignee.user_id,
            },
            notes: "Task resumed from pending; original assignee restored.",
          });
        } else {
          // No original assignee found, so just move to not_started.
          const { error: updateTaskError } = await supabase
            .from("tasks")
            .update({
              status: "not_started",
              pending_reason: null,
              pending_notes: null,
            })
            .eq("id", id);

          if (updateTaskError) throw updateTaskError;

          // Deactivate any remaining active assignments
          await supabase
            .from("task_assignments")
            .update({ is_active: false })
            .eq("task_id", id)
            .eq("is_active", true);

          // Add task history entry
          await supabase.from("task_history").insert({
            task_id: id,
            user_id: userProfile?.id,
            action: "resume_from_pending",
            old_value: previous,
            new_value: { status: "not_started" },
            notes: "Task resumed from pending; no original assignee found.",
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
        description:
          task.pending_reason === "data_missing"
            ? "Task moved to Not Started and unassigned"
            : "Task moved to In Progress",
      });
      fetchTaskDetails();

      // Refresh tasks list if available
      if ((window as any).refreshTasks) {
        (window as any).refreshTasks();
      }

      // Refresh dashboard if available
      if ((window as any).refreshDashboard) {
        (window as any).refreshDashboard();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // COMMENTED OUT: Supabase Storage Upload
  // const handleDataFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   if (e.target.files) setDataFiles(e.target.files);
  // };

  // const handleUploadDataFiles = async () => {
  //   if (!dataFiles || dataFiles.length === 0) return;
  //   if (!userProfile?.id) return;
  //   setUploading(true);
  //   try {
  //     for (let i = 0; i < dataFiles.length; i++) {
  //       const file = dataFiles[i];
  //       const ext = file.name.split(".").pop();
  //       const path = `${userProfile.id}/${id}/${Date.now()}.${ext}`;
  //       const { error: uploadError } = await supabase.storage
  //         .from("task-attachments")
  //         .upload(path, file);
  //       if (uploadError) throw uploadError;
  //       await supabase.from("attachments").insert({
  //         task_id: id,
  //         file_name: file.name,
  //         file_path: path,
  //         file_type: file.type,
  //         file_size: file.size,
  //         uploaded_by: userProfile.id,
  //       });
  //     }
  //     toast({ title: "Uploaded", description: "Files uploaded" });
  //     setDataFiles(null);
  //     fetchTaskDetails();
  //   } catch (e: any) {
  //     toast({ title: "Error", description: e.message, variant: "destructive" });
  //   } finally {
  //     setUploading(false);
  //   }
  // };

  // NEW: Handle URL submission
  const handleAddAttachmentUrl = async () => {
    if (!attachmentUrl.trim() || !attachmentName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both file name and URL",
        variant: "destructive",
      });
      return;
    }
    if (!userProfile?.id) return;
    setUploading(true);
    try {
      await supabase.from("attachments").insert({
        task_id: id,
        file_name: attachmentName,
        file_path: attachmentUrl,
        file_type: "url",
        file_size: 0,
        uploaded_by: userProfile.id,
      });
      toast({ title: "Success", description: "Attachment URL added" });
      setAttachmentUrl("");
      setAttachmentName("");
      fetchTaskDetails();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // COMMENTED OUT: Supabase Storage Download
  // const handleDownloadAttachment = async (
  //   filePath: string,
  //   fileName: string
  // ) => {
  //   try {
  //     const { data, error } = await supabase.storage
  //       .from("task-attachments")
  //       .download(filePath);

  //     if (error) throw error;

  //     const url = URL.createObjectURL(data);
  //     const a = document.createElement("a");
  //     a.href = url;
  //     a.download = fileName;
  //     document.body.appendChild(a);
  //     a.click();
  //     document.body.removeChild(a);
  //     URL.revokeObjectURL(url);
  //   } catch (error: any) {
  //     toast({
  //       title: "Error",
  //       description: "Failed to download file",
  //       variant: "destructive",
  //     });
  //   }
  // };

  // NEW: Open URL in new tab
  const handleOpenAttachment = (fileUrl: string) => {
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  };

  // Fetch available users for reassignment
  const fetchAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      // Fetch team members if task has a team
      if (task?.team_id) {
        const { data: teamMembers, error } = await supabase
          .from("team_members")
          .select(
            `
            user_id,
            users!team_members_user_id_fkey(
              id,
              full_name,
              avatar_url,
              role,
              is_active,
              current_task_count,
              tasks_completed_count,
              tasks_delivered_count
            )
          `
          )
          .eq("team_id", task.team_id);

        if (error) throw error;

        // Filter active users and format the data
        const users = (teamMembers || [])
          .map((tm: any) => tm.users)
          .filter((u: any) => u && u.is_active && u.role !== "admin");

        setAvailableUsers(users);
      } else {
        // If no team, fetch all active users except admins
        const { data: users, error } = await supabase
          .from("users")
          .select(
            "id, full_name, avatar_url, role, is_active, current_task_count, tasks_completed_count, tasks_delivered_count"
          )
          .eq("is_active", true)
          .neq("role", "admin");

        if (error) throw error;
        setAvailableUsers(users || []);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  // Handle task reassignment
  const handleReassignTask = async () => {
    // Check if user is manager or admin
    if (userProfile?.role !== "manager" && userProfile?.role !== "admin") {
      toast({
        title: "Not Authorized",
        description: "Only managers and admins can reassign tasks",
        variant: "destructive",
      });
      return;
    }

    if (!selectedUserId) {
      toast({
        title: "Missing Information",
        description: "Please select a user to assign",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get current assignment info for history
      const currentAssignee = task.task_assignments?.find(
        (a: any) => a.is_active
      );

      // Deactivate current assignments
      await supabase
        .from("task_assignments")
        .update({ is_active: false })
        .eq("task_id", id)
        .eq("is_active", true);

      // Create new assignment as primary
      const { error: assignError } = await supabase
        .from("task_assignments")
        .insert({
          task_id: id,
          user_id: selectedUserId,
          assigned_by: userProfile?.id,
          is_active: true,
          is_primary: true,
        });

      if (assignError) throw assignError;

      // Update task status to assigned if it was not_started
      if (task.status === "not_started") {
        await supabase
          .from("tasks")
          .update({ status: "assigned" })
          .eq("id", id);
      }

      // Add task history entry
      await supabase.from("task_history").insert({
        task_id: id,
        user_id: userProfile?.id,
        action: "reassign",
        old_value: {
          user_id: currentAssignee?.user_id || null,
        },
        new_value: {
          user_id: selectedUserId,
        },
        notes: `Task reassigned by ${userProfile?.full_name}`,
      });

      // Note: Task assignment notification is automatically created by database trigger
      // No need to manually create notification here to avoid duplicates

      // Notify previous assignee if exists
      if (
        currentAssignee?.user_id &&
        currentAssignee.user_id !== selectedUserId
      ) {
        await supabase.from("notifications").insert({
          user_id: currentAssignee.user_id,
          task_id: task.id,
          type: "task_status_changed",
          title: "Task Reassigned",
          message: `Task "${task.title}" has been reassigned to another user`,
        });
      }

      toast({
        title: "Success",
        description: "Task reassigned successfully",
      });

      setReassignModalOpen(false);
      setSelectedUserId(undefined);
      fetchTaskDetails();

      // Refresh tasks list if available
      if ((window as any).refreshTasks) {
        (window as any).refreshTasks();
      }

      // Refresh dashboard if available
      if ((window as any).refreshDashboard) {
        (window as any).refreshDashboard();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
                {(userProfile?.role === "senior" ||
                  userProfile?.role === "manager" ||
                  userProfile?.role === "admin") &&
                  isAssigned && (
                    <>
                      <Button
                        type="primary"
                        onClick={() => setReviewModalOpen(true)}
                      >
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
            {!["pending", "review", "completed", "delivered"].includes(
              task.status
            ) && (
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
              {/* <Descriptions.Item label="Estimated Hours">
                <ClockCircleOutlined /> {task.estimated_hours || 0} hours
              </Descriptions.Item> */}
              {/* <Descriptions.Item label="Actual Hours">
                <ClockCircleOutlined /> {task.actual_hours || 0} hours
              </Descriptions.Item> */}
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
          <Card
            title="Assigned To"
            extra={
              (userProfile?.role === "manager" ||
                userProfile?.role === "admin") && (
                <Button size="small" onClick={() => setReassignModalOpen(true)}>
                  Reassign
                </Button>
              )
            }
          >
            <Space direction="vertical" className="w-full">
              {(() => {
                let relevantAssignments = task.task_assignments || [];

                // For completed/delivered tasks, show recent assignments (not just active)
                if (
                  task.status === "completed" ||
                  task.status === "delivered"
                ) {
                  // Get the most recent assignments (both active and recent inactive)
                  const sortedAssignments = relevantAssignments.sort(
                    (a: any, b: any) =>
                      new Date(b.assigned_at || b.created_at).getTime() -
                      new Date(a.assigned_at || a.created_at).getTime()
                  );

                  // Include active assignments and the most recent primary assignment
                  const activeAssignments = sortedAssignments.filter(
                    (a: any) => a.is_active
                  );
                  const recentPrimaryAssignment = sortedAssignments.find(
                    (a: any) => a.is_primary && !a.is_active
                  );

                  relevantAssignments = [...activeAssignments];
                  if (
                    recentPrimaryAssignment &&
                    !activeAssignments.some(
                      (a: any) => a.user_id === recentPrimaryAssignment.user_id
                    )
                  ) {
                    relevantAssignments.push(recentPrimaryAssignment);
                  }
                } else {
                  // For other statuses, only show active assignments
                  relevantAssignments = relevantAssignments.filter(
                    (a: any) => a.is_active
                  );
                }

                // Group assignments by user to detect multiple roles
                const userAssignments = relevantAssignments.reduce(
                  (acc: any, assignment: any) => {
                    const userId = assignment.user_id;
                    if (!acc[userId]) {
                      acc[userId] = {
                        user: assignment.users,
                        assignments: [],
                      };
                    }
                    acc[userId].assignments.push(assignment);
                    return acc;
                  },
                  {}
                );

                const userGroups = Object.values(userAssignments);

                if (userGroups.length === 0) {
                  return (
                    <div className="text-center text-muted-foreground p-4">
                      <UserOutlined className="text-2xl mb-2" />
                      <div>No assignments found</div>
                    </div>
                  );
                }

                return userGroups.map((userGroup: any, index: number) => {
                  const { user, assignments } = userGroup;
                  const primaryAssignment = assignments.find(
                    (a: any) => a.is_primary
                  );
                  const secondaryAssignments = assignments.filter(
                    (a: any) => !a.is_primary
                  );

                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border"
                    >
                      <Avatar src={user?.avatar_url} icon={<UserOutlined />} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{user?.full_name}</span>

                          {/* Primary Assignment Tag */}
                          {primaryAssignment && (
                            <Tag color="blue">Primary Worker</Tag>
                          )}

                          {/* Secondary Assignment Tags */}
                          {secondaryAssignments.map(
                            (secAssignment: any, secIndex: number) => {
                              if (
                                task.status === "pending" &&
                                task.pending_reason
                              ) {
                                return (
                                  <Tag key={secIndex} color="orange">
                                    Handling{" "}
                                    {task.pending_reason.replace("_", " ")}
                                  </Tag>
                                );
                              } else if (task.status === "review") {
                                return (
                                  <Tag key={secIndex} color="purple">
                                    Reviewer
                                  </Tag>
                                );
                              } else if (
                                task.status === "completed" ||
                                task.status === "delivered"
                              ) {
                                return (
                                  <Tag key={secIndex} color="green">
                                    Reviewed & Approved
                                  </Tag>
                                );
                              } else {
                                return (
                                  <Tag key={secIndex} color="default">
                                    Secondary
                                  </Tag>
                                );
                              }
                            }
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground mt-1">
                          {user?.role}
                        </div>

                        {/* Assignment Context Details */}
                        {assignments.length > 1 && (
                          <div className="text-xs mt-2 space-y-1">
                            {primaryAssignment && (
                              <div className="text-blue-600">
                                {task.status === "completed" ||
                                task.status === "delivered"
                                  ? "• Completed the task work"
                                  : "• Primary assignee for task execution"}
                              </div>
                            )}
                            {secondaryAssignments.map(
                              (secAssignment: any, secIndex: number) => (
                                <div key={secIndex} className="text-orange-600">
                                  {task.status === "pending" &&
                                    task.pending_reason &&
                                    `• Handling ${task.pending_reason.replace(
                                      "_",
                                      " "
                                    )} issue`}
                                  {task.status === "review" &&
                                    "• Assigned for review and approval"}
                                  {(task.status === "completed" ||
                                    task.status === "delivered") &&
                                    "• Reviewed and approved the task"}
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {/* Single assignment context */}
                        {assignments.length === 1 && (
                          <div className="text-xs mt-1">
                            {!primaryAssignment &&
                              task.status === "pending" &&
                              task.pending_reason && (
                                <div className="text-orange-600">
                                  Handling:{" "}
                                  {task.pending_reason.replace("_", " ")}
                                </div>
                              )}
                            {!primaryAssignment && task.status === "review" && (
                              <div className="text-purple-600">
                                Reviewing task for approval
                              </div>
                            )}
                            {primaryAssignment &&
                              task.status === "completed" && (
                                <div className="text-green-600">
                                  Task completed - awaiting payment processing
                                </div>
                              )}
                            {primaryAssignment &&
                              task.status === "delivered" && (
                                <div className="text-green-600">
                                  Task Delivered - payment processed
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
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
                      onClick={() => handleOpenAttachment(item.file_path)}
                    >
                      Open URL
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={item.file_name}
                    description={
                      <div className="text-xs">
                        <div
                          className="truncate max-w-xs"
                          title={item.file_path}
                        >
                          {item.file_path}
                        </div>
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
                <div className="text-sm font-medium">Add Attachment URL</div>
                <Input
                  placeholder="File/Document Name"
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                />
                <Input
                  placeholder="https://example.com/file.pdf"
                  type="url"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                />
                <Button
                  type="primary"
                  onClick={handleAddAttachmentUrl}
                  disabled={
                    uploading || !attachmentUrl.trim() || !attachmentName.trim()
                  }
                >
                  {uploading ? "Adding..." : "Add Attachment"}
                </Button>
              </div>
            )}
            {/* COMMENTED OUT: File Upload UI
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
            */}
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
                // { label: "Review", value: "review" },
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

      {/* Reassign Task Modal */}
      <Modal
        title="Reassign Task"
        open={reassignModalOpen}
        onOk={handleReassignTask}
        onCancel={() => {
          setReassignModalOpen(false);
          setSelectedUserId(undefined);
        }}
        okText="Reassign"
        confirmLoading={loadingUsers}
      >
        <Space direction="vertical" className="w-full">
          <div>
            <div className="mb-2 font-medium">Current Assignee</div>
            {task?.task_assignments
              ?.filter((a: any) => a.is_active)
              .map((assignment: any) => (
                <div
                  key={assignment.user_id}
                  className="flex items-center gap-3 mb-4 p-2 bg-gray-50 rounded"
                >
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
            {task?.task_assignments?.filter((a: any) => a.is_active).length ===
              0 && (
              <div className="text-muted-foreground mb-4">
                No current assignee
              </div>
            )}
          </div>
          <div>
            <div className="mb-2 font-medium">Select New Assignee</div>
            <Select
              className="w-full"
              placeholder="Select a user"
              value={selectedUserId}
              onChange={(v) => setSelectedUserId(v)}
              loading={loadingUsers}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={availableUsers.map((user) => ({
                label: `${user.full_name} (${user.role}) - ${
                  user.current_task_count || 0
                } tasks`,
                value: user.id,
              }))}
            />
          </div>
          {selectedUserId && (
            <div className="mt-2 p-3 bg-blue-50 rounded">
              <div className="text-sm">
                <strong>Note:</strong> The task will be reassigned to the
                selected user. The current assignee will be notified about this
                change.
              </div>
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
}
