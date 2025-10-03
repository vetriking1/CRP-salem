import { supabase } from "@/integrations/supabase/client";
import { NotificationService } from "./notificationService";

export interface AssignmentCriteria {
  teamId: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedHours: number;
  priority: "low" | "medium" | "high" | "urgent";
  assignedBy: string;
}

export interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export interface AssignmentResult {
  success: boolean;
  assignedUserId?: string;
  assignedUserName?: string;
  reason?: string;
  error?: string;
}

/**
 * Smart auto-assignment service that considers:
 * - Task difficulty vs user role (hard=senior, medium=senior+employee, easy=all)
 * - Current workload vs capacity
 * - Number of active task assignments
 * - Team membership and roles
 */
export class AutoAssignmentService {
  /**
   * Auto-assign a task to the best available team member
   */
  static async assignTask(
    taskId: string,
    criteria: AssignmentCriteria
  ): Promise<AssignmentResult> {
    try {
      // 1. Get team members with their details
      const teamMembers = await this.getTeamMembers(criteria.teamId);
      if (teamMembers.length === 0) {
        return {
          success: false,
          error: "No active team members found",
        };
      }

      // 2. Filter members by difficulty requirements
      const eligibleMembers = this.filterByDifficulty(
        teamMembers,
        criteria.difficulty
      );
      if (eligibleMembers.length === 0) {
        return {
          success: false,
          error: `No team members qualified for ${criteria.difficulty} difficulty tasks`,
        };
      }

      // 3. Get current task assignment counts
      const memberAssignments = await this.getAssignmentCounts(
        eligibleMembers.map((m) => m.id)
      );

      // 4. Calculate assignment scores and pick the best candidate
      const bestMember = this.selectBestMember(
        eligibleMembers,
        memberAssignments,
        criteria
      );

      if (!bestMember) {
        return {
          success: false,
          error: "No suitable team member available",
        };
      }

      // 5. Create the assignment as primary (without assignment_type to avoid enum issues)
      const { error: assignError } = await supabase
        .from("task_assignments")
        .insert({
          task_id: taskId,
          user_id: bestMember.id,
          assigned_by: criteria.assignedBy,
          is_active: true,
          is_primary: true,
        });

      if (assignError) {
        console.error("Assignment insert error:", assignError);
        throw assignError;
      }

      // 6. Update task status
      await supabase
        .from("tasks")
        .update({ status: "assigned" })
        .eq("id", taskId);

      // 7. Get task details for notification
      const { data: taskData } = await supabase
        .from("tasks")
        .select("title")
        .eq("id", taskId)
        .single();

      // 8. Send notification to assigned user
      if (taskData) {
        await NotificationService.notifyTaskAssignment(
          bestMember.id,
          taskId,
          taskData.title
        );
      }

      return {
        success: true,
        assignedUserId: bestMember.id,
        assignedUserName: bestMember.full_name,
        reason: `Assigned to ${bestMember.full_name} (${bestMember.role} role)`,
      };
    } catch (error) {
      console.error("Auto-assignment error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Assignment failed",
      };
    }
  }

  /**
   * Auto-assign for pending tasks (review, data_missing, etc.)
   */
  static async assignForPending(
    taskId: string,
    teamId: string | null,
    pendingReason: string,
    assignedBy: string
  ): Promise<AssignmentResult> {
    if (!teamId) {
      return { success: false, error: "No team specified" };
    }

    try {
      const teamMembers = await this.getTeamMembers(teamId);
      let targetMember: TeamMember | null = null;

      if (pendingReason === "review" || pendingReason === "clarity_needed") {
        // Prefer managers or senior members for both review and clarity_needed
        targetMember = this.findReviewer(teamMembers);
      } else if (pendingReason === "data_missing") {
        // Prefer data collectors or members with data specialty
        targetMember = this.findDataCollector(teamMembers);
      } else {
        // For other reasons, find least busy member
        const memberAssignments = await this.getAssignmentCounts(
          teamMembers.map((m) => m.id)
        );
        targetMember = this.selectBestMember(teamMembers, memberAssignments, {
          teamId,
          difficulty: "medium",
          estimatedHours: 0,
          priority: "medium",
          assignedBy,
        });
      }

      if (!targetMember) {
        return { success: false, error: "No suitable team member found" };
      }

      // Deactivate current assignments
      await supabase
        .from("task_assignments")
        .update({ is_active: false })
        .eq("task_id", taskId)
        .eq("is_active", true);

      // Create new assignment as secondary for pending issues (without assignment_type to avoid enum issues)
      const { error: assignError } = await supabase
        .from("task_assignments")
        .insert({
          task_id: taskId,
          user_id: targetMember.id,
          assigned_by: assignedBy,
          is_active: true,
          is_primary: false, // Secondary assignment for handling pending issues
        });

      if (assignError) throw assignError;

      return {
        success: true,
        assignedUserId: targetMember.id,
        assignedUserName: targetMember.full_name,
        reason: `Reassigned for ${pendingReason}`,
      };
    } catch (error) {
      console.error("Pending assignment error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Assignment failed",
      };
    }
  }

  /**
   * Get team members with their workload and seniority info
   */
  private static async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const { data: memberIds } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId);

    if (!memberIds || memberIds.length === 0) return [];

    const userIds = memberIds.map((m: any) => m.user_id);

    const { data: users } = await supabase
      .from("users")
      .select(
        "id, full_name, role, is_active"
      )
      .in("id", userIds)
      .eq("is_active", true);

    return (users || []) as TeamMember[];
  }

  /**
   * Filter team members by difficulty requirements based on role
   * - Easy: All roles (employee, data_collector, senior, manager, admin)
   * - Medium: Employee and above (employee, senior, manager, admin)
   * - Hard: Senior only (senior, manager, admin)
   */
  private static filterByDifficulty(
    members: TeamMember[],
    difficulty: string
  ): TeamMember[] {
    const difficultyRequirements: Record<string, string[]> = {
      easy: ["employee"],
      medium: ["admin", "manager", "senior", "employee"],
      hard: ["admin", "manager", "senior"], // Hard tasks only for senior roles
    };

    const requiredRoles = difficultyRequirements[difficulty] || ["employee"];
    return members.filter((member) =>
      requiredRoles.includes(member.role)
    );
  }

  /**
   * Get current active task assignment counts for users
   */
  private static async getAssignmentCounts(
    userIds: string[]
  ): Promise<Record<string, number>> {
    const { data: assignments } = await supabase
      .from("task_assignments")
      .select("user_id")
      .eq("is_active", true)
      .in("user_id", userIds);

    const counts: Record<string, number> = {};
    (assignments || []).forEach((a: any) => {
      counts[a.user_id] = (counts[a.user_id] || 0) + 1;
    });

    return counts;
  }

  /**
   * Select the best member based on workload, capacity, and assignments
   * For hard tasks, prefers senior roles. For easy/medium, distributes evenly.
   */
  private static selectBestMember(
    members: TeamMember[],
    assignmentCounts: Record<string, number>,
    criteria: AssignmentCriteria
  ): TeamMember | null {
    if (members.length === 0) return null;

    // Calculate scores for each member (lower score = better candidate)
    const scoredMembers = members.map((member) => {
      const activeAssignments = assignmentCounts[member.id] || 0;

      // Workload ratio (0-1, where 1 is at capacity)
      const workloadRatio = activeAssignments / 10; // Assume max 10 tasks

      // Priority multiplier for urgent tasks
      const priorityMultiplier = criteria.priority === "urgent" ? 0.5 : 1;

      // Role bonus: For hard tasks, prefer senior roles (negative score = higher priority)
      const roleBonus =
        criteria.difficulty === "hard"
          ? member.role === "senior"
            ? -0.2  // Senior gets highest priority for hard tasks
            : member.role === "manager"
            ? -0.15 // Manager is second choice
            : member.role === "admin"
            ? -0.1  // Admin is third choice
            : 0
          : 0; // For easy/medium tasks, no role preference

      // Combined score: workload + priority + hours + role bonus
      const score =
        workloadRatio * priorityMultiplier +
        activeAssignments * 0.1 +
        (criteria.estimatedHours / 40) * 0.5 +
        roleBonus;

      return { member, score, activeAssignments };
    });

    // Sort by score (ascending) - lowest score wins
    scoredMembers.sort((a, b) => a.score - b.score);
    
    const selected = scoredMembers[0]?.member || null;
    
    // Log assignment decision for debugging
    if (selected) {
      console.log(`Auto-assigned to ${selected.full_name} (${selected.role}) - ${scoredMembers[0].activeAssignments} active tasks`);
    }
    
    return selected;
  }

  /**
   * Find a suitable reviewer (senior is primary, then manager/admin)
   */
  private static findReviewer(members: TeamMember[]): TeamMember | null {
    // First try to find a senior member (primary reviewer)
    const senior = members.find((m) => m.role === "senior");
    if (senior) return senior;

    // Then try manager or admin as backup
    const managerOrAdmin = members.find((m) =>
      ["manager", "admin"].includes(m.role)
    );
    if (managerOrAdmin) return managerOrAdmin;

    // Fallback to any available member
    return members[0] || null;
  }

  /**
   * Find a data collector or member with data specialty
   */
  private static findDataCollector(members: TeamMember[]): TeamMember | null {
    // First try to find someone with data collector role
    const dataCollector = members.find((m) => m.role === "data_collector");
    if (dataCollector) return dataCollector;

    // Fallback to any available member
    return members[0] || null;
  }
}
